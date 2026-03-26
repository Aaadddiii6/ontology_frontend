import React from 'react';
import { motion } from 'framer-motion';
import { Crosshair, TrendingUp, Globe2, Thermometer } from 'lucide-react';
import { ActiveModule } from '../../types';
import { MODULE_CONFIGS } from '../../lib/api';

interface ModuleTabsProps {
  activeModule: ActiveModule;
  onModuleChange: (m: ActiveModule) => void;
}

const tabs: { key: ActiveModule; label: string; icon: React.ElementType }[] = [
  { key: 'defence', label: 'Defence', icon: Crosshair },
  { key: 'economy', label: 'Economy', icon: TrendingUp },
  { key: 'geopolitics', label: 'Geopolitics', icon: Globe2 },
  { key: 'climate', label: 'Climate', icon: Thermometer },
];

const ModuleTabs: React.FC<ModuleTabsProps> = ({ activeModule, onModuleChange }) => {
  if (activeModule === 'overview') return null;

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 25 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 p-1 rounded-full border"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        borderColor: 'rgba(0,0,0,0.1)',
      }}
    >
      {tabs.map(tab => {
        const isActive = activeModule === tab.key;
        const config = MODULE_CONFIGS[tab.key];
        return (
          <button
            key={tab.key}
            onClick={() => onModuleChange(tab.key)}
            className="flex items-center h-9 px-4 gap-1.5 rounded-full text-xs font-semibold transition-all duration-300 ease-in-out"
            style={{
              backgroundColor: isActive ? config.accent : 'transparent',
              color: isActive ? 'white' : '#666',
              transform: isActive ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            <tab.icon size={15} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </motion.div>
  );
};

export default ModuleTabs;
