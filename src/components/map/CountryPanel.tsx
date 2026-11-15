"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { X, Shield, Atom, Crown, Activity, AlertTriangle, Maximize2 } from "lucide-react";
import DataViewer, { type ViewerData } from "@/components/map/DataViewer";
import { fetchCountryProfile, type CountryProfileFull, type SeriesPoint } from "@/lib/api";
import CountryIndicators from "@/components/map/CountryIndicators";
import type { ActiveModule } from "@/types";

type Tab = "overview" | "defence" | "economy" | "geopolitics" | "climate";
const TABS: Tab[] = ["overview", "defence", "economy", "geopolitics", "climate"];
const TAB_COLOR: Record<Tab, string> = {
  overview: "#6366f1",
  defence: "#ef4444",
  economy: "#22c55e",
  geopolitics: "#3b82f6",
  climate: "#f59e0b",
};

const SCORE_LABELS: [string, string, boolean][] = [
  // key, label, higher-is-worse
  ["global_risk_score", "Global risk", true],
  ["overall_vulnerability_score", "Overall vulnerability", true],
  ["conflict_risk_score", "Conflict risk", true],
  ["trade_vulnerability_score", "Trade vulnerability", true],
  ["energy_vulnerability_score", "Energy vulnerability", true],
  ["climate_risk_score", "Climate risk", true],
  ["strategic_influence_score", "Strategic influence", false],
  ["economic_influence_score", "Economic influence", false],
  ["military_strength_score", "Military strength", false],
  ["diplomatic_centrality_score", "Diplomatic centrality", false],
];

