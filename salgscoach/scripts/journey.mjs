// =============================================================================
// journey · ende-til-ende-simulering af sælgerens rejse gennem Salgscoachen
// -----------------------------------------------------------------------------
// Kør:  node salgscoach/scripts/journey.mjs
//
// selftest.mjs tester SERVEREN. Denne test kører hele sløjfen igennem den
// RIGTIGE klientkode — lib/store, lib/api, buildSellerContext, buildRetrySession,
// countMetrics — og lader klientens fetch ramme de rigtige serverhandlere.
// Modellen er stubbet (der ringes aldrig til OpenAI), men alt derimellem er
// produktionskode:
//
//   forside → øvelse → scenarie → stemmesession → samtale → analyse →
//   debriefing → udviklingsprofil → NÆSTE øvelse → prøv igen
//
// Testen svarer på de spørgsmål en sælger reelt ville stille:
//   1. Når coachen har set min svaghed én gang — presser han så på den NÆSTE
//      gang? (Svagheden skal stå ordret i instruktionen modellen får.)
//   2. Bliver min profil rent faktisk gemt, og driver den forsidens anbefaling?
//   3. Kan jeg snyde ved at kigge i netværkssvaret? (Kundens skjulte kort må
//      aldrig kunne læses fra klienten — heller ikke i det gemte.)
//   4. Kører "Kør øvelsen igen" den SAMME øvelse med det SAMME scenarie?
//   5. Kan jeg læse en kollegas samtaler gennem lagerets API? (Nej.)
//
// Klientkoden er TypeScript. Den bundles med esbuild, som allerede følger med
// Vite — der installeres ikke noget nyt.
// =============================================================================

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const API = path.resolve(ROOT, "../api");
const API_BASE = "http://coach.test/api";

/* ------------------------------------------------------------- Testramme */

let pass = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

async function rejects(fn, match) {
  try {
    await fn();
    return { rejected: false, message: "" };
  } catch (e) {
    const message = String(e?.message || e);
    return { rejected: !match || match.test(message), message };
  }
}

/* ------------------------------------------------- Browserens verden i Node */

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => void map.set(String(k), String(v)),
    removeItem: (k) => void map.delete(String(k)),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    _dump: () => JSON.stringify([...map.entries()]),
  };
}

const localStorage = makeStorage();
const sessionStorage = makeStorage();
globalThis.localStorage = localStorage;
globalThis.sessionStorage = sessionStorage;

/* ------------------------------------------------------- Modellen (stub) */

/** Alt der blev sendt til "OpenAI" — så vi kan læse instruktionen efter. */
const modelCalls = [];
/** Alt browseren fik retur fra serveren — bruges til lækagetjek. */
const clientPayloads = [];

/** Markører vi kan lede efter hele vejen igennem. */
const MARK = {
  weakness: "GAAR_I_LOESNING_FOER_KONSEKVENS_ER_ETABLERET",
  narrative: "KMA lukker for tidligt og prissætter aldrig problemet.",
  hiddenFact:
    "SKJULT_BUDGETTET_ER_ALLEREDE_BRUGT_PAA_VENTILATION_OG_CHEFEN_VED_DET_IKKE",
  hiddenBrief: "SKJULT_BRIEF_KUNDEN_HAR_ALLEREDE_ET_TILBUD_LIGGENDE",
  headline: "Du fandt problemet, men prissatte det aldrig.",
};

function sampleFromSchema(schema, key = "felt", depth = 0) {
  if (depth > 12) return null;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const type = types.find((t) => t !== "null") || "string";
  if (schema.enum) return schema.enum[0];
  switch (type) {
    case "object": {
      const out = {};
      for (const [k, v] of Object.entries(schema.properties || {})) {
        out[k] = sampleFromSchema(v, k, depth + 1);
      }
      return out;
    }
    case "array":
      return [schema.items ? sampleFromSchema(schema.items, key, depth + 1) : "x"];
    case "number":
    case "integer":
      return 1;
    case "boolean":
      return true;
    default:
      return `prøve-${key}`;
  }
}

function isoDaysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/** Modellens svar pr. skema — med genkendelige markører, så vi kan følge dem. */
function modelAnswer(name, schema) {
  const base = sampleFromSchema(schema);

  if (name === "scenarie") {
    return {
      ...base,
      id: "produktion-haard",
      title: "Produktionsvirksomhed · hallen med de gamle armaturer",
      briefing: "Du skal tale med driftschefen. Han har en halv time og er skeptisk.",
      objectives: ["Find det reelle driftsproblem", "Få konsekvensen sat i kroner"],
      hiddenBrief: MARK.hiddenBrief,
      source: "genereret",
      modeId: "kunderollespil",
      persona: {
        ...base.persona,
        id: "driftschef-produktion",
        name: "Henrik Bak",
        role: "Driftschef",
        company: "Produktionsvirksomhed i Midtjylland",
        industry: "Produktion",
        hidden: [
          {
            id: "budget",
            topic: "budget",
            fact: MARK.hiddenFact,
            unlockedBy: "Spørgsmål om hvad der ellers er investeret i i år",
            depth: 3,
          },
        ],
      },
      config: {
        ...base.config,
        industry: "Produktion",
        difficulty: "haard",
        auto: false,
      },
    };
  }

  if (name === "feedback") {
    return {
      ...base,
      overall: "SKAL FORBEDRES",
      headline: MARK.headline,
      didWell: ["Du åbnede roligt og fik lov til at blive i lokalet."],
      heldBack: ["Du gik i løsning, før konsekvensen var etableret."],
      missed: ["Du spurgte aldrig hvad nedetiden koster."],
      iWouldHaveDone: ["Jeg ville have spurgt: hvad koster en times stilstand jer?"],
      focusNextTime: [
        "Bliv i konsekvensen indtil den er sat i kroner",
        "Stil ét spørgsmål mere, før du foreslår noget",
      ],
    };
  }

  if (name === "profil") {
    return {
      ...base,
      sellerId: "KMA",
      initials: "KMA",
      narrative: MARK.narrative,
      sessionsCount: 1,
      totalMinutes: 7,
      lastSessionAt: isoDaysAgo(0),
      strengths: [],
      weaknesses: [
        {
          id: "loesning-foer-konsekvens",
          area: "konsekvens",
          kind: "svaghed",
          statement: MARK.weakness,
          occurrences: 3,
          evidence: [{ sessionId: "ses-1", date: isoDaysAgo(1), quote: "Vi kan levere nye armaturer" }],
          firstSeen: isoDaysAgo(20),
          lastSeen: isoDaysAgo(0),
          trend: "uaendret",
          status: "aktiv",
        },
      ],
      recommended: [
        {
          modeId: "afdaekning",
          why: "Du går i løsning, før konsekvensen er etableret.",
          focus: "Bliv i konsekvensen indtil den er sat i kroner",
          scenarioHint: "Produktionskunde med nedetid",
          priority: 1,
        },
      ],
      ownGoals: [],
    };
  }

  return base;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/* ------------------------------------------- Falsk req/res (Vercel-handler) */

function invoke(handler, { method = "POST", body = {}, headers = {} } = {}) {
  return new Promise((resolve) => {
    const req = {
      method,
      headers: { authorization: "Bearer journey", origin: "http://localhost:5174", ...headers },
      body,
    };
    const res = {
      statusCode: 200,
      setHeader() {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, payload });
        return this;
      },
      end() {
        resolve({ status: this.statusCode, payload: null });
        return this;
      },
    };
    Promise.resolve(handler(req, res)).catch((e) =>
      resolve({ status: 500, payload: { error: `kastede: ${e.message}` } }),
    );
  });
}

/* --------------------------------------------------------- Bundling af klienten */

