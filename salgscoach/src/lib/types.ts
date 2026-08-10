// =============================================================================
// types · datamodellen for green light Salgscoach
// -----------------------------------------------------------------------------
// Ét sted for hele domænet, så videnbasen, stemmemotoren, feedbacken,
// udviklingsprofilen og ledelsesoverblikket taler præcis samme sprog.
// =============================================================================

/* ---------------------------------------------------------------- Brugere */

export type UserRole = "saelger" | "leder";

export interface Seller {
  /** Supabase auth-uid, eller initialer når appen kører uden login. */
  id: string;
  /** JAS, ALH, KMA, HRN, MKJ … — bruges overalt i UI'et. */
  initials: string;
  name: string;
  email?: string;
  role: UserRole;
  title?: string;
  active: boolean;
  createdAt: string;
}

/* --------------------------------------------------------- Træningsformer */

export type TrainingModeId =
  | "kunderollespil"
  | "afdaekning"
  | "indvendinger"
  | "salgsmoede"
  | "telefon"
  | "kvalificering"
  | "naeste-skridt"
  | "forhandling"
  | "forberedelse"
  | "debriefing"
  | "tilbudsopfoelgning"
  | "lynild"
  | "manualeksamen"
  | "fri-coaching"
  | "materialepraesentation";

/** Hvem AI'en spiller i den pågældende træningsform. */
export type CounterpartKind = "kunde" | "salgsdirektoer";

export interface TrainingMode {
  id: TrainingModeId;
  /** Nummer på hjemmeskærmen (1-14). Materialepræsentation nås fra materialet. */
  order: number;
  title: string;
  tagline: string;
  description: string;
  /** Hvad sælgeren konkret træner — vises som forventningsafstemning. */
  trains: string[];
  counterpart: CounterpartKind;
  /** Standard-coachtilstand for netop denne øvelse. */
  defaultCoachMode: CoachMode;
  /** Typisk varighed i minutter (bruges til forventning + planlægning). */
  minutes: [number, number];
  /** Om øvelsen kræver/kan konfigureres med et scenarie. */
  usesScenario: boolean;
  /** Feedback-kategorier der er relevante for netop denne øvelse. */
  feedbackAreas: SkillArea[];
  /** Manual-principper øvelsen især hviler på. */
  manualRefs: string[];
  icon: string;
  /** Skal sælgeren skrive noget først (fx beskrive en opportunity)? */
  intakePrompt?: string;
  hidden?: boolean;
}

/* -------------------------------------------------------- Coach-tilstande */

export type CoachMode = "realistisk" | "coach" | "hybrid";

export interface CoachModeSpec {
  id: CoachMode;
  title: string;
  short: string;
  description: string;
  /** Instruktion der lægges ind i systemprompten. */
  instruction: string;
}

/* ------------------------------------------------------------- Scenarier */

export type Difficulty = "moderat" | "haard" | "braendende";

export interface ScenarioConfig {
  industry?: string;
  companySize?: string;
  customerRole?: string;
  meetingType?: string;
  salesStage?: string;
  attitude?: string;
  difficulty?: Difficulty;
  existingSupplier?: string;
  priceSensitivity?: string;
  /** Fritekst: hvad sælgeren allerede ved om opportunity'en. */
  knownInformation?: string;
  /** true = alt genereret automatisk. */
  auto: boolean;
}

