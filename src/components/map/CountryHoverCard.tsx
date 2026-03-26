import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, ExternalLink, Shield, TrendingUp, TrendingDown, Minus, Globe, Landmark, Thermometer, Box, Package } from "lucide-react";
import { CountryProfile, ActiveModule } from "../../types";
import {
  fetchCompositeProfile,
  fetchEconomyProfile,
  fetchClimateProfile,
  fetchGeopoliticsProfile,
  fetchDefenseProfile,
  fetchDefenseConflicts,
} from "../../lib/api";

interface CountryHoverCardProps {
  country: string;
  profile: CountryProfile | null;
  activeModule: ActiveModule;
  onClose: () => void;
  onOpenDetail: () => void;
}

const StatRow: React.FC<{ label: string; value: string | number; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex flex-col gap-1 p-2 bg-white/5 rounded-lg border border-white/5">
    <div className="flex items-center gap-1.5 text-[9px] text-white/40 uppercase tracking-widest font-bold">
      {icon}
      {label}
    </div>
    <div className="text-xs font-bold text-white/90 truncate">
      {value || <span className="text-white/20 font-medium italic">Data pending</span>}
    </div>
  </div>
);

const SkeletonLine: React.FC<{ width?: string }> = ({ width = "w-full" }) => (
  <div className={`h-3 bg-white/5 rounded animate-pulse ${width}`} />
);

