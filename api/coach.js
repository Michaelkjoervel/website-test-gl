// =============================================================================
// api/coach.js  ·  Vercel-adapter: green light Salgscoach (tekst + analyse)
// -----------------------------------------------------------------------------
// ÉN funktion med action-dispatch, så salgscoachen kun optager én Vercel-rute:
//
//   POST /api/coach { action: "manifest" }   → manual/viden/personaer/øvelser
//   POST /api/coach { action: "scenarie" }   → generér rollespilsscenarie
//   POST /api/coach { action: "samtale" }    → næste replik i samtalen (tekst)
//   POST /api/coach { action: "analyse" }    → feedback på en gennemført session
//   POST /api/coach { action: "profil" }     → opdateret udviklingsprofil
//   POST /api/coach { action: "materiale" }  → læs + analysér salgsmateriale
//   POST /api/coach { action: "team" }       → ledelsesoverblik
//   GET  /api/coach                          → status
//
// TO TING ER AFGØRENDE FOR AT ØVELSEN HAR VÆRDI:
//   1. Salgsmanualen og green light-videnbasen findes KUN på serveren. Klienten
//      får et manifest med titler — aldrig manual-prosaen.
//   2. Rollespilskundens SKJULTE fakta forlader aldrig serveren i læsbar form.
//      De sendes frem og tilbage som en forseglet blob (sealHidden/openHidden),
//      så sælgeren ikke kan snyde ved at kigge i browserens netværksfane.
//
// Kræver login (samme Supabase-verificering som resten af værktøjerne) og
// tæller på en rate-limit-spand PR. ACTION, så en tung materialeanalyse ikke
// æder kvoten for selve samtalen — samme princip som api/extract.js.
//
// Env: OPENAI_API_KEY (påkrævet), SUPABASE_* (login), COACH_SECRET (anbefalet),
//      COACH_MODEL / COACH_FAST_MODEL (valgfri modelvalg).
// =============================================================================

import {
  authorize,
  coachRateLimit,
  corsOrigin,
  callModel,
  sealHidden,
  openHidden,
  extractDocumentText,
  MAX_DOCUMENT_CHARS,
} from "./_coach.mjs";
import { manualManifest } from "./_manual.mjs";
import { knowledgeManifest } from "./_greenlight.mjs";
import { personaManifest, pickPersona, publicScenarioView } from "./_personas.mjs";
import {
  MODES,
  COACH_MODES,
  buildSystemInstructions,
  buildAnalysisInstructions,
  buildScenarioInstructions,
  buildProfileInstructions,
  buildMaterialInstructions,
  buildTeamInstructions,
  FEEDBACK_SCHEMA,
  SCENARIO_SCHEMA,
  PROFILE_SCHEMA,
  MATERIAL_SCHEMA,
  TEAM_SCHEMA,
  pruneNulls,
} from "./_coachprompt.mjs";

export const config = {
  maxDuration: 300, // analyse af en lang samtale + materialelæsning kan tage tid
};

/* --------------------------------------------------------------- HTTP-lag */

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

/* ------------------------------------------------------------- Hjælpere */

/** Kør en prompt-builder uden at vælte hele kaldet, hvis den fejler. */
function safeBuild(fn, args, fallback = "") {
  try {
    const s = fn(args);
    return typeof s === "string" && s.trim() ? s : fallback;
  } catch {
    return fallback;
  }
}

function trim(value, max) {
  // Objekter SKAL serialiseres, ikke String()-es. Ellers blev sælgerens
  // udviklingsprofil til "[object Object]", og coachen mistede hele sin
  // hukommelse om personen — uden at noget fejlede synligt.
  let s;
  if (value == null) s = "";
  else if (typeof value === "string") s = value;
  else if (typeof value === "object") {
    try {
      s = JSON.stringify(value, null, 2);
    } catch {
      s = "";
    }
  } else s = String(value);
  return s.length > max ? `${s.slice(0, max)}\n…[forkortet]` : s;
}

