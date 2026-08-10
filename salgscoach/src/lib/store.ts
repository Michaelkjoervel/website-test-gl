// =============================================================================
// store · lager for sessioner, profiler og materialer
// -----------------------------------------------------------------------------
// Samme to-bagede mønster som resten af huset (src/lib/vizData.ts):
//
//   • DELT (Supabase)     – når brugeren er logget ind. Tabeller:
//       coach_sessions   (id text pk, seller_id uuid, seller_initials text,
//                         data jsonb, created_at, updated_at)
//       coach_profiles   (seller_id uuid pk, initials text unique,
//                         data jsonb, updated_at)
//       coach_documents  (id text pk, seller_id uuid, seller_initials text,
//                         data jsonb, created_at)
//       coach_users      (id uuid pk, email, initials, name, role)
//     Skemaet ligger i supabase/salescoach-schema.sql.
//
//   • LOKAL (localStorage) – uden login. Appen skal kunne demonstreres og
//     bruges offline; intet må kræve en server for at virke.
//
// PRIVATLIV — vigtigst i hele filen:
//   En sælgers samtaler er personfølsomme. Standard er derfor: man læser KUN
//   sit eget. Lederens indblik er et SEPARAT, eksplicit kald (listAllSessions,
//   listProfiles, og getProfile/getSession med et fremmed id). Reglen
//   håndhæves her i klienten OGSÅ — RLS er sidste værn, ikke det eneste.
//
// STØRRELSE:
//   Vi gemmer aldrig rå filbytes. Kun udtrukket tekst — og lokalt afkortes
//   den, så browserens lager ikke løber fuldt. Kvotefejl fanges og oversættes
//   til noget en sælger kan handle på.
// =============================================================================

import type { SessionDigest } from "./api";
import { supabase } from "./supabase";
import type {
  Rating,
  SalesDocument,
  Seller,
  SellerProfile,
  SkillArea,
  TrainingSession,
  UserRole,
} from "./types";

const SESSIONS_TABLE = "coach_sessions";
const PROFILES_TABLE = "coach_profiles";
const DOCUMENTS_TABLE = "coach_documents";

const LOCAL_SESSIONS_KEY = "gl.coach.sessions.v1";
const LOCAL_PROFILES_KEY = "gl.coach.profiles.v1";
const LOCAL_DOCUMENTS_KEY = "gl.coach.documents.v1";

/** Maks. udtrukket tekst pr. materiale i det lokale lager. */
const MAX_LOCAL_TEXT = 60_000;
/** Antal nyeste sessioner der beholder hele udskriften, når pladsen slipper op. */
const KEEP_FULL_TRANSCRIPTS = 10;

export type DataMode = "delt" | "lokal";

/* ------------------------------------------------------------------- Fejl */

export type StoreErrorCode = "adgang" | "kvote" | "skema" | "db";

/** Én fejltype med en kode UI'et kan reagere på — beskeden er altid dansk. */
export class StoreError extends Error {
  readonly code: StoreErrorCode;
  constructor(message: string, code: StoreErrorCode) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

function accessError(message: string): StoreError {
  return new StoreError(message, "adgang");
}

/** Oversæt Supabase/PostgREST-fejl til noget handlingsanvisende. */
function friendly(error: { code?: string; message?: string } | null | undefined): StoreError {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "42P01" || code === "PGRST205" || /schema cache/i.test(message)) {
    return new StoreError(
      "Databasen mangler Salgscoachens tabeller. Kør supabase/salescoach-schema.sql i Supabase → SQL Editor. Er scriptet lige kørt, så vent et minut og genindlæs.",
      "skema",
    );
  }
  if (code === "42501" || /row-level security/i.test(message)) {
    return new StoreError(
      "Databasen afviste adgangen (Row Level Security). Du kan kun se og gemme dine egne data — kør eventuelt salescoach-schema.sql igen.",
      "adgang",
    );
  }
  return new StoreError(message || "Databasefejl. Prøv igen.", "db");
}

/* ------------------------------------------------------------- Identitet */

interface Identity {
  id: string;
  initials: string;
  role: UserRole;
  isManager: boolean;
}

/** Sat af AuthProvider, så lageret altid ved hvem der kigger. */
let activeSeller: Seller | null = null;

/**
 * Fortæl lageret hvem der er logget ind. Kaldes af AuthProvider — uden den
 * falder vi tilbage til Supabase-sessionen UDEN lederrettigheder (bevidst:
 * det sikre valg).
 */
