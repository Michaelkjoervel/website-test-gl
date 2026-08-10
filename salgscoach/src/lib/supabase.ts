// =============================================================================
// supabase · login og delt lager for Salgscoachen
// -----------------------------------------------------------------------------
// Samme mønster som resten af green lights værktøjer (src/lib/supabase.ts):
// klienten oprettes KUN når både projekt-URL og anon-nøgle findes. Mangler de,
// kører appen i lokal tilstand — fuldt brugbar, men uden delt historik.
//
// Anon-nøglen er offentlig ("publishable") og sikker i browseren. Den rigtige
// beskyttelse sker to steder:
//   1) serveren (api/coach) verificerer Supabase-tokenet før OpenAI kaldes,
//   2) Row Level Security på coach_*-tabellerne, så en sælger kun kan læse
//      sine egne sessioner (klienten håndhæver det samme — se store.ts).
//
// Escape hatch: VITE_SUPABASE_URL=off slår login helt fra i en bygning (kun til
// lokal test/demo). Værdien når hertil via config.supabaseUrl, så vi behøver
// ikke læse import.meta.env her.
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";

/** "off"/"0"/"false"/tom = bevidst slået fra. */
function isDisabled(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "" || v === "off" || v === "0" || v === "false" || v === "none";
}

const rawUrl = config.supabaseUrl ?? "";
const rawKey = config.supabaseAnonKey ?? "";
const disabled = isDisabled(rawUrl) || isDisabled(rawKey);

const url = disabled
  ? ""
  : rawUrl
      .trim()
      .replace(/\/rest\/v1\/?$/, "") // tåler at der er indsat et REST-endpoint
      .replace(/\/$/, "");
const anonKey = disabled ? "" : rawKey.trim();

/** true = rigtigt login + delt lager. false = lokal tilstand. */
export const authEnabled: boolean = Boolean(url && anonKey);

/**
 * Bemærk: ingen egen storageKey. Ligger Salgscoachen på samme domæne som
 * resten af værktøjerne, deler den bevidst session med dem — man logger ind
 * ét sted og er inde alle steder.
 */
export const supabase: SupabaseClient | null = authEnabled
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/**
 * Aktuelt access-token til Authorization-headeren mod api/coach*.
 * Null når der ikke er nogen session (eller login er slået fra).
 */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    // Netværk/lagerfejl må aldrig vælte et kald — vi sender bare uden token
    // og lader serveren svare 401, som UI'et allerede håndterer.
    return null;
  }
}

/** Uid'et på den bruger der er logget ind lige nu (null uden login). */
export async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** true når der faktisk er en aktiv session — brugt til "delt vs. lokal". */
export async function hasSession(): Promise<boolean> {
  return (await getUserId()) !== null;
}
