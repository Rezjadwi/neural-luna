// Read/write access to the user's own local data — scoped to two known
// roots so this can never become an arbitrary-filesystem backdoor:
//   - the Chery business folder (raw source data: Polreg, performance, etc.)
//   - the HVFT Obsidian vault (where Luna writes its own conclusions back)
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const ROOTS = {
  chery: "/Users/mymac/Documents/Chery",
  hvft: "/Users/mymac/Documents/HVFT"
};
const WIKI_DIR = path.join(ROOTS.hvft, "wiki");

const TEXT_EXT = new Set([".md", ".txt"]);
const SHEET_EXT = new Set([".xlsx", ".xls"]);
const SKIP_NAMES = new Set([".DS_Store"]);

function resolveInRoot(rootKey, relPath) {
  const root = ROOTS[rootKey];
  if (!root) throw new Error(`Unknown vault root "${rootKey}".`);
  const full = path.resolve(root, relPath || ".");
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Path escapes the allowed vault root.");
  }
  return full;
}

export function listVault(rootKey, relPath = ".") {
  const dir = resolveInRoot(rootKey, relPath);
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter(e => !e.name.startsWith(".") && !SKIP_NAMES.has(e.name))
    .map(e => ({
      name: e.name,
      isDir: e.isDirectory(),
      relPath: path.join(relPath === "." ? "" : relPath, e.name)
    }))
    .sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name));
}

// Returns plain text for .md/.txt, a compact readable table dump for
// .xlsx/.xls (via SheetJS), or throws for anything else (images, pdfs,
// binaries — not useful as LLM grounding text anyway).
export function readVaultFile(rootKey, relPath) {
  const full = resolveInRoot(rootKey, relPath);
  const ext = path.extname(full).toLowerCase();

  if (TEXT_EXT.has(ext)) {
    return fs.readFileSync(full, "utf-8");
  }
  if (SHEET_EXT.has(ext)) {
    const wb = XLSX.readFile(full);
    return wb.SheetNames.map(name => {
      const sheet = wb.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      // Cap per-sheet size — raw registration logs can be thousands of rows;
      // grounding text needs the shape of the data, not every row.
      const lines = csv.split("\n").filter(Boolean);
      const capped = lines.length > 60
        ? lines.slice(0, 60).join("\n") + `\n... (${lines.length - 60} baris lagi, dipotong)`
        : lines.join("\n");
      return `--- Sheet: ${name} ---\n${capped}`;
    }).join("\n\n");
  }
  throw new Error(`Tipe file "${ext}" belum didukung untuk dibaca sebagai teks (cuma .md/.txt/.xlsx/.xls).`);
}

const BINARY_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".heic", ".mp4", ".mov", ".dmg", ".zip"]);
const SKIP_DIR_NAMES = new Set(["node_modules", ".git", ".obsidian", "ANDROID", "APK CAM ANDROID"]);
const MAX_FILES_SCANNED = 4000;
const MAX_DEPTH = 8;

function walk(rootKey, relPath, depth, budget) {
  if (depth > MAX_DEPTH || budget.count >= MAX_FILES_SCANNED) return [];
  const dir = resolveInRoot(rootKey, relPath);
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  let out = [];
  for (const e of entries) {
    if (budget.count >= MAX_FILES_SCANNED) break;
    if (e.name.startsWith(".") || SKIP_NAMES.has(e.name) || SKIP_DIR_NAMES.has(e.name)) continue;
    const rel = relPath === "." ? e.name : path.join(relPath, e.name);
    if (e.isDirectory()) {
      out = out.concat(walk(rootKey, rel, depth + 1, budget));
    } else {
      budget.count++;
      out.push(rel);
    }
  }
  return out;
}

// Filename search across both roots always (cheap); content search only for
// .md/.txt (cheap to read, common case for the Obsidian wiki). Binary/media
// files and .xlsx are filename-matched only — parsing every spreadsheet on
// every keystroke would make this unusably slow given how many are in the
// Chery folder.
export function searchVault(query, rootKeys) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  const keys = rootKeys && rootKeys.length ? rootKeys : Object.keys(ROOTS);
  const results = [];

  for (const rootKey of keys) {
    const budget = { count: 0 };
    const files = walk(rootKey, ".", 0, budget);
    for (const rel of files) {
      const ext = path.extname(rel).toLowerCase();
      const base = path.basename(rel);
      const nameHit = base.toLowerCase().includes(q);
      let snippet = null, contentHit = false;

      if (!BINARY_EXT.has(ext) && TEXT_EXT.has(ext)) {
        try {
          const text = fs.readFileSync(resolveInRoot(rootKey, rel), "utf-8");
          const idx = text.toLowerCase().indexOf(q);
          if (idx !== -1) {
            contentHit = true;
            const start = Math.max(0, idx - 60);
            snippet = (start > 0 ? "…" : "") + text.slice(start, idx + q.length + 60).replace(/\s+/g, " ") + "…";
          }
        } catch { /* unreadable, skip content check */ }
      }

      if (nameHit || contentHit) {
        results.push({ root: rootKey, relPath: rel, name: base, matchType: nameHit ? "filename" : "content", snippet, score: (nameHit ? 2 : 0) + (contentHit ? 1 : 0) });
      }
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 25);
}

function slug(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "catatan";
}

// Writes a completed council run back into the vault as a Markdown note,
// mirroring the format the user's own earlier HVFT-BRAINS prototype used
// (frontmatter + persona opinions + synthesis), so it fits the existing
// wiki/ structure instead of inventing a new one.
export function saveRunToVault({ prompt, mode, responses, synthesis }) {
  fs.mkdirSync(WIKI_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const title = (prompt || "").slice(0, 70).replace(/"/g, "'");
  const filename = `keputusan-luna-${slug(prompt)}-${date}.md`;
  const filePath = path.join(WIKI_DIR, filename);

  const tally = synthesis?.tally || {};
  let md = `---\n`;
  md += `title: "Keputusan Luna: ${title}"\n`;
  md += `type: council-run\n`;
  md += `mode: ${mode || "quick"}\n`;
  md += `date: ${date}\n`;
  md += `tags:\n  - wiki\n  - neural-luna\n`;
  md += `---\n\n`;
  md += `# Keputusan Luna: ${title}\n\n`;
  md += `**Isu**: ${prompt}\n\n`;
  md += `**Jalur**: Lanjutkan ${tally.proceedPct ?? "-"}% · Tunda ${tally.holdPct ?? "-"}%\n\n`;
  md += `## Pendapat Dewan (${responses?.length ?? 0} agent)\n`;
  (responses || []).slice(0, 40).forEach(r => {
    md += `\n### ${r.code} — ${r.name} (${r.stance})\n${r.take}\n`;
  });
  md += `\n## Sintesis\n${synthesis?.text || ""}\n`;
  md += `\n## Related\n- [[Business]]\n- [[index]]\n`;

  fs.writeFileSync(filePath, md);
  return { filePath, filename };
}
