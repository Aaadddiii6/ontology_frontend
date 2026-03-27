import { CountryProfile, ModuleConfig } from "../types";

const BASE_URL = "/api/backend";

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;
const NETWORK_ERROR_LOG_THROTTLE_MS = 5 * 60 * 1000;
const lastNetworkErrorLoggedAt = new Map<string, number>();

function shouldLogKey(key: string) {
  const now = Date.now();
  const last = lastNetworkErrorLoggedAt.get(key) ?? 0;
  if (now - last < NETWORK_ERROR_LOG_THROTTLE_MS) return false;
  lastNetworkErrorLoggedAt.set(key, now);
  return true;
}

async function fetchWithCache<T>(key: string, url: string): Promise<T | null> {
  const cachedItem = cache.get(key);
  if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_DURATION) {
    return cachedItem.data as T;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      if (shouldLogKey(`${url}:status:${response.status}`)) {
        console.warn(`API returned ${response.status} for ${url}`);
      }
      return null;
    }

    const data = (await response.json()) as T;
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    const err = error as any;
    if (err.name === "AbortError") return null;
    if (shouldLogKey(`${url}:network`)) {
      console.warn(`Network error fetching ${url}: ${err?.message}`);
    }
    return null;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/** Safely extract an array from various API response shapes */
function toArr(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const k of ["data", "results", "items", "rankings"]) {
    if (Array.isArray(data[k])) return data[k];
  }
  const anyArray = Object.values(data).find((v) => Array.isArray(v));
  if (anyArray) return anyArray as any[];
  return [];
}

// ─── fetchAllProfiles ────────────────────────────────────────────────────────
// Merges global-risk + influence + defense spending + arms into CountryProfile[]
// ────────────────────────────────────────────────────────────────────────────
export async function fetchAllProfiles(): Promise<CountryProfile[] | null> {
  try {
    const [globalRisk, influence, defense, arms] = await Promise.all([
      fetchWithCache<any>(
        "global-risk-all",
        `${BASE_URL}/composite/rankings/global-risk`,
      ),
      fetchWithCache<any>(
        "influence-all",
        `${BASE_URL}/composite/rankings/influence`,
      ),
      fetchWithCache<any>(
        "defense-spending-all",
        `${BASE_URL}/defense/spending/top?limit=261`,
      ),
      fetchWithCache<any>(
        "defense-arms-all",
        `${BASE_URL}/defense/arms/top?limit=261`,
      ),
    ]);

    if (!globalRisk && !influence && !defense) return null;

    const profileMap = new Map<string, CountryProfile>();

    const getProfile = (country: string): CountryProfile => {
      if (!profileMap.has(country)) profileMap.set(country, { country });
      return profileMap.get(country)!;
    };

    // global_risk → conflict_risk + live_risk
    toArr(globalRisk).forEach((r: any) => {
      if (!r.country) return;
      const p = getProfile(r.country);
      const val = r.global_risk ?? r.risk_score ?? null;
      if (val !== null) {
        p.conflict_risk = val;
        p.live_risk = val;
      }
      if (r.strategic_influence != null)
        p.diplomatic_centrality = r.strategic_influence;
      if (r.military_strength != null)
        p.military_strength = r.military_strength;

      // Map nuclear_status correctly
      if (r.nuclear_status != null) {
        if (r.nuclear_status === true) {
          p.nuclear = "confirmed";
        } else {
          const n = String(r.nuclear_status).toLowerCase();
          if (n === "confirmed" || n === "true" || n === "1" || n === "yes")
            p.nuclear = "confirmed";
          else if (n === "undeclared") p.nuclear = "undeclared";
          else p.nuclear = null;
        }
      }

      if (r.un_p5 != null) p.p5 = r.un_p5;
      if (r.region != null) p.region = r.region;
    });

    // strategic_influence → diplomatic_centrality + extra composite fields
    toArr(influence).forEach((r: any) => {
      if (!r.country) return;
      const p = getProfile(r.country);
      if (r.strategic_influence != null)
        p.diplomatic_centrality = r.strategic_influence;
      if (r.military_strength != null)
        p.military_strength = r.military_strength;
      if (r.economic_power != null) p.arms_export = r.economic_power;
      if (r.region != null) p.region = r.region;

      if (r.nuclear_status != null) {
        if (r.nuclear_status === true) {
          p.nuclear = "confirmed";
        } else {
          const n = String(r.nuclear_status).toLowerCase();
          if (n === "confirmed" || n === "true" || n === "1" || n === "yes")
            p.nuclear = "confirmed";
          else if (n === "undeclared") p.nuclear = "undeclared";
        }
      }

      if (r.un_p5 != null) p.p5 = r.un_p5;
    });

    // defense spending → defense_spending (keep raw millions), defense_burden
    toArr(defense).forEach((r: any) => {
      if (!r.country) return;
      const p = getProfile(r.country);
      const spendingVal =
        r.spending_usd_millions ??
        r.spending_2023 ??
        r.spending_usd ??
        r.total_spending ??
        null;
      if (spendingVal != null) p.defense_spending = Number(spendingVal);
      if (r.normalized_weight != null) p.defense_burden = r.normalized_weight;
    });

    // arms export → normalise to 0-1
    toArr(arms).forEach((r: any) => {
      if (!r.country) return;
      const p = getProfile(r.country);
      const tiv = r.avg_market_share_pct ?? r.total_tiv ?? null;
      if (tiv != null) p.arms_export = Number(tiv) / 100;
    });

    return Array.from(profileMap.values());
  } catch (error) {
    console.error("Failed to fetch all profiles:", error);
    return null;
  }
}

