"use server";

// ─── Simulation actions ───────────────────────────────────────────────────────
// Every number shown in the simulator comes from the Python backend, which
// computes it from the Neo4j graph. There is deliberately NO "ask an LLM to
// guess the numbers" fallback: the paper's claim is that every figure is
// traceable to graph data, and a guessed fallback would silently break that.
// If the backend is down we return an explicit error instead.
//
// Two modes:
//   runSimulationAction      structured (scenario + actor + target). Needs no LLM.
//   runQuerySimulationAction plain English. Backend parses it (OpenAI → rules).
// ─────────────────────────────────────────────────────────────────────────────

import { complete, parseJSONObject } from "@/lib/llm.server";

const BASE_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export interface ScoreDeltaUI {
  score_name: string;
  current: number;
  delta: number;
  projected: number;
  direction: string;
  confidence: number;
}

export interface AffectedCountryUI {
  country: string;
  severity: "critical" | "high" | "medium" | "low";
  impact_type: string;
  summary: string;
  impact_detail: string;
  score_deltas: ScoreDeltaUI[];
  exposure_usd: number | null;
  delta: number | null;
}

export interface SimulationUI {
  ok: true;
  headline: string;
  summary: string;
  confidenceScore: number;
  computationTime?: string;
  affectedCountries: AffectedCountryUI[];
  cascadeEffects: { mechanism: string; affected: string; description: string; event: string; severity: string }[];
  dataSources: string[];
  missingData: string[];
  notes: string[];
  year: number;
  scenarioType: string;
  actor: string | null;
  target: string | null;
  parsedBy: string | null;
  narrativeBy: string | null;
  globalRiskDelta: number | null;
}

