import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

// No LLM is configured in this environment yet, so "processing" is a timed
// stub: it proves the queue -> status -> result pipeline works end to end
// without pretending to have done real sales/content work. Swapping this
// for a real agent call is the next step once a provider is wired in.
function runStub(job) {
  setTimeout(() => {
    job.status = "processing";
    saveJobs(jobs);
  }, 600);
  setTimeout(() => {
    job.status = "done";
    job.finishedAt = Date.now();
    job.result = `[STUB] Belum ada agent asli tersambung. Perintah "${job.text}" sudah tercatat di kategori "${job.category}" — ganti runStub() di src/jobs.js dengan panggilan LLM/agent sungguhan untuk hasil beneran.`;
    saveJobs(jobs);
  }, 2200 + Math.random() * 1800);
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
  runStub(job);
  return job;
}

export { CATEGORIES };
