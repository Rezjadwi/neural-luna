// Ollama — fully local, zero cost, no API key. Requires the Ollama app
// running and at least one model pulled (e.g. `ollama pull llama3.2`).
// Docs: https://github.com/ollama/ollama/blob/main/docs/api.md

// Whatever you actually have pulled locally — check with `ollama list`.
const DEFAULT_MODEL = "hermes3";

// Ollama has no key, so "configured" just means "reachable" — checked
// lazily on first call rather than at startup, to avoid slowing boot.
export function isConfigured() {
  return true;
}

export async function complete({ system, user, model = DEFAULT_MODEL, temperature = 0.8, maxTokens = 160 }) {
  const host = process.env.OLLAMA_HOST || "http://localhost:11434";

  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature, num_predict: maxTokens },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  }).catch(err => {
    throw new Error(`Ollama unreachable at ${host} (is it running? \`ollama serve\`): ${err.message}`);
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.message?.content?.trim() ?? "";
}
