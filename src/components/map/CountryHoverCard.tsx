import React from 'react';
import { motion } from 'framer-motion';
import { CountryProfile, ActiveModule } from '../../types';
import { MODULE_CONFIGS } from '../../lib/api';

interface CountryHoverCardProps {
  country: string;
  profile: CountryProfile | null;
  position: { x: number; y: number };
  activeModule: ActiveModule;
}

const ScoreBar: React.FC<{ label: string; score: number | undefined }> = ({ label, score = 0 }) => {
  const getColor = (s: number) => {
    if (s > 0.4) return '#e05555';
    if (s > 0.2) return '#f0a843';
    return '#6cc49a';
  };

  return (
    <div className="grid items-center grid-cols-[1fr,auto] gap-x-2 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-700">{score.toFixed(2)}</span>
      <div className="w-full h-1 mt-1 col-span-2 bg-gray-200 rounded-full">
        <div
          className="h-1 rounded-full"
          style={{ width: `${score * 100}%`, backgroundColor: getColor(score) }}
        />
      </div>
    </div>
  );
};

const CountryHoverCard: React.FC<CountryHoverCardProps> = ({ country, profile, position, activeModule }) => {
  const moduleConfig = MODULE_CONFIGS[activeModule] || MODULE_CONFIGS.overview;

  if (!profile) {
    return null; // Or a loading/error state
  }

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x + 16,
    top: position.y - 140,
    width: 220,
    background: 'white',
    borderRadius: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
    padding: '14px 16px',
    zIndex: 200,
    pointerEvents: 'none',
  };

  const regionPillStyle: React.CSSProperties = {
    backgroundColor: `${moduleConfig.accent}26`, // 15% opacity
    color: moduleConfig.accent,
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 99,
    fontWeight: 500,
  };

  return (
    <motion.div
      style={cardStyle}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.12 }}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-base font-semibold text-gray-800">{country}</h3>
        {profile.region && <span style={regionPillStyle}>{profile.region}</span>}
      </div>

      {profile.alliances && profile.alliances.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {profile.alliances.slice(0, 3).map(alliance => (
            <span key={alliance} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {alliance}
            </span>
          ))}
        </div>
      )}

      <hr className="border-t border-gray-200 my-2" />

      <div className="space-y-3">
        <ScoreBar label="Military Strength" score={profile.military_strength} />
        <ScoreBar label="Conflict Risk" score={profile.conflict_risk} />
        <ScoreBar label="Defense Composite" score={profile.defense_composite} />
      </div>

      {profile.nuclear && (
        <div
          className={`mt-3 px-2 py-1 text-xs font-medium text-center rounded ${
            profile.nuclear === 'confirmed'
              ? 'bg-red-100 text-red-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {profile.nuclear === 'confirmed' ? 'Nuclear Confirmed' : 'Nuclear Undeclared'}
        </div>
      )}

      <div className="mt-3 text-xs font-medium text-right" style={{ color: moduleConfig.accent }}>
        View full profile →
      </div>
    </motion.div>
  );
};

export default CountryHoverCard;
