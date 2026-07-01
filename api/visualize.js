// =============================================================================
// api/visualize.js  ·  green light — proxy til fotorealistisk AI-visualisering
// -----------------------------------------------------------------------------
// Serverless-funktion (Vercel, Node-runtime) der holder OpenAI-nøglen skjult og
// kalder gpt-image-1's billed-REDIGERINGS-endpoint (`/v1/images/edits`).
//
// Hvorfor edits/inpainting og ikke tekst-til-billede?  Fordi vi vil BEVARE
// kundens rum (vægge, møbler, perspektiv) og kun ændre belysningen. Vi sender
// derfor kundens rumfoto som input-billede + `input_fidelity: high`.
//
// Frontenden (src/lib/visualizationProvider.ts · proxyProvider) POST'er JSON:
//   { prompt, roomPhoto (dataURL), quality?, ...meta }
// og forventer JSON tilbage:
//   { imageData: "data:image/png;base64,..." }
//
// Miljøvariabler (sæt i Vercel → Project → Settings → Environment Variables):
//   OPENAI_API_KEY   (påkrævet)   – din OpenAI *API*-nøgle (ikke ChatGPT-login)
//   ALLOWED_ORIGIN   (valgfri)    – fx https://michaelkjoervel.github.io  (ellers *)
// =============================================================================

export const config = {
  // gpt-image-1-redigeringer tager typisk 10-40 s. Giv god tid.
  maxDuration: 60,
};

const OPENAI_EDITS_URL = "https://api.openai.com/v1/images/edits";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function dataUrlToParts(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || "");
  if (!m) throw new Error("roomPhoto skal være en base64 dataURL.");
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

// Læs billedets mål så vi kan vælge et output-format med samme orientering.
function imageSize(buffer, mime) {
  try {
    if (mime.includes("png")) {
      return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
    }
    if (mime.includes("jpeg") || mime.includes("jpg")) {
      let o = 2;
      while (o + 9 < buffer.length) {
        if (buffer[o] !== 0xff) { o++; continue; }
        const marker = buffer[o + 1];
        // SOF-markører (undtagen DHT/JPG/DAC) bærer billedmål
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { h: buffer.readUInt16BE(o + 5), w: buffer.readUInt16BE(o + 7) };
        }
        o += 2 + buffer.readUInt16BE(o + 2);
      }
    }
  } catch {
    /* falder tilbage til auto nedenfor */
  }
  return null;
}

function pickSize(dims) {
  if (!dims) return "auto";
  const r = dims.w / dims.h;
  if (r >= 1.2) return "1536x1024";
  if (r <= 0.83) return "1024x1536";
  return "1024x1024";
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Serveren mangler OPENAI_API_KEY. Sæt den i Vercel → Settings → Environment Variables." });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Ugyldig JSON i request." });
  }

  const { prompt, roomPhoto, quality } = body || {};
  if (!prompt || !roomPhoto) {
    return res.status(400).json({ error: "Både 'prompt' og 'roomPhoto' (dataURL) er påkrævet." });
  }

  let img;
  try {
    img = dataUrlToParts(roomPhoto);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const size = pickSize(imageSize(img.buffer, img.mime));
  const ext = img.mime.includes("png") ? "png" : "jpg";

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("image", new Blob([img.buffer], { type: img.mime }), `room.${ext}`);
  form.append("prompt", String(prompt).slice(0, 32000));
  form.append("size", size);
  form.append("quality", ["low", "medium", "high"].includes(quality) ? quality : "medium");
  // Bevar så meget af kundens rum som muligt
  form.append("input_fidelity", "high");
  form.append("n", "1");

  let openaiRes;
  try {
    openaiRes = await fetch(OPENAI_EDITS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (e) {
    return res.status(502).json({ error: `Kunne ikke nå OpenAI: ${e.message}` });
  }

  if (!openaiRes.ok) {
    let detail = "";
    try {
      const err = await openaiRes.json();
      detail = err?.error?.message || JSON.stringify(err);
    } catch {
      detail = await openaiRes.text().catch(() => "");
    }
    return res.status(openaiRes.status === 401 ? 401 : 502).json({
      error: `OpenAI-fejl (${openaiRes.status}): ${String(detail).slice(0, 300)}`,
    });
  }

  let json;
  try {
    json = await openaiRes.json();
  } catch {
    return res.status(502).json({ error: "Uventet svar fra OpenAI." });
  }

  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) return res.status(502).json({ error: "OpenAI returnerede intet billede." });

  return res.status(200).json({ imageData: `data:image/png;base64,${b64}` });
}
