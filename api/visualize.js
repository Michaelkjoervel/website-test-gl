// =============================================================================
// api/visualize.js  ·  Vercel-adapter for visualiserings-proxyen
// -----------------------------------------------------------------------------
// Tynd HTTP-wrapper omkring den delte kerne i _core.mjs. Holder OpenAI-nøglen
// skjult (process.env.OPENAI_API_KEY) og eksponerer POST /api/visualize.
//
// Miljøvariabler (Vercel → Project → Settings → Environment Variables):
//   OPENAI_API_KEY   (påkrævet)   – din OpenAI *API*-nøgle (ikke ChatGPT-login)
//   ALLOWED_ORIGIN   (valgfri)    – fx https://michaelkjoervel.github.io  (ellers *)
//
// Kører proxyen i stedet som Node-server (fx i GitHub Codespaces)? Se
// server/proxy.mjs — den bruger samme kerne.
// =============================================================================

import { runVisualize } from "./_core.mjs";

export const config = {
  maxDuration: 60, // gpt-image-1-redigeringer tager typisk 10-40 s
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Brug POST." });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Ugyldig JSON i request." });
  }

  const { status, payload } = await runVisualize({
    prompt: body?.prompt,
    roomPhoto: body?.roomPhoto,
    quality: body?.quality,
    apiKey: process.env.OPENAI_API_KEY,
  });
  return res.status(status).json(payload);
}
