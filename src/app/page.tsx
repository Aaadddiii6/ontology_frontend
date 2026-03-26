'use client'
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { gsap } from 'gsap'
import Navbar from '../components/layout/Navbar'
import Sidebar from '../components/layout/Sidebar'
import ModuleTabs from '../components/layout/ModuleTabs'
import HexMap from '../components/map/HexMap'
import GlobeMap from '../components/map/GlobeMap'
import MapToggle from '../components/map/MapToggle'
import CountryHoverCard from '../components/map/CountryHoverCard'
import CountryDetailPanel from '../components/map/CountryDetailPanel'
import ChatbotButton from '../components/ui/ChatbotButton'
import AccessibilityPanel from '../components/ui/AccessibilityPanel'
import useCountryData from '../hooks/useCountryData'
import { CountryProfile, ActiveModule, MapMode, HoverPosition } from '../types'
import { MODULE_CONFIGS } from '../lib/api'

const LoadingSkeleton: React.FC = () => (
  <div className="w-full h-full flex items-center justify-center bg-gray-100">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-500 rounded-full animate-spin mx-auto"></div>
      <p className="mt-4 text-sm font-medium text-gray-500">Loading intelligence data...</p>
    </div>
  </div>
);

export default function Home() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('overview');
  const [mapMode, setMapMode] = useState<MapMode>('flat');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<HoverPosition | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryProfile | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const flatMapRef = useRef<HTMLDivElement>(null);
  const globeMapRef = useRef<HTMLDivElement>(null);

  const { profiles, profileMap, loading, getCountry } = useCountryData();

  const handleToggleMode = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    const duration = 0.4;
    if (mapMode === 'flat') {
      gsap.to(flatMapRef.current, { opacity: 0, scale: 0.96, duration: duration / 2, ease: 'power2.in' });
      gsap.to(globeMapRef.current, {
        opacity: 1, scale: 1, duration: duration / 2, ease: 'power2.out', delay: duration / 2.5,
        onComplete: () => { setMapMode('globe'); setIsTransitioning(false); }
      });
    } else {
      gsap.to(globeMapRef.current, { opacity: 0, scale: 0.96, duration: duration / 2, ease: 'power2.in' });
      gsap.to(flatMapRef.current, {
        opacity: 1, scale: 1, duration: duration / 2, ease: 'power2.out', delay: duration / 2.5,
        onComplete: () => { setMapMode('flat'); setIsTransitioning(false); }
      });
    }
  }, [mapMode, isTransitioning]);

  const handleCountryHover = useCallback((name: string | null, pos: HoverPosition | null) => {
    setHoveredCountry(name);
    setHoverPosition(pos);
  }, []);

  const handleCountryClick = useCallback((name: string) => {
    const profile = getCountry(name);
    if (profile) {
      setSelectedCountry(profile);
      setIsPanelOpen(true);
    }
  }, [getCountry]);

  useEffect(() => {
    document.body.style.backgroundColor = MODULE_CONFIGS[activeModule]?.bgTint || '#ffffff';
  }, [activeModule]);

  const hoveredProfile = hoveredCountry ? getCountry(hoveredCountry) : null;

  return (
    <main className="w-full h-screen overflow-hidden transition-colors duration-300">
      <Navbar activeModule={activeModule} onModuleChange={setActiveModule} />
      <Sidebar activeModule={activeModule} />

      <section className="absolute top-0 left-0 w-full h-full pt-[52px] pl-[52px]">
        <div ref={flatMapRef} className="w-full h-full" style={{ opacity: mapMode === 'flat' ? 1 : 0 }}>
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <HexMap
              profiles={profiles}
              profileMap={profileMap}
              activeModule={activeModule}
              onCountryHover={handleCountryHover}
              onCountryClick={handleCountryClick}
            />
          )}
        </div>

        <div ref={globeMapRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ opacity: mapMode !== 'flat' ? 1 : 0, scale: mapMode === 'flat' ? 0.96 : 1 }}>
            <GlobeMap
                profileMap={profileMap}
                activeModule={activeModule}
                onCountryHover={(name) => handleCountryHover(name, null)}
                onCountryClick={handleCountryClick}
                visible={mapMode !== 'flat'}
            />
        </div>

        <MapToggle mode={mapMode} onToggle={handleToggleMode} isTransitioning={isTransitioning} />
      </section>

      <AnimatePresence>
        {hoveredCountry && hoverPosition && !isPanelOpen && hoveredProfile && (
          <CountryHoverCard
            country={hoveredCountry}
            profile={hoveredProfile}
            position={hoverPosition}
            activeModule={activeModule}
          />
        )}
      </AnimatePresence>

      <CountryDetailPanel
        country={selectedCountry?.country || null}
        profile={selectedCountry}
        onClose={() => setIsPanelOpen(false)}
        activeModule={activeModule}
      />

      <ModuleTabs activeModule={activeModule} onModuleChange={setActiveModule} />
      <ChatbotButton activeModule={activeModule} selectedCountry={selectedCountry} />
      <AccessibilityPanel />
    </main>
  );
}
