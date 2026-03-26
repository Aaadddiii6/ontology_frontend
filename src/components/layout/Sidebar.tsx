import React from 'react';
import { Map, Activity, BarChart2, Settings, User } from 'lucide-react';
import { MODULE_CONFIGS } from '../../lib/api';
import { ActiveModule } from '../../types';

interface SidebarProps {
  activeModule: ActiveModule;
}

const navItems = [
  { icon: Map, label: 'World Map', key: 'map' },
  { icon: Activity, label: 'Simulator', key: 'simulator' },
  { icon: BarChart2, label: 'Analytics', key: 'analytics' },
];

const bottomNavItems = [
  { icon: Settings, label: 'Settings', key: 'settings' },
  { icon: User, label: 'Profile', key: 'profile' },
];

const Sidebar: React.FC<SidebarProps> = ({ activeModule }) => {
  const accentColor = MODULE_CONFIGS[activeModule]?.accent || '#1e293b';

  return (
    <aside
      className="fixed left-0 top-[52px] bottom-0 z-50 w-[52px] hover:w-[200px] transition-all duration-200 ease-in-out overflow-hidden border-r group"
      style={{
        background: 'rgba(255,255,255,0.95)',
        borderColor: 'rgba(0,0,0,0.08)',
      }}
    >
      <ul className="flex flex-col h-full p-2">
        {navItems.map(item => {
          const isActive = item.key === 'map'; // Assuming 'map' is always active for now
          return (
            <li
              key={item.key}
              className="flex items-center h-11 px-3.5 gap-3 cursor-pointer rounded-lg relative"
              style={{
                backgroundColor: isActive ? `${accentColor}14` : 'transparent',
              }}
            >
              {isActive && (
                <div
                  className="absolute left-0 w-1 h-6 rounded-r-full"
                  style={{ backgroundColor: accentColor }}
                />
              )}
              <item.icon size={20} style={{ color: isActive ? accentColor : '#888' }} className="shrink-0" />
              <span
                className="text-sm font-medium text-gray-700 whitespace-nowrap transition-opacity duration-100 opacity-0 group-hover:opacity-100"
              >
                {item.label}
              </span>
            </li>
          );
        })}

        <div className="mt-auto" />

        {bottomNavItems.map(item => (
          <li key={item.key} className="flex items-center h-11 px-3.5 gap-3 cursor-pointer rounded-lg">
            <item.icon size={20} className="text-gray-400 shrink-0" />
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap transition-opacity duration-100 opacity-0 group-hover:opacity-100">
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default Sidebar;
