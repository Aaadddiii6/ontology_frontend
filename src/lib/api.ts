import { CountryProfile, ModuleConfig } from "../types";

const BASE_URL = "/api/backend";

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;
const NETWORK_ERROR_LOG_THROTTLE_MS = 5 * 60 * 1000;
// Longer timeout to handle Render cold starts (free tier spins down after inactivity)
const FETCH_TIMEOUT_MS = 45000;
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
    timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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
  // One query on the backend (/graph/profiles) returns every country's
  // stored scores with their real names. The old version stitched four
  // endpoints together and relabelled fields (global risk was shown as
  // "conflict risk" AND "live risk", economic power as "arms export").
  try {
    const [rows, defense] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- row shape documented in api/graph_layers.py
      fetchWithCache<{ profiles: any[] }>("graph-profiles", `${BASE_URL}/graph/profiles`),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchWithCache<any>("defense-spending-all", `${BASE_URL}/defense/spending/top?limit=261`),
    ]);
    if (!rows?.profiles) return null;
    const spending = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toArr(defense).forEach((r: any) => r.country && r.spending_usd_millions != null && spending.set(r.country, Number(r.spending_usd_millions)));

    return rows.profiles.map((r) => {
      const nuclear = r.nuclear ? String(r.nuclear).toLowerCase() : null;
      const profile: CountryProfile = {
        country: r.country,
        iso: r.iso ?? null,
        region: r.region ?? null,
        alliances: r.alliances ?? [],
        nuclear: nuclear === "confirmed" ? "confirmed" : nuclear === "undeclared" ? "undeclared" : null,
        p5: r.p5 ?? null,
        regional_power: r.regional_power ?? null,
        global_risk: r.global_risk ?? undefined,
        defense_composite: r.global_risk ?? undefined,
        strategic_influence: r.strategic_influence ?? undefined,
        vulnerability: r.vulnerability ?? undefined,
        conflict_risk: r.conflict_risk ?? undefined,
        live_risk: r.live_risk ?? undefined,
        military_strength: r.military_strength ?? undefined,
        arms_export: r.arms_export_score ?? undefined,
        economic_influence: r.economic_influence ?? undefined,
        trade_vulnerability: r.trade_vulnerability ?? undefined,
        energy_vulnerability: r.energy_vulnerability ?? undefined,
        diplomatic_centrality: r.diplomatic_centrality ?? undefined,
        climate_risk: r.climate_risk ?? undefined,
        gdp_usd: r.gdp_usd_bn != null ? Number(r.gdp_usd_bn) * 1e9 : undefined,
        defense_spending: spending.get(r.country),
      };
      return profile;
    });
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
    `geopolitics-profile-v6-${country}`,
    `${BASE_URL}/geopolitics/country/${encodeURIComponent(country)}`,
  );
  if (!raw) return null;

  // Real shape: { country, democracy_score, system_type, centrality, region,
  //   alliances, top_diplomatic_partners, top_unga_allies, nuclear_status }
  return {
    ...raw,
    political_system: raw.system_type ?? raw.political_system ?? null,
    political_stability: raw.democracy_score ?? null,
    diplomatic_centrality: raw.centrality ?? null,
    region: raw.region ?? null,
    alliances: raw.alliances ?? [],
    top_partners: (raw.top_diplomatic_partners ?? []).map((p: any) => p.country),
    sanctions_imposed: raw.sanctions_imposed ?? [],
    sanctions_received: raw.sanctions_received ?? [],
  };
}