async function buildClient() {
  let esbuild;
  try {
    esbuild = await import("esbuild");
  } catch {
    console.error(
      "esbuild kunne ikke indlæses. Kør 'npm install' i salgscoach/ — esbuild følger med Vite.",
    );
    process.exit(1);
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gl-journey-"));
  const entry = path.join(dir, "entry.ts");
  const out = path.join(dir, "client.mjs");

  const src = (p) => JSON.stringify(path.resolve(ROOT, "src", p));
  await fs.writeFile(
    entry,
    [
      `export * as store from ${src("lib/store")};`,
      `export * as apiClient from ${src("lib/api")};`,
      `export { makeLocalSeller, seedSellers } from ${src("lib/sellers")};`,
      `export { buildRetrySession, countMetrics } from ${src("pages/Debrief")};`,
      `export { newId } from ${src("lib/ids")};`,
      `export { config } from ${src("config")};`,
    ].join("\n"),
    "utf8",
  );

  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: out,
    format: "esm",
    platform: "node",
    target: "node18",
    jsx: "automatic",
    logLevel: "silent",
    define: {
      "import.meta.env": JSON.stringify({
        MODE: "test",
        DEV: false,
        PROD: true,
        VITE_SUPABASE_URL: "off",
        VITE_SUPABASE_ANON_KEY: "off",
        VITE_COACH_API_BASE: API_BASE,
        VITE_COACH_LANGUAGE: "da",
      }),
    },
  });

  return out;
}

/* ------------------------------------------------------------------ Kør */

