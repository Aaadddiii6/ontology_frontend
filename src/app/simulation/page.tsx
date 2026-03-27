"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Activity, Clock, AlertTriangle, FileText, ChevronUp, ChevronDown } from "lucide-react";
import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import GlobeMap from "../../components/map/GlobeMap";
import { SearchableCombobox } from "../../components/ui/SearchableCombobox";
import DayNightBackground from "../../components/ui/DayNightBackground";
import { IntelligenceQueryModal } from "../../components/ui/IntelligenceQueryModal";
import { fetchSimulateScenarios } from "../../lib/api";
import useCountryData from "../../hooks/useCountryData";
import { runSimulationAction } from "../actions/simulate";

export default function SimulationPage() {
  const { profiles, profileMap, loading: loadingProfiles } = useCountryData();
  
  const [countryA, setCountryA] = useState<string | null>(null);
  const [countryB, setCountryB] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string>("sanctions");
  const [magnitude, setMagnitude] = useState<number>(1.0);
  const [year, setYear] = useState<number>(2024);
  
  const [scenarios, setScenarios] = useState<{ id: string, name: string }[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  
  // Mapping of country -> severity from results
  const [simulationResults, setSimulationResults] = useState<Record<string, "critical" | "high" | "medium" | "low">>({});
  
  const [isParamsCollapsed, setIsParamsCollapsed] = useState(false);

  useEffect(() => {
    fetchSimulateScenarios().then(setScenarios);
  }, []);

  const handleRunSimulation = async () => {
    if (!countryA || !countryB || !scenario) return;
    
    setIsSimulating(true);
    setResults(null);
    setSimulationResults({});
    
    try {
      const result = await runSimulationAction({
        countryA,
        countryB,
        scenario,
        magnitude,
        year
      });
      
      setResults(result);
      
      const severities: Record<string, "critical" | "high" | "medium" | "low"> = {};
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

      {/* Main Split Layout */}
      <div className="flex-1 flex pl-[72px] mt-[64px] relative z-10 h-[calc(100vh-64px)] w-full overflow-hidden">
        
        {/* Left Side: Map 60% */}
        <div className="w-[60%] h-full relative cursor-grab">
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
        </div>

        {/* Right Side: Control Panel & Results 40% */}
        <div className="w-[40%] h-full bg-slate-900/60 glass-morphism border-l border-white/10 flex flex-col relative z-20 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
          
          {/* Controls Section */}
          <div className={`p-8 border-b border-white/10 shrink-0 ${isParamsCollapsed ? "pb-4" : ""}`}>
            <div 
              className="flex items-center justify-between mb-6 cursor-pointer group"
              onClick={() => setIsParamsCollapsed(!isParamsCollapsed)}
            >
              <h2 className="text-[11px] font-black tracking-[0.2em] text-indigo-400 uppercase flex items-center gap-2">
                <Activity size={14} /> Scenario Parameters
              </h2>
              <div className="text-slate-500 group-hover:text-indigo-400 transition-colors bg-white/5 rounded p-1">
                {isParamsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>

            <AnimatePresence>
              {!isParamsCollapsed && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="space-y-6 overflow-hidden"
                >
              <div className="grid grid-cols-2 gap-4">
                <SearchableCombobox
                  label="Primary Actor"
                  value={countryA}
                  onChange={setCountryA}
                  profiles={profiles}
                  placeholder="Initiator..."
                  disabled={isSimulating}
                />
                <SearchableCombobox
                  label="Target Actor"
                  value={countryB}
                  onChange={setCountryB}
                  profiles={profiles}
                  placeholder="Target..."
                  disabled={isSimulating}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 block mb-1">
                  Scenario Blueprint
                </label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  disabled={isSimulating}
                >
                  {scenarios.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>)}
                </select>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-center mb-2 px-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Magnitude
                    </label>
                    <span className="text-xs font-mono text-indigo-400 font-bold">{magnitude.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5" max="2.0" step="0.1"
                    value={magnitude}
                    onChange={(e) => setMagnitude(parseFloat(e.target.value))}
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
                    <span className="text-xs font-mono text-indigo-400 font-bold">{year}</span>
                  </div>
                  <input
                    type="range"
                    min="2024" max="2030" step="1"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    disabled={isSimulating}
                    className="w-full h-1.5 bg-white/10 appearance-none rounded-full accent-indigo-500"
                  />
                </div>
              </div>

              <div className="relative">
                <motion.button
                  whileHover={!isSimulating && countryA && countryB ? { scale: 1.02 } : {}}
                  whileTap={!isSimulating && countryA && countryB ? { scale: 0.98 } : {}}
                  onClick={handleRunSimulation}
                  disabled={isSimulating || !countryA || !countryB}
                  className={`w-full py-4 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                    isSimulating 
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5" 
                      : !countryA || !countryB
                        ? "bg-indigo-500/20 text-indigo-500/50 cursor-not-allowed"
                        : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] border border-indigo-400/30"
                  }`}
                >
                  {isSimulating ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-transparent animate-spin z-10" />
                      <span className="z-10 relative">Computing Scenario...</span>
                      <motion.div 
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
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

          {/* Results Section */}
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
                  <p className="text-sm font-medium">Awaiting simulation parameters. Select global actors and execute initialization sequence to generate projections.</p>
                </motion.div>
              )}

              {results && !isSimulating && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  {/* ... same animated UI rendering */}
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
                      {results.headline || "Simulation Activated"}
                    </h3>
                  </div>

                  {results.parsed && (
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl mb-6">
                      <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">Intent Parsed</span>
                      <p className="text-sm text-indigo-200 mt-1 font-medium font-mono text-xs">
                        {typeof results.parsed === 'object' ? JSON.stringify(results.parsed, null, 2) : results.parsed}
                      </p>
                    </div>
                  )}

                  <div className="prose prose-invert prose-sm">
                    <p className="text-slate-300 leading-relaxed font-medium">
                      {results.summary}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center">
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                          <circle 
                            cx="32" cy="32" r="28" fill="none" stroke="#6366f1" strokeWidth="6"
                            strokeDasharray="175"
                            strokeDashoffset={175 - (175 * results.confidenceScore) / 100}
                            style={{ transition: 'stroke-dashoffset 1.5s ease 0.5s' }}
                          />
                        </svg>
                        <span className="font-mono font-bold text-lg">{results.confidenceScore}%</span>
                      </div>
                      <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase mt-3">Confidence Index</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase border-b border-white/10 pb-2 mb-4">
                      Affected Actors (Severity Scale)
                    </h4>
                    <div className="space-y-4">
                      {results.affectedCountries?.map((c: any) => (
                        <div key={c.country} className="flex flex-col p-3 bg-white/5 rounded-lg border border-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] ${
                                c.severity === 'critical' ? 'bg-rose-500 text-rose-500' :
                                c.severity === 'high' ? 'bg-orange-500 text-orange-500' :
                                c.severity === 'medium' ? 'bg-amber-500 text-amber-500' :
                                'bg-yellow-500 text-yellow-500'
                              }`} />
                              <span className="text-sm font-bold text-white">{c.country}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Direction Arrows */}
                              {c.direction === "Increasing" ? (
                                <span className="text-rose-400 text-[10px] font-black">▲</span>
                              ) : c.direction === "Decreasing" ? (
                                <span className="text-emerald-400 text-[10px] font-black">▼</span>
                              ) : null}
                              <span className={`text-xs font-mono font-bold ${typeof c.delta === "number" && c.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {c.delta > 0 ? '+' : ''}{c.delta}
                              </span>
                            </div>
                          </div>
                          {c.currentScore !== undefined && (
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                              <span>BASE SCORE: {c.currentScore.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase border-b border-white/10 pb-2 mb-4">
                      Timeline Cascade
                    </h4>
                    <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[5px] before:w-[2px] before:bg-white/10">
                      {results.cascadeEffects?.map((effect: any, i: number) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + i * 0.2 }}
                          key={i} className="relative"
                        >
                          <div className="absolute -left-[23px] top-1.5 w-3 h-3 bg-indigo-500 rounded-full border-4 border-slate-900" />
                          <span className="text-[10px] font-black text-indigo-400 tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{effect.year}</span>
                          <p className="text-sm text-slate-300 mt-2 font-medium leading-relaxed">{effect.event}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {results.computationTime && (
                    <div className="flex justify-end mt-4">
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono border border-slate-700/50 bg-slate-900 px-3 py-1.5 rounded-full shadow-inner">
                        <Clock size={10} />
                        <span>COMPUTATION TIME: {typeof results.computationTime === 'number' ? `${results.computationTime}s` : results.computationTime}</span>
                      </div>
                    </div>
                  )}
                  
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}