export interface PersonaSpec {
  id: string;
  /** Fx "Facility Manager", "CFO", "Indkøbschef". */
  role: string;
  name: string;
  company: string;
  industry: string;
  /** Personlighedstræk der skal høres i stemmen. */
  traits: string[];
  /** Hvordan personen taler — bruges direkte til stemmestyring. */
  voiceDirection: string;
  /** OpenAI realtime-stemme der passer bedst. */
  voice: RealtimeVoice;
  /** Hvad personen åbent siger, hvis man spørger overfladisk. */
  surfaceStory: string;
  /** Skjult information sælgeren skal grave frem — aldrig givet gratis. */
  hidden: HiddenFact[];
  /** Hvad der skal til, før personen åbner op. */
  opensUpWhen: string[];
  /** Hvad der lukker personen ned. */
  closesDownWhen: string[];
  /** Indvendinger personen bruger. */
  objections: string[];
  /** Personlig motivation (ofte det sidste der kommer frem). */
  personalMotivation: string;
  decisionProcess: string;
  budgetReality: string;
  timing: string;
  competitors: string;
}

export interface HiddenFact {
  id: string;
  /** Kort emne, fx "drift", "energi", "beslutningsproces". */
  topic: string;
  fact: string;
  /** Hvilken slags spørgsmål der åbner for oplysningen. */
  unlockedBy: string;
  /** Hvor dybt sælgeren skal grave: 1 = et godt spørgsmål, 3 = tillid + flere spørgsmål. */
  depth: 1 | 2 | 3;
}

export interface Scenario {
  id: string;
  title: string;
  /** Det sælgeren får at vide FØR øvelsen. */
  briefing: string;
  /** Sælgerens mål med samtalen. */
  objectives: string[];
  persona: PersonaSpec;
  config: ScenarioConfig;
  /** Bruges kun af AI'en — vises aldrig for sælgeren før debriefing. */
  hiddenBrief: string;
  source: "bibliotek" | "genereret" | "egen";
  modeId: TrainingModeId;
}

/* ------------------------------------------------------------ Samtalen */

export type SpeakerRole = "saelger" | "kunde" | "coach" | "system";

export interface Utterance {
  id: string;
  role: SpeakerRole;
  text: string;
  /** ms siden sessionsstart. */
  at: number;
  /** Sat mens talen stadig transskriberes. */
  partial?: boolean;
}

export type VoiceEngine = "realtime" | "browser" | "tekst";

export type SessionStatus = "kladde" | "aktiv" | "afsluttet" | "analyseret";

export interface TrainingSession {
  id: string;
  sellerId: string;
  sellerInitials: string;
  modeId: TrainingModeId;
  coachMode: CoachMode;
  language: "da" | "en";
  voiceEngine: VoiceEngine;
  scenario?: Scenario;
  /** Fritekst sælgeren gav som udgangspunkt (opportunity, møde, materiale). */
  intake?: string;
  documentId?: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  durationSec: number;
  transcript: Utterance[];
  feedback?: SessionFeedback;
  /** Kort resumé til historik-listen. */
  summary?: string;
  /** 1-2 punkter sælgeren skal arbejde videre med. */
  developmentFocus: string[];
  /** Sessionen er en gentagelse af en tidligere. */
  retryOf?: string;
}

/* ------------------------------------------------------------- Feedback */

export type Rating = "FREMRAGENDE" | "STÆRK" | "ACCEPTABEL" | "SKAL FORBEDRES" | "SVAG";

export type SkillArea =
  | "afdaekning"
  | "spoergeteknik"
  | "lytning"
  | "kommerciel-nysgerrighed"
  | "kvalificering"
  | "konsekvens"
  | "vaerdiskabelse"
  | "kundefokus"
  | "beslutningsproces"
  | "indvendinger"
  | "forhandling"
  | "selvsikkerhed"
  | "klarhed"
  | "afslutning"
  | "naeste-skridt"
  | "taletid"
  | "udfordring"
  | "forberedelse"
  | "opportunity-styring";

export interface CategoryFeedback {
  area: SkillArea;
  rating: Rating;
  /** Konkret vurdering — skal referere til noget der faktisk blev sagt. */
  comment: string;
  /** Citat eller nær-citat fra samtalen. */
  evidence?: string;
}

/** Adskillelsen af fakta og antagelser — kernen i coachens tænkning. */
export interface FactCheck {
  facts: string[];
  assumptions: string[];
  knowledgeGaps: { gap: string; howToFind: string }[];
}

