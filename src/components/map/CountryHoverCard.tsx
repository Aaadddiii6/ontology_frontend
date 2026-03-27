import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X,
  ExternalLink,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Landmark,
  Thermometer,
  Box,
  Activity,
  Zap,
} from "lucide-react";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { CountryProfile, ActiveModule } from "../../types";
import {
  fetchCompositeProfile,
  fetchEconomyProfile,
  fetchClimateProfile,
  fetchGeopoliticsProfile,
  fetchDefenseProfile,
  fetchDefenseConflicts,
  fetchEconomyPartners,
  fetchClimateHazards,
  MODULE_CONFIGS,
} from "../../lib/api";

interface CountryHoverCardProps {
  country: string;
  profile: CountryProfile | null;
  activeModule: ActiveModule;
  onClose: () => void;
  onOpenDetail: () => void;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

/** Format absolute USD: $1.2T / $450B / $32M */
function fmtUSD(v: number | null | undefined): string | null {
  if (v == null || isNaN(Number(v))) return null;
  const n = Number(v);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n > 0) return `$${n.toLocaleString()}`;
  return null;
}

/** Format a 0–1 score as a percentage string */
function fmtPct(v: number | null | undefined, digits = 1): string | null {
  if (v == null || isNaN(Number(v))) return null;
  return `${(Number(v) * 100).toFixed(digits)}%`;
}

/** Convert a 0–1 risk score to a human label */
function riskLabel(v: number | null | undefined): string | null {
  if (v == null) return null;
  if (v > 0.75) return "Critical";
  if (v > 0.5) return "High";
  if (v > 0.25) return "Moderate";
  return "Low";
}

/** Format defense spending that comes in as USD millions */
function fmtDefenseBudget(
  spendingMillions: number | null | undefined,
  burdenRatio: number | null | undefined,
): string | null {
  if (spendingMillions != null && Number(spendingMillions) > 0) {
    return fmtUSD(Number(spendingMillions) * 1e6);
  }
  // Fallback: burden is a normalised 0-1 weight, show as "~X% GDP proxy"
  if (burdenRatio != null && Number(burdenRatio) > 0) {
    return `${(Number(burdenRatio) * 100).toFixed(1)}% GDP`;
  }
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatRow: React.FC<{
  label: string;
  value: string | number | null | undefined;
  icon?: React.ReactNode;
  moduleAccent?: string;
}> = ({ label, value, icon, moduleAccent }) => (
  <div
    className="flex flex-col gap-1 p-2 bg-gradient-to-br from-white/5 to-white/0 rounded-lg border border-white/8 shadow-[0_4px_16px_rgba(0,0,0,0.2)] border-l-2"
    style={{ borderLeftColor: moduleAccent || "rgba(255,255,255,0.1)" }}
  >
    <div className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.25em] uppercase text-slate-400">
      {icon}
      {label}
    </div>
    <div className="text-sm font-semibold text-white/90 truncate font-mono">
      {value != null && value !== "" ? (
        <AnimatedNumber value={value} />
      ) : (
        <span className="text-white/20 font-medium italic">—</span>
      )}
    </div>
  </div>
);

const SkeletonBox: React.FC = () => (
  <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
);

