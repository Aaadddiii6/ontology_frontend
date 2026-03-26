import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as d3 from "d3";
import { ActiveModule, CountryProfile, RelationEdge } from "../../types";
import { MODULE_CONFIGS } from "../../lib/api";
import { COUNTRY_COORDS, normalizeCountryName } from "../../lib/countryData";

interface RelationsLayerProps {
  activeModule: ActiveModule;
  profileMap: Map<string, CountryProfile>;
  isVisible: boolean;
  onToggle: () => void;
  countryCoords?: Map<string, [number, number]>;
  dimensions: { width: number; height: number };
  relations?: RelationEdge[];
}

interface CountryGeo {
  name: string;
  lon: number;
  lat: number;
}

const COUNTRY_GEO_FALLBACK: CountryGeo[] = [
  { name: "United States", lon: -95, lat: 37 },
  { name: "Russian Federation", lon: 100, lat: 60 },
];

const DEFENCE_RELATIONS = [
  {
    from: "United States",
    to: "United Kingdom",
    strength: 2.5,
    type: "Military Trade",
  },
  { from: "United States", to: "Japan", strength: 2.2, type: "Military Trade" },
  {
    from: "Russian Federation",
    to: "India",
    strength: 2.8,
    type: "Strategic Defence",
  },
  { from: "France", to: "India", strength: 2.4, type: "Rafale Deal" },
  {
    from: "United States",
    to: "India",
    strength: 2.1,
    type: "Defence Partnership",
  },
  { from: "China", to: "Pakistan", strength: 2.1, type: "Military Trade" },
  {
    from: "United States",
    to: "Israel",
    strength: 2.3,
    type: "Military Trade",
  },
  { from: "India", to: "Israel", strength: 2.0, type: "Joint Tech" },
  { from: "Germany", to: "Israel", strength: 1.7, type: "Military Trade" },
  {
    from: "United Kingdom",
    to: "Saudi Arabia",
    strength: 1.9,
    type: "Military Trade",
  },
];

const ECONOMY_RELATIONS = [
  { from: "China", to: "United States", strength: 2.8, type: "Trade Deal" },
  { from: "Germany", to: "China", strength: 2.4, type: "Trade Deal" },
  {
    from: "India",
    to: "United Arab Emirates",
    strength: 2.5,
    type: "CEPA Trade",
  },
  {
    from: "India",
    to: "United Kingdom",
    strength: 2.0,
    type: "FTA Negotiations",
  },
  { from: "Japan", to: "Australia", strength: 1.8, type: "Trade Deal" },
  { from: "Canada", to: "United States", strength: 2.9, type: "Trade Deal" },
  { from: "Brazil", to: "China", strength: 2.2, type: "Trade Deal" },
  {
    from: "India",
    to: "Australia",
    strength: 2.1,
    type: "Economic Cooperation",
  },
  { from: "Saudi Arabia", to: "China", strength: 2.1, type: "Energy Trade" },
];

const GEOPOLITICS_RELATIONS = [
  {
    from: "United States",
    to: "United Kingdom",
    strength: 2.5,
    type: "Alliance",
  },
  {
    from: "India",
    to: "United States",
    strength: 2.3,
    type: "Quad Alliance",
  },
  { from: "India", to: "Japan", strength: 2.2, type: "Quad Alliance" },
  { from: "India", to: "Australia", strength: 2.1, type: "Quad Alliance" },
  {
    from: "China",
    to: "Russian Federation",
    strength: 2.2,
    type: "Strategic Partnership",
  },
  { from: "Brazil", to: "Russian Federation", strength: 1.8, type: "BRICS" },
  { from: "South Africa", to: "India", strength: 1.9, type: "BRICS" },
  {
    from: "India",
    to: "Russian Federation",
    strength: 2.0,
    type: "Strategic Autonomy",
  },
  { from: "Germany", to: "France", strength: 2.4, type: "EU core" },
];