export interface QualificationMap {
  known: string[];
  unknown: string[];
  assumed: string[];
  risks: string[];
  strengths: string[];
  nextInformation: string[];
  /** Ikke "god/dårlig" — men hvad der skal være sandt, før den er kvalificeret. */
  whatMustBeTrue: string[];
}

export interface ManualReference {
  /** Princip-id i videnbasen. */
  id: string;
  title: string;
  /** Hvordan princippet var relevant i netop denne samtale. */
  relevance: string;
  /** Levede sælgeren op til det? */
  applied: "ja" | "delvist" | "nej";
}

export interface SessionFeedback {
  overall: Rating;
  /** Én skarp sætning — det første sælgeren læser. */
  headline: string;
  didWell: string[];
  heldBack: string[];
  missed: string[];
  iWouldHaveDone: string[];
  focusNextTime: string[];
  categories: CategoryFeedback[];
  factCheck: FactCheck;
  manualReferences: ManualReference[];
  /** Kun for kvalificeringsøvelser og opportunity-gennemgange. */
  qualification?: QualificationMap;
  /** Ekstern teori der blev brugt — altid med eksplicit markering. */
  externalTheory?: { framework: string; point: string; whyRelevant: string }[];
  /** Hårde tal fra samtalen: taletid, spørgsmål, konsekvensspørgsmål. */
  metrics?: ConversationMetrics;
  generatedAt: string;
}

export interface ConversationMetrics {
  sellerWords: number;
  counterpartWords: number;
  /** 0-1. Over ~0.55 i en afdækning er et rødt flag. */
  sellerTalkRatio: number;
  questionsAsked: number;
  openQuestions: number;
  consequenceQuestions: number;
  /** Længste passage hvor sælgeren talte i træk (sekunder, estimeret). */
  longestMonologueSec: number;
}

/* --------------------------------------------------- Udviklingshukommelse */

export type PatternKind = "styrke" | "svaghed";
export type PatternTrend = "forbedres" | "uaendret" | "forvaerres" | "ny";

export interface DevelopmentPattern {
  id: string;
  area: SkillArea;
  kind: PatternKind;
  /** Fx "KMA går i løsningstilstand før konsekvensen er etableret." */
  statement: string;
  /** Kun mønstre set flere gange bliver til en konklusion. */
  occurrences: number;
  evidence: { sessionId: string; date: string; quote: string }[];
  firstSeen: string;
  lastSeen: string;
  trend: PatternTrend;
  status: "aktiv" | "loest";
}

export interface SkillSignal {
  area: SkillArea;
  level: Rating;
  note: string;
  observations: number;
  updatedAt: string;
}

export interface RecommendedTraining {
  modeId: TrainingModeId;
  why: string;
  /** Det coachen bevidst vil presse på. */
  focus: string;
  /** Scenarieforslag der rammer svagheden. */
  scenarioHint?: string;
  priority: 1 | 2 | 3;
}

export interface SellerProfile {
  sellerId: string;
  initials: string;
  updatedAt: string;
  sessionsCount: number;
  totalMinutes: number;
  lastSessionAt?: string;
  /** Salgsdirektørens løbende vurdering — skrives om efter hver session. */
  narrative: string;
  strengths: DevelopmentPattern[];
  weaknesses: DevelopmentPattern[];
  signals: Partial<Record<SkillArea, SkillSignal>>;
  recommended: RecommendedTraining[];
  /** Manual-emner sælgeren gentagne gange ikke anvender. */
  manualGaps: { principleId: string; title: string; note: string }[];
  /** Sætninger sælgeren selv har bedt om at blive presset på. */
  ownGoals: string[];
}

/* ------------------------------------------------------------- Materiale */

export type DocumentKind = "pdf" | "pptx" | "docx" | "xlsx" | "tekst";