export interface SimulationError {
  ok: false;
  error: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- backend JSON is validated field by field below */
function normalise(data: any): SimulationUI {
  const result = data.result ?? data;
  const parsed = data.parsed ?? {};
  const affected: AffectedCountryUI[] = (result.affected_countries ?? []).map((c: any) => ({
    country: c.country,
    severity: c.severity ?? "low",
    impact_type: c.impact_type ?? "direct",
    summary: c.summary ?? "",
    impact_detail: c.summary ?? "",
    score_deltas: Array.isArray(c.score_deltas) ? c.score_deltas : [],
    exposure_usd: typeof c.exposure_usd === "number" ? c.exposure_usd : null,
    delta: Array.isArray(c.score_deltas)
      ? parseFloat(c.score_deltas.reduce((acc: number, d: any) => acc + (d.delta ?? 0), 0).toFixed(4))
      : null,
  }));

  return {
    ok: true,
    headline: result.headline || "",
    summary: result.summary || "",
    confidenceScore: Math.round((result.confidence ?? 0) * 100),
    computationTime:
      typeof result.computation_time_ms === "number"
        ? `${(result.computation_time_ms / 1000).toFixed(2)}s`
        : undefined,
    affectedCountries: affected,
    cascadeEffects: (result.cascade_effects ?? []).map((e: any) => ({
      mechanism: e.mechanism,
      affected: e.affected,
      description: e.description,
      event: e.description,
      severity: e.severity,
    })),
    dataSources: result.data_sources ?? [],
    missingData: result.missing_data ?? [],
    notes: result.notes ?? [],
    year: result.year ?? parsed.year,
    scenarioType: result.scenario_type ?? parsed.scenario_type ?? "unknown",
    actor: result.actor ?? parsed.actor ?? null,
    target: result.target ?? parsed.target ?? null,
    parsedBy: parsed.parsed_by ?? null,
    narrativeBy: result.narrative_by ?? null,
    globalRiskDelta: typeof result.global_risk_delta === "number" ? result.global_risk_delta : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function postSimulate(body: Record<string, unknown>): Promise<SimulationUI | SimulationError> {
  try {
    const res = await fetch(`${BASE_URL}/simulate/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `Backend returned ${res.status}: ${detail.slice(0, 300)}` };
    }
    return normalise(await res.json());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Simulation backend unreachable at ${BASE_URL} (${msg}). Start it with: uvicorn api.main:app --port 8000`,
    };
  }
}

export async function runSimulationAction(params: {
  scenario: string;
  actor: string | null;
  target: string | null;
  magnitude: number;
  year: number;
}): Promise<SimulationUI | SimulationError> {
  return postSimulate({
    scenario_type: params.scenario,
    actor: params.actor,
    target: params.target,
    magnitude: params.magnitude,
    year: params.year,
  });
}

export async function runQuerySimulationAction(params: {
  query: string;
  magnitude: number;
  year: number;
}): Promise<SimulationUI | SimulationError> {
  const query = params.query.trim();
  if (!query) return { ok: false, error: "Type a question first." };
  if (query.length > 500) return { ok: false, error: "Question too long (max 500 characters)." };
  return postSimulate({ query, magnitude: params.magnitude, year: params.year });
}

// ─── Quick intelligence query (search modal) ────────────────────────────────
// The LLM only picks which read-only endpoint answers the question and then
// summarises the rows it got back. Endpoints are checked against an allowlist
// so model output can never reach an arbitrary backend path.

const ENDPOINT_DOCS = [
  "/composite/rankings/global-risk?limit=N      → [{country, global_risk}]",
  "/composite/rankings/influence?limit=N        → [{country, strategic_influence}]",
  "/composite/country/{name}                    → full composite profile",
  "/defense/spending/top?limit=N                → [{country, spending_usd_millions, year}]",
  "/defense/arms/top?limit=N                    → top arms exporters",
  "/economy/rankings/influence?limit=N          → [{country, economic influence}]",
  "/economy/trade-pairs?limit=N                 → biggest bilateral trade pairs",
  "/geopolitics/rankings/centrality?limit=N     → [{country, centrality_score}]",
  "/geopolitics/country/{name}                  → political system, sanctions",
  "/climate/country/{name}                      → climate risk profile",
  "/composite/coverage                          → how many countries have each score",
];

const ALLOWED = [
  /^\/composite\/rankings\/(global-risk|influence)$/,
  /^\/composite\/country\/[^/?#]+$/,
  /^\/composite\/coverage$/,
  /^\/defense\/(spending|arms)\/top$/,
  /^\/economy\/rankings\/influence$/,
  /^\/economy\/trade-pairs$/,
  /^\/geopolitics\/rankings\/centrality$/,
  /^\/geopolitics\/country\/[^/?#]+$/,
  /^\/climate\/country\/[^/?#]+$/,
];

async function callEndpoint(endpoint: string, params: Record<string, unknown>): Promise<unknown> {
  const path = endpoint.split("?")[0];
  if (!ALLOWED.some((re) => re.test(path))) return null;
  try {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (k === "limit") url.searchParams.set("limit", String(Math.min(50, Math.max(1, Number(v) || 10))));
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function queryIntelligenceAction(query: string) {
  let routing: { endpoints: string[]; params: Record<string, unknown> } = {
    endpoints: ["/composite/rankings/global-risk"],
    params: { limit: 10 },
  };
  const routed = await complete(
    [
      {
        role: "system",
        content:
          "Pick 1-3 read-only API endpoints that answer the user's question about countries. " +
          "Replace {name} with the country name. Reply as JSON: " +
          '{"endpoints": ["/path"], "params": {"limit": 10}}\n\nEndpoints:\n' +
          ENDPOINT_DOCS.join("\n"),
      },
      { role: "user", content: query },
    ],
    { json: true, maxTokens: 200 },
  );
  const parsedRouting = routed ? parseJSONObject<typeof routing>(routed.text) : null;
  if (parsedRouting?.endpoints?.length) routing = parsedRouting;

  const results: Record<string, unknown> = {};
  for (const ep of routing.endpoints.slice(0, 3)) {
    const data = await callEndpoint(ep, routing.params || {});
    if (data) results[ep] = data;
  }

  let synthesized = Object.keys(results).length
    ? "Data retrieved from the graph. See the raw rows below."
    : "No graph data answered this question. The relevant pipeline may not be loaded yet.";

  if (Object.keys(results).length) {
    const summary = await complete(
      [
        {
          role: "system",
          content:
            "You are an intelligence analyst. Answer in 2-4 sentences using ONLY the numbers in the data. " +
            "If the data does not answer the question, say so. Never invent figures.",
        },
        {
          role: "user",
          content: `Question: ${query}\n\nData:\n${JSON.stringify(results).slice(0, 6000)}`,
        },
      ],
      { maxTokens: 300 },
    );
    if (summary) synthesized = summary.text.trim();
  }

  return {
    endpoints: Object.keys(results),
    params: routing.params || {},
    answer_template: "",
    synthesized_answer: synthesized,
    raw_data: results,
  };
}
