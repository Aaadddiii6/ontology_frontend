"use client";
import React, { useEffect, useState } from "react";

/**
 * App background + day/night state.
 *
 * Pure CSS layers (no canvas animation loop, unlike the old starfield):
 *   night: deep navy, faint Earth-limb glow bottom-left, soft vignette
 *   day:   sky gradient, soft cloud haze, pale Earth limb top-right
 *
 * Mode lives on <body class="day-mode|night-mode">; every component reads
 * the --bo-* tokens from globals.css. Toggled via window event
 * "toggleDayNight" (Navbar button), persisted in localStorage.
 */
const DayNightBackground: React.FC = () => {
  const [isDay, setIsDay] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("gie-daynight");
    } catch {
      /* storage blocked: fall back to OS preference */
    }
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setIsDay(saved ? saved === "day" : !prefersDark);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const mode = isDay ? "day" : "night";
    try {
      localStorage.setItem("gie-daynight", mode);
    } catch {
      /* ignore */
    }
    document.body.classList.remove("day-mode", "night-mode");
    document.body.classList.add(`${mode}-mode`);
    window.dispatchEvent(new CustomEvent("dayNightChanged", { detail: mode }));
  }, [isDay, mounted]);

  useEffect(() => {
    const toggle = () => setIsDay((v) => !v);
    window.addEventListener("toggleDayNight", toggle);
    return () => window.removeEventListener("toggleDayNight", toggle);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      {isDay ? (
        <>
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#e7f1ff 0%,#dcebff 45%,#eef5ff 100%)" }} />
          {/* soft cloud haze */}
          <div className="absolute -top-24 left-[8%] w-[46vw] h-[30vh] rounded-full opacity-70" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,255,255,0))", filter: "blur(10px)" }} />
          <div className="absolute top-[30%] -left-24 w-[38vw] h-[26vh] rounded-full opacity-60" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.9), rgba(255,255,255,0))", filter: "blur(14px)" }} />
          <div className="absolute bottom-[-8%] right-[10%] w-[50vw] h-[34vh] rounded-full opacity-60" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.9), rgba(255,255,255,0))", filter: "blur(16px)" }} />
          {/* pale Earth limb, top-right */}
          <div className="absolute -top-[60vh] -right-[30vw] w-[90vw] h-[90vw] rounded-full" style={{ background: "radial-gradient(circle at 30% 70%, rgba(147,197,253,0.35), rgba(147,197,253,0) 60%)" }} />
        </>
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 60% 20%, #0c1d42 0%, #071330 45%, #040a18 100%)" }} />
          {/* Earth-limb glow, bottom-left */}
          <div className="absolute -bottom-[70vh] -left-[45vw] w-[100vw] h-[100vw] rounded-full" style={{ background: "radial-gradient(circle at 62% 30%, rgba(37,99,235,0.28), rgba(37,99,235,0.05) 38%, rgba(4,10,24,0) 60%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)" }} />
        </>
      )}
    </div>
  );
};

export default DayNightBackground;
