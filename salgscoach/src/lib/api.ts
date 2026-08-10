// =============================================================================
// api · typet klient til Salgscoachens server-endpoints
// -----------------------------------------------------------------------------
// Tre endpoints, ét sted:
//   POST {apiBase}/coach          – manifest, scenarie, samtale, analyse,
//                                   profil, materiale, team
//   POST {apiBase}/coach-session  – midlertidig nøgle til realtime-stemme
//   POST {apiBase}/coach-speak    – talesyntese (fallback-stemme)
//
// Regler huset holder:
//   • Alle kald sender Authorization: Bearer <Supabase access token>, når der
//     er en session. Serveren afviser ellers (den betaler for OpenAI).
//   • Ingen rå fetch-fejl når UI'et. Alt bliver til en ApiError med en dansk
//     besked og HTTP-status, så knapper kan sige noget fornuftigt.
//   • Timeout via AbortController — lange for analyse/materiale, korte for
//     samtale og stemme.
//   • Ét forsøg mere ved netværksfejl/5xx, med backoff. Timeout gentages IKKE
//     (så en tung analyse ikke pludselig tager dobbelt så lang tid).
// =============================================================================

import { config } from "../config";
import { getAccessToken } from "./supabase";
import type {
  CoachMode,
  CoachModeSpec,
  ConversationMetrics,
  CustomerCase,
  DevelopmentPattern,
  ExternalFramework,
  KnowledgeItem,
  ManualCategory,
  MaterialAnalysis,
  PersonaSpec,
  RealtimeSessionRequest,
  RealtimeVoice,
  Rating,
  Scenario,
  ScenarioConfig,
  Seller,
  SellerProfile,
  SessionFeedback,
  SkillArea,
  SpeakerRole,
  TeamOverview,
  TrainingMode,
  TrainingModeId,
  TrainingSession,
  Utterance,
} from "./types";

/* ------------------------------------------------------------------ Fejl */

export interface ApiErrorOptions {
  /** Serverens egen tekst, når den er mere præcis end vores standardbesked. */
  detail?: string;
  /** Kan kaldet med rimelighed prøves igen? */
  retriable?: boolean;
  /** Sat når kaldet blev afbrudt af brugeren (skal ikke vises som fejl). */
  aborted?: boolean;
}

/** Én fejltype for hele datalaget. status 0 = netværk/ingen kontakt. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;
  readonly retriable: boolean;
  readonly aborted: boolean;

  constructor(message: string, status: number, opts: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = opts.detail;
    this.retriable = opts.retriable ?? false;
    this.aborted = opts.aborted ?? false;
  }

  /** true når brugeren skal logge ind igen. */
  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/* --------------------------------------------------------- Serverkontrakt */

/** Actions api/coach forstår. "manifest" og "team" ligger ud over CoachAction. */
export type CoachApiAction =
  | "manifest"
  | "scenarie"
  | "samtale"
  | "analyse"
  | "profil"
  | "materiale"
  | "team"
  | "status";

/* -------------------------------------------------------------- Manifest */

export interface ManualManifestMeta {
  title: string;
  subtitle?: string;
  version: string;
  chapters?: number;
  language?: string;
  northStar?: string;
}

export interface ManualChapterRef {
  no: number;
  id: string;
  title: string;
}

/** Let udgave af et manualprincip — prosaen bliver på serveren. */
export interface ManualPrincipleRef {
  id: string;
  title: string;
  chapter?: number;
  category: ManualCategory;
  modes: TrainingModeId[];
}

export interface ManualChecklistRef {
  id: string;
  title: string;
  items: string[];
  ifNo?: string;
}

export interface ManualManifest {
  meta: ManualManifestMeta;
  chapters: ManualChapterRef[];
  principles: ManualPrincipleRef[];
  checklists: ManualChecklistRef[];
}

/** Alt UI'et skal bruge for at kunne tegne forsiden — hentes én gang. */
export interface CoachManifest {
  manual: ManualManifest;
  knowledge: KnowledgeItem[];
  personas: PersonaSpec[];
  modes: TrainingMode[];
  coachModes: CoachModeSpec[];
  /** Valgfrit ekstra fra serveren — vises hvis det er der. */
  cases?: CustomerCase[];
  frameworks?: ExternalFramework[];
}