const RelationsLayer: React.FC<RelationsLayerProps> = ({
  activeModule,
  profileMap,
  isVisible,
  onToggle,
  countryCoords,
  dimensions,
  relations,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const moduleConfig = MODULE_CONFIGS[activeModule] || MODULE_CONFIGS.overview;

  const projection = useMemo(() => {
    const proj = d3.geoNaturalEarth1();
    if (dimensions.width > 0 && dimensions.height > 0) {
      proj.fitSize([dimensions.width, dimensions.height], {
        type: "Sphere",
      } as any);
      const [tx, ty] = proj.translate();
      proj.translate([tx, ty + 40]); // Match HexMap alignment push
    }
    return proj;
  }, [dimensions]);

  const currentRelations = useMemo(() => {
    if (relations && relations.length > 0) return relations;

    const fallbackRelations: any[] = [];
    // Generate relations from alliances in profiles
    profileMap.forEach((profile, countryName) => {
      if (profile.alliances && profile.alliances.length > 0) {
        profile.alliances.forEach((ally) => {
          if (ally !== countryName) {
            fallbackRelations.push({
              fromCountry: countryName,
              toCountry: ally,
              weight: 0.5,
              type: "Alliance",
              moduleColor: moduleConfig.accent,
            });
          }
        });
      }
    });

    if (fallbackRelations.length === 0) {
      const staticRels =
        activeModule === "defence"
          ? DEFENCE_RELATIONS
          : activeModule === "economy"
            ? ECONOMY_RELATIONS
            : activeModule === "geopolitics"
              ? GEOPOLITICS_RELATIONS
              : [];

      return staticRels.map((r) => ({
        fromCountry: r.from,
        toCountry: r.to,
        weight: r.strength / 3,
        moduleColor: moduleConfig.accent,
      }));
    }
    return fallbackRelations;
  }, [profileMap, activeModule, relations, moduleConfig.accent]);

  // Use either provided coords or fallback
  const getCoords = (name: string): [number, number] | null => {
    if (countryCoords && countryCoords.has(name)) {
      return countryCoords.get(name)!;
    }
    const normalized = normalizeCountryName(name) || name;
    return COUNTRY_COORDS[normalized] || null;
  };

  const getScore = (countryName: string) => {
    const profile = profileMap.get(countryName);
    if (!profile) return 0.4;
    switch (activeModule) {
      case "defence":
        return profile.military_strength || 0.5;
      case "economy":
        return (profile.arms_export || 0) + (profile.defense_spending || 0);
      case "geopolitics":
        return profile.diplomatic_centrality || 0.6;
      case "climate":
        return (
          (profile.live_risk || 0) * 0.7 + (profile.conflict_risk || 0) * 0.3
        );
      default:
        return 0.5;
    }
  };

  const projectPoint = (geo: [number, number]) => {
    const [x, y] = projection(geo) || [0, 0];
    return { x, y };
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      {/* Toggle Button moved to page.tsx for global control, keeping this for flat map only if needed, 
          but for now we'll rely on the one in page.tsx to avoid duplication */}

      {/* SVG Layer */}
      <AnimatePresence>
        {isVisible && dimensions.width > 0 && (
          <motion.svg
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 w-full h-full z-[100]"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="glow-line">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Relations Lines */}
            {currentRelations.map((rel, i) => {
              const startGeo = getCoords(rel.fromCountry);
              const endGeo = getCoords(rel.toCountry);
              if (!startGeo || !endGeo) return null;

              const start = projectPoint(startGeo);
              const end = projectPoint(endGeo);

              // Draw a quadratic bezier curve for aesthetic "arc"
              const dx = end.x - start.x;
              const dy = end.y - start.y;
              const dr = Math.sqrt(dx * dx + dy * dy);
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2 - dr * 0.15;
              const path = `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;

              return (
                <g key={i}>
                  <path
                    d={path}
                    fill="none"
                    stroke={rel.moduleColor || moduleConfig.accent}
                    strokeWidth={(rel.weight || 0.5) * 2}
                    strokeOpacity="0.15"
                    filter="url(#glow-line)"
                  />
                  <motion.path
                    d={path}
                    fill="none"
                    stroke={rel.moduleColor || moduleConfig.accent}
                    strokeWidth={(rel.weight || 0.5) * 2}
                    strokeOpacity="0.4"
                    strokeDasharray="4, 10"
                    animate={{ strokeDashoffset: [0, -40] }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                </g>
              );
            })}

            {/* Country Circles */}
            {Object.keys(COUNTRY_COORDS).map((countryName) => {
              const geo = COUNTRY_COORDS[countryName];
              const point = projectPoint(geo);
              const score = getScore(countryName);
              const radius = Math.min(score * 20 + 2, 25);
              const isHovered = hoveredPoint === countryName;

              return (
                <g key={countryName} className="pointer-events-auto">
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    fill={moduleConfig.accent}
                    fillOpacity={isHovered ? 0.3 : 0.15}
                    stroke={moduleConfig.accent}
                    strokeWidth="1"
                    strokeOpacity="0.5"
                    onMouseEnter={() => setHoveredPoint(countryName)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    className="cursor-help transition-all duration-200"
                  />

                  {/* Label on Hover */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.g
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <rect
                          x={point.x - 60}
                          y={point.y - radius - 35}
                          width="120"
                          height="26"
                          rx="6"
                          fill="rgba(15, 23, 42, 0.95)"
                          stroke="rgba(255,255,255,0.1)"
                        />
                        <text
                          x={point.x}
                          y={point.y - radius - 18}
                          textAnchor="middle"
                          fill="white"
                          fontSize="10"
                          fontWeight="600"
                          className="select-none"
                        >
                          {countryName.split(",")[0]} —{" "}
                          {(score * 100).toFixed(0)}%
                        </text>
                      </motion.g>
                    )}
                  </AnimatePresence>
                </g>
              );
            })}
          </motion.svg>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(RelationsLayer);
