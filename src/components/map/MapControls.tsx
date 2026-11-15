"use client";

import React, { useMemo, useState } from "react";
import { Layers, ChevronDown, ChevronUp, X, Palette, Crosshair } from "lucide-react";
import type { GraphLayerInfo, GraphMetricInfo } from "@/lib/api";
import type { Legend } from "@/hooks/useMapLayers";

const DOMAIN_ORDER = ["composite", "economy", "defense", "geopolitics", "climate"];
const DOMAIN_LABEL: Record<string, string> = {
  composite: "Composite",
  economy: "Economy",
  defense: "Defence",
  geopolitics: "Geopolitics",
  climate: "Climate",
};

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  if (a >= 10) return v.toFixed(0);
  return v.toFixed(2);
}

interface Props {
  layers: GraphLayerInfo[];
  activeLayers: string[];
  onToggleLayer: (key: string) => void;
  limit: number;
  onLimit: (n: number) => void;
  metrics: GraphMetricInfo[];
  colorMetric: string | null;
  onColorMetric: (key: string | null) => void;
  legend: Legend | null;
  focusCountry: string | null;
  onClearFocus: () => void;
  edgeCount: number;
  loading: boolean;
}

export default function MapControls(p: Props) {
  const [open, setOpen] = useState(true);

  const groupedMetrics = useMemo(() => {
    const g = new Map<string, GraphMetricInfo[]>();
    for (const m of p.metrics) {
      const list = g.get(m.domain) ?? [];
      list.push(m);
      g.set(m.domain, list);
    }
    return DOMAIN_ORDER.filter((d) => g.has(d)).map((d) => [d, g.get(d)!] as const);
  }, [p.metrics]);

  return (
    <div className="fixed top-[150px] right-6 z-[120] w-[290px] glass-morphism bo-card rounded-2xl shadow-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-white/10"
      >
        <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] bo-ink">
          <Layers size={14} className="text-indigo-500" /> Map layers
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-mono bo-faint">
            {p.loading ? "loading…" : `${p.edgeCount.toLocaleString()} links`}
          </span>
          {open ? <ChevronUp size={14} className="bo-faint" /> : <ChevronDown size={14} className="bo-faint" />}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-4 max-h-[calc(100vh-260px)] overflow-y-auto">
          {p.focusCountry && (
            <div className="flex items-center justify-between rounded-lg bg-indigo-500/10 border border-indigo-500/30 px-3 py-2">
              <span className="flex items-center gap-2 text-[11px] font-bold text-indigo-500">
                <Crosshair size={12} /> Links of {p.focusCountry}
              </span>
              <button onClick={p.onClearFocus} className="bo-faint hover:text-rose-500" aria-label="Show all countries">
                <X size={13} />
              </button>
            </div>
          )}

          <div className="space-y-1">
            {p.layers.length === 0 && (
              <p className="text-[11px] bo-faint">No layers yet. Is the backend running?</p>
            )}
            {p.layers.map((l) => {
              const on = p.activeLayers.includes(l.key);
              const empty = l.available_edges === 0;
              return (
                <label
                  key={l.key}
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    empty ? "opacity-40 cursor-not-allowed" : "hover:bg-indigo-500/5"
                  }`}
                  title={`${l.source}${empty ? " (not loaded)" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    disabled={empty}
                    onChange={() => p.onToggleLayer(l.key)}
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-[4px] border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: l.color, background: on ? l.color : "transparent" }}
                  />
                  <span className="flex-1 text-[12px] bo-sub leading-tight">{l.label}</span>
                  <span className="text-[10px] font-mono bo-faint tabular-nums">
                    {empty ? "—" : l.available_edges >= 5000 ? "5k+" : l.available_edges}
                  </span>
                </label>
              );
            })}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest bo-faint">Links per layer</span>
              <span className="text-[11px] font-mono text-indigo-500 font-bold">{p.limit}</span>
            </div>
            <input
              type="range"
              min={25}
              max={1000}
              step={25}
              value={p.limit}
              onChange={(e) => p.onLimit(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500"
              aria-label="Links per layer"
            />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest bo-faint flex items-center gap-1.5 mb-1">
              <Palette size={11} /> Colour countries by
            </span>
            <select
              className="bo-field w-full rounded-lg px-2.5 py-2 text-[12px] focus:outline-none focus:border-indigo-500"
              value={p.colorMetric ?? ""}
              onChange={(e) => p.onColorMetric(e.target.value || null)}
            >
              <option value="">Tab default</option>
              {groupedMetrics.map(([domain, list]) => (
                <optgroup key={domain} label={DOMAIN_LABEL[domain] ?? domain}>
                  {list.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {p.legend && (
              <div className="mt-2">
                <div
                  className="h-2 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${p.legend.colors.join(",")})` }}
                />
                <div className="flex justify-between text-[10px] font-mono bo-faint mt-1">
                  <span>≤{fmt(p.legend.lo)}</span>
                  <span className="truncate px-2">{p.legend.metric.unit}</span>
                  <span>≥{fmt(p.legend.hi)}</span>
                </div>
                <p className="text-[10px] bo-faint mt-1">
                  {p.legend.count} countries · {p.legend.metric.source}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