/* ------------------------------------------------------- Sælgerkontekst */

export interface SellerContextPattern {
  area: SkillArea;
  statement: string;
  occurrences: number;
}

/**
 * Den komprimerede hukommelse om sælgeren, som serveren lægger ind i
 * coachens systemprompt. Aldrig hele transskriptioner — kun konklusioner.
 */
export interface SellerContext {
  initials: string;
  name: string;
  sessionsCount: number;
  narrative: string;
  strengths: SellerContextPattern[];
  weaknesses: SellerContextPattern[];
  focusAreas: string[];
  recentHeadlines: string[];
}

/** Kompakt sessionsopsummering (se store.summariseSessionsForProfile). */
export interface SessionDigest {
  id: string;
  date: string;
  modeId: TrainingModeId;
  scenarioTitle?: string;
  rating?: Rating;
  headline?: string;
  focus: string[];
  durationMin: number;
  categories: { area: SkillArea; rating: Rating }[];
  /** Sat når opsummeringen bruges på tværs af sælgere (ledelsesoverblik). */
  initials?: string;
}

/* ------------------------------------------------------------ Input-typer */

export interface GenerateScenarioInput {
  modeId: TrainingModeId;
  config: ScenarioConfig;
  sellerContext?: SellerContext;
  language?: "da" | "en";
}

export interface ConverseMessage {
  role: SpeakerRole;
  text: string;
}

export interface ConverseInput {
  modeId: TrainingModeId;
  coachMode: CoachMode;
  language?: "da" | "en";
  scenario?: Scenario;
  /** Uigennemsigtig streng fra generateScenario — kun serveren læser den. */
  hiddenBlob?: string;
  messages: readonly (Utterance | ConverseMessage)[];
  sellerContext?: SellerContext;
  intake?: string;
  /** Udtrukket materialetekst, når øvelsen handler om et dokument. */
  documentText?: string;
}

export interface AnalyseSessionInput {
  modeId: TrainingModeId;
  coachMode: CoachMode;
  language?: "da" | "en";
  scenario?: Scenario;
  hiddenBlob?: string;
  messages: readonly (Utterance | ConverseMessage)[];
  sellerContext?: SellerContext;
  intake?: string;
  durationSec?: number;
  metrics?: ConversationMetrics;
  documentText?: string;
}

export interface BuildProfileInput {
  initials: string;
  previousProfile?: SellerProfile | null;
  sessions: readonly SessionDigest[];
}

export interface AnalyseMaterialInput {
  /** Enten en File fra input[type=file] eller et færdigt dataUrl-par. */
  file?: File | { name: string; dataUrl: string };
  /** Alternativ til fil: ren tekst indsat af sælgeren. */
  text?: string;
  customerContext?: string;
  sellerContext?: SellerContext;
  language?: "da" | "en";
}

export interface TeamOverviewInput {
  profiles: readonly SellerProfile[];
  sessions: readonly SessionDigest[];
}

/* ----------------------------------------------------------- Output-typer */

export interface ScenarioResult {
  scenario: Scenario;
  /** Skjult brief i serverens eget format — gives videre uændret. */
  hiddenBlob: string;
}

export interface ConverseResult {
  reply: string;
  speaker: SpeakerRole;
}

export interface AnalyseResult {
  feedback: SessionFeedback;
}

export interface ProfileResult {
  profile: SellerProfile;
}

export interface MaterialResult {
  extractedText: string;
  pages?: number;
  analysis: MaterialAnalysis;
}

export interface TeamResult {
  overview: TeamOverview;
}

export interface RealtimeSessionGranted {
  ok: true;
  /** Ephemeral nøgle til WebRTC-forbindelsen. Kortlivet med vilje. */
  clientSecret: string;
  expiresAt: string;
  model: string;
  voice: RealtimeVoice;
  /** URL/endpoint klienten skal forhandle med. */
  api: string;
}

