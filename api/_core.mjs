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
