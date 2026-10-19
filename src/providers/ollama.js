// Ollama — fully local, zero cost, no API key. Requires the Ollama app
// running and at least one model pulled (e.g. `ollama pull hermes3`).
// Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
//
// This only resolves when the process running this server can reach
// OLLAMA_HOST — i.e. on the user's own laptop, where Ollama actually runs.
// In a cloud dev sandbox there is nothing listening on localhost:11434, so
// calls here fail with the "unreachable" error below by design.

const DEFAULT_MODEL = "hermes3";

export function isConfigured() {
  return true;
}

export async function complete({ system, user, model = DEFAULT_MODEL, temperature = 0.8, maxTokens = 400 }) {
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
  }).catch((err) => {
    throw new Error(`Ollama unreachable at ${host} (is it running? \`ollama serve\`): ${err.message}`);
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.message?.content?.trim() ?? "";
}
