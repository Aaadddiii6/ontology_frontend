"use client";

import React, { useMemo, useState } from "react";
import { Layers, ChevronDown, ChevronUp, X, Crosshair } from "lucide-react";
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
  opacity: number;
  onOpacity: (v: number) => void;
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
  const [tab, setTab] = useState<"rel" | "colour">("rel");

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
    <div className="fixed top-[172px] right-4 z-[120] w-[330px] bo-panel rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 pt-4 pb-3">
        <span className="flex items-center gap-2.5 text-[17px] font-bold bo-t1">
          <Layers size={18} className="bo-accent" /> Map Layers
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-1 rounded-full bo-chip bo-t2">
            {p.loading ? "loading…" : `${p.activeLayers.length} active · ${p.edgeCount.toLocaleString()} links`}
          </span>
          {open ? <ChevronUp size={16} className="bo-t3" /> : <ChevronDown size={16} className="bo-t3" />}
        </span>
      </button>

      {open && (
        <>
          <div className="flex px-5 gap-6 border-b bo-divider">
            {(
              [
                ["rel", "Relationships"],
                ["colour", "Country Colour"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`pb-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
                  tab === k ? "bo-accent border-[var(--bo-accent)]" : "bo-t3 border-transparent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5 pt-3 space-y-4 max-h-[calc(100vh-430px)] overflow-y-auto no-scrollbar">
            {p.focusCountry && (
              <div className="flex items-center justify-between rounded-xl px-3 py-2 bo-chip">
                <span className="flex items-center gap-2 text-[12px] font-semibold bo-accent">
                  <Crosshair size={13} /> Showing links of {p.focusCountry}
                </span>
                <button onClick={p.onClearFocus} className="bo-t3 hover:text-rose-500" aria-label="Show all countries">
                  <X size={14} />
                </button>
              </div>
            )}

            {tab === "rel" && (
              <>
                <ul className="space-y-0.5">
                  {p.layers.length === 0 && <li className="text-[12px] bo-t3">No layers yet. Is the backend running?</li>}
                  {p.layers.map((l) => {
                    const on = p.activeLayers.includes(l.key);
                    const empty = l.available_edges === 0;
                    return (
                      <li key={l.key}>
                        <button
                          onClick={() => !empty && p.onToggleLayer(l.key)}
                          disabled={empty}
                          className={`w-full flex items-center gap-3 py-2 text-left ${empty ? "opacity-40" : ""}`}
                          title={`${l.source}${empty ? " (not loaded)" : ""}`}
                          aria-pressed={on}
                        >
                          <span className="w-3.5 h-3.5 rounded-[4px] shrink-0" style={{ background: l.color }} />
                          <span className="flex-1 text-[13px] bo-t1 leading-tight">{l.label}</span>
                          <span className="text-[12px] bo-t2 tabular-nums w-12 text-right">
                            {empty ? "—" : l.available_edges >= 5000 ? "5,000+" : l.available_edges.toLocaleString()}
                          </span>
                          <span className="bo-switch" data-on={on} />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[13px] bo-t2">Links opacity</span>
                    <span className="text-[13px] font-semibold bo-accent">{Math.round(p.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={p.opacity}
                    onChange={(e) => p.onOpacity(parseFloat(e.target.value))}
                    className="w-full accent-[var(--bo-accent)]"
                    aria-label="Links opacity"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[13px] bo-t2">Links per layer</span>
                    <span className="text-[13px] font-semibold bo-accent">{p.limit}</span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={1000}
                    step={25}
                    value={p.limit}
                    onChange={(e) => p.onLimit(parseInt(e.target.value, 10))}
                    className="w-full accent-[var(--bo-accent)]"
                    aria-label="Links per layer"
                  />
                </div>
              </>
            )}

            {tab === "colour" && (
              <div>
                <label className="text-[13px] bo-t2 block mb-1.5">Colour countries by</label>
                <select
                  className="w-full rounded-xl px-3 py-2.5 text-[13px] bo-t1 bo-chip focus:outline-none"
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
                {p.legend ? (
                  <div className="mt-3">
                    <div className="h-2.5 rounded-full" style={{ background: `linear-gradient(90deg, ${p.legend.colors.join(",")})` }} />
                    <div className="flex justify-between text-[12px] bo-t3 mt-1.5">
                      <span>Low ≤{fmt(p.legend.lo)}</span>
                      <span>High ≥{fmt(p.legend.hi)}</span>
                    </div>
                    <p className="text-[11px] bo-t3 mt-2">
                      {p.legend.metric.unit} · {p.legend.count} countries · {p.legend.metric.source}
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] bo-t3 mt-3">
                    Pick any score or IMF / World Bank indicator to shade the map. Grey = no data.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
