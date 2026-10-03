import { configuredProviders, callProvider } from "./providers/index.js";

const STANCE_ORDER = ["dukung", "hati2", "skeptis", "analitis"];

export function tallyStances(responses) {
  const counts = { dukung: 0, hati2: 0, skeptis: 0, analitis: 0 };
  responses.forEach(r => { counts[r.stance] = (counts[r.stance] || 0) + 1; });
  const total = responses.length || 1;
  const pct = Object.fromEntries(STANCE_ORDER.map(k => [k, Math.round((counts[k] / total) * 100)]));
  const proceedPct = Math.round(((counts.dukung + counts.analitis * 0.5) / total) * 100);
  return { counts, pct, total, proceedPct, holdPct: 100 - proceedPct };
}

function fallbackSynthesis(prompt, responses, tally) {
  const dom = STANCE_ORDER.reduce((best, k) => (tally.counts[k] > tally.counts[best] ? k : best), STANCE_ORDER[0]);
  const support = responses.find(r => r.stance === "dukung") || responses[0];
  const counter = responses.find(r => r.stance === "skeptis" || r.stance === "hati2") || responses[1];
  return [
    `${tally.total} agent merespons — ${tally.pct.dukung}% mendukung, ${tally.pct.hati2}% hati-hati, ${tally.pct.skeptis}% skeptis, ${tally.pct.analitis}% analitis.`,
    support ? `${support.code} — ${support.name}: "${support.take}"` : "",
    counter && counter !== support ? `${counter.code} — ${counter.name}: "${counter.take}"` : "",
    tally.proceedPct >= tally.holdPct
      ? "Rekomendasi: lanjutkan dengan mitigasi risiko minimal."
      : "Rekomendasi: tunda dan kumpulkan data tambahan sebelum eksekusi."
  ].filter(Boolean).join("\n\n");
}

// Fast follow-up: a single Luna-layer call (not a full persona re-run) that
// answers a question about a survey that already happened, using its
// synthesis as context. Seconds, not minutes.
export async function askFollowUp(context, question) {
  const configured = configuredProviders();
  if (!configured.length) {
    return { text: "Server Luna tidak terhubung ke provider mana pun, jadi saya belum bisa menjawab pertanyaan lanjutan ini.", simulated: true };
  }

  const system = [
    "Kamu adalah Luna, lapisan sintesis dewan AI. Kamu baru saja menyampaikan sebuah kesimpulan ke pengguna,",
    "dan sekarang pengguna bertanya lebih lanjut soal kesimpulan itu.",
    "Jawab SINGKAT (maksimal 3 kalimat), natural, langsung ke intinya. Jangan mengulang seluruh konteks.",
    "Jangan menyebut bahwa kamu adalah AI atau model bahasa."
  ].join(" ");
  const user = `Konteks kesimpulan sebelumnya:\n"${context}"\n\nPertanyaan lanjutan pengguna: "${question}"\n\nJawab pertanyaan itu.`;

  const preferenceOrder = ["router9", "gemini", "groq", "openrouter", "ollama"];
  const tryOrder = preferenceOrder.filter(p => configured.includes(p));
  for (const providerName of tryOrder) {
    try {
      const text = await callProvider(providerName, { system, user, temperature: 0.6, maxTokens: 220 });
      if (text) return { text, simulated: false, provider: providerName };
    } catch {
      continue;
    }
  }
  return { text: "Semua provider gagal merespons pertanyaan lanjutan ini — coba lagi sebentar.", simulated: true };
}