export type MaterialDimension =
  | "svagheder"
  | "kundevaerdi"
  | "manglende-info"
  | "antagelser"
  | "argumentation"
  | "business-case"
  | "differentiering"
  | "beslutningsstoette"
  | "naeste-skridt"
  | "praesentationskvalitet"
  | "forbedringer";

export interface MaterialFinding {
  /** Hvor i materialet — side/slide/afsnit. */
  where: string;
  /** Hvad der konkret står (citat/nær-citat). */
  quote?: string;
  finding: string;
  /** Hvorfor det svækker materialet kommercielt. */
  soWhat: string;
}

export interface MaterialSection {
  key: MaterialDimension;
  title: string;
  verdict: Rating;
  findings: MaterialFinding[];
}

export interface MaterialRewrite {
  where: string;
  before: string;
  after: string;
  why: string;
}

export interface MaterialAnalysis {
  overall: Rating;
  headline: string;
  /** Hvem materialet reelt taler til, ud fra indholdet. */
  readsAsWrittenFor: string;
  sections: MaterialSection[];
  rewrites: MaterialRewrite[];
  /** Spørgsmål kunden med sikkerhed vil stille. */
  customerWillAsk: string[];
  /** Det materialet mangler for at kunden kan sælge det internt. */
  internalSellingGaps: string[];
  nextStep: string[];
  manualReferences: ManualReference[];
  generatedAt: string;
}

export interface SalesDocument {
  id: string;
  sellerId: string;
  sellerInitials: string;
  name: string;
  kind: DocumentKind;
  sizeBytes: number;
  uploadedAt: string;
  /** Kundekontekst sælgeren selv giver — gør analysen konkret. */
  customerContext?: string;
  /** Udtrukket tekst (gemmes, så man kan tale videre om materialet). */
  extractedText?: string;
  pages?: number;
  analysis?: MaterialAnalysis;
}

/* -------------------------------------------------------------- Manualen */

export type ManualCategory =
  | "filosofi"
  | "metode"
  | "kvalificering"
  | "spoergeteknik"
  | "moedestruktur"
  | "opportunity"
  | "kundetilgang"
  | "opfoelgning"
  | "forhandling"
  | "adfaerd"
  | "terminologi"
  | "faldgruber";

export interface ManualPrinciple {
  id: string;
  category: ManualCategory;
  title: string;
  /** Selve princippet, formuleret som manualen ville sige det. */
  statement: string;
  /** Hvorfor princippet findes — coachen skal kunne forklare det. */
  rationale: string;
  /** Hvordan det ser ud i praksis. */
  inPractice: string[];
  /** Konkrete spørgsmål/formuleringer sælgeren kan bruge. */
  questions?: string[];
  /** Hvad det ligner, når princippet IKKE følges. */
  antiPatterns: string[];
  /** Eksempel fra en typisk green light-situation. */
  example?: string;
  /** Hvilke træningsformer princippet især hører til. */
  modes: TrainingModeId[];
  /** Nøgleord der bruges til at hente princippet frem. */
  keywords: string[];
  /** Kilde: kernemanual eller tilføjet ved upload af den rigtige manual. */
  source: "kerne" | "uploadet";
}

export interface ManualDocumentMeta {
  id: string;
  name: string;
  uploadedAt: string;
  uploadedBy: string;
  /** Antal principper udtrukket. */
  principleCount: number;
  version: string;
  notes?: string;
}

/* --------------------------------------------------- Ekstern salgsteori */

export interface ExternalFramework {
  id: string;
  name: string;
  origin: string;
  summary: string;
  /** Hvor det understøtter green lights manual. */
  supportsManual: string[];
  /** Hvor det afviger — coachen SKAL sige det højt. */
  divergesFromManual: string[];
  useWhen: string[];
  keywords: string[];
}

/* ------------------------------------------------- green light-viden */

