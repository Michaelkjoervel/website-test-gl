// =============================================================================
// api/_core.mjs  ·  Delt kerne for visualiserings-proxyen
// -----------------------------------------------------------------------------
// Ren logik uden HTTP-framework, så SAMME kode kan bruges af:
//   - api/visualize.js      (Vercel-funktion)
//   - server/proxy.mjs      (almindelig Node-server, fx i GitHub Codespaces)
//
// Kalder OpenAI gpt-image-1's billed-redigerings-endpoint (/v1/images/edits)
// med kundens rumfoto + input_fidelity:high, så rummet bevares og kun
// belysningen ændres. Filnavn starter med "_" så Vercel ikke gør det til en rute.
// =============================================================================

const OPENAI_EDITS_URL = "https://api.openai.com/v1/images/edits";

/**
 * Verificér brugerens Supabase-login, FØR OpenAI kaldes (så kun green light-
 * brugere kan bruge jeres credits).
 *
 * FEJLER LUKKET: er auth ikke konfigureret (env mangler), afvises alle kald
 * med 503, så en glemt env-variabel aldrig efterlader et betalings-endpoint
 * åbent for internettet. Til lokal udvikling kan ALLOW_ANONYMOUS=1 sættes
 * eksplicit for at køre uden login.
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY (påkrævet for at håndhæve login),
 *      ALLOWED_EMAIL_DOMAIN (valgfri, fx "green-light.dk"),
 *      ALLOW_ANONYMOUS=1 (kun til lokal test – åbner endpointet).
 */
export async function authorize(token) {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    const anonOk = ["1", "true", "yes"].includes(String(process.env.ALLOW_ANONYMOUS || "").toLowerCase());
    if (anonOk) return { ok: true };
    return {
      ok: false,
      status: 503,
      reason: "Login er ikke konfigureret på serveren (SUPABASE_URL/SUPABASE_ANON_KEY mangler) – endpointet er lukket af sikkerhedshensyn.",
    };
  }
  if (!token) return { ok: false, status: 401, reason: "Log ind kræves." };

  let r;
  try {
    r = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
  } catch (e) {
    return { ok: false, status: 502, reason: `Kunne ikke verificere login: ${e.message}` };
  }
  if (!r.ok) return { ok: false, status: 401, reason: "Ugyldig eller udløbet session – log ind igen." };

  let user;
  try {
    user = await r.json();
  } catch {
    return { ok: false, status: 401, reason: "Kunne ikke læse brugeren." };
  }

  const domain = (process.env.ALLOWED_EMAIL_DOMAIN || "").trim().toLowerCase();
  const email = String(user?.email || "").toLowerCase();
  if (domain && !email.endsWith(`@${domain}`)) {
    return { ok: false, status: 403, reason: "Din konto har ikke adgang til værktøjet." };
  }
  return { ok: true, email };
}

// ---------------------------------------------------------------------------
// Rate limiting (best effort, i hukommelsen)
// ---------------------------------------------------------------------------
// Serverless-instanser deler ikke hukommelse, så dette er en per-instans
// bremse mod løbske scripts/uheld – ikke en garanti. Skal loftet være hårdt
// på tværs af instanser, kræver det et eksternt lager (fx Upstash/KV).
// Env-overrides: RATE_LIMIT_PER_HOUR (pr. bruger), RATE_LIMIT_GLOBAL_PER_DAY.

const RL_PER_USER = Math.max(1, Number(process.env.RATE_LIMIT_PER_HOUR) || 20);
const RL_GLOBAL_PER_DAY = Math.max(1, Number(process.env.RATE_LIMIT_GLOBAL_PER_DAY) || 300);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const rlPerUser = new Map(); // email -> [timestamps]
let rlGlobal = []; // [timestamps]

