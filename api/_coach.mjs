// =============================================================================
// api/_coach.mjs  ·  Delt kerne for green light Salgscoach
// -----------------------------------------------------------------------------
// Ren logik uden HTTP-framework — præcis som _core.mjs — så SAMME kode kan
// bruges af alle salgscoachens Vercel-funktioner:
//   - api/coach.js          (manifest, scenarie, samtale, analyse, profil,
//                            materiale, team)
//   - api/coach-session.js  (kortlivet nøgle til realtime-stemmen)
//   - api/coach-speak.js    (tale-syntese som fallback-stemme)
//
// Filen indeholder fem ting:
//   1. callModel            – ét sted der taler med OpenAI's Responses API,
//                             med Structured Outputs når vi vil have JSON.
//   2. sealHidden/openHidden– forsegling af rollespilskundens SKJULTE fakta,
//                             så browseren aldrig kan læse dem (AES-256-GCM).
//   3. mintRealtimeSession  – kortlivet client secret til stemmesamtalen.
//   4. speak                – tale-syntese (mp3 som dataURL).
//   5. extractDocumentText  – tekst ud af PDF/PPTX/DOCX/XLSX/tekst UDEN
//                             npm-afhængigheder (Node 20-indbyggede kun).
//
// Auth, rate limiting og CORS genbruges 1:1 fra _core.mjs og re-eksporteres
// herfra, så handlerne kun behøver ét import-sted.
// Filnavn starter med "_" så Vercel ikke gør det til en rute.
//
// Miljøvariabler (alle valgfri undtagen OPENAI_API_KEY):
//   OPENAI_API_KEY          (påkrævet)  – OpenAI *API*-nøgle
//   COACH_MODEL             default gpt-5                  – grundig model
//   COACH_FAST_MODEL        default gpt-5-mini             – hurtig model
//   COACH_REALTIME_MODEL    default gpt-realtime           – stemmesamtale
//   COACH_TRANSCRIBE_MODEL  default gpt-4o-mini-transcribe – transskription
//   COACH_TTS_MODEL         default gpt-4o-mini-tts        – tale-syntese
//   COACH_SECRET            (anbefalet) – nøglemateriale til forseglingen
// =============================================================================

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { inflateRawSync } from "node:zlib";

// Genbrug – handlerne importerer alt fra denne fil.
export { authorize, rateLimit, corsOrigin } from "./_core.mjs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_REALTIME_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";
const OPENAI_REALTIME_LEGACY_URL = "https://api.openai.com/v1/realtime/sessions";
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";

/** Maks. tekst vi nogensinde sender retur fra en dokumentudtrækning. */
export const MAX_DOCUMENT_CHARS = 120_000;

export function coachModel(effort) {
  const fast = process.env.COACH_FAST_MODEL || "gpt-5-mini";
  const deep = process.env.COACH_MODEL || "gpt-5";
  return effort === "hurtig" ? fast : deep;
}

// ---------------------------------------------------------------------------
// 1. callModel — Responses API
// ---------------------------------------------------------------------------
// `instructions` er systemprompten (coachens/kundens rolle), `input` er selve
// samtalen: enten en streng eller en liste af { role, content }.
// Er `schema` sat, beder vi om Structured Outputs (strict json_schema) og
// returnerer det PARSEDE objekt — ellers ren tekst.
//
// Funktionen kaster ALDRIG. Alt kommer tilbage som { ok, status, data, error },
// så handlerne kan svare kunden med en pæn dansk fejl i stedet for en 500.

/** Normalisér samtalens roller til det Responses API accepterer. */
function normalizeInput(input) {
  if (typeof input === "string") return input;
  if (!Array.isArray(input)) return String(input ?? "");
  return input
    .map((m) => {
      const raw = String(m?.role || "user").toLowerCase();
      // Sælgeren er altid "user"; kunde/coach/assistent er modpartens replikker.
      const role =
        raw === "saelger" || raw === "sælger" || raw === "user"
          ? "user"
          : raw === "system" || raw === "developer"
            ? "system"
            : "assistant";
      // Indhold kan være ren tekst ELLER en liste af content-parts
      // (input_text/input_file) — sidstnævnte bruges til PDF-læsning og må
      // under ingen omstændigheder laves om til en streng.
      const content = Array.isArray(m?.content)
        ? m.content
        : typeof m?.content === "string"
          ? m.content
          : String(m?.content ?? "");
      return { role, content };
    })
    .filter((m) => (Array.isArray(m.content) ? m.content.length > 0 : m.content.trim().length > 0));
}