export interface RealtimeSessionDenied {
  ok: false;
  error: string;
  /** true = kør videre med browserens egen stemme frem for at stoppe. */
  fallbackToBrowserVoice: boolean;
}

export type RealtimeSessionResult = RealtimeSessionGranted | RealtimeSessionDenied;

export interface SpeakResult {
  /** base64 eller data-URL med lyd (mp3). Brug toAudioDataUrl(). */
  audio: string;
}

/* ------------------------------------------------------------- Timeouts */

const TIMEOUT = {
  /** Stemme/nøgle — skal føles øjeblikkeligt. */
  quick: 20_000,
  /** Samtale og scenariegenerering. */
  normal: 60_000,
  /** Analyse, profil, ledelsesoverblik. */
  long: 150_000,
  /** Materiale: upload + tekstudtræk + analyse. */
  material: 240_000,
} as const;

const RETRY_BACKOFF_MS = 900;

/* ---------------------------------------------------------- request-kernen */

interface RequestOptions {
  timeoutMs?: number;
  /** Antal EKSTRA forsøg (0 = kun ét forsøg). */
  retries?: number;
  retryOn5xx?: boolean;
  signal?: AbortSignal;
  /** Bruges i fejlbeskeden: "Analysen tog for lang tid". */
  label?: string;
}

type Json = Record<string, unknown>;

function isRecord(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function endpoint(path: string): string {
  const base = config.apiBase.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Standardbesked pr. HTTP-status. Serverens egen tekst vinder, hvis den findes. */
function danishForStatus(status: number, label: string): string {
  if (status === 0) return "Ingen forbindelse til serveren. Tjek nettet og prøv igen.";
  if (status === 400) return `${label} blev afvist af serveren (400). Prøv igen.`;
  if (status === 401) return "Din session er udløbet. Log ind igen.";
  if (status === 403) return "Din konto har ikke adgang til Salgscoachen. Kontakt administratoren.";
  if (status === 404)
    return "Serverens coach-endpoint blev ikke fundet. Er appen sat op med den rigtige API-adresse?";
  if (status === 408) return `${label} tog for lang tid. Prøv igen.`;
  if (status === 413) return "Materialet er for stort til at blive sendt. Prøv en mindre fil.";
  if (status === 429)
    return "Grænsen for AI-kald er nået lige nu. Vent et øjeblik, og prøv igen.";
  if (status === 503)
    return "Salgscoachens server er ikke sat op endnu (503). Kontakt administratoren.";
  if (status >= 500) return `Serveren fejlede (${status}). Prøv igen om et øjeblik.`;
  return `Uventet svar fra serveren (${status}).`;
}

/** Ét forsøg: fetch + timeout + JSON. Kaster altid ApiError. */
async function attempt<T>(
  url: string,
  body: unknown,
  timeoutMs: number,
  label: string,
  outerSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onOuterAbort = () => controller.abort();
  outerSignal?.addEventListener("abort", onOuterAbort);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
        credentials: "omit",
      });
    } catch (e) {
      if (timedOut) throw new ApiError(danishForStatus(408, label), 408, { retriable: false });
      if (outerSignal?.aborted) {
        throw new ApiError(`${label} blev afbrudt.`, 0, { aborted: true, retriable: false });
      }
      const detail = e instanceof Error ? e.message : undefined;
      throw new ApiError(danishForStatus(0, label), 0, { detail, retriable: true });
    }

    // Bemærk: timeouten dækker også læsningen af svaret — en server der
    // åbner forbindelsen og så tier, må ikke kunne hænge UI'et.
    const raw = await res.text().catch(() => "");
    if (timedOut) throw new ApiError(danishForStatus(408, label), 408, { retriable: false });

    let payload: unknown = null;
    if (raw) {
      try {
        payload = JSON.parse(raw) as unknown;
      } catch {
        payload = null;
      }
    }

    if (!res.ok) {
      const serverText = isRecord(payload)
        ? str(payload.error) ?? str(payload.reason) ?? str(payload.message)
        : undefined;
      throw new ApiError(serverText ?? danishForStatus(res.status, label), res.status, {
        detail: serverText ?? (raw ? raw.slice(0, 400) : undefined),
        retriable: res.status >= 500 || res.status === 429,
      });
    }

    if (!isRecord(payload)) {
      throw new ApiError(`${label} gav et svar vi ikke kunne læse. Prøv igen.`, 502, {
        detail: raw.slice(0, 400),
        retriable: true,
      });
    }

    return payload as T;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener("abort", onOuterAbort);
  }
}

