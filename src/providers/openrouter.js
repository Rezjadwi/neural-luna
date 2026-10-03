// OpenRouter — one key, routes to many models, several genuinely free
// (their IDs end in ":free"). Docs: https://openrouter.ai/docs

const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export function isConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function complete({ system, user, model = DEFAULT_MODEL, temperature = 0.8 }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      // OpenRouter asks for these two for attribution; harmless if ignored.
      "HTTP-Referer": "http://localhost",
      "X-Title": "Neural Luna Orchestrator"
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: 220,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
