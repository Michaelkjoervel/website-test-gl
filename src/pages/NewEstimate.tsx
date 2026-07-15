import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stepper } from "../components/Stepper";
import { Field } from "../components/Field";
import { ConfidenceMeter } from "../components/Confidence";
import { storage, newId } from "../lib/storage";
import {
  calculateConfidence,
  calculateEnergyComparison,
  calculatePricing,
  controlLabel,
  deriveEnergyFromComparison,
} from "../lib/estimateEngine";
import { suggestAdjustment } from "../lib/learningModel";
import {
  buildLiveBusinessCaseInput,
  computeBusinessCase,
  formatPayback,
  type BusinessCaseResult,
} from "../lib/businessCase";
import {
  pricingConfig,
  productsForArea,
  resolveProduct,
  resolveUnitPrice,
  resolveVariantWatt,
} from "../lib/pricingConfig";
import type {
  AreaType,
  ControlType,
  CustomerEstimate,
  EnergyComparisonInput,
  InstallerInfo,
  KelvinValue,
  TechnicalInput,
} from "../lib/types";
import { dkkInt, num, pct } from "../lib/format";

// Fokusområder i v1 – styres fra pricingConfig (flere kan aktiveres senere)
const AREAS: AreaType[] = pricingConfig.focusAreas;

// Styringssystemer – inkluderet i armaturprisen, vælg ét
const CONTROL_SYSTEMS: ControlType[] = [
  "Simpel on/off",
  "Trådløs styring",
  "DALI",
  "DALI-2",
  "DALI+",
  "Casambi",
  "MasterConnect",
  "SmartScan",
  "Andet",
];

// Tilvalg (kan kombineres, koster ekstra) udledes af config ved render,
// så prissatte tilvalg kan tilføjes senere via Prisdata uden kodeændringer.
function controlAddons(): ControlType[] {
  return Object.keys(pricingConfig.controlSurcharge).filter(
    (key) => !pricingConfig.controlSurcharge[key].exclusive,
  ) as ControlType[];
}

const KELVINS: KelvinValue[] = [
  3000,
  4000,
  5000,
  "Tunable White",
  "Tunable White + Gateway",
];

const LUX_PRESETS = [150, 200, 300, 500, 750];

const STEPS = [
  { id: 1, label: "Projekt" },
  { id: 2, label: "Installatør" },
  { id: 3, label: "Teknisk" },
  { id: 4, label: "Energi" },
  { id: 5, label: "Resultat" },
];

