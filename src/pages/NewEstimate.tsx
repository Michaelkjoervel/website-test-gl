import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stepper } from "../components/Stepper";
import { Field } from "../components/Field";
import { ConfidenceMeter } from "../components/Confidence";
import { storage, newId } from "../lib/storage";
import {
  calculateConfidence,
  calculateEnergy,
  calculatePricing,
} from "../lib/estimateEngine";
import { suggestAdjustment } from "../lib/learningModel";
import { pricingConfig } from "../lib/pricingConfig";
import type {
  AreaType,
  ControlType,
  CustomerEstimate,
  InstallerInfo,
  KelvinValue,
  TechnicalInput,
} from "../lib/types";
import { dkkInt, num } from "../lib/format";

const AREAS: AreaType[] = [
  "Lager",
  "Produktion",
  "Kontor",
  "Butik",
  "Skole",
  "Sportshal",
  "Parkering",
  "Udendørs",
  "Andet",
];

const CONTROLS: ControlType[] = [
  "Ingen styring",
  "Simpel on/off",
  "Dagslysstyring",
  "Bevægelsessensor",
  "Trådløs styring",
  "DALI",
  "MasterConnect",
  "Andet",
];

const KELVINS: KelvinValue[] = [3000, 4000, 5000, "Tunable White"];

const LUX_PRESETS = [150, 200, 300, 500, 750];

const STEPS = [
  { id: 1, label: "Projekt" },
  { id: 2, label: "Installatør" },
  { id: 3, label: "Teknisk" },
  { id: 4, label: "Resultat" },
];