/**
 * Fælles kald med backoff. Netværksfejl og 5xx prøves én gang mere;
 * timeout og brugerafbrydelse gør ikke.
 */
async function request<T>(path: string, body: unknown, opts: RequestOptions = {}): Promise<T> {
  const {
    timeoutMs = TIMEOUT.normal,
    retries = 1,
    retryOn5xx = true,
    signal,
    label = "Kaldet",
  } = opts;

  const url = endpoint(path);
  let last: ApiError | null = null;

  for (let i = 0; i <= retries; i++) {
    if (i > 0) await sleep(RETRY_BACKOFF_MS * i + Math.floor(Math.random() * 250));
    try {
      return await attempt<T>(url, body, timeoutMs, label, signal);
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(danishForStatus(0, label), 0, {
              detail: e instanceof Error ? e.message : undefined,
              retriable: true,
            });
      last = err;
      if (err.aborted || signal?.aborted) throw err;
      const worthRetrying = err.retriable && (err.status === 0 || (retryOn5xx && err.status >= 500));
      if (!worthRetrying || i === retries) throw err;
    }
  }

  throw last ?? new ApiError("Ukendt fejl i kaldet til serveren.", 0);
}

/** Kræv en nøgle i svaret — ellers en ærlig dansk fejl frem for undefined i UI'et. */
function need<T>(payload: Record<string, unknown>, key: string, label: string): T {
  const value = payload[key];
  if (value === undefined || value === null) {
    const serverText = str(payload.error) ?? str(payload.message);
    throw new ApiError(
      serverText ?? `${label}: serveren svarede uden "${key}". Prøv igen.`,
      502,
      { retriable: true },
    );
  }
  return value as T;
}

/* ---------------------------------------------------------------- Manifest */

const MANIFEST_KEY = "gl.coach.manifest.v1";
const MANIFEST_TTL_MS = 12 * 60 * 60 * 1000;

let manifestMemory: CoachManifest | null = null;
let manifestInflight: Promise<CoachManifest> | null = null;

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Tolerant normalisering — et manglende felt må ikke vælte forsiden. */
function normaliseManifest(payload: Record<string, unknown>): CoachManifest {
  const manualRaw = isRecord(payload.manual) ? payload.manual : {};
  const meta = isRecord(manualRaw.meta) ? (manualRaw.meta as unknown as ManualManifestMeta) : undefined;

  const manual: ManualManifest = {
    meta: meta ?? { title: "Salgsmanual – green light a/s", version: "—" },
    chapters: arrayOf<ManualChapterRef>(manualRaw.chapters),
    principles: arrayOf<ManualPrincipleRef>(manualRaw.principles),
    checklists: arrayOf<ManualChecklistRef>(manualRaw.checklists),
  };

  // Videnbasen må gerne komme som liste eller som { items, cases }.
  const knowledgeRaw = payload.knowledge;
  const knowledge = Array.isArray(knowledgeRaw)
    ? (knowledgeRaw as KnowledgeItem[])
    : isRecord(knowledgeRaw)
      ? arrayOf<KnowledgeItem>(knowledgeRaw.items)
      : [];
  const casesFromKnowledge = isRecord(knowledgeRaw) ? arrayOf<CustomerCase>(knowledgeRaw.cases) : [];

  return {
    manual,
    knowledge,
    personas: arrayOf<PersonaSpec>(payload.personas),
    modes: arrayOf<TrainingMode>(payload.modes),
    coachModes: arrayOf<CoachModeSpec>(payload.coachModes),
    cases: arrayOf<CustomerCase>(payload.cases).concat(casesFromKnowledge),
    frameworks: arrayOf<ExternalFramework>(payload.frameworks),
  };
}