// ─── Per-country detail endpoints ────────────────────────────────────────────

export async function fetchCompositeProfile(
  country: string,
): Promise<any | null> {
  return fetchWithCache<any>(
    `composite-profile-${country}`,
    `${BASE_URL}/composite/country/${encodeURIComponent(country)}`,
  );
}

export async function fetchEconomyProfile(
  country: string,
): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    `economy-profile-${country}`,
    `${BASE_URL}/economy/country/${encodeURIComponent(country)}`,
  );
  if (!raw) return null;

  return {
    ...raw,
    gdp_usd: raw.macro?.gdp_usd ?? null,
    trade_balance: raw.macro?.trade_balance_usd ?? null,
    exports_usd: raw.macro?.exports_usd ?? null,
    imports_usd: raw.macro?.imports_usd ?? null,
    avg_inflation: raw.trends?.avg_inflation_pct ?? raw.avg_inflation ?? null,
    inflation_trend: raw.trends?.inflation_trend ?? null,
    economic_risk_score:
      raw.scores?.trade_vulnerability ?? raw.scores?.economic_influence ?? null,
    economic_power_score: raw.scores?.economic_power ?? null,
    trade_vulnerability_score: raw.scores?.trade_vulnerability ?? null,
    energy_vulnerability_score: raw.scores?.energy_vulnerability ?? null,
    economic_influence_score: raw.scores?.economic_influence ?? null,
    trade_balance_score: raw.scores?.trade_balance_health ?? null,
    inflation_stability_score: raw.scores?.inflation_stability ?? null,
  };
}

export async function fetchEconomyGDP(country: string): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    `economy-gdp-${country}`,
    `${BASE_URL}/economy/country/${encodeURIComponent(country)}/gdp`,
  );
  if (!raw) return null;

  const arr = Array.isArray(raw) ? raw : (raw.history ?? []);
  return {
    history: arr.map((r: any) => ({
      year: r.year,
      value: r.gdp_usd ?? r.value ?? 0,
    })),
  };
}

export async function fetchEconomyPartners(
  country: string,
): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    `economy-partners-${country}`,
    `${BASE_URL}/economy/country/${encodeURIComponent(country)}/high-dependencies`,
  );
  if (!raw) return null;

  const deps = raw.high_dependency_on ?? raw.dependencies ?? [];
  return {
    ...raw,
    dependencies: deps.map((d: any) => ({
      partner: d.country ?? d.partner ?? d.depends_on,
      share_pct: d.dependency ?? d.share_pct ?? 0,
    })),
  };
}

export async function fetchClimateProfile(
  country: string,
): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    `climate-profile-${country}`,
    `${BASE_URL}/climate/country/${encodeURIComponent(country)}`,
  );
  if (!raw) return null;

  return {
    ...raw,
    climate_risk_score:
      raw.scores?.climate_risk ?? raw.climate_risk_score ?? null,
    climate_vulnerability_score:
      raw.scores?.climate_vulnerability ??
      raw.climate_vulnerability_score ??
      null,
    supply_chain_risk_score: raw.scores?.supply_chain_risk ?? null,
    avg_temperature:
      raw.temperature?.mean_temp_celsius ?? raw.avg_temperature ?? null,
    warming_stress: raw.temperature?.warming_stress_score ?? null,
    emissions_level:
      raw.scores?.emissions_score != null
        ? raw.scores.emissions_score > 0.7
          ? "Very High"
          : raw.scores.emissions_score > 0.4
            ? "High"
            : raw.scores.emissions_score > 0.2
              ? "Moderate"
              : "Low"
        : (raw.emissions_level ?? null),
    emissions_category: raw.emissions_category ?? null,
    overall_vulnerability:
      raw.scores?.climate_vulnerability ?? raw.overall_vulnerability ?? null,
  };
}