/** Læs tekst ud af et Responses-svar, uanset hvilken form det kommer i. */
function readOutputText(json) {
  if (typeof json?.output_text === "string" && json.output_text.trim()) return json.output_text;
  const chunks = [];
  const refusals = [];
  for (const item of Array.isArray(json?.output) ? json.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === "string" && part.text) chunks.push(part.text);
      else if (typeof part?.refusal === "string" && part.refusal) refusals.push(part.refusal);
    }
  }
  if (!chunks.length && refusals.length) return { refusal: refusals.join(" ") };
  return chunks.join("").trim();
}

/**
 * Ét kald til OpenAI's Responses API.
 * @returns {Promise<{ ok: boolean, status: number, data?: any, error?: string, model?: string }>}
 */
export async function callModel({ instructions, input, schema, schemaName, model, effort, apiKey } = {}) {
  if (!apiKey) {
    return { ok: false, status: 500, error: "Serveren mangler OPENAI_API_KEY." };
  }
  const chosen = model || coachModel(effort);

  const body = {
    model: chosen,
    input: normalizeInput(input),
  };
  if (instructions) body.instructions = String(instructions);
  if (schema) {
    // Skemaerne i _coachprompt.mjs eksporteres i OpenAIs egen indpakning
    // { name, strict, schema }. Sendte vi den indpakning videre som selve
    // skemaet, ville modellen få et skema der beskriver indpakningen — og
    // svare med { name, strict, schema } i stedet for feedbacken.
    const wrapped = schema && typeof schema === "object" && schema.schema && schema.name;
    body.text = {
      format: {
        type: "json_schema",
        name: schemaName || (wrapped ? schema.name : "svar"),
        schema: wrapped ? schema.schema : schema,
        strict: true,
      },
    };
  }
  // Ræsonnementsmodeller (gpt-5 / o-serien) kan skrue tempoet ned eller op.
  // Andre modeller afviser feltet, så det sættes kun når vi ved det passer.
  if (/^(gpt-5|o[1-9])/.test(chosen)) {
    body.reasoning = { effort: effort === "hurtig" ? "low" : "medium" };
  }

  let res;
  try {
    res = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, status: 502, error: `Kunne ikke nå OpenAI: ${e.message}` };
  }

  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.error?.message || "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    return {
      ok: false,
      status: res.status === 401 ? 401 : 502,
      error: `OpenAI-fejl (${res.status}): ${String(detail).slice(0, 300)}`,
      model: chosen,
    };
  }

  let json;
  try {
    json = await res.json();
  } catch {
    return { ok: false, status: 502, error: "Uventet svar fra OpenAI (kunne ikke læses som JSON).", model: chosen };
  }

  if (json?.status === "incomplete") {
    const why = json?.incomplete_details?.reason || "ukendt årsag";
    return { ok: false, status: 502, error: `Modellen nåede ikke at blive færdig (${why}). Prøv igen.`, model: chosen };
  }

  const text = readOutputText(json);
  if (text && typeof text === "object" && text.refusal) {
    return { ok: false, status: 422, error: `Modellen afviste opgaven: ${text.refusal}`, model: chosen };
  }
  if (!text) {
    return { ok: false, status: 502, error: "OpenAI returnerede et tomt svar.", model: chosen };
  }

  if (!schema) return { ok: true, status: 200, data: text, model: chosen };

  try {
    return { ok: true, status: 200, data: JSON.parse(text), model: chosen };
  } catch {
    return { ok: false, status: 502, error: "Kunne ikke tolke modellens JSON-svar.", model: chosen };
  }
}

// ---------------------------------------------------------------------------
// 2. Forsegling af rollespillets SKJULTE fakta
// ---------------------------------------------------------------------------
// Hele pointen med kunderollespillet er, at sælgeren skal GRAVE informationen
// frem. Ligger kundens skjulte fakta i browserens hukommelse, kan de læses i
// devtools — og øvelsen er værdiløs. Derfor krypteres de med AES-256-GCM og
// sendes rundt som en uigennemsigtig blob, som kun serveren kan åbne.
//
// Nøgle: COACH_SECRET (anbefalet). Er den ikke sat, udledes en deterministisk
// nøgle af OPENAI_API_KEY, så funktionen virker uden ekstra opsætning. Det er
// bevidst en nødløsning: nøglen skifter, hvis API-nøglen roteres, og gamle
// blobs kan så ikke åbnes (en igangværende øvelse falder tilbage til at køre
// uden skjulte fakta). Sæt COACH_SECRET i produktion.

