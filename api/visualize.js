// =============================================================================
// api/visualize.js  ·  Vercel-adapter for visualiserings-proxyen
// -----------------------------------------------------------------------------
// Tynd HTTP-wrapper omkring den delte kerne i _core.mjs. Holder OpenAI-nøglen
// skjult (process.env.OPENAI_API_KEY) og eksponerer:
//   POST /api/visualize  – generér visualisering (kræver login; rate-limited)
//   GET  /api/visualize  – status. Uden login: kun { authRequired, keyConfigured }.
//                          Med gyldigt login (eller ALLOW_ANONYMOUS=1): fuldt
//                          nøgle-tjek mod OpenAI ({ keyValid }).
//
// Miljøvariabler (Vercel → Project → Settings → Environment Variables):
//   OPENAI_API_KEY        (påkrævet)  – OpenAI *API*-nøgle (ikke ChatGPT-login)
//   SUPABASE_URL          (påkrævet)  – håndhæver login; uden den fejler alt lukket
//   SUPABASE_ANON_KEY     (påkrævet)  – do.
//   ALLOWED_EMAIL_DOMAIN  (valgfri)   – fx green-light.dk
//   ALLOWED_ORIGIN        (valgfri)   – ekstra tilladt origin, eller "*"
//   RATE_LIMIT_PER_HOUR / RATE_LIMIT_GLOBAL_PER_DAY (valgfri) – forbrugsbremser
//   ALLOW_ANONYMOUS=1     (KUN lokal test) – åbner endpointet uden login
//
// Node-server-udgave (fx GitHub Codespaces): server/proxy.mjs – samme kerne.
// =============================================================================

import { runVisualize, checkKey, authorize, rateLimit, corsOrigin } from "./_core.mjs";

export const config = {
  maxDuration: 60, // gpt-image-1-redigeringer tager typisk 10-40 s
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

  // GET = status/nøgle-tjek. Uden login røbes IKKE om OpenAI-nøglen virker
  // (ellers er endpointet et gratis orakel for angribere).
  if (req.method === "GET") {
    const auth = await authorize(token);
    if (!auth.ok) {
      return res.status(200).json({
        service: "green-light-visualize-proxy",
        authRequired: true,
        keyConfigured: Boolean(process.env.OPENAI_API_KEY),
      });
    }
    const { status, payload } = await checkKey(process.env.OPENAI_API_KEY);
    return res.status(status).json(payload);
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

  // Forbrugsbremse pr. bruger + globalt (best effort pr. instans).
  const rl = rateLimit(auth.email);
  if (!rl.ok) return res.status(rl.status).json({ error: rl.reason });

  const { status, payload } = await runVisualize({
    prompt: body?.prompt,
    roomPhoto: body?.roomPhoto,
    quality: body?.quality,
    fixtureImages: body?.fixtureImages,
    autoPrompt: body?.autoPrompt,
    apiKey: process.env.OPENAI_API_KEY,
  });
  return res.status(status).json(payload);
}
