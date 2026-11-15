import React from "react";
import { Map as MapIcon, Globe2 } from "lucide-react";
import { MapMode } from "../../types";

interface MapToggleProps {
  mode: MapMode;
  onToggle: () => void;
  isTransitioning: boolean;
}

/** 2D map / 3D globe switch, top-left of the map (matches the mockups). */
const MapToggle: React.FC<MapToggleProps> = ({ mode, onToggle, isTransitioning }) => {
  const isFlat = mode === "flat";
  const options = [
    { flat: true, label: "2D Map", Icon: MapIcon },
    { flat: false, label: "3D Globe", Icon: Globe2 },
  ];
  return (
    <div className="fixed top-[172px] left-[96px] z-[100] bo-panel rounded-full p-1 flex gap-1">
      {options.map(({ flat, label, Icon }) => {
        const active = flat === isFlat;
        return (
          <button
            key={label}
            onClick={() => !active && onToggle()}
            disabled={isTransitioning}
            className={`flex items-center gap-2 px-4 h-9 rounded-full text-[13px] font-semibold transition-colors ${
              active ? "bo-bg-accent shadow-[0_4px_14px_rgba(47,124,246,0.35)]" : "bo-t2 hover:bg-[var(--bo-chip)]"
            }`}
            aria-pressed={active}
          >
            <Icon size={15} /> {label}
          </button>
        );
      })}
    </div>
  );
};

export default MapToggle;
