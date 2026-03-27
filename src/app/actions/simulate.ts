"use server";

// ─── Simulation Action ────────────────────────────────────────────────────────
// Priority:
//   1. POST /api/backend/simulate/  (Python backend with Gemini)
//   2. Direct Gemini API call
//   3. Static fallback
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

function stripJsonFences(raw: string): string {
  let s = raw
    .replace(/```(?:json)?/g, "")
    .replace(/```/g, "")
    .trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start)
    return s.substring(start, end + 1);
  return s;
}

// ─── Normalise the backend SimulateResponse into the shape the UI expects ────
// Backend returns:
//   { request, parsed, result: { headline, summary, confidence, computation_time_ms,
//       affected_countries: AffectedCountry[], cascade_effects: CascadeEffect[] } }
// UI expects:
//   { headline, summary, confidenceScore, computationTime,
//     affectedCountries: [{country, delta, severity}],
//     cascadeEffects: [{year|mechanism, event|description}] }
// ─────────────────────────────────────────────────────────────────────────────
function normaliseBackendResponse(data: any): any {
  // Already in LLM/UI format (no `result` wrapper)
  if (data.headline && data.affectedCountries) return data;

  // Backend SimulateResponse format
  const result = data.result ?? data;

  const affected = (result.affected_countries ?? []).map((c: any) => ({
    country: c.country,
    severity: c.severity,
    impact_type: c.impact_type,
    summary: c.summary,
    impact_detail: c.summary || c.impact_detail || "",
    score_deltas: c.score_deltas ?? [],
    // Aggregate delta for display (sum of all score_deltas)
    delta: Array.isArray(c.score_deltas)
      ? parseFloat(
          c.score_deltas
            .reduce((acc: number, d: any) => acc + (d.delta ?? 0), 0)
            .toFixed(3),
        )
      : null,
  }));

  const cascades = (result.cascade_effects ?? []).map((e: any) => ({
    // Keep both shapes so page.tsx can render either
    mechanism: e.mechanism,
    affected: e.affected,
    description: e.description,
    event: e.description, // alias for LLM-style rendering
    severity: e.severity,
  }));

  return {
    headline: result.headline || "",
    summary: result.summary || "",
    confidenceScore: Math.round((result.confidence ?? 0.75) * 100),
    computationTime: result.computation_time_ms
      ? `${(result.computation_time_ms / 1000).toFixed(2)}s`
      : undefined,
    affectedCountries: affected,
    cascadeEffects: cascades,
    // Pass parsed intent through for debugging
    parsed: data.parsed,
  };
}

export async function runSimulationAction(params: {
  countryA: string;
  countryB: string;
  scenario: string;
  magnitude: number;
  year: number;
}) {
  const scenarioLabel = getScenarioLabel(params.scenario);

  // ── 1. Try Python backend ─────────────────────────────────────────────────
  try {
    const backendRes = await fetch(`${BASE_URL}/simulate/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GEMINI_API_KEY || ""}`,
        "x-api-key": process.env.GEMINI_API_KEY || "",
      },
      body: JSON.stringify({
        // The backend expects a natural-language query that it will parse with the LLM.
        // Build a sensible query from the structured params.
        query: buildBackendQuery(params),
        year: params.year,
        magnitude: params.magnitude,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      // Backend may return a SimulateResponse object — normalise it.
      if (data.result || data.headline) {
        const normalised = normaliseBackendResponse(data);
        // If the backend returned an "not implemented" error message in the headline or summary,
        // we should fall back to Gemini instead of showing the error to the user.
        const isError =
          normalised.headline?.toLowerCase().includes("not implemented") ||
          normalised.summary?.toLowerCase().includes("no handler available");

        if (!isError) {
          return normalised;
        }
        console.warn(
          "Backend returned 'not implemented' error, falling back to Gemini...",
        );
      }
    } else {
      console.warn(`Backend /simulate/ returned ${backendRes.status}`);
    }
  } catch (e) {
    console.warn(
      "Backend /simulate/ unreachable, falling back to Gemini direct…",
    );
  }

  // ── 2. Direct Gemini fallback ─────────────────────────────────────────────
  const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (geminiKey) {
    try {
      const prompt = buildGeminiPrompt(params, scenarioLabel);
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const t0 = Date.now();

      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 },
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const content =
          geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const computeTime = `${((Date.now() - t0) / 1000).toFixed(1)}s`;

        let jsonStr = stripJsonFences(content);
        // Sanitise non-compliant leading '+' signs
        jsonStr = jsonStr.replace(/:\s*\+([0-9]*\.?[0-9]+)/g, ": $1");

        const result = JSON.parse(jsonStr);
        if (!result.computationTime) result.computationTime = computeTime;
        return result;
      }
    } catch (e: any) {
      console.error("Gemini direct call failed:", e.message);
    }
  }

  // ── 3. Static fallback ────────────────────────────────────────────────────
  return buildFallback(params, scenarioLabel);
}

