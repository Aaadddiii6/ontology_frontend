import React from 'react';
import { Search } from 'lucide-react';
import { MODULE_CONFIGS } from '../../lib/api';
import { ActiveModule } from '../../types';

interface NavbarProps {
  activeModule: ActiveModule;
  onModuleChange: (m: ActiveModule) => void;
}

const modules: ActiveModule[] = ['overview', 'defence', 'economy', 'geopolitics', 'climate'];

const Navbar: React.FC<NavbarProps> = ({ activeModule, onModuleChange }) => {
  return (
    <nav
      className="fixed top-0 left-0 z-[100] flex items-center w-full h-[52px] px-4 gap-4 border-b"
      style={{
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        borderColor: 'rgba(0,0,0,0.08)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-600" />
        <span className="font-bold text-sm tracking-tighter">GIE</span>
      </div>

      {/* Module Pills */}
      <div className="flex items-center gap-1 mx-auto">
        {modules.map(module => {
          const isActive = activeModule === module;
          const config = MODULE_CONFIGS[module];
          return (
            <button
              key={module}
              onClick={() => onModuleChange(module)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ease-in-out"
              style={{
                backgroundColor: isActive ? config.accent : 'transparent',
                color: isActive ? 'white' : '#666',
              }}
            >
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3 ml-auto shrink-0">
        <Search size={18} className="text-gray-500 cursor-pointer" />
        <div className="flex items-center justify-center w-8 h-8 text-xs font-bold text-purple-700 bg-purple-100 rounded-full">
          GI
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
