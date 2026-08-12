// =============================================================================
// config · offentlig klient-konfiguration
// -----------------------------------------------------------------------------
// INGEN hemmeligheder her. Kun værdier der alligevel ender i browserens
// JavaScript: Supabase projekt-URL + anon/publishable nøgle samt den offentlige
// API-base. OpenAI-nøglen lever udelukkende i serverens miljø (Vercel).
//
// Build-env (VITE_*) vinder over disse defaults.
// =============================================================================

const env = import.meta.env as Record<string, string | undefined>;

function pick(name: string, fallback: string): string {
  const v = (env[name] || "").trim();
  return v || fallback;
}

export const config = {
  /** Supabase-projekt (samme login som resten af green lights værktøjer). */
  supabaseUrl: pick("VITE_SUPABASE_URL", "https://czogeolinlguilkzpsyf.supabase.co"),
  supabaseAnonKey: pick("VITE_SUPABASE_ANON_KEY", "sb_publishable_rM1GZ1Ohg1hiDQ7ex3aqBQ_K9LFt8Pp"),

  /**
   * Base-URL for salgscoachens server-endpoints:
   *   POST {apiBase}/coach          – tekst/analyse/feedback/dokument
   *   POST {apiBase}/coach-session  – midlertidig nøgle til realtime-stemme
   *   POST {apiBase}/coach-speak    – tale-syntese (fallback-stemme)
   */
  apiBase: pick("VITE_COACH_API_BASE", "https://website-test-gl.vercel.app/api").replace(/\/$/, ""),

  /** Sprog samtalen føres på som standard. */
  defaultLanguage: (pick("VITE_COACH_LANGUAGE", "da") as "da" | "en"),

  /** Kun disse konti får adgang til ledelsesoverblikket (kan udvides i Supabase). */
  fallbackManagerEmails: pick("VITE_COACH_MANAGERS", "mkj@green-light.dk")
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
} as const;

/** Sat til true når appen kører uden Supabase (lokal demo af flowet). */
export const authConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
