"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw, X, CheckCircle2, CircleDashed, AlertTriangle } from "lucide-react";
import { fetchHealth, type HealthInfo } from "@/lib/api";

const DOMAIN_LABEL: Record<string, string> = {
  economy: "Economy (BACI, World Bank, OFAC, WTO)",
  defense: "Defence (SIPRI, ACLED)",
  geopolitics: "Geopolitics (V-Dem, GDELT, UNGA)",
  climate: "Climate (EM-DAT, NASA, USGS)",
  live_news: "Live news (GDELT DOC, RSS)",
};

const SCORE_LABEL: Record<string, string> = {
  global_risk_score: "Global risk",
  geopolitical_influence_score: "Geopolitical influence",
  trade_vulnerability_score: "Trade vulnerability",
  economic_influence_score: "Economic influence",
  conflict_risk_score: "Conflict risk",
  climate_risk_score: "Climate risk",
  defense_spending_score: "Defence spending",
  diplomatic_centrality_score: "Diplomatic centrality",
};

/**
 * Shows what is actually loaded in the graph, so an empty chart reads as
 * "economy not loaded yet" instead of looking like a bug.
 */
export default function DataStatusPanel() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setHealth(await fetchHealth());
    setChecked(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const graph = health?.graph;
  const domains = graph ? Object.entries(graph.domains) : [];
  const loadedCount = domains.filter(([, d]) => d.loaded).length;
  const status: "ok" | "partial" | "down" =
    !health || health.neo4j.status !== "ok" ? "down" : loadedCount === domains.length ? "ok" : "partial";

  const dot = status === "ok" ? "bg-emerald-500" : status === "partial" ? "bg-amber-400" : "bg-rose-500";

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 left-[88px] z-[150] glass-morphism bo-card rounded-full pl-3 pr-4 py-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bo-sub shadow-lg"
        aria-expanded={open}
      >
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <Database size={12} />
        {!checked
          ? "Checking data…"
          : status === "down"
            ? "Backend offline"
            : `Data: ${loadedCount}/${domains.length} domains`}
      </button>

      {open && (
        <div className="fixed bottom-16 left-[88px] z-[150] w-[360px] max-h-[70vh] overflow-y-auto glass-morphism bo-card rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-black tracking-[0.2em] uppercase bo-ink">Data status</h3>
            <div className="flex gap-1">
              <button onClick={load} className="p-1.5 rounded-lg hover:bg-indigo-500/10 bo-faint" aria-label="Refresh">
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-indigo-500/10 bo-faint" aria-label="Close">
                <X size={13} />
              </button>
            </div>
          </div>

          {!health && (
            <p className="text-[11px] text-rose-500 flex gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              API not reachable. Start the backend: <code>uvicorn api.main:app --port 8000</code>
            </p>
          )}
          {health && health.neo4j.status !== "ok" && (
            <p className="text-[11px] text-rose-500 mb-3">
              Neo4j unreachable at {health.neo4j.host ?? "?"}: {health.neo4j.error}
            </p>
          )}

          {graph && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  ["Countries", graph.countries],
                  ["Nodes", graph.total_nodes],
                  ["Relationships", graph.total_relationships],
                ].map(([label, v]) => (
                  <div key={label as string} className="bo-card rounded-lg px-2 py-1.5">
                    <div className="font-mono font-bold text-sm bo-ink tabular-nums">{Number(v).toLocaleString()}</div>
                    <div className="text-[9px] uppercase tracking-wider bo-faint">{label}</div>
                  </div>
                ))}
              </div>

              <ul className="space-y-1.5 mb-4">
                {domains.map(([key, d]) => {
                  const edges = Object.values(d.edges).reduce((a, b) => a + b, 0);
                  return (
                    <li key={key} className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-2 bo-sub">
                        {d.loaded ? (
                          <CheckCircle2 size={13} className="text-emerald-500" />
                        ) : (
                          <CircleDashed size={13} className="bo-faint" />
                        )}
                        {DOMAIN_LABEL[key] ?? key}
                      </span>
                      <span className="font-mono bo-faint tabular-nums">
                        {d.loaded ? `${edges.toLocaleString()} edges` : "not loaded"}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {graph.countries > 0 && (
                <>
                  <h4 className="text-[9px] font-black uppercase tracking-widest bo-faint mb-1.5">
                    Score coverage (countries with a value)
                  </h4>
                  <ul className="space-y-1 mb-4">
                    {Object.entries(graph.score_coverage).map(([k, v]) => (
                      <li key={k} className="grid grid-cols-[1fr_6rem_2.5rem] items-center gap-2 text-[10px]">
                        <span className="bo-sub">{SCORE_LABEL[k] ?? k}</span>
                        <span className="h-1.5 rounded-full bo-track overflow-hidden">
                          <span
                            className="block h-full bg-indigo-500"
                            style={{ width: `${Math.min(100, (v / graph.countries) * 100)}%` }}
                          />
                        </span>
                        <span className="font-mono bo-faint text-right tabular-nums">{v}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {graph.trade_years?.max_year && (
                <p className="text-[10px] bo-faint mb-2">
                  Trade data years: {graph.trade_years.min_year}–{graph.trade_years.max_year}
                </p>
              )}
            </>
          )}

          {health && (
            <p className="text-[10px] bo-faint border-t border-white/10 pt-2">
              AI for parsing and briefs:{" "}
              {health.llm.configured.length
                ? `${health.llm.configured.join(" → ")} (${health.llm.openai_model})`
                : "none configured. Simulator uses the rule parser and template briefs."}
              {Object.keys(health.llm.cooling_down).length > 0 &&
                ` · cooling down: ${Object.keys(health.llm.cooling_down).join(", ")}`}
            </p>
          )}
        </div>
      )}
    </>
  );
}