export async function fetchClimateHazards(
  country: string,
): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    `climate-hazards-${country}`,
    `${BASE_URL}/climate/country/${encodeURIComponent(country)}/hazard-risk`,
  );
  if (!raw) return null;

  const arr = Array.isArray(raw) ? raw : (raw.hazards ?? []);
  return {
    hazards: arr.map((h: any) => ({
      type: h.hazard_type ?? h.type ?? h.risk_category ?? "Unknown",
      risk_score: h.risk_score ?? h.value ?? 0,
      risk_level: h.risk_level ?? "Unknown",
    })),
  };
}

export async function fetchGeopoliticsProfile(
  country: string,
): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    `geopolitics-profile-${country}`,
    `${BASE_URL}/geopolitics/country/${encodeURIComponent(country)}`,
  );
  if (!raw) return null;

  let sanctions: any = null;
  try {
    sanctions = await fetchWithCache<any>(
      `geopolitics-sanctions-${country}`,
      `${BASE_URL}/geopolitics/country/${encodeURIComponent(country)}/sanctions`,
    ).catch(() => null);
  } catch (_) {}

  return {
    ...raw,
    political_system: raw.system_type ?? raw.political_system ?? null,
    political_stability: raw.democracy_score ?? raw.political_stability ?? null,
    diplomatic_centrality: raw.centrality ?? raw.diplomatic_centrality ?? null,
    sanctions_imposed:
      sanctions?.sanctions_imposed_on?.map((s: any) => s.country) ??
      raw.sanctions_imposed ??
      [],
    sanctions_received:
      sanctions?.sanctions_received_from?.map((s: any) => s.country) ??
      raw.sanctions_received ??
      [],
    region: raw.region ?? null,
  };
}

export async function fetchDefenseProfile(
  country: string,
): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    `defense-spending-${country}`,
    `${BASE_URL}/defense/spending/${encodeURIComponent(country)}`,
  );
  if (!raw) return null;

  const arr = Array.isArray(raw) ? raw : [raw];
  const sorted = [...arr].sort(
    (a: any, b: any) => (b.year ?? 0) - (a.year ?? 0),
  );
  const latest = sorted[0];

  return {
    spending_history: sorted,
    spending_2023:
      latest?.amount ??
      latest?.spending_usd_millions ??
      latest?.spending_2023 ??
      latest?.spending_usd ??
      latest?.total_spending ??
      latest?.value ??
      null,
    spending_usd_millions:
      latest?.amount ??
      latest?.spending_usd_millions ??
      latest?.spending_2023 ??
      latest?.spending_usd ??
      latest?.total_spending ??
      latest?.value ??
      null,
    normalized_weight: latest?.normalized_weight ?? latest?.burden ?? null,
    year: latest?.year ?? null,
  };
}

export async function fetchDefenseConflicts(
  country: string,
): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    `defense-conflicts-${country}`,
    `${BASE_URL}/defense/conflicts/${encodeURIComponent(country)}`,
  );
  if (!raw) return null;

  const arr = Array.isArray(raw) ? raw : [raw];
  const sorted = [...arr].sort(
    (a: any, b: any) => (b.year ?? 0) - (a.year ?? 0),
  );
  const latest = sorted[0];
  const totalFatalities = arr.reduce(
    (s: number, r: any) =>
      s + Number(r.total_fatalities ?? r.fatalities ?? r.fatality_count ?? 0),
    0,
  );
  const totalEvents = arr.reduce(
    (s: number, r: any) =>
      s + Number(r.violence_events ?? r.events ?? r.event_count ?? 0),
    0,
  );

  return {
    fatalities:
      latest?.total_fatalities ??
      latest?.fatalities ??
      latest?.fatality_count ??
      totalFatalities,
    events:
      latest?.violence_events ??
      latest?.events ??
      latest?.event_count ??
      totalEvents,
    conflict_trend:
      latest?.fatality_trend ??
      latest?.conflict_trend ??
      latest?.trend ??
      "stable",
    year: latest?.year ?? null,
    history: arr,
  };
}

