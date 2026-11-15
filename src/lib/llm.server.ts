// Server-side LLM helper. Import ONLY from server actions ("use server" files).
//
// Keys are read from process.env WITHOUT the NEXT_PUBLIC_ prefix, so Next.js
// never inlines them into the browser bundle. (Anything named NEXT_PUBLIC_*
// is copied into client JavaScript at build time and visible to every visitor.)
//
// Order: OpenAI first, Gemini as an optional backup. If neither works the
// caller gets `null` and must fall back to something that does not need an
// LLM; never to invented numbers.

type Msg = { role: "system" | "user" | "assistant"; content: string };

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TIMEOUT_MS = 20_000;

async function callOpenAI(messages: Msg[], json: boolean, maxTokens: number): Promise<string> {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages,
    max_completion_tokens: maxTokens,
  };
  if (json) body.response_format = { type: "json_object" };
  if (!/^(o1|o3|o4|gpt-5)/.test(OPENAI_MODEL)) body.temperature = 0.2;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("OpenAI returned empty content");
  return text;
}

async function callGemini(messages: Msg[], json: boolean, maxTokens: number): Promise<string> {
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: maxTokens,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text.trim()) throw new Error("Gemini returned empty content");
  return text;
}

export interface LLMReply {
  text: string;
  provider: "openai" | "gemini";
}

/** Try OpenAI, then Gemini. Returns null when no provider is available. */
export async function complete(
  messages: Msg[],
  opts: { json?: boolean; maxTokens?: number } = {},
): Promise<LLMReply | null> {
  const json = !!opts.json;
  const maxTokens = opts.maxTokens ?? 900;
  const attempts: [LLMReply["provider"], typeof callOpenAI][] = [
    ["openai", callOpenAI],
    ["gemini", callGemini],
  ];
  for (const [provider, fn] of attempts) {
    try {
      return { text: await fn(messages, json, maxTokens), provider };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("not set")) console.warn(`[llm] ${provider} failed: ${msg}`);
    }
  }
  return null;
}

/** Parse the first JSON object out of a model reply (tolerates ``` fences). */
export function parseJSONObject<T = Record<string, unknown>>(raw: string): T | null {
  let s = raw.replace(/```(?:json)?/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function llmConfigured(): boolean {
  return !!(process.env.OPENAI_API_KEY || "").trim() || !!(process.env.GEMINI_API_KEY || "").trim();
}
