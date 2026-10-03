// Google Gemini (AI Studio) — free tier for Flash models.
// Docs: https://ai.google.dev/gemini-api/docs/text-generation

const DEFAULT_MODEL = "gemini-2.0-flash";

export function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function complete({ system, user, model = DEFAULT_MODEL, temperature = 0.8 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens: 220 }
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join("").trim();
  return text ?? "";
}
