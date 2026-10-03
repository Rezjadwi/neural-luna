import * as groq from "./groq.js";
import * as gemini from "./gemini.js";
import * as openrouter from "./openrouter.js";
import * as ollama from "./ollama.js";
import * as router9 from "./router9.js";

// Registry of every provider adapter Luna knows how to speak to.
// Each module exports: isConfigured() -> bool, complete({system,user,model,temperature}) -> string
export const PROVIDERS = { groq, gemini, openrouter, router9, ollama };

export function configuredProviders() {
  return Object.entries(PROVIDERS)
    .filter(([, mod]) => mod.isConfigured())
    .map(([name]) => name);
}

export async function callProvider(providerName, opts) {
  const mod = PROVIDERS[providerName];
  if (!mod) throw new Error(`Unknown provider "${providerName}"`);
  return mod.complete(opts);
}
