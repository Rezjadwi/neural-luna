import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { configuredProviders } from "./providers/index.js";
import { runCouncil } from "./orchestrator.js";
import { synthesize, askFollowUp, chatReply } from "./synthesizer.js";
import { getRoster } from "./personas.js";
import { webSearch } from "./providers/router9.js";
import { listVault, readVaultFile, saveRunToVault, searchVault } from "./vault.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DATA_DIR = path.join(__dirname, "..", "data");
const LAST_RUN_FILE = path.join(DATA_DIR, "last-run.json");
const CHAT_FILE = path.join(DATA_DIR, "chat-history.json");

function loadChatHistory() {
  try {
    return JSON.parse(fs.readFileSync(CHAT_FILE, "utf-8"));
  } catch {
    return [];
  }
}
function saveChatHistory(history) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // Cap on disk too — an unbounded chat log is a slow leak, not a feature.
    fs.writeFileSync(CHAT_FILE, JSON.stringify(history.slice(-200), null, 2));
  } catch (err) {
    console.error("[persist] failed to save chat history:", err.message);
  }
}

// A council run can take a long time. The browser tab that started it can
// close or reload well before it's done, and that result was previously
// lost forever (only ever lived in that one connection's JS closure). This
// persists every completed run to disk so `GET /api/council/last` can
// recover it regardless of what happened to the client that requested it.
function saveLastRun(result) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LAST_RUN_FILE, JSON.stringify({ ...result, completedAt: new Date().toISOString() }, null, 2));
  } catch (err) {
    console.error("[persist] failed to save last run:", err.message);
  }
}
function loadLastRun() {
  try {
    return JSON.parse(fs.readFileSync(LAST_RUN_FILE, "utf-8"));
  } catch {
    return null;
  }
}

const app = express();
app.use(express.json());

// Permissive CORS — harmless now that the dashboard is served from this
// same origin, but kept in case something else calls the API directly.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// The real, backend-connected dashboard. The claude.ai artifact version
// stays simulation-only (its sandbox blocks fetches to localhost) — this
// is the one that actually talks to the personas above.
app.use(express.static(PUBLIC_DIR));

app.get("/api/health", (req, res) => {
  const configured = configuredProviders();
  res.json({
    ok: true,
    configuredProviders: configured,
    warning: configured.length ? undefined : "No provider API keys set in .env — running in fallback/simulated mode. See .env.example."
  });
});

app.get("/api/personas", (req, res) => {
  const roster = getRoster(req.query.mode);
  res.json({ ok: true, mode: req.query.mode === "full" ? "full" : "quick", count: roster.length, personas: roster.map(p => ({ code: p.code, name: p.name, arch: p.arch, stance: p.stance, channel: p.channel })) });
});

app.post("/api/council/ask", async (req, res) => {
  const context = (req.body?.context || "").trim();
  const question = (req.body?.question || "").trim();
  if (!question) return res.status(400).json({ ok: false, error: "Missing \"question\" in request body." });

  try {
    const answer = await askFollowUp(context, question);
    res.json({ ok: true, answer });
  } catch (err) {
    console.error("[council/ask] failed:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/websearch", async (req, res) => {
  const query = (req.body?.query || "").trim();
  if (!query) return res.status(400).json({ ok: false, error: "Missing \"query\" in request body." });
  if (!process.env.ROUTER9_API_KEY) return res.status(400).json({ ok: false, error: "Live search needs 9Router configured (ROUTER9_API_KEY)." });

  try {
    const result = await webSearch(query);
    res.json({ ok: true, query, result });
  } catch (err) {
    console.error("[websearch] failed:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/vault/list", (req, res) => {
  try {
    const entries = listVault(req.query.root, req.query.path || ".");
    res.json({ ok: true, root: req.query.root, path: req.query.path || ".", entries });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get("/api/vault/search", (req, res) => {
  try {
    const rootKeys = req.query.root ? [req.query.root] : null;
    const results = searchVault(req.query.q, rootKeys);
    res.json({ ok: true, q: req.query.q, results });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get("/api/vault/read", (req, res) => {
  try {
    const content = readVaultFile(req.query.root, req.query.path);
    res.json({ ok: true, root: req.query.root, path: req.query.path, content });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post("/api/vault/save", (req, res) => {
  try {
    const { prompt, mode, responses, synthesis } = req.body || {};
    if (!prompt || !synthesis) return res.status(400).json({ ok: false, error: "Missing prompt/synthesis to save." });
    const saved = saveRunToVault({ prompt, mode, responses, synthesis });
    res.json({ ok: true, ...saved });
  } catch (err) {
    console.error("[vault/save] failed:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/chat/history", (req, res) => {
  res.json({ ok: true, history: loadChatHistory() });
});

app.post("/api/chat/clear", (req, res) => {
  saveChatHistory([]);
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const message = (req.body?.message || "").trim();
  if (!message) return res.status(400).json({ ok: false, error: "Missing \"message\" in request body." });

  try {
    const history = loadChatHistory();
    const answer = await chatReply(history, message);
    const now = new Date().toISOString();
    const nextHistory = [...history, { role: "user", content: message, ts: now }, { role: "luna", content: answer.text, ts: now, provider: answer.provider, suggestCouncil: answer.suggestCouncil }];
    saveChatHistory(nextHistory);
    res.json({ ok: true, answer });
  } catch (err) {
    console.error("[chat] failed:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/council/last", (req, res) => {
  const last = loadLastRun();
  if (!last) return res.status(404).json({ ok: false, error: "No completed run yet." });
  res.json(last);
});

app.post("/api/council/run", async (req, res) => {
  const userPrompt = (req.body?.prompt || "").trim();
  const mode = req.body?.mode === "full" ? "full" : "quick";
  const includeNews = Boolean(req.body?.includeNews);
  if (!userPrompt) return res.status(400).json({ ok: false, error: "Missing \"prompt\" in request body." });

  try {
    let prompt = userPrompt;
    let newsUsed = null;
    if (includeNews && process.env.ROUTER9_API_KEY) {
      try {
        newsUsed = await webSearch(`Cari 3-5 berita/tren terbaru yang relevan sebagai konteks untuk keputusan ini: "${userPrompt}". Jawab ringkas poin-poin fakta singkat, sertakan tanggal.`);
        prompt = `[BERITA TERBARU — hasil pencarian web nyata]\n${newsUsed}\n\n[ISU/KEPUTUSAN]\n${userPrompt}`;
      } catch (err) {
        console.error("[council/run] news lookup failed, continuing without it:", err.message);
      }
    }
    const responses = await runCouncil(prompt, { mode });
    const synthesis = await synthesize(prompt, responses);
    const result = { ok: true, prompt: userPrompt, mode, newsUsed, responses, synthesis };
    saveLastRun(result);
    res.json(result);
  } catch (err) {
    console.error("[council/run] failed:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3131;
app.listen(PORT, () => {
  const configured = configuredProviders();
  console.log(`Luna orchestrator listening on http://localhost:${PORT}`);
  console.log(configured.length
    ? `Configured providers: ${configured.join(", ")}`
    : `No provider keys found in .env — calls will fall back to static responses. Copy .env.example to .env and add at least one key to go live.`);
});
