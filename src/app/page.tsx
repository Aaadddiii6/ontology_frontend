"use client";
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
import ModuleTabs from "../components/layout/ModuleTabs";
import HexMap from "../components/map/HexMap";
import GlobeMap from "../components/map/GlobeMap";
import MapToggle from "../components/map/MapToggle";
import RelationsLayer from "../components/map/RelationsLayer";
import CountryHoverCard from "../components/map/CountryHoverCard";
import CountryDetailPanel from "../components/map/CountryDetailPanel";

import AccessibilityPanel from "../components/ui/AccessibilityPanel";
import DayNightBackground from "../components/ui/DayNightBackground";
import StatsOverlay from "../components/ui/StatsOverlay";
import useCountryData from "../hooks/useCountryData";
import { CountryProfile, ActiveModule, MapMode, HoverPosition } from "../types";
import { MODULE_CONFIGS } from "../lib/api";
import MapSkeleton from "../components/map/MapSkeleton";

import * as topojson from "topojson-client";
import { normalizeCountryName } from "../lib/countryData";

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
  const [globeRelations, setGlobeRelations] = useState<any[]>([]);
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
        (countries as any).features.forEach((f: any) => {
          const name = normalizeCountryName(f.properties.name);
          if (name) {
            const centroid = d3.geoCentroid(f);
            centroids.set(name, centroid);
          }
        });
        setCountryCentroids(centroids);
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

  useEffect(() => {
    import("../lib/api").then((api) => {
      const load = async () => {
        const moduleColor = MODULE_CONFIGS[activeModule]?.accent || "#4f46e5";

        if (activeModule === "overview") {
          const data = await api.fetchInfluenceNetwork();
          if (Array.isArray(data)) {
            setGlobeRelations(
              data.slice(0, 150).map((edge: any) => ({
                fromCountry: edge.influencer,
                toCountry: edge.influenced,
                weight: edge.influence_score || 0.5,
                moduleColor,
              })),
            );
          }
          return;
        }

        if (activeModule === "economy") {
          const data = await api.fetchEconomyTopTradePairs();
          if (Array.isArray(data)) {
            setGlobeRelations(
              data.slice(0, 150).map((edge: any) => ({
                fromCountry: edge.country_a || edge.country1,
                toCountry: edge.country_b || edge.country2,
                weight: edge.normalized_weight || edge.trade_volume_normalized || 0.5,
                moduleColor,
              })),
            );
          }
          return;
        }

        if (activeModule === "geopolitics") {
          const data = await api.fetchGeopoliticsNetwork();
          if (data && Array.isArray(data.edges)) {
            setGlobeRelations(
              data.edges.slice(0, 150).map((edge: any) => ({
                fromCountry: edge.from,
                toCountry: edge.to,
                weight: edge.weight || 0.5,
                moduleColor,
              })),
            );
          }
          return;
        }

        if (activeModule === "defence") {
          const data = await api.fetchInfluenceNetwork(); // Fallback to influence for now
          if (Array.isArray(data)) {
            setGlobeRelations(
              data.slice(0, 150).map((edge: any) => ({
                fromCountry: edge.influencer,
                toCountry: edge.influenced,
                weight: edge.influence_score || 0.5,
                moduleColor,
              })),
            );
          }
          return;
        }

        if (activeModule === "climate") {
          const data = await api.fetchClimateGlobalConflictRisk();
          if (data && Array.isArray(data)) {
            setGlobeRelations(
              data.slice(0, 150).map((edge: any) => ({
                fromCountry: edge.source_country || edge.from,
                toCountry: edge.at_risk_country || edge.to,
                weight: edge.conflict_score || edge.risk_score || 0.5,
                moduleColor,
              })),
            );
          }
          return;
        }

        setGlobeRelations([]);
      };

      load();
    });
  }, [activeModule]);

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
      if (profile) {
        setSelectedCountry(profile);
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
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto">
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
          <CountryHoverCard
            country={selectedCountry.country}
            profile={selectedCountry}
            activeModule={activeModule}
            onClose={() => setIsPanelOpen(false)}
            onOpenDetail={handleOpenDetail}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDetailOpen && selectedCountry && (
          <CountryDetailPanel
            country={selectedCountry.country}
            profile={selectedCountry}
            onClose={() => setIsDetailOpen(false)}
            activeModule={activeModule}
          />
        )}
      </AnimatePresence>

      <div
        className={`transition-opacity duration-300 ${activeModule === "overview" ? "opacity-60 grayscale-[0.3]" : "opacity-100"}`}
      >
        <ModuleTabs
          activeModule={activeModule}
          onModuleChange={setActiveModule}
        />
      </div>


      <AccessibilityPanel />

      <StatsOverlay
        activeModule={activeModule}
        profileMap={profileMap}
        isVisible={!isPanelOpen && !isDetailOpen}
      />
    </main>
  );
}
