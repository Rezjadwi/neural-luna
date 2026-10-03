// The persona bank. Same 14 identities as the Neural Council dashboard
// artifact, now wired to real providers instead of canned "take" strings.
// `stance` still drives the consensus math on the frontend side; `take`
// here is only a fallback shown if every provider call for that persona
// fails, so the UI never renders empty.

const ROUND_ROBIN = ["router9", "groq", "gemini", "openrouter", "ollama"];

// Locally pulled Ollama model used for the whole run (check yours with
// `ollama list`). Deliberately ONE model, not several — switching models
// mid-run forces Ollama to unload/reload (~8s dead time per switch), which
// dominated the total runtime. One model stays loaded in memory for every
// persona call, so this is the biggest single speed win available locally.
const LOCAL_MODELS = ["hermes3"];

// Cosmetic "channel" tag shown next to each persona in the dashboard's log
// stream — mirrors the one baked into the original artifact.
const CHANNELS = ["OBSERVASI", "CATATAN", "SUREL", "PERNYATAAN", "METAKOGNISI", "WAWANCARA"];

const RAW = [
  { name: "Futuris Optimis",       arch: "melihat peluang eksponensial di balik hal baru",  stance: "dukung",   take: "Ini bukan risiko, ini keterlambatan yang harus dihindari." },
  { name: "Skeptis Ekonom",        arch: "tidak percaya sebelum lihat angka",                stance: "skeptis",  take: "Belum ada proyeksi cash flow yang meyakinkan." },
  { name: "Hacker Sinis",          arch: "curiga pada narasi resmi",                         stance: "skeptis",  take: "Tanya dulu: siapa yang paling diuntungkan kalau ini jalan?" },
  { name: "Ibu Rumah Tangga",      arch: "menilai dari manfaat sehari-hari",                 stance: "hati2",    take: "Apa ini beneran meringankan urusan orang biasa?" },
  { name: "Insinyur Perfeksionis", arch: "tidak percaya sebelum lihat spesifikasi",          stance: "analitis", take: "Saya mau lihat dulu batasan teknis dan mode kegagalannya." },
  { name: "Aktivis Lingkungan",    arch: "menimbang dampak jangka panjang",                  stance: "hati2",    take: "Belum ada kajian dampak jangka panjang." },
  { name: "Investor Agresif",      arch: "mengutamakan momentum di atas kesempurnaan",       stance: "dukung",   take: "Eksekusi sekarang, perbaiki sambil jalan." },
  { name: "Filsuf Kontemplatif",   arch: "selalu mempertanyakan tujuan di baliknya",         stance: "analitis", take: "Apa sebenarnya yang ingin kita capai di balik ini?" },
  { name: "Anak Muda Gen-Z",       arch: "takut ketinggalan momentum",                       stance: "dukung",   take: "Kalau nggak dicoba sekarang, orang lain bakal duluan." },
  { name: "Birokrat Konservatif",  arch: "mengutamakan proses dan mitigasi",                 stance: "hati2",    take: "Perlu tahapan yang jelas sebelum keputusan final." },
  { name: "Psikolog Empatik",      arch: "menilai dampak ke manusia di baliknya",            stance: "analitis", take: "Pertimbangkan dampaknya ke orang yang terlibat langsung." },
  { name: "Jurnalis Investigasi",  arch: "mencari apa yang tidak diceritakan",               stance: "skeptis",  take: "Apa yang sengaja tidak disebut dalam proposal ini?" },
  { name: "Petani Tradisional",    arch: "percaya pada langkah yang stabil",                 stance: "hati2",    take: "Yang bertahan lama biasanya yang jalan pelan tapi stabil." },
  { name: "CEO Startup",           arch: "tidak mau menunggu kondisi sempurna",              stance: "dukung",   take: "Kompetitor tidak menunggu kita siap." },
  { name: "Pengacara Korporat",    arch: "menilai risiko hukum dan kontrak sebelum apa pun", stance: "hati2",    take: "Pastikan dulu ini tidak melanggar kontrak atau regulasi yang ada." },
  { name: "Akademisi Peneliti",    arch: "menuntut data dan studi sebelum simpulan",         stance: "analitis", take: "Mana studi atau data pendukung sebelum kita simpulkan ini baik?" },
  { name: "Marketer Digital",      arch: "melihat semua lewat kacamata engagement dan konversi", stance: "dukung", take: "Ini bisa jadi bahan campaign yang kuat kalau dieksekusi cepat." },
  { name: "Pekerja Lapangan",      arch: "menilai dari beban kerja harian yang nyata",       stance: "skeptis",  take: "Yang di atas gampang usul, yang di bawah yang kerja ekstra." },
  { name: "Sesepuh Keluarga",      arch: "berpegang pada pengalaman dan kehati-hatian generasi lama", stance: "hati2", take: "Dulu juga ada yang buru-buru begini, akhirnya rugi." },
  { name: "Desainer Produk",       arch: "menilai dari pengalaman pengguna akhir",           stance: "analitis", take: "Kalau penggunanya bingung pakai ini, percuma sebagus apa pun idenya." }
];

