import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { storage } from "../lib/storage";
import { downloadEstimatePdf } from "../lib/pdf";
import { ConfidenceBadge, ConfidenceMeter } from "../components/Confidence";
import { controlLabel } from "../lib/estimateEngine";
import { resolveProduct } from "../lib/pricingConfig";
import { dkkInt, formatDate, num, pct } from "../lib/format";
import type {
  ActualResult,
  CustomerEstimate,
  EstimateStatus,
} from "../lib/types";

const STATUSES: EstimateStatus[] = [
  "Kladde",
  "Sendt",
  "Vundet",
  "Tabt",
  "Opdateret til faktisk tilbud",
];

export function EstimateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [est, setEst] = useState<CustomerEstimate | null>(null);
  const [showActual, setShowActual] = useState(false);

  useEffect(() => {
    if (!id) return;
    const found = storage.getEstimate(id);
    if (found) setEst(found);
  }, [id]);

  const deviation = useMemo(() => {
    if (!est?.actual?.actualTotal) return null;
    const diff = est.actual.actualTotal - est.pricing.totalCost;
    const pct = (diff / est.pricing.totalCost) * 100;
    return { diff, pct };
  }, [est]);

  if (!est) {
    return (
      <div className="card p-8 text-center text-ink-mute">
        Estimatet blev ikke fundet.{" "}
        <Link to="/historik" className="text-brand-700 underline">
          Tilbage til historik
        </Link>
      </div>
    );
  }

  const updateStatus = (status: EstimateStatus) => {
    const updated = { ...est, status };
    storage.saveEstimate(updated);
    setEst(updated);
  };

  const saveActual = (actual: ActualResult) => {
    const updated: CustomerEstimate = {
      ...est,
      actual: { ...actual, registeredAt: new Date().toISOString() },
      status:
        actual.finalStatus ??
        ("Opdateret til faktisk tilbud" as EstimateStatus),
    };
    storage.saveEstimate(updated);
    setEst(updated);
    setShowActual(false);
  };

  const remove = () => {
    if (!confirm("Slet estimat? Dette kan ikke fortrydes.")) return;
    storage.deleteEstimate(est.id);
    navigate("/historik");
  };

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <section className="card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="kpi-label">Estimat</div>
            <h2 className="text-2xl md:text-3xl font-bold text-ink mt-1">
              {est.projectName || "Uden navn"}
            </h2>
            <div className="text-sm text-ink-mute mt-1">
              {est.customerName} · Oprettet {formatDate(est.createdAt)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ConfidenceBadge confidence={est.confidence} />
            <select
              className="select w-auto"
              value={est.status}
              onChange={(e) => updateStatus(e.target.value as EstimateStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Link to={`/forretningscase/${est.id}`} className="btn-outline">
              <PresentIcon /> Forretningscase
            </Link>
            <button
              className="btn-primary"
              onClick={() => downloadEstimatePdf(est)}
            >
              Download PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-7">
          <Big
            label="Samlet"
            value={dkkInt(est.pricing.totalCost)}
            tone="primary"
          />
          <Big label="Interval" value={`${dkkInt(est.pricing.budgetRange.low)}–${dkkInt(est.pricing.budgetRange.high)}`} />
          <Big
            label="Pr. armatur"
            value={dkkInt(est.pricing.pricePerLuminaire)}
          />
          <Big
            label="Årlig el-omkostning"
            value={dkkInt(est.energy.annualEnergyCost)}
          />
        </div>
      </section>

      {/* Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <h3 className="text-sm font-semibold text-ink-soft uppercase tracking-wider mb-4">
            Tekniske forudsætninger
          </h3>
          <DefList
            items={[
              ["Områdetype", est.technical.areaType],
              ["Antal armaturer", num.format(est.technical.luminaireCount)],
              [
                "Armatur",
                resolveProduct(
                  est.technical.areaType,
                  est.technical.luminaireProductId,
                )?.name ?? "—",
              ],
              ["Styring", controlLabel(est.technical)],
              [
                "Lux",
                typeof est.technical.luxLevel === "number"
                  ? `${est.technical.luxLevel} lux`
                  : String(est.technical.luxLevel),
              ],
              ["Kelvin", String(est.technical.kelvin)],
              ["Årlig brændetid", `${num.format(est.technical.annualBurnHours)} timer`],
              ["Elpris", `${est.technical.electricityPrice.toFixed(2)} kr/kWh`],
              ["Budgetønske", est.technical.budgetWish ? dkkInt(est.technical.budgetWish) : "—"],
            ]}
          />
        </section>

        <section className="card p-6">
          <h3 className="text-sm font-semibold text-ink-soft uppercase tracking-wider mb-4">
            Prisopdeling
          </h3>
          <DefList
            items={[
              ["Materiale (inkl. styringssystem)", dkkInt(est.pricing.materialCost)],
              ["Installation", dkkInt(est.pricing.installationCost)],
              ["Styringstilvalg", dkkInt(est.pricing.controlCost)],
              ["I alt", dkkInt(est.pricing.totalCost)],
            ]}
            highlightLast
          />
          <div className="mt-5">
            <ConfidenceMeter confidence={est.confidence} />
          </div>
        </section>
      </div>

      <section className="card p-6">
        <h3 className="text-sm font-semibold text-ink-soft uppercase tracking-wider mb-4">
          Energi
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Big
            label="Samlet effekt"
            value={`${num.format(est.energy.totalWatts)} W`}
          />
          <Big
            label="Årligt forbrug"
            value={`${num.format(est.energy.annualKwh)} kWh`}
          />
          <Big
            label="Årlig omkostning"
            value={dkkInt(est.energy.annualEnergyCost)}
          />
        </div>
        {est.energy.estimatedAnnualSavings ? (
          <div className="mt-4 rounded-xl bg-brand-50 text-brand-800 px-4 py-3 text-sm">
            Forventet årlig besparelse:{" "}
            <strong>{dkkInt(est.energy.estimatedAnnualSavings)}</strong>
          </div>
        ) : null}
      </section>

      {/* Energibesparelse før/efter */}
      {est.energyComparison && (
        <section className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink-soft uppercase tracking-wider">
              Energibesparelse · før/efter
            </h3>
            <span className="chip bg-brand-500 text-white">
              −{pct(est.energyComparison.savedPct, 0)} pr. år
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Big
              label="Nuværende forbrug"
              value={`${num.format(est.energyComparison.currentAnnualKwh)} kWh`}
            />
            <Big
              label="Ny løsning"
              value={`${num.format(est.energyComparison.newAnnualKwh)} kWh`}
            />
            <Big
              label="Sparet pr. år"
              value={`${num.format(est.energyComparison.savedKwh)} kWh`}
            />
            <Big
              label="Sparet i kr./år"
              value={dkkInt(est.energyComparison.savedAnnualCost)}
              tone="primary"
            />
          </div>
          {est.energyComparisonInput && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <DefList
                items={[
                  [
                    "Nuværende armaturer",
                    num.format(est.energyComparisonInput.current.luminaireCount),
                  ],
                  [
                    "Watt pr. armatur (nu)",
                    `${num.format(
                      est.energyComparisonInput.current.wattPerLuminaire,
                    )} W`,
                  ],
                  [
                    "Brændetimer (nu)",
                    `${num.format(
                      est.energyComparisonInput.current.burnHours,
                    )} t/år`,
                  ],
                ]}
              />
              <DefList
                items={[
                  [
                    "Nye armaturer",
                    num.format(
                      est.energyComparisonInput.oneToOne
                        ? est.energyComparisonInput.current.luminaireCount
                        : est.energyComparisonInput.replacement.luminaireCount,
                    ),
                  ],
                  [
                    "Watt pr. nyt armatur",
                    `${num.format(
                      est.energyComparisonInput.replacement.wattPerLuminaire,
                    )} W`,
                  ],
                  [
                    "Styringsbesparelse",
                    pct(est.energyComparison.controlSavingsPct, 0),
                  ],
                ]}
              />
            </div>
          )}
        </section>
      )}

      {/* Installer */}
      <section className="card p-6">
        <h3 className="text-sm font-semibold text-ink-soft uppercase tracking-wider mb-4">
          Installatør
        </h3>
        <DefList
          items={[
            ["Firma", est.installer.companyName || "—"],
            ["Kontaktperson", est.installer.contactPerson || "—"],
            ["Telefon", est.installer.phone || "—"],
            ["E-mail", est.installer.email || "—"],
          ]}
        />
      </section>

      {/* Actual result */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink-soft uppercase tracking-wider">
            Faktisk resultat
          </h3>
          <button
            className="btn-outline"
            onClick={() => setShowActual((v) => !v)}
          >
            {est.actual?.actualTotal ? "Ret faktisk resultat" : "Tilføj faktisk resultat"}
          </button>
        </div>

        {est.actual?.actualTotal ? (
          <div className="space-y-3">
            <DefList
              items={[
                ["Faktisk tilbudspris", dkkInt(est.actual.actualTotal ?? 0)],
                [
                  "Faktisk materialepris",
                  est.actual.actualMaterial ? dkkInt(est.actual.actualMaterial) : "—",
                ],
                [
                  "Faktisk installation",
                  est.actual.actualInstallation
                    ? dkkInt(est.actual.actualInstallation)
                    : "—",
                ],
                [
                  "Faktisk styring",
                  est.actual.actualControl ? dkkInt(est.actual.actualControl) : "—",
                ],
                ["Status", est.actual.finalStatus ?? "—"],
                ["Kommentar", est.actual.comment ?? "—"],
              ]}
            />
            {deviation && (
              <div
                className={`rounded-xl px-4 py-3 text-sm border ${
                  Math.abs(deviation.pct) <= 10
                    ? "bg-brand-50 text-brand-800 border-brand-100"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                Afvigelse:{" "}
                <strong>{dkkInt(deviation.diff)}</strong> ·{" "}
                <strong>{deviation.pct.toFixed(1)}%</strong>{" "}
                {deviation.diff >= 0
                  ? "(estimatet lå under den faktiske pris)"
                  : "(estimatet lå over den faktiske pris)"}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-ink-mute">
            Indtast det endelige tilbud eller resultat når projektet er afgjort.
            Det hjælper systemet til at lære og forbedre fremtidige estimater.
          </div>
        )}

        {showActual && <ActualForm initial={est.actual} onSave={saveActual} />}
      </section>

      {/* Learning */}
      {est.learningNote && (
        <section className="card p-6">
          <h3 className="text-sm font-semibold text-ink-soft uppercase tracking-wider mb-2">
            Læringsmodul
          </h3>
          <p className="text-sm text-ink-soft">{est.learningNote}</p>
        </section>
      )}

      <div className="flex items-center justify-between">
        <Link to="/historik" className="btn-ghost">
          ← Tilbage til historik
        </Link>
        <button className="btn-ghost text-red-600" onClick={remove}>
          Slet estimat
        </button>
      </div>
    </div>
  );
}

function PresentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 4h18v12H3V4zm9 12v4m-4 0h8M7 12l3-3 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Big({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "primary";
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-4 border ${
        tone === "primary"
          ? "bg-brand-500 text-white border-brand-500"
          : "bg-surface-soft border-surface-line"
      }`}
    >
      <div
        className={`text-[11px] uppercase tracking-wider ${
          tone === "primary" ? "text-white/80" : "text-ink-mute"
        }`}
      >
        {label}
      </div>
      <div className="font-bold text-lg mt-0.5">{value}</div>
    </div>
  );
}

function DefList({
  items,
  highlightLast,
}: {
  items: [string, string][];
  highlightLast?: boolean;
}) {
  return (
    <dl className="divide-y divide-surface-line">
      {items.map(([k, v], i) => {
        const last = highlightLast && i === items.length - 1;
        return (
          <div
            key={k}
            className={`flex items-center justify-between py-2.5 text-sm ${
              last ? "border-t-2 border-brand-500 mt-1 pt-3" : ""
            }`}
          >
            <dt className="text-ink-mute">{k}</dt>
            <dd className={`font-semibold text-ink ${last ? "text-base" : ""}`}>
              {v}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function ActualForm({
  initial,
  onSave,
}: {
  initial?: ActualResult;
  onSave: (a: ActualResult) => void;
}) {
  const [a, setA] = useState<ActualResult>({
    actualTotal: initial?.actualTotal,
    actualMaterial: initial?.actualMaterial,
    actualInstallation: initial?.actualInstallation,
    actualControl: initial?.actualControl,
    comment: initial?.comment ?? "",
    finalStatus: initial?.finalStatus,
  });

  return (
    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
      <NumberField
        label="Faktisk samlet pris"
        value={a.actualTotal}
        onChange={(v) => setA({ ...a, actualTotal: v })}
      />
      <NumberField
        label="Faktisk materialepris"
        value={a.actualMaterial}
        onChange={(v) => setA({ ...a, actualMaterial: v })}
      />
      <NumberField
        label="Faktisk installation"
        value={a.actualInstallation}
        onChange={(v) => setA({ ...a, actualInstallation: v })}
      />
      <NumberField
        label="Faktisk styring"
        value={a.actualControl}
        onChange={(v) => setA({ ...a, actualControl: v })}
      />
      <div>
        <span className="label">Status</span>
        <select
          className="select mt-1"
          value={a.finalStatus ?? ""}
          onChange={(e) =>
            setA({
              ...a,
              finalStatus:
                e.target.value === ""
                  ? undefined
                  : (e.target.value as "Vundet" | "Tabt"),
            })
          }
        >
          <option value="">— vælg —</option>
          <option value="Vundet">Vundet</option>
          <option value="Tabt">Tabt</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <span className="label">Kommentar til afvigelse</span>
        <textarea
          className="textarea mt-1 min-h-[80px]"
          value={a.comment ?? ""}
          onChange={(e) => setA({ ...a, comment: e.target.value })}
        />
      </div>
      <div className="md:col-span-2 flex justify-end">
        <button className="btn-primary" onClick={() => onSave(a)}>
          Gem faktisk resultat
        </button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <input
        type="number"
        className="input mt-1"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
      />
    </div>
  );
}
