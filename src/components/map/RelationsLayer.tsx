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
  /** ISO numeric (zero-padded) -> [lon, lat]; preferred over name lookup */
  isoCoords?: Map<string, [number, number]>;
  dimensions: { width: number; height: number };
  relations?: RelationEdge[];
  /** Pan/zoom of the flat map, so lines stay on their countries */
  zoom?: { k: number; x: number; y: number };
  /** 0..1 multiplier from the "Links opacity" slider */
  opacity?: number;
}

// Animating hundreds of SVG paths kills the frame rate; only the strongest
// links get the moving dash, the rest are static.
const ANIMATED_LINKS = 150;
const MAX_LINKS = 2500;

const RelationsLayer: React.FC<RelationsLayerProps> = ({
  activeModule,
  isVisible,
  countryCoords,
  isoCoords,
  dimensions,
  relations,
  zoom,
  opacity = 0.6,
}) => {
  const op = Math.max(0.1, Math.min(1, opacity)) / 0.6;
  const [hover, setHover] = useState<{ label: string; x: number; y: number; color: string } | null>(null);
  const moduleConfig = MODULE_CONFIGS[activeModule] || MODULE_CONFIGS.overview;

  // Projection must exactly match HexMap.tsx
  const projection = useMemo(() => {
    if (dimensions.width <= 0 || dimensions.height <= 0) return null;
    const proj = d3.geoNaturalEarth1();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- d3 accepts a Sphere object here
    proj.fitSize([dimensions.width, dimensions.height], { type: "Sphere" } as any);
    const [tx, ty] = proj.translate();
    proj.translate([tx, ty + 40]);
    return proj;
  }, [dimensions.width, dimensions.height]);

  const getCoords = (name: string, iso?: string | null): [number, number] | null => {
    if (iso && isoCoords?.has(iso)) return isoCoords.get(iso)!;
    if (countryCoords?.has(name)) return countryCoords.get(name)!;
    const norm = normalizeCountryName(name);
    if (norm && countryCoords?.has(norm)) return countryCoords.get(norm)!;
    if (COUNTRY_COORDS[name]) return COUNTRY_COORDS[name];
    if (norm && COUNTRY_COORDS[norm]) return COUNTRY_COORDS[norm];
    return null;
  };

  const paths = useMemo(() => {
    if (!projection || !relations?.length) return [];
    const ranked = [...relations].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, MAX_LINKS);
    const out: { d: string; w: number; color: string; label: string; animate: boolean; key: string }[] = [];
    ranked.forEach((rel, i) => {
      const sc = getCoords(rel.fromCountry, rel.fromIso);
      const ec = getCoords(rel.toCountry, rel.toIso);
      if (!sc || !ec) return;
      const s = projection(sc);
      const e = projection(ec);
      if (!s || !e) return;
      const dx = e[0] - s[0];
      const dy = e[1] - s[1];
      const dr = Math.sqrt(dx * dx + dy * dy);
      const cx = (s[0] + e[0]) / 2;
      const cy = (s[1] + e[1]) / 2 - dr * 0.18;
      out.push({
        d: `M ${s[0]} ${s[1]} Q ${cx} ${cy} ${e[0]} ${e[1]}`,
        w: Math.max(0.6, (rel.weight ?? 0.5) * 3),
        color: (rel.moduleColor ?? moduleConfig.accent).substring(0, 7),
        label: rel.label ?? `${rel.fromCountry} → ${rel.toCountry}`,
        animate: i < ANIMATED_LINKS,
        key: `${rel.layer ?? "x"}-${rel.fromCountry}-${rel.toCountry}-${i}`,
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relations, projection, countryCoords, isoCoords]);

  if (!projection || dimensions.width <= 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <style>{`@keyframes bo-flow { to { stroke-dashoffset: -40; } } .bo-flow { animation: bo-flow 2.4s linear infinite; }`}</style>
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
            <g transform={zoom ? `translate(${zoom.x},${zoom.y}) scale(${zoom.k})` : undefined}>
            {paths.map((p) => (
              <g key={p.key}>
                <path d={p.d} fill="none" vectorEffect="non-scaling-stroke" stroke={p.color} strokeWidth={p.w} strokeOpacity={Math.min(1, (p.animate ? 0.3 : 0.18) * op)} />
                {p.animate && (
                  <path
                    d={p.d}
                    fill="none"
                    stroke={p.color}
                    strokeWidth={p.w}
                    strokeOpacity={Math.min(1, 0.75 * op)}
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray="6 14"
                    className="bo-flow"
                  />
                )}
                {/* wide invisible hit area so thin lines are hoverable */}
                <path
                  d={p.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(6, p.w + 4)}
                  className="pointer-events-auto"
                  style={{ cursor: "help" }}
                  onMouseMove={(ev) => setHover({ label: p.label, x: ev.clientX, y: ev.clientY, color: p.color })}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            ))}
            </g>
          </motion.svg>
        )}
      </AnimatePresence>
      {hover && (
        <div
          className="fixed z-[200] pointer-events-none max-w-[320px] px-3 py-2 rounded-lg text-[12px] font-medium text-white bg-slate-900/95 border border-white/15 shadow-xl"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: hover.color }} />
          {hover.label}
        </div>
      )}
    </div>
  );
};

export default React.memo(RelationsLayer);
