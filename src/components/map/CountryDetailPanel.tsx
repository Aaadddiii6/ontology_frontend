import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { CountryProfile, ActiveModule } from "../../types";
import { MODULE_CONFIGS } from "../../lib/api";

interface CountryDetailPanelProps {
  country: string | null;
  profile: CountryProfile | null;
  onClose: () => void;
  activeModule: ActiveModule;
}

const ScoreCard: React.FC<{ label: string; value: number | undefined }> = ({
  label,
  value = 0,
}) => {
  const getColor = (s: number) => {
    if (s > 0.4) return "#e05555";
    if (s > 0.2) return "#f0a843";
    return "#6cc49a";
  };

  return (
    <div className="p-3 bg-gray-50/70 rounded-lg">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold" style={{ color: getColor(value) }}>
        {value.toFixed(2)}
      </div>
      <div className="w-full h-1 mt-2 bg-gray-200 rounded-full">
        <div
          className="h-1 rounded-full"
          style={{ width: `${value * 100}%`, backgroundColor: getColor(value) }}
        />
      </div>
    </div>
  );
};

const CountryDetailPanel: React.FC<CountryDetailPanelProps> = ({
  country,
  profile,
  onClose,
  activeModule,
}) => {
  const moduleConfig = MODULE_CONFIGS[activeModule] || MODULE_CONFIGS.overview;

  const renderTrend = () => {
    if (!profile?.conflict_trend) return null;

    switch (profile.conflict_trend) {
      case "increasing":
        return (
          <div className="flex items-center gap-2 text-red-600">
            <TrendingUp size={18} />
            <span className="text-sm font-medium">Conflict escalating</span>
          </div>
        );
      case "decreasing":
        return (
          <div className="flex items-center gap-2 text-green-600">
            <TrendingDown size={18} />
            <span className="text-sm font-medium">Conflict reducing</span>
          </div>
        );
      case "stable":
        return (
          <div className="flex items-center gap-2 text-gray-500">
            <Minus size={18} />
            <span className="text-sm font-medium">Stable conflict levels</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {country && profile && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/10 z-[140]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: 340 }}
            animate={{ x: 0 }}
            exit={{ x: 340 }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed right-0 top-[52px] bottom-0 w-[340px] bg-white border-l border-gray-200 z-[150] shadow-2xl"
          >
            <div className="p-5 overflow-y-auto h-full">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
              >
                <X size={20} />
              </button>

              <h2 className="text-2xl font-bold text-gray-900">{country}</h2>
              {profile.region && (
                <p className="text-sm text-gray-500 mt-1">{profile.region}</p>
              )}

              <div
                className="w-full h-1 mt-4 rounded-full"
                style={{ backgroundColor: moduleConfig.accent }}
              />

              <div className="flex flex-wrap gap-2 mt-4">
                {profile.nuclear && (
                  <span
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full ${profile.nuclear === "confirmed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}
                  >
                    {profile.nuclear === "confirmed" ? "Nuclear" : "Undeclared"}
                  </span>
                )}
                {profile.p5 && (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                    UN P5
                  </span>
                )}
                {profile.regional_power && (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    Regional Power
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <ScoreCard label="Military" value={profile.military_strength} />
                <ScoreCard
                  label="Conflict Risk"
                  value={profile.conflict_risk}
                />
                <ScoreCard label="Spending" value={profile.defense_spending} />
                <ScoreCard label="Arms Export" value={profile.arms_export} />
                <ScoreCard label="Burden" value={profile.defense_burden} />
                <ScoreCard label="Live Risk" value={profile.live_risk} />
              </div>

              {profile.alliances && profile.alliances.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-2">
                    Alliances
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.alliances.map((a) => (
                      <span
                        key={a}
                        className="px-3 py-1 text-sm bg-white border rounded-full"
                        style={{
                          borderColor: moduleConfig.accent,
                          color: moduleConfig.accent,
                        }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5">{renderTrend()}</div>

              <button
                className="w-full py-2.5 mt-6 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                style={{ backgroundColor: moduleConfig.accent }}
              >
                Explore in {moduleConfig.label} Intelligence →
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CountryDetailPanel;
