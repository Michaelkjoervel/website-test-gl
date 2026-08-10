// =============================================================================
// api/coach-session.js  ·  Vercel-adapter: kortlivet nøgle til stemmesamtalen
// -----------------------------------------------------------------------------
// POST /api/coach-session
//   { modeId, coachMode, language, scenario, hiddenBlob, sellerContext,
//     intake, voice, eagerness }
//   → { clientSecret, expiresAt, model, voice, api }
//
// GET  /api/coach-session → { service, realtimeConfigured }
//
// HVORFOR ET EGET ENDPOINT: browseren skal tale direkte med OpenAI's realtime-
// API over WebRTC for at få lav latenstid — men den må ALDRIG se OPENAI_API_KEY.
// Derfor udsteder serveren en kortlivet client secret (ek_…), der kun kan bruges
// til netop denne session.
//
// SIKKERHEDEN I ØVELSEN: rollespilskundens skjulte fakta ligger i den forseglede
// `hiddenBlob`. Den åbnes HER — og indholdet ender udelukkende i den systeminstruk-
// tion, OpenAI får. Klienten ser hverken fakta eller instruktion.
//
// FEJLER DET: vi svarer 200 med { error, fallbackToBrowserVoice: true }, så
// appen kan skifte til browserens egen talesyntese i stedet for at vise sælgeren
// en blindgyde midt i en øvelse.
//
// Env: OPENAI_API_KEY (påkrævet), SUPABASE_* (login), COACH_SECRET (anbefalet),
//      COACH_REALTIME_MODEL / COACH_TRANSCRIBE_MODEL (valgfri).
// =============================================================================

import {
  authorize,
  rateLimit,
  corsOrigin,
  openHidden,
  mintRealtimeSession,
  normalizeVoice,
} from "./_coach.mjs";
import { MODES, buildSystemInstructions } from "./_coachprompt.mjs";

export const config = {
  maxDuration: 60,
};

function setCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", corsOrigin(req.headers?.origin || ""));
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function trim(value, max) {
  const s = typeof value === "string" ? value : value == null ? "" : String(value);
  return s.length > max ? `${s.slice(0, max)}\n…[forkortet]` : s;
}

function findMode(modeId) {
  const list = Array.isArray(MODES) ? MODES : Object.values(MODES || {});
  return list.find((m) => m && m.id === modeId) || null;
}

const EAGERNESS = ["low", "auto", "high"];

/**
 * sellerContext er et OBJEKT, og promptbyggeren læser .weaknesses/.focusAreas
 * direkte. Det må derfor ikke serialiseres på vejen — så mister coachen sin
 * hukommelse om sælgeren, uden at noget fejler synligt. Vi begrænser i stedet
 * størrelsen ved at klippe listerne og beholder formen.
 */
function boundContext(value, maxItems = 8) {
  if (!value || typeof value !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = Array.isArray(v) ? v.slice(0, maxItems) : v;
  return out;
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = (req.headers?.authorization || "").replace(/^Bearer\s+/i, "");

  if (req.method === "GET") {
    return res.status(200).json({
      service: "green-light-salgscoach-session",
      realtimeConfigured: Boolean(process.env.OPENAI_API_KEY),
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Brug POST." });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Ugyldig JSON i request." });
  }

  // Login håndhæves altid (fejler lukket hvis SUPABASE_* mangler).
  const auth = await authorize(token);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.reason });

  // Egen spand: stemmesessioner tæller ikke mod tekst-/analysekvoten.
  const rl = rateLimit(`coach-session:${auth.email || "anonymous"}`);
  if (!rl.ok) return res.status(rl.status).json({ error: rl.reason });

  const modeId = String(body?.modeId || "").trim();
  if (!modeId) {
    return res.status(400).json({ error: "'modeId' er påkrævet for at starte en stemmesamtale." });
  }

  const mode = findMode(modeId);
  const language = body?.language === "en" ? "en" : "da";
  // Kunden i rollespillet har sin egen stemme; ellers en neutral coach-stemme.
  const voice = normalizeVoice(body?.voice || body?.scenario?.persona?.voice, "cedar");
  const eagerness = EAGERNESS.includes(body?.eagerness) ? body.eagerness : "auto";

  let instructions = "";
  try {
    instructions = buildSystemInstructions({
      modeId,
      coachMode: body?.coachMode || mode?.defaultCoachMode || "realistisk",
      language,
      scenario: body?.scenario || null,
      hidden: openHidden(body?.hiddenBlob), // åbnes KUN her — aldrig i browseren
      sellerContext: boundContext(body?.sellerContext),
      intake: trim(body?.intake, 6000),
      documentText: trim(body?.documentText, 40_000),
      purpose: "realtime",
    });
  } catch {
    instructions = "";
  }
  if (!instructions || !instructions.trim()) {
    return res.status(200).json({
      error: "Instruktionen til stemmesamtalen kunne ikke bygges på serveren.",
      fallbackToBrowserVoice: true,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      error: "Serveren mangler OPENAI_API_KEY — stemmesamtalen kan ikke startes.",
      fallbackToBrowserVoice: true,
    });
  }

  let session;
  try {
    session = await mintRealtimeSession({ instructions, voice, language, eagerness, apiKey });
  } catch (e) {
    session = { ok: false, error: `Uventet fejl: ${String(e?.message || e).slice(0, 200)}` };
  }

  if (!session.ok) {
    // 200 med vilje: appen skal degradere til browserstemmen, ikke gå i stå.
    return res.status(200).json({
      error: session.error || "Stemmesessionen kunne ikke oprettes.",
      fallbackToBrowserVoice: true,
    });
  }

  return res.status(200).json({
    clientSecret: session.clientSecret,
    expiresAt: session.expiresAt,
    model: session.model,
    voice: session.voice,
    api: session.api,
  });
}