const SEAL_SALT = "green-light-salgscoach-v1";
let sealKeyCache = null;

function sealKey() {
  if (sealKeyCache) return sealKeyCache;
  const secret =
    process.env.COACH_SECRET ||
    process.env.OPENAI_API_KEY ||
    // Sidste udvej (lokal udvikling uden nøgler): en konstant, så koden kan køre.
    "green-light-salgscoach-udvikling";
  try {
    sealKeyCache = scryptSync(secret, SEAL_SALT, 32);
  } catch {
    // scrypt kan fejle på meget begrænsede runtimes — sha256 er et fint fallback.
    sealKeyCache = createHash("sha256").update(`${SEAL_SALT}:${secret}`).digest();
  }
  return sealKeyCache;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(str) {
  return Buffer.from(String(str).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Forsegl et objekt til en kompakt streng: "v1.<iv>.<tag>.<ct>" (base64url).
 * @returns {string|null} null hvis der ikke er noget at forsegle.
 */
export function sealHidden(obj) {
  if (obj === undefined || obj === null) return null;
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
    const ct = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
    return `v1.${b64url(iv)}.${b64url(cipher.getAuthTag())}.${b64url(ct)}`;
  } catch {
    return null;
  }
}

/**
 * Åbn en forseglet blob igen. Returnerer null ved manipulation, forkert nøgle
 * eller vrøvl — kaster ALDRIG, så en gammel/ugyldig blob aldrig vælter en øvelse.
 */
export function openHidden(blob) {
  if (!blob || typeof blob !== "string") return null;
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", sealKey(), unb64url(parts[1]));
    decipher.setAuthTag(unb64url(parts[2]));
    const pt = Buffer.concat([decipher.update(unb64url(parts[3])), decipher.final()]).toString("utf8");
    return JSON.parse(pt);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Realtime-session (stemmesamtalen)
// ---------------------------------------------------------------------------
// Browseren må ALDRIG se OPENAI_API_KEY. I stedet udsteder serveren en
// kortlivet "client secret" (ek_…), som WebRTC-forbindelsen bruger.
//
// Robusthed i tre trin, fordi realtime-API'et er nyt og skifter form:
//   1. GA-endpointet med fuld konfiguration (transskription + semantic VAD)
//   2. samme endpoint uden transskription (nogle konti/modeller afviser den)
//   3. det gamle beta-endpoint med fladt body og server_vad
// Lykkes intet af det, får klienten besked og falder tilbage til browserstemmen.

const REALTIME_VOICES = ["cedar", "marin", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];

export function normalizeVoice(voice, fallback = "cedar") {
  const v = String(voice || "").toLowerCase().trim();
  return REALTIME_VOICES.includes(v) ? v : fallback;
}

function realtimeBody({ instructions, voice, language, eagerness, withTranscription }) {
  const audioInput = {
    format: { type: "audio/pcm", rate: 24000 },
    turn_detection: {
      type: "semantic_vad",
      eagerness: eagerness || "auto",
      create_response: true,
      interrupt_response: true,
    },
  };
  if (withTranscription) {
    audioInput.transcription = {
      model: process.env.COACH_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
      language: language === "en" ? "en" : "da",
    };
  }
  return {
    session: {
      type: "realtime",
      model: process.env.COACH_REALTIME_MODEL || "gpt-realtime",
      instructions: String(instructions || ""),
      output_modalities: ["audio"],
      audio: {
        input: audioInput,
        output: { voice, speed: 1 },
      },
    },
  };
}

async function postJson(url, body, apiKey, extraHeaders = {}) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, status: 502, error: `Kunne ikke nå OpenAI: ${e.message}` };
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* nogle fejl kommer uden JSON-krop */
  }
  if (!res.ok) {
    const detail = json?.error?.message || "";
    return { ok: false, status: res.status, error: `OpenAI-fejl (${res.status}): ${String(detail).slice(0, 300)}` };
  }
  return { ok: true, status: res.status, json };
}

