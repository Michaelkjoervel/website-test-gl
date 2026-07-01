// =============================================================================
// visualizationConfig
// -----------------------------------------------------------------------------
// Runtime-konfiguration af live-AI-proxyen. Adressen kan sættes:
//   1) i appen (gemmes i localStorage) – så sælgeren selv kan slå det til, eller
//   2) som build-variabel VITE_VISUALIZATION_ENDPOINT (fallback/standard).
//
// At holde det i localStorage betyder, at man ikke skal bygge/deploye appen igen
// for at koble proxyen på – man indsætter bare URL'en i "Live AI-opsætning".
// =============================================================================

const ENDPOINT_KEY = "gl.viz.endpoint.v1";

export function getEndpoint(): string {
  const stored = (typeof localStorage !== "undefined" && localStorage.getItem(ENDPOINT_KEY)) || "";
  const envValue = (import.meta.env.VITE_VISUALIZATION_ENDPOINT as string | undefined) || "";
  return (stored || envValue).trim();
}

export function setEndpoint(url: string): void {
  const clean = url.trim();
  if (clean) localStorage.setItem(ENDPOINT_KEY, clean);
  else localStorage.removeItem(ENDPOINT_KEY);
}

export function hasEndpoint(): boolean {
  return getEndpoint().length > 0;
}
