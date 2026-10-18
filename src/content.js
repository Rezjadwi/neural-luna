// Content Studio — a short, sequential pipeline (not a council) for content
// creation. Council mode is many personas debating a decision; content
// creation instead needs a few specialized stages refining one draft in
// order, so this is a deliberately separate, much simpler flow reusing the
// same provider adapters.
import { configuredProviders, callProvider } from "./providers/index.js";

const STAGES = [
  {
    key: "ideator",
    label: "Ideator",
    system: [
      "Kamu adalah Ideator — tahap pertama tim konten.",
      "Dari brief yang diberikan, buat 2-3 angle/hook singkat yang paling menarik untuk platform yang disebutkan.",
      "Jawab ringkas, berupa poin-poin, maksimal 5 baris. Bahasa Indonesia natural, bukan formal kaku."
    ].join(" ")
  },
  {
    key: "writer",
    label: "Writer",
    system: [
      "Kamu adalah Writer — tahap kedua tim konten.",
      "Dari brief dan angle/hook yang sudah dipilih, tulis draft konten lengkap sesuai platform yang disebutkan.",
      "Tulis draft final yang siap dibaca, bukan outline. Sesuaikan panjang dan gaya dengan platformnya."
    ].join(" ")
  },
  {
    key: "editor",
    label: "Editor",
    system: [
      "Kamu adalah Editor brand — tahap ketiga tim konten.",
      "Rapikan draft yang diberikan: perbaiki alur, nada bahasa, dan konsistensi.",
      "Pastikan nada cocok untuk bisnis dealer mobil Chery (profesional tapi ramah, tidak kaku).",
      "Keluarkan HANYA versi final yang sudah diperbaiki, tanpa komentar/penjelasan tambahan."
    ].join(" ")
  },
  {
    key: "adapter",
    label: "Platform Adapter",
    system: [
      "Kamu adalah Platform Adapter — tahap terakhir tim konten.",
      "Sesuaikan format akhir draft dengan konvensi platform yang disebutkan",
      "(contoh: Instagram pakai hashtag relevan + emoji wajar, WhatsApp Business ringkas dan to-the-point, artikel pakai heading).",
      "Keluarkan HANYA versi final siap posting, tanpa komentar tambahan."
    ].join(" ")
  }
];

// Round-robin across whatever's configured, same spirit as the council's
// persona assignment — each stage gets a different "voice" when possible.
const PREFERENCE_ORDER = ["router9", "gemini", "groq", "openrouter", "ollama"];

export async function runContentPipeline(brief, platform, onStageDone) {
  const configured = configuredProviders();
  if (!configured.length) {
    throw new Error("Tidak ada provider terhubung — cek .env / 9Router.");
  }
  const tryOrder = PREFERENCE_ORDER.filter(p => configured.includes(p));

  let context = `Brief: "${brief}"\nPlatform: ${platform}`;
  const stages = [];

  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    const providerName = tryOrder[i % tryOrder.length];
    const user = i === 0
      ? context
      : `${context}\n\nHasil tahap sebelumnya (${stages[i - 1].label}):\n${stages[i - 1].text}`;

    let text, usedProvider = providerName, simulated = false;
    try {
      text = await callProvider(providerName, { system: stage.system, user, temperature: 0.7, maxTokens: 400 });
      if (!text) throw new Error("empty response");
    } catch (err) {
      // Fall through the preference order once before giving up on this stage.
      let ok = false;
      for (const fallback of tryOrder) {
        if (fallback === providerName) continue;
        try {
          text = await callProvider(fallback, { system: stage.system, user, temperature: 0.7, maxTokens: 400 });
          if (text) { usedProvider = fallback; ok = true; break; }
        } catch { /* try next */ }
      }
      if (!ok) { text = `(tahap ${stage.label} gagal — semua provider tidak merespons)`; simulated = true; }
    }

    const result = { key: stage.key, label: stage.label, provider: usedProvider, text, simulated };
    stages.push(result);
    if (onStageDone) onStageDone(result, i, STAGES.length);
  }

  return { brief, platform, stages, final: stages[stages.length - 1].text };
}