/**
 * Udsted en kortlivet nøgle til realtime-stemmesamtalen.
 * @returns {Promise<{ ok: boolean, status: number, clientSecret?: string,
 *                     expiresAt?: number, model?: string, voice?: string,
 *                     api?: "ga"|"beta", error?: string }>}
 */
export async function mintRealtimeSession({ instructions, voice, language, eagerness, apiKey } = {}) {
  if (!apiKey) return { ok: false, status: 500, error: "Serveren mangler OPENAI_API_KEY." };

  const v = normalizeVoice(voice);
  const model = process.env.COACH_REALTIME_MODEL || "gpt-realtime";

  // --- 1. GA-endpointet, fuld konfiguration --------------------------------
  let r = await postJson(
    OPENAI_REALTIME_SECRETS_URL,
    realtimeBody({ instructions, voice: v, language, eagerness, withTranscription: true }),
    apiKey,
  );

  // --- 2. Samme endpoint uden transskription (typisk årsag til 400) --------
  if (!r.ok && r.status >= 400 && r.status < 500) {
    r = await postJson(
      OPENAI_REALTIME_SECRETS_URL,
      realtimeBody({ instructions, voice: v, language, eagerness, withTranscription: false }),
      apiKey,
    );
  }

  if (r.ok) {
    const secret = r.json?.value || r.json?.client_secret?.value || null;
    if (secret && String(secret).startsWith("ek_")) {
      return {
        ok: true,
        status: 200,
        clientSecret: secret,
        expiresAt: r.json?.expires_at || r.json?.client_secret?.expires_at || null,
        model,
        voice: v,
        api: "ga",
      };
    }
    // Svar uden brugbar nøgle behandles som en fejl, så vi prøver beta-vejen.
    r = { ok: false, status: 502, error: "Realtime-svaret indeholdt ingen brugbar nøgle." };
  }

  // --- 3. Det gamle beta-endpoint ------------------------------------------
  const legacy = await postJson(
    OPENAI_REALTIME_LEGACY_URL,
    {
      model,
      voice: v,
      instructions: String(instructions || ""),
      modalities: ["audio", "text"],
      input_audio_transcription: { model: process.env.COACH_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe" },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 600,
        create_response: true,
        interrupt_response: true,
      },
    },
    apiKey,
    { "OpenAI-Beta": "realtime=v1" },
  );

  if (legacy.ok) {
    const secret = legacy.json?.client_secret?.value || null;
    if (secret) {
      return {
        ok: true,
        status: 200,
        clientSecret: secret,
        expiresAt: legacy.json?.client_secret?.expires_at || null,
        model,
        voice: v,
        api: "beta",
      };
    }
  }

  return {
    ok: false,
    status: legacy.status || r.status || 502,
    error: legacy.error || r.error || "Kunne ikke oprette en stemmesession hos OpenAI.",
    model,
    voice: v,
  };
}

// ---------------------------------------------------------------------------
// 4. Tale-syntese
// ---------------------------------------------------------------------------
// Bruges når realtime-stemmen ikke er tilgængelig, og som oplæsning af coachens
// feedback. mp3 returneres som dataURL, så klienten bare kan sætte den på et
// <audio>-element uden at gemme filer.

const SPEAK_MAX_CHARS = 4000;

/**
 * @returns {Promise<{ ok: boolean, status: number, audio?: string, voice?: string, error?: string }>}
 */