async function main() {
  process.env.OPENAI_API_KEY = "sk-test-journey";
  process.env.COACH_SECRET = "journey-hemmelighed";
  process.env.ALLOW_ANONYMOUS = "1";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  section("Opbygning");
  const clientFile = await buildClient();
  const client = await import(clientFile);
  ok("klientkoden kan bygges og indlæses", Boolean(client.store && client.apiClient));
  ok("klienten peger på serverens API", client.config.apiBase === API_BASE, client.config.apiBase);

  const coach = (await import(path.join(API, "coach.js"))).default;
  const coachSession = (await import(path.join(API, "coach-session.js"))).default;
  const coachSpeak = (await import(path.join(API, "coach-speak.js"))).default;
  const coachCore = await import(path.join(API, "_coach.mjs"));

  const handlers = {
    "/coach": coach,
    "/coach-session": coachSession,
    "/coach-speak": coachSpeak,
  };

  // Ét fetch for hele verden: klienten → serveren → "OpenAI".
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);

    if (u.startsWith(API_BASE)) {
      const route = u.slice(API_BASE.length);
      const handler = handlers[route];
      if (!handler) return jsonResponse({ error: `ukendt rute ${route}` }, 404);
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      const { status, payload } = await invoke(handler, { method: init.method || "POST", body });
      clientPayloads.push({ route, action: body?.action ?? null, payload });
      return jsonResponse(payload ?? {}, status);
    }

    const body = typeof init.body === "string" ? safeJson(init.body) : null;
    modelCalls.push({ url: u, body });

    if (u.includes("/v1/realtime/client_secrets")) {
      return jsonResponse({ value: "ek_journey_noegle", expires_at: 1893456000, session: {} });
    }
    if (u.includes("/v1/realtime/sessions")) {
      return jsonResponse({ client_secret: { value: "ek_journey_beta" } });
    }
    if (u.includes("/v1/audio/speech")) {
      return new Response(new Uint8Array([0x49, 0x44, 0x33, 0x04]).buffer, { status: 200 });
    }
    if (u.includes("/v1/responses")) {
      const format = body?.text?.format;
      if (format?.type === "json_schema" && format.schema) {
        return jsonResponse({ output_text: JSON.stringify(modelAnswer(format.name, format.schema)) });
      }
      return jsonResponse({
        output_text: "Hvad koster en times stilstand jer? Og hvordan ved du det?",
      });
    }
    return jsonResponse({ error: { message: `uventet kald: ${u}` } }, 500);
  };

  const { store, apiClient: api, makeLocalSeller, buildRetrySession, countMetrics } = client;

  /* ======================================================= 1 · Forsiden */
  section("1 · Forsiden — fra åbning til valg af øvelse");

  const kma = makeLocalSeller("KMA");
  store.setActiveSeller(kma);

  const manifest = await api.getManifest();
  ok("træningsformerne hentes", (manifest.modes || []).length >= 14, `${manifest.modes?.length}`);
  const synlige = (manifest.modes || []).filter((m) => !m.hidden);
  ok("mindst én øvelse er synlig på forsiden", synlige.length > 0);
  ok(
    "manifestet lækker ikke manualprosa til browseren",
    !JSON.stringify(manifest).includes("HOLD KÆFT"),
  );

  const foersteProfil = await store.getProfile();
  ok("en ny sælger har ingen profil (og skal ikke udfylde noget)", foersteProfil === undefined);

  /* ============================================= 2 · Første øvelse (uden opsætning) */
  section("2 · Første øvelse — start uden at udfylde noget");

  const tomKontekst = api.buildSellerContext(null, kma, []);
  ok("sælgerkontekst kan bygges uden profil", tomKontekst.initials === "KMA");
  ok("uden historik er der ingen svagheder at presse på", tomKontekst.weaknesses.length === 0);

  const scen1 = await api.generateScenario({
    modeId: "kunderollespil",
    config: { auto: true, difficulty: "haard" },
    sellerContext: tomKontekst,
    language: "da",
  });
  ok("scenariet kommer tilbage", Boolean(scen1.scenario?.title));
  ok("scenariet har en forseglet pakke", scen1.hiddenBlob.startsWith("v1."));

  const scenarioJson = JSON.stringify(scen1.scenario);
  ok(
    "scenariet browseren får indeholder INGEN skjulte fakta",
    !scenarioJson.includes(MARK.hiddenFact),
  );
  ok(
    "scenariet browseren får indeholder INGEN skjult brief",
    !scenarioJson.includes(MARK.hiddenBrief) && !scenarioJson.includes("hiddenBrief"),
  );
  ok(
    "forseglingen kan ikke læses af klienten",
    !scen1.hiddenBlob.includes(MARK.hiddenFact) && !scen1.hiddenBlob.includes("budget"),
  );
  ok("serveren kan selv åbne forseglingen", Boolean(coachCore.openHidden(scen1.hiddenBlob)));

  const ses1 = {
    id: client.newId("ses"),
    sellerId: kma.id,
    sellerInitials: kma.initials,
    modeId: "kunderollespil",
    coachMode: "hybrid",
    language: "da",
    voiceEngine: "realtime",
    scenario: scen1.scenario,
    hiddenBlob: scen1.hiddenBlob,
    status: "aktiv",
    startedAt: isoDaysAgo(0),
    durationSec: 0,
    transcript: [],
    developmentFocus: [],
  };
  await store.saveSession(ses1);
  const hentet = await store.getSession(ses1.id);
  ok("øvelsen gemmes og kan hentes igen", hentet?.id === ses1.id);
  ok("den forseglede pakke overlever lageret", hentet?.hiddenBlob === scen1.hiddenBlob);

  /* ================================================= 3 · Samtalen */
  section("3 · Samtalen — stemme, tekst og hvad modellen får at vide");

  modelCalls.length = 0;
  const rt1 = await api.createRealtimeSession({
    modeId: ses1.modeId,
    coachMode: ses1.coachMode,
    language: "da",
    scenario: ses1.scenario,
    hiddenBlob: ses1.hiddenBlob,
    sellerContext: api.buildSellerContext(null, kma, []),
    voice: ses1.scenario?.persona?.voice,
  });
  ok("stemmesessionen oprettes", rt1.ok === true, rt1.ok ? "" : rt1.error);

  const mint1 = modelCalls.find((c) => c.url.includes("client_secrets"));
  const rtInstr1 = String(mint1?.body?.session?.instructions || "");
  ok("instruktionen bygges på serveren", rtInstr1.length > 500, `${rtInstr1.length} tegn`);
  ok("modellen KENDER kundens skjulte fakta", rtInstr1.includes(MARK.hiddenFact));
  ok(
    "browseren får ikke instruktionen retur",
    !JSON.stringify(rt1).includes(MARK.hiddenFact) && !JSON.stringify(rt1).includes("SALGSMANUAL"),
  );

  // Reservevejen: samme samtale, men ført på tekst (mikrofon nægtet/ingen realtime).
  const transcript = [];
  let clock = 0;
  const say = (role, text) => {
    clock += 12_000;
    transcript.push({ id: client.newId("u"), role, text, at: clock });
  };

  say("saelger", "Hej Henrik, tak fordi du ville tage mødet. Jeg vil gerne høre om jeres hal.");
  const svar1 = await api.converse({
    modeId: ses1.modeId,
    coachMode: ses1.coachMode,
    language: "da",
    scenario: ses1.scenario,
    hiddenBlob: ses1.hiddenBlob,
    messages: transcript,
    sellerContext: api.buildSellerContext(null, kma, []),
  });
  ok("kunden svarer i tekst-tilstand", svar1.reply.length > 0);
  ok("svaret er markeret som kundens", svar1.speaker === "kunde");
  ok(
    "samtalesvaret lækker ikke det skjulte",
    !JSON.stringify(svar1).includes(MARK.hiddenFact),
  );
  say("kunde", svar1.reply);
  say("saelger", "Vi kan levere nye armaturer med det samme, det plejer at være løsningen.");
  say("kunde", "Hvad koster det så?");

  /* ================================================= 4 · Analysen */
  section("4 · Afslutning og analyse");

  const metrics = countMetrics({ ...ses1, transcript });
  ok("hårde tal tælles op i browseren", Boolean(metrics && metrics.sellerWords > 0));
  ok(
    "taletid regnes ud af referatet",
    metrics.sellerTalkRatio > 0 && metrics.sellerTalkRatio <= 1,
    String(metrics?.sellerTalkRatio),
  );

  const { feedback } = await api.analyseSession({
    modeId: ses1.modeId,
    coachMode: ses1.coachMode,
    language: "da",
    scenario: ses1.scenario,
    hiddenBlob: ses1.hiddenBlob,
    messages: transcript,
    sellerContext: api.buildSellerContext(null, kma, []),
    durationSec: 420,
    metrics,
  });
  ok("feedbacken kommer tilbage", feedback.headline === MARK.headline);
  ok("feedbacken peger på næste fokus", (feedback.focusNextTime || []).length > 0);

  const ses1Slut = {
    ...ses1,
    transcript,
    status: "analyseret",
    endedAt: isoDaysAgo(0),
    durationSec: 420,
    feedback,
    summary: feedback.headline,
    developmentFocus: (feedback.focusNextTime || []).slice(0, 2),
  };
  await store.saveSession(ses1Slut);
  const gemt = await store.getSession(ses1.id);
  ok("samtalen er gemt med referat", (gemt?.transcript || []).length === transcript.length);
  ok("feedbacken er gemt sammen med samtalen", gemt?.feedback?.headline === MARK.headline);

  /* ================================================= 5 · Udviklingsprofilen */
  section("5 · Debriefingen opdaterer udviklingsprofilen");

  const alle = await store.listSessions();
  const digests = store.summariseSessionsForProfile(alle, { limit: 20 });
  ok("sessionerne opsummeres til profilkaldet", digests.length === 1);
  ok(
    "opsummeringen sender ALDRIG hele udskriften afsted",
    !JSON.stringify(digests).includes("Vi kan levere nye armaturer"),
  );

  const { profile } = await api.buildProfile({
    initials: kma.initials,
    previousProfile: null,
    sessions: digests,
  });
  await store.saveProfile({
    ...profile,
    sellerId: kma.id,
    initials: kma.initials,
    sessionsCount: alle.length,
    totalMinutes: 7,
    lastSessionAt: alle[0]?.startedAt,
  });

  const gemtProfil = await store.getProfile();
  ok("profilen er gemt og kan hentes igen", Boolean(gemtProfil));
  ok(
    "svagheden står i den gemte profil",
    (gemtProfil?.weaknesses || []).some((w) => w.statement === MARK.weakness),
  );
  ok("profilen er stemplet med sælgerens id", gemtProfil?.sellerId === kma.id);

  const anbefalinger = [...(gemtProfil?.recommended || [])].sort((a, b) => a.priority - b.priority);
  ok("forsiden får en anbefaling at vise", anbefalinger.length > 0);
  const kendteModes = new Set((manifest.modes || []).map((m) => m.id));
  ok(
    "anbefalingen peger på en øvelse der findes",
    anbefalinger.every((r) => kendteModes.has(r.modeId)),
    anbefalinger.map((r) => r.modeId).join(", "),
  );

  /* ========================================= 6 · Næste øvelse: presser coachen på svagheden? */
  section("6 · Næste øvelse — bliver svagheden båret med over?");

  const sessionerNu = await store.listSessions();
  const kontekst2 = api.buildSellerContext(gemtProfil, kma, sessionerNu);
  ok("sælgerkonteksten indeholder svagheden", kontekst2.weaknesses.some((w) => w.statement === MARK.weakness));
  ok("sælgerkonteksten indeholder vurderingen", kontekst2.narrative === MARK.narrative);
  ok(
    "sælgerkonteksten indeholder sidste overskrift",
    kontekst2.recentHeadlines.includes(MARK.headline),
  );
  ok(
    "sælgerkonteksten indeholder næste fokus",
    kontekst2.focusAreas.some((f) => /konsekvens/i.test(f)),
    kontekst2.focusAreas.join(" | "),
  );
  ok(
    "sælgerkonteksten bærer ALDRIG referatet med",
    !JSON.stringify(kontekst2).includes("Vi kan levere nye armaturer med det samme"),
  );

  // a) scenariet til næste øvelse
  modelCalls.length = 0;
  const scen2 = await api.generateScenario({
    modeId: anbefalinger[0].modeId,
    config: { auto: true, difficulty: "haard" },
    sellerContext: kontekst2,
    language: "da",
  });
  const scenInstr = String(
    modelCalls.find((c) => c.url.includes("/v1/responses"))?.body?.instructions || "",
  );
  ok("scenarie-instruktionen kender svagheden", scenInstr.includes(MARK.weakness));

  // b) stemmesessionen til næste øvelse
  modelCalls.length = 0;
  const rt2 = await api.createRealtimeSession({
    modeId: anbefalinger[0].modeId,
    coachMode: "hybrid",
    language: "da",
    scenario: scen2.scenario,
    hiddenBlob: scen2.hiddenBlob,
    sellerContext: kontekst2,
  });
  ok("stemmesessionen oprettes igen", rt2.ok === true, rt2.ok ? "" : rt2.error);
  const rtInstr2 = String(
    modelCalls.find((c) => c.url.includes("client_secrets"))?.body?.session?.instructions || "",
  );
  ok("STEMMEN presser på den kendte svaghed", rtInstr2.includes(MARK.weakness));
  ok("stemmen kender også sælgerens vurdering", rtInstr2.includes(MARK.narrative));
  ok("stemmen har stadig salgsmanualen med", /salgsmanual/i.test(rtInstr2));

  // c) samtalen (tekstvejen) til næste øvelse
  modelCalls.length = 0;
  await api.converse({
    modeId: anbefalinger[0].modeId,
    coachMode: "hybrid",
    language: "da",
    scenario: scen2.scenario,
    hiddenBlob: scen2.hiddenBlob,
    messages: [{ id: "u1", role: "saelger", text: "Godmorgen, skal vi tage en runde om driften?", at: 0 }],
    sellerContext: kontekst2,
  });
  const talkInstr = String(
    modelCalls.find((c) => c.url.includes("/v1/responses"))?.body?.instructions || "",
  );
  ok("SAMTALEN presser på den kendte svaghed", talkInstr.includes(MARK.weakness));

  // d) analysen af næste øvelse
  modelCalls.length = 0;
  await api.analyseSession({
    modeId: anbefalinger[0].modeId,
    coachMode: "hybrid",
    language: "da",
    scenario: scen2.scenario,
    hiddenBlob: scen2.hiddenBlob,
    messages: [
      { id: "u1", role: "saelger", text: "Hvad koster nedetiden jer om året?", at: 0 },
      { id: "u2", role: "kunde", text: "Det har vi aldrig regnet på.", at: 8000 },
    ],
    sellerContext: kontekst2,
    durationSec: 300,
  });
  const analyseInstr = String(
    modelCalls.find((c) => c.url.includes("/v1/responses"))?.body?.instructions || "",
  );
  ok("ANALYSEN kender sælgerens historik", analyseInstr.includes(MARK.weakness));

  /* ================================================= 7 · Prøv igen */
  section("7 · Kør øvelsen igen");

  const igen = buildRetrySession(gemt);
  ok("samme træningsform", igen.modeId === gemt.modeId);
  ok("samme scenarie", JSON.stringify(igen.scenario) === JSON.stringify(gemt.scenario));
  ok("samme forseglede kundeviden", igen.hiddenBlob === gemt.hiddenBlob);
  ok("nyt id, tomt referat", igen.id !== gemt.id && igen.transcript.length === 0);
  ok("ingen feedback slæbt med", igen.feedback === undefined);
  ok("sporet tilbage til originalen", igen.retryOf === gemt.id);

  await store.saveSession(igen);
  const igenHentet = await store.getSession(igen.id);
  ok("gentagelsen kan startes fra lageret", igenHentet?.id === igen.id);

  modelCalls.length = 0;
  const rt3 = await api.createRealtimeSession({
    modeId: igenHentet.modeId,
    coachMode: igenHentet.coachMode,
    language: "da",
    scenario: igenHentet.scenario,
    hiddenBlob: igenHentet.hiddenBlob,
    sellerContext: kontekst2,
  });
  const rtInstr3 = String(
    modelCalls.find((c) => c.url.includes("client_secrets"))?.body?.session?.instructions || "",
  );
  ok("gentagelsen kører med den SAMME skjulte kundeviden", rt3.ok === true && rtInstr3.includes(MARK.hiddenFact));

  /* ================================================= 8 · Privatliv */
  section("8 · Privatliv — kan jeg læse en kollegas træning?");

  const jas = makeLocalSeller("JAS");
  store.setActiveSeller(jas);

  const r1 = await rejects(() => store.listSessions("KMA"), /kun (se )?dine egne/i);
  ok("en anden sælgers sessionsliste afvises", r1.rejected, r1.message);
  const r2 = await rejects(() => store.getSession(ses1.id), /tilhører en anden sælger/i);
  ok("en anden sælgers session kan ikke åbnes direkte", r2.rejected, r2.message);
  const r3 = await rejects(() => store.getProfile("KMA"), /kun (se )?dine egne/i);
  ok("en anden sælgers profil afvises", r3.rejected, r3.message);
  const r4 = await rejects(() => store.listAllSessions(), /salgsleder/i);
  ok("holdets sessioner kræver lederrolle", r4.rejected, r4.message);
  const r5 = await rejects(() => store.listProfiles(), /salgsleder/i);
  ok("holdets profiler kræver lederrolle", r5.rejected, r5.message);

  const jasSessioner = await store.listSessions();
  ok("den anden sælger ser sin egen tomme historik", jasSessioner.length === 0);
  const jasProfil = await store.getProfile();
  ok("den anden sælger får ikke KMA's profil", jasProfil === undefined);

  const r6 = await rejects(
    () => store.saveSession({ ...ses1Slut, id: "kapret", sellerId: "KMA" }),
    /kun gemmes af den sælger/i,
  );
  ok("man kan ikke gemme en session i en andens navn", r6.rejected, r6.message);

  store.setActiveSeller({ ...jas, role: "leder" });
  const holdet = await store.listAllSessions();
  ok("en leder kan se holdets sessioner", holdet.length >= 2, `${holdet.length}`);

  /* ================================================= 9 · Lækagetjek */
  section("9 · Lækagetjek på alt browseren har set");

  store.setActiveSeller(kma);
  const alleSvar = JSON.stringify(clientPayloads);
  ok("intet svar til browseren indeholder kundens skjulte fakta", !alleSvar.includes(MARK.hiddenFact));
  ok("intet svar til browseren indeholder den skjulte brief", !alleSvar.includes(MARK.hiddenBrief));
  ok(
    "intet svar til browseren indeholder systeminstruktionen",
    !alleSvar.includes("# SÆLGEREN — DIN HUKOMMELSE"),
  );
  const lager = localStorage._dump();
  ok("det lokale lager indeholder heller ikke skjulte fakta", !lager.includes(MARK.hiddenFact));
  ok(
    "det lokale lager indeholder ikke den skjulte brief",
    !lager.includes(MARK.hiddenBrief),
  );

  /* ------------------------------------------------------------- Resultat */
  console.log(`\n${"─".repeat(64)}`);
  if (failures.length === 0) {
    console.log(`\x1b[32mHele rejsen kørte igennem — alle ${pass} tjek bestod.\x1b[0m`);
    process.exit(0);
  }
  console.log(`\x1b[31m${failures.length} tjek fejlede\x1b[0m (${pass} bestod):`);
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

main().catch((e) => {
  console.error("\n\x1b[31mRejsen kunne ikke gennemføres:\x1b[0m", e);
  process.exit(1);
});
