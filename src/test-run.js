import "dotenv/config";
import { runCouncil } from "./orchestrator.js";
import { synthesize } from "./synthesizer.js";
import { configuredProviders } from "./providers/index.js";

const prompt = process.argv.slice(2).join(" ") || "Haruskah kita luncurkan fitur AI generatif untuk pengguna gratis bulan depan?";

console.log(`Providers configured: ${configuredProviders().join(", ") || "(none — fallback mode)"}`);
console.log(`Prompt: "${prompt}"\n`);

const responses = await runCouncil(prompt, {
  onPersonaDone: (r) => {
    const tag = r.simulated ? "fallback" : r.provider;
    console.log(`[${tag}] ${r.code} ${r.name}: ${r.take}`);
  }
});

const synthesis = await synthesize(prompt, responses);
console.log(`\n--- SYNTHESIS (${synthesis.simulated ? "fallback" : synthesis.provider}) ---`);
console.log(synthesis.text);
console.log(`\nStance split:`, synthesis.tally.pct);