export async function speak({ text, voice, apiKey } = {}) {
  if (!apiKey) return { ok: false, status: 500, error: "Serveren mangler OPENAI_API_KEY." };
  const input = String(text || "").trim();
  if (!input) return { ok: false, status: 400, error: "'text' er påkrævet." };

  const model = process.env.COACH_TTS_MODEL || "gpt-4o-mini-tts";

  async function attempt(v) {
    let res;
    try {
      res = await fetch(OPENAI_SPEECH_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, voice: v, input: input.slice(0, SPEAK_MAX_CHARS), response_format: "mp3" }),
      });
    } catch (e) {
      return { ok: false, status: 502, error: `Kunne ikke nå OpenAI: ${e.message}` };
    }
    if (!res.ok) {
      let detail = "";
      try {
        const err = await res.json();
        detail = err?.error?.message || "";
      } catch {
        detail = await res.text().catch(() => "");
      }
      return { ok: false, status: res.status, error: `OpenAI-fejl (${res.status}): ${String(detail).slice(0, 300)}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, status: 200, audio: `data:audio/mpeg;base64,${buf.toString("base64")}`, voice: v };
  }

  const wanted = normalizeVoice(voice, "sage");
  const first = await attempt(wanted);
  if (first.ok) return first;
  // Ikke alle stemmer findes i tale-syntesen (fx de nyeste realtime-stemmer).
  // Ét forsøg mere med en stemme, der altid findes, før vi giver op.
  if (first.status >= 400 && first.status < 500 && wanted !== "alloy") {
    const second = await attempt("alloy");
    if (second.ok) return second;
  }
  return first;
}

// ---------------------------------------------------------------------------
// 5. Dokumentudtrækning
// ---------------------------------------------------------------------------
// Sælgeren uploader det materiale, han rent faktisk viser kunden: en PDF, et
// PowerPoint, et Word-dokument eller et regneark. Vi skal have TEKSTEN ud —
// uden en eneste npm-afhængighed (Vercel-funktionen skal forblive letvægts).
//
//   PDF   → Responses API med input_file: modellen transskriberer dokumentet.
//   PPTX/DOCX/XLSX → det er ZIP-arkiver. Vi læser centralkataloget selv og
//                    pakker de relevante XML-dele ud med zlib.inflateRawSync.
//   Tekst/CSV → afkodes direkte.

const DOC_EXT_KIND = {
  pdf: "pdf",
  pptx: "pptx",
  ppt: "pptx",
  docx: "docx",
  doc: "docx",
  xlsx: "xlsx",
  xlsm: "xlsx",
  xls: "xlsx",
  txt: "tekst",
  md: "tekst",
  csv: "tekst",
  rtf: "tekst",
  json: "tekst",
};

function parseDataUrl(dataUrl) {
  const m = /^data:([^;,]*)(;[^,]*)?,(.*)$/s.exec(String(dataUrl || ""));
  if (!m) return null;
  const isBase64 = /;base64/i.test(m[2] || "");
  const raw = m[3] || "";
  try {
    return {
      mime: (m[1] || "application/octet-stream").toLowerCase(),
      buffer: isBase64 ? Buffer.from(raw, "base64") : Buffer.from(decodeURIComponent(raw), "utf8"),
    };
  } catch {
    return null;
  }
}

function guessKind(name, mime) {
  const ext = String(name || "").toLowerCase().split(".").pop();
  if (DOC_EXT_KIND[ext]) return DOC_EXT_KIND[ext];
  const m = String(mime || "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("presentation")) return "pptx";
  if (m.includes("wordprocessing")) return "docx";
  if (m.includes("spreadsheet") || m.includes("excel")) return "xlsx";
  if (m.startsWith("text/")) return "tekst";
  return null;
}

/* ------------------------------------------------------------- Mini-ZIP ---- */
// Et ZIP-arkiv slutter med et "end of central directory"-mærke, der peger på
// centralkataloget. Hvert katalog-punkt fortæller, hvor filens lokale header
// ligger. Vi understøtter metode 0 (gemt) og 8 (deflate) — det er alt, hvad
// Office bruger.

function readZipEntries(buf) {
  const MIN_EOCD = 22;
  if (!buf || buf.length < MIN_EOCD) return null;
  let eocd = -1;
  const floor = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - MIN_EOCD; i >= floor; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    // ZIP64-poster (0xffffffff) springes over — Office-filer i den størrelse
    // hører ikke hjemme i en salgspræsentation alligevel.
    if (compSize !== 0xffffffff && local !== 0xffffffff) entries.set(name, { method, compSize, local });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries.size ? entries : null;
}

function readZipFile(buf, entry) {
  if (!entry || entry.local + 30 > buf.length) return null;
  if (buf.readUInt32LE(entry.local) !== 0x04034b50) return null;
  const nameLen = buf.readUInt16LE(entry.local + 26);
  const extraLen = buf.readUInt16LE(entry.local + 28);
  const start = entry.local + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + entry.compSize);
  try {
    if (entry.method === 0) return raw.toString("utf8");
    if (entry.method === 8) return inflateRawSync(raw).toString("utf8");
  } catch {
    return null;
  }
  return null;
}

/* ------------------------------------------------------------ XML → tekst -- */

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeXmlEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, ent) => {
    if (ent[0] === "#") {
      const hex = ent[1] === "x" || ent[1] === "X";
      const code = hex ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return XML_ENTITIES[ent] ?? whole;
  });
}

/** Afsnit og linjeskift SKAL oversættes før tags fjernes — ellers klistrer alt sammen. */
function xmlToText(xml) {
  const withBreaks = String(xml || "")
    .replace(/<(w|a):br\b[^>]*>/g, "\n")
    .replace(/<w:tab\b[^>]*>/g, "\t")
    // Sidste afsnit i en tabelcelle skal give et TAB, ikke et linjeskift —
    // ellers falder tabellens rækker fra hinanden i den udtrukne tekst.
    .replace(/<\/(w|a):p>\s*(?:<\/a:txBody>\s*)?<\/(w|a):tc>/g, "\t")
    .replace(/<\/(w|a):p>/g, "\n")
    .replace(/<\/(w|a):tc>/g, "\t")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<[^>]*>/g, "");
  return decodeXmlEntities(withBreaks)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function numberedParts(entries, re) {
  return [...entries.keys()]
    .map((name) => {
      const m = re.exec(name);
      return m ? { name, no: Number(m[1]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.no - b.no);
}

function pptxToText(buf, entries) {
  const slides = numberedParts(entries, /^ppt\/slides\/slide(\d+)\.xml$/);
  const out = [];
  for (const s of slides) {
    const xml = readZipFile(buf, entries.get(s.name));
    if (xml === null) continue;
    const body = xmlToText(xml);
    // Talernoter hører med — de rummer ofte sælgerens egentlige argumentation.
    const notesName = `ppt/notesSlides/notesSlide${s.no}.xml`;
    const notes = entries.has(notesName) ? xmlToText(readZipFile(buf, entries.get(notesName)) || "") : "";
    out.push([`— slide ${s.no} —`, body, notes ? `[noter] ${notes}` : ""].filter(Boolean).join("\n"));
  }
  return { text: out.join("\n\n"), pages: slides.length };
}

function docxToText(buf, entries) {
  const xml = readZipFile(buf, entries.get("word/document.xml"));
  if (xml === null) return { text: "", pages: null };
  // Sidetal kan kun estimeres ud fra eksplicitte sideskift.
  const breaks = (xml.match(/<w:br\b[^>]*w:type="page"/g) || []).length;
  return { text: xmlToText(xml), pages: breaks ? breaks + 1 : null };
}

function sharedStringsOf(xml) {
  if (!xml) return [];
  return [...String(xml).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) =>
    decodeXmlEntities((m[1].match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]*>/g, "")).join("")),
  );
}

function sheetToText(xml, shared) {
  const rows = [];
  for (const chunk of String(xml || "").split("</row>")) {
    if (!/<c[\s>]/.test(chunk)) continue;
    const cells = [];
    const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let m;
    while ((m = re.exec(chunk))) {
      const attrs = m[1] || "";
      const inner = m[2] || "";
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] || "n";
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = "";
      if (type === "s") {
        const idx = Number(v);
        value = Number.isInteger(idx) ? shared[idx] || "" : "";
      } else if (type === "inlineStr") {
        value = xmlToText(inner);
      } else {
        value = decodeXmlEntities(String(v ?? "").trim());
      }
      cells.push(value.replace(/\s+/g, " ").trim());
    }
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    if (cells.length) rows.push(cells.join("\t"));
  }
  return rows.join("\n");
}

function xlsxToText(buf, entries) {
  const shared = sharedStringsOf(readZipFile(buf, entries.get("xl/sharedStrings.xml")));
  const workbook = readZipFile(buf, entries.get("xl/workbook.xml")) || "";
  const names = [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => decodeXmlEntities(m[1]));
  const sheets = numberedParts(entries, /^xl\/worksheets\/sheet(\d+)\.xml$/);
  const out = [];
  for (const s of sheets) {
    const xml = readZipFile(buf, entries.get(s.name));
    if (xml === null) continue;
    const label = names[s.no - 1] || `ark ${s.no}`;
    const body = sheetToText(xml, shared);
    if (body) out.push(`— ark ${s.no}: ${label} —\n${body}`);
  }
  return { text: out.join("\n\n"), pages: sheets.length };
}

/* -------------------------------------------------------------- PDF-vejen -- */

const PDF_INSTRUCTIONS = [
  "Du er en præcis dokument-transskriptør for et salgsværktøj.",
  "Gengiv dokumentet TRO mod originalen som struktureret markdown — du må ikke opsummere, forkorte eller forbedre.",
  "Krav:",
  "- Bevar ALLE tal, priser, beløb, procenter, enheder, datoer og produktnavne præcis som de står.",
  "- Gengiv tabeller som markdown-tabeller med samme rækker og kolonner.",
  "- Marker hver side/slide med en linje i formatet '— side 3 —' før sidens indhold.",
  "- Bevar overskrifternes hierarki (#, ##, ###) og punktopstillinger.",
  "- Medtag også tekst i figurer, noter, sidefødder og diagram-labels, hvis den kan læses.",
  "- Tilføj INTET, der ikke står i dokumentet. Ingen indledning, ingen kommentarer.",
].join("\n");

async function pdfToText({ name, dataUrl, apiKey, bytes }) {
  const r = await callModel({
    instructions: PDF_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          { type: "input_file", filename: name || "materiale.pdf", file_data: dataUrl },
          { type: "input_text", text: "Transskribér hele dokumentet nu — side for side." },
        ],
      },
    ],
    effort: "hurtig",
    apiKey,
  });
  if (!r.ok) return { ok: false, error: r.error };

  const text = String(r.data || "");
  // Sidetal: helst modellens egne markører, ellers et groft skøn ud fra PDF'ens
  // egne /Type /Page-objekter.
  const marked = (text.match(/—\s*side\s+\d+\s*—/gi) || []).length;
  let pages = marked || null;
  if (!pages && bytes) {
    const guess = (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    pages = guess || null;
  }
  return { ok: true, text, pages };
}

/**
 * Træk tekst ud af et uploadet dokument.
 * @param {{ file: { name: string, dataUrl: string }, apiKey: string }} args
 * @returns {Promise<{ ok: boolean, text?: string, pages?: number|null, kind?: string, error?: string }>}
 */
export async function extractDocumentText({ file, apiKey } = {}) {
  const name = String(file?.name || "").trim();
  const dataUrl = file?.dataUrl;
  if (!dataUrl) return { ok: false, error: "Filen mangler indhold (dataUrl)." };

  const parts = parseDataUrl(dataUrl);
  if (!parts) return { ok: false, error: "Filen skal sendes som en base64 dataURL." };
  if (parts.buffer.length > 25 * 1024 * 1024) {
    return { ok: false, error: "Filen er for stor (maks 25 MB)." };
  }

  const kind = guessKind(name, parts.mime);
  if (!kind) {
    return {
      ok: false,
      error: "Filtypen understøttes ikke. Upload PDF, PowerPoint (.pptx), Word (.docx), Excel (.xlsx) eller ren tekst.",
    };
  }

  const cap = (t) => String(t || "").slice(0, MAX_DOCUMENT_CHARS);

  try {
    if (kind === "tekst") {
      const text = cap(parts.buffer.toString("utf8"));
      if (!text.trim()) return { ok: false, kind, error: "Filen var tom." };
      return { ok: true, text, pages: null, kind };
    }

    if (kind === "pdf") {
      const r = await pdfToText({ name, dataUrl, apiKey, bytes: parts.buffer });
      if (!r.ok) return { ok: false, kind, error: r.error };
      const text = cap(r.text);
      if (!text.trim()) return { ok: false, kind, error: "Der kunne ikke læses tekst ud af PDF'en." };
      return { ok: true, text, pages: r.pages ?? null, kind };
    }

    // Resten er ZIP-baserede Office-formater.
    const entries = readZipEntries(parts.buffer);
    if (!entries) {
      return {
        ok: false,
        kind,
        error:
          "Filen kunne ikke pakkes ud. Gamle formater (.ppt/.doc/.xls) understøttes ikke — gem den som .pptx/.docx/.xlsx, eller eksportér til PDF.",
      };
    }

    const out =
      kind === "pptx" ? pptxToText(parts.buffer, entries)
        : kind === "docx" ? docxToText(parts.buffer, entries)
          : xlsxToText(parts.buffer, entries);

    const text = cap(out.text);
    if (!text.trim()) {
      return { ok: false, kind, error: "Der blev ikke fundet tekst i filen (består den kun af billeder?)." };
    }
    return { ok: true, text, pages: out.pages ?? null, kind };
  } catch (e) {
    return { ok: false, kind, error: `Kunne ikke læse filen: ${e.message}` };
  }
}