// ─── Build the natural-language query for the Python backend ─────────────────
function getScenarioLabel(scenario: string): string {
  switch (scenario) {
    case "cyber_attack":
      return "Cyber Attack / Infrastructure Sabotage";
    case "military_intervention":
      return "Direct Military Intervention / Regional Conflict";
    default:
      return scenario
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

function buildBackendQuery(params: {
  countryA: string;
  countryB: string;
  scenario: string;
  magnitude: number;
  year: number;
}): string {
  const mag = params.magnitude;
  const magLabel =
    mag <= 0.5
      ? "partial"
      : mag >= 2.0
        ? "extreme"
        : mag >= 1.5
          ? "severe"
          : "full";

  const scenarioLabel = params.scenario.replace(/_/g, " ");

  // For single-country scenarios countryB === countryA — omit the second country
  const sameCountry = params.countryA === params.countryB;

  if (sameCountry) {
    return `What if there is a ${magLabel} ${scenarioLabel} in ${params.countryA}?`;
  }
  return `What if ${params.countryA} initiates a ${magLabel} ${scenarioLabel} against ${params.countryB}?`;
}

// ─── Build the Gemini prompt ──────────────────────────────────────────────────
function buildGeminiPrompt(
  params: {
    countryA: string;
    countryB: string;
    scenario: string;
    magnitude: number;
    year: number;
  },
  scenarioLabel: string,
): string {
  const sameCountry = params.countryA === params.countryB;

  return `You are the Global Intelligence Engine Simulator.
Run a HIGH-DETAIL geopolitical simulation with these parameters:
- Primary Actor: ${params.countryA}
${sameCountry ? "" : `- Target/Secondary Actor: ${params.countryB}\n`}- Scenario: ${scenarioLabel}
- Magnitude (0.5=Partial, 1.0=Normal, 2.0=Extreme): ${params.magnitude}
- Target Year: ${params.year}

Output the simulation result STRICTLY as a JSON object (no markdown, no comments):
{
  "headline": "Short dramatic headline",
  "summary": "3-4 detailed paragraphs describing the direct impact, geopolitical fallout, and long-term strategic shifts. Mention specific score changes and calculations.",
  "computationTime": "6.12s",
  "confidenceScore": 85,
  "affectedCountries": [
    { 
      "country": "CountryName", 
      "delta": -0.64, 
      "severity": "critical|high|medium|low|negligible", 
      "impact_type": "direct|cascade|regional", 
      "impact_detail": "Detailed explanation of how this country is impacted. Mention specific gains or losses.",
      "score_deltas": [
        { "metric": "diplomatic_centrality", "delta": -0.300 },
        { "metric": "military_strength", "delta": 0.240 },
        { "metric": "economic_risk", "delta": 0.400 }
      ]
    }
  ],
  "cascadeEffects": [
    { "year": ${params.year}, "mechanism": "Security guarantee", "event": "Description of cascading event with specific strategic implications." }
  ]
}

REQUIREMENTS:
1. Include 20-30 affected countries. Primary and secondary actors must be first.
2. For each country, provide a 'score_deltas' array with 3-4 specific metrics (diplomatic_centrality, military_strength, economic_risk, bloc_alignment, energy_security, etc.).
3. GEOPOLITICAL REALISM: Use a mix of positive and negative values. For example, a military intervention usually increases 'economic_risk' (positive delta) but may decrease 'diplomatic_centrality' (negative delta).
4. VARIETY: Use a mix of severities (critical, high, medium, low, negligible).
5. The 'summary' must be professional, analytical, and include specific numbers/calculations.
6. TIMELINE: The 'cascadeEffects' must show a multi-year progression (e.g. 2024, 2025, 2026).
7. CRITICAL: Output strictly valid JSON. Never use '+' prefix on positive numbers (use 0.04, not +0.04).`;
}

// ─── Static fallback ──────────────────────────────────────────────────────────
function buildFallback(
  params: {
    countryA: string;
    countryB: string;
    scenario: string;
    magnitude: number;
    year: number;
  },
  scenarioLabel: string,
) {
  const sameCountry = params.countryA === params.countryB;
  return {
    headline: `Geopolitical Anomaly Detected: ${scenarioLabel}`,
    summary: sameCountry
      ? `The Global Intelligence Engine's predictive model has isolated a significant ${scenarioLabel} event within ${params.countryA}. Preliminary indicators suggest a high probability of regional ripple effects as strategic dependencies are stressed. Analysts observe a sharp divergence in local stability metrics, with a magnitude ${params.magnitude} impact on critical infrastructure and diplomatic standing.`
      : `A magnitude ${params.magnitude} ${scenarioLabel} engagement between ${params.countryA} and ${params.countryB} has been simulated. The model projects a significant realignment of regional security architectures. Primary actors face immediate diplomatic pressure, while secondary effects manifest in global energy markets and supply chain integrity.`,
    confidenceScore: 74,
    computationTime: "0.1s",
    affectedCountries: sameCountry
      ? [
          {
            country: params.countryA,
            delta: -(3.5 * params.magnitude).toFixed(2),
            severity: "critical",
            impact_type: "direct",
            impact_detail: `Severe ${scenarioLabel} impact; destabilizing internal governance and economic output.`,
            score_deltas: [
              { metric: "stability_index", delta: -0.45 },
              { metric: "economic_risk", delta: 0.32 },
            ],
          },
          {
            country: "United States",
            delta: 0.12,
            severity: "medium",
            impact_type: "cascade",
            impact_detail:
              "Diplomatic recalibration in response to regional instability.",
            score_deltas: [{ metric: "diplomatic_leverage", delta: 0.12 }],
          },
        ]
      : [
          {
            country: params.countryA,
            delta: -(3.5 * params.magnitude).toFixed(2),
            severity: "critical",
            impact_type: "direct",
            impact_detail: `Initiating party of ${scenarioLabel}; facing immediate international blowback.`,
            score_deltas: [
              { metric: "diplomatic_centrality", delta: -0.38 },
              { metric: "military_readiness", delta: 0.22 },
            ],
          },
          {
            country: params.countryB,
            delta: -(2.1 * params.magnitude).toFixed(2),
            severity: "high",
            impact_type: "direct",
            impact_detail: `Direct target of ${scenarioLabel}; suffering from infrastructure degradation.`,
            score_deltas: [
              { metric: "economic_output", delta: -0.42 },
              { metric: "national_security", delta: -0.55 },
            ],
          },
        ],
    cascadeEffects: [
      {
        year: params.year,
        mechanism: "Diplomatic Outcry",
        event: `Immediate diplomatic crisis erupts following the ${scenarioLabel} action.`,
      },
      {
        year: params.year + 1,
        mechanism: "Market Volatility",
        event:
          "Regional energy and supply chain disruptions force emergency international intervention.",
      },
    ],
  };
}

// ── Intelligence Query Action ─────────────────────────────────────────────────

const AVAILABLE_ENDPOINTS = [
  "GET /composite/rankings/global-risk         → [{country, global_risk}]",
  "GET /composite/rankings/influence           → [{country, strategic_influence}]",
  "GET /composite/country/:name               → full composite profile",
  "GET /defense/spending/top?limit=N          → [{country, spending_usd_millions}]",
  "GET /defense/arms/top?limit=N              → [{country, avg_market_share_pct}]",
  "GET /defense/conflicts/:country            → {fatalities, events}",
  "GET /economy/rankings/influence            → [{country, strategic_influence}]",
  "GET /economy/country/:name                 → {gdp_usd, avg_inflation, economic_risk_score}",
  "GET /economy/trade-pairs                   → [{country_a, country_b, normalized_weight}]",
  "GET /geopolitics/network                   → {nodes, edges}",
  "GET /geopolitics/rankings/centrality       → [{country, centrality_score}]",
  "GET /geopolitics/country/:name             → {political_system, sanctions, bloc}",
  "GET /climate/country/:name                 → {climate_risk_score, emissions_level}",
  "GET /climate/impact/conflict-risk          → [{source_country, at_risk_country, conflict_score}]",
  "GET /simulate/scenarios                    → [{id, name}]",
];

async function callEndpoint(
  endpoint: string,
  params?: Record<string, any>,
): Promise<any> {
  try {
    let url = `${BASE_URL}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ),
      ).toString();
      url += (url.includes("?") ? "&" : "?") + qs;
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function queryIntelligenceAction(query: string) {
  const geminiKey = (process.env.GEMINI_API_KEY || "").trim();

  const routingPrompt = `You are an intelligence analyst for the Global Intelligence Engine.

Available API endpoints:
${AVAILABLE_ENDPOINTS.join("\n")}

User question: "${query}"

Respond with ONLY valid JSON (no markdown):
{
  "endpoints": ["/composite/rankings/global-risk"],
  "params": { "limit": 10 },
  "answer_template": "Sentence explaining what data you will return: {data}"
}

Choose 1-3 endpoints most relevant to the question. Replace :name with the country name if mentioned.`;

  let routing: any = {
    endpoints: ["/composite/rankings/global-risk"],
    params: { limit: 10 },
    answer_template: "Here are the top risk countries: {data}",
  };

  // Try Gemini for routing
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: routingPrompt }] }],
            generationConfig: { temperature: 0.1 },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        routing = JSON.parse(stripJsonFences(raw));
      }
    } catch {
      // keep default routing
    }
  }

  // Call endpoints
  const results: Record<string, any> = {};
  for (const ep of (routing.endpoints || []).slice(0, 3)) {
    const data = await callEndpoint(ep, routing.params || {});
    if (data) results[ep] = data;
  }

  let synthesized =
    routing.answer_template?.replace(
      "{data}",
      JSON.stringify(results).slice(0, 1500),
    ) || "Data retrieved.";

  // Try Gemini for synthesis
  if (Object.keys(results).length > 0 && geminiKey) {
    try {
      const summaryPrompt = `You are an intelligence analyst. The user asked: "${query}"

Here is the raw API data:
${JSON.stringify(results, null, 2).slice(0, 2500)}

Write a concise, data-backed answer in 2-4 sentences. Be specific — mention country names and numbers.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: summaryPrompt }] }],
            generationConfig: { temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) synthesized = text;
      }
    } catch {
      // keep template answer
    }
  }

  return {
    endpoints: routing.endpoints || [],
    params: routing.params || {},
    answer_template: routing.answer_template || "",
    synthesized_answer: synthesized,
    raw_data: results,
  };
}
