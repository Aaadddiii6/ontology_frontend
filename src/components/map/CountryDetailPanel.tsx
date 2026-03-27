import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { CountryProfile, ActiveModule } from "../../types";
import {
  fetchCompositeProfile,
  fetchEconomyProfile,
  fetchEconomyGDP,
  fetchEconomyPartners,
  fetchClimateProfile,
  fetchClimateHazards,
  fetchGeopoliticsProfile,
  fetchDefenseProfile,
  fetchDefenseConflicts,
  MODULE_CONFIGS,
} from "../../lib/api";

interface CountryDetailPanelProps {
  country: string | null;
  profile: CountryProfile | null;
  onClose: () => void;
  activeModule: ActiveModule;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtUSD(v: number | null | undefined): string | null {
  if (v == null || isNaN(Number(v))) return null;
  const n = Number(v);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n > 0) return `$${n.toLocaleString()}`;
  return null;
}

function fmtPct(v: number | null | undefined, digits = 1): string | null {
  if (v == null || isNaN(Number(v))) return null;
  return `${(Number(v) * 100).toFixed(digits)}%`;
}

function riskLabel(v: number | null | undefined): string | null {
  if (v == null) return null;
  if (v > 0.75) return "Critical";
  if (v > 0.5) return "High";
  if (v > 0.25) return "Moderate";
  return "Low";
}

