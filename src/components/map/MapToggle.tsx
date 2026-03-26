import React from 'react';
import { LayoutGrid, Globe } from 'lucide-react';
import { MapMode } from '../../types';

interface MapToggleProps {
  mode: MapMode;
  onToggle: () => void;
  isTransitioning: boolean;
}

const MapToggle: React.FC<MapToggleProps> = ({ mode, onToggle, isTransitioning }) => {
  const isFlat = mode === 'flat';
  const isGlobe = mode === 'globe' || mode === 'globe-3d';

  const getButtonClasses = (isActive: boolean) => {
    return `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${isActive ? 'bg-slate-800 text-white' : 'bg-transparent text-gray-600'}`;
  };

  const modeText = {
    flat: 'Flat Map',
    globe: 'Globe',
    'globe-3d': '3D Globe',
    transitioning: 'Transitioning...',
  }[mode];

  return (
    <div
      className="absolute top-3 right-3 z-50 flex flex-col items-center transition-opacity"
      style={{ opacity: isTransitioning ? 0.7 : 1, cursor: isTransitioning ? 'wait' : 'default' }}
    >
      <div
        className="flex gap-0.5 p-1 rounded-full border"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          borderColor: 'rgba(0,0,0,0.12)',
        }}
      >
        <button onClick={onToggle} disabled={isTransitioning} className={getButtonClasses(isFlat)}>
          <LayoutGrid size={14} />
          <span>Flat</span>
        </button>
        <button onClick={onToggle} disabled={isTransitioning} className={getButtonClasses(isGlobe)}>
          <Globe size={14} />
          <span>Globe</span>
        </button>
      </div>
      <span className="mt-1 text-[10px] text-black/40 font-medium">{modeText}</span>
    </div>
  );
};

export default MapToggle;
