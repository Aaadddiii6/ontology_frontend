import React, { useState, useMemo } from "react";
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

const RelationsLayer: React.FC<RelationsLayerProps> = ({
  activeModule,
  profileMap,
  isVisible,
  countryCoords,
  dimensions,
  relations,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const moduleConfig = MODULE_CONFIGS[activeModule] || MODULE_CONFIGS.overview;

  // ── Projection — must exactly match HexMap.tsx ──────────────
  const projection = useMemo(() => {
    if (dimensions.width <= 0 || dimensions.height <= 0) return null;
    const proj = d3.geoNaturalEarth1();
    proj.fitSize([dimensions.width, dimensions.height], {
      type: "Sphere",
    } as any);
    const [tx, ty] = proj.translate();
    proj.translate([tx, ty + 40]); // ← same +40 offset as HexMap
    return proj;
  }, [dimensions.width, dimensions.height]);

  // ── Coordinate lookup (prioritise centroid map, fall back to static) ──
  const getCoords = (name: string): [number, number] | null => {
    if (countryCoords?.has(name)) return countryCoords.get(name)!;
    const norm = normalizeCountryName(name);
    if (norm && countryCoords?.has(norm)) return countryCoords.get(norm)!;
    if (COUNTRY_COORDS[name]) return COUNTRY_COORDS[name];
    if (norm && COUNTRY_COORDS[norm]) return COUNTRY_COORDS[norm];
    return null;
  };

  // ── Project a lon/lat to SVG pixel ─────────────────────────
  const project = (geo: [number, number]) => {
    if (!projection) return { x: 0, y: 0 };
    const pt = projection(geo);
    return pt ? { x: pt[0], y: pt[1] } : { x: 0, y: 0 };
  };

  // ── Resolve relations to render ────────────────────────────
  const renderedRelations = useMemo(() => {
    if (!relations || relations.length === 0) return [];
    return relations
      .slice(0, 120)
      .map((rel) => {
        const sc = getCoords(rel.fromCountry);
        const ec = getCoords(rel.toCountry);
        if (!sc || !ec) return null;
        return { ...rel, sc, ec };
      })
      .filter(Boolean) as (RelationEdge & {
      sc: [number, number];
      ec: [number, number];
    })[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relations, countryCoords, dimensions]);

  // ── Countries to show dots for ─────────────────────────────
  const countryDots = useMemo(() => {
    const dots: { name: string; geo: [number, number]; score: number }[] = [];
    // Use the centroid map if available (most accurate), else static
    const source:
      | Map<string, [number, number]>
      | Record<string, [number, number]> =
      countryCoords && countryCoords.size > 0 ? countryCoords : COUNTRY_COORDS;

    const entries =
      source instanceof Map ? [...source.entries()] : Object.entries(source);

    entries.forEach(([name, geo]) => {
      const profile = profileMap.get(name);
      const score = (() => {
        if (!profile) return 0.3;
        switch (activeModule) {
          case "defence":
            return profile.military_strength ?? 0.3;
          case "economy":
            // Normalize defense_spending (in millions USD) to a 0-1 score
            const spendingScore = (profile.defense_spending || 0) / 1000000;
            return Math.min(
              1,
              (profile.arms_export ?? 0) * 0.5 + spendingScore * 0.5,
            );
          case "geopolitics":
            return profile.diplomatic_centrality ?? 0.3;
          case "climate":
            return (
              (profile.live_risk ?? 0) * 0.7 +
              (profile.conflict_risk ?? 0) * 0.3
            );
          default:
            return profile.defense_composite ?? 0.3;
        }
      })();
      dots.push({ name, geo: geo as [number, number], score });
    });
    return dots;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileMap, activeModule, countryCoords, dimensions]);

  if (!projection || dimensions.width <= 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {isVisible && (
          <motion.svg
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 w-full h-full z-[50]"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="none"
          >
            <defs>
              <filter
                id="arc-glow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter
                id="dot-glow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* ── Relation arcs ── */}
            {renderedRelations.map((rel, i) => {
              const s = project(rel.sc);
              const e = project(rel.ec);
              if (s.x === 0 && s.y === 0) return null;
              if (e.x === 0 && e.y === 0) return null;

              const dx = e.x - s.x;
              const dy = e.y - s.y;
              const dr = Math.sqrt(dx * dx + dy * dy);
              const cx = (s.x + e.x) / 2;
              const cy = (s.y + e.y) / 2 - dr * 0.18;
              const path = `M ${s.x} ${s.y} Q ${cx} ${cy} ${e.x} ${e.y}`;
              const w = Math.max(0.5, (rel.weight ?? 0.5) * 2.5);

              // Use light green for economy lines to make them visible
              const col =
                activeModule === "economy"
                  ? "#a7f3d0"
                  : (rel.moduleColor ?? moduleConfig.accent);

              return (
                <g key={i}>
                  {/* Glow halo */}
                  <path
                    d={path}
                    fill="none"
                    stroke={col}
                    strokeWidth={w + 2}
                    strokeOpacity={0.08}
                    filter="url(#arc-glow)"
                  />
                  {/* Base line */}
                  <path
                    d={path}
                    fill="none"
                    stroke={col}
                    strokeWidth={w}
                    strokeOpacity={0.25}
                  />
                  {/* Animated dash */}
                  <motion.path
                    d={path}
                    fill="none"
                    stroke={col}
                    strokeWidth={w}
                    strokeOpacity={0.6}
                    strokeDasharray="6 14"
                    animate={{ strokeDashoffset: [0, -40] }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                </g>
              );
            })}

            {/* ── Country dots ── */}
            {countryDots.map(({ name, geo, score }) => {
              const p = project(geo);
              if (p.x === 0 && p.y === 0) return null;
              const r = Math.max(2.5, Math.min(score * 18 + 2, 20));
              const isHov = hoveredPoint === name;

              return (
                <g
                  key={name}
                  className="pointer-events-auto"
                  style={{ cursor: "help" }}
                  onMouseEnter={() => setHoveredPoint(name)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {/* Pulse ring */}
                  {isHov && (
                    <motion.circle
                      cx={p.x}
                      cy={p.y}
                      r={r + 6}
                      fill="none"
                      stroke={moduleConfig.accent}
                      strokeWidth={1}
                      strokeOpacity={0.5}
                      animate={{ r: [r + 4, r + 10], opacity: [0.6, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={moduleConfig.accent}
                    fillOpacity={isHov ? 0.35 : 0.18}
                    stroke={moduleConfig.accent}
                    strokeWidth={isHov ? 1.5 : 0.8}
                    strokeOpacity={0.7}
                    filter={isHov ? "url(#dot-glow)" : undefined}
                  />
                  {/* Hover label */}
                  {isHov && (
                    <g>
                      <rect
                        x={p.x - 55}
                        y={p.y - r - 34}
                        width={110}
                        height={26}
                        rx={6}
                        fill="rgba(15,23,42,0.95)"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth={0.5}
                      />
                      <text
                        x={p.x}
                        y={p.y - r - 17}
                        textAnchor="middle"
                        fill="white"
                        fontSize={9}
                        fontWeight="700"
                        fontFamily="monospace"
                        className="select-none uppercase"
                      >
                        {name.split(",")[0].substring(0, 20)} —{" "}
                        {(score * 100).toFixed(0)}%
                      </text>
                    </g>
                  )}
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
