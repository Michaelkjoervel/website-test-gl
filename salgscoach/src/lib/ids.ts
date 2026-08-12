// =============================================================================
// ids · stabile id'er uden eksterne afhængigheder
// -----------------------------------------------------------------------------
// Sessioner, dokumenter og profiler får id'et tildelt i browseren, FØR de
// gemmes — så optimistisk UI og offline-tilstand virker uden serverrundtur.
// crypto.randomUUID findes i alle moderne browsere; fallback'en er der, fordi
// ældre WebViews (og http:// på LAN) ikke altid eksponerer den.
// =============================================================================

/** Rå UUID v4 (eller nærmeste tilnærmelse på gamle platforme). */
export function uuid(): string {
  const c: Crypto | undefined = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  // Fallback 1: rigtige tilfældige bytes, sat sammen som UUID v4.
  if (c && typeof c.getRandomValues === "function") {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex: string[] = [];
    for (let i = 0; i < bytes.length; i++) hex.push(bytes[i].toString(16).padStart(2, "0"));
    return (
      hex.slice(0, 4).join("") +
      "-" +
      hex.slice(4, 6).join("") +
      "-" +
      hex.slice(6, 8).join("") +
      "-" +
      hex.slice(8, 10).join("") +
      "-" +
      hex.slice(10, 16).join("")
    );
  }

  // Fallback 2: sidste udvej. Ikke kryptografisk — men id'erne er kun
  // nøgler i vores eget lager, aldrig hemmeligheder.
  const rnd = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${rnd()}-${rnd().slice(0, 4)}-4${rnd().slice(0, 3)}-a${rnd().slice(0, 3)}-${rnd()}${rnd().slice(0, 4)}`;
}

/**
 * Id med læsbart præfiks, fx `newId("ses")` → "ses_3f9c…".
 * Præfikset gør det til at se i logs og lagerdumps, hvad man kigger på.
 */
export function newId(prefix?: string): string {
  const id = uuid();
  const p = (prefix ?? "").trim().replace(/[^a-zA-Z0-9-]/g, "");
  return p ? `${p}_${id}` : id;
}

/** Kort, menneskeligt id (fx til visning i UI). Ikke garanteret unikt globalt. */
export function shortId(id: string): string {
  const raw = id.includes("_") ? id.slice(id.indexOf("_") + 1) : id;
  return raw.replace(/-/g, "").slice(0, 8);
}