const usd = (v: number | null | undefined, scale = 1): string => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const n = v * scale;
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString()}`;
};
const num = (v: number | null | undefined, d = 0) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d });
const last = (s?: SeriesPoint[] | null) => (s && s.length ? s[s.length - 1] : null);

function Spark({ data, color }: { data?: SeriesPoint[] | null; color: string }) {
  const pts = (data ?? []).filter((d) => d.value !== null && d.value !== undefined);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.year), ys = pts.map((p) => Number(p.value));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const line = pts
    .map((p) => `${((p.year - x0) / (x1 - x0 || 1)) * 296 + 2},${38 - ((Number(p.value) - y0) / (y1 - y0 || 1)) * 34}`)
    .join(" ");
  return (
    <svg viewBox="0 0 300 40" className="w-full h-10 mt-1" preserveAspectRatio="none" aria-hidden>
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
      <div className="font-mono font-bold text-[15px] text-white tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-slate-400 mt-0.5">{label}</div>
      {sub && <div className="text-[9px] text-slate-500">{sub}</div>}
    </div>
  );
}

// Context so any Section can open the popup without prop drilling
const OpenViewer = React.createContext<(v: ViewerData) => void>(() => {});

function Section({ title, children, view }: { title: string; children: React.ReactNode; view?: ViewerData | null }) {
  const open = React.useContext(OpenViewer);
  const canOpen = !!view && view.rows.length > 0;
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</h4>
        {canOpen && (
          <button
            onClick={() => open(view!)}
            className="flex items-center gap-1 text-[10px] font-bold text-indigo-300 hover:text-white"
            title="Open chart and full table"
          >
            <Maximize2 size={12} /> Table
          </button>
        )}
      </div>
      <div
        onClick={canOpen ? () => open(view!) : undefined}
        className={canOpen ? "cursor-zoom-in rounded-lg hover:bg-white/[0.03] transition-colors" : undefined}
      >
        {children}
      </div>
    </section>
  );
}

// Builders for popup data
const lineView = (title: string, source: string, unitLabel: string, kind: "number" | "usd", data?: SeriesPoint[] | null, scale = 1): ViewerData => ({
  title, source, chart: "line", x: "year", y: "value", subtitle: unitLabel,
  columns: [{ key: "year", label: "Year", kind: "text" }, { key: "value", label: unitLabel, kind }],
  rows: (data ?? []).filter((d) => d.value !== null).map((d) => ({ year: d.year, value: Number(d.value) * scale })),
});
const barView = (title: string, source: string, unitLabel: string, kind: "number" | "usd" | "share", rows: { name: string; value: number; extra?: number | null }[], extraLabel?: string): ViewerData => ({
  title, source, chart: "bar", x: "name", y: "value", subtitle: unitLabel,
  columns: [
    { key: "name", label: "Country", kind: "text" },
    { key: "value", label: unitLabel, kind },
    ...(extraLabel ? [{ key: "extra", label: extraLabel, kind: "share" as const }] : []),
  ],
  rows: rows.map((r) => ({ name: r.name, value: r.value, extra: r.extra ?? null })),
});

function BarList({
  rows,
  color,
  fmt,
}: {
  rows: { name: string; value: number; note?: string }[];
  color: string;
  fmt: (v: number) => string;
}) {
  if (!rows.length) return <p className="text-[11px] text-slate-500">No data in the graph.</p>;
  rows = rows.slice(0, 6);
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.name} className="text-[11px]">
          <div className="flex justify-between gap-2">
            <span className="text-slate-300 truncate">{r.name}</span>
            <span className="font-mono text-white tabular-nums shrink-0">
              {fmt(r.value)}
              {r.note && <span className="text-slate-500 ml-1">{r.note}</span>}
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/10 mt-0.5">
            <div className="h-1 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ScoreBar({ label, value, worse }: { label: string; value: number; worse: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color = worse ? (value > 0.6 ? "#ef4444" : value > 0.35 ? "#f59e0b" : "#22c55e") : "#818cf8";
  return (
    <div className="grid grid-cols-[1fr_7rem_2.5rem] items-center gap-2 text-[11px]">
      <span className="text-slate-300">{label}</span>
      <div className="h-1.5 rounded-full bg-white/10">
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-white text-right tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

export default function CountryPanel({
  country,
  activeModule,
  onClose,
}: {
  country: string;
  activeModule: ActiveModule;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(activeModule === "simulator" ? "overview" : (activeModule as Tab));
  const [data, setData] = useState<CountryProfileFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerData | null>(null);

  useEffect(() => {
    setTab(activeModule === "simulator" ? "overview" : (activeModule as Tab));
  }, [activeModule]);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    fetchCountryProfile(country).then((d) => {
      if (!alive) return;
      if (d) setData(d);
      else setError(`No data for ${country} in the graph yet.`);
    });
    return () => {
      alive = false;
    };
  }, [country]);

  const p = data?.properties ?? {};
  const color = TAB_COLOR[tab];
  const gdp = last(data?.gdp);
  const spend = last(data?.defense_spending);
  const conflict = data?.conflict?.length ? data.conflict[data.conflict.length - 1] : null;
  const totalLinks = (data?.connections ?? []).reduce((a, c) => a + c.n, 0);

  return (
    <OpenViewer.Provider value={setViewer}>
      {viewer && <DataViewer data={viewer} onClose={() => setViewer(null)} />}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-[240]"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="fixed right-0 top-0 bottom-0 w-[400px] max-w-full bg-gradient-to-br from-slate-900/97 to-slate-800/95 backdrop-blur-2xl border-l border-white/10 z-[250] shadow-2xl flex flex-col text-white"
      >
        {/* Header */}
        <div className="p-5 pb-3 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight leading-tight truncate">{country}</h2>
              <p className="text-[10px] tracking-[0.2em] text-slate-400 uppercase mt-1">
                {(data?.region ?? [])[0] ?? p.dominant_region ?? "—"}
                {data?.risk_rank?.rank ? ` · #${data.risk_rank.rank} of ${data.risk_rank.of} by global risk` : ""}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-slate-400" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {p.nuclear_status && (
              <span className="chip bg-rose-500/15 text-rose-300 border-rose-500/30">
                <Atom size={11} /> Nuclear ({String(p.nuclear_status)})
              </span>
            )}
            {p.un_p5 && (
              <span className="chip bg-amber-500/15 text-amber-300 border-amber-500/30">
                <Crown size={11} /> UN P5
              </span>
            )}
            {p.is_regional_power && (
              <span className="chip bg-indigo-500/15 text-indigo-300 border-indigo-500/30">
                <Shield size={11} /> Regional power
              </span>
            )}
            {(data?.alliances ?? []).map((a) => (
              <span key={a} className="chip bg-white/5 text-slate-300 border-white/10">
                {a}
              </span>
            ))}
          </div>
          <style>{`.chip{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;border-width:1px}`}</style>
        </div>

        {/* Tabs */}
        <div className="flex px-3 border-b border-white/10 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors ${
                tab === t ? "text-white" : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
              style={tab === t ? { borderColor: TAB_COLOR[t] } : undefined}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-6">
          {error && (
            <p className="mt-6 text-[12px] text-amber-300 flex gap-2">
              <AlertTriangle size={14} /> {error}
            </p>
          )}
          {!data && !error && (
            <div className="space-y-3 mt-6 animate-pulse">
              <div className="h-16 bg-white/5 rounded-xl" />
              <div className="h-24 bg-white/5 rounded-xl" />
              <div className="h-24 bg-white/5 rounded-xl" />
            </div>
          )}

          {data && tab === "overview" && (
            <>
              <div className="grid grid-cols-3 gap-2 mt-5">
                <Stat label="GDP" value={usd(gdp?.value)} sub={gdp ? String(gdp.year) : undefined} />
                <Stat label="Defence budget" value={usd(spend?.value, 1e6)} sub={spend ? String(spend.year) : undefined} />
                <Stat label="Graph links" value={num(totalLinks)} />
              </div>
              <Section title="Scores (0–1, from graph analytics)">
                <div className="space-y-2">
                  {SCORE_LABELS.filter(([k]) => typeof p[k] === "number").map(([k, label, worse]) => (
                    <ScoreBar key={k} label={label} value={Number(p[k])} worse={worse} />
                  ))}
                  {!SCORE_LABELS.some(([k]) => typeof p[k] === "number") && (
                    <p className="text-[11px] text-slate-500">Scores not computed yet for this country.</p>
                  )}
                </div>
              </Section>
              <Section title="Connections in the knowledge graph" view={barView(`${country}: graph connections`, "Neo4j knowledge graph", "Relationships", "number", (data.connections ?? []).map((c) => ({ name: c.type.replace(/_/g, " ").toLowerCase(), value: c.n })))}>
                <BarList
                  rows={(data.connections ?? []).slice(0, 10).map((c) => ({ name: c.type.replace(/_/g, " ").toLowerCase(), value: c.n }))}
                  color={color}
                  fmt={(v) => num(v)}
                />
              </Section>
            </>
          )}

          {data && tab === "defence" && (
            <>
              <div className="grid grid-cols-3 gap-2 mt-5">
                <Stat label="Defence budget" value={usd(spend?.value, 1e6)} sub={spend ? `${spend.year} · SIPRI` : undefined} />
                <Stat label="Conflict deaths" value={num(conflict?.fatalities)} sub={conflict ? `${conflict.year} · ${conflict.trend ?? ""}` : undefined} />
                <Stat label="Violent events" value={num(conflict?.violence_events)} sub={conflict ? `${conflict.year} · ACLED` : undefined} />
              </div>
              <Section title="Defence spending (USD millions)" view={lineView(`${country}: defence spending`, "SIPRI Military Expenditure Database", "USD", "usd", data.defense_spending, 1e6)}>
                <Spark data={data.defense_spending} color={color} />
              </Section>
              <Section title="Conflict fatalities per year" view={lineView(`${country}: conflict fatalities`, "ACLED", "Fatalities", "number", (data.conflict ?? []).map((c) => ({ year: c.year, value: c.fatalities })))}>
                <Spark data={(data.conflict ?? []).map((c) => ({ year: c.year, value: c.fatalities }))} color={color} />
              </Section>
              <Section title="Arms exports (SIPRI TIV)" view={lineView(`${country}: arms exports`, "SIPRI Arms Transfers (TIV)", "SIPRI TIV (millions)", "number", data.arms_exports)}>
                <Spark data={data.arms_exports} color={color} />
                {!data.arms_exports?.length && <p className="text-[11px] text-slate-500">Not a recorded arms exporter.</p>}
              </Section>
              <CountryIndicators country={country} tab="defence" />
            </>
          )}

          {data && tab === "economy" && (
            <>
              <div className="grid grid-cols-3 gap-2 mt-5">
                <Stat label="GDP" value={usd(gdp?.value)} sub={gdp ? `${gdp.year} · World Bank` : undefined} />
                <Stat label="Exports" value={usd(data.trade_totals?.exports)} sub={data.trade_totals?.year ? `${data.trade_totals.year} · BACI` : undefined} />
                <Stat label="Imports" value={usd(data.trade_totals?.imports)} sub={data.trade_totals?.year ? `${data.trade_totals.year} · BACI` : undefined} />
              </div>
              <Section title="GDP over time" view={lineView(`${country}: GDP`, "World Bank", "GDP (USD)", "usd", data.gdp)}>
                <Spark data={data.gdp} color={color} />
              </Section>
              <Section title="Top export markets" view={barView(`${country}: top export markets`, "CEPII BACI", "Exports (USD)", "usd", (data.export_partners ?? []).map((r) => ({ name: r.country, value: r.value })))}>
                <BarList rows={(data.export_partners ?? []).map((r) => ({ name: r.country, value: r.value }))} color={color} fmt={(v) => usd(v)} />
              </Section>
              <Section title="Top import sources" view={barView(`${country}: top import sources`, "CEPII BACI", "Imports (USD)", "usd", (data.import_partners ?? []).map((r) => ({ name: r.country, value: r.value })))}>
                <BarList rows={(data.import_partners ?? []).map((r) => ({ name: r.country, value: r.value }))} color="#14b8a6" fmt={(v) => usd(v)} />
              </Section>
              <Section title="Energy suppliers" view={barView(`${country}: energy suppliers`, "CEPII BACI (HS 27)", "Energy imports (USD)", "usd", (data.energy_suppliers ?? []).map((r) => ({ name: r.country, value: r.value, extra: r.share })), "Share of energy imports")}>
                <BarList
                  rows={(data.energy_suppliers ?? []).map((r) => ({
                    name: r.country,
                    value: r.value,
                    note: r.share != null ? `(${Math.round(r.share * 100)}%)` : undefined,
                  }))}
                  color="#f59e0b"
                  fmt={(v) => usd(v)}
                />
              </Section>
              <Section title="Trade agreements & sanctions">
                <p className="text-[11px] text-slate-300">
                  {num(data.agreements?.partners)} agreement partners
                  {data.agreements?.names?.length ? ` · e.g. ${data.agreements.names.slice(0, 3).join(", ")}` : ""}
                </p>
                {(data.sanctions_received ?? []).map((s) => (
                  <p key={s.by} className="text-[11px] text-rose-300 mt-1">
                    Sanctioned by {s.by}: {num(s.entities)} designated entities (OFAC)
                  </p>
                ))}
              </Section>
              <CountryIndicators country={country} tab="economy" />
            </>
          )}

          {data && tab === "geopolitics" && (
            <>
              <div className="grid grid-cols-2 gap-2 mt-5">
                <Stat
                  label="Political system"
                  value={data.political?.system ?? "—"}
                  sub={data.political ? `V-Dem ${Number(data.political.score ?? 0).toFixed(2)} · ${data.political.year}` : undefined}
                />
                <Stat
                  label="Voting bloc"
                  value={data.bloc ? `#${data.bloc.bloc_id}` : "—"}
                  sub={data.bloc ? `${data.bloc.members} members (Louvain)` : undefined}
                />
              </div>
              {data.bloc?.sample?.length ? (
                <p className="text-[11px] text-slate-400 mt-2">Bloc includes: {data.bloc.sample.join(", ")}</p>
              ) : null}
              <Section title="Votes most often with (UN General Assembly)" view={barView(`${country}: UN voting alignment`, "UNGA roll-call votes", "Vote similarity", "share", (data.aligned ?? []).map((r) => ({ name: r.country, value: r.similarity })))}>
                <BarList rows={(data.aligned ?? []).map((r) => ({ name: r.country, value: r.similarity }))} color={color} fmt={(v) => `${Math.round(v * 100)}%`} />
              </Section>
              <Section title="Most diplomatic events with (GDELT)" view={barView(`${country}: diplomatic events`, "GDELT 2.0", "Events", "number", (data.diplomacy ?? []).map((r) => ({ name: r.country, value: r.events })))}>
                <BarList rows={(data.diplomacy ?? []).map((r) => ({ name: r.country, value: r.events }))} color="#6366f1" fmt={(v) => num(v)} />
              </Section>
              {(data.opposed ?? []).length > 0 && (
                <Section title="Opposes">
                  <BarList rows={(data.opposed ?? []).map((r) => ({ name: r.country, value: r.score }))} color="#a855f7" fmt={(v) => v.toFixed(2)} />
                </Section>
              )}
              {(data.sanctions_imposed ?? []).length > 0 && (
                <Section title="Sanctions imposed (designated entities)" view={barView(`${country}: sanctions imposed`, "OFAC SDN", "Designated entities", "number", (data.sanctions_imposed ?? []).map((r) => ({ name: r.on, value: r.entities })))}>
                  <BarList rows={(data.sanctions_imposed ?? []).map((r) => ({ name: r.on, value: r.entities }))} color="#dc2626" fmt={(v) => num(v)} />
                </Section>
              )}
              <CountryIndicators country={country} tab="geopolitics" />
            </>
          )}

          {data && tab === "climate" && (
            <>
              <div className="grid grid-cols-3 gap-2 mt-5">
                <Stat label="Climate risk" value={typeof p.climate_risk_score === "number" ? Number(p.climate_risk_score).toFixed(2) : "—"} />
                <Stat label="Disaster freq." value={typeof p.disaster_frequency_score === "number" ? Number(p.disaster_frequency_score).toFixed(2) : "—"} />
                <Stat label="Mean temp." value={typeof p.mean_temp_c === "number" ? `${Number(p.mean_temp_c).toFixed(1)}°C` : "—"} sub="NASA POWER" />
              </div>
              <Section title="Climate & hazard properties">
                <ul className="space-y-1 text-[11px]">
                  {Object.entries(p)
                    .filter(([k, v]) => /climate|disaster|temp|co2|forest|earthquake|damage|death|hazard/i.test(k) && typeof v !== "object")
                    .sort()
                    .map(([k, v]) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span className="text-slate-400">{k.replace(/_/g, " ")}</span>
                        <span className="font-mono text-white">{typeof v === "number" ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 }) : String(v)}</span>
                      </li>
                    ))}
                </ul>
              </Section>
              {(data.disasters ?? []).length > 0 && (
                <Section title="Recent disasters (EM-DAT)">
                  <ul className="space-y-1 text-[11px]">
                    {(data.disasters ?? []).map((d, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="text-slate-300">{d.name ?? d.kind}</span>
                        <span className="text-slate-500">{d.year ?? ""}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              <CountryIndicators country={country} tab="climate" />
            </>
          )}
        </div>

        <div className="p-4 border-t border-white/10">
          <Link
            href={`/simulation?actor=${encodeURIComponent(country)}`}
            className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Activity size={14} /> Simulate a scenario with {country}
          </Link>
        </div>
      </motion.aside>
    </OpenViewer.Provider>
  );
}
