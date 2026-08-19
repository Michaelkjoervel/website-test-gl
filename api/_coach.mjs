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
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";

/** Maks. tekst vi nogensinde sender retur fra en dokumentudtrækning. */
export const MAX_DOCUMENT_CHARS = 120_000;

// ---------------------------------------------------------------------------
// 0. Forbrugsbremse for salgscoachen
// ---------------------------------------------------------------------------
// HVORFOR EN EGEN: _core.mjs' rateLimit er bygget til visualiseringen — ét
// tungt billedkald ad gangen, 20 i timen pr. bruger og 300 om dagen SAMLET for
// hele værktøjskassen. En samtale er noget helt andet: 20-40 korte replikker på
// en halv time. Brugte coachen den fælles spand, ville to rollespil både løbe
// tør midt i øvelsen OG spise hele dagens kvote for visualiseringen.
//
// Derfor har coachen sine egne spande. Loftet er IKKE fjernet — det er delt op,
// så et dyrt kald og en billig replik ikke tæller det samme sted, og så et
// løbsk script i coachen ikke kan lukke et andet værktøj ned.
//
// SVAGHED, SAGT HØJT: tællingen ligger i hukommelsen på den enkelte serverless-
// instans. Vercel kører flere instanser samtidig, så det reelle loft er
// (grænse × antal varme instanser). Det er en bremse mod uheld og løbske
// scripts — ikke et hårdt økonomisk loft. Skal loftet være hårdt på tværs af
// instanser, kræver det et delt lager (Upstash/KV eller en tæller i Supabase).
//
// Env-overrides pr. handling: COACH_LIMIT_SAMTALE, COACH_LIMIT_SESSION, …
// samt COACH_LIMIT_GLOBAL_PER_DAY for dagsloftet.

/** Kald pr. bruger pr. time. Tallene følger, hvad handlingen koster. */
const COACH_DEFAULT_LIMITS = {
  samtale: 150, // korte replikker på den hurtige model — mange pr. øvelse
  speak: 150, // oplæsning, billig
  scenarie: 30, // grundig model, ét kald pr. øvelse
  analyse: 30, // grundig model på en hel udskrift
  profil: 20,
  team: 20,
  materiale: 15, // dyrest pr. kald: hele dokumentet gennem modellen
  session: 20, // realtime-stemme er det dyreste pr. MINUT — hold den lav
};

/** Samlet loft pr. døgn for HELE coachen (alle brugere, denne instans). */
const COACH_GLOBAL_PER_DAY = Math.max(1, Number(process.env.COACH_LIMIT_GLOBAL_PER_DAY) || 800);

const COACH_HOUR = 60 * 60 * 1000;
const COACH_DAY = 24 * COACH_HOUR;
const coachPerUser = new Map(); // "handling:bruger" -> [tidsstempler]
let coachGlobal = []; // [tidsstempler]

function coachLimitFor(action) {
  const env = Number(process.env[`COACH_LIMIT_${String(action).toUpperCase()}`]);
  if (Number.isFinite(env) && env > 0) return Math.floor(env);
  return COACH_DEFAULT_LIMITS[action] ?? 30;
}

/**
 * Tæl ét coach-kald. Egen spand pr. handling PR. BRUGER, plus ét fælles
 * dagsloft for coachen.
 * @returns {{ ok: true } | { ok: false, status: number, reason: string }}
 */
export function coachRateLimit(action, user) {
  const now = Date.now();

  coachGlobal = coachGlobal.filter((t) => now - t < COACH_DAY);
  if (coachGlobal.length >= COACH_GLOBAL_PER_DAY) {
    return {
      ok: false,
      status: 429,
      reason:
        "Salgscoachens samlede grænse for i dag er nået. Prøv igen i morgen, eller kontakt administratoren.",
    };
  }

  const limit = coachLimitFor(action);
  const key = `${action}:${String(user || "anonymous").toLowerCase()}`;
  const mine = (coachPerUser.get(key) || []).filter((t) => now - t < COACH_HOUR);
  if (mine.length >= limit) {
    return {
      ok: false,
      status: 429,
      reason: `Grænsen på ${limit} kald i timen for "${action}" er nået. Vent lidt, og prøv igen.`,
    };
  }

  mine.push(now);
  coachPerUser.set(key, mine);
  coachGlobal.push(now);
  return { ok: true };
}

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
 * Levetid på en forsegling. En øvelse varer minutter, ikke dage — men debriefen
 * kan sagtens ligge et par timer efter, så vi er rundhåndede. Efter udløb åbnes
 * blobben ikke længere, og øvelsen kører videre uden skjulte fakta.
 */