export function setActiveSeller(seller: Seller | null): void {
  activeSeller = seller;
}

export function getActiveSeller(): Seller | null {
  return activeSeller;
}

async function currentIdentity(): Promise<Identity> {
  if (activeSeller) {
    return {
      id: activeSeller.id,
      initials: activeSeller.initials,
      role: activeSeller.role,
      isManager: activeSeller.role === "leder",
    };
  }
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (user) return { id: user.id, initials: "", role: "saelger", isManager: false };
    } catch {
      // falder igennem til lokal identitet
    }
  }
  return { id: "lokal", initials: "", role: "saelger", isManager: false };
}

/** Er vi i delt tilstand (Supabase + aktiv session)? */
async function sharedActive(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  } catch {
    return false;
  }
}

export async function dataMode(): Promise<DataMode> {
  return (await sharedActive()) ? "delt" : "lokal";
}

/**
 * Hvilken sælger må dette kald røre? Uden argument: én selv. Med et fremmed
 * id: kun hvis man er leder — ellers en klar dansk afvisning.
 */
async function resolveTarget(sellerId?: string): Promise<{ me: Identity; target: string }> {
  const me = await currentIdentity();
  const wanted = (sellerId ?? "").trim();
  if (!wanted || wanted === me.id || (me.initials && wanted === me.initials)) {
    return { me, target: me.id };
  }
  if (!me.isManager) {
    throw accessError("Du kan kun se dine egne sessioner og materialer.");
  }
  return { me, target: wanted };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ledelsesoverblikket har ofte kun initialerne. seller_id er uuid, så et
 * opslag på "KMA" ville sprænge forespørgslen — vi slår i stedet op på
 * initial-kolonnen. Egne kald rammer altid uuid'et.
 */
function ownerColumn(target: string, initialsColumn: string): { column: string; value: string } {
  return UUID_RE.test(target)
    ? { column: "seller_id", value: target }
    : { column: initialsColumn, value: target.toUpperCase() };
}

async function requireManager(): Promise<Identity> {
  const me = await currentIdentity();
  if (!me.isManager) {
    throw accessError("Kun en salgsleder har adgang til ledelsesoverblikket.");
  }
  return me;
}

/** Ejerskabstjek på en hentet post. */
function assertCanRead(ownerId: string, me: Identity, what: string): void {
  if (ownerId === me.id) return;
  if (me.initials && ownerId === me.initials) return;
  if (me.isManager) return;
  throw accessError(`${what} tilhører en anden sælger.`);
}

function assertCanWrite(ownerId: string | undefined, me: Identity, what: string): void {
  if (!ownerId || ownerId === me.id || (me.initials && ownerId === me.initials)) return;
  throw accessError(`${what} kan kun gemmes af den sælger, den tilhører.`);
}

/* ------------------------------------------------------- Lokalt lager (JSON) */

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function isQuotaError(e: unknown): boolean {
  if (e instanceof DOMException) {
    return (
      e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014
    );
  }
  return e instanceof Error && /quota|exceeded|storage/i.test(e.message);
}

/**
 * Skriv til localStorage med kvoteværn. `prune` får en chance for at gøre
 * data mindre, før vi giver op — så en fuld browser degraderer i stedet for
 * at fejle hårdt.
 */
function writeLocal<T>(key: string, list: T[], prune?: (list: T[]) => T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return;
  } catch (e) {
    if (!isQuotaError(e)) {
      throw new StoreError("Data kunne ikke gemmes lokalt i browseren.", "db");
    }
  }

  if (prune) {
    try {
      localStorage.setItem(key, JSON.stringify(prune(list)));
      return;
    } catch {
      // videre til den ærlige besked
    }
  }

  throw new StoreError(
    "Browserens lokale lager er fuldt. Slet nogle gamle sessioner eller materialer — eller log ind, så alt gemmes sikkert i skyen i stedet.",
    "kvote",
  );
}

/* --------------------------------------------------------------- Sessioner */

interface SessionRow {
  id: string;
  seller_id: string;
  seller_initials: string | null;
  data: TrainingSession;
}

function sessionRow(session: TrainingSession) {
  return {
    id: session.id,
    seller_id: session.sellerId,
    seller_initials: session.sellerInitials,
    data: session,
    updated_at: new Date().toISOString(),
  };
}

