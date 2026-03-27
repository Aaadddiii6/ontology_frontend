"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

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

  useEffect(() => {
    const handleToggle = () => setIsDayMode(prev => !prev);
    window.addEventListener("toggleDayNight", handleToggle);
    return () => window.removeEventListener("toggleDayNight", handleToggle);
  }, []);

  if (!mounted) {
    return null; // Don't render anything on the server or initial client render
  }

const StarCanvas = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const initCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    initCanvas();

    const stars = Array.from({ length: 150 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.6 + 0.2,
      baseOpacity: Math.random() * 0.6 + 0.2,
      speed: (Math.random() * 0.5 + 0.1) * (Math.random() > 0.5 ? 1 : -1),
      twinkleSpeed: Math.random() * 0.05 + 0.01,
      angle: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      stars.forEach((star) => {
        star.y -= Math.abs(star.speed);
        star.x += star.speed * 0.5;
        star.angle += star.twinkleSpeed;
        star.opacity = star.baseOpacity + Math.sin(star.angle) * 0.2;

        if (star.y < 0) {
          star.y = height;
          star.x = Math.random() * width;
        }
        if (star.x > width) star.x = 0;
        if (star.x < 0) star.x = width;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, star.opacity)})`;
        ctx.fill();
      });
      animationId = requestAnimationFrame(render);
    };

    render();

    window.addEventListener("resize", initCanvas);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", initCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
};

  return (
    <>
      {!isDayMode && <StarCanvas />}

      <div className="fixed bottom-8 left-[320px] z-[100] flex items-center gap-3 text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] pointer-events-none">
        <div className={`w-2 h-2 rounded-full ${isDayMode ? 'bg-amber-400' : 'bg-indigo-400'} animate-pulse`} />
        <span>{isDayMode ? "Daylight Protocol" : "Nocturne Protocol"}</span>
      </div>
    </>
  );
};

export default React.memo(DayNightBackground);
