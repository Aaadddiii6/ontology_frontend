"use client";
import DataStatusPanel from "@/components/ui/DataStatusPanel";
import React, {
  useState,
  useCallback,
  useEffect,
  Suspense,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as d3 from "d3";
import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import HexMap from "../components/map/HexMap";
import GlobeMap from "../components/map/GlobeMap";
import MapToggle from "../components/map/MapToggle";
import RelationsLayer from "../components/map/RelationsLayer";
import CountryPanel from "@/components/map/CountryPanel";

import AccessibilityPanel from "../components/ui/AccessibilityPanel";
import DayNightBackground from "../components/ui/DayNightBackground";
import StatsOverlay from "../components/ui/StatsOverlay";
import useCountryData from "../hooks/useCountryData";
import { CountryProfile, ActiveModule, MapMode, HoverPosition } from "../types";
import { MODULE_CONFIGS } from "../lib/api";
import MapSkeleton from "../components/map/MapSkeleton";

import * as topojson from "topojson-client";
import { normalizeCountryName } from "../lib/countryData";
import { HARDCODED_RELATIONS, RelationDomain } from "../lib/hardcodedRelations";
import MapControls from "@/components/map/MapControls";
import { useMapLayers, DEFAULT_LAYERS } from "@/hooks/useMapLayers";

export default function Home() {
  const [activeModule, setActiveModule] = useState<ActiveModule>("overview");
  const [mapMode, setMapMode] = useState<MapMode>("flat");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<HoverPosition | null>(
    null,
  );
  const [selectedCountry, setSelectedCountry] = useState<CountryProfile | null>(
    null,
  );
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRelationsVisible, setIsRelationsVisible] = useState(true);
  const [activeLayers, setActiveLayers] = useState<string[]>(DEFAULT_LAYERS.overview);
  const [lineLimit, setLineLimit] = useState(150);
  const [colorMetric, setColorMetric] = useState<string | null>(null);
  const [focusCountry, setFocusCountry] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState<{ k: number; x: number; y: number }>({ k: 1, x: 0, y: 0 });
  const [isoCentroids, setIsoCentroids] = useState<Map<string, [number, number]>>(new Map());
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [countryCentroids, setCountryCentroids] = useState<
    Map<string, [number, number]>
  >(new Map());

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { profiles, profileMap, loading, getCountry } = useCountryData();

  useEffect(() => {
    // Load topojson once to get all centroids for relations
    fetch("/data/countries-110m.json")
      .then((res) => res.json())
      .then((worldData) => {
        const countries = topojson.feature(
          worldData,
          worldData.objects.countries as any,
        );
        const centroids = new Map<string, [number, number]>();
        const byIso = new Map<string, [number, number]>();
        (countries as any).features.forEach((f: any) => {
          if (f.id != null) byIso.set(String(f.id).padStart(3, "0"), d3.geoCentroid(f));
          const name = normalizeCountryName(f.properties.name);
          if (name) {
            const centroid = d3.geoCentroid(f);
            centroids.set(name, centroid);
          }
        });
        setCountryCentroids(centroids);
        setIsoCentroids(byIso);
      });
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Map lines + choropleth straight from the graph (/graph/relations, /graph/metric).
  const { layers, metrics, isoToName, edges, loadingEdges, fillByIso, legend } = useMapLayers({
    activeLayers,
    limit: lineLimit,
    focusCountry,
    colorMetric,
  });

  // Each tab opens with its own default layers; users can add any others.
  useEffect(() => {
    setActiveLayers(DEFAULT_LAYERS[activeModule] ?? []);
  }, [activeModule]);

  // Backend offline / no layers: fall back to the generated snapshot of graph edges.
  const globeRelations = React.useMemo(() => {
    if (edges.length || layers.length) return edges;
    const domain = activeModule as RelationDomain;
    const color = MODULE_CONFIGS[activeModule]?.accent || "#4f46e5";
    return (HARDCODED_RELATIONS[domain] ?? []).map((r) => ({
      fromCountry: r.fromCountry,
      toCountry: r.toCountry,
      weight: r.weight,
      moduleColor: color,
    }));
  }, [edges, layers.length, activeModule]);

  const toggleLayer = useCallback((key: string) => {
    setActiveLayers((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const handleToggleMode = useCallback(() => {
    if (isTransitioning) return;
    setMapMode((prev) => (prev === "flat" ? "globe" : "flat"));
  }, [isTransitioning]);

  const handleCountryHover = useCallback(
    (name: string | null, pos: HoverPosition | null) => {
      setHoveredCountry(name);
      setHoverPosition(pos);
    },
    [],
  );

  const handleCountryClick = useCallback(
    (name: string) => {
      const profile = getCountry(name);
      setFocusCountry(name);
      {
        setSelectedCountry(profile ?? { country: name });
        setIsPanelOpen(true);
        setIsDetailOpen(false);
      }
    },
    [getCountry],
  );

  const handleOpenDetail = useCallback(() => {
    setIsDetailOpen(true);
    setIsPanelOpen(false);
  }, []);

  // Removed: document.body.style.backgroundColor handled by DayNightBackground
  // useEffect(() => {
  //   document.body.style.backgroundColor = MODULE_CONFIGS[activeModule]?.bgTint || '#ffffff';
  // }, [activeModule]);

  const hoveredProfile = hoveredCountry ? getCountry(hoveredCountry) : null;

  return (
    <main className="relative w-full h-screen overflow-hidden transition-colors duration-300">
      <DayNightBackground />
      <Navbar activeModule={activeModule} onModuleChange={setActiveModule} />
      <Sidebar activeModule={activeModule} />

      {/* Unified Relations Toggle */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-100 pointer-events-auto">
        <motion.button
          onClick={() => setIsRelationsVisible(!isRelationsVisible)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all duration-300 shadow-2xl backdrop-blur-xl ${
            isRelationsVisible
              ? "bg-indigo-500/20 border-indigo-500/50 text-white"
              : "bg-slate-900/40 border-white/10 text-slate-400"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${isRelationsVisible ? "bg-indigo-400 animate-pulse" : "bg-slate-600"}`}
          />
          <span className="text-[11px] font-bold tracking-wider uppercase">
            Relations {isRelationsVisible ? "Online" : "Offline"}
          </span>
        </motion.button>
      </div>

      <section
        ref={mapContainerRef}
        className="absolute top-0 left-0 w-full h-full pt-[64px] pl-[72px]"
      >
        <Suspense fallback={<MapSkeleton />}>
          <div className="relative w-full h-full">
            {/* HexMap always mounted for smooth transition, opacity/pointerEvents control toggle */}
            <motion.div
              style={{
                opacity: mapMode === "flat" ? 1 : 0,
                pointerEvents: mapMode === "flat" ? "auto" : "none",
              }}
              className="absolute inset-0 w-full h-full"
            >
              <HexMap
                profiles={profiles}
                profileMap={profileMap}
                activeModule={activeModule}
                onCountryHover={handleCountryHover}
                onCountryClick={handleCountryClick}
                fillByIso={fillByIso}
                isoToName={isoToName}
                focusCountry={focusCountry}
                onZoom={setMapZoom}
              />
              {/* RelationsLayer as sibling to HexMap */}
              <RelationsLayer
                activeModule={activeModule}
                profileMap={profileMap}
                isVisible={isRelationsVisible}
                onToggle={() => setIsRelationsVisible(!isRelationsVisible)}
                dimensions={dimensions}
                relations={globeRelations}
                countryCoords={countryCentroids}
                isoCoords={isoCentroids}
                zoom={mapZoom}
              />
            </motion.div>

            {/* GlobeMap always mounted */}
            <motion.div
              style={{
                opacity: mapMode !== "flat" ? 1 : 0,
                pointerEvents: mapMode !== "flat" ? "auto" : "none",
              }}
              className="absolute inset-0 w-full h-full"
            >
              <GlobeMap
                profileMap={profileMap}
                activeModule={activeModule}
                onCountryHover={(name) => handleCountryHover(name, null)}
                onCountryClick={handleCountryClick}
                showRelations={isRelationsVisible}
                relations={globeRelations}
                visible={mapMode !== "flat"}
                countryCoords={countryCentroids}
                isoCoords={isoCentroids}
                isoToName={isoToName}
                fillByIso={fillByIso}
              />
            </motion.div>
          </div>
        </Suspense>
      </section>

      <MapToggle
        mode={mapMode}
        onToggle={handleToggleMode}
        isTransitioning={isTransitioning}
      />

      <AnimatePresence>
        {isPanelOpen && selectedCountry && (
          <CountryPanel
            key={selectedCountry.country}
            country={selectedCountry.country}
            activeModule={activeModule}
            onClose={() => setIsPanelOpen(false)}
          />
        )}
      </AnimatePresence>

      <MapControls
        layers={layers}
        activeLayers={activeLayers}
        onToggleLayer={toggleLayer}
        limit={lineLimit}
        onLimit={setLineLimit}
        metrics={metrics}
        colorMetric={colorMetric}
        onColorMetric={setColorMetric}
        legend={legend}
        focusCountry={focusCountry}
        onClearFocus={() => setFocusCountry(null)}
        edgeCount={globeRelations.length}
        loading={loadingEdges}
      />

      <AccessibilityPanel />
      <DataStatusPanel />

      <StatsOverlay
        activeModule={activeModule}
        profileMap={profileMap}
        isVisible={!isPanelOpen && !isDetailOpen}
      />
    </main>
  );
}