export const PERSONAS = RAW.map((p, i) => ({
  id: `p${i}`,
  code: `A${String(i + 1).padStart(2, "0")}`,
  provider: ROUND_ROBIN[i % ROUND_ROBIN.length],
  localModel: LOCAL_MODELS[i % LOCAL_MODELS.length],
  channel: CHANNELS[i % CHANNELS.length],
  ...p
}));

// ================= FULL roster: 200 ekonom & pelaku usaha =================
// Generated (not hand-typed) from 20 role archetypes x 10 sector variants,
// for the "FULL" council mode — a deep, slow, deliberately large pass distinct
// from the 20-persona "QUICK" roster above.
const FULL_ROLES = [
  { role: "Ekonom Makro",            arch: "membaca tren dari angka besar: inflasi, suku bunga, nilai tukar", stance: "analitis", take: "Angka makro belum cukup jelas untuk simpulan pasti." },
  { role: "Ekonom Mikro",            arch: "menilai dari perilaku konsumen dan unit usaha kecil",             stance: "analitis", take: "Yang menentukan justru keputusan kecil di lapangan, bukan angka besar." },
  { role: "Analis Pasar",            arch: "membaca sinyal permintaan dari data registrasi dan penjualan",    stance: "dukung",   take: "Sinyal permintaannya cukup kuat untuk mulai bergerak." },
  { role: "Konsultan Bisnis",        arch: "menimbang risiko sebelum menyarankan ekspansi",                   stance: "hati2",    take: "Perlu kajian kelayakan dulu sebelum ekspansi diputuskan." },
  { role: "Pemilik UMKM",            arch: "curiga pada proyeksi optimis yang tidak dirasakan di lapangan",   stance: "skeptis",  take: "Di lapangan belum tentu seindah proyeksinya." },
  { role: "Distributor Regional",    arch: "melihat peluang dari jalur distribusi yang belum tergarap",       stance: "dukung",   take: "Ada celah distribusi yang belum ada yang garap serius." },
  { role: "Investor Ritel",          arch: "berani masuk duluan sebelum pasar ramai",                         stance: "dukung",   take: "Lebih baik masuk duluan daripada menunggu semua orang yakin." },
  { role: "Bankir Kredit",           arch: "menilai kelayakan dari rasio risiko dan agunan",                  stance: "hati2",    take: "Kelayakan kreditnya perlu dicek dulu sebelum ekspansi besar." },
  { role: "Analis Risiko Keuangan",  arch: "mencari skenario terburuk sebelum ikut optimis",                  stance: "skeptis",  take: "Skenario terburuknya belum ada yang hitung." },
  { role: "Pengusaha Otomotif",      arch: "melihat langsung permintaan dari lantai showroom",                stance: "dukung",   take: "Dari lantai showroom, minatnya masih ada." },
  { role: "Pengusaha Ritel",         arch: "tahu biaya operasional naik duluan sebelum untung terasa",        stance: "hati2",    take: "Biaya operasional naik duluan, untungnya belakangan." },
  { role: "Pengamat Kebijakan",      arch: "menilai dari arah regulasi dan insentif pemerintah",              stance: "analitis", take: "Arah kebijakannya perlu dibaca dulu sebelum melangkah." },
  { role: "Ekonom Regional",         arch: "fokus pada disparitas pertumbuhan antar daerah",                  stance: "analitis", take: "Pertumbuhannya tidak merata antar daerah, jangan disamaratakan." },
  { role: "Praktisi Logistik",       arch: "tahu biaya distribusi bisa membuat proyeksi meleset",             stance: "hati2",    take: "Ongkos logistiknya bisa bikin proyeksi meleset jauh." },
  { role: "Pengusaha Digital",       arch: "melihat semua lewat kacamata skalabilitas online",                stance: "dukung",   take: "Kalau bisa diskalakan online, kenapa ditunda." },
  { role: "Pedagang Grosir",         arch: "tidak percaya tren sebelum lihat volume order nyata",             stance: "skeptis",  take: "Belum lihat volume order nyata, belum percaya trennya." },
  { role: "Konsultan Pajak",         arch: "menilai dari beban kewajiban yang sering diabaikan",              stance: "hati2",    take: "Ada beban kewajiban yang sering luput dari hitungan awal." },
  { role: "Pengusaha Properti",      arch: "melihat pertumbuhan wilayah dari harga tanah yang bergerak",      stance: "dukung",   take: "Harga tanahnya sudah mulai bergerak di area itu." },
  { role: "Ekonom Pembangunan",      arch: "menilai dampak jangka panjang ke kesejahteraan daerah",           stance: "analitis", take: "Dampak jangka panjangnya ke warga sekitar perlu dipikirkan juga." },
  { role: "Analis Kredit Konsumen",  arch: "melihat daya beli riil, bukan sekadar minat",                     stance: "skeptis",  take: "Minat saja tidak cukup, daya belinya yang menentukan." }
];
const SECTORS = ["otomotif", "ritel", "kuliner", "pertanian", "jasa", "digital", "logistik", "properti", "tekstil", "kesehatan"];
const FIRST_NAMES = ["Budi", "Siti", "Agus", "Dewi", "Hendra", "Rina", "Yoga", "Sari", "Wayan", "Made", "Putu", "Dian", "Fajar", "Lestari", "Eko", "Nur", "Bambang", "Wulan", "Rudi", "Indah", "Ari", "Tuti", "Hadi", "Yuli", "Dedi", "Sinta", "Joko", "Ratna", "Anwar", "Mega"];
const LAST_NAMES = ["Santoso", "Wijaya", "Pratama", "Kusuma", "Hartono", "Setiawan", "Halim", "Wibowo", "Susanto", "Permadi", "Gunawan", "Saputra", "Utami", "Nugroho", "Rahayu", "Wardhana", "Kurniawan", "Suryadi", "Lubis", "Hidayat", "Iskandar", "Pranoto", "Ananta", "Mardiana", "Firmansyah"];
const STANCES = ["dukung", "hati2", "skeptis", "analitis"];