export function NewEstimate() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");

  const [installer, setInstaller] = useState<InstallerInfo>({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
  });

  const [technical, setTechnical] = useState<TechnicalInput>({
    areaType: pricingConfig.defaults.areaType,
    luminaireCount: pricingConfig.defaults.luminaireCount,
    controlType: pricingConfig.defaults.controlType,
    luxLevel: pricingConfig.defaults.luxLevel,
    kelvin: pricingConfig.defaults.kelvin,
    annualBurnHours: pricingConfig.defaults.annualBurnHours,
    electricityPrice: pricingConfig.defaults.electricityPrice,
    budgetWish: undefined,
    notes: "",
  });

  const [customLux, setCustomLux] = useState(false);

  const pricing = useMemo(() => calculatePricing(technical), [technical]);
  const energy = useMemo(() => calculateEnergy(technical), [technical]);
  const confidence = useMemo(
    () =>
      calculateConfidence(
        technical,
        customerName,
        installer.companyName,
      ),
    [technical, customerName, installer.companyName],
  );

  const learning = useMemo(
    () =>
      suggestAdjustment(
        technical,
        storage.listHistorical(),
        storage.listEstimates(),
      ),
    [technical],
  );

  const next = () => setStep((s) => Math.min(4, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const save = () => {
    const id = newId();
    const now = new Date().toISOString();
    const est: CustomerEstimate = {
      id,
      createdAt: now,
      updatedAt: now,
      projectName,
      customerName,
      installer,
      technical,
      pricing,
      energy,
      confidence,
      status: "Kladde",
      learningAdjustmentPct: learning.averageDeltaPct,
      learningNote: learning.message,
    };
    storage.saveEstimate(est);
    navigate(`/estimat/${id}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div>
        <Stepper current={step} steps={STEPS} />

        {step === 1 && (
          <section className="card p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Kundenavn" required>
                <input
                  className="input"
                  placeholder="Fx Acme Industries A/S"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </Field>
              <Field label="Projektnavn" required>
                <input
                  className="input"
                  placeholder="Fx Renovering lagerhal nord"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Område"
              required
              tooltip="Områdetypen påvirker installations- og kompleksitetsfaktor."
            >
              <div className="flex flex-wrap gap-2">
                {AREAS.map((a) => (
                  <button
                    type="button"
                    key={a}
                    onClick={() => setTechnical({ ...technical, areaType: a })}
                    className={`chip border ${
                      technical.areaType === a
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-white text-ink-soft border-surface-line hover:border-brand-300"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </Field>
          </section>
        )}

        {step === 2 && (
          <section className="card p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Installatørfirma">
                <input
                  className="input"
                  value={installer.companyName}
                  onChange={(e) =>
                    setInstaller({ ...installer, companyName: e.target.value })
                  }
                  placeholder="El-Installation ApS"
                />
              </Field>
              <Field label="Kontaktperson">
                <input
                  className="input"
                  value={installer.contactPerson}
                  onChange={(e) =>
                    setInstaller({ ...installer, contactPerson: e.target.value })
                  }
                  placeholder="Navn på kontakt"
                />
              </Field>
              <Field label="Telefon">
                <input
                  className="input"
                  value={installer.phone}
                  onChange={(e) =>
                    setInstaller({ ...installer, phone: e.target.value })
                  }
                  placeholder="+45 ..."
                />
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  className="input"
                  value={installer.email}
                  onChange={(e) =>
                    setInstaller({ ...installer, email: e.target.value })
                  }
                  placeholder="kontakt@firma.dk"
                />
              </Field>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="card p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field
                label={`Antal armaturer: ${num.format(
                  technical.luminaireCount,
                )}`}
                tooltip="Det forventede antal armaturer i projektet."
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    className="brand-range flex-1"
                    min={1}
                    max={500}
                    step={1}
                    value={technical.luminaireCount}
                    onChange={(e) =>
                      setTechnical({
                        ...technical,
                        luminaireCount: Number(e.target.value),
                      })
                    }
                  />
                  <input
                    type="number"
                    className="input w-24"
                    min={1}
                    value={technical.luminaireCount}
                    onChange={(e) =>
                      setTechnical({
                        ...technical,
                        luminaireCount: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </Field>

              <Field label="Ønske til styring" tooltip="Styringssystemet påvirker pris og energibesparelse.">
                <select
                  className="select"
                  value={technical.controlType}
                  onChange={(e) =>
                    setTechnical({
                      ...technical,
                      controlType: e.target.value as ControlType,
                    })
                  }
                >
                  {CONTROLS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Ønske til lux" tooltip="Det ønskede belysningsniveau på arbejdsplanen.">
                <div className="flex flex-wrap gap-2">
                  {LUX_PRESETS.map((l) => (
                    <button
                      type="button"
                      key={l}
                      onClick={() => {
                        setCustomLux(false);
                        setTechnical({ ...technical, luxLevel: l });
                      }}
                      className={`chip border ${
                        !customLux && technical.luxLevel === l
                          ? "bg-brand-500 text-white border-brand-500"
                          : "bg-white text-ink-soft border-surface-line hover:border-brand-300"
                      }`}
                    >
                      {l} lux
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCustomLux(true)}
                    className={`chip border ${
                      customLux
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-white text-ink-soft border-surface-line hover:border-brand-300"
                    }`}
                  >
                    Brugerdefineret
                  </button>
                </div>
                {customLux && (
                  <input
                    type="number"
                    className="input mt-2"
                    placeholder="lux"
                    value={
                      typeof technical.luxLevel === "number"
                        ? technical.luxLevel
                        : ""
                    }
                    onChange={(e) =>
                      setTechnical({
                        ...technical,
                        luxLevel: Number(e.target.value) || 0,
                      })
                    }
                  />
                )}
              </Field>

              <Field label="Kelvin">
                <div className="flex flex-wrap gap-2">
                  {KELVINS.map((k) => (
                    <button
                      type="button"
                      key={String(k)}
                      onClick={() => setTechnical({ ...technical, kelvin: k })}
                      className={`chip border ${
                        technical.kelvin === k
                          ? "bg-brand-500 text-white border-brand-500"
                          : "bg-white text-ink-soft border-surface-line hover:border-brand-300"
                      }`}
                    >
                      {String(k)}
                      {k !== "Tunable White" ? "K" : ""}
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label={`Årlig brændetid: ${num.format(
                  technical.annualBurnHours,
                )} timer`}
                tooltip="Det antal timer armaturerne forventes at være tændt om året."
              >
                <input
                  type="range"
                  className="brand-range"
                  min={500}
                  max={8760}
                  step={100}
                  value={technical.annualBurnHours}
                  onChange={(e) =>
                    setTechnical({
                      ...technical,
                      annualBurnHours: Number(e.target.value),
                    })
                  }
                />
              </Field>

              <Field
                label="Elpris (kr/kWh)"
                tooltip="Den forventede elpris kunden betaler."
              >
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={technical.electricityPrice}
                  onChange={(e) =>
                    setTechnical({
                      ...technical,
                      electricityPrice: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>

              <Field
                label="Budgetønske / krav (DKK)"
                tooltip="Valgfrit. Bruges til at vurdere om estimatet ligger inden for kundens budget."
              >
                <input
                  type="number"
                  className="input"
                  value={technical.budgetWish ?? ""}
                  placeholder="Valgfri"
                  onChange={(e) =>
                    setTechnical({
                      ...technical,
                      budgetWish: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </Field>

              <Field label="Område (m²)" tooltip="Valgfrit. Forbedrer kvaliteten af lysberegningen.">
                <input
                  type="number"
                  className="input"
                  value={technical.areaSqm ?? ""}
                  placeholder="Valgfri"
                  onChange={(e) =>
                    setTechnical({
                      ...technical,
                      areaSqm: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </Field>
            </div>

            <Field label="Bemærkninger">
              <textarea
                className="textarea min-h-[80px]"
                value={technical.notes ?? ""}
                onChange={(e) =>
                  setTechnical({ ...technical, notes: e.target.value })
                }
                placeholder="Særlige forhold, installation, ønsker mv."
              />
            </Field>
          </section>
        )}

        {step === 4 && (
          <section className="card p-6 space-y-5">
            <div>
              <div className="kpi-label">Foreløbigt estimat</div>
              <div className="text-4xl font-bold text-ink mt-1">
                {dkkInt(pricing.totalCost)}
              </div>
              <div className="text-sm text-ink-mute mt-1">
                Forventet interval {dkkInt(pricing.budgetRange.low)} –{" "}
                {dkkInt(pricing.budgetRange.high)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SmallStat label="Materiale" value={dkkInt(pricing.materialCost)} />
              <SmallStat
                label="Installation"
                value={dkkInt(pricing.installationCost)}
              />
              <SmallStat label="Styring" value={dkkInt(pricing.controlCost)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SmallStat
                label="Pris pr. armatur"
                value={dkkInt(pricing.pricePerLuminaire)}
              />
              <SmallStat
                label="Årligt forbrug"
                value={`${num.format(energy.annualKwh)} kWh`}
              />
              <SmallStat
                label="Årlig el-omkostning"
                value={dkkInt(energy.annualEnergyCost)}
              />
            </div>

            <LearningCard learning={learning} />

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900 leading-relaxed">
              <strong>Forbehold:</strong> Dette estimat er vejledende og baseret
              på de indtastede oplysninger samt green lights interne
              beregningsgrundlag. Estimatet er ikke et bindende tilbud og kan
              ændre sig efter nærmere gennemgang, lysberegning, teknisk
              afklaring og endelig projektering.
            </div>
          </section>
        )}

        <div className="flex items-center justify-between mt-5">
          <button
            type="button"
            className="btn-ghost"
            onClick={prev}
            disabled={step === 1}
            style={{ visibility: step === 1 ? "hidden" : "visible" }}
          >
            ← Tilbage
          </button>
          {step < 4 ? (
            <button type="button" className="btn-primary" onClick={next}>
              Næste →
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={save}>
              Gem estimat
            </button>
          )}
        </div>
      </div>

      {/* Live summary sidebar */}
      <aside className="space-y-4">
        <div className="card p-5 sticky top-24">
          <div className="kpi-label">Live overslag</div>
          <div className="text-3xl font-bold text-ink mt-1">
            {dkkInt(pricing.totalCost)}
          </div>
          <div className="text-xs text-ink-mute">
            {dkkInt(pricing.budgetRange.low)} – {dkkInt(pricing.budgetRange.high)}
          </div>

          <div className="mt-5 space-y-2">
            <Row label="Antal armaturer" value={num.format(technical.luminaireCount)} />
            <Row label="Styring" value={technical.controlType} />
            <Row
              label="Lux / Kelvin"
              value={`${technical.luxLevel} lux · ${String(technical.kelvin)}`}
            />
            <Row
              label="Pris pr. armatur"
              value={dkkInt(pricing.pricePerLuminaire)}
            />
            <Row
              label="Årligt forbrug"
              value={`${num.format(energy.annualKwh)} kWh`}
            />
          </div>

          <div className="mt-5 pt-5 border-t border-surface-line">
            <ConfidenceMeter confidence={confidence} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-mute">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-soft border border-surface-line px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-ink-mute">
        {label}
      </div>
      <div className="font-bold text-ink mt-0.5">{value}</div>
    </div>
  );
}

function LearningCard({
  learning,
}: {
  learning: ReturnType<typeof suggestAdjustment>;
}) {
  const colors = {
    Ingen: "bg-surface-soft text-ink-mute border-surface-line",
    Begrænset: "bg-amber-50 text-amber-800 border-amber-200",
    Brugbar: "bg-brand-50 text-brand-700 border-brand-100",
    Stærk: "bg-brand-500 text-white border-brand-500",
  };
  return (
    <div className={`rounded-xl px-4 py-3 border ${colors[learning.maturity]}`}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
        <span>Læringsmodul</span>
        <span>{learning.maturity} grundlag</span>
      </div>
      <div className="text-sm font-medium mt-1.5">{learning.message}</div>
    </div>
  );
}
