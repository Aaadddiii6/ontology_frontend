import React from "react";
import {
  Globe,
  Activity,
  BarChart3,
  Settings,
  User,
  Zap,
  Database,
  ShieldCheck,
  LayoutGrid,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULE_CONFIGS } from "../../lib/api";
import { ActiveModule } from "../../types";

interface SidebarProps {
  activeModule: ActiveModule;
}

const navItems = [
  { icon: Globe, label: "Overview", key: "map", href: "/" },
  { icon: Activity, label: "Simulation", key: "simulator", href: "/simulation" },
  { icon: Database, label: "Queries", key: "registry", href: "/queries" },
];

const bottomNavItems = [
  { icon: ShieldCheck, label: "Security", key: "security" },
  { icon: Settings, label: "Config", key: "settings" },
];

const Sidebar: React.FC<SidebarProps> = ({ activeModule }) => {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-[64px] bottom-0 z-[60] w-[72px] hover:w-[240px] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden bg-slate-950/40 backdrop-blur-2xl border-r border-white/5 group shadow-2xl">
      <div className="flex flex-col h-full py-6">
        {/* Top Navigation */}
        <div className="flex flex-col gap-2 px-3">
          {navItems.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.key} href={item.href}>
                <motion.div
                  whileHover={{ x: 4 }}
                  className={`relative flex items-center h-12 rounded-xl cursor-pointer transition-all duration-300 ${
                    isActive
                      ? "bg-indigo-500/10 text-white"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    />
                  )}

                  <div className="w-[48px] flex items-center justify-center shrink-0">
                    <item.icon
                      size={20}
                      className={isActive ? "text-indigo-400" : ""}
                    />
                  </div>

                  <span className="text-[13px] font-bold tracking-tight whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                    {item.label}
                  </span>

                  {isActive && (
                    <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse opacity-0 group-hover:opacity-100" />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </div>

        <div className="my-6 mx-4 border-t border-white/5 opacity-50" />

        {/* System Stats Section (Visible on Hover) */}
        <div className="px-6 mb-auto opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none group-hover:pointer-events-auto">
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <span>Core Load</span>
                <span className="text-indigo-400">24%</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "24%" }}
                  className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="flex flex-col gap-2 px-3 mt-auto">
          {bottomNavItems.map((item) => (
            <div
              key={item.key}
              className="flex items-center h-12 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 cursor-pointer transition-all duration-300"
            >
              <div className="w-[48px] flex items-center justify-center shrink-0">
                <item.icon size={20} />
              </div>
              <span className="text-[13px] font-bold tracking-tight whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                {item.label}
              </span>
            </div>
          ))}

          {/* User Profile */}
          <div className="mt-2 p-2 flex items-center gap-3 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-lg">
              JD
            </div>
            <div className="flex flex-col overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-xs font-bold text-white truncate">
                John Doe
              </span>
              <span className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-widest">
                Admin Level 4
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
