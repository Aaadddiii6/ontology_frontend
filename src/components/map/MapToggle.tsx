import React from "react";
import { LayoutGrid, Globe, Box } from "lucide-react";
import { motion } from "framer-motion";
import { MapMode } from "../../types";

interface MapToggleProps {
  mode: MapMode;
  onToggle: () => void;
  isTransitioning: boolean;
}

const MapToggle: React.FC<MapToggleProps> = ({
  mode,
  onToggle,
  isTransitioning,
}) => {
  const isFlat = mode === "flat";
  const isGlobe = mode === "globe";

  return (
    <div className="fixed top-[88px] right-8 z-[100]">
      <div className="relative flex p-1.5 bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Animated Background Highlight */}
        <motion.div
          animate={{ x: isFlat ? 0 : 88 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          className="absolute inset-y-1.5 left-1.5 w-[88px] bg-indigo-500 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)]"
        />

        <motion.button
          onClick={() => !isFlat && onToggle()}
          disabled={isTransitioning}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative z-10 flex items-center justify-center gap-2.5 w-[88px] py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-colors duration-300 ${
            isFlat ? "text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <LayoutGrid size={14} className={isFlat ? "animate-pulse" : ""} />
          <span>Flat</span>
        </motion.button>

        <motion.button
          onClick={() => !isGlobe && onToggle()}
          disabled={isTransitioning}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative z-10 flex items-center justify-center gap-2.5 w-[88px] py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-colors duration-300 ${
            isGlobe ? "text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Globe size={14} className={isGlobe ? "animate-spin-slow" : ""} />
          <span>Globe</span>
        </motion.button>
      </div>
      
      {/* Decorative Status Line */}
      <div className="mt-3 flex items-center justify-end gap-3 px-2">
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-black text-indigo-400/60 uppercase tracking-[0.2em] leading-none">
            Projection
          </span>
          <span className="text-[11px] font-bold text-white uppercase tracking-wider mt-1">
            {isFlat ? "Natural Earth I" : "Geocentric Spherical"}
          </span>
        </div>
        <div className="w-[2px] h-6 bg-indigo-500/30 rounded-full" />
      </div>
    </div>
  );
};

export default MapToggle;
