import { systemPromptFor, getRoster } from "./personas.js";
import { configuredProviders, callProvider } from "./providers/index.js";

const CONCURRENCY = 6;

// Tiny worker-pool runner — no external dependency needed for this scale.
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

async function askPersona(persona, prompt) {
  const configured = configuredProviders();
  // preferred provider first, then any other configured provider as fallback,
  // so one missing key doesn't silently drop a persona from the council.
  const order = [persona.provider, ...configured.filter(p => p !== persona.provider)];
  const triedProviders = configured.length ? order.filter(p => configured.includes(p) || p === "ollama") : [];

  for (const providerName of triedProviders) {
    try {
      const text = await callProvider(providerName, {
        system: systemPromptFor(persona),
        user: prompt,
        ...(providerName === "ollama" ? { model: persona.localModel } : {})
      });
      if (text) {
        return { ...persona, take: text, provider: providerName, simulated: false };
      }
    } catch (err) {
      // try the next provider in the chain; only report failure if all fail
      continue;
    }
  }

  // Nothing configured, or every provider failed this persona — degrade
  // gracefully to the static fallback line so the UI still has content.
  return { ...persona, take: persona.take, provider: null, simulated: true };
}

export async function runCouncil(prompt, { onPersonaDone, mode } = {}) {
  // Cloud providers handle real parallelism fine. A laptop running only
  // Ollama shares one CPU/GPU across requests, so keep concurrency modest —
  // now that every persona uses the SAME local model (see personas.js),
  // there's no more reload thrashing, just normal compute contention.
  const roster = getRoster(mode);
  const cloudConfigured = configuredProviders().some(p => p !== "ollama");
  const concurrency = cloudConfigured ? CONCURRENCY : 3;

  const responses = await runWithConcurrency(roster, concurrency, async (persona) => {
    const result = await askPersona(persona, prompt);
    if (onPersonaDone) onPersonaDone(result);
    return result;
  });
  return responses;
}
