// =============================================================================
// sellers · sælgerregistret
// -----------------------------------------------------------------------------
// Sandheden om "hvem er hvem" ét sted. Registret er bevidst datadrevet:
//
//   1) SELLER_SEED      – de sælgere vi starter med. Tilføj en linje, færdig.
//   2) EMAIL_TO_INITIALS – undtagelser hvor e-mailen ikke matcher initialerne.
//   3) coach_users       – Supabase-tabellen vinder over begge, så navne,
//                          titler og lederrollen kan rettes uden en ny bygning.
//
// Opløsningen af en Supabase-bruger til en Seller sker i resolveSeller():
//   coach_users → eksplicit e-mail-kort → e-mailens lokale del → afledt af
//   e-mailen. Der er altså ALTID en Seller — appen må aldrig stå uden identitet.
// =============================================================================

import type { User } from "@supabase/supabase-js";
import { config } from "../config";
import { supabase } from "./supabase";
import type { Seller, UserRole } from "./types";

const USERS_TABLE = "coach_users";
const LOCAL_SELLERS_KEY = "gl.coach.sellers.v1";
const GL_DOMAIN = "green-light.dk";

/* ------------------------------------------------------------------- Seed */

export interface SellerSeed {
  initials: string;
  /** Fulde navn. Udfyldes fra coach_users, når det rigtige navn er kendt. */
  name: string;
  email?: string;
  title?: string;
  /** Kun sat når nogen er leder fra start; ellers "saelger". */
  role?: UserRole;
  active?: boolean;
}

/**
 * De fem sælgere vi starter med. Nye sælgere tilføjes ved at skrive én linje
 * mere her (eller ved at oprette rækken i coach_users — begge dele virker).
 * Navnene er indtil videre initialerne; de rigtige navne kommer fra
 * coach_users/Supabase-profilen, så vi ikke gætter på stavemåder.
 */
export const SELLER_SEED: readonly SellerSeed[] = [
  { initials: "JAS", name: "JAS", email: `jas@${GL_DOMAIN}` },
  { initials: "ALH", name: "ALH", email: `alh@${GL_DOMAIN}` },
  { initials: "KMA", name: "KMA", email: `kma@${GL_DOMAIN}` },
  { initials: "HRN", name: "HRN", email: `hrn@${GL_DOMAIN}` },
  { initials: "MKJ", name: "MKJ", email: `mkj@${GL_DOMAIN}` },
];

/**
 * Undtagelser: konti hvor e-mailen ikke er "initialer@green-light.dk".
 * Nøglen skal være små bogstaver.
 */
export const EMAIL_TO_INITIALS: Readonly<Record<string, string>> = {
  // "michael.kjaer@green-light.dk": "MKJ",
};

/* -------------------------------------------------------------- Hjælpere */

function nowIso(): string {
  return new Date().toISOString();
}

function normEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

function normInitials(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[^A-ZÆØÅ0-9]/g, "").slice(0, 4);
}

/** Er kontoen leder ifølge den offentlige fallback-liste i config? */
export function isManagerEmail(email: string | null | undefined): boolean {
  const e = normEmail(email);
  return Boolean(e) && config.fallbackManagerEmails.includes(e);
}

function parseRole(value: string | null | undefined): UserRole | null {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "leder" || v === "manager" || v === "admin") return "leder";
  if (v === "saelger" || v === "sælger" || v === "seller") return "saelger";
  return null;
}

/**
 * Afled initialer af en e-mails lokale del:
 *   "jas"                  → JAS
 *   "michael.kjaer"        → MK
 *   "anne-lise.hansen"     → AH   (bindestreg tæller som ét navn)
 */
