import type { DataMode } from "../lib/vizData";

/**
 * Viser om data er fælles (Supabase, hele teamet + backup) eller kun lokalt
 * i denne browser – så sælgeren altid ved, hvad der er på spil.
 */
export function DataModeBadge({ mode }: { mode: DataMode }) {
  return mode === "shared" ? (
    <span className="chip bg-brand-100 text-brand-800 text-[10px]" title="Gemmes i den fælles database – hele teamet ser det samme, og intet mistes ved ryddet browser.">
      ☁ Fælles
    </span>
  ) : (
    <span className="chip bg-surface-soft text-ink-soft text-[10px]" title="Gemmes kun i denne browser på denne enhed.">
      Kun denne browser
    </span>
  );
}