const CountryHoverCard: React.FC<CountryHoverCardProps> = ({
  country,
  profile,
  activeModule,
  onClose,
  onOpenDetail,
}) => {
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
    let isMounted = true;
    setLoading(true);

    Promise.all([
      fetchCompositeProfile(country),
      fetchEconomyProfile(country),
      fetchClimateProfile(country),
      fetchGeopoliticsProfile(country),
      fetchDefenseProfile(country),
      fetchDefenseConflicts(country),
    ]).then(([composite, economy, climate, geopolitics, defense, conflicts]) => {
      if (isMounted) {
        setData({ composite, economy, climate, geopolitics, defense, conflicts });
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [country]);

  const getConflictText = (risk: number) => {
    if (risk > 0.8) return "Critical";
    if (risk > 0.6) return "High";
    if (risk > 0.3) return "Moderate";
    return "Low";
  };

  const getTrendIcon = (trend: string | null | undefined) => {
    if (trend === "increasing") return <TrendingUp size={12} className="text-rose-400" />;
    if (trend === "decreasing") return <TrendingDown size={12} className="text-emerald-400" />;
    return <Minus size={12} className="text-slate-500" />;
  };

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      className="fixed left-[80px] top-1/2 -translate-y-1/2 w-[300px] max-h-[80vh] bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl text-white z-[150] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 pb-4 border-b border-white/5 flex items-start justify-between bg-white/2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">●</span>
            <h2 className="text-lg font-bold tracking-tight truncate max-w-[180px]">{country}</h2>
          </div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            {profile?.region || "Unknown Region"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide">
        {loading ? (
          <div className="space-y-4">
            <SkeletonLine width="w-2/3" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
              <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
              <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
              <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
            </div>
            <SkeletonLine />
            <SkeletonLine width="w-4/5" />
          </div>
        ) : (
          <>
            {activeModule === "overview" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-2">
                  <StatRow
                    label="Global GDP"
                    value={data?.economy?.gdp_usd ? `$${(data.economy.gdp_usd / 1e12).toFixed(1)}T` : null}
                    icon={<Globe size={10} />}
                  />
                  <StatRow
                    label="GDP Rank"
                    value={data?.composite?.global_rank ? `#${data.composite.global_rank}` : "N/A"}
                    icon={<Landmark size={10} />}
                  />
                  <StatRow
                    label="Defence"
                    value={profile?.defense_burden ? `${(profile.defense_burden * 100).toFixed(1)}% of GDP` : null}
                    icon={<Shield size={10} />}
                  />
                  <StatRow
                    label="Conflict Risk"
                    value={getConflictText(profile?.conflict_risk || 0)}
                    icon={<TrendingUp size={10} />}
                  />
                  <StatRow
                    label="Climate Risk"
                    value={data?.climate?.climate_risk_score ? (data.climate.climate_risk_score > 0.7 ? "High" : data.climate.climate_risk_score > 0.4 ? "Med" : "Low") : null}
                    icon={<Thermometer size={10} />}
                  />
                  <StatRow
                    label="Gov System"
                    value={data?.geopolitics?.political_system}
                    icon={<Landmark size={10} />}
                  />
                  <StatRow
                    label="Arms Import"
                    value={profile?.defense_spending ? `$${((profile.defense_spending * 0.1) / 1e9).toFixed(1)}B` : null}
                    icon={<Box size={10} />}
                  />
                  <StatRow
                    label="Arms Export"
                    value={profile?.arms_export ? `$${(profile.arms_export / 1e9).toFixed(1)}B` : null}
                    icon={<Package size={10} />}
                  />
                </div>

                {profile?.alliances && profile.alliances.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Alliances</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.alliances.map((a) => (
                        <span key={a} className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-bold text-indigo-300 uppercase">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeModule === "defence" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-2">
                  <StatRow label="Defence Budget" value={profile?.defense_burden ? `${(profile.defense_burden * 100).toFixed(1)}% of GDP` : null} />
                  <StatRow label="Arms Export Score" value={profile?.arms_export?.toLocaleString()} />
                  <StatRow label="Conflict Risk" value={getConflictText(profile?.conflict_risk || 0)} />
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Trend</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase">{profile?.conflict_trend || "Stable"}</span>
                      {getTrendIcon(profile?.conflict_trend)}
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      <span>Military Strength</span>
                      <span className="text-indigo-400">{(profile?.military_strength || 0 * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(profile?.military_strength || 0) * 100}%` }}
                        className="h-full bg-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeModule === "economy" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-2">
                  <StatRow label="Econ Risk" value={data?.economy?.economic_risk_score?.toFixed(2)} />
                  <StatRow label="GDP Rank" value={data?.composite?.global_rank ? `#${data.composite.global_rank}` : null} />
                  <StatRow label="Inflation" value={data?.economy?.avg_inflation ? `${data.economy.avg_inflation}%` : null} />
                  <StatRow label="GDP Value" value={data?.economy?.gdp_usd ? `$${(data.economy.gdp_usd / 1e12).toFixed(1)}T` : null} />
                </div>
                {data?.economy?.top_partners && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Top Trade Partners</h4>
                    <div className="space-y-1.5">
                      {data.economy.top_partners.slice(0, 3).map((p: string) => (
                        <div key={p} className="flex items-center gap-2 text-xs font-bold text-white/80">
                          <div className="w-1 h-1 rounded-full bg-emerald-400" />
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeModule === "geopolitics" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-2">
                  <StatRow label="Political System" value={data?.geopolitics?.political_system} />
                  <StatRow label="Influence" value={profile?.diplomatic_centrality ? `${(profile.diplomatic_centrality * 100).toFixed(0)}%` : null} />
                  <StatRow label="Region" value={profile?.region} />
                </div>
                {data?.geopolitics?.sanctions && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                    <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Active Sanctions</h4>
                    <p className="text-xs text-rose-200/80 leading-relaxed">{data.geopolitics.sanctions}</p>
                  </div>
                )}
              </div>
            )}

            {activeModule === "climate" && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-2">
                  <StatRow label="Climate Risk" value={data?.climate?.climate_risk_score?.toFixed(2)} />
                  <StatRow label="Emissions" value={data?.climate?.emissions_level} />
                </div>
                {data?.climate?.top_hazards && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Top Hazards</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {data.climate.top_hazards.map((h: string) => (
                        <span key={h} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] font-bold text-amber-300 uppercase">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Action */}
      <div className="p-4 bg-white/2 border-t border-white/5">
        <button
          onClick={onOpenDetail}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group"
        >
          See full analysis
          <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
};

export default React.memo(CountryHoverCard);