function fmtDefenseBudget(
  spendingMillions: number | null | undefined,
  burdenRatio: number | null | undefined,
): string | null {
  if (spendingMillions != null && Number(spendingMillions) > 0)
    return fmtUSD(Number(spendingMillions) * 1e6);
  if (burdenRatio != null && Number(burdenRatio) > 0)
    return `${(Number(burdenRatio) * 100).toFixed(1)}% GDP`;
  return "Data not available";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TabButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  accentColor: string;
}> = ({ label, active, onClick, accentColor }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all duration-200 ${
      active
        ? "border-current opacity-100"
        : "border-transparent opacity-40 hover:opacity-70"
    }`}
    style={{ color: active ? accentColor : "inherit" }}
  >
    {label}
  </motion.button>
);

const Sparkline: React.FC<{ data: any[]; dataKey: string; color: string }> = ({
  data,
  dataKey,
  color,
}) => (
  <div className="h-[60px] w-full mt-2 relative min-h-[60px] min-w-0">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <YAxis hide domain={["auto", "auto"]} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const DetailStat: React.FC<{
  label: string;
  value: React.ReactNode;
  description?: string;
}> = ({ label, value, description }) => (
  <div
    className="py-3 border-b border-gray-100 last:border-0 pl-3 border-l-2"
    style={{ borderLeftColor: "rgba(99, 102, 241, 0.4)" }}
  >
    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">
      {label}
    </div>
    <div className="text-sm font-semibold text-gray-800 mt-0.5 font-mono">
      {value ? (
        typeof value === "string" || typeof value === "number" ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )
      ) : (
        <span className="text-gray-300 italic">Data not available</span>
      )}
    </div>
    {description && (
      <div className="text-[10px] text-gray-400 mt-0.5">{description}</div>
    )}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const CountryDetailPanel: React.FC<CountryDetailPanelProps> = ({
  country,
  profile,
  onClose,
  activeModule,
}) => {
  const [currentTab, setCurrentTab] = useState<ActiveModule>(activeModule);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    composite: any;
    economy: any;
    climate: any;
    geopolitics: any;
    defense: any;
    conflicts: any;
  } | null>(null);

  useEffect(() => {
    setCurrentTab(activeModule);
  }, [activeModule]);

  useEffect(() => {
    if (!country) return;
    let isMounted = true;
    setLoading(true);

    Promise.all([
      fetchCompositeProfile(country),
      fetchEconomyProfile(country),
      fetchEconomyGDP(country),
      fetchEconomyPartners(country),
      fetchClimateProfile(country),
      fetchClimateHazards(country),
      fetchGeopoliticsProfile(country),
      fetchDefenseProfile(country),
      fetchDefenseConflicts(country),
    ]).then(
      ([
        composite,
        economy,
        economyGDP,
        economyPartners,
        climate,
        climateHazards,
        geopolitics,
        defense,
        conflicts,
      ]) => {
        if (isMounted) {
          setData({
            composite,
            economy: {
              ...economy,
              gdp_history: economyGDP?.history || [],
              top_partners:
                economyPartners?.dependencies?.map((d: any) => d.partner) || [],
            },
            climate: {
              ...climate,
              top_hazards:
                climateHazards?.hazards?.map((h: any) => h.type) || [],
            },
            geopolitics,
            defense,
            conflicts,
          });
          setLoading(false);
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, [country]);

  const moduleConfig = MODULE_CONFIGS[currentTab] || MODULE_CONFIGS.overview;
  if (!profile || !country) return null;

  const comp = data?.composite;
  const econ = data?.economy;
  const clim = data?.climate;
  const geo = data?.geopolitics;
  const def = data?.defense;
  const conf = data?.conflicts;

  const gdpDisplay = fmtUSD(econ?.gdp_usd ?? comp?.gdp_usd) ?? "N/A";
  const defBudget =
    fmtDefenseBudget(
      def?.spending_2023 ?? def?.spending_usd_millions,
      profile?.defense_burden,
    ) ?? "N/A";
  const topPartners: string[] = econ?.top_partners?.slice(0, 5) || [];
  const topHazards: string[] = clim?.top_hazards || [];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[240]"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: 340 }}
        animate={{ x: 0 }}
        exit={{ x: 340 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 bottom-0 w-[340px] bg-gradient-to-br from-slate-900/95 to-slate-800/90 backdrop-blur-2xl border-l border-white/8 z-[250] shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col text-white"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/10 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
              {country}
            </h2>
            <p className="text-[9px] font-black tracking-[0.25em] text-slate-400 uppercase mt-1">
              {profile.region || "Analysis Node"}
            </p>
          </div>
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400"
          >
            <X size={20} />
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 border-b border-gray-50 bg-gray-50/30 overflow-x-auto no-scrollbar">
          {(
            ["defence", "economy", "geopolitics", "climate"] as ActiveModule[]
          ).map((tab) => (
            <TabButton
              key={tab}
              label={tab}
              active={currentTab === tab}
              onClick={() => setCurrentTab(tab)}
              accentColor={MODULE_CONFIGS[tab].accent}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
          {loading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-32 bg-gray-50 rounded-xl" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-3 bg-gray-100 rounded" />
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              {/* ── DEFENCE ──────────────────────────────── */}
              {currentTab === "defence" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                      Defence Spending Trend
                    </h4>
                    <Sparkline
                      data={def?.spending_history || []}
                      dataKey="amount"
                      color={MODULE_CONFIGS.defence.accent}
                    />
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <DetailStat label="Defence Budget" value={defBudget} />
                    <DetailStat
                      label="Military Strength"
                      value={fmtPct(
                        comp?.military_strength ?? profile?.military_strength,
                      )}
                    />
                    <DetailStat
                      label="Conflict Status"
                      value={riskLabel(
                        comp?.conflict_risk ?? profile?.conflict_risk,
                      )}
                    />
                    <DetailStat
                      label="Fatality Index"
                      value={
                        conf?.fatalities != null
                          ? Number(conf.fatalities).toLocaleString()
                          : null
                      }
                    />
                    <DetailStat
                      label="Event Count"
                      value={conf?.events ?? null}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(comp?.nuclear_status === "confirmed" ||
                      profile?.nuclear === "confirmed") && (
                      <span className="px-3 py-1 bg-rose-50 border border-rose-100 rounded-lg text-[10px] font-black text-rose-600 uppercase">
                        Nuclear Capability
                      </span>
                    )}
                    {(comp?.un_p5 || profile?.p5) && (
                      <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-black text-indigo-600 uppercase">
                        UN P5 Security Council
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── ECONOMY ──────────────────────────────── */}
              {currentTab === "economy" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                      GDP Trend
                    </h4>
                    <Sparkline
                      data={econ?.gdp_history || []}
                      dataKey="value"
                      color={MODULE_CONFIGS.economy.accent}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    {/* GDP: absolute USD, never a percentage */}
                    <DetailStat label="GDP (Absolute)" value={gdpDisplay} />
                    <DetailStat
                      label="Economic Risk"
                      value={riskLabel(econ?.economic_risk_score)}
                    />
                    <DetailStat
                      label="Inflation Rate"
                      value={
                        econ?.avg_inflation != null
                          ? `${Number(econ.avg_inflation).toFixed(1)}%`
                          : null
                      }
                    />
                    <DetailStat
                      label="Global GDP Rank"
                      value={comp?.global_rank ? `#${comp.global_rank}` : null}
                    />
                    <DetailStat
                      label="Trade Vulnerability"
                      value={riskLabel(comp?.trade_vulnerability)}
                    />
                    <DetailStat
                      label="Energy Vulnerability"
                      value={riskLabel(comp?.energy_vulnerability)}
                    />
                  </div>

                  {topPartners.length > 0 && (
                    <div className="pt-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        Top Export Partners
                      </h4>
                      <div className="space-y-2">
                        {topPartners.map((p, i) => (
                          <div
                            key={p}
                            className="flex items-center justify-between text-xs font-bold text-slate-600"
                          >
                            <span>{p}</span>
                            <span className="text-[10px] text-slate-400 opacity-50">
                              #{i + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── GEOPOLITICS ──────────────────────────── */}
              {currentTab === "geopolitics" && (
                <div className="space-y-6">
                  <div className="bg-indigo-50/50 rounded-xl p-5 border border-indigo-100">
                    <DetailStat
                      label="Political Architecture"
                      value={geo?.political_system}
                    />
                    <DetailStat
                      label="Diplomatic Influence"
                      value={fmtPct(
                        comp?.diplomatic_centrality ??
                          profile?.diplomatic_centrality,
                      )}
                    />
                    <DetailStat
                      label="Political Stability"
                      value={fmtPct(comp?.political_stability)}
                    />
                    <DetailStat label="Region" value={profile?.region} />
                  </div>

                  {profile?.alliances && profile.alliances.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        Active Alliances
                      </h4>
                      <div className="space-y-3">
                        {profile.alliances.map((a) => (
                          <div
                            key={a}
                            className="p-3 bg-white border border-gray-100 rounded-xl flex items-center gap-3"
                          >
                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span className="text-xs font-bold text-slate-700 uppercase">
                              {a}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {geo?.sanctions_imposed?.length > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                      <h4 className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">
                        Sanctions Imposed
                      </h4>
                      <p className="text-xs text-rose-700 leading-relaxed">
                        {Array.isArray(geo.sanctions_imposed)
                          ? geo.sanctions_imposed.slice(0, 2).join(", ")
                          : geo.sanctions_imposed}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── CLIMATE ──────────────────────────────── */}
              {currentTab === "climate" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-amber-50 rounded-2xl">
                      <div className="text-[9px] font-black text-amber-600 uppercase tracking-widest">
                        Risk Index
                      </div>
                      <div className="text-2xl font-black text-amber-700 mt-1">
                        {clim?.climate_risk_score?.toFixed(2) ??
                          riskLabel(comp?.climate_vulnerability) ??
                          "N/A"}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Emissions
                      </div>
                      <div className="text-sm font-black text-slate-700 mt-1">
                        {clim?.emissions_level ??
                          clim?.emissions_category ??
                          "N/A"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    <DetailStat
                      label="Overall Vulnerability"
                      value={riskLabel(comp?.overall_vulnerability)}
                    />
                    <DetailStat
                      label="Avg Temperature"
                      value={
                        clim?.avg_temperature != null
                          ? `${Number(clim.avg_temperature).toFixed(1)}°C`
                          : null
                      }
                    />
                    <DetailStat
                      label="Live Risk Score"
                      value={fmtPct(comp?.live_risk ?? profile?.live_risk)}
                    />
                  </div>

                  {topHazards.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        Hazard Profile
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {topHazards.map((h) => (
                          <span
                            key={h}
                            className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-slate-600 uppercase"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action */}
        <div className="p-6 border-t border-gray-100">
          <button className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group">
            Intelligence Protocol Active
            <ExternalLink
              size={14}
              className="opacity-40 group-hover:opacity-100 transition-opacity"
            />
          </button>
        </div>
      </motion.div>
    </>
  );
};

export default CountryDetailPanel;