// ─── Ranking / aggregate endpoints ──────────────────────────────────────────

export async function fetchGlobalRiskRanking(): Promise<any | null> {
  return fetchWithCache<any>(
    "global-risk-ranking",
    `${BASE_URL}/composite/rankings/global-risk`,
  );
}

export async function fetchInfluenceRanking(): Promise<any | null> {
  return fetchWithCache<any>(
    "influence-ranking",
    `${BASE_URL}/composite/rankings/influence`,
  );
}

export async function fetchEconomyInfluenceRanking(): Promise<any | null> {
  return fetchWithCache<any>(
    "economy-influence-ranking",
    `${BASE_URL}/economy/rankings/influence`,
  );
}

export async function fetchCoverageStats(): Promise<any | null> {
  return fetchWithCache<any>(
    "coverage-stats",
    `${BASE_URL}/composite/coverage`,
  );
}

export async function fetchInfluenceNetwork(): Promise<any | null> {
  return fetchWithCache<any>(
    "influence-network",
    `${BASE_URL}/composite/influence-network`,
  );
}

export async function fetchGeopoliticsNetwork(): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    "geopolitics-network",
    `${BASE_URL}/geopolitics/network`,
  );
  if (!raw) return null;

  const arr = Array.isArray(raw) ? raw : [];
  const nodeSet = new Set<string>();
  arr.forEach((r: any) => {
    if (r.country1) nodeSet.add(r.country1);
    if (r.country2) nodeSet.add(r.country2);
  });

  return {
    nodes: Array.from(nodeSet).map((n) => ({ id: n, name: n })),
    edges: arr.map((r: any) => ({
      from: r.country1,
      to: r.country2,
      weight: r.alignment_score ?? 0.5,
    })),
    density:
      nodeSet.size > 1
        ? arr.length / ((nodeSet.size * (nodeSet.size - 1)) / 2)
        : 0,
    raw: arr,
  };
}

export async function fetchGeopoliticsCentralityRanking(): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    "geopolitics-centrality-ranking",
    `${BASE_URL}/geopolitics/rankings/centrality`,
  );
  if (!raw) return null;

  const arr = Array.isArray(raw) ? raw : toArr(raw);
  return arr.map((r: any) => ({
    ...r,
    centrality_score: r.centrality_score ?? r.centrality ?? null,
  }));
}

export async function fetchEconomyTopTradePairs(): Promise<any | null> {
  return fetchWithCache<any>(
    "top-trade-pairs",
    `${BASE_URL}/economy/trade-pairs`,
  );
}

export async function fetchEconomyTradeVulnerabilityRanking(): Promise<
  any | null
> {
  return fetchWithCache<any>(
    "economy-trade-vulnerability",
    `${BASE_URL}/economy/rankings/trade-vulnerability`,
  );
}

export async function fetchClimateGlobalConflictRisk(): Promise<any | null> {
  return fetchWithCache<any>(
    "climate-conflict-risk",
    `${BASE_URL}/climate/impact/conflict-risk`,
  );
}

// ─── fetchSimulateScenarios ──────────────────────────────────────────────────
export async function fetchSimulateScenarios(): Promise<
  { id: string; name: string }[]
