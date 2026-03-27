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
  
  // As a final fallback, hunt for ANY array inside the object
  const anyArray = Object.values(data).find(v => Array.isArray(v));
  if (anyArray) return anyArray as any[];

  return [];
}

// ─── fetchAllProfiles ────────────────────────────────────────────────────────
// Merges global-risk + influence + defense spending into CountryProfile[]
// Field names are mapped from the actual API responses.
//
// /composite/rankings/global-risk  → [{country, global_risk}]
// /composite/rankings/influence    → [{country, strategic_influence}]
// /defense/spending/top            → [{country, spending_usd_millions, normalized_weight}]
// /defense/arms/top                → [{country, avg_market_share_pct}]
// /composite/country/:c            → many fields inc nuclear_status, un_p5, etc.
// ────────────────────────────────────────────────────────────────────────────
export async function fetchAllProfiles(): Promise<CountryProfile[] | null> {
  try {
    const [globalRisk, influence, defense, arms] = await Promise.all([
      fetchWithCache<any>("global-risk-all", `${BASE_URL}/composite/rankings/global-risk`),
      fetchWithCache<any>("influence-all",   `${BASE_URL}/composite/rankings/influence`),
      fetchWithCache<any>("defense-spending-all", `${BASE_URL}/defense/spending/top?limit=261`),
      fetchWithCache<any>("defense-arms-all",     `${BASE_URL}/defense/arms/top?limit=261`),
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
      // composite extras that might come back
      if (r.strategic_influence != null) p.diplomatic_centrality = r.strategic_influence;
      if (r.military_strength   != null) p.military_strength   = r.military_strength;
      if (r.nuclear_status      != null) p.nuclear = r.nuclear_status;
      if (r.un_p5               != null) p.p5 = r.un_p5;
      if (r.region              != null) p.region = r.region;
    });

    // strategic_influence → diplomatic_centrality
    toArr(influence).forEach((r: any) => {
      if (!r.country) return;
      const p = getProfile(r.country);
      if (r.strategic_influence != null) p.diplomatic_centrality = r.strategic_influence;
      if (r.military_strength   != null) p.military_strength     = r.military_strength;
      if (r.defense_composite   != null) p.defense_composite     = r.defense_composite;
      if (r.economic_power      != null) p.arms_export           = r.economic_power; // proxy
      if (r.region              != null) p.region                = r.region;
      if (r.nuclear_status      != null) p.nuclear               = r.nuclear_status;
      if (r.un_p5               != null) p.p5                    = r.un_p5;
    });

    // spending_usd_millions → defense_spending (keep raw millions value)
    // normalized_weight → defense_burden (0-1 ratio)
    toArr(defense).forEach((r: any) => {
      if (!r.country) return;
      const p = getProfile(r.country);
      if (r.spending_usd_millions != null) p.defense_spending = r.spending_usd_millions;
      if (r.normalized_weight     != null) p.defense_burden   = r.normalized_weight;
    });

    // avg_market_share_pct → arms_export (0-100, we keep raw)
    toArr(arms).forEach((r: any) => {
      if (!r.country) return;
      const p = getProfile(r.country);
      if (r.avg_market_share_pct != null) p.arms_export = r.avg_market_share_pct / 100; // normalise to 0-1
    });

    return Array.from(profileMap.values());
  } catch (error) {
    console.error("Failed to fetch all profiles:", error);
    return null;
  }
}

// ─── Per-country detail endpoints ────────────────────────────────────────────

export async function fetchCompositeProfile(country: string): Promise<any | null> {
  return fetchWithCache<any>(
    `composite-profile-${country}`,
    `${BASE_URL}/composite/country/${encodeURIComponent(country)}`,
  );
}

export async function fetchEconomyProfile(country: string): Promise<any | null> {
  return fetchWithCache<any>(
    `economy-profile-${country}`,
    `${BASE_URL}/economy/country/${encodeURIComponent(country)}`,
  );
}

export async function fetchEconomyGDP(country: string): Promise<any | null> {
  return fetchWithCache<any>(
    `economy-gdp-${country}`,
    `${BASE_URL}/economy/country/${encodeURIComponent(country)}/gdp`,
  );
}

export async function fetchEconomyPartners(country: string): Promise<any | null> {
  return fetchWithCache<any>(
    `economy-partners-${country}`,
    `${BASE_URL}/economy/country/${encodeURIComponent(country)}/high-dependencies`,
  );
}

export async function fetchClimateProfile(country: string): Promise<any | null> {
  return fetchWithCache<any>(
    `climate-profile-${country}`,
    `${BASE_URL}/climate/country/${encodeURIComponent(country)}`,
  );
}

export async function fetchClimateHazards(country: string): Promise<any | null> {
  return fetchWithCache<any>(
    `climate-hazards-${country}`,
    `${BASE_URL}/climate/country/${encodeURIComponent(country)}/hazard-risk`,
  );
}

export async function fetchGeopoliticsProfile(country: string): Promise<any | null> {
  return fetchWithCache<any>(
    `geopolitics-profile-${country}`,
    `${BASE_URL}/geopolitics/country/${encodeURIComponent(country)}`,
  );
}

