// =============================================================================
// api/extract.js  ·  Vercel-adapter: PDF-datablad → armaturdata
// -----------------------------------------------------------------------------
// POST /api/extract  { pdf: dataURL, filename? } → { fixture: {...} }
// Kræver login (samme Supabase-verificering som /api/visualize) og tæller på
// sin egen rate-limit-spand, så datablad-læsning ikke æder genererings-kvoten.
//
// Env: OPENAI_API_KEY (påkrævet), SUPABASE_* (login), EXTRACT_MODEL (valgfri,
// default gpt-5-mini – en billig model; typisk under 10 øre pr. datablad).
// =============================================================================

import { runExtract, authorize, rateLimit, corsOrigin } from "./_core.mjs";

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
    return res.status(200).json({ service: "green-light-extract", method: "POST { pdf, filename }" });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Brug POST." });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Ugyldig JSON i request." });
  }

  const auth = await authorize(token);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.reason });

  // Egen spand: datablad-læsninger tæller ikke mod billed-genereringskvoten.
  const rl = rateLimit(`extract:${auth.email || "anonymous"}`);
  if (!rl.ok) return res.status(rl.status).json({ error: rl.reason });

  const { status, payload } = await runExtract({
    pdf: body?.pdf,
    filename: body?.filename,
    apiKey: process.env.OPENAI_API_KEY,
  });
  return res.status(status).json(payload);
}
