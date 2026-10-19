import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { complete as ollamaComplete } from "./providers/ollama.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");

const CATEGORIES = ["sales", "konten", "umum"];

// Placeholder keyword routing — stands in for real intent classification
// until an LLM is wired in. Picks the first category whose keywords match;
// falls back to "umum" (general).
const CATEGORY_KEYWORDS = {
  sales: ["jual", "harga", "diskon", "customer", "pelanggan", "unit", "motor", "mobil", "target penjualan", "showroom", "leasing", "kredit", "diler", "dealer"],
  konten: ["konten", "video", "animasi", "caption", "posting", "instagram", "tiktok", "facebook", "ig ", "reels", "desain", "poster", "promo"],
};

function classify(text) {
  const t = text.toLowerCase();
  let best = "umum", bestScore = 0;
  for (const cat of ["sales", "konten"]) {
    const score = CATEGORY_KEYWORDS[cat].filter((kw) => t.includes(kw)).length;
    if (score > bestScore) { best = cat; bestScore = score; }
  }
  return best;
}

function loadJobs() {
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveJobs(jobs) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Cap on disk — an unbounded job log is a slow leak, not a feature.
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs.slice(-300), null, 2));
}

let jobs = loadJobs();

export function listJobs(category) {
  const sorted = [...jobs].sort((a, b) => b.createdAt - a.createdAt);
  return category ? sorted.filter((j) => j.category === category) : sorted;
}

export function getJob(id) {
  return jobs.find((j) => j.id === id) || null;
}

const SYSTEM_PROMPT = {
  sales: "Kamu asisten untuk pimpinan cabang dealer otomotif. Jawab singkat, praktis, dan actionable soal strategi penjualan, promo, target, dan hubungan pelanggan. Bahasa Indonesia.",
  konten: "Kamu asisten pembuat konten promosi. Bantu buat ide/draft konten (caption, skrip video pendek, konsep visual) yang siap dipakai. Bahasa Indonesia, singkat dan konkret.",
  umum: "Kamu asisten kerja pribadi serba-bisa. Jawab singkat, praktis, dan to the point. Bahasa Indonesia.",
};

// Runs the job through the local Ollama model (hermes3) the user has
// running on their own laptop. This only succeeds when the server process
// can actually reach OLLAMA_HOST — in a cloud dev sandbox that's nothing,
// so it fails with a clear "unreachable" error by design; on the user's
// laptop, where Ollama is running, the same code returns a real answer.
async function runAgent(job) {
  job.status = "processing";
  saveJobs(jobs);
  try {
    const reply = await ollamaComplete({
      system: SYSTEM_PROMPT[job.category] || SYSTEM_PROMPT.umum,
      user: job.text,
    });
    job.status = "done";
    job.finishedAt = Date.now();
    job.result = reply || "(Ollama tidak mengembalikan jawaban.)";
  } catch (err) {
    job.status = "error";
    job.finishedAt = Date.now();
    job.result = `Gagal menjalankan agent: ${err.message}`;
  }
  saveJobs(jobs);
}

export function createJob(text) {
  const job = {
    id: "job_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    text: String(text).slice(0, 2000),
    category: classify(text),
    status: "queued",
    createdAt: Date.now(),
    finishedAt: null,
    result: null,
  };
  jobs.push(job);
  saveJobs(jobs);
  runAgent(job);
  return job;
}

export { CATEGORIES };
