import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Landmark,
  Globe,
  Thermometer,
  ExternalLink,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
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

const TabButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  accentColor: string;
}> = ({ label, active, onClick, accentColor }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all duration-200 ${
      active
        ? "border-current opacity-100"
        : "border-transparent opacity-40 hover:opacity-70"
    }`}
    style={{ color: active ? accentColor : "inherit" }}
  >
    {label}
  </button>
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
        <Tooltip hide />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const DetailStat: React.FC<{
  label: string;
  value: string | number;
  description?: string;
}> = ({ label, value, description }) => (
  <div className="py-3 border-b border-gray-100 last:border-0">
    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
      {label}
    </div>
    <div className="text-sm font-bold text-gray-800 mt-0.5">
      {value || (
        <span className="text-gray-300 italic">Data not available</span>
      )}
    </div>
    {description && (
      <div className="text-[10px] text-gray-400 mt-0.5">{description}</div>
    )}
  </div>
);

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
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        className="fixed right-0 top-0 bottom-0 w-[340px] bg-white z-[250] shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">
              {country}
            </h2>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {profile.region || "Analysis Node"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
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
                <div className="h-3 bg-gray-100 rounded" />
                <div className="h-3 bg-gray-100 rounded" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              {currentTab === "defence" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                      Defence Spending Trend
                    </h4>
                    <Sparkline
                      data={data?.defense?.spending_history || []}
                      dataKey="amount"
                      color={MODULE_CONFIGS.defence.accent}
                    />
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                      Conflict Risk Matrix
                    </h4>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                      <DetailStat
                        label="Conflict Status"
                        value={
                          (profile.conflict_risk || 0) > 0.6
                            ? "CRITICAL"
                            : "MODERATE"
                        }
                      />
                      <DetailStat
                        label="Fatality Index"
                        value={
                          data?.conflicts?.fatalities?.toLocaleString() || ""
                        }
                      />
                      <DetailStat
                        label="Event Count"
                        value={data?.conflicts?.events || ""}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {profile.nuclear && (
                      <span className="px-3 py-1 bg-rose-50 border border-rose-100 rounded-lg text-[10px] font-black text-rose-600 uppercase">
                        Nuclear Capability
                      </span>
                    )}
                    {profile.p5 && (
                      <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-black text-indigo-600 uppercase">
                        UN P5 Security Council
                      </span>
                    )}
                  </div>
                </div>
              )}

              {currentTab === "economy" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                      GDP Projection
                    </h4>
                    <Sparkline
                      data={data?.economy?.gdp_history || []}
                      dataKey="value"
                      color={MODULE_CONFIGS.economy.accent}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    <DetailStat
                      label="Economic Risk Score"
                      value={
                        data?.economy?.economic_risk_score?.toFixed(2) || ""
                      }
                    />
                    <DetailStat
                      label="Inflation Rate"
                      value={
                        data?.economy?.avg_inflation
                          ? data.economy.avg_inflation + "%"
                          : ""
                      }
                    />
                    <DetailStat
                      label="Global GDP Rank"
                      value={
                        data?.composite?.global_rank
                          ? `#${data.composite.global_rank}`
                          : ""
                      }
                    />
                  </div>

                  {data?.economy?.top_partners && (
                    <div className="pt-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        Top Export Partners
                      </h4>
                      <div className="space-y-2">
                        {data.economy.top_partners
                          .slice(0, 5)
                          .map((p: string, i: number) => (
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

              {currentTab === "geopolitics" && (
                <div className="space-y-6">
                  <div className="bg-indigo-50/50 rounded-xl p-5 border border-indigo-100">
                    <DetailStat
                      label="Political Architecture"
                      value={data?.geopolitics?.political_system || ""}
                    />
                    <DetailStat
                      label="Diplomatic Influence"
                      value={
                        ((profile.diplomatic_centrality || 0) * 100).toFixed(
                          1,
                        ) + "%"
                      }
                    />
                  </div>

                  {profile.alliances && profile.alliances.length > 0 && (
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
                </div>
              )}

              {currentTab === "climate" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-amber-50 rounded-2xl">
                      <div className="text-[9px] font-black text-amber-600 uppercase tracking-widest">
                        Risk Index
                      </div>
                      <div className="text-2xl font-black text-amber-700 mt-1">
                        {data?.climate?.climate_risk_score?.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Emissions
                      </div>
                      <div className="text-sm font-black text-slate-700 mt-1">
                        {data?.climate?.emissions_level}
                      </div>
                    </div>
                  </div>

                  {data?.climate?.top_hazards && (
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        Hazard Profile
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {data.climate.top_hazards.map((h: string) => (
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

        {/* Action Button */}
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
