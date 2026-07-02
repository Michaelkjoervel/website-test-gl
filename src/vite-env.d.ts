/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endpoint til green lights server-proxy for live AI-visualisering. */
  readonly VITE_VISUALIZATION_ENDPOINT?: string;
  /** Supabase projekt-URL (til login). Tom = login slået fra. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon/publishable nøgle (offentlig, sikker i klienten). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
