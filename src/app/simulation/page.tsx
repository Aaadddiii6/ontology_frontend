"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import GlobeMap from "../../components/map/GlobeMap";
import { SearchableCombobox } from "../../components/ui/SearchableCombobox";
import DayNightBackground from "../../components/ui/DayNightBackground";
import { IntelligenceQueryModal } from "../../components/ui/IntelligenceQueryModal";
import { fetchSimulateScenarios } from "../../lib/api";
import useCountryData from "../../hooks/useCountryData";
import { runSimulationAction } from "../actions/simulate";

// ─── Scenarios that operate on a SINGLE primary actor (no target required) ──
// These correspond to backend ScenarioType values that only need `actor` OR `target`.
const SINGLE_COUNTRY_SCENARIOS = new Set([
  "state_fragility", // assessment — no actor/target
  "energy_price_shock", // global shock — actor optional
  "global_pandemic", // global — target = origin country
  "gdp_shock", // actor/target = same country
  "debt_crisis", // actor/target = same country
  "defense_spending_surge", // actor only
  "international_isolation", // target only
  "regime_change", // target only
  "resource_scarcity", // target only
  "climate_disaster", // target only
  "supply_chain_collapse", // target only
  "regional_destabilization", // target or region name
  "energy_transition", // actor only
  "power_vacuum", // actor defaults to US
  "nuclear_threat", // actor only (target optional)
  "cyber_attack", // target only (actor optional)
  "diplomatic_breakdown", // needs actor AND target — keep as two BUT actor can = target
]);

// Scenarios where actor = target makes sense (self-destabilisation / internal events)
const TARGET_OPTIONAL_SCENARIOS = new Set([
  "state_fragility",
  "energy_price_shock",
  "global_pandemic",
  "gdp_shock",
  "debt_crisis",
  "defense_spending_surge",
  "international_isolation",
  "regime_change",
  "resource_scarcity",
  "climate_disaster",
  "supply_chain_collapse",
  "regional_destabilization",
  "energy_transition",
  "power_vacuum",
  "nuclear_threat",
  "cyber_attack",
]);