export type KnowledgeCategory =
  | "produkt"
  | "styring"
  | "energi"
  | "projekt"
  | "regler"
  | "case"
  | "branche"
  | "konkurrence"
  | "indvending";

export interface KnowledgeItem {
  id: string;
  category: KnowledgeCategory;
  title: string;
  /** Fakta — teknisk korrekt. */
  technical: string;
  /** Samme sag oversat til kundens udbytte. Coachen skal altid kunne dette. */
  customerOutcome: string;
  /** Hvornår det er relevant at bringe op. */
  useWhen: string[];
  /** Typiske fejl når sælgere bruger emnet. */
  pitfalls?: string[];
  keywords: string[];
  /** Sat når oplysningen er et estimat/typisk erfaringstal frem for et faktum. */
  indicative?: boolean;
}

export interface CustomerCase {
  id: string;
  title: string;
  industry: string;
  customerType: string;
  situation: string;
  problem: string;
  consequence: string;
  solution: string;
  result: string[];
  /** Hvornår casen er den rigtige at bruge. */
  useWhen: string[];
  indicative: boolean;
}

/* ------------------------------------------------------------ API-kontrakt */

export type CoachAction =
  | "status"
  | "samtale"
  | "analyse"
  | "profil"
  | "scenarie"
  | "materiale"
  | "manual";

export interface CoachRequest {
  action: CoachAction;
  /** Færdigbygget systeminstruktion fra klienten (videnbasen bor i appen). */
  instructions?: string;
  messages?: { role: "user" | "assistant" | "system"; content: string }[];
  /** Struktureret svar ønskes — JSON-schema. */
  schema?: unknown;
  schemaName?: string;
  /** Til materialeanalyse. */
  file?: { name: string; dataUrl: string };
  text?: string;
  /** Modelvalg overlades til serveren; kan hintes. */
  effort?: "hurtig" | "grundig";
}

/**
 * Anmodning om en talt session.
 *
 * Bemærk hvad der IKKE står her: `instructions`. Systeminstruktionen —
 * salgsmanualen, coachens adfærd og kundens skjulte oplysninger — bygges
 * udelukkende på serveren og bages ind i den midlertidige nøgle. Sendte
 * browseren instruktionen, ville manualen og kundens skjulte kort ligge frit
 * tilgængeligt i klienten, og hele rollespillet ville være meningsløst.
 */
export interface RealtimeSessionRequest {
  modeId: TrainingModeId;
  coachMode: CoachMode;
  language: "da" | "en";
  scenario?: Scenario;
  /** Uigennemsigtig, krypteret pakke fra serveren. Klienten kan ikke læse den. */
  hiddenBlob?: string;
  intake?: string;
  documentText?: string;
  sellerContext?: unknown;
  voice?: RealtimeVoice;
  /** Hvor ivrig turtagningen skal være — telefonøvelser er hurtigere. */
  eagerness?: "low" | "auto" | "high";
}

export type RealtimeVoice =
  | "cedar"
  | "marin"
  | "alloy"
  | "ash"
  | "ballad"
  | "coral"
  | "echo"
  | "sage"
  | "shimmer"
  | "verse";

/* ------------------------------------------------------ Ledelsesoverblik */

export interface TeamTheme {
  area: SkillArea;
  title: string;
  affected: string[];
  note: string;
  severity: "hoej" | "middel" | "lav";
}

export interface TeamOverview {
  updatedAt: string;
  sellers: {
    initials: string;
    sessions: number;
    minutes: number;
    lastSessionAt?: string;
    topStrength?: string;
    topDevelopmentArea?: string;
    trend: PatternTrend;
  }[];
  activityByMode: { modeId: TrainingModeId; sessions: number }[];
  recurringThemes: TeamTheme[];
  manualDrift: { principleId: string; title: string; note: string; affected: string[] }[];
  recommendedTeamTraining: { title: string; why: string; modeId: TrainingModeId }[];
}
