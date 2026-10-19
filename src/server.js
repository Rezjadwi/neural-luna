import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createJob, listJobs, getJob, CATEGORIES } from "./jobs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.post("/api/command", (req, res) => {
  const text = (req.body && req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });
  const job = createJob(text);
  res.json({ job });
});

app.get("/api/jobs", (req, res) => {
  res.json({ jobs: listJobs(req.query.category), categories: CATEGORIES });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  res.json({ job });
});

const PORT = process.env.PORT || 3131;
app.listen(PORT, () => {
  console.log(`Agent console listening on http://localhost:${PORT}`);
});
