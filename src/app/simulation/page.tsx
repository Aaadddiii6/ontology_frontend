"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import GlobeMap from "@/components/map/GlobeMap";
import DayNightBackground from "@/components/ui/DayNightBackground";
import { IntelligenceQueryModal } from "@/components/ui/IntelligenceQueryModal";
import ScenarioControls, { type Mode } from "@/components/simulation/ScenarioControls";
import SimulationResults from "@/components/simulation/SimulationResults";
import { fetchScenarioCatalog, type ScenarioInfo } from "@/lib/api";
import useCountryData from "@/hooks/useCountryData";
import {
  runQuerySimulationAction,
  runSimulationAction,
  type SimulationError,
  type SimulationUI,
} from "@/app/actions/simulate";

type Severity = "critical" | "high" | "medium" | "low";

export default function SimulationPage() {
  const { profiles, profileMap } = useCountryData();

  const [mode, setMode] = useState<Mode>("build");
  const [catalog, setCatalog] = useState<ScenarioInfo[]>([]);
  const [scenario, setScenario] = useState("sanctions");
  const [actor, setActor] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [magnitude, setMagnitude] = useState(1.0);
  const [year, setYear] = useState(2024);

  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [result, setResult] = useState<SimulationUI | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severities, setSeverities] = useState<Record<string, Severity>>({});

  useEffect(() => {
    fetchScenarioCatalog().then(setCatalog);
    // Opened from a country panel ("Simulate a scenario with X")
    const fromPanel = new URLSearchParams(window.location.search).get("actor");
    if (fromPanel) setActor(fromPanel);
  }, []);

  // A target that made sense for the previous scenario (e.g. "NATO") is
  // nonsense for the next one, so reset slots when the slot meaning changes.
  const handleScenario = (s: string) => {
    const prev = catalog.find((c) => c.type === scenario);
    const next = catalog.find((c) => c.type === s);
    if (!next?.actor) setActor(null);
    if (!next?.target || prev?.target_kind !== next?.target_kind) setTarget(null);
    setScenario(s);
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setSeverities({});
    const res: SimulationUI | SimulationError =
      mode === "ask"
        ? await runQuerySimulationAction({ query: question, magnitude, year })
        : await runSimulationAction({ scenario, actor, target, magnitude, year });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res);
    const sev: Record<string, Severity> = {};
    for (const c of res.affectedCountries) sev[c.country] = c.severity;
    setSeverities(sev);
  };

  return (
    <main className="flex flex-col h-screen bg-transparent overflow-hidden relative selection:bg-indigo-500/30">
      <DayNightBackground />
      <Navbar activeModule="simulator" onModuleChange={() => {}} />
      <Sidebar activeModule="simulator" />
      <IntelligenceQueryModal />

      <div className="flex-1 flex pl-[72px] mt-[64px] relative z-10 h-[calc(100vh-64px)] w-full overflow-hidden">
        {/* Globe: affected countries are coloured by severity */}
        <motion.div
          animate={{ width: collapsed ? "100%" : "52%" }}
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
              simulationResults={severities}
            />
          </div>
          {Object.keys(severities).length > 0 && (
            <div className="absolute bottom-6 left-6 bo-card glass-morphism rounded-xl px-3 py-2 flex gap-3 text-[10px] font-bold uppercase tracking-wider">
              {(["critical", "high", "medium", "low"] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5 bo-sub">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      s === "critical" ? "bg-rose-600" : s === "high" ? "bg-orange-500" : s === "medium" ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                  />
                  {s}
                </span>
              ))}
            </div>
          )}
        </motion.div>

        {/* Control panel + results */}
        <motion.div
          animate={{ width: collapsed ? "0%" : "48%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="h-full glass-morphism border-l border-white/10 flex flex-col relative z-20 overflow-visible"
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-12 bg-indigo-500 hover:bg-indigo-400 text-white rounded-l-xl flex items-center justify-center shadow-lg z-30"
            aria-label={collapsed ? "Show panel" : "Hide panel"}
          >
            {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col h-full w-full overflow-y-auto custom-scrollbar"
              >
                <div className="p-6 border-b border-white/10">
                  <h2 className="text-[11px] font-black tracking-[0.2em] text-indigo-500 uppercase flex items-center gap-2 mb-4">
                    <Activity size={14} /> Scenario simulator
                  </h2>
                  <ScenarioControls
                    mode={mode}
                    onModeChange={setMode}
                    catalog={catalog}
                    profiles={profiles}
                    scenario={scenario}
                    onScenario={handleScenario}
                    actor={actor}
                    onActor={setActor}
                    target={target}
                    onTarget={setTarget}
                    question={question}
                    onQuestion={setQuestion}
                    magnitude={magnitude}
                    onMagnitude={setMagnitude}
                    year={year}
                    onYear={setYear}
                    busy={busy}
                    onRun={run}
                  />
                  {catalog.length === 0 && (
                    <p className="mt-3 text-[11px] text-rose-500">
                      Could not load scenarios from the backend. Is it running on port 8000?
                    </p>
                  )}
                </div>

                <div className="p-6 flex-1">
                  {error && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 flex gap-2">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <div>{error}</div>
                    </div>
                  )}
                  {!result && !error && !busy && (
                    <div className="h-full flex flex-col items-center justify-center text-center bo-faint py-16">
                      <Activity size={40} className="opacity-30 mb-3" />
                      <p className="text-sm max-w-xs">
                        Pick a scenario and countries, or ask a question. Results show exactly which scores move,
                        by how much, and which graph data produced them.
                      </p>
                    </div>
                  )}
                  {result && <SimulationResults r={result} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  );
}