function sortByStart(list: TrainingSession[]): TrainingSession[] {
  return [...list].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

/** Sidste udvej ved fuldt lager: behold kun de nyeste udskrifter. */
function pruneSessions(list: TrainingSession[]): TrainingSession[] {
  const sorted = sortByStart(list);
  return sorted.map((s, i) =>
    i < KEEP_FULL_TRANSCRIPTS
      ? s
      : { ...s, transcript: [], summary: s.summary ?? "Udskriften er ryddet for at spare plads." },
  );
}

/**
 * Sælgerens egne sessioner, nyeste først. Uden argument: ens egne.
 * Et fremmed sellerId kræver lederrolle (ellers StoreError "adgang").
 */
export async function listSessions(sellerId?: string): Promise<TrainingSession[]> {
  const { target } = await resolveTarget(sellerId);

  if (!(await sharedActive())) {
    return sortByStart(readLocal<TrainingSession>(LOCAL_SESSIONS_KEY).filter((s) => s.sellerId === target));
  }

  const owner = ownerColumn(target, "seller_initials");
  const { data, error } = await supabase!
    .from(SESSIONS_TABLE)
    .select("id,seller_id,seller_initials,data")
    .eq(owner.column, owner.value)
    .order("created_at", { ascending: false });
  if (error) throw friendly(error);
  return (data ?? []).map((r) => (r as SessionRow).data);
}

/**
 * LEDER-KALD. Hele holdets sessioner — bevidst en anden funktion end
 * listSessions, så et almindeligt kald aldrig kan komme til at hente andres.
 */
export async function listAllSessions(
  opts: { sellerId?: string; limit?: number } = {},
): Promise<TrainingSession[]> {
  await requireManager();

  if (!(await sharedActive())) {
    const all = sortByStart(readLocal<TrainingSession>(LOCAL_SESSIONS_KEY));
    const filtered = opts.sellerId ? all.filter((s) => s.sellerId === opts.sellerId) : all;
    return opts.limit ? filtered.slice(0, opts.limit) : filtered;
  }

  let query = supabase!
    .from(SESSIONS_TABLE)
    .select("id,seller_id,seller_initials,data")
    .order("created_at", { ascending: false });
  if (opts.sellerId) {
    const owner = ownerColumn(opts.sellerId, "seller_initials");
    query = query.eq(owner.column, owner.value);
  }
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw friendly(error);
  return (data ?? []).map((r) => (r as SessionRow).data);
}

export async function getSession(id: string): Promise<TrainingSession | undefined> {
  const me = await currentIdentity();

  if (!(await sharedActive())) {
    const found = readLocal<TrainingSession>(LOCAL_SESSIONS_KEY).find((s) => s.id === id);
    if (!found) return undefined;
    assertCanRead(found.sellerId, me, "Sessionen");
    return found;
  }

  const { data, error } = await supabase!
    .from(SESSIONS_TABLE)
    .select("id,seller_id,seller_initials,data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw friendly(error);
  if (!data) return undefined;

  const row = data as SessionRow;
  assertCanRead(row.seller_id, me, "Sessionen");
  return row.data;
}

/** Gem (opret eller opdatér). Man kan kun gemme sine EGNE sessioner. */
export async function saveSession(session: TrainingSession): Promise<TrainingSession> {
  const me = await currentIdentity();
  assertCanWrite(session.sellerId, me, "Sessionen");

  const stamped: TrainingSession = {
    ...session,
    sellerId: session.sellerId || me.id,
    sellerInitials: session.sellerInitials || me.initials,
  };

  if (!(await sharedActive())) {
    const list = readLocal<TrainingSession>(LOCAL_SESSIONS_KEY).filter((s) => s.id !== stamped.id);
    list.push(stamped);
    writeLocal(LOCAL_SESSIONS_KEY, list, pruneSessions);
    return stamped;
  }

  const { error } = await supabase!.from(SESSIONS_TABLE).upsert(sessionRow(stamped), { onConflict: "id" });
  if (error) throw friendly(error);
  return stamped;
}

export async function deleteSession(id: string): Promise<void> {
  const me = await currentIdentity();

  if (!(await sharedActive())) {
    const list = readLocal<TrainingSession>(LOCAL_SESSIONS_KEY);
    const found = list.find((s) => s.id === id);
    if (!found) return;
    assertCanWrite(found.sellerId, me, "Sessionen");
    writeLocal(
      LOCAL_SESSIONS_KEY,
      list.filter((s) => s.id !== id),
    );
    return;
  }

  // .eq på seller_id gør sletningen umulig at rette mod andres data —
  // også selvom politikken skulle være for løs.
  const { error } = await supabase!.from(SESSIONS_TABLE).delete().eq("id", id).eq("seller_id", me.id);
  if (error) throw friendly(error);
}

/* ----------------------------------------------------------------- Profiler */

interface ProfileRow {
  seller_id: string;
  initials: string | null;
  data: SellerProfile;
}

function profileRow(profile: SellerProfile) {
  return {
    seller_id: profile.sellerId,
    initials: profile.initials,
    data: profile,
    updated_at: new Date().toISOString(),
  };
}

/** Egen profil som standard; en anden sælgers profil kræver lederrolle. */
export async function getProfile(sellerId?: string): Promise<SellerProfile | undefined> {
  const { target } = await resolveTarget(sellerId);

  if (!(await sharedActive())) {
    return readLocal<SellerProfile>(LOCAL_PROFILES_KEY).find((p) => p.sellerId === target);
  }

  const owner = ownerColumn(target, "initials");
  const { data, error } = await supabase!
    .from(PROFILES_TABLE)
    .select("seller_id,initials,data")
    .eq(owner.column, owner.value)
    .maybeSingle();
  if (error) throw friendly(error);
  return data ? (data as ProfileRow).data : undefined;
}

/**
 * Gem profil. Sælgere kan kun gemme deres egen; en leder kan gemme holdets
 * (profiler genberegnes fra ledelsesoverblikket).
 */
export async function saveProfile(profile: SellerProfile): Promise<SellerProfile> {
  const me = await currentIdentity();
  if (!me.isManager) assertCanWrite(profile.sellerId, me, "Udviklingsprofilen");

  const stamped: SellerProfile = {
    ...profile,
    sellerId: profile.sellerId || me.id,
    initials: profile.initials || me.initials,
    updatedAt: new Date().toISOString(),
  };

  if (!(await sharedActive())) {
    const list = readLocal<SellerProfile>(LOCAL_PROFILES_KEY).filter((p) => p.sellerId !== stamped.sellerId);
    list.push(stamped);
    writeLocal(LOCAL_PROFILES_KEY, list);
    return stamped;
  }

  const { error } = await supabase!
    .from(PROFILES_TABLE)
    .upsert(profileRow(stamped), { onConflict: "seller_id" });
  if (error) throw friendly(error);
  return stamped;
}

/** LEDER-KALD. Alle udviklingsprofiler — grundlaget for ledelsesoverblikket. */
export async function listProfiles(): Promise<SellerProfile[]> {
  await requireManager();

  if (!(await sharedActive())) {
    return readLocal<SellerProfile>(LOCAL_PROFILES_KEY);
  }

  const { data, error } = await supabase!
    .from(PROFILES_TABLE)
    .select("seller_id,initials,data")
    .order("updated_at", { ascending: false });
  if (error) throw friendly(error);
  return (data ?? []).map((r) => (r as ProfileRow).data);
}

/* ---------------------------------------------------------------- Materiale */

interface DocumentRow {
  id: string;
  seller_id: string;
  seller_initials: string | null;
  data: SalesDocument;
}

/**
 * Rå filbytes gemmes ALDRIG — hverken lokalt eller i skyen. Kun den
 * udtrukne tekst, og lokalt kun de første MAX_LOCAL_TEXT tegn.
 */
function sanitiseDocument(doc: SalesDocument, forLocal: boolean): SalesDocument {
  const clean = { ...doc } as SalesDocument & {
    dataUrl?: unknown;
    file?: unknown;
    bytes?: unknown;
    blob?: unknown;
  };
  delete clean.dataUrl;
  delete clean.file;
  delete clean.bytes;
  delete clean.blob;

  if (forLocal && clean.extractedText && clean.extractedText.length > MAX_LOCAL_TEXT) {
    clean.extractedText = `${clean.extractedText.slice(0, MAX_LOCAL_TEXT)}\n\n[… teksten er afkortet lokalt for at spare plads …]`;
  }
  return clean as SalesDocument;
}

/** Sidste udvej ved fuldt lager: smid teksten væk, behold analysen. */
function pruneDocuments(list: SalesDocument[]): SalesDocument[] {
  const sorted = [...list].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
  return sorted.map((d, i) => (i === 0 ? d : { ...d, extractedText: undefined }));
}

export async function listDocuments(sellerId?: string): Promise<SalesDocument[]> {
  const { target } = await resolveTarget(sellerId);

  if (!(await sharedActive())) {
    return readLocal<SalesDocument>(LOCAL_DOCUMENTS_KEY)
      .filter((d) => d.sellerId === target)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  const owner = ownerColumn(target, "seller_initials");
  const { data, error } = await supabase!
    .from(DOCUMENTS_TABLE)
    .select("id,seller_id,seller_initials,data")
    .eq(owner.column, owner.value)
    .order("created_at", { ascending: false });
  if (error) throw friendly(error);
  return (data ?? []).map((r) => (r as DocumentRow).data);
}

export async function getDocument(id: string): Promise<SalesDocument | undefined> {
  const me = await currentIdentity();

  if (!(await sharedActive())) {
    const found = readLocal<SalesDocument>(LOCAL_DOCUMENTS_KEY).find((d) => d.id === id);
    if (!found) return undefined;
    assertCanRead(found.sellerId, me, "Materialet");
    return found;
  }

  const { data, error } = await supabase!
    .from(DOCUMENTS_TABLE)
    .select("id,seller_id,seller_initials,data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw friendly(error);
  if (!data) return undefined;

  const row = data as DocumentRow;
  assertCanRead(row.seller_id, me, "Materialet");
  return row.data;
}

export async function saveDocument(doc: SalesDocument): Promise<SalesDocument> {
  const me = await currentIdentity();
  assertCanWrite(doc.sellerId, me, "Materialet");

  const shared = await sharedActive();
  const stamped = sanitiseDocument(
    {
      ...doc,
      sellerId: doc.sellerId || me.id,
      sellerInitials: doc.sellerInitials || me.initials,
    },
    !shared,
  );

  if (!shared) {
    const list = readLocal<SalesDocument>(LOCAL_DOCUMENTS_KEY).filter((d) => d.id !== stamped.id);
    list.push(stamped);
    writeLocal(LOCAL_DOCUMENTS_KEY, list, pruneDocuments);
    return stamped;
  }

  const { error } = await supabase!.from(DOCUMENTS_TABLE).upsert(
    {
      id: stamped.id,
      seller_id: stamped.sellerId,
      seller_initials: stamped.sellerInitials,
      data: stamped,
    },
    { onConflict: "id" },
  );
  if (error) throw friendly(error);
  return stamped;
}

export async function deleteDocument(id: string): Promise<void> {
  const me = await currentIdentity();

  if (!(await sharedActive())) {
    const list = readLocal<SalesDocument>(LOCAL_DOCUMENTS_KEY);
    const found = list.find((d) => d.id === id);
    if (!found) return;
    assertCanWrite(found.sellerId, me, "Materialet");
    writeLocal(
      LOCAL_DOCUMENTS_KEY,
      list.filter((d) => d.id !== id),
    );
    return;
  }

  const { error } = await supabase!.from(DOCUMENTS_TABLE).delete().eq("id", id).eq("seller_id", me.id);
  if (error) throw friendly(error);
}

/* ------------------------------------------------------- Opsummering */

/**
 * Den kompakte udgave profil- og team-kaldet skal have. Hele udskrifter
 * sendes ALDRIG med: profilen bygges på konklusioner, ikke på råt materiale
 * (og prompten ville sprænge alle rammer).
 */
export function summariseSessionsForProfile(
  sessions: readonly TrainingSession[],
  opts: { limit?: number } = {},
): SessionDigest[] {
  const sorted = sortByStart([...sessions]).filter((s) => s.status !== "kladde");
  const limited = opts.limit ? sorted.slice(0, opts.limit) : sorted;

  return limited.map((s) => {
    const categories = (s.feedback?.categories ?? []).map((c) => ({
      area: c.area as SkillArea,
      rating: c.rating as Rating,
    }));

    return {
      id: s.id,
      date: s.startedAt,
      modeId: s.modeId,
      scenarioTitle: s.scenario?.title,
      rating: s.feedback?.overall,
      headline: s.feedback?.headline,
      focus: (s.developmentFocus ?? []).slice(0, 3),
      durationMin: Math.max(0, Math.round((s.durationSec ?? 0) / 60)),
      categories,
      initials: s.sellerInitials,
    };
  });
}

/** Ryd alt lokalt (fx ved log ud på en delt maskine). Rører aldrig skyen. */
export function clearLocalData(): void {
  for (const key of [LOCAL_SESSIONS_KEY, LOCAL_PROFILES_KEY, LOCAL_DOCUMENTS_KEY]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ligegyldigt */
    }
  }
}
