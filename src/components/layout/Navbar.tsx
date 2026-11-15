"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Bell, Sun, Moon, Home, Shield, BarChart3, Layers, Leaf, Globe2 } from "lucide-react";
import { ActiveModule } from "../../types";

interface NavbarProps {
  activeModule: ActiveModule;
  onModuleChange: (m: ActiveModule) => void;
}

const MODULES: { key: ActiveModule; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: "overview", label: "Overview", Icon: Home },
  { key: "defence", label: "Defence", Icon: Shield },
  { key: "economy", label: "Economy", Icon: BarChart3 },
  { key: "geopolitics", label: "Geopolitics", Icon: Layers },
  { key: "climate", label: "Climate Risk", Icon: Leaf },
];

const Navbar: React.FC<NavbarProps> = ({ activeModule, onModuleChange }) => {
  const [isDay, setIsDay] = useState(false);
  useEffect(() => {
    const sync = () => setIsDay(document.body.classList.contains("day-mode"));
    sync();
    window.addEventListener("dayNightChanged", sync);
    return () => window.removeEventListener("dayNightChanged", sync);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 z-[100] flex items-center w-full h-[64px] px-5 gap-6 border-b bo-divider"
      style={{ background: "var(--bo-surface-strong)", backdropFilter: "blur(18px)" }}
    >
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3 shrink-0">
        <span className="w-10 h-10 rounded-full bo-bg-accent flex items-center justify-center shadow-[0_0_18px_rgba(47,124,246,0.45)]">
          <Globe2 size={20} />
        </span>
        <span className="flex flex-col leading-none">
          <span className="font-black text-[17px] tracking-tight bo-t1">ONTOLOGY</span>
          <span className="text-[10px] font-bold tracking-[0.28em] bo-accent mt-1">BLUE-ORBIT</span>
        </span>
        <span className="hidden xl:block h-8 w-px mx-2" style={{ background: "var(--bo-border)" }} />
        <span className="hidden xl:flex flex-col text-[11px] leading-tight bo-t3">
          <span>Global Geopolitical</span>
          <span>Intelligence Platform</span>
        </span>
      </Link>

      {/* Modules */}
      <div className="flex items-center gap-2 mx-auto">
        {MODULES.map(({ key, label, Icon }) => {
          const active = activeModule === key;
          return (
            <button
              key={key}
              onClick={() => onModuleChange(key)}
              className={`flex items-center gap-2 px-4 h-10 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all ${
                active ? "bo-bg-accent shadow-[0_6px_20px_rgba(47,124,246,0.35)]" : "bo-chip bo-t2 hover:bo-t1"
              }`}
              aria-pressed={active}
            >
              <Icon size={15} />
              <span className="hidden xl:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("openIntelligenceSearch"))}
          className="hidden lg:flex items-center gap-2 h-10 px-4 rounded-full bo-chip bo-t3 text-[12px] w-[290px]"
        >
          <Search size={15} />
          <span className="truncate">Search countries, events, relationships…</span>
          <span className="ml-auto text-[10px] font-bold opacity-70 whitespace-nowrap">Ctrl K</span>
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event("toggleDayNight"))}
          className="w-10 h-10 rounded-full bo-chip bo-t2 flex items-center justify-center"
          aria-label={isDay ? "Switch to night mode" : "Switch to day mode"}
          title={isDay ? "Night mode" : "Day mode"}
        >
          {isDay ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button className="relative w-10 h-10 rounded-full bo-chip bo-t2 flex items-center justify-center" aria-label="Notifications">
          <Bell size={17} />
          <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-rose-500" />
        </button>
        <span className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[13px] bo-t1" style={{ background: "var(--bo-accent-soft)" }}>
          AB
        </span>
      </div>
    </nav>
  );
};

export default Navbar;
