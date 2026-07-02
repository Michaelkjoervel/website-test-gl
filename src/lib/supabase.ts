// =============================================================================
// supabase
// -----------------------------------------------------------------------------
// Supabase-klient til login. Aktiveres KUN når begge env-variabler er sat:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// Er de ikke sat, er login slået fra, og appen fungerer som før (bagudkompatibelt).
//
// Anon-nøglen er offentlig ("publishable") og sikker at have i klienten.
// Den rigtige beskyttelse af OpenAI-credits sker server-side i proxyen, som
// verificerer brugerens Supabase-token, før den kalder OpenAI.
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { appConfig } from "../appConfig";

const url = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || appConfig.supabaseUrl || "")
  .trim()
  .replace(/\/rest\/v1\/?$/, "") // tåler at der er indsat et REST-endpoint
  .replace(/\/$/, "");
const anonKey = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || appConfig.supabaseAnonKey || "").trim();

export const authEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = authEnabled
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

/** Hent aktuelt access-token (til proxy-kaldet). Null hvis ikke logget ind. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
