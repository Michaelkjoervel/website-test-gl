// =============================================================================
// api/_coachprompt.mjs · green light Salgscoach — coachens hjerne
// -----------------------------------------------------------------------------
// KUN SERVER-SIDE. Filen importeres udelukkende af Vercel-funktionerne
// (api/coach.js, api/coach-session.js) og bliver ALDRIG bundtet ind i den
// offentlige browser-JavaScript. Den indeholder green lights salgsmetodik
// oversat til adfærd — den skal ikke kunne læses af udefrakommende.
//
// Filnavn starter med "_" så Vercel ikke gør den til en HTTP-rute.
//
// Her bor:
//   MODES                  – de 15 træningsformer (matcher TrainingMode i types.ts)
//   COACH_MODES            – realistisk / coach / hybrid (matcher CoachModeSpec)
//   EXTERNAL_FRAMEWORKS    – ekstern salgsteori coachen MÅ bruge — men kun højt
//   buildSystemInstructions/buildAnalysisInstructions/... – prompterne
//   FEEDBACK_SCHEMA m.fl.  – OpenAI structured outputs (strict:true)
//
// Grundprincippet i hele filen: MANUALEN FØRST. Coachen citerer green lights
// egne formuleringer frem for at parafrasere, og enhver ekstern model skal
// markeres eksplicit, når den bringes i spil.
// =============================================================================

import {
  MANUAL_META,
  PRINCIPLES,
  SCRIPTS,
  CHECKLISTS,
  renderManualContext,
  renderFullManualOutline,
} from "./_manual.mjs";
import { renderKnowledgeContext, selectKnowledge } from "./_greenlight.mjs";
import { renderPersonaInstructions } from "./_personas.mjs";

/* ===========================================================================
 * 0 · SMÅ HJÆLPERE
 * =========================================================================*/

/** Er sproget engelsk? Alt andet end "en" behandles som dansk. */
function isEn(language) {
  return String(language || "da").toLowerCase().startsWith("en");
}

/** Fjern tomme blokke og bind dem sammen med tydelig luft. */
function joinBlocks(...blocks) {
  return blocks
    .flat()
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}

/** "- a\n- b" — bruges KUN i instruktionsteksten, aldrig i coachens tale. */
function bullets(list) {
  return (list || [])
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .map((x) => `- ${x}`)
    .join("\n");
}

/** Kald en importeret funktion uden at vælte prompten hvis den fejler. */
function safe(fn, fallback = "") {
  try {
    const v = fn();
    return typeof v === "string" ? v : v == null ? fallback : String(v);
  } catch {
    return fallback;
  }
}

