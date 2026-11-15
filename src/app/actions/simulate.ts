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
  parts: { scenario_type: string; actor: string | null; target: string | null; countries: number; missing_data: string[] }[];
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
    parts: Array.isArray(result.parts) ? result.parts : [],
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
// Delegates to the backend query engine (/graph/ask): the LLM picks a safe,
// parameterised graph query, the backend runs it, and the answer is written
// only from the returned rows.

export interface AskColumn {
  key: string;
  label: string;
  format: "text" | "number";
}

export interface AskResult {
  endpoints: string[];
  synthesized_answer: string;
  rows: Record<string, unknown>[];
  columns: AskColumn[];
  metric_label?: string;
  routed_by?: string;
  answered_by?: string;
  error?: string;
}

export async function askGraph(question: string): Promise<AskResult> {
  const empty = { endpoints: [], synthesized_answer: "", rows: [], columns: [] };
  try {
    const res = await fetch(`${BASE_URL}/graph/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return { ...empty, error: (data && (data.detail as string)) || `Query engine returned ${res.status}` };
    }
    return {
      endpoints: [data.query],
      synthesized_answer: data.answer,
      rows: data.rows ?? [],
      columns: data.columns ?? [],
      metric_label: data.metric_label,
      routed_by: data.routed_by,
      answered_by: data.answered_by,
    };
  } catch (e) {
    return { ...empty, error: `Backend unreachable at ${BASE_URL}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function queryIntelligenceAction(query: string): Promise<AskResult> {
  return askGraph(query);
}