export function deriveInitials(source: string | null | undefined): string {
  const raw = (source ?? "").split("@")[0].trim().toLowerCase();
  if (!raw) return "??";
  const parts = raw.split(/[._\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return normInitials(parts.slice(0, 3).map((p) => p[0]).join("")) || "??";
  }
  return normInitials(parts[0]?.slice(0, 3)) || "??";
}

function seedByInitials(initials: string): SellerSeed | undefined {
  const key = normInitials(initials);
  return SELLER_SEED.find((s) => normInitials(s.initials) === key);
}

function seedByEmail(email: string): SellerSeed | undefined {
  const e = normEmail(email);
  if (!e) return undefined;
  return SELLER_SEED.find((s) => normEmail(s.email) === e);
}

function sellerFromSeed(seed: SellerSeed, overrides: Partial<Seller> = {}): Seller {
  return {
    id: overrides.id ?? normInitials(seed.initials),
    initials: normInitials(seed.initials),
    name: overrides.name || seed.name || normInitials(seed.initials),
    email: overrides.email ?? seed.email,
    // Lederlisten (config.fallbackManagerEmails) gælder ALLE veje ind i
    // registret — også seed'et og den lokale tilstand. rowToSeller anvender
    // samme regel; glemmer én konstruktør den, står en leder som sælger.
    role: overrides.role ?? seed.role ?? (isManagerEmail(seed.email) ? "leder" : "saelger"),
    title: overrides.title ?? seed.title,
    active: overrides.active ?? seed.active ?? true,
    createdAt: overrides.createdAt ?? nowIso(),
  };
}

/** Sælgerne som de ser ud uden Supabase — bruges af den lokale tilstand. */
export function seedSellers(): Seller[] {
  return SELLER_SEED.map((s) => sellerFromSeed(s));
}

/* ------------------------------------------------- Lokalt lager (uden login) */

function readLocalSellers(): Seller[] {
  try {
    const raw = localStorage.getItem(LOCAL_SELLERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Seller[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSellers(list: Seller[]): void {
  try {
    localStorage.setItem(LOCAL_SELLERS_KEY, JSON.stringify(list));
  } catch {
    // Fuldt lager må ikke vælte registret — seed'et alene er brugbart.
  }
}

/* ---------------------------------------------------------- coach_users-lag */

interface CoachUserRow {
  id: string;
  email: string | null;
  initials: string | null;
  name: string | null;
  role: string | null;
}

function rowToSeller(row: CoachUserRow): Seller {
  const initials = normInitials(row.initials) || deriveInitials(row.email);
  const seed = seedByInitials(initials);
  const managerByEmail = isManagerEmail(row.email);
  return {
    id: row.id,
    initials,
    name: row.name?.trim() || seed?.name || initials,
    email: normEmail(row.email) || seed?.email,
    role: managerByEmail ? "leder" : parseRole(row.role) ?? seed?.role ?? "saelger",
    title: seed?.title,
    active: true,
    createdAt: nowIso(),
  };
}

/**
 * Læs registret fra Supabase. Fejler tavst (tom liste), fordi appen skal
 * fungere selvom schemaet ikke er kørt endnu — seed'et bærer den så.
 */
async function fetchCoachUsers(): Promise<CoachUserRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from(USERS_TABLE).select("id,email,initials,name,role");
    if (error || !data) return [];
    return data as CoachUserRow[];
  } catch {
    return [];
  }
}

async function fetchCoachUser(userId: string, email: string): Promise<CoachUserRow | null> {
  if (!supabase) return null;
  try {
    const byId = await supabase
      .from(USERS_TABLE)
      .select("id,email,initials,name,role")
      .eq("id", userId)
      .maybeSingle();
    if (!byId.error && byId.data) return byId.data as CoachUserRow;

    if (email) {
      const byEmail = await supabase
        .from(USERS_TABLE)
        .select("id,email,initials,name,role")
        .eq("email", email)
        .maybeSingle();
      if (!byEmail.error && byEmail.data) return byEmail.data as CoachUserRow;
    }
  } catch {
    // Tavst: registret må aldrig blokere login.
  }
  return null;
}

/* ------------------------------------------------------------- Offentligt API */

/**
 * Hele sælgerlisten: seed + coach_users (Supabase vinder) + lokale tilføjelser.
 * Sorteret alfabetisk på initialer, så rækkefølgen er forudsigelig i UI'et.
 */
export async function listSellers(): Promise<Seller[]> {
  const byInitials = new Map<string, Seller>();

  for (const s of seedSellers()) byInitials.set(s.initials, s);
  for (const s of readLocalSellers()) {
    const key = normInitials(s.initials);
    if (key) byInitials.set(key, { ...byInitials.get(key), ...s, initials: key });
  }
  for (const row of await fetchCoachUsers()) {
    const seller = rowToSeller(row);
    const existing = byInitials.get(seller.initials);
    byInitials.set(seller.initials, existing ? { ...existing, ...seller } : seller);
  }

  return [...byInitials.values()].sort((a, b) => a.initials.localeCompare(b.initials, "da-DK"));
}

/** Slå op på uid ELLER initialer (UI'et har ofte kun initialerne). */
export async function getSeller(id: string): Promise<Seller | undefined> {
  const wanted = (id ?? "").trim();
  if (!wanted) return undefined;
  const key = normInitials(wanted);
  const all = await listSellers();
  return all.find((s) => s.id === wanted || s.initials === key);
}

/**
 * Gem/ret en sælger. Med login skrives der til coach_users (kræver at
 * politikken tillader det — typisk kun ens egen række eller en leder);
 * uden login gemmes ændringen lokalt.
 */
export async function upsertSeller(seller: Seller): Promise<void> {
  const clean: Seller = {
    ...seller,
    initials: normInitials(seller.initials) || deriveInitials(seller.email),
    email: normEmail(seller.email) || undefined,
  };

  if (!supabase) {
    const list = readLocalSellers().filter((s) => normInitials(s.initials) !== clean.initials);
    list.push(clean);
    writeLocalSellers(list);
    resolvedCache.delete(clean.id);
    return;
  }

  const { error } = await supabase.from(USERS_TABLE).upsert(
    {
      id: clean.id,
      email: clean.email ?? null,
      initials: clean.initials,
      name: clean.name,
      role: clean.role,
    },
    { onConflict: "id" },
  );
  if (error) {
    throw new Error(
      error.message
        ? `Sælgeren kunne ikke gemmes: ${error.message}`
        : "Sælgeren kunne ikke gemmes. Prøv igen.",
    );
  }
  resolvedCache.delete(clean.id);
}

/** Initialer fra hvad end man har ved hånden. */
export function initialsOf(input: Seller | User | string | null | undefined): string {
  if (!input) return "??";
  if (typeof input === "string") {
    return input.includes("@") ? deriveInitials(input) : normInitials(input) || "??";
  }
  if ("initials" in input && input.initials) return normInitials(input.initials);
  if ("email" in input && input.email) {
    const e = normEmail(input.email);
    return EMAIL_TO_INITIALS[e] ?? seedByEmail(e)?.initials ?? deriveInitials(e);
  }
  return "??";
}

/* --------------------------------------------------------------- Avatar */

export interface SellerAvatar {
  initials: string;
  bg: string;
  text: string;
  border: string;
  /** Færdig klasse til en rund/afrundet initial-brik. */
  className: string;
}

/**
 * Fast farve pr. sælger (samme initialer → samme farve, altid). Farverne er
 * hele klassenavne, så Tailwind kan finde dem i kildekoden.
 */
const AVATAR_PALETTE: readonly { bg: string; text: string; border: string }[] = [
  { bg: "bg-brand-100", text: "text-brand-800", border: "border-brand-300" },
  { bg: "bg-client-50", text: "text-client-800", border: "border-client-400" },
  { bg: "bg-warn-50", text: "text-warn-700", border: "border-warn-400" },
  { bg: "bg-danger-50", text: "text-danger-700", border: "border-danger-400" },
  { bg: "bg-brand-50", text: "text-brand-700", border: "border-brand-200" },
  { bg: "bg-base-panel2", text: "text-ink", border: "border-base-line2" },
];

export function sellerAvatar(input: Seller | string | null | undefined): SellerAvatar {
  const initials = initialsOf(input ?? null);
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = (hash * 31 + initials.charCodeAt(i)) >>> 0;
  const tone = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  return {
    initials,
    ...tone,
    className: `inline-grid place-items-center rounded-xl border text-xs font-bold tracking-wide ${tone.bg} ${tone.text} ${tone.border}`,
  };
}

/* ------------------------------------------------------------ Opløsning */

/** Kort cache, så hvert render ikke rammer coach_users. */
const resolvedCache = new Map<string, Seller>();

/** Ryd cachen (bruges af refreshSeller i auth). */
export function clearSellerCache(): void {
  resolvedCache.clear();
}

/**
 * Supabase-bruger → Seller.
 * Rækkefølge: coach_users → eksplicit e-mail-kort → e-mailens lokale del →
 * afledt af e-mailen. Lederrollen sættes af coach_users ELLER af
 * config.fallbackManagerEmails (så adgangen ikke kan låse sig selv ude).
 */
export async function resolveSeller(
  user: User,
  opts: { force?: boolean } = {},
): Promise<Seller> {
  if (!opts.force) {
    const cached = resolvedCache.get(user.id);
    if (cached) return cached;
  }

  const email = normEmail(user.email);
  const row = await fetchCoachUser(user.id, email);

  // 1) coach_users · 2) eksplicit kort · 3) seed på e-mail · 4) lokal del
  const initials =
    normInitials(row?.initials) ||
    normInitials(EMAIL_TO_INITIALS[email]) ||
    normInitials(seedByEmail(email)?.initials) ||
    deriveInitials(email || user.id);

  const seed = seedByInitials(initials);

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metaName =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : "";

  const role: UserRole =
    parseRole(row?.role) === "leder" || isManagerEmail(email)
      ? "leder"
      : parseRole(row?.role) ?? seed?.role ?? "saelger";

  const seller: Seller = {
    id: user.id,
    initials,
    name: row?.name?.trim() || metaName.trim() || seed?.name || initials,
    email: email || seed?.email,
    role,
    title: seed?.title,
    active: true,
    createdAt: user.created_at ?? nowIso(),
  };

  resolvedCache.set(user.id, seller);
  void ensureUserRow(seller, row);
  return seller;
}

/**
 * Sørg for at kontoen findes i coach_users, så ledelsesoverblikket kan vise
 * rigtige navne. Best effort: fejler politikken, sker der ingenting.
 */
async function ensureUserRow(seller: Seller, existing: CoachUserRow | null): Promise<void> {
  if (!supabase) return;
  const unchanged =
    existing &&
    existing.id === seller.id &&
    normInitials(existing.initials) === seller.initials &&
    normEmail(existing.email) === normEmail(seller.email);
  if (unchanged) return;

  try {
    await supabase.from(USERS_TABLE).upsert(
      {
        id: seller.id,
        email: seller.email ?? null,
        initials: seller.initials,
        name: seller.name,
        role: seller.role,
      },
      { onConflict: "id" },
    );
  } catch {
    // Tavst med vilje.
  }
}

/**
 * Sælger i lokal tilstand (uden login). Id'et ER initialerne — sådan er
 * Seller.id defineret i types.ts, når appen kører uden Supabase.
 */
export function makeLocalSeller(initials: string, name?: string): Seller {
  const key = normInitials(initials) || "GST";
  const seed = seedByInitials(key);
  // Kendte initialer går gennem sellerFromSeed, så rollereglen kun findes ét
  // sted. Ukendte initialer bliver en lokal gæst uden særlige rettigheder.
  if (seed) return sellerFromSeed(seed, { id: key, name: name?.trim() || undefined });
  return {
    id: key,
    initials: key,
    name: name?.trim() || key,
    role: "saelger",
    active: true,
    createdAt: nowIso(),
  };
}
