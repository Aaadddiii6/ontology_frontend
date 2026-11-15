"use client";

import React from "react";
import { motion } from "framer-motion";
import { X, Download } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export interface ViewerColumn {
  key: string;
  label: string;
  kind?: "text" | "number" | "usd" | "pct" | "share";
}

export interface ViewerData {
  title: string;
  subtitle?: string;
  source: string;
  chart: "line" | "bar";
  x: string; // column key on the x axis (year or name)
  y: string; // column key with the value
  columns: ViewerColumn[];
  rows: Record<string, string | number | null>[];
}

function fmt(v: unknown, kind: ViewerColumn["kind"]): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v !== "number" || kind === "text") return String(v); // years stay "2024", not "2,024"
  const a = Math.abs(v);
  if (kind === "usd") return a >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : a >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : a >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${v.toLocaleString()}`;
  if (kind === "pct") return `${v.toFixed(1)}%`;
  if (kind === "share") return `${(v * 100).toFixed(1)}%`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function toCsv(d: ViewerData): string {
  const esc = (x: unknown) => {
    const s = x === null || x === undefined ? "" : String(x);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = d.columns.map((c) => esc(c.label)).join(",");
  const body = d.rows.map((r) => d.columns.map((c) => esc(r[c.key])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

/** Popup with a large interactive chart, the full table and CSV export. */
export default function DataViewer({ data, onClose }: { data: ViewerData; onClose: () => void }) {
  const yCol = data.columns.find((c) => c.key === data.y);
  const download = () => {
    const blob = new Blob([toCsv(data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title.replace(/[^\w]+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const chartRows = data.rows.filter((r) => typeof r[data.y] === "number");

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-slate-900 border border-white/10 shadow-2xl text-white"
        role="dialog"
        aria-label={data.title}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold">{data.title}</h3>
            {data.subtitle && <p className="text-[12px] text-slate-400 mt-0.5">{data.subtitle}</p>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={download} className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-semibold bg-white/5 hover:bg-white/10">
              <Download size={14} /> CSV
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-4 shrink-0" style={{ height: data.chart === "bar" ? Math.min(460, Math.max(240, chartRows.length * 26 + 40)) : 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            {data.chart === "line" ? (
              <LineChart data={chartRows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey={data.x} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => fmt(v, yCol?.kind)} width={70} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [fmt(v, yCol?.kind), yCol?.label ?? ""]}
                />
                <Line type="monotone" dataKey={data.y} stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            ) : (
              <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => fmt(v, yCol?.kind)} />
                <YAxis type="category" dataKey={data.x} tick={{ fill: "#cbd5e1", fontSize: 11 }} width={150} interval={0} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [fmt(v, yCol?.kind), yCol?.label ?? ""]}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey={data.y} fill="#60a5fa" radius={[0, 4, 4, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="px-6 pb-2 pt-3 overflow-y-auto no-scrollbar">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-slate-900">
              <tr className="text-slate-400">
                {data.columns.map((c) => (
                  <th key={c.key} className={`py-2 font-semibold ${c.kind && c.kind !== "text" ? "text-right" : "text-left"}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-t border-white/5">
                  {data.columns.map((c) => (
                    <td key={c.key} className={`py-1.5 tabular-nums ${c.kind && c.kind !== "text" ? "text-right" : ""}`}>
                      {fmt(r[c.key], c.kind)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-6 py-3 text-[11px] text-slate-500 border-t border-white/10">
          {data.rows.length} rows · Source: {data.source}
        </p>
      </motion.div>
    </div>
  );
}
