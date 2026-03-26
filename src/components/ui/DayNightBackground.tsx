"use client";
import React, { useState, useEffect } from "react";

const DayNightBackground: React.FC = () => {
  const [isDayMode, setIsDayMode] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("gie-daynight");
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDayMode(saved ? saved === "day" : !prefersDark);
  }, []);

  useEffect(() => {
    if (mounted) {
      const mode = isDayMode ? "day" : "night";
      localStorage.setItem("gie-daynight", mode);
      document.body.classList.remove("day-mode", "night-mode");
      document.body.classList.add(`${mode}-mode`);
    }
  }, [isDayMode, mounted]);

  const toggleMode = () => setIsDayMode(!isDayMode);

  if (!mounted) {
    return null; // Don't render anything on the server or initial client render
  }

  return (
    <>
      <button
        onClick={toggleMode}
        className="fixed top-[190px] right-8 z-[100] flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/10 text-white text-xs font-bold tracking-wider uppercase bg-slate-900/40 backdrop-blur-xl transition-all hover:bg-slate-900/60 active:scale-95 shadow-2xl"
      >
        <span className="relative z-10">{isDayMode ? "☀" : "☽"}</span>
        <span className="relative z-10">{isDayMode ? "Day" : "Night"}</span>
      </button>

      <div className="fixed bottom-8 left-[320px] z-[100] flex items-center gap-3 text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] pointer-events-none">
        <div className={`w-2 h-2 rounded-full ${isDayMode ? 'bg-amber-400' : 'bg-indigo-400'} animate-pulse`} />
        <span>{isDayMode ? "Daylight Protocol" : "Nocturne Protocol"}</span>
      </div>
    </>
  );
};

export default React.memo(DayNightBackground);
