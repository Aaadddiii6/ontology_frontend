"use server";

import { complete, parseJSONObject } from "@/lib/llm.server";

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
export async function intelligenceQueryAction(question: string): Promise<QueryResult> {
  try {
    // 1. Route: the LLM picks endpoints + chart shape. Default routing if no LLM.
    const routingPrompt = `You are the Global Intelligence Engine Router.
Analyze the user question and select the most relevant API endpoints to fulfill the request.
Available Endpoints:
${AVAILABLE_ENDPOINTS}

User Question: "${question}"

Output STRICTLY JSON:
{
  "endpoints": ["/endpoint/path"],
  "params": { "limit": 15 },
  "chart_type": "bar" | "line" | "none",
  "chart_x_key": "string",
  "chart_y_key": "string",
  "chart_title": "Descriptive Title",
  "table_columns": [
    { "key": "field", "label": "Label", "format": "pct" | "usd" | "number" | "text" }
  ]
}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- routing JSON comes from the LLM; fields are checked where used
    let routing: any = null;
    const routed = await complete([{ role: "user", content: routingPrompt }], {
      json: true,
      maxTokens: 400,
    });
    if (routed) routing = parseJSONObject(routed.text);
    if (!routing || !Array.isArray(routing.endpoints) || routing.endpoints.length === 0) {
      routing = DEFAULT_ROUTING;
    }

    // 2. Fetch data from the backend (graph).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous rows
    const mergedData: any[] = [];
    const endpointsCalled: string[] = [];

    for (const ep of (routing.endpoints as string[]).slice(0, 3)) {
      const data = await fetchFromBackend(ep, routing.params || {});
      if (!data) continue;
      endpointsCalled.push(ep);
      const rawArr = Array.isArray(data)
        ? data
        : data.results || data.data || (typeof data === "object" ? [data] : []);
      if (Array.isArray(rawArr)) {
        // Flatten nested objects (macro, scores, ...) so columns are top-level
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
        const flattened = rawArr.map((item: any) => {
          const flat = { ...item };
          for (const key of ["macro", "scores", "trends", "temperature", "profile"]) {
            if (item[key] && typeof item[key] === "object") Object.assign(flat, item[key]);
          }
          return flat;
        });
        mergedData.push(...flattened);
      }
    }

    // 3. Summarise. No data → no LLM report: an LLM asked for a report with
    // no data invents one, which this project claims never to do.
    const hasBackendData = mergedData.length > 0;
    let summary: string;
    let summaryBy = "template";
    if (!hasBackendData) {
      summary =
        "No graph data answered this question. Either the backend is not running on port 8000, " +
        "or the pipeline for this domain has not been loaded yet (check the Data status panel).";
    } else {
      const summaryPrompt = `You are a Senior Geopolitical Analyst at the Global Intelligence Engine.
The user asked: "${question}"

Intelligence data from the knowledge graph:
${JSON.stringify(mergedData.slice(0, 30)).slice(0, 12000)}

Write the report:
1. 3-4 paragraphs with sections "STRATEGIC OVERVIEW", "KEY METRICS ANALYSIS" and "OUTLOOK".
2. Reference specific numbers and country names from the data.
3. Use ONLY numbers that appear in the data. Never invent or estimate figures that are not there.
   If the data does not answer part of the question, say which part.
4. Do NOT mention "JSON", "API", or "Backend".`;
      const reply = await complete([{ role: "user", content: summaryPrompt }], { maxTokens: 900 });
      if (reply && reply.text.trim().length >= 50) {
        summary = reply.text.trim();
        summaryBy = reply.provider;
      } else {
        summary =
          `Retrieved ${mergedData.length} rows from ${endpointsCalled.join(", ")}. ` +
          "No language model is configured (set OPENAI_API_KEY), so the data is shown without a written analysis.";
      }
    }

    // Confidence = share of returned rows that actually carry the charted value.
    const yKey: string | undefined = routing.chart_y_key;
    const rowsWithValue = yKey
      ? mergedData.filter((r) => r?.[yKey] !== null && r?.[yKey] !== undefined).length
      : mergedData.length;
    const confidence = hasBackendData ? Math.round((rowsWithValue / mergedData.length) * 100) : 0;

    return {
      summary,
      endpoints_called: endpointsCalled,
      data: mergedData.slice(0, 50),
      chart_type: routing.chart_type || "none",
      chart_x_key: routing.chart_x_key,
      chart_y_key: routing.chart_y_key,
      chart_title: routing.chart_title,
      table_columns: routing.table_columns || [],
      confidence,
      is_fallback: !hasBackendData,
      summary_by: summaryBy,
    };
  } catch (error: unknown) {
    console.error("Intelligence Query Action failed:", error);
    return {
      summary: "An error occurred during query processing.",
      endpoints_called: [],
      data: [],
      chart_type: "none",
      chart_x_key: "",
      chart_y_key: "",
      chart_title: "",
      table_columns: [],
      confidence: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
