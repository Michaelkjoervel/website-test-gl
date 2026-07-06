// =============================================================================
// server/proxy.mjs  ·  Node-server-udgave af visualiserings-proxyen
// -----------------------------------------------------------------------------
// Samme funktion som Vercel-versionen, men som en helt almindelig Node-server –
// beregnet til at køre fx i et GitHub Codespace, hvor OPENAI_API_KEY er lagt ind
// som en Codespaces-secret.
//
// Kør:   npm run proxy
// Miljø: OPENAI_API_KEY (påkrævet), SUPABASE_URL + SUPABASE_ANON_KEY (påkrævet
//        for login; uden dem fejler alt lukket), PORT (valgfri, default 8787),
//        ALLOWED_ORIGIN / ALLOWED_EMAIL_DOMAIN / RATE_LIMIT_* (valgfri),
//        ALLOW_ANONYMOUS=1 (KUN lokal test – åbner endpointet uden login).
//
// I Codespaces: start serveren, sæt den forwardede port til "Public", og indsæt
// den forwardede URL + "/api/visualize" i appens "Live AI-opsætning".
// =============================================================================

import { createServer } from "node:http";
import { runVisualize, runExtract, checkKey, authorize, rateLimit, corsOrigin } from "../api/_core.mjs";

const PORT = process.env.PORT || 8787;

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", corsOrigin(req.headers?.origin || ""));
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const path = (req.url || "/").split("?")[0];
  const token = (req.headers?.authorization || "").replace(/^Bearer\s+/i, "");

  if (req.method === "GET") {
    // Nøgle-tjek kun for loggede-ind brugere; ellers blot status uden orakel.
    if (path === "/api/visualize") {
      const auth = await authorize(token);
      if (!auth.ok) {
        return sendJson(res, 200, {
          service: "green-light-visualize-proxy",
          authRequired: true,
          keyConfigured: Boolean(process.env.OPENAI_API_KEY),
        });
      }
      const { status, payload } = await checkKey(process.env.OPENAI_API_KEY);
      return sendJson(res, status, payload);
    }
    return sendJson(res, 200, { ok: true, service: "green-light-visualize-proxy" });
  }

  if (req.method === "POST" && (path === "/api/visualize" || path === "/api/extract" || path === "/")) {
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

    // Login håndhæves altid (fejler lukket hvis SUPABASE_* mangler).
    const auth = await authorize(token);
    if (!auth.ok) return sendJson(res, auth.status, { error: auth.reason });

    if (path === "/api/extract") {
      const rl = rateLimit(`extract:${auth.email || "anonymous"}`);
      if (!rl.ok) return sendJson(res, rl.status, { error: rl.reason });
      const { status, payload } = await runExtract({
        pdf: body?.pdf,
        filename: body?.filename,
        apiKey: process.env.OPENAI_API_KEY,
      });
      return sendJson(res, status, payload);
    }

    const rl = rateLimit(auth.email);
    if (!rl.ok) return sendJson(res, rl.status, { error: rl.reason });

    const { status, payload } = await runVisualize({
      prompt: body?.prompt,
      roomPhoto: body?.roomPhoto,
      quality: body?.quality,
      fixtureImages: body?.fixtureImages,
      autoPrompt: body?.autoPrompt,
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
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.warn("ADVARSEL: SUPABASE_URL/SUPABASE_ANON_KEY er ikke sat – alle kald afvises (503). Sæt ALLOW_ANONYMOUS=1 for åben lokal test.");
  }
});
