"use client";

import React, { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { fetchCountryIndicators, type CountryIndicator } from "@/lib/api";

const TAB_DOMAIN: Record<string, string> = {
  defence: "defense",
  economy: "economy",
  geopolitics: "geopolitics",
  climate: "climate",
};

function fmtValue(v: number, unit: string): string {
  const a = Math.abs(v);
  if (unit === "people") return a >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1e3)}k`;
  if (unit.includes("TIV")) return a >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : `${(v / 1e6).toFixed(0)}M`;
  if (unit === "USD") return `$${Math.round(v).toLocaleString()}`;
  if (unit.startsWith("billion")) return `$${v >= 1000 ? (v / 1000).toFixed(2) + "T" : v.toFixed(0) + "B"}`;
  if (unit.startsWith("million")) return `${v.toFixed(1)}M`;
  if (unit.includes("WGI")) return v.toFixed(2);
  return `${v.toFixed(1)}${unit.includes("%") ? "%" : ""}`;
}

function Spark({ series }: { series: CountryIndicator["series"] }) {
  const pts = series.filter((s) => s.value !== null);
  if (pts.length < 2) return <div className="w-20" />;
  const xs = pts.map((p) => p.year);
  const ys = pts.map((p) => p.value);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x: number) => ((x - x0) / (x1 - x0 || 1)) * 78 + 1;
  const sy = (y: number) => 23 - ((y - y0) / (y1 - y0 || 1)) * 22;
  const actual = pts.filter((p) => !p.projected);
  const proj = pts.filter((p, i) => p.projected || (i > 0 && pts[i - 1] && !p.projected && pts[i + 1]?.projected));
  const line = (arr: typeof pts) => arr.map((p) => `${sx(p.year)},${sy(p.value)}`).join(" ");
  return (
    <svg width="80" height="24" className="shrink-0" aria-hidden>
      <polyline points={line(actual)} fill="none" stroke="#818cf8" strokeWidth="1.5" />
      {proj.length > 1 && (
        <polyline points={line(proj)} fill="none" stroke="#818cf8" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.6" />
      )}
    </svg>
  );
}

/** IMF / World Bank time series for one country, filtered to the open tab. */
export default function CountryIndicators({ country, tab }: { country: string; tab: string }) {
  const [rows, setRows] = useState<CountryIndicator[] | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    fetchCountryIndicators(country).then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, [country]);

  const domain = TAB_DOMAIN[tab];
  const list = (rows ?? []).filter((r) => r.domain === domain);
  if (rows === null) return <div className="h-16 rounded-xl bg-white/5 animate-pulse mt-6" />;
  if (!list.length) return null;

  return (
    <div className="mt-8">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
        Indicators (IMF / World Bank)
      </h4>
      <ul className="space-y-2.5">
        {list.map((r) => {
          const actual = r.series.filter((s) => !s.projected && s.value !== null);
          if (!actual.length) return null;
          const last = actual[actual.length - 1];
          const past = actual.find((s) => s.year >= last.year - 5) ?? actual[0];
          const change = last.value - past.value;
          const worse = r.direction === "up" ? change > 0 : r.direction === "down" ? change < 0 : null;
          const Icon = Math.abs(change) < 1e-9 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <li key={r.code} className="flex items-center gap-3" title={`${r.source} · ${r.code}`}>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-slate-300 truncate">{r.label}</div>
                <div className="text-[9px] text-slate-500">
                  {r.unit} · {last.year}
                </div>
              </div>
              <Spark series={r.series} />
              <div className="text-right w-[72px]">
                <div className="text-[13px] font-mono font-bold text-white tabular-nums">{fmtValue(last.value, r.unit)}</div>
                <div
                  className={`text-[9px] font-mono flex items-center justify-end gap-0.5 ${
                    worse === null ? "text-slate-500" : worse ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  <Icon size={10} />
                  {past.year !== last.year ? `${change > 0 ? "+" : ""}${fmtValue(change, r.unit)} since ${past.year}` : ""}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
