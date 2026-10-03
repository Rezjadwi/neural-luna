// 9Router — local proxy (npm i -g 9router && 9router) that fronts 40+ LLM
// providers behind one OpenAI-compatible endpoint, with free/cheap-tier
// fallback. Requires the 9Router app running locally and a provider
// connected via its dashboard (http://localhost:20128/dashboard) first.
const DEFAULT_MODEL = "cc/claude-haiku-4-5-20251001";

export function isConfigured() {
  return Boolean(process.env.ROUTER9_API_KEY);
}

export async function complete({ system, user, model, temperature = 0.8, maxTokens = 300 }) {
  const baseUrl = process.env.ROUTER9_BASE_URL || "http://localhost:20128/v1";
  const apiKey = process.env.ROUTER9_API_KEY;
  if (!apiKey) throw new Error("ROUTER9_API_KEY not set — connect a provider at http://localhost:20128/dashboard first.");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || process.env.ROUTER9_MODEL || DEFAULT_MODEL,
      temperature,
      max_tokens: maxTokens,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  }).catch(err => {
    throw new Error(`9Router unreachable at ${baseUrl} (is \`9router\` running? \`npm install -g 9router && 9router\`): ${err.message}`);
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`9Router ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// Live web search grounding — only works on "cc/" (Claude) models routed
// through 9Router, using Anthropic's native web_search server tool. Found
// by trial: the tool needs a dated type + allowed_callers:["direct"], or
// 9Router/Anthropic rejects the request (400s guided us to the right shape).
export async function webSearch(query, { maxTokens = 500 } = {}) {
  const baseUrl = process.env.ROUTER9_BASE_URL || "http://localhost:20128/v1";
  const apiKey = process.env.ROUTER9_API_KEY;
  if (!apiKey) throw new Error("ROUTER9_API_KEY not set.");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "cc/claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      stream: false,
      tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 3, allowed_callers: ["direct"] }],
      messages: [{ role: "user", content: query }]
    })
  }).catch(err => {
    throw new Error(`9Router unreachable at ${baseUrl}: ${err.message}`);
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`9Router search ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