export async function fetchDefenseProfile(country: string): Promise<any | null> {
  return fetchWithCache<any>(
    `defense-spending-${country}`,
    `${BASE_URL}/defense/spending/${encodeURIComponent(country)}`,
  );
}

export async function fetchDefenseConflicts(country: string): Promise<any | null> {
  return fetchWithCache<any>(
    `defense-conflicts-${country}`,
    `${BASE_URL}/defense/conflicts/${encodeURIComponent(country)}`,
  );
}

// ─── Ranking / aggregate endpoints ──────────────────────────────────────────

export async function fetchGlobalRiskRanking(): Promise<any | null> {
  return fetchWithCache<any>("global-risk-ranking", `${BASE_URL}/composite/rankings/global-risk`);
}

export async function fetchInfluenceRanking(): Promise<any | null> {
  return fetchWithCache<any>("influence-ranking", `${BASE_URL}/composite/rankings/influence`);
}

export async function fetchEconomyInfluenceRanking(): Promise<any | null> {
  return fetchWithCache<any>("economy-influence-ranking", `${BASE_URL}/economy/rankings/influence`);
}

export async function fetchCoverageStats(): Promise<any | null> {
  return fetchWithCache<any>("coverage-stats", `${BASE_URL}/composite/coverage`);
}

export async function fetchInfluenceNetwork(): Promise<any | null> {
  return fetchWithCache<any>("influence-network", `${BASE_URL}/composite/influence-network`);
}

export async function fetchGeopoliticsNetwork(): Promise<any | null> {
  return fetchWithCache<any>("geopolitics-network", `${BASE_URL}/geopolitics/network`);
}

export async function fetchGeopoliticsCentralityRanking(): Promise<any | null> {
  return fetchWithCache<any>(
    "geopolitics-centrality-ranking",
    `${BASE_URL}/geopolitics/rankings/centrality`,
  );
}

export async function fetchEconomyTopTradePairs(): Promise<any | null> {
  return fetchWithCache<any>("top-trade-pairs", `${BASE_URL}/economy/trade-pairs`);
}

export async function fetchEconomyTradeVulnerabilityRanking(): Promise<any | null> {
  return fetchWithCache<any>(
    "economy-trade-vulnerability",
    `${BASE_URL}/economy/rankings/trade-vulnerability`,
  );
}

export async function fetchClimateGlobalConflictRisk(): Promise<any | null> {
  return fetchWithCache<any>("climate-conflict-risk", `${BASE_URL}/climate/impact/conflict-risk`);
}

export async function fetchSimulateScenarios(): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetch(`${BASE_URL}/simulate/scenarios`);
    if (res.ok) {
      const data = await res.json();
      const available: string[] = data.available || [];
      return available.map(id => ({
        id,
        name: id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      }));
    }
  } catch (_) {}
  return [
    { id: "sanctions",            name: "Sanctions Escalation" },
    { id: "trade_war",            name: "Trade War" },
    { id: "energy_cutoff",        name: "Energy Cutoff" },
    { id: "conflict_escalation",  name: "Kinetic Conflict" },
    { id: "alliance_exit",        name: "Alliance Exit" },
    { id: "climate_disaster",     name: "Severe Climate Disaster" },
  ];
}

export async function fetchDefenseGlobalTotals(): Promise<{
  total_spending_usd: number;
  total_arms_export_market_share: number;
  nuclear_countries_count: number;
  active_conflicts_count: number;
} | null> {
  try {
    const [spending, arms] = await Promise.all([
      fetchWithCache<any>("defense-spending-top", `${BASE_URL}/defense/spending/top?limit=261`),
      fetchWithCache<any>("defense-arms-top",     `${BASE_URL}/defense/arms/top?limit=261`),
    ]);

    if (!spending && !arms) return null;

    const spendingArr = toArr(spending);
    const total_spending = spendingArr.reduce(
      (acc: number, c: any) => acc + (parseFloat(c.spending_usd_millions) || 0),
      0,
    ) * 1e6; // convert millions → absolute USD

    const armsArr = toArr(arms);
    const total_arms_export = armsArr.reduce(
      (acc: number, c: any) => acc + (parseFloat(c.avg_market_share_pct) || 0),
      0,
    );

    return {
      total_spending_usd: total_spending,
      total_arms_export_market_share: total_arms_export,
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
  overview:    { accent: "#4f46e5", bgTint: "rgba(79,70,229,0.03)",  label: "Overview"    },
  defence:     { accent: "#b43c3c", bgTint: "rgba(180,60,60,0.03)",  label: "Defence"     },
  economy:     { accent: "#328c50", bgTint: "rgba(50,140,80,0.03)",  label: "Economy"     },
  geopolitics: { accent: "#3c64c8", bgTint: "rgba(60,100,200,0.03)", label: "Geopolitics" },
  climate:     { accent: "#10b981", bgTint: "rgba(16,185,129,0.05)", label: "Climate Risk" },
  simulator:   { accent: "#6366f1", bgTint: "rgba(99,102,241,0.05)", label: "Simulation"  },
};