> {
  try {
    const res = await fetch(`${BASE_URL}/simulate/scenarios`);
    if (res.ok) {
      const data = await res.json();
      const available: string[] = data.available || [];
      if (available.length > 0) {
        return available.map((id) => ({
          id,
          name: id
            .split("_")
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
        }));
      }
    }
  } catch (_) {}
  return [
    { id: "sanctions", name: "Sanctions" },
    { id: "sanctions_coalition", name: "Sanctions Coalition" },
    { id: "sanctions_removal", name: "Sanctions Removal" },
    { id: "trade_war", name: "Trade War" },
    { id: "trade_agreement", name: "Trade Agreement" },
    { id: "trade_agreement_collapse", name: "Trade Agreement Collapse" },
    { id: "energy_cutoff", name: "Energy Cutoff" },
    { id: "energy_diversification", name: "Energy Diversification" },
    { id: "energy_price_shock", name: "Energy Price Shock" },
    { id: "debt_crisis", name: "Debt Crisis" },
    { id: "export_ban", name: "Export Ban" },
    { id: "gdp_shock", name: "GDP Shock" },
    { id: "conflict_escalation", name: "Conflict Escalation" },
    { id: "conflict_deescalation", name: "Conflict Deescalation" },
    { id: "military_intervention", name: "Military Intervention" },
    { id: "nuclear_threat", name: "Nuclear Threat" },
    { id: "cyber_attack", name: "Cyber Attack" },
    { id: "arms_embargo", name: "Arms Embargo" },
    { id: "defense_spending_surge", name: "Defense Spending Surge" },
    { id: "border_conflict", name: "Border Conflict" },
    { id: "alliance_exit", name: "Alliance Exit" },
    { id: "alliance_formation", name: "Alliance Formation" },
    { id: "alliance_expansion", name: "Alliance Expansion" },
    { id: "diplomatic_breakdown", name: "Diplomatic Breakdown" },
    { id: "diplomatic_normalization", name: "Diplomatic Normalization" },
    { id: "bloc_realignment", name: "Bloc Realignment" },
    { id: "international_isolation", name: "International Isolation" },
    { id: "regime_change", name: "Regime Change" },
    { id: "reunification", name: "Reunification" },
    { id: "climate_disaster", name: "Climate Disaster" },
    { id: "resource_scarcity", name: "Resource Scarcity" },
    { id: "food_supply_shock", name: "Food Supply Shock" },
    { id: "supply_chain_collapse", name: "Supply Chain Collapse" },
    { id: "climate_migration", name: "Climate Migration" },
    { id: "energy_transition", name: "Energy Transition" },
    { id: "state_fragility", name: "State Fragility Assessment" },
    { id: "power_vacuum", name: "Power Vacuum" },
    { id: "hegemony_shift", name: "Hegemony Shift" },
    { id: "regional_destabilization", name: "Regional Destabilization" },
    { id: "global_pandemic", name: "Global Pandemic" },
  ];
}

// ─── fetchDefenseGlobalTotals ────────────────────────────────────────────────
export async function fetchDefenseGlobalTotals(): Promise<{
  total_spending_usd: number;
  total_arms_export_market_share: number;
  nuclear_countries_count: number;
  active_conflicts_count: number;
} | null> {
  try {
    const [spending, arms] = await Promise.all([
      fetchWithCache<any>(
        "defense-spending-top",
        `${BASE_URL}/defense/spending/top?limit=261`,
      ),
      fetchWithCache<any>(
        "defense-arms-top",
        `${BASE_URL}/defense/arms/top?limit=261`,
      ),
    ]);

    if (!spending && !arms) return null;

    const spendingArr = toArr(spending);
    const total_spending =
      spendingArr.reduce((acc: number, c: any) => {
        const val = c.spending_usd_millions ?? c.spending_2023 ?? 0;
        return acc + (parseFloat(val) || 0);
      }, 0) * 1e6;

    const armsArr = toArr(arms);
    const total_arms_tiv = armsArr.reduce((acc: number, c: any) => {
      const val = c.total_tiv ?? c.avg_market_share_pct ?? 0;
      return acc + (parseFloat(val) || 0);
    }, 0);

    return {
      total_spending_usd: total_spending,
      total_arms_export_market_share: total_arms_tiv, // This is TIV, not a percentage!
      nuclear_countries_count: 0,
      active_conflicts_count: 0,
    };
  } catch (error) {
    console.error("Failed to fetch defense global totals:", error);
    return null;
  }
}

// ─── MODULE CONFIGS ──────────────────────────────────────────────────────────
export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  overview: {
    accent: "#4f46e5",
    bgTint: "rgba(79,70,229,0.03)",
    label: "Overview",
  },
  defence: {
    accent: "#b43c3c",
    bgTint: "rgba(180,60,60,0.03)",
    label: "Defence",
  },
  economy: {
    accent: "#328c50", // Restore original green for circles
    bgTint: "rgba(50,140,80,0.03)",
    label: "Economy",
  },
  geopolitics: {
    accent: "#3c64c8",
    bgTint: "rgba(60,100,200,0.03)",
    label: "Geopolitics",
  },
  climate: {
    accent: "#10b981",
    bgTint: "rgba(16,185,129,0.05)",
    label: "Climate Risk",
  },
  simulator: {
    accent: "#6366f1",
    bgTint: "rgba(99,102,241,0.05)",
    label: "Simulation",
  },
};
