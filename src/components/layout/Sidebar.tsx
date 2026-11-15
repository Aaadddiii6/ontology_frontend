"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe2, GitBranch, Sparkles, SunMoon } from "lucide-react";
import { ActiveModule } from "../../types";

interface SidebarProps {
  activeModule: ActiveModule;
}

// Only pages that exist. (The old sidebar also showed "Core Load 24%" and
// similar hover stats: hardcoded numbers, removed.)
const NAV = [
  { href: "/", label: "Map", Icon: Globe2 },
  { href: "/simulation", label: "Simulator", Icon: GitBranch },
  { href: "/queries", label: "Intelligence", Icon: Sparkles },
];

const Sidebar: React.FC<SidebarProps> = () => {
  const pathname = usePathname();
  return (
    <aside
      className="group fixed left-0 top-[64px] bottom-0 z-[90] w-[72px] hover:w-[200px] transition-[width] duration-300 overflow-hidden border-r bo-divider"
      style={{ background: "var(--bo-surface-strong)", backdropFilter: "blur(18px)" }}
    >
      <div
        className="absolute inset-x-0 bottom-0 h-[50%] bo-sidebar-art opacity-95 pointer-events-none"
        // mask set inline: the CSS pipeline drops mask-image from stylesheets
        style={{
          // cover: the image always fills the whole fade area, at 72px and 200px widths.
          // (At 100% width it was only ~186px tall at 72px, so its own top edge showed
          // halfway up the fade as a hard line.)
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          maskImage: "linear-gradient(to top, #000 0%, #000 30%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.15) 78%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, #000 0%, #000 30%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.15) 78%, transparent 100%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col h-full py-5 px-3 gap-1.5">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center h-12 rounded-xl transition-colors ${
                active ? "bo-t1" : "bo-t3 hover:bg-[var(--bo-chip)]"
              }`}
              style={active ? { background: "var(--bo-accent-soft)" } : undefined}
              title={label}
            >
              {active && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bo-bg-accent" />}
              <span className="w-12 flex items-center justify-center shrink-0">
                <Icon size={20} className={active ? "bo-accent" : ""} />
              </span>
              <span className="text-[13px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {label}
              </span>
            </Link>
          );
        })}

        <div className="mt-auto">
          <button
            onClick={() => window.dispatchEvent(new Event("toggleDayNight"))}
            className="w-full flex items-center h-12 rounded-xl bo-t3 hover:bg-[var(--bo-chip)]"
            title="Day / night"
          >
            <span className="w-12 flex items-center justify-center shrink-0">
              <SunMoon size={20} />
            </span>
            <span className="text-[13px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              Day / night
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
