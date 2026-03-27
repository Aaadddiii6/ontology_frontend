"use server";

// ─── Query Result Interface ──────────────────────────────────────────────────
export interface QueryResult {
  summary: string; // Detailed narrative answer
  endpoints_called: string[];
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
  confidence: number; // 0-100
  is_fallback?: boolean;
  error?: string;
}

const BACKEND_BASE_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const AVAILABLE_ENDPOINTS = `
GET /composite/rankings/global-risk?limit=N   → [{country, global_risk}]
GET /composite/rankings/influence?limit=N     → [{country, strategic_influence, military_strength}]
GET /composite/country/:name                  → full composite profile
GET /defense/spending/top?limit=N             → [{country, spending_usd_millions}]
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

// ─── Helper: Gemini Chat Completion ──────────────────────────────────────────
async function callGemini(prompt: string, responseFormat?: "json_object") {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        ...(responseFormat === "json_object"
          ? { response_mime_type: "application/json" }
          : {}),
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// ─── Helper: Fetch from Backend ──────────────────────────────────────────────
async function fetchFromBackend(
  endpoint: string,
  params: Record<string, any> = {},
) {
  try {
    const url = new URL(`${BACKEND_BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, val]) =>
      url.searchParams.append(key, String(val)),
    );

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error(`Backend fetch failed for ${endpoint}:`, e);
    return null;
  }
}

// ─── Main Action ─────────────────────────────────────────────────────────────
export async function intelligenceQueryAction(
  question: string,
): Promise<QueryResult> {
  try {
    // STEP 1: Route with Gemini
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

    let routing: any;
    try {
      const routingRaw = await callGemini(routingPrompt, "json_object");
      routing = JSON.parse(routingRaw);
    } catch (e) {
      console.warn("Gemini routing failed, using default routing.", e);
      routing = {
        endpoints: ["/composite/rankings/global-risk"],
        params: { limit: 10 },
        chart_type: "bar",
        chart_x_key: "country",
        chart_y_key: "global_risk",
        chart_title: "Global Risk Index",
        table_columns: [
          { key: "country", label: "Country", format: "text" },
          { key: "global_risk", label: "Risk Score", format: "pct" },
        ],
      };
    }

    // STEP 2: Fetch Data from Backend
    const mergedData: any[] = [];
    const endpointsCalled: string[] = [];

    for (const ep of routing.endpoints || []) {
      const data = await fetchFromBackend(ep, routing.params || {});
      if (data) {
        endpointsCalled.push(ep);
        // Normalize array data
        const rawArr = Array.isArray(data)
          ? data
          : data.results || data.data || [];

        if (Array.isArray(rawArr)) {
          // Flatten nested data (macro, scores, trends) so Gemini sees clean fields
          const flattened = rawArr.map((item: any) => {
            const flat: any = { ...item };
            ["macro", "scores", "trends", "temperature"].forEach((key) => {
              if (item[key] && typeof item[key] === "object") {
                Object.assign(flat, item[key]);
              }
            });
            return flat;
          });
          mergedData.push(...flattened);
        }
      }
    }

    // STEP 3: Summarize / Generate Report
    const hasBackendData = mergedData.length > 0;
    const dataContext = hasBackendData
      ? JSON.stringify(mergedData).slice(0, 8000)
      : "NO_LIVE_DATA_AVAILABLE";

    const summaryPrompt = `You are a Senior Geopolitical Analyst. 
The user asked: "${question}"

Data from Intelligence Engine:
${dataContext}

Requirements:
1. Provide a COMPREHENSIVE and DETAILED intelligence report. 
2. Use multiple sections and paragraphs.
3. Include specific metrics, country names, and trends found in the data.
4. If NO_LIVE_DATA_AVAILABLE, answer using your extensive internal knowledge but add a footnote: "⚠️ Answer generated from AI knowledge — live backend data unavailable".
5. Do not mention JSON or API technicalities in the summary.
6. Ensure the report is formatted for high-level decision makers.`;

    let summary: string;
    try {
      summary = await callGemini(summaryPrompt);
    } catch (e) {
      // Fallback to backend synthesis if Gemini summary fails
      summary = hasBackendData
        ? "Data retrieved successfully. Refer to the charts and tables for detailed metrics."
        : "Intelligence network unreachable. Please ensure the backend is running on port 8000.";
    }

    return {
      summary,
      endpoints_called: endpointsCalled,
      data: mergedData.slice(0, 50), // Limit UI display
      chart_type: routing.chart_type || "none",
      chart_x_key: routing.chart_x_key,
      chart_y_key: routing.chart_y_key,
      chart_title: routing.chart_title,
      table_columns: routing.table_columns || [],
      confidence: hasBackendData ? 95 : 65,
      is_fallback: !hasBackendData,
    };
  } catch (error: any) {
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
      error: error.message || "Unknown error",
    };
  }
}