// ─── Main component ───────────────────────────────────────────────────────────

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
    partners: any;
    hazards: any;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setData(null);

    Promise.all([
      fetchCompositeProfile(country),
      fetchEconomyProfile(country),
      fetchClimateProfile(country),
      fetchGeopoliticsProfile(country),
      fetchDefenseProfile(country),
      fetchDefenseConflicts(country),
      fetchEconomyPartners(country),
      fetchClimateHazards(country),
    ]).then(
      ([
        composite,
        economy,
        climate,
        geopolitics,
        defense,
        conflicts,
        partners,
        hazards,
      ]) => {
        if (isMounted) {
          setData({
            composite,
            economy,
            climate,
            geopolitics,
            defense,
            conflicts,
            partners,
            hazards,
          });
          setLoading(false);
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, [country]);

  const getTrendIcon = (trend: string | null | undefined) => {
    if (trend === "increasing")
      return <TrendingUp size={12} className="text-rose-400" />;
    if (trend === "decreasing")
      return <TrendingDown size={12} className="text-emerald-400" />;
    return <Minus size={12} className="text-slate-500" />;
  };

  const comp = data?.composite; // /composite/country/:name
  const econ = data?.economy; // /economy/country/:name  → { gdp_usd, avg_inflation, economic_risk_score }
  const clim = data?.climate; // /climate/country/:name  → { climate_risk_score, emissions_level }
  const geo = data?.geopolitics; // /geopolitics/country/:name
  const def = data?.defense; // /defense/spending/:name → { spending_2023, spending_history }
  const conf = data?.conflicts; // /defense/conflicts/:name → { fatalities, events }

  // ── GDP: prefer absolute gdp_usd from economy endpoint ───────────────────
  const gdpDisplay =
    fmtUSD(econ?.gdp_usd) ?? // economy endpoint: absolute USD
    fmtUSD(comp?.gdp_usd) ?? // composite endpoint: absolute USD
    null; // don't fall back to percentages

  // ── Defense budget: spending_2023 from /defense/spending/:name (USD millions) ──
  const defBudget = fmtDefenseBudget(
    def?.spending_2023 ?? def?.spending_usd_millions,
    profile?.defense_burden,
  );

  // ── Partners ──────────────────────────────────────────────────────────────
  const topPartners: string[] =
    data?.partners?.dependencies?.slice(0, 3).map((d: any) => d.partner) || [];

  // ── Hazards ───────────────────────────────────────────────────────────────
  const topHazards: string[] =
    data?.hazards?.hazards?.slice(0, 4).map((h: any) => h.type) || [];

  const moduleAccent = MODULE_CONFIGS[activeModule]?.accent || "#1e293b";

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed left-[80px] top-1/2 -translate-y-1/2 w-[300px] max-h-[80vh] bg-gradient-to-br from-slate-900/95 to-slate-800/90 backdrop-blur-2xl border border-white/8 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-white z-[150] flex flex-col overflow-hidden"
    >
      {/* Accent line */}
      <div
        className="h-1.5 w-full"
        style={{
          background: `linear-gradient(to right, ${moduleAccent}, transparent)`,
        }}
      />

      {/* Header */}
      <div className="p-5 pb-4 border-b border-white/5 flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <h2 className="text-lg font-bold tracking-tight truncate max-w-[180px]">
              {country}
            </h2>
          </div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            {profile?.region || geo?.region || "Unknown Region"}
          </span>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {(comp?.nuclear_status === "confirmed" ||
              profile?.nuclear === "confirmed") && (
              <span className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/30 rounded text-[9px] font-black text-rose-400 uppercase">
                ☢ Nuclear
              </span>
            )}
            {(comp?.un_p5 || profile?.p5) && (
              <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded text-[9px] font-black text-indigo-400 uppercase">
                UN P5
              </span>
            )}
            {(comp?.is_regional_power || profile?.regional_power) && (
              <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] font-black text-amber-400 uppercase">
                Regional Power
              </span>
            )}
          </div>
        </div>
        <motion.button
          onClick={onClose}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
        >
          <X size={18} />
        </motion.button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide">
        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[...Array(6)].map((_, i) => (
                <SkeletonBox key={i} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── OVERVIEW ──────────────────────────────────────────────── */}
            {activeModule === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <StatRow
                    label="GDP"
                    value={gdpDisplay}
                    icon={<Globe size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Global Risk"
                    value={riskLabel(
                      comp?.global_risk ?? profile?.conflict_risk,
                    )}
                    icon={<Activity size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Defence Budget"
                    value={defBudget}
                    icon={<Shield size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Conflict Risk"
                    value={riskLabel(
                      comp?.conflict_risk ?? profile?.conflict_risk,
                    )}
                    icon={<TrendingUp size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Climate Vuln."
                    value={riskLabel(comp?.climate_vulnerability)}
                    icon={<Thermometer size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Gov System"
                    value={geo?.political_system}
                    icon={<Landmark size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Influence"
                    value={fmtPct(
                      comp?.strategic_influence ??
                        profile?.diplomatic_centrality,
                    )}
                    icon={<Zap size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Military Strength"
                    value={fmtPct(
                      comp?.military_strength ?? profile?.military_strength,
                    )}
                    icon={<Box size={10} />}
                    moduleAccent={moduleAccent}
                  />
                </div>

                {topPartners.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Top Trade Partners
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {topPartners.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-bold text-indigo-300"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profile?.alliances && profile.alliances.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Alliances
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.alliances.map((a) => (
                        <span
                          key={a}
                          className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-bold text-indigo-300 uppercase"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── DEFENCE ───────────────────────────────────────────────── */}
            {activeModule === "defence" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2">
                  <StatRow
                    label="Defence Budget"
                    value={defBudget}
                    icon={<Shield size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Military Strength"
                    value={fmtPct(
                      comp?.military_strength ?? profile?.military_strength,
                    )}
                    icon={<Activity size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Defence Composite"
                    value={fmtPct(
                      comp?.defense_composite ?? profile?.defense_composite,
                    )}
                    icon={<Box size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Conflict Risk"
                    value={riskLabel(
                      comp?.conflict_risk ?? profile?.conflict_risk,
                    )}
                    icon={<TrendingUp size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Fatalities"
                    value={
                      conf?.fatalities != null
                        ? Number(conf.fatalities).toLocaleString()
                        : null
                    }
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Conflict Events"
                    value={conf?.events ?? null}
                    moduleAccent={moduleAccent}
                  />
                </div>

                {/* Military strength bar */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    <span>Military Strength Index</span>
                    <span className="text-indigo-400">
                      {(
                        (comp?.military_strength ??
                          profile?.military_strength ??
                          0) * 100
                      ).toFixed(0)}
                      %
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(
                          (comp?.military_strength ??
                            profile?.military_strength ??
                            0) * 100
                        ).toFixed(0)}%`,
                      }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      style={{
                        background: `linear-gradient(to right, ${moduleAccent}40, ${moduleAccent})`,
                      }}
                      className="h-full"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    Conflict Trend
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase">
                      {profile?.conflict_trend || "Stable"}
                    </span>
                    {getTrendIcon(profile?.conflict_trend)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(comp?.nuclear_status === "confirmed" ||
                    profile?.nuclear === "confirmed") && (
                    <span className="px-3 py-1 bg-rose-50/10 border border-rose-500/20 rounded-lg text-[10px] font-black text-rose-400 uppercase">
                      Nuclear Capability
                    </span>
                  )}
                  {(comp?.un_p5 || profile?.p5) && (
                    <span className="px-3 py-1 bg-indigo-50/10 border border-indigo-500/20 rounded-lg text-[10px] font-black text-indigo-400 uppercase">
                      UN P5 Security Council
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── ECONOMY ───────────────────────────────────────────────── */}
            {activeModule === "economy" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {/* GDP — absolute value, not a ratio */}
                  <StatRow
                    label="GDP"
                    value={gdpDisplay}
                    icon={<Globe size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  {/* Economic risk: a 0–1 score, show as label */}
                  <StatRow
                    label="Econ Risk"
                    value={riskLabel(econ?.economic_risk_score)}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Inflation"
                    value={
                      econ?.avg_inflation != null
                        ? `${Number(econ.avg_inflation).toFixed(1)}%`
                        : null
                    }
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Trade Vuln."
                    value={riskLabel(comp?.trade_vulnerability)}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Energy Vuln."
                    value={riskLabel(comp?.energy_vulnerability)}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Econ Influence"
                    value={fmtPct(comp?.economic_influence)}
                    moduleAccent={moduleAccent}
                  />
                </div>

                {topPartners.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Top Trade Partners
                    </h4>
                    <div className="space-y-1.5">
                      {topPartners.map((p) => (
                        <div
                          key={p}
                          className="flex items-center gap-2 text-xs font-bold text-white/80"
                        >
                          <div className="w-1 h-1 rounded-full bg-emerald-400" />
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── GEOPOLITICS ───────────────────────────────────────────── */}
            {activeModule === "geopolitics" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2">
                  <StatRow
                    label="Political System"
                    value={geo?.political_system}
                    icon={<Landmark size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Geopolitical Influence"
                    value={fmtPct(
                      comp?.geopolitical_influence ??
                        profile?.diplomatic_centrality,
                    )}
                    icon={<Globe size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Political Stability"
                    value={fmtPct(comp?.political_stability)}
                    icon={<Activity size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Diplomatic Centrality"
                    value={fmtPct(comp?.diplomatic_centrality)}
                    moduleAccent={moduleAccent}
                  />
                </div>

                {geo?.sanctions_imposed?.length > 0 && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                    <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">
                      Sanctions Imposed
                    </h4>
                    <p className="text-xs text-rose-200/80 leading-relaxed">
                      {Array.isArray(geo.sanctions_imposed)
                        ? geo.sanctions_imposed.slice(0, 2).join(", ")
                        : geo.sanctions_imposed}
                    </p>
                  </div>
                )}
                {geo?.sanctions_received?.length > 0 && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <h4 className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">
                      Under Sanctions
                    </h4>
                    <p className="text-xs text-orange-200/80">
                      {Array.isArray(geo.sanctions_received)
                        ? geo.sanctions_received.slice(0, 2).join(", ")
                        : geo.sanctions_received}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── CLIMATE ───────────────────────────────────────────────── */}
            {activeModule === "climate" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <StatRow
                    label="Climate Risk"
                    value={
                      clim?.climate_risk_score != null
                        ? clim.climate_risk_score.toFixed(2)
                        : riskLabel(comp?.climate_vulnerability)
                    }
                    icon={<Thermometer size={10} />}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Vulnerability"
                    value={riskLabel(comp?.overall_vulnerability)}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Emissions"
                    value={clim?.emissions_level ?? clim?.emissions_category}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Live Risk"
                    value={fmtPct(comp?.live_risk ?? profile?.live_risk)}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Primary Vuln."
                    value={comp?.primary_vulnerability}
                    moduleAccent={moduleAccent}
                  />
                  <StatRow
                    label="Avg Temp"
                    value={
                      clim?.avg_temperature != null
                        ? `${Number(clim.avg_temperature).toFixed(1)}°C`
                        : null
                    }
                    moduleAccent={moduleAccent}
                  />
                </div>

                {topHazards.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                      Top Hazards
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {topHazards.map((h) => (
                        <span
                          key={h}
                          className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] font-bold text-amber-300 uppercase"
                        >
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

      {/* Action button */}
      <div className="p-4 border-t border-white/5">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenDetail}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group shadow-lg"
        >
          Full Analysis
          <ExternalLink
            size={12}
            className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
          />
        </motion.button>
      </div>
    </motion.div>
  );
};

export default React.memo(CountryHoverCard);
