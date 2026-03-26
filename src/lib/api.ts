import { CountryProfile, ModuleConfig } from "../types";

const BASE_URL = "http://127.0.0.1:8000";

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const NETWORK_ERROR_LOG_THROTTLE_MS = 5 * 60 * 1000; // avoid console spam
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
    timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15s

    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      // Gracefully handle 404/500 without throwing (but throttle logs)
      if (shouldLogKey(`${url}:status:${response.status}`)) {
        console.warn(`API returned ${response.status} for ${url}`);
      }
      return null;
    }

    const data = (await response.json()) as T;
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    // Catch TypeError: Failed to fetch (network errors)
    const err = error as any;
    if (err.name === "AbortError") {
      // Quietly handle aborted requests (common during navigation/tab switching)
      return null;
    }

    if (shouldLogKey(`${url}:network`)) {
      const message =
        typeof err?.message === "string" ? err.message : String(error);
      console.warn(`Network error fetching ${url}: ${message}`);
    }
    return null;
  } finally {
    // Ensure the fetch timeout is always cleared.
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function fetchAllProfiles(): Promise<CountryProfile[] | null> {
  try {
    const data = await fetchWithCache<{ profiles: CountryProfile[] }>(
      "all-profiles",
      `${BASE_URL}/simulator/profiles?limit=261`,
    );
    return data ? data.profiles : null;
  } catch (error) {
    console.error("Failed to fetch all profiles:", error);
    return null;
  }
}

export async function fetchCountryProfile(
  name: string,
): Promise<CountryProfile | null> {
  try {
    const response = await fetch(
      `${BASE_URL}/defense/profile/${encodeURIComponent(name)}`,
    );
    if (!response.ok) {
      console.warn(`API returned ${response.status} for profile ${name}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`Network error fetching profile for ${name}:`, error);
    return null;
  }
}

export async function fetchHealth(): Promise<{
  status: string;
  neo4j: string;
  total_nodes: number;
} | null> {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) {
      console.warn(`API returned ${response.status} for health check`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Network error fetching health:", error);
    return null;
  }
}

export interface GlobalStatsData {
  globalStability: number; // 0-100 percentage
  stabilityDelta: number; // change e.g. +1.2
  activeThreats: number; // integer count
  threatsDelta: number; // change e.g. -3
  intelligenceNodes: number; // count of countries with scores
  nodesDelta: number; // change
  dataThroughput: string; // e.g. "4.2 TB/s" — static display value
}

export async function fetchCompositeProfile(
  country: string,
): Promise<any | null> {
  try {
    const response = await fetch(
      `${BASE_URL}/composite/country/${encodeURIComponent(country)}`,
    );
    if (!response.ok) {
      console.warn(
        `API returned ${response.status} for composite profile ${country}`,
      );
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(
      `Network error fetching composite profile for ${country}:`,
      error,
    );
    return null;
  }
}

export async function fetchEconomyProfile(
  country: string,
): Promise<any | null> {
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

export async function fetchEconomyPartners(
  country: string,
): Promise<any | null> {
  return fetchWithCache<any>(
    `economy-partners-${country}`,
    `${BASE_URL}/economy/country/${encodeURIComponent(country)}/high-dependencies`,
  );
}

export async function fetchClimateProfile(
  country: string,
): Promise<any | null> {
  return fetchWithCache<any>(
    `climate-profile-${country}`,
    `${BASE_URL}/climate/country/${encodeURIComponent(country)}`,
  );
}

export async function fetchClimateHazards(
  country: string,
): Promise<any | null> {
  return fetchWithCache<any>(
    `climate-hazards-${country}`,
    `${BASE_URL}/climate/country/${encodeURIComponent(country)}/hazard-risk`,
  );
}

export async function fetchGeopoliticsProfile(
  country: string,
): Promise<any | null> {
  return fetchWithCache<any>(
    `geopolitics-profile-${country}`,
    `${BASE_URL}/geopolitics/country/${encodeURIComponent(country)}`,
  );
}

export async function fetchDefenseProfile(
  country: string,
): Promise<any | null> {
  return fetchWithCache<any>(
    `defense-spending-${country}`,
    `${BASE_URL}/defense/spending/${encodeURIComponent(country)}`,
  );
}

export async function fetchDefenseConflicts(
  country: string,
): Promise<any | null> {
  return fetchWithCache<any>(
    `defense-conflicts-${country}`,
    `${BASE_URL}/defense/conflicts/${encodeURIComponent(country)}`,
  );
}

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
  return fetchWithCache<any>(
    "geopolitics-network",
    `${BASE_URL}/geopolitics/network`,
  );
}

export async function fetchEconomyTopTradePairs(): Promise<any | null> {
  return fetchWithCache<any>(
    "top-trade-pairs",
    `${BASE_URL}/economy/trade-pairs`,
  );
}

export async function fetchClimateGlobalConflictRisk(): Promise<any | null> {
  return fetchWithCache<any>(
    "climate-conflict-risk",
    `${BASE_URL}/climate/impact/conflict-risk`,
  );
}

export async function fetchDefenseGlobalTotals(): Promise<{
  total_spending_usd: number;
  total_arms_export_tiv: number;
  total_arms_import_tiv: number;
  nuclear_countries_count: number;
  active_conflicts_count: number;
} | null> {
  try {
    const [spending, arms, conflicts] = await Promise.all([
      fetchWithCache<any>(
        "defense-spending-top",
        `${BASE_URL}/defense/spending/top?limit=100`,
      ),
      fetchWithCache<any>(
        "defense-arms-top",
        `${BASE_URL}/defense/arms/top?limit=100`,
      ),
      fetchWithCache<any>(
        "defense-conflicts-top",
        `${BASE_URL}/defense/conflicts/top?limit=100`,
      ),
    ]);

    if (!spending && !arms && !conflicts) return null;

    // SIPRI spending_2023 is in Millions of USD, so convert to absolute USD
    const total_spending =
      (spending?.data || []).reduce(
        (acc: number, c: any) => acc + (c.spending_2023 || 0),
        0,
      ) * 1e6;

    // TIV is a Trend Indicator Value, but we'll sum it up as a proxy for volume
    const total_arms_export = (arms?.data || []).reduce(
      (acc: number, c: any) => acc + (c.total_tiv || 0),
      0,
    );

    // Since we don't have a direct import endpoint, we'll assume global exports = global imports for the system
    const total_arms_import = total_arms_export;

    // For nuclear and conflicts, we'll need to use the profileMap in the component for real counts,
    // but we can provide placeholders or just leave them as 0 here and let the component handle it.
    return {
      total_spending_usd: total_spending,
      total_arms_export_tiv: total_arms_export,
      total_arms_import_tiv: total_arms_import,
      nuclear_countries_count: 0, // Handled by component
      active_conflicts_count: 0, // Handled by component
    };
  } catch (error) {
    console.error("Failed to fetch defense global totals:", error);
    return null;
  }
}

export async function fetchGraphSummary(): Promise<{
  relationships: { rel: string; cnt: number }[];
} | null> {
  return fetchWithCache<{
    relationships: { rel: string; cnt: number }[];
  }>("graph-summary", `${BASE_URL}/graph/summary`);
}

export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  overview: {
    accent: "#1e293b",
    bgTint: "rgba(30,41,59,0.02)",
    label: "Overview",
  },
  defence: {
    accent: "#b43c3c",
    bgTint: "rgba(180,60,60,0.03)",
    label: "Defence",
  },
  economy: {
    accent: "#328c50",
    bgTint: "rgba(50,140,80,0.03)",
    label: "Economy",
  },
  geopolitics: {
    accent: "#3c64c8",
    bgTint: "rgba(60,100,200,0.03)",
    label: "Geopolitics",
  },
  climate: {
    accent: "#b4781e",
    bgTint: "rgba(180,120,30,0.03)",
    label: "Climate",
  },
};
