# Neural Luna — orchestrator + local dashboard (Phase 1)

The real "brain" behind the Synthesis Core dashboard. Takes one prompt, fans it
out to a council of AI personas across several providers (free tiers included,
plus whatever you have running locally in Ollama), then synthesizes their
answers into one recommendation.

This is a plain local API server — no framework magic, easy to move to a VPS
later by copying the folder and running the same `npm start`.

**Two versions of the dashboard exist on purpose:**
- The one published to claude.ai is a **demo only** — its sandbox blocks
  requests to `localhost`, so it can never reach this server, no matter what.
  It always runs the built-in simulation.
- **`public/index.html`** (served by this same project, at
  `http://localhost:3131`) is the **real one** — same-origin, so it can call
  the API below. It shows a green "TERHUBUNG KE LUNA · LOKAL" badge when
  connected, and quietly falls back to simulation if the server isn't running.

## What's here

```
src/
  providers/        one small adapter per AI provider (same shape each time)
    groq.js          free tier, very fast, hosts Llama/Gemma models
    gemini.js        Google AI Studio free tier (Flash models)
    openrouter.js     one key, many models, several free
    ollama.js         fully local, zero cost, no key — talks to whatever
                       you have pulled already (check with `ollama list`)
    index.js          registry + configuredProviders()/callProvider()
  personas.js        the 14 council identities + which provider/local model
                       each prefers
  orchestrator.js     runs all personas in parallel (max 6 at once, or 2 when
                       only Ollama is available, so it doesn't thrash your
                       machine), with per-persona fallback if a provider
                       fails or has no key
  synthesizer.js      one more call that reads all answers and writes the
                       final recommendation; falls back to a templated
                       summary if no provider is configured at all
  server.js           Express API + serves public/ as static files:
                       GET /api/health, POST /api/council/run
  test-run.js         CLI smoke test, no server needed: `npm run test:council`
public/
  index.html          the real, backend-connected dashboard
```

## Setup

```bash
cp .env.example .env
```

Open `.env` and add **at least one** key — Luna works with just one, she just
has fewer distinct "voices" until you add more:

- **Groq** (recommended first pick — fast, generous free tier):
  https://console.groq.com/keys
- **Gemini** (Google AI Studio free tier):
  https://aistudio.google.com/apikey
- **OpenRouter** (one key, routes to many models, several free):
  https://openrouter.ai/keys
- **Ollama** (fully local, no key, no cost, but uses your own machine's
  compute): install from https://ollama.com, then `ollama pull llama3.2`
  and leave `ollama serve` running in a terminal.

## Run it

```bash
npm start          # http://localhost:3131
# or, auto-restart on file changes:
npm run dev
```

Or skip the server entirely and just check the pipeline from the terminal:

```bash
npm run test:council "Haruskah kita naikkan harga produk kuartal depan?"
```

## Try it

```bash
npm start
```
then open **http://localhost:3131** in a browser — that's the real dashboard.
With only Ollama configured (no cloud keys), expect a full 14-persona run to
take a few minutes; it's genuinely running local inference, not stalled.

## API

**`GET /api/health`** — which providers currently have keys set.

**`POST /api/council/run`**
```json
{ "prompt": "Haruskah kita luncurkan fitur X bulan depan?" }
```
Returns `{ ok, prompt, responses: [...], synthesis: { text, tally, ... } }` —
this is exactly what `public/index.html` fetches when you click "Jalankan
Council".

## Notes on the "1000 agents" idea

Calling 1000 separate model completions per prompt is not realistic on free
tiers (cost + rate limits + latency). This orchestrator keeps the same
14-persona council as the dashboard for now — real answers, real diversity,
but a sane number of calls. Scaling toward "many more voices" later means
batching several personas into one completion (ask one model to answer as
5 personas at once) rather than 1:1 calls — that's a Phase 2 concern once
Phase 1 is proven out with real keys.

## Deploying to a VPS later

No code changes needed: copy this folder to the VPS, run `npm install`,
add the same `.env`, run `npm start` (ideally behind `pm2` or a systemd
service so it survives reboots/crashes). Ollama would need to either run
on the VPS too (if it has enough RAM) or stay pointed at a machine you
control via `OLLAMA_HOST`.