/**
 * sellerContext er et OBJEKT, og promptbyggeren læser .weaknesses/.focusAreas
 * direkte. Den må derfor ikke serialiseres på vejen — så mister coachen
 * hukommelsen om sælgeren uden at noget fejler synligt. Vi begrænser i stedet
 * størrelsen ved at klippe listerne, og beholder formen.
 */
function boundContext(value, maxItems = 8) {
  if (!value || typeof value !== "object") return null;
  const cut = (v) => (Array.isArray(v) ? v.slice(0, maxItems) : v);
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = cut(v);
  return out;
}

function lang(body) {
  return body?.language === "en" ? "en" : "da";
}

/** MODES kan være en liste eller et opslag — begge dele skal virke. */
function findMode(modeId) {
  const list = Array.isArray(MODES) ? MODES : Object.values(MODES || {});
  return list.find((m) => m && m.id === modeId) || null;
}

const SPEAKER_LABEL = { saelger: "SÆLGER", kunde: "KUNDE", coach: "COACH", system: "SYSTEM" };

/** Gør en transcript (Utterance[]) til noget en model kan læse. */
function renderTranscript(transcript) {
  if (typeof transcript === "string") return transcript;
  if (!Array.isArray(transcript)) return "";
  return transcript
    .filter((u) => u && typeof u.text === "string" && u.text.trim() && !u.partial)
    .map((u) => `${SPEAKER_LABEL[u.role] || String(u.role || "?").toUpperCase()}: ${u.text.trim()}`)
    .join("\n");
}

/**
 * Maks. antal replikker vi sender med. Uden loft kunne en klient sende hele
 * request-kroppen fuld af replikker og dermed betale-per-token sig gennem
 * loftet i ét enkelt kald. En rollespilsøvelse er sjældent over 60 replikker;
 * bliver den længere, er det de SENESTE, modellen skal bruge.
 */
const MAX_MESSAGES = 80;

/** Samtalens historik → Responses-input. */
function renderMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const usable = messages.filter(
    (m) => m && (typeof m.content === "string" || typeof m.text === "string"),
  );
  return usable
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: trim(m.content ?? m.text, 8000) }));
}

function nowIso() {
  return new Date().toISOString();
}

/** Sæt generatedAt hvis modellen glemte eller opfandt den. */
function stamp(obj) {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const v = obj.generatedAt;
    if (!v || typeof v !== "string" || Number.isNaN(Date.parse(v))) obj.generatedAt = nowIso();
  }
  return obj;
}

/* ------------------------------------------------------------- Actions */

async function doManifest() {
  // Ingen model, ingen omkostning — men manualens PROSA kommer aldrig med.
  // Kun titler, kapitler og øvelsesdefinitioner, så UI'et kan vise noget.
  return {
    status: 200,
    payload: {
      manual: manualManifest(),
      knowledge: knowledgeManifest(),
      personas: personaManifest(),
      modes: MODES,
      coachModes: COACH_MODES,
    },
  };
}

