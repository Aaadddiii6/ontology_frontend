import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, TrendingUp, Globe2, Thermometer, LayoutGrid } from 'lucide-react';
import { ActiveModule } from '../../types';
import { MODULE_CONFIGS } from '../../lib/api';

interface ModuleTabsProps {
  activeModule: ActiveModule;
  onModuleChange: (m: ActiveModule) => void;
}

const tabs: { key: ActiveModule; label: string; icon: any }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'defence', label: 'Defence', icon: Shield },
  { key: 'economy', label: 'Economy', icon: TrendingUp },
  { key: 'geopolitics', label: 'Geopolitics', icon: Globe2 },
  { key: 'climate', label: 'Climate', icon: Thermometer },
];

const ModuleTabs: React.FC<ModuleTabsProps> = ({ activeModule, onModuleChange }) => {
  return (
    <motion.div
      initial={{ y: 100, x: '-50%', opacity: 0 }}
      animate={{ y: 0, x: '-50%', opacity: 1 }}
      transition={{ delay: 1.2, type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed bottom-8 left-1/2 z-[100] flex items-center gap-2 p-2 bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
    >
      {tabs.map(tab => {
        const isActive = activeModule === tab.key;
        const config = MODULE_CONFIGS[tab.key];
        
        return (
          <button
            key={tab.key}
            onClick={() => onModuleChange(tab.key)}
            className={`relative flex items-center h-11 px-5 gap-2.5 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all duration-500 group ${
              isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="active-tab-bg"
                className="absolute inset-0 bg-indigo-500 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            
            <tab.icon 
              size={16} 
              className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} 
            />
            <span className="relative z-10">{tab.label}</span>
            
            {isActive && (
              <motion.div 
                layoutId="active-tab-indicator"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"
              />
            )}
          </button>
        );
      })}
    </motion.div>
  );
};

export default ModuleTabs;
