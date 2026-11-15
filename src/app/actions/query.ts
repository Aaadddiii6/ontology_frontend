"use server";

import { askGraph } from "@/app/actions/simulate";

// ─── Query Result Interface ──────────────────────────────────────────────────
export interface QueryResult {
  summary: string; // Detailed narrative answer
  endpoints_called: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows from several endpoints with different shapes
  data: any[]; // raw array of objects for table/chart
  chart_type: "bar" | "line" | "none";
  chart_x_key: string; // e.g. "country"
  chart_y_key: string; // e.g. "global_risk"
  chart_title: string;
  table_columns: {
    key: string;
    label: string;
    format?: "pct" | "usd" | "number" | "text";
  }[];
  confidence: number; // 0-100: share of returned rows that carry the charted value
  is_fallback?: boolean;
  summary_by?: string; // "openai" | "gemini" | "template"
  error?: string;
}

const BACKEND_BASE_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const AVAILABLE_ENDPOINTS = `
GET /composite/rankings/global-risk?limit=N   → [{country, global_risk}]
GET /composite/rankings/influence?limit=N     → [{country, strategic_influence, military_strength}]
GET /composite/country/:name                  → full composite profile
GET /defense/spending/top?limit=N             → [{country, spending_usd_millions, year}]
GET /defense/arms/top?limit=N                 → [{country, avg_market_share_pct}]
GET /defense/conflicts/:country               → {fatalities, events}
GET /economy/rankings/influence?limit=N       → [{country, strategic_influence}]
GET /economy/country/:name                    → {gdp_usd, avg_inflation, economic_risk_score}
GET /economy/trade-pairs?limit=N              → [{country_a, country_b, normalized_weight}]
GET /geopolitics/network                      → {nodes:[], edges:[{from,to,weight}], density}
GET /geopolitics/rankings/centrality?limit=N  → [{country, centrality_score}]
GET /geopolitics/country/:name                → {political_system, sanctions_imposed, sanctions_received}
GET /climate/country/:name                    → {climate_risk_score, emissions_level, avg_temperature}
GET /climate/impact/conflict-risk?limit=N     → [{source_country, at_risk_country, conflict_score}]
GET /composite/coverage                       → {total_countries, has_global_risk, has_influence}
`;

// Read-only endpoints the router may call. The LLM's choice is checked
// against this list so model output can never reach an arbitrary backend path.
const ALLOWED_PATHS = [
  /^\/composite\/rankings\/(global-risk|influence)$/,
  /^\/composite\/country\/[^/?#]+$/,
  /^\/composite\/coverage$/,
  /^\/defense\/(spending|arms)\/top$/,
  /^\/defense\/conflicts\/[^/?#]+$/,
  /^\/economy\/rankings\/influence$/,
  /^\/economy\/country\/[^/?#]+$/,
  /^\/economy\/trade-pairs$/,
  /^\/geopolitics\/network$/,
  /^\/geopolitics\/rankings\/centrality$/,
  /^\/geopolitics\/country\/[^/?#]+$/,
  /^\/climate\/country\/[^/?#]+$/,
  /^\/climate\/impact\/conflict-risk$/,
];

const DEFAULT_ROUTING = {
  endpoints: ["/composite/rankings/global-risk"],
  params: { limit: 10 },
  chart_type: "bar" as const,
  chart_x_key: "country",
  chart_y_key: "global_risk",
  chart_title: "Global Risk Index",
  table_columns: [
    { key: "country", label: "Country", format: "text" as const },
    { key: "global_risk", label: "Risk Score", format: "pct" as const },
  ],
};

// ─── Helper: Fetch from Backend ──────────────────────────────────────────────
async function fetchFromBackend(endpoint: string, params: Record<string, unknown> = {}) {
  const path = endpoint.split("?")[0];
  if (!ALLOWED_PATHS.some((re) => re.test(path))) {
    console.warn(`Router picked a non-allowlisted endpoint, ignored: ${endpoint}`);
    return null;
  }
  try {
    const url = new URL(`${BACKEND_BASE_URL}${path}`);
    for (const [key, val] of Object.entries(params)) {
      if (key === "limit") {
        url.searchParams.set("limit", String(Math.min(100, Math.max(1, Number(val) || 15))));
      } else if (key === "min_score" || key === "year") {
        url.searchParams.set(key, String(Number(val)));
      }
    }
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error(`Backend fetch failed for ${endpoint}:`, e);
    return null;
  }
}

// ─── Main Action ─────────────────────────────────────────────────────────────
// Uses the backend query engine (/graph/ask) so this page and the search modal
// give the same graph-grounded answers. Rows come back as a table + chart.
export async function intelligenceQueryAction(question: string): Promise<QueryResult> {
  const r = await askGraph(question);
  if (r.error) {
    return {
      summary: r.error,
      endpoints_called: [],
      data: [],
      chart_type: "none",
      chart_x_key: "",
      chart_y_key: "",
      chart_title: "",
      table_columns: [],
      confidence: 0,
      is_fallback: true,
      error: r.error,
    };
  }
  const textCol = r.columns.find((c) => c.format === "text")?.key ?? "";
  const valueCol =
    r.columns.find((c) => c.key === "value")?.key ?? r.columns.find((c) => c.format === "number")?.key ?? "";
  const rowsWithValue = valueCol
    ? r.rows.filter((row) => row[valueCol] !== null && row[valueCol] !== undefined).length
    : r.rows.length;
  return {
    summary: r.synthesized_answer,
    endpoints_called: r.endpoints,
    data: r.rows,
    chart_type: textCol && valueCol && r.rows.length > 1 ? "bar" : "none",
    chart_x_key: textCol,
    chart_y_key: valueCol,
    chart_title: r.metric_label ?? "",
    table_columns: r.columns.map((c) => ({
      key: c.key,
      label: c.label,
      format: c.format === "text" ? ("text" as const) : /USD/.test(c.label) ? ("usd" as const) : ("number" as const),
    })),
    confidence: r.rows.length ? Math.round((rowsWithValue / r.rows.length) * 100) : 0,
    is_fallback: r.rows.length === 0,
    summary_by: r.answered_by,
  };
}
