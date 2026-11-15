"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, ArrowRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { fetchInsights, type InsightCard } from "@/lib/api";
import type { ActiveModule } from "@/types";

const ACCENT: Record<string, string> = {
  overview: "#2f7cf6",
  defence: "#ef4444",
  economy: "#22c55e",
  geopolitics: "#8b5cf6",
  climate: "#f59e0b",
};
const SERIES_COLORS = ["#2f7cf6", "#f59e0b", "#ef4444", "#22c55e"];
const SPLIT_COLORS = ["#22c55e", "#ef4444", "#8b5cf6", "#f59e0b", "#2f7cf6", "#14b8a6"];

function fmt(v: number, unit: string): string {
  const a = Math.abs(v);
  if (unit === "USD") return a >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : a >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`;
  if (unit.startsWith("USD millions")) return a >= 1e6 ? `$${(v / 1e6).toFixed(2)}T` : a >= 1e3 ? `$${(v / 1e3).toFixed(0)}B` : `$${v.toFixed(0)}M`;
  if (unit.includes("0–1")) return v.toFixed(2);
  if (unit.includes("WGI")) return v.toFixed(2);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return a >= 100 ? v.toFixed(0) : v.toFixed(1);
}

function Bars({ card, color }: { card: InsightCard; color: string }) {
  const rows = card.data as { label: string; value: number }[];
  const vals = rows.map((r) => r.value);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(...vals.map(Math.abs)) || 1;
  return (
    <ol className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={r.label} className="text-[12px]">
          <div className="flex items-center gap-2">
            <span className="w-4 text-right bo-t3 tabular-nums">{i + 1}</span>
            <span className="flex-1 truncate bo-t1" title={r.label}>{r.label}</span>
            <span className="font-semibold tabular-nums" style={{ color }}>{fmt(r.value, card.unit)}</span>
          </div>
          <div className="ml-6 h-1 rounded-full mt-0.5" style={{ background: "var(--bo-chip)" }}>
            <div className="h-1 rounded-full" style={{ width: `${(Math.abs(r.value - (lo < 0 ? 0 : 0)) / hi) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Series({ card }: { card: InsightCard }) {
  const series = card.data as { label: string; unit: string; points: { x: number; y: number }[] }[];
  return (
    <div className="space-y-3">
      {series.map((s, si) => {
        const pts = s.points;
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const line = pts.map((p) => `${((p.x - x0) / (x1 - x0 || 1)) * 196 + 2},${30 - ((p.y - y0) / (y1 - y0 || 1)) * 26}`).join(" ");
        const first = pts[0], last = pts[pts.length - 1];
        const change = first.y ? ((last.y - first.y) / Math.abs(first.y)) * 100 : 0;
        const color = SERIES_COLORS[si % SERIES_COLORS.length];
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="bo-t2">{s.label}</span>
              <span className="tabular-nums">
                <span className="font-bold bo-t1">
                  {s.unit.startsWith("$") ? `${s.unit[0]}${last.y.toFixed(1)}${s.unit.slice(1)}` : `${last.y.toFixed(last.y >= 100 ? 0 : 1)}${s.unit === "k" ? "k" : ""}`}
                </span>
                <span className={`ml-1.5 text-[10px] ${change >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}% since {first.x}
                </span>
              </span>
            </div>
            <svg viewBox="0 0 200 32" className="w-full h-8" preserveAspectRatio="none" aria-hidden>
              <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="flex justify-between text-[9px] bo-t3 -mt-0.5">
              <span>{x0}</span>
              <span>{x1}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Split({ card }: { card: InsightCard }) {
  const rows = card.data as { label: string; value: number }[];
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden">
        {rows.map((r, i) => (
          <div key={r.label} style={{ width: `${(r.value / total) * 100}%`, background: SPLIT_COLORS[i % SPLIT_COLORS.length] }} title={`${r.label}: ${r.value.toLocaleString()}`} />
        ))}
      </div>
      <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SPLIT_COLORS[i % SPLIT_COLORS.length] }} />
            <span className="bo-t2 truncate">{r.label}</span>
            <span className="ml-auto font-semibold bo-t1 tabular-nums">{((r.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] bo-t3 mt-1.5">{total.toLocaleString()} {card.unit}</p>
    </div>
  );
}

function readCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem("bo-insight-collapsed-v2") || "{}");
  } catch {
    return {};
  }
}

/** Left-column insight cards for the home page, per tab, all from /graph/insights. */
export default function InsightCards({ module }: { module: ActiveModule }) {
  const [cards, setCards] = useState<InsightCard[] | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState(false);
  const [ask, setAsk] = useState("");
  const color = ACCENT[module] ?? ACCENT.overview;

  useEffect(() => setCollapsed(readCollapsed()), []);
  // localStorage key versioned: earlier builds stored "all open" choices.
  useEffect(() => {
    let alive = true;
    setCards(null);
    fetchInsights(module === "simulator" ? "overview" : module).then((c) => alive && setCards(c));
    return () => {
      alive = false;
    };
  }, [module]);

  const toggle = (id: string, currentlyCollapsed: boolean) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !currentlyCollapsed };
      try {
        localStorage.setItem("bo-insight-collapsed-v2", JSON.stringify(next));
      } catch {
        /* storage blocked: state just won't persist */
      }
      return next;
    });
  };

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="fixed top-[230px] left-[96px] z-[70] bo-panel rounded-xl h-10 px-3 flex items-center gap-2 text-[12px] font-semibold bo-t1"
        title="Show insight cards"
      >
        <PanelLeftOpen size={16} className="bo-accent" /> Insights
      </button>
    );
  }

  return (
    <div className="fixed top-[230px] left-[96px] bottom-[76px] z-[70] w-[300px] flex flex-col gap-2.5 overflow-y-auto no-scrollbar pb-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] bo-t3">Insights · {module === "overview" ? "global" : module}</span>
        <button onClick={() => setHidden(true)} className="bo-t3 hover:bo-t1 p-1" title="Hide insight cards" aria-label="Hide insight cards">
          <PanelLeftClose size={15} />
        </button>
      </div>

      {cards === null &&
        [0, 1, 2].map((i) => <div key={i} className="bo-panel rounded-2xl h-28 animate-pulse" />)}

      {cards?.map((card, index) => {
        // Collapsed by default, except the first card of the tab. A card the
        // user opened or closed keeps that choice (stored per card id).
        const isCollapsed = collapsed[card.id] ?? index !== 0;
        return (
          <section key={card.id} className="bo-panel rounded-2xl">
            <button onClick={() => toggle(card.id, isCollapsed)} className="w-full flex items-center justify-between px-4 py-3" aria-expanded={!isCollapsed}>
              <span className="text-[14px] font-bold bo-t1 text-left">{card.title}</span>
              {isCollapsed ? <ChevronDown size={16} className="bo-t3" /> : <ChevronUp size={16} className="bo-t3" />}
            </button>
            {!isCollapsed && (
              <div className="px-4 pb-3.5">
                {card.kind === "bars" && <Bars card={card} color={color} />}
                {card.kind === "series" && <Series card={card} />}
                {card.kind === "split" && <Split card={card} />}
                <p className="text-[10px] bo-t3 mt-2.5">
                  {card.kind === "bars" ? `${card.unit} · ` : ""}Source: {card.source}
                </p>
              </div>
            )}
          </section>
        );
      })}

      {cards && (
        <section className="bo-panel rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2 text-[14px] font-bold bo-t1 mb-2">
            <Sparkles size={15} className="bo-accent" /> Ask the graph
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!ask.trim()) return;
              window.dispatchEvent(new CustomEvent("openIntelligenceSearch", { detail: { query: ask.trim() } }));
              setAsk("");
            }}
            className="flex gap-2"
          >
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Which countries depend on Russian energy?"
              className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[12px] bo-chip bo-t1 focus:outline-none"
            />
            <button type="submit" className="w-9 rounded-lg bo-bg-accent flex items-center justify-center" aria-label="Ask">
              <ArrowRight size={15} />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