export async function fetchDefenseProfile(
  country: string,
): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    `defense-spending-v6-${country}`,
    `${BASE_URL}/defense/spending/${encodeURIComponent(country)}`,
  );
  if (!raw) return null;

  // Real shape: { country, data: [{year, amount}] }  (amount = USD millions)
  const arr: any[] = Array.isArray(raw.data) ? raw.data
    : Array.isArray(raw) ? raw
    : [];

  const sorted = [...arr].sort((a: any, b: any) => (b.year ?? 0) - (a.year ?? 0));
  const latest = sorted[0];
  const amountMillions = latest?.amount ?? latest?.spending_usd_millions ?? null;

  return {
    spending_history: sorted.map((r: any) => ({
      year: r.year,
      amount: r.amount ?? r.spending_usd_millions ?? 0,
    })),
    spending_2023: amountMillions,
    spending_usd_millions: amountMillions,
    year: latest?.year ?? null,
  };
}

export async function fetchDefenseConflicts(
  country: string,
): Promise<any | null> {
  const raw = await fetchWithCache<any>(
    `defense-conflicts-v6-${country}`,
    `${BASE_URL}/defense/conflicts/${encodeURIComponent(country)}`,
  );
  if (!raw) return null;

  // Real shape: { country, data: [{year, events, fatalities}] }
  const arr: any[] = Array.isArray(raw.data) ? raw.data
    : Array.isArray(raw) ? raw
    : [];

  const sorted = [...arr].sort((a: any, b: any) => (b.year ?? 0) - (a.year ?? 0));
  const latest = sorted[0];

  return {
    fatalities: latest?.fatalities ?? null,
    events: latest?.events != null ? Math.round(latest.events) : null,
    conflict_trend: "stable",
    year: latest?.year ?? null,
    history: sorted,
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

// ─── Scenario catalogue (structured simulator) ───────────────────────────────
// Backend /simulate/scenarios returns, per scenario type, what the actor and
// target slots mean. The UI uses it to label inputs and hide unused ones.
export interface ScenarioInfo {
  type: string;
  domain: "economy" | "defense" | "geopolitics" | "climate" | "composite";
  label: string;
  actor: string | null;
  target: string | null;
  target_kind: "country" | "alliance" | "bloc" | "region" | "none";
  example: string;
  available: boolean;
}

export async function fetchScenarioCatalog(): Promise<ScenarioInfo[]> {
  const data = await fetchWithCache<{ catalog?: ScenarioInfo[] }>(
    "simulate-catalog",
    `${BASE_URL}/simulate/scenarios`,
  );
  return data?.catalog ?? [];
}

// ─── Health / data status ────────────────────────────────────────────────────
export interface HealthInfo {
  api: string;
  neo4j: { host: string | null; status: "ok" | "error" | "unknown"; error?: string };
  llm: { order: string[]; configured: string[]; cooling_down: Record<string, number>; openai_model: string };
  graph?: {
    node_counts: Record<string, number>;
    relationship_counts: Record<string, number>;
    total_nodes: number;
    total_relationships: number;
    countries: number;
    score_coverage: Record<string, number>;
    domains: Record<string, { loaded: boolean; edges: Record<string, number> }>;
    trade_years: { min_year?: number | null; max_year?: number | null };
  };
}

/** Not cached: the status panel should reflect a rebuild immediately. */
export async function fetchHealth(): Promise<HealthInfo | null> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return (await res.json()) as HealthInfo;
  } catch {
    return null;
  }
}

// ─── Graph layers: map lines + choropleth metrics, straight from Neo4j ───────
export interface GraphLayerInfo {
  key: string;
  label: string;
  domain: string;
  color: string;
  unit: string;
  source: string;
  directed: boolean;
  available_edges: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  from_iso: string | null;
  to_iso: string | null;
  value: number;
  year: number | null;
  weight: number;
  label: string;
}

export interface GraphRelations {
  layer: string;
  label: string;
  color: string;
  unit: string;
  source: string;
  directed: boolean;
  edges: GraphEdge[];
}

export interface GraphMetricInfo {
  key: string;
  label: string;
  domain: string;
  unit: string;
  direction: "up" | "down" | null;
  source: string;
}

export interface GraphMetricValues {
  key: string;
  values: { country: string; iso: string | null; value: number; year: number | null }[];
  count: number;
  min: number | null;
  max: number | null;
  p05: number | null;
  p95: number | null;
}

