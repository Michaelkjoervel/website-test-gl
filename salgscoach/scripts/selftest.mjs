// =============================================================================
// selftest · ende-til-ende-tjek af salgscoachens serverlag
// -----------------------------------------------------------------------------
// Kør:  node salgscoach/scripts/selftest.mjs
//
// Testen kalder ALDRIG OpenAI. Den lægger sig ind foran fetch og svarer som
// modellen ville — men den validerer til gengæld hårdt på det, vi selv styrer:
//
//   1. Hele sløjfen kører: manifest → scenarie → samtale → analyse → profil →
//      materiale → team → stemmesession.
//   2. Instruktionen der sendes til modellen indeholder rent faktisk
//      salgsmanualen, kundens skjulte oplysninger og sælgerens kendte svagheder.
//      (Ellers er coachen bare en generisk chatbot.)
//   3. Det svar browseren får, indeholder INTET af det. Hverken manualtekst,
//      skjulte kundefakta eller systeminstruktionen.
//   4. Alle JSON-skemaer er gyldige strict-skemaer, og de felter modellen
//      bliver bedt om, matcher datamodellen i src/lib/types.ts.
//
// Punkt 3 er den vigtigste: kan sælgeren læse kundens skjulte kort i
// netværksfanen, er hele rollespillet meningsløst.
// =============================================================================

import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = path.resolve(HERE, "../../api");

process.env.OPENAI_API_KEY = "sk-test-selftest";
process.env.COACH_SECRET = "selftest-hemmelighed";
process.env.ALLOW_ANONYMOUS = "1";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;

/* ----------------------------------------------------------- Testramme */

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

/* ------------------------------------------- Prøvesvar ud fra JSON-skema */

/** Byg et gyldigt objekt ud fra et JSON-skema, så vi tester skemaet selv. */
function sampleFromSchema(schema, key = "felt", depth = 0) {
  if (depth > 12) return null;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const type = types.find((t) => t !== "null") || "string";

  if (schema.enum) return schema.enum[0];

  switch (type) {
    case "object": {
      const out = {};
      const props = schema.properties || {};
      for (const [k, v] of Object.entries(props)) out[k] = sampleFromSchema(v, k, depth + 1);
      return out;
    }
    case "array": {
      const item = schema.items ? sampleFromSchema(schema.items, key, depth + 1) : "x";
      return [item];
    }
    case "number":
    case "integer":
      return 1;
    case "boolean":
      return true;
    default:
      return `prøve-${key}`;
  }
}

/** Kontrollér at et skema følger OpenAIs strict-regler. */
function checkStrictSchema(name, schema, problems = [], trail = "") {
  if (!schema || typeof schema !== "object") return problems;
  if (schema.type === "object") {
    if (schema.additionalProperties !== false) {
      problems.push(`${name}${trail}: additionalProperties mangler/er ikke false`);
    }
    const props = Object.keys(schema.properties || {});
    const required = schema.required || [];
    const missing = props.filter((p) => !required.includes(p));
    if (missing.length) {
      problems.push(`${name}${trail}: ikke i required → ${missing.join(", ")}`);
    }
    for (const [k, v] of Object.entries(schema.properties || {})) {
      checkStrictSchema(name, v, problems, `${trail}.${k}`);
    }
  }
  if (schema.type === "array" && schema.items) {
    checkStrictSchema(name, schema.items, problems, `${trail}[]`);
  }
  return problems;
}

/* ----------------------------------------------- Fetch-stub (ingen OpenAI) */

/** Alt der blev sendt til modellen — så vi kan kigge instruktionen efter. */
const sent = [];

