/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endpoint til green lights server-proxy for live AI-visualisering. */
  readonly VITE_VISUALIZATION_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