export async function fetchGraphLayers(): Promise<GraphLayerInfo[]> {
  const d = await fetchWithCache<{ layers: GraphLayerInfo[] }>("graph-layers", `${BASE_URL}/graph/layers`);
  return d?.layers ?? [];
}

export async function fetchGraphRelations(layer: string, limit: number, country?: string | null): Promise<GraphRelations | null> {
  const qs = new URLSearchParams({ layer, limit: String(limit) });
  if (country) qs.set("country", country);
  return fetchWithCache<GraphRelations>(`graph-rel-${qs}`, `${BASE_URL}/graph/relations?${qs}`);
}

export async function fetchGraphMetrics(): Promise<GraphMetricInfo[]> {
  const d = await fetchWithCache<{ metrics: GraphMetricInfo[] }>("graph-metrics", `${BASE_URL}/graph/metrics`);
  return d?.metrics ?? [];
}

export async function fetchGraphMetric(key: string): Promise<GraphMetricValues | null> {
  return fetchWithCache<GraphMetricValues>(`graph-metric-${key}`, `${BASE_URL}/graph/metric?key=${encodeURIComponent(key)}`);
}

/** ISO numeric (zero-padded, as in the map file) -> graph country name. */
export async function fetchGraphCountries(): Promise<Map<string, string>> {
  const d = await fetchWithCache<{ countries: { name: string; iso: string | null }[] }>(
    "graph-countries",
    `${BASE_URL}/graph/countries`,
  );
  const m = new Map<string, string>();
  for (const c of d?.countries ?? []) if (c.iso) m.set(String(c.iso).padStart(3, "0"), c.name);
  return m;
}

export interface CountryIndicator {
  code: string;
  key: string;
  label: string;
  unit: string;
  domain: string;
  direction: "up" | "down" | null;
  source: string;
  series: { year: number; value: number; projected: boolean }[];
}

export async function fetchCountryIndicators(country: string): Promise<CountryIndicator[]> {
  const d = await fetchWithCache<{ indicators: CountryIndicator[] }>(
    `country-ind-${country}`,
    `${BASE_URL}/graph/country/${encodeURIComponent(country)}/indicators`,
  );
  return d?.indicators ?? [];
}

// ─── Full country profile (one request, every number from the graph) ─────────
export interface SeriesPoint {
  year: number;
  value: number | null;
}

export interface CountryProfileFull {
  country: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw node properties vary by loaded domains
  properties: Record<string, any>;
  alliances: string[];
  region: string[];
  political: { system: string; score: number | null; year: number } | null;
  gdp: SeriesPoint[];
  inflation: SeriesPoint[];
  defense_spending: SeriesPoint[];
  conflict: { year: number; fatalities: number | null; violence_events: number | null; civilian_events: number | null; trend: string | null }[];
  arms_exports: SeriesPoint[];
  export_partners: { country: string; value: number; year: number }[];
  import_partners: { country: string; value: number; year: number }[];
  energy_suppliers: { country: string; value: number; share: number | null }[];
  trade_totals: { year: number; exports: number | null; imports: number | null } | null;
  agreements: { partners: number; names: string[] } | null;
  sanctions_received: { by: string; entities: number }[];
  sanctions_imposed: { on: string; entities: number }[];
  aligned: { country: string; similarity: number }[];
  opposed: { country: string; score: number }[];
  bloc: { bloc_id: number; members: number; sample: string[] } | null;
  diplomacy: { country: string; events: number }[];
  disasters: { rel: string; kind: string; name: string | null; year: number | null }[];
  connections: { type: string; n: number }[];
  risk_rank: { rank: number; of: number } | null;
}

export async function fetchCountryProfile(country: string): Promise<CountryProfileFull | null> {
  return fetchWithCache<CountryProfileFull>(
    `country-profile-full-${country}`,
    `${BASE_URL}/graph/country/${encodeURIComponent(country)}/profile`,
  );
}
