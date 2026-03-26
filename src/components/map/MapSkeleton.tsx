import React from 'react';

const MapSkeleton: React.FC = () => (
  <div className="w-full h-full flex items-center justify-center bg-slate-950">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-6 shadow-[0_0_30px_rgba(99,102,241,0.3)]"></div>
      <p className="text-xs font-black tracking-[0.3em] uppercase text-indigo-300 animate-pulse">
        Rendering Geospatial Layer
      </p>
    </div>
  </div>
);

export default MapSkeleton;
