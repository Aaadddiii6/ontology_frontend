"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Cpu, Command, ArrowRight } from "lucide-react";
import { queryIntelligenceAction } from "../../app/actions/simulate";

export const IntelligenceQueryModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<any | null>(null);

  const handleQuery = async () => {
    if (!query.trim() || isLoading) return;
    setIsLoading(true);
    setResponse(null);

    try {
      const res = await queryIntelligenceAction(query);
      setResponse(res);
    } catch (error) {
      console.error(error);
      setResponse({ error: "Failed to connect to Neural Engine Layer." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-8 right-8 z-[200] px-6 py-3 rounded-full bg-slate-900 border border-indigo-500/30 text-indigo-400 font-black tracking-widest text-[11px] uppercase shadow-[0_0_30px_rgba(99,102,241,0.2)] hover:border-indigo-400 hover:text-white hover:bg-indigo-500 transition-all flex items-center gap-3 group"
      >
        <div className="relative flex items-center justify-center">
          <Cpu size={16} className="relative z-10" />
          <div className="absolute inset-0 bg-indigo-500 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        Query Intelligence
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30">
                    <Command size={18} className="text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white tracking-widest uppercase">Intelligence Query</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Neural Pattern Recognition</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col gap-6">
                {!response && !isLoading && (
                  <div className="p-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-center flex flex-col items-center gap-3">
                    <Search size={24} className="text-indigo-400 mb-2" />
                    <p className="text-sm text-indigo-300 font-medium max-w-sm">
                      Ask anything about geopolitical data, military strengths, or economic dependencies.
                    </p>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-4 flex flex-col gap-1 items-center font-bold">
                      <span>The AI will:</span>
                      <span>1. Understand your question</span>
                      <span>2. Query the right endpoints</span>
                      <span>3. Return real data-backed answers</span>
                    </div>
                  </div>
                )}

                {isLoading && (
                  <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-4">
                    <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    <p className="text-xs font-bold tracking-widest uppercase animate-pulse">Routing query to logical endpoints...</p>
                  </div>
                )}

                {response && !isLoading && (
                  <div className="flex flex-col gap-4">
                    {response.error ? (
                      <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-medium text-center">
                        {response.error}
                      </div>
                    ) : (
                      <>
                        <div className="p-4 bg-slate-950 border border-white/5 rounded-xl">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">System Routing</h4>
                          <div className="flex flex-wrap gap-2">
                            {response.endpoints?.map((ep: string) => (
                              <span key={ep} className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                                GET {ep}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl shadow-inner">
                          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Synthesized Intelligence</h4>
                          <p className="text-sm text-slate-200 leading-relaxed font-medium">
                            {response.synthesized_answer || response.answer_template}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Input Footer */}
              <div className="p-4 bg-slate-950 border-t border-white/10 shrink-0">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleQuery();
                    }}
                    placeholder="Enter query parameters..."
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                    disabled={isLoading}
                    autoFocus
                  />
                  <button
                    onClick={handleQuery}
                    disabled={!query.trim() || isLoading}
                    className="absolute right-2 p-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-50 disabled:hover:bg-indigo-500 transition-colors"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
