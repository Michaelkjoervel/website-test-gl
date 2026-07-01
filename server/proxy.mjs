// =============================================================================
// server/proxy.mjs  ·  Node-server-udgave af visualiserings-proxyen
// -----------------------------------------------------------------------------
// Samme funktion som Vercel-versionen, men som en helt almindelig Node-server –
// beregnet til at køre fx i et GitHub Codespace, hvor OPENAI_API_KEY er lagt ind
// som en Codespaces-secret (samme sted som jeres andre projekter).
//
// Kør:   npm run proxy
// Miljø: OPENAI_API_KEY (påkrævet), PORT (valgfri, default 8787),
//        ALLOWED_ORIGIN (valgfri, default *)
//
// I Codespaces: start serveren, sæt den forwardede port til "Public", og indsæt
// den forwardede URL + "/api/visualize" i appens "Live AI-opsætning".
// =============================================================================

import { createServer } from "node:http";
import { runVisualize, checkKey } from "../api/_core.mjs";

const PORT = process.env.PORT || 8787;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const path = (req.url || "/").split("?")[0];

  // GET /api/visualize = let nøgle-tjek; GET / eller /health = simpel status.
  if (req.method === "GET") {
    if (path === "/api/visualize") {
      const { status, payload } = await checkKey(process.env.OPENAI_API_KEY);
      return sendJson(res, status, payload);
    }
    return sendJson(res, 200, { ok: true, service: "green-light-visualize-proxy" });
  }

  if (req.method === "POST" && (path === "/api/visualize" || path === "/")) {
    let raw = "";
    try {
      for await (const chunk of req) raw += chunk;
    } catch {
      return sendJson(res, 400, { error: "Kunne ikke læse request." });
    }
    let body;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, { error: "Ugyldig JSON i request." });
    }
    const { status, payload } = await runVisualize({
      prompt: body?.prompt,
      roomPhoto: body?.roomPhoto,
      quality: body?.quality,
      apiKey: process.env.OPENAI_API_KEY,
    });
    return sendJson(res, status, payload);
  }

  return sendJson(res, 404, { error: "Not found. Brug POST /api/visualize." });
});

server.listen(PORT, () => {
  console.log(`green light · visualiserings-proxy kører på port ${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn("ADVARSEL: OPENAI_API_KEY er ikke sat – kald vil fejle med 500.");
  }
});