// Continuous chat — Luna as a standing conversational partner, not just a
// one-shot council runner. Fast single call using recent history for
// context. When the question genuinely needs many viewpoints debated (not
// just a quick opinion), she flags it with a trailing marker line instead
// of silently deciding to run a 200-persona job on her own — the frontend
// turns that into a one-click suggestion, keeping the expensive action a
// deliberate choice instead of something that happens invisibly mid-chat.
export async function chatReply(history, message) {
  const configured = configuredProviders();
  if (!configured.length) {
    return { text: "Server Luna tidak terhubung ke provider mana pun, jadi saya belum bisa ngobrol dulu.", simulated: true, suggestCouncil: null };
  }

  const system = [
    "Kamu adalah Luna — entitas AI yang mengorkestrasi dewan berisi banyak persona AI untuk membantu keputusan bisnis dan ide sehari-hari penggunamu.",
    "Ini percakapan biasa (chat), bukan laporan formal — jawab natural, ringkas (1-4 kalimat kecuali diminta lebih), boleh nanya balik kalau perlu klarifikasi.",
    "Kamu TIDAK bisa langsung menjalankan council (dewan 20/200 persona) dari sini — itu makan waktu menit-jam dan harus pengguna yang memicu.",
    "Kalau pertanyaan penggunanya benar-benar butuh analisis mendalam / banyak sudut pandang yang berdebat (bukan sekadar obrolan atau fakta cepat),",
    "tulis jawaban singkatmu dulu, lalu di baris TERAKHIR sendiri tulis persis: [SARAN-COUNCIL: <rumusan pertanyaan singkat untuk dijalankan ke council>]",
    "Kalau tidak perlu, JANGAN tulis baris itu sama sekali.",
    "Jangan menyebut bahwa kamu adalah AI atau model bahasa."
  ].join(" ");

  const historyText = (history || []).slice(-10)
    .map(h => `${h.role === "user" ? "Pengguna" : "Luna"}: ${h.content}`)
    .join("\n");
  const user = (historyText ? historyText + "\n" : "") + `Pengguna: ${message}`;

  const preferenceOrder = ["router9", "gemini", "groq", "openrouter", "ollama"];
  const tryOrder = preferenceOrder.filter(p => configured.includes(p));
  for (const providerName of tryOrder) {
    try {
      const raw = await callProvider(providerName, { system, user, temperature: 0.75, maxTokens: 260 });
      if (!raw) continue;
      const m = raw.match(/\[SARAN-COUNCIL:\s*(.+?)\]\s*$/s);
      const text = m ? raw.slice(0, m.index).trim() : raw.trim();
      return { text, simulated: false, provider: providerName, suggestCouncil: m ? m[1].trim() : null };
    } catch {
      continue;
    }
  }
  return { text: "Semua provider gagal merespons — coba lagi sebentar.", simulated: true, suggestCouncil: null };
}

export async function synthesize(prompt, responses) {
  const tally = tallyStances(responses);
  const configured = configuredProviders();

  if (!configured.length) {
    return { text: fallbackSynthesis(prompt, responses, tally), tally, simulated: true };
  }

  const digest = responses
    .map(r => `${r.code} (${r.name}, cenderung ${r.stance}): "${r.take}"`)
    .join("\n");

  const system = [
    "Kamu adalah Luna, lapisan sintesis di atas sebuah dewan AI beranggotakan banyak persona.",
    "Tugasmu: baca semua pendapat mereka, lalu rangkum jadi SATU rekomendasi akhir yang jujur",
    "soal titik terang dan titik gelapnya, maksimal 4 kalimat, bahasa natural (bukan daftar/bullet).",
    "Jangan menyebut bahwa kamu adalah model bahasa."
  ].join(" ");

  const user = `Pertanyaan/keputusan: "${prompt}"\n\nPendapat dewan:\n${digest}\n\nBerikan sintesis akhirnya.`;

  // Prefer a stronger/larger model for this one "judge" call when available.
  const preferenceOrder = ["router9", "gemini", "groq", "openrouter", "ollama"];
  const tryOrder = preferenceOrder.filter(p => configured.includes(p));

  for (const providerName of tryOrder) {
    try {
      const text = await callProvider(providerName, { system, user, temperature: 0.5, maxTokens: 320 });
      if (text) return { text, tally, simulated: false, provider: providerName };
    } catch {
      continue;
    }
  }

  return { text: fallbackSynthesis(prompt, responses, tally), tally, simulated: true };
}
