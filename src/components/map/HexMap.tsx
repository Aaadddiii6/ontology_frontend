import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { motion, AnimatePresence } from "framer-motion";
import { CountryProfile, ActiveModule, HoverPosition } from "../../types";
import {
  normalizeCountryName,
  getModuleColor,
  COLORS,
  getColorForScore,
} from "../../lib/countryData";

interface HexMapProps {
  profiles: CountryProfile[];
  profileMap: Map<string, CountryProfile>;
  activeModule: ActiveModule;
  onCountryHover: (name: string | null, position: HoverPosition | null) => void;
  onCountryClick: (name: string) => void;
  /** ISO numeric (zero-padded) -> fill colour; overrides the tab colouring */
  fillByIso?: Map<string, string>;
  /** ISO numeric -> graph country name (exact join, no name guessing) */
  isoToName?: Map<string, string>;
  focusCountry?: string | null;
  /** Reports pan/zoom so overlays (relation lines) can follow */
  onZoom?: (t: { k: number; x: number; y: number }) => void;
}

const HexMap: React.FC<HexMapProps> = ({
  profileMap,
  activeModule,
  onCountryHover,
  onCountryClick,
  fillByIso,
  isoToName,
  focusCountry,
  onZoom,
}) => {
  const zoomRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;

  const zoomButton = (factor: number | null) => {
    const container = containerRef.current;
    const zb = zoomBehaviorRef.current;
    if (!container || !zb) return;
    const svgSel = d3.select(container).select<SVGSVGElement>("svg");
    if (factor === null) svgSel.transition().duration(400).call(zb.transform, d3.zoomIdentity);
    else svgSel.transition().duration(300).call(zb.scaleBy, factor);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- topojson feature
  const nameOf = (d: any): string | null => {
    const iso = d?.id != null ? String(d.id).padStart(3, "0") : null;
    return (iso && isoToName?.get(iso)) || normalizeCountryName(d.properties.name);
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipName, setTooltipName] = useState<string | null>(null);

  const getOverviewColor = useCallback(
    (apiName: string | null) => {
      if (!apiName) return "#8ad0f0"; // Not in database/no name

      const profile = profileMap.get(apiName);
      if (!profile) return "#8ad0f0"; // Not in database

      if (profile.nuclear === "confirmed") return "#0f52ba";
      return "#6694f6"; // Default parchment tan
    },
    [profileMap],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let svg = d3.select(container).select<SVGSVGElement>("svg");
    if (svg.empty()) {
      svg = d3
        .select(container)
        .append("svg")
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .style("background", "transparent");
    }

    const projection = d3.geoNaturalEarth1();
    const pathGenerator = d3.geoPath().projection(projection);

    const render = () => {
      const { width, height } = container.getBoundingClientRect();
      svg.attr("viewBox", `0 0 ${width} ${height}`);

      projection.fitSize([width, height], { type: "Sphere" } as any);
      const [tx, ty] = projection.translate();
      projection.translate([tx, ty + 40]); // Increased push to match country centroids exactly

      svg.selectAll(".countries").remove();
      const mapGroup = svg.append("g").attr("class", "countries").attr("transform", zoomRef.current.toString());

      // Scroll / pinch / drag to zoom and pan (1x to 8x). The transform is
      // kept in a ref so a re-render (tab change, new colours) keeps the view.
      const zb = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", (ev) => {
          zoomRef.current = ev.transform;
          svg.select(".countries").attr("transform", ev.transform.toString());
          onZoomRef.current?.({ k: ev.transform.k, x: ev.transform.x, y: ev.transform.y });
        });
      zoomBehaviorRef.current = zb;
      svg.call(zb).on("dblclick.zoom", null);

      d3.json<any>("/data/countries-110m.json").then((worldData) => {
        if (!worldData) return;

        const countries = topojson.feature(
          worldData,
          worldData.objects.countries as any,
        );

        mapGroup
          .selectAll("path")
          .data((countries as any).features)
          .join("path")
          .attr("d", pathGenerator as any)
          .attr("fill", (d: any) => {
            const iso = d?.id != null ? String(d.id).padStart(3, "0") : null;
            if (fillByIso && fillByIso.size > 0) {
              return (iso && fillByIso.get(iso)) || "rgba(148,163,184,0.35)"; // no data = grey
            }
            const apiName = nameOf(d);
            if (activeModule === "overview") {
              return getOverviewColor(apiName);
            } else if (apiName) {
              const profile = profileMap.get(apiName);
              return getModuleColor(profile, activeModule);
            }
            return "#9ab8a0";
          })
          .attr("stroke", (d: any) =>
            focusCountry && nameOf(d) === focusCountry ? "#6366f1" : "rgba(255, 255, 255, 0.25)",
          )
          .attr("stroke-width", (d: any) => (focusCountry && nameOf(d) === focusCountry ? 2.2 : 0.6))
          .attr("vector-effect", "non-scaling-stroke")
          .style("cursor", "pointer")
          .style("transition", "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)")
          .on("mouseenter", function (event, d: any) {
            const apiName = nameOf(d);

            d3.select(this)
              .attr("stroke", "rgba(255, 255, 255, 0.9)")
              .attr("stroke-width", 1.2)
              .style("filter", "brightness(1.2)")
              .raise();

            setTooltipName(apiName || d.properties.name);
            if (tooltipRef.current) {
              tooltipRef.current.style.opacity = "1";
              tooltipRef.current.style.left = `${event.clientX}px`;
              tooltipRef.current.style.top = `${event.clientY - 40}px`;
            }

            onCountryHover(apiName, { x: event.clientX, y: event.clientY });
          })
          .on("mousemove", function (event) {
            if (tooltipRef.current) {
              tooltipRef.current.style.left = `${event.clientX}px`;
              tooltipRef.current.style.top = `${event.clientY - 40}px`;
            }
          })
          .on("mouseleave", function () {
            d3.select(this)
              .attr("stroke", "rgba(255, 255, 255, 0.15)")
              .attr("stroke-width", 0.5)
              .style("filter", "none");

            setTooltipName(null);
            if (tooltipRef.current) {
              tooltipRef.current.style.opacity = "0";
            }
            onCountryHover(null, null);
          })
          .on("click", (event, d: any) => {
            const apiName = nameOf(d);
            if (apiName) onCountryClick(apiName);
          });
      });
    };

    render();

    const resizeObserver = new ResizeObserver(() => {
      render();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      d3.select(container).select("svg").remove();
    };
  }, [
    activeModule,
    profileMap,
    getOverviewColor,
    onCountryClick,
    onCountryHover,
    fillByIso,
    isoToName,
    focusCountry,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-transparent"
    >
      <div className="absolute bottom-24 right-[84px] z-[60] flex flex-col gap-1">
        {([
          ["+", 1.6, "Zoom in"],
          ["−", 1 / 1.6, "Zoom out"],
          ["⟲", null, "Reset view"],
        ] as const).map(([label, f, title]) => (
          <button
            key={label}
            onClick={() => zoomButton(f)}
            title={title}
            className="w-9 h-9 rounded-lg glass-morphism bo-card bo-ink text-lg font-bold hover:bg-indigo-500/20"
          >
            {label}
          </button>
        ))}
      </div>
      {/* High-Fidelity Tooltip */}
      <AnimatePresence>
        {tooltipName && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed pointer-events-none z-[100] px-4 py-2 text-[13px] font-bold tracking-tight text-white bg-slate-900/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl flex items-center gap-2"
            style={{ transform: "translateX(-50%)" }}
          >
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            {tooltipName.toUpperCase()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(HexMap);
