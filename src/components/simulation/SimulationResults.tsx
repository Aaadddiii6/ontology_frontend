"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Database, Download, Info, ChevronDown, ChevronUp } from "lucide-react";
import type { SimulationUI, ScoreDeltaUI, AffectedCountryUI } from "@/app/actions/simulate";

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-rose-600/15 text-rose-500 border-rose-500/30",
  high: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  rules: "Rule parser (no AI)",
  structured: "Structured input (no AI)",
  template: "Template from numbers (no AI)",
  handler: "Scenario handler",
};

function fmtUSD(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${Math.round(v).toLocaleString()}`;
}

function prettyScore(name: string): string {
  return name.replace(/_score$/, "").replace(/_/g, " ");
}

/** current → projected on a 0..1 track. Bad-direction moves are red. */
function ScoreBar({ d }: { d: ScoreDeltaUI }) {
  // "Up is bad" for risk/vulnerability scores, "up is good" for influence/power.
  const upIsBad = /risk|vulnerab|fragil|stress|isolation/.test(d.score_name);
  const bad = upIsBad ? d.delta > 0 : d.delta < 0;
  const lo = Math.min(d.current, d.projected);
  const hi = Math.max(d.current, d.projected);
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[11px]">
      <span className="bo-sub truncate capitalize" title={d.score_name}>
        {prettyScore(d.score_name)}
      </span>
      <div className="relative h-2 rounded-full bo-track" title={`${d.current.toFixed(3)} → ${d.projected.toFixed(3)}`}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-400/40" style={{ width: `${lo * 100}%` }} />
        <div
          className={`absolute inset-y-0 rounded-full ${bad ? "bg-rose-500" : "bg-emerald-500"}`}
          style={{ left: `${lo * 100}%`, width: `${Math.max((hi - lo) * 100, 0.8)}%` }}
        />
      </div>
      <span className={`font-mono font-bold tabular-nums ${bad ? "text-rose-500" : "text-emerald-600"}`}>
        {d.current.toFixed(2)}→{d.projected.toFixed(2)} ({d.delta > 0 ? "+" : ""}
        {d.delta.toFixed(3)})
      </span>
    </div>
  );
}

function CountryRow({ c }: { c: AffectedCountryUI }) {
  const [open, setOpen] = useState(c.impact_type === "direct");
  return (
    <div className="bo-card rounded-xl p-3">
      <button className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
              SEVERITY_STYLE[c.severity] ?? SEVERITY_STYLE.low
            }`}
          >
            {c.severity}
          </span>
          <span className="text-sm font-bold bo-ink truncate">{c.country}</span>
          <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-500">{c.impact_type}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {c.exposure_usd ? (
            <span className="text-[11px] font-mono bo-sub" title="Estimated economic exposure">
              {fmtUSD(c.exposure_usd)}
            </span>
          ) : null}
          {open ? <ChevronUp size={14} className="bo-faint" /> : <ChevronDown size={14} className="bo-faint" />}
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {c.summary && <p className="text-[11px] bo-sub leading-relaxed">{c.summary}</p>}
          {c.score_deltas.map((d) => (
            <ScoreBar key={d.score_name} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bo-card rounded-xl px-3 py-2.5" title={hint}>
      <div className="font-mono font-bold text-base bo-ink tabular-nums">{value}</div>
      <div className="text-[9px] font-black tracking-widest bo-faint uppercase mt-0.5">{label}</div>
    </div>
  );
}

export default function SimulationResults({ r }: { r: SimulationUI }) {
  const exposure = useMemo(
    () => r.affectedCountries.reduce((s, c) => s + (c.exposure_usd ?? 0), 0),
    [r.affectedCountries],
  );
  const direct = r.affectedCountries.filter((c) => c.impact_type === "direct").length;
  const cascade = r.affectedCountries.length - direct;

  const download = () => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulation-${r.scenarioType}-${r.year}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Headline + provenance */}
      <div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-500">
            {r.scenarioType.replace(/_/g, " ")}
          </span>
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bo-card bo-sub">
            data year {r.year}
          </span>
          {r.parsedBy && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bo-card bo-faint">
              understood by: {PROVIDER_LABEL[r.parsedBy] ?? r.parsedBy}
            </span>
          )}
          {r.narrativeBy && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bo-card bo-faint">
              brief by: {PROVIDER_LABEL[r.narrativeBy] ?? r.narrativeBy}
            </span>
          )}
        </div>
        <h3 className="text-xl font-black bo-ink leading-tight">{r.headline}</h3>
        {r.parts.length > 1 && (
          <div className="mt-3 rounded-xl bo-card p-3">
            <div className="text-[10px] font-black uppercase tracking-widest bo-faint mb-2">
              Compound question: {r.parts.length} scenarios combined
            </div>
            <ol className="space-y-1">
              {r.parts.map((p, i) => (
                <li key={i} className="text-[12px] bo-sub flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="font-semibold capitalize">{p.scenario_type.replace(/_/g, " ")}</span>
                  <span className="bo-faint">{[p.actor, p.target].filter(Boolean).join(" → ")}</span>
                  <span className="ml-auto bo-faint">{p.countries} countries</span>
                </li>
              ))}
            </ol>
            <p className="text-[10px] bo-faint mt-2">Effects on the same country are added together; severity is the worst of the parts.</p>
          </div>
        )}
        {(r.actor || r.target) && (
          <p className="text-xs bo-faint mt-1">
            {r.actor ?? "—"} → {r.target ?? "—"}
          </p>
        )}
      </div>

      {r.notes.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-600 flex gap-2">
          <Info size={14} className="shrink-0 mt-0.5" />
          <div>{r.notes.join(" ")}</div>
        </div>
      )}
      {r.missingData.length > 0 && r.affectedCountries.length === 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[11px] text-rose-600 flex gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>{r.missingData.join("; ")}</div>
        </div>
      )}

      {/* Key numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Countries hit" value={`${r.affectedCountries.length}`} hint={`${direct} direct, ${cascade} cascade`} />
        <Stat label="Exposure" value={exposure > 0 ? fmtUSD(exposure) : "—"} hint="Sum of estimated economic exposure" />
        <Stat
          label="Confidence"
          value={`${r.confidenceScore}%`}
          hint="From data coverage: lower when scores the scenario needs are missing in the graph"
        />
        <Stat label="Compute" value={r.computationTime ?? "—"} />
      </div>

      <p className="text-sm bo-sub leading-relaxed whitespace-pre-line">{r.summary}</p>

      {r.affectedCountries.length > 0 && (
        <section>
          <h4 className="text-[10px] font-black tracking-[0.2em] bo-faint uppercase pb-2 mb-3 border-b border-white/10">
            Projected score changes · current → projected (0–1 scale)
          </h4>
          <div className="space-y-2">
            {r.affectedCountries.map((c) => (
              <CountryRow key={`${c.country}-${c.impact_type}`} c={c} />
            ))}
          </div>
        </section>
      )}

      {r.cascadeEffects.length > 0 && (
        <section>
          <h4 className="text-[10px] font-black tracking-[0.2em] bo-faint uppercase pb-2 mb-3 border-b border-white/10">
            Cascade mechanisms
          </h4>
          <ol className="space-y-3">
            {r.cascadeEffects.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <div className="text-[11px] font-bold bo-ink">
                    {e.mechanism}
                    {e.severity && <span className="ml-2 text-[9px] uppercase bo-faint">{e.severity}</span>}
                  </div>
                  <p className="text-[11px] bo-sub leading-relaxed">{e.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Traceability: what the numbers were computed from */}
      <section className="bo-card rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-black tracking-[0.2em] bo-faint uppercase flex items-center gap-1.5">
            <Database size={12} /> Computed from graph data
          </h4>
          <button
            onClick={download}
            className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
          >
            <Download size={12} /> JSON
          </button>
        </div>
        {r.dataSources.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {r.dataSources.map((s) => (
              <code key={s} className="text-[10px] px-1.5 py-0.5 rounded bo-track bo-sub">
                {s}
              </code>
            ))}
          </div>
        ) : (
          <p className="text-[11px] bo-faint">No graph sources recorded for this run.</p>
        )}
        {r.missingData.length > 0 && r.affectedCountries.length > 0 && (
          <p className="text-[10px] bo-faint mt-2">Missing in graph: {r.missingData.join(", ")}</p>
        )}
      </section>
    </div>
  );
}
