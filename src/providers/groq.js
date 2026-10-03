// Groq — OpenAI-compatible chat completions API, free tier, very fast.
// Docs: https://console.groq.com/docs/quickstart

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export function isConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function complete({ system, user, model = DEFAULT_MODEL, temperature = 0.8 }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
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
    throw new Error(`Groq ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
