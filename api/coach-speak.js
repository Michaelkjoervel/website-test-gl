// =============================================================================
// api/coach-speak.js  ·  Vercel-adapter: tale-syntese (fallback-stemmen)
// -----------------------------------------------------------------------------
// POST /api/coach-speak  { text, voice? } → { audio: "data:audio/mpeg;base64,…" }
// GET  /api/coach-speak                   → status
//
// Bruges to steder:
//   1. Når realtime-stemmen ikke kan oprettes (se coach-session.js), så
//      rollespilskunden stadig kan HØRES i stedet for kun at kunne læses.
//   2. Til oplæsning af coachens feedback, når sælgeren træner i bilen.
//
// Lyden returneres som dataURL, så klienten bare kan sætte den på et
// <audio>-element — ingen filer, ingen midlertidigt lager, ingen delelige links.
//
// Env: OPENAI_API_KEY (påkrævet), SUPABASE_* (login),
//      COACH_TTS_MODEL (valgfri, default gpt-4o-mini-tts).
// =============================================================================

import { authorize, rateLimit, corsOrigin, speak } from "./_coach.mjs";

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

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = (req.headers?.authorization || "").replace(/^Bearer\s+/i, "");

  if (req.method === "GET") {
    return res.status(200).json({
      service: "green-light-salgscoach-speak",
      method: "POST { text, voice }",
      keyConfigured: Boolean(process.env.OPENAI_API_KEY),
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

  // Egen spand: oplæsning er billigt og hyppigt og må ikke æde samtalekvoten.
  const rl = rateLimit(`coach-speak:${auth.email || "anonymous"}`);
  if (!rl.ok) return res.status(rl.status).json({ error: rl.reason });

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "'text' er påkrævet." });

  let result;
  try {
    result = await speak({ text, voice: body?.voice, apiKey: process.env.OPENAI_API_KEY });
  } catch (e) {
    result = { ok: false, status: 502, error: `Uventet fejl: ${String(e?.message || e).slice(0, 200)}` };
  }

  if (!result.ok) {
    return res.status(result.status || 502).json({ error: result.error || "Talen kunne ikke syntetiseres." });
  }
  return res.status(200).json({ audio: result.audio, voice: result.voice });
}