const SEAL_TTL_MS = Math.max(1, Number(process.env.COACH_SEAL_TTL_HOURS) || 12) * 60 * 60 * 1000;

/** Hvem blobben er udstedt til. Tom/ukendt bruger samles under ét navn. */
function audienceOf(value) {
  return String(value || "anonymous").trim().toLowerCase() || "anonymous";
}

/**
 * Forsegl et objekt til en kompakt streng: "v1.<iv>.<tag>.<ct>" (base64url).
 *
 * Konvolutten indeholder ud over selve indholdet også:
 *   aud – den bruger blobben er udstedt til, så én sælgers blob ikke kan bruges
 *         af en anden (og ikke kan handles på gangen).
 *   exp – udløbstidspunkt, så en blob ikke lever evigt.
 * Begge dele er dækket af GCM-tagget og kan derfor ikke ændres af klienten.
 *
 * @param {any} obj
 * @param {{ audience?: string }} [opts]
 * @returns {string|null} null hvis der ikke er noget at forsegle.
 */
export function sealHidden(obj, opts = {}) {
  if (obj === undefined || obj === null) return null;
  try {
    const envelope = {
      v: 1,
      aud: audienceOf(opts.audience),
      exp: Date.now() + SEAL_TTL_MS,
      data: obj,
    };
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
    const ct = Buffer.concat([cipher.update(JSON.stringify(envelope), "utf8"), cipher.final()]);
    return `v1.${b64url(iv)}.${b64url(cipher.getAuthTag())}.${b64url(ct)}`;
  } catch {
    return null;
  }
}

/**
 * Åbn en forseglet blob igen. Returnerer null ved manipulation, forkert nøgle,
 * udløb, forkert modtager eller vrøvl — kaster ALDRIG, så en gammel eller
 * ugyldig blob aldrig vælter en øvelse (den kører bare uden skjulte fakta).
 *
 * @param {string} blob
 * @param {{ audience?: string }} [opts] audience sat = blobben SKAL være
 *        udstedt til netop den bruger. Uden feltet tjekkes modtageren ikke
 *        (bruges af selvtesten og af kald uden brugerkontekst).
 */