function stubFetch() {
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const body = init.body && typeof init.body === "string" ? safeJson(init.body) : null;
    sent.push({ url: u, body, raw: typeof init.body === "string" ? init.body : "" });

    if (u.includes("/v1/realtime/client_secrets")) {
      return json({ value: "ek_selftest_hemmelig_noegle", expires_at: 1893456000, session: {} });
    }
    if (u.includes("/v1/realtime/sessions")) {
      return json({ client_secret: { value: "ek_selftest_beta" } });
    }
    if (u.includes("/v1/audio/speech")) {
      return new Response(new Uint8Array([0x49, 0x44, 0x33, 0x04]).buffer, { status: 200 });
    }
    if (u.includes("/v1/responses")) {
      const format = body?.text?.format;
      if (format?.type === "json_schema" && format.schema) {
        const raw = format.schema?.schema && format.schema?.name ? format.schema.schema : format.schema;
        return json({ output_text: JSON.stringify(sampleFromSchema(raw)) });
      }
      return json({ output_text: "Hvad sagde kunden helt præcist? Og hvordan ved du det?" });
    }
    return json({ error: { message: `uventet kald: ${u}` } }, 500);
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/* --------------------------------------------------- Falsk req/res til Vercel */

function invoke(handler, { method = "POST", body = {}, headers = {} } = {}) {
  return new Promise((resolve) => {
    const req = {
      method,
      headers: { authorization: "Bearer selftest", origin: "http://localhost:5174", ...headers },
      body,
    };
    const res = {
      statusCode: 200,
      headersSent: {},
      setHeader(k, v) {
        this.headersSent[k] = v;
      },
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

/* ------------------------------------------------------------------ Kør */

const SELLER_CONTEXT = {
  initials: "KMA",
  name: "Kim",
  sessionsCount: 7,
  narrative: "Stærk relationsopbygger, men går i løsningstilstand for tidligt.",
  strengths: [{ area: "kundefokus", statement: "Skaber hurtigt tillid", occurrences: 4 }],
  weaknesses: [
    {
      area: "konsekvens",
      statement: "GAAR_I_LOESNING_FOER_KONSEKVENS_ER_ETABLERET",
      occurrences: 5,
    },
  ],
  focusAreas: ["Bliv i konsekvensen"],
  recentHeadlines: ["Du fandt problemet, men prissatte det aldrig."],
};

async function main() {
  stubFetch();

  section("Indlæsning af servermoduler");
  const manual = await import(path.join(API, "_manual.mjs"));
  const coachCore = await import(path.join(API, "_coach.mjs"));
  const prompt = await import(path.join(API, "_coachprompt.mjs"));
  const personas = await import(path.join(API, "_personas.mjs"));
  const greenlight = await import(path.join(API, "_greenlight.mjs"));
  const coach = (await import(path.join(API, "coach.js"))).default;
  const coachSession = (await import(path.join(API, "coach-session.js"))).default;
  const coachSpeak = (await import(path.join(API, "coach-speak.js"))).default;
  ok("alle moduler kan indlæses", true);

  /* ------------------------------------------------------------ Manualen */
  section("Salgsmanualen");
  ok("20 kapitler", manual.CHAPTERS.length === 20, `fandt ${manual.CHAPTERS.length}`);
  ok("mindst 30 principper", manual.PRINCIPLES.length >= 30, `fandt ${manual.PRINCIPLES.length}`);
  ok(
    "hvert princip har antimønstre (coachens radar)",
    manual.PRINCIPLES.every((p) => Array.isArray(p.antiPatterns) && p.antiPatterns.length > 0),
  );
  ok(
    "manifestet indeholder ingen manualprosa",
    !JSON.stringify(manual.manualManifest()).includes("Kunden køber ikke LED"),
  );
  ok(
    "manualkontekst indeholder manualens egne formuleringer",
    manual.renderManualContext({ modeId: "afdaekning" }).includes("konsekvens"),
  );

  /* -------------------------------------------------------------- Skemaer */
  section("JSON-skemaer (OpenAI strict)");
  for (const [name, schema] of [
    ["FEEDBACK_SCHEMA", prompt.FEEDBACK_SCHEMA],
    ["SCENARIO_SCHEMA", prompt.SCENARIO_SCHEMA],
    ["PROFILE_SCHEMA", prompt.PROFILE_SCHEMA],
    ["MATERIAL_SCHEMA", prompt.MATERIAL_SCHEMA],
    ["TEAM_SCHEMA", prompt.TEAM_SCHEMA],
  ]) {
    const raw = schema?.schema && schema?.name ? schema.schema : schema;
    const problems = checkStrictSchema(name, raw);
    ok(`${name} er et gyldigt strict-skema`, problems.length === 0, problems.slice(0, 3).join(" · "));
  }

  /* ------------------------------------------------------ Træningsformer */
  section("Træningsformer");
  const REQUIRED_MODES = [
    "kunderollespil", "afdaekning", "indvendinger", "salgsmoede", "telefon",
    "kvalificering", "naeste-skridt", "forhandling", "forberedelse", "debriefing",
    "tilbudsopfoelgning", "lynild", "manualeksamen", "fri-coaching", "materialepraesentation",
  ];
  const modeIds = prompt.MODES.map((m) => m.id);
  const missingModes = REQUIRED_MODES.filter((m) => !modeIds.includes(m));
  ok("alle 15 træningsformer findes", missingModes.length === 0, missingModes.join(", "));
  ok("tre coach-tilstande", prompt.COACH_MODES.length === 3);
  ok(
    "hybrid er standard for rollespillet",
    prompt.MODES.find((m) => m.id === "kunderollespil")?.defaultCoachMode === "hybrid",
  );
  ok(
    "hver træningsform peger på rigtige manualprincipper",
    prompt.MODES.every((m) =>
      (m.manualRefs || []).every((r) => manual.PRINCIPLES.some((p) => p.id === r)),
    ),
    prompt.MODES.flatMap((m) => (m.manualRefs || []).filter((r) => !manual.PRINCIPLES.some((p) => p.id === r))).join(", "),
  );

  /* ------------------------------------------------------------- Personaer */
  section("Kundepersonaer");
  ok("mindst 12 personaer", personas.PERSONAS.length >= 12, `fandt ${personas.PERSONAS.length}`);
  ok(
    "alle personaer har skjult information",
    personas.PERSONAS.every((p) => Array.isArray(p.hidden) && p.hidden.length >= 4),
  );
  const manifestText = JSON.stringify(personas.personaManifest());
  const leaked = personas.PERSONAS.filter((p) =>
    (p.hidden || []).some((h) => manifestText.includes(String(h.fact).slice(0, 40))),
  );
  ok("persona-manifestet lækker ingen skjulte fakta", leaked.length === 0, leaked.map((p) => p.id).join(", "));

  /* ------------------------------------------------------------- Manifest */
  section("Endepunkt: manifest");
  const manifest = await invoke(coach, { body: { action: "manifest" } });
  ok("svarer 200", manifest.status === 200, JSON.stringify(manifest.payload).slice(0, 160));
  ok("indeholder træningsformer", (manifest.payload?.modes || []).length >= 14);
  ok(
    "manifestet indeholder ingen manualprosa",
    !JSON.stringify(manifest.payload).includes("HOLD KÆFT"),
  );

  /* ------------------------------------------------------------- Scenarie */
  section("Endepunkt: scenarie");
  sent.length = 0;
  const scen = await invoke(coach, {
    body: {
      action: "scenarie",
      modeId: "kunderollespil",
      config: { industry: "Produktion", difficulty: "haard", auto: false },
      sellerContext: SELLER_CONTEXT,
      language: "da",
    },
  });
  ok("svarer 200", scen.status === 200, JSON.stringify(scen.payload).slice(0, 200));
  ok("returnerer et scenarie", Boolean(scen.payload?.scenario));
  ok("returnerer en forseglet hiddenBlob", typeof scen.payload?.hiddenBlob === "string" && scen.payload.hiddenBlob.startsWith("v1."));

  const blob = scen.payload?.hiddenBlob;
  const opened = blob ? coachCore.openHidden(blob) : null;
  ok("serveren kan åbne sin egen forsegling", opened !== null);
  ok("forseglingen er ulæselig i klartekst", !String(blob).includes("hidden") && !String(blob).includes("fact"));
  ok("ændret forsegling afvises", coachCore.openHidden(String(blob).slice(0, -4) + "AAAA") === null);
  ok(
    "svaret til browseren indeholder ikke hiddenBrief",
    !JSON.stringify(scen.payload?.scenario || {}).includes("hiddenBrief"),
  );

  /* -------------------------------------------------------------- Samtale */
  section("Endepunkt: samtale — hvad får modellen at vide?");
  sent.length = 0;
  const talk = await invoke(coach, {
    body: {
      action: "samtale",
      modeId: "kunderollespil",
      coachMode: "hybrid",
      language: "da",
      scenario: scen.payload?.scenario,
      hiddenBlob: blob,
      sellerContext: SELLER_CONTEXT,
      messages: [{ role: "saelger", text: "Hej, jeg ringer fra green light. Vil I have nyt lys?" }],
    },
  });
  ok("svarer 200", talk.status === 200, JSON.stringify(talk.payload).slice(0, 200));
  ok("returnerer en replik", typeof talk.payload?.reply === "string" && talk.payload.reply.length > 0);

  const modelCall = sent.find((s) => s.url.includes("/v1/responses"));
  const instructions = String(modelCall?.body?.instructions || "");
  ok("modellen får en systeminstruktion", instructions.length > 500, `${instructions.length} tegn`);
  ok(
    "instruktionen indeholder salgsmanualen",
    /salgsmanual/i.test(instructions),
  );
  ok(
    "instruktionen indeholder sælgerens kendte svaghed",
    instructions.includes("GAAR_I_LOESNING_FOER_KONSEKVENS_ER_ETABLERET"),
  );
  ok(
    "browseren får IKKE systeminstruktionen retur",
    !JSON.stringify(talk.payload).includes("salgsmanual") &&
      !JSON.stringify(talk.payload).includes("GAAR_I_LOESNING"),
  );

  /* --------------------------------------------------------------- Analyse */
  section("Endepunkt: analyse");
  const analysis = await invoke(coach, {
    body: {
      action: "analyse",
      modeId: "kunderollespil",
      coachMode: "hybrid",
      language: "da",
      scenario: scen.payload?.scenario,
      hiddenBlob: blob,
      sellerContext: SELLER_CONTEXT,
      messages: [
        { role: "saelger", text: "Hvad koster jeres el om året?" },
        { role: "kunde", text: "Det ved jeg ikke lige." },
      ],
      durationSec: 420,
    },
  });
  ok("svarer 200", analysis.status === 200, JSON.stringify(analysis.payload).slice(0, 200));
  const fb = analysis.payload?.feedback;
  const REQUIRED_FEEDBACK = [
    "overall", "headline", "didWell", "heldBack", "missed",
    "iWouldHaveDone", "focusNextTime", "categories", "factCheck", "manualReferences",
  ];
  const missingFb = REQUIRED_FEEDBACK.filter((k) => !(k in (fb || {})));
  ok("feedback har alle påkrævede blokke", missingFb.length === 0, missingFb.join(", "));
  ok(
    "feedback adskiller fakta og antagelser",
    Boolean(fb?.factCheck && "facts" in fb.factCheck && "assumptions" in fb.factCheck),
  );

  /* ---------------------------------------------------- Profil / materiale / team */
  section("Endepunkter: profil, materiale, team");
  const prof = await invoke(coach, {
    body: {
      action: "profil",
      initials: "KMA",
      previousProfile: null,
      sessions: [{ id: "s1", date: "2026-08-01", modeId: "kunderollespil", focus: [], durationMin: 7, categories: [] }],
    },
  });
  ok("profil svarer 200", prof.status === 200, JSON.stringify(prof.payload).slice(0, 160));
  ok("profil returnerer mønstre", Array.isArray(prof.payload?.profile?.weaknesses));

  const mat = await invoke(coach, {
    body: {
      action: "materiale",
      text: "Tilbud på LED-armaturer. Pris 480.000 kr. Vi leverer høj kvalitet.",
      customerContext: "Produktionsvirksomhed, 8.000 m²",
      sellerContext: SELLER_CONTEXT,
    },
  });
  ok("materiale svarer 200", mat.status === 200, JSON.stringify(mat.payload).slice(0, 160));
  ok("materiale returnerer en analyse", Boolean(mat.payload?.analysis?.sections));

  const team = await invoke(coach, {
    body: {
      action: "team",
      profiles: [{ sellerId: "u1", initials: "KMA", narrative: "", weaknesses: [], strengths: [], signals: {}, recommended: [], manualGaps: [], ownGoals: [], sessionsCount: 7, totalMinutes: 60, updatedAt: "2026-08-01" }],
      sessions: [{ id: "s1", date: "2026-08-01", modeId: "kunderollespil", focus: [], durationMin: 7, categories: [], initials: "KMA" }],
    },
  });
  ok("team svarer 200", team.status === 200, JSON.stringify(team.payload).slice(0, 160));

  /* --------------------------------------------------------- Stemmesession */
  section("Endepunkt: stemmesession");
  sent.length = 0;
  const voice = await invoke(coachSession, {
    body: {
      modeId: "kunderollespil",
      coachMode: "hybrid",
      language: "da",
      scenario: scen.payload?.scenario,
      hiddenBlob: blob,
      sellerContext: SELLER_CONTEXT,
    },
  });
  ok("svarer 200", voice.status === 200, JSON.stringify(voice.payload).slice(0, 200));
  ok("udleverer en midlertidig nøgle", String(voice.payload?.clientSecret || "").startsWith("ek_"));

  const mintCall = sent.find((s) => s.url.includes("client_secrets"));
  const rtInstructions = String(mintCall?.body?.session?.instructions || "");
  ok("instruktionen bages ind server-side", rtInstructions.length > 500, `${rtInstructions.length} tegn`);
  ok("realtime får talt-sprog-regler", /kort|talt|sætning/i.test(rtInstructions));
  ok(
    "browseren får ikke instruktionen retur",
    !JSON.stringify(voice.payload).includes("SALGSMANUAL") &&
      JSON.stringify(voice.payload).length < 2000,
  );

  const speakRes = await invoke(coachSpeak, { body: { text: "Hvad sagde kunden præcist?" } });
  ok("talesyntese svarer 200", speakRes.status === 200, JSON.stringify(speakRes.payload).slice(0, 160));

  /* ------------------------------------------------------------- Afvisning */
  section("Afvisninger");
  const bad = await invoke(coach, { body: { action: "findes-ikke" } });
  ok("ukendt action afvises", bad.status === 400);
  const get = await invoke(coach, { method: "GET" });
  ok("GET giver status", get.status === 200);
  const put = await invoke(coach, { method: "PUT" });
  ok("PUT afvises", put.status === 405);

  /* ---------------------------------------------------------- green light */
  section("green light-viden");
  ok("videnbasen har indhold", greenlight.KNOWLEDGE.length >= 15, `fandt ${greenlight.KNOWLEDGE.length}`);
  ok(
    "al viden er oversat til kundeudbytte",
    greenlight.KNOWLEDGE.every((k) => String(k.customerOutcome || "").length > 20),
  );
  ok("cases er markeret som vejledende", greenlight.CASES.every((c) => c.indicative === true));

  /* ------------------------------------------------------------- Resultat */
  console.log(`\n${"─".repeat(60)}`);
  if (failures.length === 0) {
    console.log(`\x1b[32mAlle ${pass} tjek bestod.\x1b[0m`);
    process.exit(0);
  }
  console.log(`\x1b[31m${failures.length} tjek fejlede\x1b[0m (${pass} bestod):`);
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}

main().catch((e) => {
  console.error("\n\x1b[31mSelftesten kunne ikke gennemføres:\x1b[0m", e);
  process.exit(1);
});
