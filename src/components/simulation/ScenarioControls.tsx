"use client";

import React, { useMemo } from "react";
import { Play, Wand2, SlidersHorizontal, Info } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import type { ScenarioInfo } from "@/lib/api";
import type { CountryProfile } from "@/types";

// Labels match the graph's Alliance / Region node names
// (modules/defense/graph_enrichment.py) so handlers can find them.
const ALLIANCES = ["NATO", "BRICS", "SCO", "QUAD", "ASEAN", "African Union", "Arab League", "CSTO"];
const BLOCS = ["RCEP", "CPTPP", "European Union", "Mercosur", "USMCA", "GCC"];
const REGIONS = [
  "Middle East", "South Asia", "East Asia", "Southeast Asia", "Central Asia",
  "Eastern Europe", "Western Europe", "Africa", "North America", "South America",
];

const DOMAIN_LABEL: Record<ScenarioInfo["domain"], string> = {
  economy: "Economy",
  defense: "Defence",
  geopolitics: "Geopolitics",
  climate: "Climate",
  composite: "Composite",
};

export const EXAMPLE_QUESTIONS = [
  "What if the US sanctions China?",
  "What if Russia cuts gas to Germany?",
  "What if Turkey leaves NATO?",
  "What if a major earthquake hits Japan?",
  "What if India joins RCEP?",
  "Which countries are most fragile right now?",
];

export function magnitudeLabel(m: number): string {
  if (m <= 0.6) return "Partial";
  if (m < 1.3) return "Full";
  if (m < 1.8) return "Severe";
  return "Extreme";
}

export type Mode = "build" | "ask";

interface Props {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  catalog: ScenarioInfo[];
  profiles: CountryProfile[];
  scenario: string;
  onScenario: (s: string) => void;
  actor: string | null;
  onActor: (v: string | null) => void;
  target: string | null;
  onTarget: (v: string | null) => void;
  question: string;
  onQuestion: (q: string) => void;
  magnitude: number;
  onMagnitude: (m: number) => void;
  year: number;
  onYear: (y: number) => void;
  busy: boolean;
  onRun: () => void;
}