export function rateLimit(key) {
  const now = Date.now();
  rlGlobal = rlGlobal.filter((t) => now - t < DAY);
  if (rlGlobal.length >= RL_GLOBAL_PER_DAY) {
    return { ok: false, status: 429, reason: "Dagens samlede grænse for AI-genereringer er nået. Prøv igen i morgen, eller kontakt administratoren." };
  }
  const k = String(key || "anonymous").toLowerCase();
  const mine = (rlPerUser.get(k) || []).filter((t) => now - t < HOUR);
  if (mine.length >= RL_PER_USER) {
    return { ok: false, status: 429, reason: `Grænsen på ${RL_PER_USER} genereringer pr. time er nået. Vent lidt, og prøv igen.` };
  }
  mine.push(now);
  rlPerUser.set(k, mine);
  rlGlobal.push(now);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
// Returnér den Allow-Origin der skal sættes for et givent request-origin.
// Default-allowlisten er appens rigtige adresser; ALLOWED_ORIGIN-env kan
// tilføje én ekstra (eller sættes til "*" for helt åben, fx lokal test).

const DEFAULT_ORIGINS = [
  "https://michaelkjoervel.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
];

export function corsOrigin(requestOrigin) {
  const extra = (process.env.ALLOWED_ORIGIN || "").trim();
  if (extra === "*") return "*";
  const allow = extra ? [extra, ...DEFAULT_ORIGINS] : DEFAULT_ORIGINS;
  return allow.includes(requestOrigin) ? requestOrigin : allow[0];
}

export function dataUrlToParts(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || "");
  if (!m) throw new Error("roomPhoto skal være en base64 dataURL.");
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

// Læs billedets mål (PNG/JPEG) så output får samme orientering.
export function imageSize(buffer, mime) {
  try {
    if (mime.includes("png")) {
      return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
    }
    if (mime.includes("jpeg") || mime.includes("jpg")) {
      let o = 2;
      while (o + 9 < buffer.length) {
        if (buffer[o] !== 0xff) { o++; continue; }
        const marker = buffer[o + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { h: buffer.readUInt16BE(o + 5), w: buffer.readUInt16BE(o + 7) };
        }
        o += 2 + buffer.readUInt16BE(o + 2);
      }
    }
  } catch {
    /* falder tilbage til auto */
  }
  return null;
}

export function pickSize(dims) {
  if (!dims) return "auto";
  const r = dims.w / dims.h;
  if (r >= 1.2) return "1536x1024";
  if (r <= 0.83) return "1024x1536";
  return "1024x1024";
}

/**
 * Kør én visualisering. Ren funktion: ingen req/res.
 * @returns {{ status: number, payload: object }}
 */
export async function runVisualize({ prompt, roomPhoto, quality, apiKey }) {
  if (!apiKey) {
    return { status: 500, payload: { error: "Serveren mangler OPENAI_API_KEY." } };
  }
  if (!prompt || !roomPhoto) {
    return { status: 400, payload: { error: "Både 'prompt' og 'roomPhoto' (dataURL) er påkrævet." } };
  }

  let img;
  try {
    img = dataUrlToParts(roomPhoto);
  } catch (e) {
    return { status: 400, payload: { error: e.message } };
  }

  if (!img.mime.startsWith("image/")) {
    return { status: 400, payload: { error: "roomPhoto skal være et billede (png/jpeg/webp)." } };
  }
  if (img.buffer.length > 8 * 1024 * 1024) {
    return { status: 413, payload: { error: "Billedet er for stort (maks 8 MB). Appen nedskalerer normalt automatisk – prøv igen med et mindre billede." } };
  }

  const size = pickSize(imageSize(img.buffer, img.mime));
  const ext = img.mime.includes("png") ? "png" : "jpg";

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("image", new Blob([img.buffer], { type: img.mime }), `room.${ext}`);
  form.append("prompt", String(prompt).slice(0, 32000));
  form.append("size", size);
  form.append("quality", ["low", "medium", "high"].includes(quality) ? quality : "medium");
  form.append("input_fidelity", "high"); // bevar kundens rum bedst muligt
  form.append("n", "1");

  let openaiRes;
  try {
    openaiRes = await fetch(OPENAI_EDITS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (e) {
    return { status: 502, payload: { error: `Kunne ikke nå OpenAI: ${e.message}` } };
  }

  if (!openaiRes.ok) {
    let detail = "";
    try {
      const err = await openaiRes.json();
      detail = err?.error?.message || JSON.stringify(err);
    } catch {
      detail = await openaiRes.text().catch(() => "");
    }
    return {
      status: openaiRes.status === 401 ? 401 : 502,
      payload: { error: `OpenAI-fejl (${openaiRes.status}): ${String(detail).slice(0, 300)}` },
    };
  }

  let json;
  try {
    json = await openaiRes.json();
  } catch {
    return { status: 502, payload: { error: "Uventet svar fra OpenAI." } };
  }

  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) return { status: 502, payload: { error: "OpenAI returnerede intet billede." } };

  return { status: 200, payload: { imageData: `data:image/png;base64,${b64}` } };
}

/**
 * Let nøgle-tjek: pinger OpenAI's models-endpoint (gratis, genererer intet
 * billede) og fortæller, om nøglen i miljøet virker. Bruges af GET-ruten, så
 * man kan verificere opsætningen ved bare at åbne funktions-URL'en i en browser.
 */
export async function checkKey(apiKey) {
  if (!apiKey) {
    return { status: 200, payload: { keyValid: false, reason: "OPENAI_API_KEY er ikke sat i miljøet (husk at redeploye efter du tilføjer den)." } };
  }
  let r;
  try {
    r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (e) {
    return { status: 200, payload: { keyValid: false, reason: `Kunne ikke nå OpenAI: ${e.message}` } };
  }
  if (r.ok) return { status: 200, payload: { keyValid: true } };
  if (r.status === 401) {
    return { status: 200, payload: { keyValid: false, reason: "Nøglen blev afvist (401) – forkert, udløbet eller mangler adgang." } };
  }
  let detail = "";
  try {
    const j = await r.json();
    detail = j?.error?.message || "";
  } catch {
    /* ignore */
  }
  return { status: 200, payload: { keyValid: false, reason: `OpenAI svarede ${r.status}. ${detail}`.trim() } };
}