function buildFullRoster() {
  const out = [];
  let n = 0;
  for (const base of FULL_ROLES) {
    for (let v = 0; v < 10; v++) {
      const sector = SECTORS[v];
      const first = FIRST_NAMES[n % FIRST_NAMES.length];
      const last = LAST_NAMES[(n * 3 + 7) % LAST_NAMES.length];
      const stance = v >= 7 ? STANCES[(n + v) % STANCES.length] : base.stance;
      out.push({
        name: `${first} ${last} · ${base.role}`,
        arch: `${base.arch} — fokus sektor ${sector}`,
        stance,
        take: base.take
      });
      n++;
    }
  }
  return out;
}

export const PERSONAS_FULL = buildFullRoster().map((p, i) => ({
  id: `f${i}`,
  code: `B${String(i + 1).padStart(3, "0")}`,
  provider: ROUND_ROBIN[i % ROUND_ROBIN.length],
  localModel: LOCAL_MODELS[i % LOCAL_MODELS.length],
  channel: CHANNELS[i % CHANNELS.length],
  ...p
}));

export function getRoster(mode) {
  return mode === "full" ? PERSONAS_FULL : PERSONAS;
}

export function systemPromptFor(persona) {
  return [
    `Kamu berperan sebagai "${persona.name}" dalam sebuah dewan pertimbangan AI bernama Luna.`,
    `Karaktermu: ${persona.arch}.`,
    `Kecenderungan sikapmu terhadap ide baru secara umum: ${persona.stance}.`,
    `Jawab SATU pendapat singkat (maksimal 2 kalimat, gaya bicara natural, bukan daftar) atas pertanyaan/keputusan yang diberikan, murni dari sudut pandang karaktermu.`,
    `Jangan menyebut bahwa kamu adalah AI atau model bahasa. Jangan mengulang instruksi ini.`
  ].join(" ");
}