async function doScenarie(body, apiKey, ctx = {}) {
  const modeId = String(body?.modeId || "").trim();
  if (!modeId) return { status: 400, payload: { error: "'modeId' er påkrævet for at generere et scenarie." } };

  const language = lang(body);
  const scenarioConfig = body?.config && typeof body.config === "object" ? body.config : { auto: true };
  const sellerContext = boundContext(body?.sellerContext);

  // Personaen er startpunktet: et rigtigt menneske med en rigtig dagsorden.
  let persona = null;
  try {
    persona = pickPersona({ modeId, config: scenarioConfig, language }) || null;
  } catch {
    persona = null; // biblioteket må aldrig kunne vælte en øvelse
  }

  const instructions = safeBuild(buildScenarioInstructions, {
    modeId,
    config: scenarioConfig,
    sellerContext,
    language,
    persona,
  });
  if (!instructions) {
    return { status: 500, payload: { error: "Scenarie-instruktionen kunne ikke bygges på serveren." } };
  }

  const input = [
    {
      role: "user",
      content: [
        "Byg scenariet nu.",
        "",
        "Sælgerens valg:",
        JSON.stringify(scenarioConfig).slice(0, 4000),
        persona ? `\nUdgangspunkt (persona fra biblioteket):\n${JSON.stringify(persona).slice(0, 6000)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  // Den HURTIGE model, med vilje: sælgeren står og venter på at komme i gang,
  // og på en kold serverless-funktion nåede den grundige model ikke altid i
  // mål, før klienten gav op. Kvaliteten bæres af instruktionen og af
  // persona-biblioteket som udgangspunkt — ikke af modellens størrelse.
  const r = await callModel({
    instructions,
    input,
    schema: SCENARIO_SCHEMA,
    schemaName: "scenarie",
    effort: "hurtig",
    apiKey,
  });
  if (!r.ok) return { status: r.status, payload: { error: r.error || "Scenariet kunne ikke genereres." } };

  const scenario = pruneNulls(r.data);
  if (!scenario || typeof scenario !== "object") {
    return { status: 502, payload: { error: "Modellen returnerede et ubrugeligt scenarie." } };
  }

  // Alt sælgeren IKKE må se forsegles. Klienten sender blobben retur ved hver
  // replik og ved analysen — men kan ikke læse den. Forseglingen bindes til
  // den bruger, der bad om scenariet, og udløber af sig selv.
  const hiddenBlob = sealHidden(
    {
      persona: scenario.persona || persona || null,
      hiddenBrief: scenario.hiddenBrief || "",
      hiddenFacts: scenario.persona?.hidden || persona?.hidden || [],
    },
    { audience: ctx.user },
  );

  let view;
  try {
    view = publicScenarioView(scenario);
  } catch {
    view = null;
  }
  if (!view) {
    // Nødplan: fjern selv det følsomme, så vi hellere viser for lidt end for meget.
    const { hiddenBrief, persona: p, ...rest } = scenario;
    const { hidden, personalMotivation, budgetReality, ...safePersona } = p || {};
    view = { ...rest, persona: safePersona };
  }

  return { status: 200, payload: { scenario: view, hiddenBlob } };
}

async function doSamtale(body, apiKey, ctx = {}) {
  const modeId = String(body?.modeId || "").trim();
  if (!modeId) return { status: 400, payload: { error: "'modeId' er påkrævet." } };

  const messages = renderMessages(body?.messages);
  if (!messages.length) {
    return { status: 400, payload: { error: "'messages' skal indeholde mindst én replik." } };
  }

  const mode = findMode(modeId);
  const speaker = mode?.counterpart === "salgsdirektoer" ? "coach" : "kunde";

  const instructions = safeBuild(buildSystemInstructions, {
    modeId,
    coachMode: body?.coachMode || mode?.defaultCoachMode || "realistisk",
    language: lang(body),
    scenario: body?.scenario || null,
    // Åbnes KUN her på serveren — og kun hvis blobben er udstedt til netop
    // denne bruger og ikke er udløbet.
    hidden: openHidden(body?.hiddenBlob, { audience: ctx.user }),
    sellerContext: boundContext(body?.sellerContext),
    intake: trim(body?.intake, 6000),
    documentText: trim(body?.documentText, 40_000),
    purpose: "text",
  });
  if (!instructions) {
    return { status: 500, payload: { error: "Samtale-instruktionen kunne ikke bygges på serveren." } };
  }

  // Samtalen skal føles levende — derfor den hurtige model.
  const r = await callModel({ instructions, input: messages, effort: "hurtig", apiKey });
  if (!r.ok) return { status: r.status, payload: { error: r.error || "Der kom ikke noget svar fra modellen." } };

  return { status: 200, payload: { reply: String(r.data || "").trim(), speaker } };
}

async function doAnalyse(body, apiKey, ctx = {}) {
  // Klienten sender samtalen som "messages" (samme felt som i en samtale).
  // Vi tager imod begge navne, så en omdøbning ét sted ikke koster feedbacken.
  const transcript =
    renderTranscript(body?.transcript) || renderTranscript(body?.messages);
  if (!transcript.trim()) {
    return { status: 400, payload: { error: "Der er ingen samtale at analysere ('transcript' er tom)." } };
  }

  const modeId = String(body?.modeId || "").trim();
  const mode = findMode(modeId);

  const instructions = safeBuild(buildAnalysisInstructions, {
    modeId,
    coachMode: body?.coachMode || mode?.defaultCoachMode || "coach",
    language: lang(body),
    scenario: body?.scenario || null,
    hidden: openHidden(body?.hiddenBlob, { audience: ctx.user }),
    sellerContext: boundContext(body?.sellerContext),
    intake: trim(body?.intake, 6000),
    documentText: trim(body?.documentText, 40_000),
  });
  if (!instructions) {
    return { status: 500, payload: { error: "Analyse-instruktionen kunne ikke bygges på serveren." } };
  }

  const r = await callModel({
    instructions,
    input: [{ role: "user", content: `Her er samtalen. Giv feedbacken nu.\n\n${trim(transcript, 120_000)}` }],
    schema: FEEDBACK_SCHEMA,
    schemaName: "feedback",
    effort: "grundig",
    apiKey,
  });
  if (!r.ok) return { status: r.status, payload: { error: r.error || "Feedbacken kunne ikke laves." } };

  return { status: 200, payload: { feedback: stamp(pruneNulls(r.data)) } };
}

async function doProfil(body, apiKey) {
  const initials = String(body?.initials || "").trim();
  if (!initials) return { status: 400, payload: { error: "'initials' er påkrævet for at opdatere en profil." } };

  const sessions = Array.isArray(body?.sessions) ? body.sessions : [];
  if (!sessions.length && !body?.previousProfile) {
    return { status: 400, payload: { error: "Der er endnu ingen sessioner at bygge en udviklingsprofil på." } };
  }

  const instructions = safeBuild(buildProfileInstructions, {
    initials,
    previousProfile: body?.previousProfile || null,
    sessions,
    language: lang(body),
  });
  if (!instructions) {
    return { status: 500, payload: { error: "Profil-instruktionen kunne ikke bygges på serveren." } };
  }

  const r = await callModel({
    instructions,
    input: [
      {
        role: "user",
        content: `Skriv den opdaterede udviklingsprofil for ${initials} nu. Konkludér kun på mønstre, der er set flere gange.`,
      },
    ],
    schema: PROFILE_SCHEMA,
    schemaName: "profil",
    effort: "grundig",
    apiKey,
  });
  if (!r.ok) return { status: r.status, payload: { error: r.error || "Udviklingsprofilen kunne ikke opdateres." } };

  const profile = r.data && typeof r.data === "object" ? pruneNulls(r.data) : null;
  if (profile && !profile.updatedAt) profile.updatedAt = nowIso();
  return { status: 200, payload: { profile } };
}

async function doMateriale(body, apiKey) {
  const language = lang(body);

  let extractedText = trim(body?.text, MAX_DOCUMENT_CHARS);
  let pages = null;
  let kind = null;

  if (body?.file) {
    const doc = await extractDocumentText({ file: body.file, apiKey });
    if (!doc.ok) return { status: 400, payload: { error: doc.error || "Materialet kunne ikke læses." } };
    extractedText = doc.text;
    pages = doc.pages ?? null;
    kind = doc.kind || null;
  }

  if (!extractedText.trim()) {
    return { status: 400, payload: { error: "Der er ingen tekst at analysere — upload en fil eller indsæt teksten." } };
  }

  const instructions = safeBuild(buildMaterialInstructions, {
    customerContext: trim(body?.customerContext, 6000),
    sellerContext: boundContext(body?.sellerContext),
    language,
  });
  if (!instructions) {
    return { status: 500, payload: { error: "Materiale-instruktionen kunne ikke bygges på serveren." } };
  }

  const r = await callModel({
    instructions,
    input: [
      {
        role: "user",
        content: `Her er materialets fulde tekst. Analysér det nu — citér konkret, og henvis til side/slide.\n\n${extractedText}`,
      },
    ],
    schema: MATERIAL_SCHEMA,
    schemaName: "materialeanalyse",
    effort: "grundig",
    apiKey,
  });
  if (!r.ok) {
    // Teksten er allerede hentet ud — giv den tilbage, så uploaden ikke er spildt.
    return { status: r.status, payload: { error: r.error || "Materialet kunne ikke analyseres.", extractedText, pages, kind } };
  }

  return { status: 200, payload: { extractedText, pages, kind, analysis: stamp(pruneNulls(r.data)) } };
}

async function doTeam(body, apiKey) {
  const profiles = Array.isArray(body?.profiles) ? body.profiles : [];
  const sessions = Array.isArray(body?.sessions) ? body.sessions : [];
  if (!profiles.length && !sessions.length) {
    return { status: 400, payload: { error: "Der er endnu ingen data at lave et ledelsesoverblik på." } };
  }

  const instructions = safeBuild(buildTeamInstructions, { profiles, sessions, language: lang(body) });
  if (!instructions) {
    return { status: 500, payload: { error: "Team-instruktionen kunne ikke bygges på serveren." } };
  }

  const r = await callModel({
    instructions,
    input: [
      {
        role: "user",
        content: "Skriv ledelsesoverblikket nu. Peg kun på mønstre, der går igen på tværs af sælgere eller sessioner.",
      },
    ],
    schema: TEAM_SCHEMA,
    schemaName: "teamoverblik",
    effort: "grundig",
    apiKey,
  });
  if (!r.ok) return { status: r.status, payload: { error: r.error || "Ledelsesoverblikket kunne ikke laves." } };

  const overview = r.data && typeof r.data === "object" ? pruneNulls(r.data) : null;
  if (overview && !overview.updatedAt) overview.updatedAt = nowIso();
  return { status: 200, payload: { overview } };
}

/* ------------------------------------------------------------- Dispatch */

// "status"/"manual" er ældre navne for manifestet (jf. CoachAction i types.ts).
const ALIASES = { manual: "manifest", status: "manifest" };

// Egen rate-limit-spand pr. action: en tung materialeanalyse må ikke bruge
// sælgerens kvote til selve samtalen. Spandene er coachens EGNE (se
// coachRateLimit i _coach.mjs) — en samtale på 30 replikker må ikke kunne
// lukke visualiseringsværktøjet ned for resten af dagen.
const ACTIONS = {
  manifest: { run: () => doManifest(), free: true },
  scenarie: { run: doScenarie },
  samtale: { run: doSamtale },
  analyse: { run: doAnalyse },
  profil: { run: doProfil },
  materiale: { run: doMateriale },
  team: { run: doTeam },
};

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = (req.headers?.authorization || "").replace(/^Bearer\s+/i, "");

  if (req.method === "GET") {
    return res.status(200).json({
      service: "green-light-salgscoach",
      method: "POST { action, … }",
      actions: Object.keys(ACTIONS),
      keyConfigured: Boolean(process.env.OPENAI_API_KEY),
    });
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

  const raw = String(body?.action || "").trim().toLowerCase();
  const action = ALIASES[raw] || raw;
  const spec = ACTIONS[action];
  if (!spec) {
    return res.status(400).json({
      error: `Ukendt action "${body?.action ?? ""}". Gyldige: ${Object.keys(ACTIONS).join(", ")}.`,
    });
  }

  // Manifestet koster ingen AI-forbrug og hentes ved hver appstart — det ville
  // være meningsløst at bremse det. Alt andet tæller på sin egen spand.
  if (!spec.free) {
    const rl = coachRateLimit(action, auth.email);
    if (!rl.ok) return res.status(rl.status).json({ error: rl.reason });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey && !spec.free) {
    return res.status(500).json({ error: "Serveren mangler OPENAI_API_KEY." });
  }

  try {
    // Brugeren følger med, så forseglingen kan bindes til netop denne konto.
    const { status, payload } = await spec.run(body, apiKey, { user: auth.email });
    return res.status(status).json(payload);
  } catch (e) {
    // Aldrig en rå stack ud til sælgeren — og aldrig prompten i loggen.
    return res.status(500).json({ error: `Der gik noget galt på serveren: ${String(e?.message || e).slice(0, 200)}` });
  }
}