/** Klip lange fritekster/JSON så prompten ikke eksploderer. */
function clip(text, max = 6000) {
  const s = String(text || "").trim();
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max)}\n… [afkortet — ${s.length - max} tegn udeladt]`;
}

/** Data ind i prompten som JSON, altid afkortet. */
function jsonBlock(value, max = 8000) {
  try {
    return clip(JSON.stringify(value, null, 2), max);
  } catch {
    return "";
  }
}

/** Nøgleord til at hente de rigtige manual-principper og den rigtige viden frem. */
function harvestKeywords(...sources) {
  const words = new Set();
  const push = (v) => {
    if (!v) return;
    if (Array.isArray(v)) return v.forEach(push);
    if (typeof v === "object") return Object.values(v).forEach(push);
    String(v)
      .toLowerCase()
      .split(/[^a-zA-Z0-9æøåÆØÅ-]+/)
      .filter((w) => w.length > 3)
      .slice(0, 400)
      .forEach((w) => words.add(w));
  };
  sources.forEach(push);
  return [...words].slice(0, 60);
}

/** Titler på relevant green light-viden — bruges kun som let hint, fejler stille. */
function knowledgeTitles({ keywords = [], industry = "", limit = 6 } = {}) {
  try {
    const res = selectKnowledge({ keywords, industry, limit });
    const arr = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
    return arr.map((i) => i?.title).filter(Boolean).slice(0, limit);
  } catch {
    return [];
  }
}

/* ===========================================================================
 * 1 · TRÆNINGSFORMER (MODES)
 * -----------------------------------------------------------------------
 * Matcher TrainingMode i salgscoach/src/lib/types.ts 1:1.
 * feedbackAreas indeholder KUN de SkillArea-værdier der reelt kan bedømmes i
 * netop den øvelse — coachen må ikke score kategorier øvelsen ikke træner.
 * manualRefs peger på rigtige principle-id'er i _manual.mjs.
 * =========================================================================*/

export const MODES = [
  {
    id: "kunderollespil",
    order: 1,
    title: "Kunderollespil",
    tagline: "Et helt kundemøde — uden sikkerhedsnet",
    description:
      "Du sidder over for en rigtig kunde med en rigtig dagsorden, egne interesser og information hun ikke giver væk gratis. Samtalen kører fra første hilsen til aftalt næste skridt, og kunden hjælper dig ikke.",
    trains: [
      "At styre en hel samtale uden at miste kontrollen",
      "At få kunden til at tale mere end dig",
      "At bevæge dig fra problem til konsekvens før du taler løsning",
      "At lande et konkret næste skridt inden I skilles",
    ],
    counterpart: "kunde",
    defaultCoachMode: "hybrid",
    minutes: [10, 25],
    usesScenario: true,
    feedbackAreas: [
      "afdaekning",
      "spoergeteknik",
      "lytning",
      "konsekvens",
      "vaerdiskabelse",
      "kundefokus",
      "indvendinger",
      "naeste-skridt",
      "taletid",
    ],
    manualRefs: [
      "p1-loesning-ikke-armatur",
      "p5-spoerg-foer-du-pitcher",
      "p5-spc-vaerdi",
      "p9-delaccept",
      "p12-stilhed",
      "p4-next-step",
    ],
    icon: "user-round",
  },
  {
    id: "afdaekning",
    order: 2,
    title: "Behovsafdækning",
    tagline: "Spørg til du kan mærke konsekvensen",
    description:
      "Ren afdækningstræning. Ingen løsning, ingen pris, ingen præsentation. Du har én opgave: at forstå kundens situation så godt, at kunden selv sætter ord på hvad problemet koster.",
    trains: [
      "Situation → Problem → Konsekvens → Værdi i praksis",
      "At blive i et svar i stedet for at gå videre til næste spørgsmål",
      "At spørge fordi du har brug for svaret — ikke fordi du kører en liste",
      "At lytte og bruge kundens egne ord tilbage",
    ],
    counterpart: "kunde",
    defaultCoachMode: "hybrid",
    minutes: [10, 20],
    usesScenario: true,
    feedbackAreas: [
      "afdaekning",
      "spoergeteknik",
      "lytning",
      "konsekvens",
      "kommerciel-nysgerrighed",
      "kundefokus",
      "taletid",
    ],
    manualRefs: [
      "p5-spoerg-foer-du-pitcher",
      "p5-spc-vaerdi",
      "p2-lyt",
      "p1-udbytteord",
      "p5-budgetspoergsmaal",
    ],
    icon: "search",
  },
  {
    id: "indvendinger",
    order: 3,
    title: "Indvendinger",
    tagline: "Samme indvending — indtil du håndterer den",
    description:
      "Kunden kommer med én indvending ad gangen, og du slipper ikke videre ved at svare hurtigt. Er svaret svagt, bliver presset hårdere på præcis den samme indvending.",
    trains: [
      "At anerkende før du svarer",
      "At grave dybere i stedet for at modargumentere",
      "At flytte prissamtalen til konsekvens og totaløkonomi",
      "At holde fast i slutbrugeren når du skubbes mod rådgiver eller elektriker",
    ],
    counterpart: "kunde",
    defaultCoachMode: "hybrid",
    minutes: [10, 20],
    usesScenario: true,
    feedbackAreas: [
      "indvendinger",
      "udfordring",
      "selvsikkerhed",
      "konsekvens",
      "vaerdiskabelse",
      "klarhed",
      "spoergeteknik",
    ],
    manualRefs: [
      "p14-svar-aldrig-for-hurtigt",
      "p8-for-dyrt",
      "p8-usikkerhed-om-billigt",
      "p8-aldrig-kun-pris",
      "p15-hold-fast-i-slutbrugeren",
      "p2-send-noget-paa-mail",
    ],
    icon: "shield-alert",
  },
  {
    id: "salgsmoede",
    order: 4,
    title: "Det første møde",
    tagline: "Åbning, agenda, styring, næste skridt",
    description:
      "Hele førstemødet fra “tak fordi jeg måtte komme” til aftalen om næste skridt. Sætter du ikke agendaen, tager kunden den — og så handler mødet om produkter og pris.",
    trains: [
      "Mødeåbningen der fjerner sælgerpres",
      "Agenda og styring gennem hele mødet",
      "At bruge mødet på at få at vide, ikke på at fortælle",
      "Budget, beslutningsproces og prioritet som normal forretningsdialog",
    ],
    counterpart: "kunde",
    defaultCoachMode: "hybrid",
    minutes: [20, 40],
    usesScenario: true,
    feedbackAreas: [
      "forberedelse",
      "afdaekning",
      "spoergeteknik",
      "konsekvens",
      "beslutningsproces",
      "kvalificering",
      "naeste-skridt",
      "klarhed",
      "taletid",
    ],
    manualRefs: [
      "p4-moedets-formaal",
      "p4-start-og-agenda",
      "p5-spc-vaerdi",
      "p7-hvor-deals-doer",
      "p12-luk-processen",
      "p4-next-step",
    ],
    icon: "presentation",
  },
  {
    id: "telefon",
    order: 5,
    title: "Kold canvas",
    tagline: "De første ti sekunder afgør det",
    description:
      "Et koldt opkald til en travl person der ikke bad om at blive ringet op. Du skal ikke sælge i telefonen — du skal skabe nysgerrighed nok til at få et møde.",
    trains: [
      "En relevant åbning der ikke lyder som alle andre",
      "At håndtere “send noget på mail” uden at give op",
      "At foreslå et kort, konkret møde med lav modstand og en ærlig exit",
      "At tåle et nej og komme videre",
    ],
    counterpart: "kunde",
    defaultCoachMode: "realistisk",
    minutes: [5, 12],
    usesScenario: true,
    feedbackAreas: [
      "klarhed",
      "selvsikkerhed",
      "kommerciel-nysgerrighed",
      "spoergeteknik",
      "indvendinger",
      "naeste-skridt",
    ],
    manualRefs: [
      "p2-canvas",
      "p2-send-noget-paa-mail",
      "p1-differentiering",
      "p2-rigtige-kunder",
    ],
    icon: "phone",
  },
  {
    id: "kvalificering",
    order: 6,
    title: "Kvalificering",
    tagline: "Er sagen reel — eller er den et håb?",
    description:
      "Ikke rollespil. Salgsdirektøren gennemgår din opportunity punkt for punkt og accepterer ikke ét eneste “det tror jeg”. Til sidst får du et billede af hvad du ved, hvad du antager, og hvad der skal være sandt før sagen er værd at investere i.",
    trains: [
      "Manualens syv krav før stor indsats",
      "At skelne fakta fra antagelser i din egen sag",
      "At se advarselstegnene i tide",
      "At bede om commitment før du bruger ressourcer",
    ],
    counterpart: "salgsdirektoer",
    defaultCoachMode: "coach",
    minutes: [10, 20],
    usesScenario: false,
    feedbackAreas: [
      "kvalificering",
      "beslutningsproces",
      "opportunity-styring",
      "konsekvens",
      "kommerciel-nysgerrighed",
      "udfordring",
    ],
    manualRefs: [
      "p3-kvalificer-tidligt",
      "p3-syv-krav",
      "p3-advarselstegn",
      "p3-commitment-foer-ressourcer",
      "p7-hvor-deals-doer",
      "p6-koebssignaler",
      "p20-checklister",
    ],
    icon: "filter",
    intakePrompt:
      "Beskriv den sag vi skal kvalificere: virksomhed, branche, hvem du har talt med, hvad de faktisk har sagt, hvor sagen står nu, hvilke tal du har — og hvad du selv er mest usikker på. Skriv det du VED, ikke det du håber.",
  },
  {
    id: "naeste-skridt",
    order: 7,
    title: "Næste skridt",
    tagline: "Ingen går herfra med “vi tales ved”",
    description:
      "Kunden er venlig, positiv og fuldstændig passiv. Din opgave er at lande et næste skridt med en handling, en ejer, en dato og et formål — inden samtalen slutter.",
    trains: [
      "Manualens vigtigste spørgsmål om næste skridt",
      "Delaccept og små ja'er undervejs",
      "Pilotprojektet som måden at gøre beslutningen mindre",
      "At holde kæft efter closing-spørgsmålet",
    ],
    counterpart: "kunde",
    defaultCoachMode: "hybrid",
    minutes: [8, 15],
    usesScenario: true,
    feedbackAreas: [
      "naeste-skridt",
      "afslutning",
      "beslutningsproces",
      "selvsikkerhed",
      "klarhed",
      "udfordring",
    ],
    manualRefs: [
      "p4-next-step",
      "p6-det-vigtigste-spoergsmaal",
      "p12-luk-processen",
      "p12-stilhed",
      "p9-delaccept",
      "p11-pilot",
    ],
    icon: "arrow-right-circle",
  },
  {
    id: "forhandling",
    order: 8,
    title: "Pris og forhandling",
    tagline: "Konkurrér aldrig kun på pris",
    description:
      "Du sidder over for en der vil have rabat, har et billigere tilbud i skuffen og ved præcis hvordan man presser en sælger. Ordet “kvalitet” redder dig ikke.",
    trains: [
      "At finde ud af hvad kunden reelt sammenligner med",
      "At flytte samtalen fra indkøbspris til risiko og totaløkonomi",
      "Aldrig at give en indrømmelse uden en modydelse",
      "At kunne sige nej og stadig have sagen",
    ],
    counterpart: "kunde",
    defaultCoachMode: "hybrid",
    minutes: [10, 20],
    usesScenario: true,
    feedbackAreas: [
      "forhandling",
      "indvendinger",
      "vaerdiskabelse",
      "konsekvens",
      "selvsikkerhed",
      "udfordring",
      "afslutning",
    ],
    manualRefs: [
      "p8-aldrig-kun-pris",
      "p8-usikkerhed-om-billigt",
      "p8-for-dyrt",
      "p5-budgetspoergsmaal",
      "p11-pilot",
      "p12-stilhed",
    ],
    icon: "handshake",
  },
  {
    id: "forberedelse",
    order: 9,
    title: "Mødeforberedelse",
    tagline: "Hvad ved du, og hvad gætter du?",
    description:
      "Salgsdirektøren forbereder dig på et møde du snart skal til. Du skal formulere din åbning og din agenda højt, og du bliver rettet indtil de sidder.",
    trains: [
      "At adskille det du ved fra det du antager før mødet",
      "At definere ét mål og de tre spørgsmål du SKAL have svar på",
      "Mødeåbning og agenda ordret",
      "At beslutte hvor meget indsats sagen berettiger",
    ],
    counterpart: "salgsdirektoer",
    defaultCoachMode: "coach",
    minutes: [8, 15],
    usesScenario: false,
    feedbackAreas: [
      "forberedelse",
      "kvalificering",
      "beslutningsproces",
      "opportunity-styring",
      "kommerciel-nysgerrighed",
      "klarhed",
    ],
    manualRefs: [
      "p4-moedets-formaal",
      "p4-start-og-agenda",
      "p3-syv-krav",
      "p2-canvas",
      "p20-checklister",
    ],
    icon: "clipboard-list",
    intakePrompt:
      "Beskriv mødet du skal til: virksomhed, hvem der deltager, hvordan mødet er kommet i stand, hvad du ved om dem, hvad du vil opnå — og hvad du er mest usikker på.",
  },
  {
    id: "debriefing",
    order: 10,
    title: "Debriefing",
    tagline: "Vi genopbygger mødet — ikke dit referat",
    description:
      "Du har været til møde. Salgsdirektøren accepterer ikke et resumé, men bygger mødet op igen replik for replik, indtil det bliver tydeligt hvor sagen blev vundet eller tabt.",
    trains: [
      "At huske og gengive hvad kunden faktisk sagde",
      "At se hvor du gik videre for tidligt",
      "At omsætte mødet til fakta, antagelser og videnshuller",
      "At sikre at næste skridt reelt er aftalt",
    ],
    counterpart: "salgsdirektoer",
    defaultCoachMode: "coach",
    minutes: [10, 20],
    usesScenario: false,
    feedbackAreas: [
      "afdaekning",
      "lytning",
      "kvalificering",
      "konsekvens",
      "beslutningsproces",
      "naeste-skridt",
      "opportunity-styring",
    ],
    manualRefs: [
      "p2-lyt",
      "p5-spc-vaerdi",
      "p3-syv-krav",
      "p6-koebssignaler",
      "p4-next-step",
      "p20-checklister",
    ],
    icon: "rewind",
    intakePrompt:
      "Hvilket møde skal vi gennemgå? Virksomhed, hvem du talte med, hvornår det var, og hvad du selv mener der kom ud af det.",
  },
  {
    id: "tilbudsopfoelgning",
    order: 11,
    title: "Tilbudsopfølgning",
    tagline: "Aldrig “har du set mit tilbud?”",
    description:
      "Tilbuddet er sendt, og der er stille. Du ringer op — og du har ét forsøg på at skabe fremdrift i stedet for at bede om en status.",
    trains: [
      "Opfølgning med indhold i stedet for status",
      "At bringe ny værdi ind: beregning, risiko, demo, case, driftsperspektiv",
      "Det direkte spørgsmål: hvad holder jer egentlig tilbage?",
      "Deal rescue når andre har taget over",
    ],
    counterpart: "kunde",
    defaultCoachMode: "hybrid",
    minutes: [8, 15],
    usesScenario: true,
    feedbackAreas: [
      "naeste-skridt",
      "opportunity-styring",
      "udfordring",
      "indvendinger",
      "vaerdiskabelse",
      "afslutning",
    ],
    manualRefs: [
      "p13-opfoelgning",
      "p16-deal-rescue",
      "p14-svar-aldrig-for-hurtigt",
      "p15-hold-fast-i-slutbrugeren",
      "p4-next-step",
    ],
    icon: "mail-check",
    intakePrompt:
      "Beskriv tilbuddet: hvad har du sendt, til hvem, hvornår, hvad indeholdt det, hvad var aftalt som næste skridt — og hvad er der sket siden.",
  },
  {
    id: "lynild",
    order: 12,
    title: "Lynild",
    tagline: "Korte spørgsmål. Ingen betænkningstid.",
    description:
      "Salgsdirektøren fyrer korte, hårde spørgsmål og kundereplikker af i højt tempo. Du svarer med det samme. Svage svar bliver angrebet på stedet — og du får det samme igen.",
    trains: [
      "At have manualens svar i rygraden, ikke i noterne",
      "At svare kort og skarpt under pres",
      "At undgå fyldord og undskyldninger",
      "Reflekser på de indvendinger der kommer hver eneste uge",
    ],
    counterpart: "salgsdirektoer",
    defaultCoachMode: "coach",
    minutes: [5, 10],
    usesScenario: false,
    feedbackAreas: [
      "spoergeteknik",
      "selvsikkerhed",
      "klarhed",
      "indvendinger",
      "kvalificering",
      "udfordring",
    ],
    manualRefs: [
      "p8-for-dyrt",
      "p2-send-noget-paa-mail",
      "p14-svar-aldrig-for-hurtigt",
      "p3-syv-krav",
      "p6-det-vigtigste-spoergsmaal",
      "p13-opfoelgning",
      "p12-stilhed",
    ],
    icon: "zap",
  },
  {
    id: "manualeksamen",
    order: 13,
    title: "Manualeksamen",
    tagline: "Ikke hvad der står — men hvad du gør",
    description:
      "Ingen udenadslære. Du får rigtige situationer fra hverdagen, og du skal sige hvad du gør og hvorfor. Din begrundelse bliver udfordret, også når svaret er rigtigt.",
    trains: [
      "At anvende manualen i en konkret situation",
      "At kunne forsvare hvorfor green light gør som vi gør",
      "At kende de tre porte i salgschecklisten",
      "At mærke forskel på at kunne citere og at kunne bruge",
    ],
    counterpart: "salgsdirektoer",
    defaultCoachMode: "coach",
    minutes: [10, 20],
    usesScenario: false,
    feedbackAreas: [
      "kvalificering",
      "afdaekning",
      "konsekvens",
      "indvendinger",
      "beslutningsproces",
      "klarhed",
      "udfordring",
    ],
    manualRefs: [
      "p1-loesning-ikke-armatur",
      "p3-syv-krav",
      "p5-spc-vaerdi",
      "p8-aldrig-kun-pris",
      "p14-svar-aldrig-for-hurtigt",
      "p15-hold-fast-i-slutbrugeren",
      "p18-kan-tor-vil-gor",
      "p20-checklister",
    ],
    icon: "graduation-cap",
  },
  {
    id: "fri-coaching",
    order: 14,
    title: "Fri coaching",
    tagline: "Tag en sag med — så graver vi",
    description:
      "Åben samtale med salgsdirektøren om en konkret sag, en kunde du er gået i stå med, eller noget du selv gerne vil presses på. Du får ikke ros for at have taget den op.",
    trains: [
      "At sætte ord på hvad der reelt blokerer",
      "At skelne mellem Kan, Tør, Vil og Gør",
      "At beslutte hvad du gør konkret i morgen",
      "At turde gå efter et nej frem for at leve på et håb",
    ],
    counterpart: "salgsdirektoer",
    defaultCoachMode: "coach",
    minutes: [5, 30],
    usesScenario: false,
    feedbackAreas: [
      "opportunity-styring",
      "kommerciel-nysgerrighed",
      "udfordring",
      "kvalificering",
      "klarhed",
    ],
    manualRefs: [
      "p18-kan-tor-vil-gor",
      "p16-deal-rescue",
      "p3-kvalificer-tidligt",
      "p2-rigtige-kunder",
      "p15-hold-fast-i-slutbrugeren",
    ],
    icon: "message-circle-question",
    intakePrompt:
      "Hvad vil du gerne have hjælp til? Skriv situationen så konkret du kan — gerne med hvad kunden faktisk har sagt, ordret.",
  },
  {
    id: "materialepraesentation",
    order: 15,
    title: "Materialepræsentation",
    tagline: "Forsvar dit eget materiale",
    description:
      "Du har uploadet et tilbud, en præsentation eller en business case. Nu skal du præsentere den højt og forsvare hver påstand, mens salgsdirektøren stiller de spørgsmål kunden vil stille.",
    trains: [
      "At knytte materialet til det kunden faktisk har sagt",
      "At oversætte teknik til udbytte",
      "At kunne dokumentere kort i stedet for at gennemgå alt",
      "At give kunden noget han kan sælge videre internt",
    ],
    counterpart: "salgsdirektoer",
    defaultCoachMode: "coach",
    minutes: [10, 25],
    usesScenario: false,
    feedbackAreas: [
      "vaerdiskabelse",
      "kundefokus",
      "konsekvens",
      "klarhed",
      "beslutningsproces",
      "naeste-skridt",
      "forberedelse",
    ],
    manualRefs: [
      "p10-praesentationsstruktur",
      "p1-loesning-ikke-armatur",
      "p1-udbytteord",
      "p8-usikkerhed-om-billigt",
      "p5-spc-vaerdi",
      "p4-next-step",
    ],
    icon: "file-text",
    hidden: true,
    intakePrompt:
      "Hvilken kunde er materialet lavet til, og hvad er formålet med præsentationen?",
  },
];

/** Slå en træningsform op. Ukendt id falder tilbage på fri coaching. */
export function getMode(modeId) {
  return MODES.find((m) => m.id === modeId) || MODES.find((m) => m.id === "fri-coaching");
}

// Selvkontrol: manualRefs skal pege på principper der findes. Fejler stille i
// produktion, men råber i logget så en manual-ændring ikke tavst brækker prompten.
(() => {
  const ids = new Set(PRINCIPLES.map((p) => p.id));
  const bad = [];
  for (const m of MODES) for (const r of m.manualRefs) if (!ids.has(r)) bad.push(`${m.id} → ${r}`);
  if (bad.length) console.warn("[_coachprompt] ukendte manual-principper:", bad.join(", "));
})();
