import React from "react";
import { Search, Bell, Settings, Command } from "lucide-react";
import { motion } from "framer-motion";
import { MODULE_CONFIGS } from "../../lib/api";
import { ActiveModule } from "../../types";

interface NavbarProps {
  activeModule: ActiveModule;
  onModuleChange: (m: ActiveModule) => void;
}

const modules: ActiveModule[] = [
  "overview",
  "defence",
  "economy",
  "geopolitics",
  "climate",
];

const Navbar: React.FC<NavbarProps> = ({ activeModule, onModuleChange }) => {
  return (
    <nav className="fixed top-0 left-0 z-[100] flex items-center w-full h-[64px] px-6 gap-8 bg-slate-950/50 backdrop-blur-2xl border-b border-white/10 shadow-2xl">
      {/* Logo Section */}
      <div className="flex items-center gap-3 shrink-0 group cursor-pointer">
        <div className="relative w-10 h-10 flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-500 rounded-xl rotate-45 group-hover:rotate-90 transition-transform duration-500" />
          <div className="absolute inset-0 bg-indigo-400/50 rounded-xl rotate-12 blur-sm group-hover:rotate-45 transition-transform duration-500" />
          <Globe className="relative text-white z-10" size={20} />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-lg tracking-tighter text-white leading-none group-hover:text-indigo-400 transition-colors">
            ONTOLOGY
          </span>
          <span className="text-[10px] font-bold tracking-[0.2em] text-indigo-400 uppercase leading-none mt-1">
            BLUE-ORBIT
          </span>
        </div>
      </div>

      {/* Module Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
        {modules.map((module) => {
          const isActive = activeModule === module;
          const config = MODULE_CONFIGS[module];
          return (
            <button
              key={module}
              onClick={() => onModuleChange(module)}
              className={`relative px-5 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all duration-300 ${
                isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-indigo-500 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* Action Section */}
      <div className="flex items-center gap-6 ml-auto shrink-0">
        <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 group hover:border-white/20 transition-all cursor-pointer">
          <Command size={14} />
          <span className="text-xs font-medium">Search Intelligence...</span>
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-bold">
            <span className="opacity-50">⌘</span>K
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative p-2 text-slate-400 hover:text-white transition-colors cursor-pointer">
            <Bell size={20} />
            <div className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-950" />
          </div>
          <div className="w-10 h-10 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-sm hover:border-indigo-500 transition-all cursor-pointer">
            JD
          </div>
        </div>
      </div>
    </nav>
  );
};

import { Globe } from "lucide-react";
export default Navbar;
