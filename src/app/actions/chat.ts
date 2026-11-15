"use server";

// Chat runs on the server so the API key never reaches the browser.
// (The old version read NEXT_PUBLIC_ANTHROPIC_KEY, which Next.js inlines into
// client JavaScript: anyone could copy it from DevTools.)

import { complete } from "@/lib/llm.server";

export async function chatAction(input: {
  activeModule: string;
  countryContext: string | null;
  messages: { role: "user" | "assistant"; text: string }[];
}): Promise<{ text: string; error?: string }> {
  const history = input.messages.slice(-10).map((m) => ({
    role: m.role,
    content: m.text.slice(0, 2000),
  }));
  const system =
    `You are a geopolitical intelligence analyst for the Global Intelligence Engine. Current module: ${input.activeModule}. ` +
    (input.countryContext
      ? `Graph data for the selected country: ${input.countryContext.slice(0, 4000)}. `
      : "No country selected. ") +
    "Answer in under 3 sentences. Use only numbers present in the graph data above; if it lacks the answer, say so.";

  const reply = await complete([{ role: "system", content: system }, ...history], { maxTokens: 300 });
  if (!reply) {
    return { text: "", error: "No language model configured on the server (set OPENAI_API_KEY)." };
  }
  return { text: reply.text.trim() };
}