function SlotSelect(props: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold bo-faint uppercase tracking-widest px-1 block mb-1">
        {props.label}
      </label>
      <select
        className="bo-field w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value || null)}
        disabled={props.disabled}
      >
        <option value="">Choose…</option>
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ScenarioControls(p: Props) {
  const info = p.catalog.find((c) => c.type === p.scenario);

  const grouped = useMemo(() => {
    const g = new Map<string, ScenarioInfo[]>();
    for (const c of p.catalog) {
      if (!c.available) continue;
      const list = g.get(c.domain) ?? [];
      list.push(c);
      g.set(c.domain, list);
    }
    return g;
  }, [p.catalog]);

  const required = (meaning: string | null) => !!meaning && !meaning.includes("(optional)");
  const canRun =
    p.mode === "ask"
      ? p.question.trim().length > 3
      : !!info && (!required(info.actor) || !!p.actor) && (!required(info.target) || !!p.target);

  const targetOptions =
    info?.target_kind === "alliance" ? ALLIANCES : info?.target_kind === "region" ? REGIONS : null;

  return (
    <div className="space-y-5">
      {/* Mode switch */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bo-card">
        {(
          [
            ["build", "Build scenario", SlidersHorizontal],
            ["ask", "Ask in plain English", Wand2],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            onClick={() => p.onModeChange(m)}
            disabled={p.busy}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
              p.mode === m ? "bg-indigo-500 text-white shadow" : "bo-sub hover:bg-indigo-500/10"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {p.mode === "build" ? (
        <>
          <div>
            <label className="text-[10px] font-bold bo-faint uppercase tracking-widest px-1 block mb-1">
              Scenario
            </label>
            <select
              className="bo-field w-full rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-indigo-500"
              value={p.scenario}
              onChange={(e) => p.onScenario(e.target.value)}
              disabled={p.busy}
            >
              {[...grouped.entries()].map(([domain, list]) => (
                <optgroup key={domain} label={DOMAIN_LABEL[domain as ScenarioInfo["domain"]] ?? domain}>
                  {list.map((c) => (
                    <option key={c.type} value={c.type}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {info && (
              <p className="mt-2 text-[11px] bo-faint flex gap-1.5 items-start px-1">
                <Info size={12} className="mt-0.5 shrink-0" />
                <span>
                  e.g. <em>{info.example}</em>
                </span>
              </p>
            )}
          </div>

          {info && (info.actor || info.target) && (
            <div className={`grid gap-3 ${info.actor && info.target ? "grid-cols-2" : "grid-cols-1"}`}>
              {info.actor && (
                <SearchableCombobox
                  label={info.actor}
                  value={p.actor}
                  onChange={(v) => p.onActor(v)}
                  profiles={p.profiles}
                  placeholder="Country…"
                  disabled={p.busy}
                />
              )}
              {info.target &&
                (targetOptions ? (
                  <SlotSelect
                    label={info.target}
                    value={p.target}
                    options={targetOptions}
                    onChange={p.onTarget}
                    disabled={p.busy}
                  />
                ) : info.target_kind === "bloc" ? (
                  <SlotSelect
                    label={info.target}
                    value={p.target}
                    options={BLOCS}
                    onChange={p.onTarget}
                    disabled={p.busy}
                  />
                ) : (
                  <SearchableCombobox
                    label={info.target}
                    value={p.target}
                    onChange={(v) => p.onTarget(v)}
                    profiles={p.profiles}
                    placeholder="Country…"
                    disabled={p.busy}
                  />
                ))}
            </div>
          )}
          {info && !info.actor && !info.target && (
            <p className="text-[11px] bo-faint px-1">This scenario looks at the whole graph; no country needed.</p>
          )}
        </>
      ) : (
        <div>
          <label className="text-[10px] font-bold bo-faint uppercase tracking-widest px-1 block mb-1">
            Your question
          </label>
          <textarea
            className="bo-field w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 resize-none"
            rows={3}
            maxLength={500}
            placeholder="What if Russia cuts gas to Germany?"
            value={p.question}
            onChange={(e) => p.onQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && canRun && !p.busy) {
                e.preventDefault();
                p.onRun();
              }
            }}
            disabled={p.busy}
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => p.onQuestion(q)}
                disabled={p.busy}
                className="text-[10px] px-2 py-1 rounded-full bo-card bo-sub hover:border-indigo-400 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] bo-faint px-1">
            Understood by OpenAI when a key is set, otherwise by the built-in rule parser. Numbers always come from the
            graph.
          </p>
        </div>
      )}

      {/* Magnitude + year */}
      <div className="grid grid-cols-2 gap-5">
        <div>
          <div className="flex justify-between items-center mb-1 px-1">
            <label className="text-[10px] font-bold bo-faint uppercase tracking-widest">Magnitude</label>
            <span className="text-xs font-mono text-indigo-500 font-bold">
              {p.magnitude.toFixed(1)}× · {magnitudeLabel(p.magnitude)}
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={p.magnitude}
            onChange={(e) => p.onMagnitude(parseFloat(e.target.value))}
            disabled={p.busy}
            className="w-full accent-indigo-500"
            aria-label="Magnitude"
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1 px-1">
            <label className="text-[10px] font-bold bo-faint uppercase tracking-widest">Data year</label>
          </div>
          <select
            className="bo-field w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            value={p.year}
            onChange={(e) => p.onYear(parseInt(e.target.value, 10))}
            disabled={p.busy}
            title="If the graph has no data for this year, the engine uses the nearest earlier year and says so."
          >
            {Array.from({ length: 8 }, (_, i) => 2025 - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={p.onRun}
        disabled={p.busy || !canRun}
        className={`w-full py-3.5 rounded-xl text-xs font-black tracking-widest uppercase flex items-center justify-center gap-3 transition-all ${
          p.busy
            ? "bg-slate-500/30 bo-faint cursor-wait"
            : !canRun
              ? "bg-indigo-500/20 text-indigo-400 cursor-not-allowed"
              : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_30px_rgba(99,102,241,0.3)]"
        }`}
      >
        {p.busy ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            Computing from graph…
          </>
        ) : (
          <>
            <Play size={14} fill="currentColor" /> Run simulation
          </>
        )}
      </button>
    </div>
  );
}
