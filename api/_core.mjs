// =============================================================================
// api/_core.mjs  ·  Delt kerne for visualiserings-proxyen
// -----------------------------------------------------------------------------
// Ren logik uden HTTP-framework, så SAMME kode kan bruges af:
//   - api/visualize.js + api/extract.js  (Vercel-funktioner)
//   - server/proxy.mjs                   (Node-server, fx GitHub Codespaces)
//
// runVisualize: OpenAI gpt-image-1's billed-redigering (/v1/images/edits) med
// kundens rumfoto + input_fidelity:high, så rummet bevares.
// runExtract:   læser et PDF-datablad med en billig tekst/vision-model og
// returnerer armaturets specs som struktureret JSON.
// Filnavn starter med "_" så Vercel ikke gør det til en rute.
// =============================================================================

const OPENAI_EDITS_URL = "https://api.openai.com/v1/images/edits";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

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

  // ALLOWED_EMAIL_DOMAIN: komma-/semikolon-/mellemrumssepareret liste af
  // domæner og/eller hele e-mails. Tolerant over for "@"-præfiks og luft:
  //   "green-light.dk"                        → alle @green-light.dk
  //   "green-light.dk, mkj@gmail.com"         → domænet + én bestemt konto
  const rawAllow = (process.env.ALLOWED_EMAIL_DOMAIN || "").toLowerCase();
  const entries = rawAllow.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const email = String(user?.email || "").toLowerCase();
  if (entries.length) {
    const allowed = entries.some((entry) => {
      // Tolerér indsatte anførselstegn og @-præfiks ("green-light.dk", @green-light.dk).
      const e = entry.replace(/^["'@]+|["']+$/g, "");
      // Indeholder værdien selv et "@", er det en hel e-mail; ellers et domæne.
      return e.includes("@") ? email === e : email.endsWith(`@${e}`);
    });
    if (!allowed) {
      return {
        ok: false,
        status: 403,
        reason: `Din konto (${email || "ukendt"}) har ikke adgang til værktøjet. Kontakt administratoren, hvis den skal tilføjes.`,
      };
    }
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

// ---------------------------------------------------------------------------
// AI-lysdesigner: skriv den optimale redigerings-prompt UD FRA selve billedet
// ---------------------------------------------------------------------------
// Det er den afgørende forskel på "skabelon-prompt" og ChatGPT-kvalitet: en
// vision-model KIGGER på kundens rum (og evt. produktbilleder) og formulerer
// en skræddersyet instruks til gpt-image-1 – præcis som ChatGPT gør internt.
// Fejler trinnet, falder vi tilbage til den strukturerede brief (blokerer
// aldrig genereringen). Model: PROMPT_MODEL-env, default gpt-5-mini.

const PROMPT_WRITER_SYSTEM = `You are an expert architectural lighting designer and prompt engineer for OpenAI's gpt-image-1 image EDITING endpoint. You are shown a photo of a customer's real room (first image). Any additional images show the EXACT luminaire products that will be installed.

Write the single best English editing prompt that will:
- keep the room EXACTLY as photographed: same geometry, walls, furniture, materials, camera angle and perspective — only add/replace the luminaires and render their realistic light
- place the requested number and type of luminaires plausibly, referring to surfaces actually visible in THIS photo (e.g. "the white suspended ceiling", "the beam above the desks") — never invent rooms or furniture
- describe realistic illumination for the requested scenario: correct light pools on floor/walls, soft shadows, the specified colour temperature, believable brightness falloff, no blown-out hotspots
- if product reference images are provided, instruct the model to replicate those exact fixtures faithfully (shape, finish, proportions)
- photorealistic, high detail, professional architectural photography look

Output ONLY the final prompt text — no preamble, no quotes, max 180 words.`;

export async function craftPrompt({ brief, roomPhoto, fixtureImages = [], apiKey }) {
  const model = process.env.PROMPT_MODEL || "gpt-5-mini";
  const content = [
    { type: "image_url", image_url: { url: roomPhoto } },
    ...fixtureImages.slice(0, 3).map((u) => ({ type: "image_url", image_url: { url: u } })),
    { type: "text", text: `Requirements from the sales tool:\n${String(brief).slice(0, 8000)}` },
  ];
  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: PROMPT_WRITER_SYSTEM },
          { role: "user", content },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    return text && text.length > 40 ? text.slice(0, 4000) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ChatGPT-pipelinen: Responses API + image_generation-værktøjet
// ---------------------------------------------------------------------------
// Det ER den vej, ChatGPT selv bruger: ræsonnementsmodellen (RENDER_MODEL,
// default gpt-5) SER rumbilledet + produktreferencer i sin kontekst og styrer
// selv billedgenereringen. Scenen GEN-RENDERES sammenhængende — gammelt lysskær
// forsvinder, og ny belysning integreres korrekt — i modsætning til
// /images/edits med høj input-troskab, som bevarer kildens pixels så hårdt, at
// den hverken fjerner gammelt lys eller kan sætte armaturer pænt ind.
// Fejler denne vej (fx modeladgang), falder vi tilbage til edits-pipelinen.
// Env: RENDER_MODEL (default gpt-5), IMAGE_FIDELITY=high (mere pixeltro, men
// gen-belyser dårligere), RENDER_PIPELINE=edits (tving gammel pipeline).

function buildRenderInstruction(brief, hasRefs) {
  return [
    "You are producing a photorealistic lighting-upgrade visualization for a sales meeting, based on the attached photo of the customer's actual room.",
    "",
    "Non-negotiable requirements:",
    "1. REMOVE every existing luminaire AND every trace of its light: glow, bright spots, ceiling halos, reflections. The old lighting must be completely gone.",
    "2. Install the new luminaires described in the brief. They must sit PERFECTLY straight, aligned with the ceiling's lines/grid and evenly spaced — crooked or floating fixtures are unacceptable.",
    "3. Relight the ENTIRE scene coherently from the new luminaires only: realistic light pools, soft shadows, correct colour temperature, believable falloff on walls and floor.",
    "4. Keep the room true to the photo: same architecture, walls, furniture, materials, camera angle and perspective. Do not redesign anything.",
    hasRefs
      ? "5. The additional attached image(s) show the EXACT products to install — replicate their shape, finish and proportions faithfully."
      : "",
    "",
    "Brief from the sales tool:",
    String(brief).slice(0, 8000),
    "",
    "Generate the final image now.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function runResponsesPipeline({ brief, roomPhoto, refUrls, size, quality, apiKey }) {
  const model = process.env.RENDER_MODEL || "gpt-5";
  const fidelity = (process.env.IMAGE_FIDELITY || "").trim();
  const tool = {
    type: "image_generation",
    size,
    quality,
    output_format: "png",
    ...(fidelity ? { input_fidelity: fidelity } : {}),
  };
  const body = {
    model,
    reasoning: { effort: "low" },
    input: [
      {
        role: "user",
        content: [
          { type: "input_image", image_url: roomPhoto },
          ...refUrls.map((u) => ({ type: "input_image", image_url: u })),
          { type: "input_text", text: buildRenderInstruction(brief, refUrls.length > 0) },
        ],
      },
    ],
    tools: [tool],
    tool_choice: { type: "image_generation" },
  };
  try {
    const res = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const out = Array.isArray(json?.output) ? json.output : [];
    const call = [...out].reverse().find((o) => o?.type === "image_generation_call" && o?.result);
    if (!call) return null;
    return { b64: call.result, revised: call.revised_prompt || null };
  } catch {
    return null;
  }
}

/**
 * Kør én visualisering. Ren funktion: ingen req/res.
 * Primær vej: Responses API (ChatGPT-pipelinen). Fallback: lysdesigner-prompt
 * + /images/edits. fixtureImages: op til 3 produktbilleder (dataURLs) som
 * visuelle referencer. autoPrompt (default true) gælder fallback-vejen.
 * @returns {{ status: number, payload: object }}
 */
export async function runVisualize({ prompt, roomPhoto, quality, apiKey, fixtureImages, autoPrompt }) {
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

  // Produktreference-billeder: valider stille og roligt (ugyldige springes over).
  const refs = [];
  const refUrls = [];
  for (const fi of (Array.isArray(fixtureImages) ? fixtureImages : []).slice(0, 3)) {
    try {
      const p = dataUrlToParts(fi);
      if (p.mime.startsWith("image/") && p.buffer.length <= 4 * 1024 * 1024) {
        refs.push(p);
        refUrls.push(fi);
      }
    } catch {
      /* skip */
    }
  }

  const size = pickSize(imageSize(img.buffer, img.mime));
  const q = ["low", "medium", "high"].includes(quality) ? quality : "high";

  // --- Primær vej: ChatGPT-pipelinen (Responses + image_generation) --------
  if (process.env.RENDER_PIPELINE !== "edits") {
    const r = await runResponsesPipeline({ brief: prompt, roomPhoto, refUrls, size, quality: q, apiKey });
    if (r) {
      return {
        status: 200,
        payload: { imageData: `data:image/png;base64,${r.b64}`, prompt: r.revised || String(prompt), pipeline: "responses" },
      };
    }
  }

  // --- Fallback: lysdesigner-prompt + /images/edits -------------------------
  let finalPrompt = String(prompt);
  if (autoPrompt !== false) {
    const crafted = await craftPrompt({ brief: prompt, roomPhoto, fixtureImages: refUrls, apiKey });
    if (crafted) finalPrompt = crafted;
  }

  const ext = img.mime.includes("png") ? "png" : "jpg";

  const form = new FormData();
  form.append("model", "gpt-image-1");
  if (refs.length) {
    // Flere input-billeder: rummet først, derefter produktreferencer.
    form.append("image[]", new Blob([img.buffer], { type: img.mime }), `room.${ext}`);
    refs.forEach((p, i) =>
      form.append("image[]", new Blob([p.buffer], { type: p.mime }), `product-${i + 1}.${p.mime.includes("png") ? "png" : "jpg"}`),
    );
  } else {
    form.append("image", new Blob([img.buffer], { type: img.mime }), `room.${ext}`);
  }
  form.append("prompt", finalPrompt.slice(0, 32000));
  form.append("size", size);
  form.append("quality", ["low", "medium", "high"].includes(quality) ? quality : "high");
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

  // prompt returneres, så klienten kan gemme den FAKTISK brugte instruks.
  return { status: 200, payload: { imageData: `data:image/png;base64,${b64}`, prompt: finalPrompt, pipeline: "edits" } };
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

// ---------------------------------------------------------------------------
// Datablad-ekstraktion (PDF → armaturdata)
// ---------------------------------------------------------------------------
// Sender PDF'en direkte til en billig OpenAI-model med fil-input og et strengt
// JSON-schema, så svaret altid er maskinlæsbart. Modellen kan overstyres med
// EXTRACT_MODEL-env (default gpt-5-mini).

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: ["string", "null"], description: "Armaturets produktnavn" },
    sku: { type: ["string", "null"], description: "Varenummer/typebetegnelse" },
    category: { type: ["string", "null"], description: "En af: LED-panel, Downlight, Lineær / pendel, Highbay / lavbay, Spot / skinne, Facade / væg, Udendørs" },
    mounting: { type: ["string", "null"], description: "En af: Indbygning, Påbygning, Pendel, Væg, Skinne, Mast / stander" },
    lumen: { type: ["number", "null"], description: "Systemlysstrøm i lumen" },
    watt: { type: ["number", "null"], description: "Systemeffekt i watt" },
    kelvin: { type: ["number", "null"], description: "Farvetemperatur i Kelvin (ved flere varianter: vælg 4000 hvis muligt)" },
    tunableWhite: { type: ["boolean", "null"] },
    cri: { type: ["number", "null"], description: "Farvegengivelse Ra/CRI" },
    beamAngle: { type: ["number", "null"], description: "Spredningsvinkel i grader" },
    ip: { type: ["string", "null"], description: "Kapslingsklasse, fx IP20" },
    ugr: { type: ["number", "null"], description: "Blændingstal UGR" },
    lifetimeHours: { type: ["number", "null"], description: "Levetid i timer, fx L80B10-tallet" },
    dimmable: { type: ["boolean", "null"] },
    dimensions: { type: ["string", "null"], description: "Fysiske mål, fx 595×595×28 mm" },
    description: { type: ["string", "null"], description: "1-2 sætningers dansk produktbeskrivelse" },
    lightCharacter: { type: ["string", "null"], description: "Kort dansk beskrivelse af lysets karakter til AI-visualisering" },
    tags: { type: ["array", "null"], items: { type: "string" }, description: "2-4 danske anvendelses-tags, fx kontor, lager" },
  },
  required: [
    "name", "sku", "category", "mounting", "lumen", "watt", "kelvin", "tunableWhite",
    "cri", "beamAngle", "ip", "ugr", "lifetimeHours", "dimmable", "dimensions",
    "description", "lightCharacter", "tags",
  ],
};

export async function runExtract({ pdf, filename, apiKey }) {
  if (!apiKey) {
    return { status: 500, payload: { error: "Serveren mangler OPENAI_API_KEY." } };
  }
  if (!pdf) {
    return { status: 400, payload: { error: "'pdf' (dataURL) er påkrævet." } };
  }
  let parts;
  try {
    parts = dataUrlToParts(pdf);
  } catch {
    return { status: 400, payload: { error: "pdf skal være en base64 dataURL." } };
  }
  if (!parts.mime.includes("pdf")) {
    return { status: 400, payload: { error: "Filen skal være en PDF (application/pdf)." } };
  }
  if (parts.buffer.length > 15 * 1024 * 1024) {
    return { status: 413, payload: { error: "PDF'en er for stor (maks 15 MB)." } };
  }

  const model = process.env.EXTRACT_MODEL || "gpt-5-mini";
  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "Du er en præcis dataekstraktør for belysningsarmaturer. Du læser producent-datablade (ofte tabeller og varianter) og returnerer ét armaturs data. Findes flere varianter, så vælg den mest repræsentative (4000 K, standardflux) og nævn varianterne i description. Brug null for alt, der ikke fremgår – gæt aldrig. Fritekst-felter skrives på dansk.",
      },
      {
        role: "user",
        content: [
          { type: "file", file: { filename: filename || "datablad.pdf", file_data: pdf } },
          {
            type: "text",
            text: "Udtræk armaturets data fra dette datablad. lumen = systemlysstrøm, watt = systemeffekt. category og mounting skal vælges fra listerne i schemaet, hvis muligt.",
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "fixture_extract", strict: true, schema: EXTRACT_SCHEMA },
    },
  };

  let res;
  try {
    res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { status: 502, payload: { error: `Kunne ikke nå OpenAI: ${e.message}` } };
  }

  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.error?.message || JSON.stringify(err);
    } catch {
      detail = await res.text().catch(() => "");
    }
    return {
      status: res.status === 401 ? 401 : 502,
      payload: { error: `OpenAI-fejl (${res.status}): ${String(detail).slice(0, 300)}` },
    };
  }

  let json;
  try {
    json = await res.json();
  } catch {
    return { status: 502, payload: { error: "Uventet svar fra OpenAI." } };
  }

  const msg = json?.choices?.[0]?.message;
  if (msg?.refusal) {
    return { status: 422, payload: { error: `Modellen afviste databladet: ${msg.refusal}` } };
  }
  let fixture;
  try {
    fixture = JSON.parse(msg?.content ?? "");
  } catch {
    return { status: 502, payload: { error: "Kunne ikke tolke svaret fra modellen." } };
  }
  return { status: 200, payload: { fixture, model } };
}