export default function SimulationPage() {
  const { profiles, profileMap } = useCountryData();

  const [countryA, setCountryA] = useState<string | null>(null);
  const [countryB, setCountryB] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string>("sanctions");
  const [magnitude, setMagnitude] = useState<number>(1.0);
  const [year, setYear] = useState<number>(2024);

  const [scenarios, setScenarios] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  const [simulationResults, setSimulationResults] = useState<
    Record<string, "critical" | "high" | "medium" | "low">
  >({});

  const isSingleCountry = TARGET_OPTIONAL_SCENARIOS.has(scenario);
  // Whether the Run button should be enabled
  const canRun = !!countryA && (isSingleCountry || !!countryB);

  useEffect(() => {
    fetchSimulateScenarios().then(setScenarios);
  }, []);

  // When switching to a single-country scenario, clear countryB
  useEffect(() => {
    if (isSingleCountry) setCountryB(null);
  }, [isSingleCountry]);

  const handleRunSimulation = async () => {
    if (!canRun) return;

    setIsSimulating(true);
    setResults(null);
    setSimulationResults({});

    try {
      const result = await runSimulationAction({
        countryA: countryA!,
        // For single-country scenarios pass the same country as target so
        // the backend has something to work with.
        countryB: countryB || countryA!,
        scenario,
        magnitude,
        year,
      });

      setResults(result);

      const severities: Record<string, "critical" | "high" | "medium" | "low"> =
        {};
      if (result.affectedCountries) {
        result.affectedCountries.forEach((c: any) => {
          severities[c.country] = c.severity || "medium";
        });
      }
      setSimulationResults(severities);
    } catch (err) {
      console.error(err);
      alert("Simulation failed. Check LLM configuration.");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <main className="flex flex-col h-screen bg-transparent overflow-hidden relative selection:bg-indigo-500/30">
      <DayNightBackground />
      <Navbar activeModule="simulator" onModuleChange={() => {}} />
      <Sidebar activeModule="simulator" />
      <IntelligenceQueryModal />

      <div className="flex-1 flex pl-[72px] mt-[64px] relative z-10 h-[calc(100vh-64px)] w-full overflow-hidden">
        {/* Left Side: Globe */}
        <motion.div
          animate={{ width: isCollapsed ? "100%" : "60%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="h-full relative cursor-grab"
        >
          <div className="absolute inset-0 z-0">
            <GlobeMap
              profileMap={profileMap}
              activeModule="overview"
              onCountryHover={() => {}}
              onCountryClick={() => {}}
              visible={true}
              showRelations={false}
              simulationResults={simulationResults}
            />
          </div>
        </motion.div>

        {/* Right Side: Control Panel & Results */}
        <motion.div
          animate={{ width: isCollapsed ? "0%" : "40%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="h-full bg-slate-900/60 glass-morphism border-l border-white/10 flex flex-col relative z-20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] overflow-visible"
        >
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-12 bg-indigo-500 hover:bg-indigo-400 text-white rounded-l-xl flex items-center justify-center shadow-lg z-30 transition-colors border border-indigo-400/30 border-r-0"
          >
            {isCollapsed ? (
              <ChevronLeft size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>

          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col h-full w-full overflow-hidden"
              >
                {/* Controls */}
                <div className="p-8 border-b border-white/10 shrink-0">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-[11px] font-black tracking-[0.2em] text-indigo-400 uppercase flex items-center gap-2">
                      <Activity size={14} /> Scenario Parameters
                    </h2>
                    <button
                      onClick={() =>
                        setIsControlsCollapsed(!isControlsCollapsed)
                      }
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-indigo-400"
                    >
                      {isControlsCollapsed ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronUp size={16} />
                      )}
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {!isControlsCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-6">
                          {/* Country selectors */}
                          <div
                            className={`grid gap-4 ${isSingleCountry ? "grid-cols-1" : "grid-cols-2"}`}
                          >
                            <SearchableCombobox
                              label={
                                isSingleCountry
                                  ? "Target Country"
                                  : "Primary Actor"
                              }
                              value={countryA}
                              onChange={setCountryA}
                              profiles={profiles}
                              placeholder={
                                isSingleCountry
                                  ? "Affected country..."
                                  : "Initiator..."
                              }
                              disabled={isSimulating}
                            />
                            {!isSingleCountry && (
                              <SearchableCombobox
                                label="Target Actor"
                                value={countryB}
                                onChange={setCountryB}
                                profiles={profiles}
                                placeholder="Target..."
                                disabled={isSimulating}
                              />
                            )}
                          </div>

                          {/* Single-country hint */}
                          {isSingleCountry && (
                            <p className="text-[10px] text-indigo-400/70 font-bold uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                              ℹ This scenario affects a single country — no
                              secondary actor required.
                            </p>
                          )}

                          {/* Scenario selector */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 block mb-1">
                              Scenario Blueprint
                            </label>
                            <select
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none text-white"
                              value={scenario}
                              onChange={(e) => setScenario(e.target.value)}
                              disabled={isSimulating}
                            >
                              {scenarios.map((s) => (
                                <option
                                  key={s.id}
                                  value={s.id}
                                  className="bg-slate-900"
                                >
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Sliders */}
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <div className="flex justify-between items-center mb-2 px-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Magnitude
                                </label>
                                <span className="text-xs font-mono text-indigo-400 font-bold">
                                  {magnitude.toFixed(1)}
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={magnitude}
                                onChange={(e) =>
                                  setMagnitude(parseFloat(e.target.value))
                                }
                                disabled={isSimulating}
                                className="w-full accent-indigo-500"
                              />
                              <div className="flex justify-between mt-1 text-[9px] text-slate-500 uppercase font-bold px-1">
                                <span>Partial</span>
                                <span>Extreme</span>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-2 px-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  Target Year
                                </label>
                                <span className="text-xs font-mono text-indigo-400 font-bold">
                                  {year}
                                </span>
                              </div>
                              <input
                                type="range"
                                min="2024"
                                max="2030"
                                step="1"
                                value={year}
                                onChange={(e) =>
                                  setYear(parseInt(e.target.value))
                                }
                                disabled={isSimulating}
                                className="w-full accent-indigo-500"
                              />
                            </div>
                          </div>

                          {/* Run button */}
                          <motion.button
                            whileHover={
                              !isSimulating && canRun ? { scale: 1.02 } : {}
                            }
                            whileTap={
                              !isSimulating && canRun ? { scale: 0.98 } : {}
                            }
                            onClick={handleRunSimulation}
                            disabled={isSimulating || !canRun}
                            className={`w-full py-4 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                              isSimulating
                                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                                : !canRun
                                  ? "bg-indigo-500/20 text-indigo-500/50 cursor-not-allowed"
                                  : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] border border-indigo-400/30"
                            }`}
                          >
                            {isSimulating ? (
                              <>
                                <div className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-transparent animate-spin z-10" />
                                <span className="z-10 relative">
                                  Computing Scenario...
                                </span>
                                <motion.div
                                  initial={{ x: "-100%" }}
                                  animate={{ x: "100%" }}
                                  transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "linear",
                                  }}
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent z-0"
                                />
                              </>
                            ) : (
                              <>
                                <Play size={14} fill="currentColor" />
                                Initialize Engine
                              </>
                            )}
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
                  <AnimatePresence mode="wait">
                    {!results && !isSimulating && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-8 text-center"
                      >
                        <Activity size={48} className="opacity-20 mb-4" />
                        <p className="text-sm font-medium">
                          Awaiting simulation parameters. Select a scenario and
                          execute the initialization sequence to generate
                          projections.
                        </p>
                      </motion.div>
                    )}

                    {results && !isSimulating && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                      >
                        {/* Headline */}
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="bg-rose-500/20 text-rose-400 p-1.5 rounded-lg border border-rose-500/20">
                              <AlertTriangle size={16} />
                            </div>
                            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                              AI Event Projection
                            </span>
                          </div>
                          <h3 className="text-2xl font-black text-white leading-tight mt-3">
                            {results.headline}
                          </h3>
                        </div>

                        {/* Summary */}
                        <p className="text-slate-300 leading-relaxed font-medium text-sm">
                          {results.summary}
                        </p>

                        {/* Confidence */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center">
                            <div className="relative w-16 h-16 flex items-center justify-center">
                              <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="28"
                                  fill="none"
                                  stroke="rgba(255,255,255,0.1)"
                                  strokeWidth="6"
                                />
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="28"
                                  fill="none"
                                  stroke="#6366f1"
                                  strokeWidth="6"
                                  strokeDasharray="175"
                                  strokeDashoffset={
                                    175 -
                                    (175 *
                                      (results.confidenceScore ??
                                        results.confidence ??
                                        0)) /
                                      100
                                  }
                                  style={{
                                    transition:
                                      "stroke-dashoffset 1.5s ease 0.5s",
                                  }}
                                />
                              </svg>
                              <span className="font-mono font-bold text-lg text-white">
                                {results.confidenceScore ??
                                  Math.round((results.confidence ?? 0) * 100)}
                                %
                              </span>
                            </div>
                            <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase mt-3">
                              Confidence Index
                            </span>
                          </div>
                          {results.computationTime && (
                            <div className="bg-white/5 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center">
                              <span className="font-mono font-bold text-lg text-white">
                                {results.computationTime}
                              </span>
                              <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase mt-3">
                                Compute Time
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Affected Countries */}
                        {results.affectedCountries?.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase border-b border-white/10 pb-2 mb-4 flex justify-between items-center">
                              <span>
                                Affected Actors (
                                {results.affectedCountries.length} Strategic
                                Projections)
                              </span>
                              <span className="text-[9px] opacity-50">
                                Impact Breakdown
                              </span>
                            </h4>
                            <div className="space-y-3">
                              {results.affectedCountries.map((c: any) => {
                                // delta may come from score_deltas array (backend) or direct delta (LLM fallback)
                                const deltaVal =
                                  typeof c.delta === "number"
                                    ? c.delta
                                    : Array.isArray(c.score_deltas) &&
                                        c.score_deltas.length > 0
                                      ? c.score_deltas.reduce(
                                          (s: number, d: any) =>
                                            s + (d.delta ?? 0),
                                          0,
                                        )
                                      : null;

                                return (
                                  <div
                                    key={c.country}
                                    className="flex flex-col gap-2 p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div
                                          className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] flex-shrink-0 ${
                                            c.severity === "critical"
                                              ? "bg-rose-600 text-rose-600"
                                              : c.severity === "high"
                                                ? "bg-rose-400 text-rose-400"
                                                : c.severity === "medium"
                                                  ? "bg-amber-500 text-amber-500"
                                                  : c.severity === "low"
                                                    ? "bg-emerald-400 text-emerald-400"
                                                    : "bg-slate-500 text-slate-500"
                                          }`}
                                        />
                                        <div>
                                          <span className="text-sm font-bold text-white">
                                            {c.country}
                                          </span>
                                          {c.impact_type && (
                                            <span
                                              className={`ml-2 text-[9px] uppercase tracking-wider font-bold ${
                                                c.impact_type === "direct"
                                                  ? "text-indigo-400"
                                                  : c.impact_type === "cascade"
                                                    ? "text-purple-400"
                                                    : "text-slate-500"
                                              }`}
                                            >
                                              {c.impact_type}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {deltaVal !== null && (
                                        <span
                                          className={`text-xs font-mono font-bold ${
                                            deltaVal > 0.1
                                              ? "text-emerald-400"
                                              : deltaVal < -0.1
                                                ? "text-rose-400"
                                                : "text-amber-400"
                                          }`}
                                        >
                                          {deltaVal > 0 ? "+" : ""}
                                          {typeof deltaVal === "number"
                                            ? deltaVal.toFixed(2)
                                            : deltaVal}
                                        </span>
                                      )}
                                    </div>
                                    {/* Impact Detail */}
                                    {(c.impact_detail || c.summary) && (
                                      <p className="text-[11px] text-slate-400 leading-relaxed pl-5 italic">
                                        {c.impact_detail || c.summary}
                                      </p>
                                    )}

                                    {/* Score Deltas Breakdown */}
                                    {Array.isArray(c.score_deltas) &&
                                      c.score_deltas.length > 0 && (
                                        <div className="pl-5 flex flex-wrap gap-2 mt-1">
                                          {c.score_deltas.map(
                                            (sd: any, idx: number) => (
                                              <div
                                                key={idx}
                                                className="bg-white/5 border border-white/10 rounded-md px-2 py-0.5 flex items-center gap-1.5"
                                              >
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                                                  {sd.metric?.replace(
                                                    /_/g,
                                                    " ",
                                                  )}
                                                </span>
                                                <span
                                                  className={`text-[9px] font-mono font-bold ${
                                                    sd.delta > 0.01
                                                      ? "text-emerald-400"
                                                      : sd.delta < -0.01
                                                        ? "text-rose-400"
                                                        : "text-amber-400"
                                                  }`}
                                                >
                                                  {sd.delta > 0 ? "+" : ""}
                                                  {sd.delta.toFixed(3)}
                                                </span>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Cascade Effects */}
                        {results.cascadeEffects?.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase border-b border-white/10 pb-2 mb-4">
                              Timeline Cascade
                            </h4>
                            <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[5px] before:w-[2px] before:bg-white/10">
                              {results.cascadeEffects.map(
                                (effect: any, i: number) => (
                                  <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + i * 0.2 }}
                                    key={i}
                                    className="relative"
                                  >
                                    <div className="absolute -left-[23px] top-1.5 w-3 h-3 bg-indigo-500 rounded-full border-4 border-slate-900" />
                                    {/* Backend returns {mechanism, affected, description} OR LLM returns {year, event} */}
                                    {effect.year ? (
                                      <span className="text-[10px] font-black text-indigo-400 tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                        {effect.year}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-black text-indigo-400 tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                        {effect.mechanism ||
                                          effect.affected ||
                                          "Cascade"}
                                      </span>
                                    )}
                                    <p className="text-sm text-slate-300 mt-2 font-medium leading-relaxed">
                                      {effect.event || effect.description || ""}
                                    </p>
                                  </motion.div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  );
}