export function openHidden(blob, opts = {}) {
  if (!blob || typeof blob !== "string") return null;
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  let envelope;
  try {
    const decipher = createDecipheriv("aes-256-gcm", sealKey(), unb64url(parts[1]));
    decipher.setAuthTag(unb64url(parts[2]));
    const pt = Buffer.concat([decipher.update(unb64url(parts[3])), decipher.final()]).toString("utf8");
    envelope = JSON.parse(pt);
  } catch {
    return null;
  }
  // Konvolutten er selv autentificeret af GCM-tagget; kan den ikke læses som
  // en konvolut, er blobben ikke vores.
  if (!envelope || typeof envelope !== "object" || envelope.v !== 1) return null;
  if (!Number.isFinite(envelope.exp) || Date.now() > envelope.exp) return null;
  if (opts.audience !== undefined && envelope.aud !== audienceOf(opts.audience)) return null;
  return envelope.data ?? null;
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

/**
 * Levetid på den kortlivede nøgle browseren får. Den skal kun bruges ÉN gang,
 * med det samme, til at rejse WebRTC-forbindelsen — så den behøver ikke leve
 * længe. Uden feltet bruger OpenAI sin egen (længere) standard; vi sætter den
 * bevidst kort, så en nøgle der bliver liggende i en logfil eller en netværks-
 * fane er værdiløs få minutter efter.
 */
const REALTIME_SECRET_TTL = Math.min(
  7200,
  Math.max(60, Number(process.env.COACH_REALTIME_TTL_SECONDS) || 120),
);

function realtimeBody({ model, instructions, voice, language, eagerness, withTranscription, ttl, minimal }) {
  // Minimal: kun det, der ikke kan undværes. Bruges som sidste GA-forsøg, så en
  // enkelt afvist indstilling (fx turtagning eller udløbstid) aldrig kan koste
  // hele stemmen.
  if (minimal) {
    return {
      session: {
        type: "realtime",
        model,
        instructions: String(instructions || ""),
        audio: { output: { voice } },
      },
    };
  }

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
  const body = {
    session: {
      type: "realtime",
      model,
      instructions: String(instructions || ""),
      output_modalities: ["audio"],
      audio: {
        input: audioInput,
        output: { voice, speed: 1 },
      },
    },
  };
  // Kun med når vi beder om det: afviser en konto/model feltet, prøver vi igen
  // uden det, så stemmen aldrig falder ud alene på grund af en udløbsindstilling.
  if (ttl) body.expires_after = { anchor: "created_at", seconds: ttl };
  return body;
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

  // Modelnavne i prioriteret rækkefølge. OpenAI har før omdøbt realtime-
  // modellerne, og en 404/400 på navnet må aldrig koste stemmen — så vi prøver
  // de kendte navne, indtil ét svarer. Konfigureret navn vinder altid.
  const configured = (process.env.COACH_REALTIME_MODEL || "").trim();
  const models = [...new Set([configured || "gpt-realtime", "gpt-realtime-2.1", "gpt-realtime", "gpt-realtime-mini"])];

  // Varianter i faldende ambitionsniveau; "minimal" er sidste GA-udvej.
  const variants = [
    { name: "fuld", withTranscription: true, ttl: REALTIME_SECRET_TTL },
    { name: "uden-transskription", withTranscription: false, ttl: REALTIME_SECRET_TTL },
    { name: "uden-udloebstid", withTranscription: false, ttl: 0 },
    { name: "minimal", minimal: true },
  ];

  // Den FØRSTE afvisning er den mest sigende — det er den, vi melder tilbage,
  // hvis alt fejler. (Før viste vi den sidste, og så druknede den egentlige
  // årsag i det gamle beta-endpoints 404.)
  let firstError = null;

  for (const model of models) {
    for (const variant of variants) {
      const r = await postJson(
        OPENAI_REALTIME_SECRETS_URL,
        realtimeBody({ model, instructions, voice: v, language, eagerness, ...variant }),
        apiKey,
      );

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
            variant: variant.name,
          };
        }
        // Svar uden nøgle: prøv næste variant.
        continue;
      }

      if (!firstError) firstError = { status: r.status, error: r.error, model };

      // 5xx/netværk: OpenAI er nede — flere varianter hjælper ikke.
      if (!(r.status >= 400 && r.status < 500)) {
        return {
          ok: false,
          status: r.status || 502,
          error: r.error || "OpenAI svarer ikke.",
          model,
          voice: v,
        };
      }

      // 401/403: nøglen er problemet — andre modeller/varianter ændrer intet.
      if (r.status === 401 || r.status === 403) {
        return { ok: false, status: r.status, error: r.error, model, voice: v };
      }
    }
  }

  // Alle GA-forsøg afvist. Det gamle beta-endpoint er nedlagt hos OpenAI
  // (svarer 404), så det forsøges ikke længere — det maskerede kun den
  // egentlige fejl. Meld den første, mest sigende afvisning tilbage.
  return {
    ok: false,
    status: firstError?.status || 502,
    error: firstError
      ? `Realtime afvist (${firstError.status} på ${firstError.model}): ${firstError.error || "ukendt årsag"}`
      : "Kunne ikke oprette en stemmesession hos OpenAI.",
    model: firstError?.model || models[0],
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

  // Modelnavne i prioriteret rækkefølge — OpenAI omdøber tale-modellerne med
  // mellemrum, og en 404 på navnet må ikke koste reservestemmen (den er i
  // forvejen sidste udvej). Konfigureret navn vinder altid.
  const models = [...new Set([
    (process.env.COACH_TTS_MODEL || "").trim() || "gpt-4o-mini-tts",
    "gpt-4o-mini-tts",
    "tts-1",
  ])];

  async function attempt(model, v) {
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
  let first = null;
  for (const model of models) {
    const r = await attempt(model, wanted);
    if (r.ok) return r;
    if (!first) first = r;
    // 5xx/netværk: OpenAI er nede — flere navne hjælper ikke.
    if (!(r.status >= 400 && r.status < 500)) return r;
    // Ikke alle stemmer findes i tale-syntesen (fx de nyeste realtime-stemmer).
    if (wanted !== "alloy") {
      const second = await attempt(model, "alloy");
      if (second.ok) return second;
    }
  }
  // Meld den FØRSTE fejl — den handler om den konfigurerede model og er mest sigende.
  return first || { ok: false, status: 502, error: "Talesyntesen kunne ikke gennemføres." };
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

// ZIP-BOMBE: en .docx på 300 KB kan pakke ud til flere GB. Uden loft trak den
// funktionen op på ~700 MB RSS (målt) og videre til OOM — én uploadet fil kunne
// altså vælte serverfunktionen. Vi sætter derfor et hårdt loft BÅDE pr. del og
// samlet for hele filen. inflateRawSync kaster, når loftet nås; det fanges
// nedenfor, og delen springes bare over.
const ZIP_MAX_PART_BYTES = 24 * 1024 * 1024; // én XML-del (et slide, et ark …)
const ZIP_MAX_TOTAL_BYTES = 64 * 1024 * 1024; // hele dokumentet under ét

/**
 * Pak én fil ud af arkivet. `budget` er et delt regnskab over, hvor mange bytes
 * vi allerede har pakket ud af DENNE fil — så mange små bomber ikke kan gøre
 * det, én stor ikke må.
 */
function readZipFile(buf, entry, budget) {
  if (!entry || entry.local + 30 > buf.length) return null;
  if (buf.readUInt32LE(entry.local) !== 0x04034b50) return null;
  const nameLen = buf.readUInt16LE(entry.local + 26);
  const extraLen = buf.readUInt16LE(entry.local + 28);
  const start = entry.local + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + entry.compSize);

  const left = budget ? Math.max(0, ZIP_MAX_TOTAL_BYTES - budget.used) : ZIP_MAX_TOTAL_BYTES;
  const cap = Math.min(ZIP_MAX_PART_BYTES, left);
  if (cap <= 0) return null;

  try {
    let out = null;
    if (entry.method === 0) {
      if (raw.length > cap) return null;
      out = raw;
    } else if (entry.method === 8) {
      out = inflateRawSync(raw, { maxOutputLength: cap });
    }
    if (!out) return null;
    if (budget) budget.used += out.length;
    return out.toString("utf8");
  } catch {
    // For stor, ødelagt eller ukendt metode — delen springes over.
    return null;
  }
}

/** Nyt udpakningsregnskab for én uploadet fil. */
function newZipBudget() {
  return { used: 0 };
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
  const budget = newZipBudget();
  const out = [];
  for (const s of slides) {
    const xml = readZipFile(buf, entries.get(s.name), budget);
    if (xml === null) continue;
    const body = xmlToText(xml);
    // Talernoter hører med — de rummer ofte sælgerens egentlige argumentation.
    const notesName = `ppt/notesSlides/notesSlide${s.no}.xml`;
    const notes = entries.has(notesName)
      ? xmlToText(readZipFile(buf, entries.get(notesName), budget) || "")
      : "";
    out.push([`— slide ${s.no} —`, body, notes ? `[noter] ${notes}` : ""].filter(Boolean).join("\n"));
  }
  return { text: out.join("\n\n"), pages: slides.length };
}

function docxToText(buf, entries) {
  const xml = readZipFile(buf, entries.get("word/document.xml"), newZipBudget());
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
  const budget = newZipBudget();
  const shared = sharedStringsOf(readZipFile(buf, entries.get("xl/sharedStrings.xml"), budget));
  const workbook = readZipFile(buf, entries.get("xl/workbook.xml"), budget) || "";
  const names = [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => decodeXmlEntities(m[1]));
  const sheets = numberedParts(entries, /^xl\/worksheets\/sheet(\d+)\.xml$/);
  const out = [];
  for (const s of sheets) {
    const xml = readZipFile(buf, entries.get(s.name), budget);
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
