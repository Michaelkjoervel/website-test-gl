import { useMemo, useState } from "react";
import { usePricing } from "../components/PricingProvider";
import { useAuth } from "../components/AuthProvider";
import {
  activeConfigAsJson,
  saveCloudPricing,
  validatePricingConfig,
} from "../lib/pricingCloud";
import type { PricingConfig } from "../lib/pricingConfig";

/**
 * Prisdata-administration. Her vedligeholder green light det FORTROLIGE
 * prisgrundlag (armaturpriser, tilvalg, satser). Data gemmes i Supabase bag
 * login (RLS) og ligger derfor ikke i den offentlige kode/bundle.
 */
export function PricingAdmin() {
  const { authEnabled, session } = useAuth();
  const { source, status, reload } = usePricing();
  const [text, setText] = useState<string>(() => activeConfigAsJson());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const cloudActive = authEnabled && !!session;

  const sourceBadge = useMemo(() => {
    if (source === "cloud") {
      return (
        <span className="chip bg-brand-500 text-white">
          Aktive priser: Cloud (fortroligt)
        </span>
      );
    }
    return (
      <span className="chip bg-amber-100 text-amber-800">
        Aktive priser: Placeholder
      </span>
    );
  }, [source]);

  const save = async () => {
    setMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setMessage({ ok: false, text: `Ugyldig JSON: ${(e as Error).message}` });
      return;
    }
    const validationError = validatePricingConfig(parsed);
    if (validationError) {
      setMessage({ ok: false, text: validationError });
      return;
    }
    setBusy(true);
    const res = await saveCloudPricing(parsed as PricingConfig);
    setBusy(false);
    if (!res.ok) {
      const hint = res.error?.includes("estimator_pricing")
        ? " – er supabase/schema.sql kørt i Supabase (SQL Editor)?"
        : "";
      setMessage({ ok: false, text: `${res.error ?? "Ukendt fejl"}${hint}` });
      return;
    }
    await reload();
    setMessage({ ok: true, text: "Prisgrundlaget er gemt og aktivt." });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <section className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-ink">Prisgrundlag</h2>
            <p className="text-sm text-ink-mute mt-1 max-w-2xl">
              Her vedligeholdes green lights rigtige priser (armaturer,
              tilvalg, satser). De gemmes i Supabase og kan kun læses efter
              login – de ligger hverken i koden eller i den offentlige
              JS-bundle.
            </p>
          </div>
          {sourceBadge}
        </div>

        {status?.updatedAt && (
          <div className="text-[11px] text-ink-mute mt-3">
            Senest opdateret:{" "}
            {new Date(status.updatedAt).toLocaleString("da-DK")}
          </div>
        )}
        {status?.error && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-3">
            Kunne ikke hente cloud-priser: {status.error}. Er
            supabase/schema.sql kørt i Supabase?
          </div>
        )}
        {!cloudActive && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-3">
            Login/Supabase er ikke aktivt i denne bygning – der kan ikke gemmes
            til cloud herfra.
          </div>
        )}
      </section>

      <section className="card p-6 space-y-4">
        <div>
          <div className="text-sm font-semibold text-ink">
            Redigér konfiguration (JSON)
          </div>
          <p className="text-xs text-ink-mute mt-1">
            Feltet viser den aktive konfiguration. Ret værdierne (fx{" "}
            <code className="bg-surface-soft px-1 rounded">
              luminaireProducts
            </code>{" "}
            og{" "}
            <code className="bg-surface-soft px-1 rounded">
              controlSurcharge
            </code>
            ) og tryk Gem. Manglende nøgler falder tilbage til
            placeholder-værdierne.
          </p>
        </div>

        <textarea
          className="textarea font-mono text-xs min-h-[420px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />

        {message && (
          <div
            className={`rounded-xl border text-sm px-4 py-3 ${
              message.ok
                ? "bg-brand-50 border-brand-100 text-brand-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setText(activeConfigAsJson());
              setMessage(null);
            }}
          >
            Nulstil til aktiv konfiguration
          </button>
          <button
            type="button"
            className="btn-primary disabled:opacity-50"
            onClick={save}
            disabled={busy || !cloudActive}
          >
            {busy ? "Gemmer…" : "Gem prisgrundlag"}
          </button>
        </div>
      </section>
    </div>
  );
}