const LAST_STEP = STEPS.length;

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
    luminaireCount: 0,
    luminaireProductId: productsForArea(pricingConfig.defaults.areaType)[0]?.id,
    luminaireVariant:
      productsForArea(pricingConfig.defaults.areaType)[0]?.variants?.[0]?.label,
    accessories: [],
    controlTypes: pricingConfig.defaults.controlTypes,
    luxLevel: pricingConfig.defaults.luxLevel,
    kelvin: pricingConfig.defaults.kelvin,
    annualBurnHours: 0,
    electricityPrice: 0,
    budgetWish: undefined,
    notes: "",
  });

  // Skift styringsform til/fra. Systemer (exclusive) udelukker hinanden;
  // øvrige kan kombineres frit.
  const toggleControl = (c: ControlType) => {
    setTechnical((t) => {
      const selected = t.controlTypes ?? [];
      if (selected.includes(c)) {
        return { ...t, controlTypes: selected.filter((x) => x !== c) };
      }
      const isExclusive = pricingConfig.controlSurcharge[c]?.exclusive;
      const next = isExclusive
        ? selected.filter((x) => !pricingConfig.controlSurcharge[x]?.exclusive)
        : selected;
      return { ...t, controlTypes: [...next, c] };
    });
  };

  // Ved områdeskift: vælg områdets første produkt, hvis det nuværende
  // produkt ikke findes i det nye område – og nulstil variant/tilbehør.
  const setArea = (area: AreaType) => {
    setTechnical((t) => {
      const products = productsForArea(area);
      const keep = products.some((p) => p.id === t.luminaireProductId);
      const product = keep
        ? products.find((p) => p.id === t.luminaireProductId)
        : products[0];
      return {
        ...t,
        areaType: area,
        luminaireProductId: product?.id,
        luminaireVariant: keep
          ? t.luminaireVariant
          : product?.variants?.[0]?.label,
        accessories: keep ? t.accessories : [],
      };
    });
  };

  const [customLux, setCustomLux] = useState(false);

  // Energi-trinnet genbruger brændetimer og elpris fra Teknisk. Antal
  // armaturer forudfyldes fra Teknisk, men det NUVÆRENDE anlæg kan afvige
  // (fx 47 gamle armaturer erstattet af 41 nye) – derfor kan det rettes.
  // Nyt anlægs watt forudfyldes fra den valgte armaturvariant.
  const [energyExtra, setEnergyExtra] = useState({
    currentWattPerLuminaire: pricingConfig.energyDefaults.currentWattPerLuminaire,
    overrideCurrentCount: undefined as number | undefined,
    newWattOverride: undefined as number | undefined,
    oneToOne: true,
    overrideNewCount: undefined as number | undefined,
    withControl: true,
    withDaylightControl: false,
  });

  const pricing = useMemo(() => calculatePricing(technical), [technical]);

  // Nyt anlægs watt: brugerens indtastning > variantens nominelle watt >
  // config-standard. Følger automatisk produkt-/variantvalget.
  const variantWatt = resolveVariantWatt(
    resolveProduct(technical.areaType, technical.luminaireProductId),
    technical.luminaireVariant,
  );
  const newWatt =
    energyExtra.newWattOverride ??
    variantWatt ??
    pricingConfig.energyDefaults.newWattPerLuminaire;

  // Saml det fulde sammenlignings-input ud fra Teknisk + energi-specifikke felter.
  const energyInput: EnergyComparisonInput = useMemo(
    () => ({
      current: {
        luminaireCount:
          energyExtra.overrideCurrentCount ?? technical.luminaireCount,
        wattPerLuminaire: energyExtra.currentWattPerLuminaire,
        burnHours: technical.annualBurnHours,
      },
      replacement: {
        luminaireCount: energyExtra.oneToOne
          ? technical.luminaireCount
          : energyExtra.overrideNewCount ?? technical.luminaireCount,
        wattPerLuminaire: newWatt,
        burnHours: technical.annualBurnHours,
      },
      // 1:1 refererer til det NYE antal fra Teknisk – ikke det nuværende.
      oneToOne: false,
      withControl: energyExtra.withControl,
      withDaylightControl: energyExtra.withDaylightControl,
    }),
    [technical.luminaireCount, technical.annualBurnHours, energyExtra, newWatt],
  );

  const energyComparison = useMemo(
    () => calculateEnergyComparison(energyInput, technical.electricityPrice),
    [energyInput, technical.electricityPrice],
  );

  // Alle viste energital afledes af samme sammenligning (ét grundlag).
  const energy = useMemo(
    () => deriveEnergyFromComparison(energyInput, energyComparison),
    [energyInput, energyComparison],
  );

  // Live forretningscase: investering = det aktuelle prisoverslag, besparelse
  // = før/efter-sammenligningen. Opdateres ved hvert input i energitrinnet.
  const businessCase = useMemo(
    () =>
      computeBusinessCase(
        buildLiveBusinessCaseInput({
          // Montering indgår ikke i tilbagebetalingstiden (jf. green lights
          // beregningsmetode) – kun armaturer og styringstilvalg.
          investment: pricing.materialCost + pricing.controlCost,
          comparison: energyComparison,
          luminaireCount: technical.luminaireCount,
          electricityPrice: technical.electricityPrice,
        }),
      ),
    [
      pricing.totalCost,
      energyComparison,
      technical.luminaireCount,
      technical.electricityPrice,
    ],
  );

  // Live overslaget starter tomt og vises først, når der er tastet et antal.
  const hasEstimate = technical.luminaireCount > 0;
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

  const next = () => setStep((s) => Math.min(LAST_STEP, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  // Hjælper til at opdatere et delfelt i energi-trinnet.
  const setEnergy = (patch: Partial<typeof energyExtra>) =>
    setEnergyExtra((e) => ({ ...e, ...patch }));

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
      energyComparison,
      energyComparisonInput: energyInput,
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
              tooltip="Fokus i første version er kontor og industri. Flere områder tilføjes senere."
              hint="Flere områdetyper (lager, butik, sportshal m.fl.) kommer senere."
            >
              <div className="flex flex-wrap gap-2">
                {AREAS.map((a) => (
                  <button
                    type="button"
                    key={a}
                    onClick={() => setArea(a)}
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
                label={`Antal armaturer${
                  technical.luminaireCount > 0
                    ? `: ${num.format(technical.luminaireCount)}`
                    : ""
                }`}
                tooltip="Det forventede antal armaturer i projektet."
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    className="brand-range flex-1"
                    min={0}
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
                    min={0}
                    placeholder="0"
                    value={technical.luminaireCount || ""}
                    onChange={(e) =>
                      setTechnical({
                        ...technical,
                        luminaireCount: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </Field>

              <Field
                label="Armatur"
                tooltip="Vælg armaturprodukt for det valgte område. Prisen pr. stk. afhænger af variant, styringssystem og kelvin."
              >
                <div className="flex flex-wrap gap-2">
                  {productsForArea(technical.areaType).map((p) => {
                    const active = technical.luminaireProductId === p.id;
                    const shown = resolveUnitPrice(
                      p,
                      technical.controlTypes ?? [],
                      technical.kelvin,
                      active ? technical.luminaireVariant : undefined,
                    );
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() =>
                          setTechnical({
                            ...technical,
                            luminaireProductId: p.id,
                            luminaireVariant: p.variants?.[0]?.label,
                            accessories: [],
                          })
                        }
                        className={`chip border ${
                          active
                            ? "bg-brand-500 text-white border-brand-500"
                            : "bg-white text-ink-soft border-surface-line hover:border-brand-300"
                        }`}
                      >
                        {p.name} · {dkkInt(shown.price)}
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const product = productsForArea(technical.areaType).find(
                    (p) => p.id === technical.luminaireProductId,
                  );
                  if (!product) return null;
                  const variants = product.variants ?? [];
                  const accessories = product.accessories ?? [];
                  if (variants.length <= 1 && accessories.length === 0) {
                    return null;
                  }
                  return (
                    <div className="mt-3 space-y-3">
                      {variants.length > 1 && (
                        <div>
                          <span className="label">Variant</span>
                          <select
                            className="select mt-1"
                            value={
                              technical.luminaireVariant ?? variants[0].label
                            }
                            onChange={(e) =>
                              setTechnical({
                                ...technical,
                                luminaireVariant: e.target.value,
                              })
                            }
                          >
                            {variants.map((v) => (
                              <option key={v.label} value={v.label}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {accessories.length > 0 && (
                        <div>
                          <span className="label">Tilbehør (pr. armatur)</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {accessories.map((a) => {
                              const on = (technical.accessories ?? []).includes(
                                a.name,
                              );
                              return (
                                <button
                                  type="button"
                                  key={a.name}
                                  onClick={() =>
                                    setTechnical({
                                      ...technical,
                                      accessories: on
                                        ? (technical.accessories ?? []).filter(
                                            (x) => x !== a.name,
                                          )
                                        : [
                                            ...(technical.accessories ?? []),
                                            a.name,
                                          ],
                                    })
                                  }
                                  className={`chip border ${
                                    on
                                      ? "bg-brand-500 text-white border-brand-500"
                                      : "bg-white text-ink-soft border-surface-line hover:border-brand-300"
                                  }`}
                                >
                                  {on ? "✓ " : "+ "}
                                  {a.name} · {dkkInt(a.pricePerUnit)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </Field>

              <div className="md:col-span-2">
                <ControlSelector
                  selected={technical.controlTypes ?? []}
                  onToggle={toggleControl}
                />
              </div>

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
                label={`Årlig brændetid${
                  technical.annualBurnHours > 0
                    ? `: ${num.format(technical.annualBurnHours)} timer`
                    : ""
                }`}
                tooltip="Det antal timer armaturerne forventes at være tændt om året."
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    className="brand-range flex-1"
                    min={0}
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
                  <input
                    type="number"
                    className="input w-24"
                    min={0}
                    placeholder="0"
                    value={technical.annualBurnHours || ""}
                    onChange={(e) =>
                      setTechnical({
                        ...technical,
                        annualBurnHours: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </Field>

              <Field
                label="Elpris (kr/kWh)"
                tooltip="Den forventede elpris kunden betaler."
              >
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="0,00"
                  value={technical.electricityPrice || ""}
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
          <section className="card p-6 space-y-6">
            <div>
              <div className="kpi-label">Energibesparelse · overslag</div>
              <p className="text-sm text-ink-mute mt-1">
                Sammenlign den nuværende belysning med den nye løsning.
                Brændetimer og elpris hentes fra det tekniske trin; det nye
                anlægs watt forudfyldes fra det valgte armatur. Det nuværende
                antal armaturer kan rettes, hvis det afviger fra det nye.
              </p>
            </div>

            {/* Forudsætninger hentet fra Teknisk */}
            <div className="rounded-2xl bg-surface-soft border border-surface-line p-4">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-2">
                Hentet fra teknisk
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Row
                  label="Antal armaturer (nyt)"
                  value={num.format(technical.luminaireCount)}
                />
                <Row
                  label="Brændetimer/år"
                  value={num.format(technical.annualBurnHours)}
                />
                <Row
                  label="Elpris"
                  value={`${technical.electricityPrice.toFixed(2)} kr/kWh`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nuværende */}
              <div className="rounded-2xl border border-surface-line p-4 space-y-4">
                <div className="text-sm font-semibold text-ink">
                  Nuværende anlæg
                </div>
                <Field
                  label="Antal armaturer (nuværende)"
                  hint="Forudfyldt fra teknisk – ret hvis det eksisterende antal er anderledes."
                >
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={
                      energyExtra.overrideCurrentCount ??
                      technical.luminaireCount
                    }
                    onChange={(e) =>
                      setEnergy({
                        overrideCurrentCount:
                          e.target.value === ""
                            ? undefined
                            : Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </Field>
                <Field
                  label="Watt pr. armatur (gns.)"
                  tooltip="Gennemsnitligt effektforbrug pr. eksisterende armatur. Har anlægget flere typer, brug et vægtet gennemsnit."
                >
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={energyExtra.currentWattPerLuminaire}
                    onChange={(e) =>
                      setEnergy({
                        currentWattPerLuminaire: Number(e.target.value) || 0,
                      })
                    }
                  />
                </Field>
                <div className="text-[11px] text-ink-mute">
                  {num.format(energyComparison.currentAnnualKwh)} kWh/år ·{" "}
                  {num.format(technical.annualBurnHours)} timer/år
                </div>
              </div>

              {/* Nyt */}
              <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-ink">
                    Ny løsning
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnergy({ oneToOne: !energyExtra.oneToOne })}
                    className={`chip border ${
                      energyExtra.oneToOne
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-white text-ink-soft border-surface-line"
                    }`}
                  >
                    1:1 udskiftning
                  </button>
                </div>
                <Field
                  label="Antal armaturer"
                  hint={
                    energyExtra.oneToOne
                      ? "Følger antallet fra teknisk (1:1)."
                      : undefined
                  }
                >
                  <input
                    type="number"
                    min={0}
                    className="input disabled:opacity-50"
                    disabled={energyExtra.oneToOne}
                    value={
                      energyExtra.oneToOne
                        ? technical.luminaireCount
                        : energyExtra.overrideNewCount ?? technical.luminaireCount
                    }
                    onChange={(e) =>
                      setEnergy({
                        overrideNewCount:
                          e.target.value === ""
                            ? undefined
                            : Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </Field>
                <Field
                  label="Watt pr. nyt armatur"
                  tooltip="Effektforbrug pr. nyt LED-armatur. Forudfyldt fra det valgte armatur – ryd feltet for at vende tilbage til den automatiske værdi."
                  hint={
                    energyExtra.newWattOverride === undefined
                      ? variantWatt !== undefined
                        ? `Automatisk fra valgt armatur: ${variantWatt} W.`
                        : undefined
                      : variantWatt !== undefined
                      ? `Rettet manuelt – valgt armatur er ${variantWatt} W (ryd feltet for automatisk).`
                      : "Rettet manuelt."
                  }
                >
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={newWatt}
                    onChange={(e) =>
                      setEnergy({
                        newWattOverride:
                          e.target.value === ""
                            ? undefined
                            : Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </Field>
              </div>
            </div>

            {/* Styringsbesparelse */}
            <Field
              label="Tillæg af besparelse ved styring"
              tooltip={`Styring sparer ca. ${pct(
                pricingConfig.energySavings.control,
                0,
              )} af det nye anlægs forbrug. Dagslysstyring sparer yderligere ca. ${pct(
                pricingConfig.energySavings.daylightControl,
                0,
              )} af det resterende forbrug og vises separat.`}
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEnergy({
                      withControl: !energyExtra.withControl,
                      withDaylightControl: energyExtra.withControl
                        ? false
                        : energyExtra.withDaylightControl,
                    })
                  }
                  className={`chip border ${
                    energyExtra.withControl
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-ink-soft border-surface-line hover:border-brand-300"
                  }`}
                >
                  Styring −{pct(pricingConfig.energySavings.control, 0)}
                </button>
                <button
                  type="button"
                  disabled={!energyExtra.withControl}
                  onClick={() =>
                    setEnergy({
                      withDaylightControl: !energyExtra.withDaylightControl,
                    })
                  }
                  className={`chip border disabled:opacity-40 ${
                    energyExtra.withDaylightControl
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-white text-ink-soft border-surface-line hover:border-brand-300"
                  }`}
                >
                  + Dagslys −{pct(pricingConfig.energySavings.daylightControl, 0)}{" "}
                  af resten
                </button>
              </div>
            </Field>

            {/* Live resultat */}
            <div className="rounded-2xl bg-surface-soft border border-surface-line p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SmallStat
                  label="Nuværende forbrug"
                  value={`${num.format(energyComparison.currentAnnualKwh)} kWh`}
                />
                <SmallStat
                  label="Nyt forbrug"
                  value={`${num.format(energyComparison.newAnnualKwh)} kWh`}
                />
                <SmallStat
                  label="Sparet pr. år"
                  value={`${num.format(energyComparison.savedKwh)} kWh`}
                />
                <SmallStat
                  label="Besparelse"
                  value={pct(energyComparison.savedPct, 0)}
                />
              </div>
              {energyComparison.daylightSavedKwh > 0 && (
                <div className="text-[11px] text-ink-mute">
                  Heraf anslået dagslysbesparelse:{" "}
                  {num.format(energyComparison.daylightSavedKwh)} kWh/år (
                  {pct(energyComparison.daylightSavingsPct, 0)} af det
                  resterende forbrug efter styring).
                </div>
              )}
            </div>

            {/* Live forretningscase */}
            <BusinessCasePanel businessCase={businessCase} />
          </section>
        )}

        {step === 5 && (
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
              <SmallStat
                label="Styringstilvalg"
                value={dkkInt(pricing.controlCost)}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SmallStat
                label="Armaturpris pr. stk."
                value={dkkInt(pricing.materialPerLuminaire)}
              />
              <SmallStat
                label="Installation pr. armatur"
                value={dkkInt(pricing.installationPerLuminaire)}
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

            {/* Energibesparelse (før/efter) */}
            <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-ink">
                  Energibesparelse · før/efter
                </div>
                <span className="chip bg-brand-500 text-white">
                  −{pct(energyComparison.savedPct, 0)} pr. år
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SmallStat
                  label="Nuværende"
                  value={`${num.format(energyComparison.currentAnnualKwh)} kWh`}
                />
                <SmallStat
                  label="Ny løsning"
                  value={`${num.format(energyComparison.newAnnualKwh)} kWh`}
                />
                <SmallStat
                  label="Sparet"
                  value={`${num.format(energyComparison.savedKwh)} kWh`}
                />
                <SmallStat
                  label="Sparet i kr./år"
                  value={dkkInt(energyComparison.savedAnnualCost)}
                />
              </div>
              {energyComparison.controlSavingsPct > 0 && (
                <div className="text-[11px] text-ink-mute mt-2">
                  Inkl. styringsbesparelse på{" "}
                  {pct(energyComparison.controlSavingsPct, 0)} af det nye
                  anlægs forbrug
                  {energyComparison.daylightSavedKwh > 0 && (
                    <>
                      {" "}
                      samt anslået dagslysbesparelse på{" "}
                      {num.format(energyComparison.daylightSavedKwh)} kWh/år (
                      {pct(energyComparison.daylightSavingsPct, 0)} af det
                      resterende)
                    </>
                  )}
                  .
                </div>
              )}
            </div>

            {businessCase.hasData && (
              <BusinessCasePanel businessCase={businessCase} compact />
            )}

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
          {step < LAST_STEP ? (
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

          {hasEstimate ? (
            <>
              <div className="text-3xl font-bold text-ink mt-1">
                {dkkInt(pricing.totalCost)}
              </div>
              <div className="text-xs text-ink-mute">
                {dkkInt(pricing.budgetRange.low)} –{" "}
                {dkkInt(pricing.budgetRange.high)}
              </div>

              {/* Opdeling så armaturprisen ikke blandes med installation */}
              <div className="mt-4 pt-4 border-t border-surface-line space-y-2">
                <Row label="Materiale" value={dkkInt(pricing.materialCost)} />
                <Row
                  label="Installation"
                  value={dkkInt(pricing.installationCost)}
                />
                {pricing.controlCost > 0 && (
                  <Row
                    label="Styringstilvalg"
                    value={dkkInt(pricing.controlCost)}
                  />
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-surface-line space-y-2">
                <Row
                  label="Antal armaturer"
                  value={num.format(technical.luminaireCount)}
                />
                <Row label="Styring" value={controlLabel(technical)} />
                <Row
                  label="Lux / Kelvin"
                  value={`${technical.luxLevel} lux · ${String(
                    technical.kelvin,
                  )}`}
                />
                <Row
                  label="Armaturpris pr. stk."
                  value={dkkInt(pricing.materialPerLuminaire)}
                />
                <Row
                  label="Installation pr. armatur"
                  value={dkkInt(pricing.installationPerLuminaire)}
                />
                <Row
                  label="Årligt forbrug"
                  value={`${num.format(energy.annualKwh)} kWh`}
                />
                <Row
                  label="Energibesparelse"
                  value={`${pct(energyComparison.savedPct, 0)} · ${dkkInt(
                    energyComparison.savedAnnualCost,
                  )}/år`}
                />
                {businessCase.hasData && (
                  <Row
                    label="Tilbagebetaling"
                    value={
                      businessCase.paybackYears === null
                        ? "—"
                        : formatPayback(businessCase.paybackYears)
                    }
                  />
                )}
              </div>
            </>
          ) : (
            <div className="mt-2">
              <div className="text-3xl font-bold text-ink-mute/40">—</div>
              <p className="text-xs text-ink-mute mt-2 leading-relaxed">
                Udfyld antal armaturer på det tekniske trin for at se
                overslaget.
              </p>
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-surface-line">
            <ConfidenceMeter confidence={confidence} />
          </div>
        </div>
      </aside>
    </div>
  );
}

// Grupperet styringsvælger: systemer (inkl. i armaturprisen, vælg ét)
// og tilvalg (koster ekstra, kan kombineres).
function ControlSelector({
  selected,
  onToggle,
}: {
  selected: ControlType[];
  onToggle: (c: ControlType) => void;
}) {
  return (
    <div className="rounded-2xl border border-surface-line overflow-hidden">
      <div className="px-4 py-3 bg-surface-soft border-b border-surface-line flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-ink">Ønske til styring</div>
          <div className="text-[11px] text-ink-mute mt-0.5">
            {selected.length === 0
              ? "Intet valgt endnu – vælg system og eventuelle tilvalg."
              : `Valgt: ${selected.join(" + ")}`}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Systemer */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
              Styringssystem
            </span>
            <span className="chip bg-brand-50 text-brand-700 text-[10px]">
              Inkluderet i armaturprisen · vælg ét
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CONTROL_SYSTEMS.map((c) => {
              const isSelected = selected.includes(c);
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => onToggle(c)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                    isSelected
                      ? "border-brand-500 bg-brand-50 text-ink font-semibold shadow-glow"
                      : "border-surface-line bg-white text-ink-soft hover:border-brand-300"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "border-brand-500 bg-brand-500"
                        : "border-surface-line bg-white"
                    }`}
                  >
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="truncate">{c}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tilvalg – vises kun hvis der findes prissatte tilvalg i config */}
        {controlAddons().length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
              Tilvalg
            </span>
            <span className="chip bg-amber-50 text-amber-700 text-[10px]">
              Koster ekstra · kan kombineres
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {controlAddons().map((c) => {
              const isSelected = selected.includes(c);
              const price =
                pricingConfig.controlSurcharge[c]?.perLuminaire ?? 0;
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => onToggle(c)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                    isSelected
                      ? "border-brand-500 bg-brand-50 text-ink font-semibold shadow-glow"
                      : "border-surface-line bg-white text-ink-soft hover:border-brand-300"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "border-brand-500 bg-brand-500"
                        : "border-surface-line bg-white"
                    }`}
                  >
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="#fff"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 truncate">{c}</span>
                  <span
                    className={`text-[11px] font-semibold shrink-0 ${
                      isSelected ? "text-brand-700" : "text-ink-mute"
                    }`}
                  >
                    +{dkkInt(price)}/armatur
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}
        <p className="text-[11px] text-ink-mute">
          Styringssystemet er inkluderet i armaturets listepris. Gateway
          tilvælges under Kelvin (Tunable White + Gateway) og koster{" "}
          {dkkInt(pricingConfig.tunableWhiteGateway.pricePerGateway)} pr.
          påbegyndt {pricingConfig.tunableWhiteGateway.luminairesPerGateway}{" "}
          armaturer.
        </p>
      </div>
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

// Live forretningscase i energitrinnet: tilbagebetaling, gevinst og CO₂
// beregnet ud fra det aktuelle prisoverslag og før/efter-sammenligningen.
function BusinessCasePanel({
  businessCase,
  compact,
}: {
  businessCase: BusinessCaseResult;
  compact?: boolean;
}) {
  const bc = businessCase;
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="text-sm font-semibold text-ink">
          Forretningscase{compact ? "" : " · live"}
        </div>
        {bc.hasData && (
          <span className="chip bg-brand-500 text-white">
            {bc.paybackYears === null
              ? "Uden tilbagebetaling i perioden"
              : `Tilbagebetalt på ${formatPayback(bc.paybackYears)}`}
          </span>
        )}
      </div>

      {bc.hasData ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SmallStat
              label="Sparet pr. år"
              value={dkkInt(bc.firstYearTotalSavingsKr)}
            />
            <SmallStat
              label={`Nettogevinst · ${bc.horizonYears} år`}
              value={dkkInt(bc.horizonNetSavings)}
            />
            <SmallStat
              label={`Afkast · ${bc.horizonYears} år`}
              value={`${num.format(Math.round(bc.roiPct))}%`}
            />
            <SmallStat
              label="CO₂ sparet pr. år"
              value={`${num.format(Math.round(bc.co2.annualKg))} kg`}
            />
          </div>
          <div className="text-[11px] text-ink-mute mt-2">
            Beregnet ud fra investeringen i armaturer og styringstilvalg (
            {dkkInt(bc.investment)}, ekskl. montering) og en el-prisstigning
            på {bc.escalationPct.toLocaleString("da-DK")}% pr. år.{" "}
            {compact
              ? "Den fulde kundevendte præsentation åbnes fra estimatet med knappen “Forretningscase”."
              : "Gem estimatet for at åbne den fulde kundevendte præsentation."}
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-mute">
          Udfyld antal armaturer, brændetimer og elpris på det tekniske trin —
          så beregnes tilbagebetalingstid, gevinst og CO₂ automatisk her.
        </p>
      )}
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