function readManifestCache(): CoachManifest | null {
  try {
    const raw = sessionStorage.getItem(MANIFEST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
    if (Date.now() - savedAt > MANIFEST_TTL_MS) return null;
    return isRecord(parsed.manifest) ? (parsed.manifest as unknown as CoachManifest) : null;
  } catch {
    return null;
  }
}

function writeManifestCache(manifest: CoachManifest): void {
  try {
    sessionStorage.setItem(MANIFEST_KEY, JSON.stringify({ savedAt: Date.now(), manifest }));
  } catch {
    // Fuldt sessionStorage er ikke en fejl — hukommelsescachen bærer den.
  }
}

/** Ryd manifestet (fx efter upload af en ny manual). */
export function clearManifestCache(): void {
  manifestMemory = null;
  manifestInflight = null;
  try {
    sessionStorage.removeItem(MANIFEST_KEY);
  } catch {
    /* ligegyldigt */
  }
}

/**
 * Manualoversigt, videnbase, personaer og træningsformer. Lille og stabil, så
 * den caches i hukommelsen + sessionStorage og hentes én gang pr. fane.
 */
export async function getManifest(opts: { force?: boolean; signal?: AbortSignal } = {}): Promise<CoachManifest> {
  if (!opts.force) {
    if (manifestMemory) return manifestMemory;
    const cached = readManifestCache();
    if (cached) {
      manifestMemory = cached;
      return cached;
    }
    if (manifestInflight) return manifestInflight;
  }

  const run = (async () => {
    const payload = await request<Record<string, unknown>>(
      "/coach",
      { action: "manifest" satisfies CoachApiAction },
      { timeoutMs: TIMEOUT.normal, label: "Hentning af manualen", signal: opts.signal },
    );
    const manifest = normaliseManifest(payload);
    manifestMemory = manifest;
    writeManifestCache(manifest);
    return manifest;
  })();

  manifestInflight = run;
  try {
    return await run;
  } finally {
    if (manifestInflight === run) manifestInflight = null;
  }
}

/* --------------------------------------------------------------- Scenarie */

export async function generateScenario(
  input: GenerateScenarioInput,
  opts: { signal?: AbortSignal } = {},
): Promise<ScenarioResult> {
  const payload = await request<Record<string, unknown>>(
    "/coach",
    {
      action: "scenarie" satisfies CoachApiAction,
      modeId: input.modeId,
      config: input.config,
      sellerContext: input.sellerContext,
      language: input.language ?? config.defaultLanguage,
    },
    { timeoutMs: TIMEOUT.normal, label: "Scenariet", signal: opts.signal },
  );

  return {
    scenario: need<Scenario>(payload, "scenario", "Scenariet"),
    hiddenBlob: str(payload.hiddenBlob) ?? "",
  };
}

/* ---------------------------------------------------------------- Samtale */

/** Utterance → {role, text}. Delvise (partial) og tomme replikker sendes ikke. */
function toMessages(messages: readonly (Utterance | ConverseMessage)[]): ConverseMessage[] {
  const out: ConverseMessage[] = [];
  for (const m of messages) {
    if ("partial" in m && m.partial) continue;
    const text = (m.text ?? "").trim();
    if (!text) continue;
    out.push({ role: m.role, text });
  }
  return out;
}

export async function converse(
  input: ConverseInput,
  opts: { signal?: AbortSignal } = {},
): Promise<ConverseResult> {
  const payload = await request<Record<string, unknown>>(
    "/coach",
    {
      action: "samtale" satisfies CoachApiAction,
      modeId: input.modeId,
      coachMode: input.coachMode,
      language: input.language ?? config.defaultLanguage,
      scenario: input.scenario,
      hiddenBlob: input.hiddenBlob,
      messages: toMessages(input.messages),
      sellerContext: input.sellerContext,
      intake: input.intake,
      documentText: input.documentText,
    },
    { timeoutMs: TIMEOUT.normal, label: "Svaret", signal: opts.signal },
  );

  const speaker = str(payload.speaker);
  const valid: SpeakerRole[] = ["saelger", "kunde", "coach", "system"];
  return {
    reply: need<string>(payload, "reply", "Svaret"),
    speaker: valid.includes(speaker as SpeakerRole) ? (speaker as SpeakerRole) : "kunde",
  };
}

/* ---------------------------------------------------------------- Analyse */

export async function analyseSession(
  input: AnalyseSessionInput,
  opts: { signal?: AbortSignal } = {},
): Promise<AnalyseResult> {
  const payload = await request<Record<string, unknown>>(
    "/coach",
    {
      action: "analyse" satisfies CoachApiAction,
      modeId: input.modeId,
      coachMode: input.coachMode,
      language: input.language ?? config.defaultLanguage,
      scenario: input.scenario,
      hiddenBlob: input.hiddenBlob,
      messages: toMessages(input.messages),
      sellerContext: input.sellerContext,
      intake: input.intake,
      durationSec: input.durationSec,
      metrics: input.metrics,
      documentText: input.documentText,
    },
    { timeoutMs: TIMEOUT.long, label: "Analysen", signal: opts.signal },
  );

  return { feedback: need<SessionFeedback>(payload, "feedback", "Analysen") };
}

/* ----------------------------------------------------------------- Profil */

export async function buildProfile(
  input: BuildProfileInput,
  opts: { signal?: AbortSignal } = {},
): Promise<ProfileResult> {
  const payload = await request<Record<string, unknown>>(
    "/coach",
    {
      action: "profil" satisfies CoachApiAction,
      initials: input.initials,
      previousProfile: input.previousProfile ?? null,
      sessions: input.sessions,
      language: config.defaultLanguage,
    },
    { timeoutMs: TIMEOUT.long, label: "Udviklingsprofilen", signal: opts.signal },
  );

  return { profile: need<SellerProfile>(payload, "profile", "Udviklingsprofilen") };
}

/* -------------------------------------------------------------- Materiale */

/** Maks. størrelse vi sender som dataUrl (base64 fylder ~33 % ekstra). */
const MAX_FILE_BYTES = 12 * 1024 * 1024;

/** File → data-URL. Bruges af materialeanalysen; kaster en dansk ApiError. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_BYTES) {
      reject(
        new ApiError(
          `Filen er for stor (maks. ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB). Gem den som en mindre PDF, og prøv igen.`,
          413,
        ),
      );
      return;
    }
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new ApiError("Filen kunne ikke læses i browseren. Prøv en anden fil.", 0));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new ApiError("Filen kunne ikke læses i browseren. Prøv en anden fil.", 0));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

export async function analyseMaterial(
  input: AnalyseMaterialInput,
  opts: { signal?: AbortSignal } = {},
): Promise<MaterialResult> {
  let file: { name: string; dataUrl: string } | undefined;

  if (input.file instanceof File) {
    file = { name: input.file.name, dataUrl: await fileToDataUrl(input.file) };
  } else if (input.file) {
    file = input.file;
  }

  if (!file && !str(input.text)) {
    throw new ApiError("Der er hverken en fil eller tekst at analysere.", 400);
  }
  if (file && file.dataUrl.length > MAX_FILE_BYTES * 1.4) {
    throw new ApiError("Materialet er for stort til at blive sendt. Prøv en mindre fil.", 413);
  }

  const payload = await request<Record<string, unknown>>(
    "/coach",
    {
      action: "materiale" satisfies CoachApiAction,
      file,
      text: input.text,
      customerContext: input.customerContext,
      sellerContext: input.sellerContext,
      language: input.language ?? config.defaultLanguage,
    },
    {
      timeoutMs: TIMEOUT.material,
      label: "Materialeanalysen",
      // Tunge uploads gentages kun ved rene netværksfejl.
      retryOn5xx: false,
      signal: opts.signal,
    },
  );

  const pages = typeof payload.pages === "number" ? payload.pages : undefined;
  return {
    extractedText: str(payload.extractedText) ?? str(input.text) ?? "",
    pages,
    analysis: need<MaterialAnalysis>(payload, "analysis", "Materialeanalysen"),
  };
}

/* ------------------------------------------------------- Ledelsesoverblik */

export async function teamOverview(
  input: TeamOverviewInput,
  opts: { signal?: AbortSignal } = {},
): Promise<TeamResult> {
  const payload = await request<Record<string, unknown>>(
    "/coach",
    {
      action: "team" satisfies CoachApiAction,
      profiles: input.profiles,
      sessions: input.sessions,
      language: config.defaultLanguage,
    },
    { timeoutMs: TIMEOUT.long, label: "Ledelsesoverblikket", signal: opts.signal },
  );

  return { overview: need<TeamOverview>(payload, "overview", "Ledelsesoverblikket") };
}

/* ------------------------------------------------------- Realtime + stemme */

/**
 * Midlertidig nøgle til stemmesamtalen.
 * Kaster IKKE: kan nøglen ikke skaffes, returneres et pænt afslag med
 * fallbackToBrowserVoice, så øvelsen kan køre videre med browserstemmen.
 */
export async function createRealtimeSession(
  input: RealtimeSessionRequest,
  opts: { signal?: AbortSignal } = {},
): Promise<RealtimeSessionResult> {
  try {
    const payload = await request<Record<string, unknown>>(
      "/coach-session",
      {
        // Kun rå kontekst — serveren bygger selv systeminstruktionen, så
        // manualen og kundens skjulte oplysninger aldrig passerer browseren.
        modeId: input.modeId,
        coachMode: input.coachMode,
        language: input.language,
        scenario: input.scenario,
        hiddenBlob: input.hiddenBlob,
        intake: input.intake,
        documentText: input.documentText,
        sellerContext: input.sellerContext,
        voice: input.voice,
        eagerness: input.eagerness ?? "auto",
      },
      { timeoutMs: TIMEOUT.quick, label: "Stemmeforbindelsen", signal: opts.signal },
    );

    // Serveren kan svare 200 med et pænt afslag (fx ingen realtime-adgang).
    const serverError = str(payload.error);
    if (serverError) {
      return {
        ok: false,
        error: serverError,
        fallbackToBrowserVoice: payload.fallbackToBrowserVoice !== false,
      };
    }

    const clientSecret =
      str(payload.clientSecret) ??
      (isRecord(payload.client_secret) ? str(payload.client_secret.value) : undefined);

    if (!clientSecret) {
      return {
        ok: false,
        error: "Serveren gav ingen stemmenøgle. Vi bruger browserens stemme i stedet.",
        fallbackToBrowserVoice: true,
      };
    }

    return {
      ok: true,
      clientSecret,
      expiresAt: str(payload.expiresAt) ?? new Date(Date.now() + 60_000).toISOString(),
      model: str(payload.model) ?? "",
      voice: (str(payload.voice) as RealtimeVoice | undefined) ?? input.voice ?? "cedar",
      api: str(payload.api) ?? "",
    };
  } catch (e) {
    const err = e instanceof ApiError ? e : null;
    if (err?.aborted) throw err; // brugeren afbrød selv — ikke en fejl at melde
    return {
      ok: false,
      error: err?.message ?? "Stemmeforbindelsen kunne ikke oprettes.",
      // Ved 401/403 hjælper browserstemmen ikke — brugeren skal logge ind.
      fallbackToBrowserVoice: !(err?.isAuth ?? false),
    };
  }
}

export async function speak(
  input: { text: string; voice?: RealtimeVoice },
  opts: { signal?: AbortSignal } = {},
): Promise<SpeakResult> {
  const payload = await request<Record<string, unknown>>(
    "/coach-speak",
    { text: input.text, voice: input.voice },
    { timeoutMs: TIMEOUT.quick, label: "Talesyntesen", signal: opts.signal },
  );
  return { audio: need<string>(payload, "audio", "Talesyntesen") };
}

/** base64 eller data-URL → afspilleligt data-URL. */
export function toAudioDataUrl(audio: string, mime = "audio/mpeg"): string {
  return audio.startsWith("data:") ? audio : `data:${mime};base64,${audio}`;
}

/* ------------------------------------------------------- Sælgerkontekst */

function patternToContext(p: DevelopmentPattern): SellerContextPattern {
  return { area: p.area, statement: p.statement, occurrences: p.occurrences };
}

/** `date` findes kun på opsummeringen — TrainingSession har `startedAt`. */
function isDigest(s: TrainingSession | SessionDigest): s is SessionDigest {
  return "date" in s;
}

function headlineOf(s: TrainingSession | SessionDigest): string | undefined {
  return isDigest(s) ? s.headline : s.feedback?.headline;
}

function focusOf(s: TrainingSession | SessionDigest): string[] {
  return isDigest(s) ? s.focus ?? [] : s.developmentFocus ?? [];
}

function dateOf(s: TrainingSession | SessionDigest): string {
  return isDigest(s) ? s.date : s.startedAt;
}

function unique(values: readonly (string | undefined)[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const t = (v ?? "").trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

type ProfileOrSeller = SellerProfile | Seller | null | undefined;

/** SellerProfile har sellerId; Seller har role. Det er nok til at kende dem fra hinanden. */
function asProfile(v: ProfileOrSeller): SellerProfile | null {
  return v && "sellerId" in v ? v : null;
}

function asSeller(v: ProfileOrSeller): Seller | null {
  return v && "role" in v ? v : null;
}

/**
 * Byg den sælgerkontekst serveren forventer. Kun konklusioner — aldrig
 * transskriptioner. Tåler at profilen endnu ikke findes (ny sælger).
 *
 * Rækkefølgen er (profil, sælger, sessioner) — men de to første må gerne
 * bytte plads: vi finder selv ud af hvad der er hvad, så et kaldsted ikke
 * kan komme til at sende en tom kontekst afsted i tavshed.
 */
export function buildSellerContext(
  profileOrSeller: ProfileOrSeller,
  sellerOrProfile?: ProfileOrSeller,
  recentSessions: readonly (TrainingSession | SessionDigest)[] = [],
): SellerContext {
  const profile = asProfile(profileOrSeller) ?? asProfile(sellerOrProfile);
  const seller = asSeller(sellerOrProfile) ?? asSeller(profileOrSeller);

  const sorted = [...recentSessions].sort(
    (a, b) => new Date(dateOf(b)).getTime() - new Date(dateOf(a)).getTime(),
  );

  const byOccurrences = (a: DevelopmentPattern, b: DevelopmentPattern) =>
    b.occurrences - a.occurrences;

  const strengths = [...(profile?.strengths ?? [])]
    .filter((p) => p.status !== "loest")
    .sort(byOccurrences)
    .slice(0, 6)
    .map(patternToContext);

  const weaknesses = [...(profile?.weaknesses ?? [])]
    .filter((p) => p.status !== "loest")
    .sort(byOccurrences)
    .slice(0, 6)
    .map(patternToContext);

  const focusAreas = unique(
    [
      ...(profile?.recommended ?? []).sort((a, b) => a.priority - b.priority).map((r) => r.focus),
      ...sorted.flatMap(focusOf),
      ...(profile?.ownGoals ?? []),
    ],
    6,
  );

  const recentHeadlines = unique(sorted.slice(0, 6).map(headlineOf), 5);

  return {
    initials: profile?.initials || seller?.initials || "??",
    name: seller?.name || profile?.initials || "",
    sessionsCount: profile?.sessionsCount ?? sorted.length,
    narrative: profile?.narrative ?? "",
    strengths,
    weaknesses,
    focusAreas,
    recentHeadlines,
  };
}

/* ------------------------------------------------------------- Samlet API */

/**
 * Samme funktioner som ovenfor, samlet i ét objekt.
 *
 * Skærmbillederne importerer `api` og kalder `api.analyseSession(...)`, fordi
 * det gør kaldstedet selvforklarende ("det her går til serveren"). De
 * navngivne eksporter bevares uændret til test og til punktvis import.
 */
export const api = {
  getManifest,
  clearManifestCache,
  generateScenario,
  converse,
  analyseSession,
  buildProfile,
  analyseMaterial,
  teamOverview,
  createRealtimeSession,
  speak,
  fileToDataUrl,
  toAudioDataUrl,
  /** Ren klientfunktion (intet netværk) — med her, så kaldstedet slipper for to imports. */
  buildSellerContext,
} as const;
