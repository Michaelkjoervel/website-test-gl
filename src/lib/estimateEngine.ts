// =============================================================================
// estimateEngine
// -----------------------------------------------------------------------------
// Tager TechnicalInput og returnerer et fuldt overslag (priser + energi).
//
// Beregningerne i version 1 er placeholder-baserede og bygger på
// pricingConfig.ts. Når green light leverer rigtige data:
//   - udskift pricingConfig med leverandør- og montagepriser
//   - tilføj kalibrering fra historiske tilbud via learningModel
//   - eventuelt: split modul op pr. produktkategori (industri, kontor, sport)
//
// Alle beregninger her er bevidst rene funktioner – ingen side-effekter.
// =============================================================================

import {
  pricingConfig,
  resolveProduct,
  resolveUnitPrice,
  resolveVariantWatt,
} from "./pricingConfig";
import type {
  EnergyCalculation,
  LuminaireLine,
  EnergyComparisonInput,
  EnergyComparisonResult,
  EstimateConfidence,
  PricingResult,
  TechnicalInput,
} from "./types";

// Læsevenlig etiket for styringsvalget. Håndterer også ældre gemte
// estimater, hvor styringen lå som en enkelt streng (controlType).
export function controlLabel(technical: {
  controlTypes?: string[];
  controlType?: string;
}): string {
  const list =
    technical.controlTypes ??
    (technical.controlType ? [technical.controlType] : []);
  return list.length > 0 ? list.join(" + ") : "Ingen styring";
}

const round = (n: number, decimals = 0) => {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
};

// Find nærmeste konfigurerede faktor for et bestemt lux-niveau.
function lookupFactor(
  table: { lux: number; factor?: number; multiplier?: number }[],
  lux: number,
  key: "factor" | "multiplier",
): number {
  if (table.length === 0) return 1;
  let closest = table[0];
  let minDiff = Math.abs(closest.lux - lux);
  for (const row of table) {
    const diff = Math.abs(row.lux - lux);
    if (diff < minDiff) {
      minDiff = diff;
      closest = row;
    }
  }
  return (closest[key] as number) ?? 1;
}

/**
 * Armaturlinjerne i et estimat. Har estimatet ingen linjer (ældre data),
 * bygges én linje ud fra legacy-felterne, så alt regnes ens.
 */
export function luminaireLinesOf(input: TechnicalInput): LuminaireLine[] {
  if (input.luminaireLines && input.luminaireLines.length > 0) {
    return input.luminaireLines;
  }
  return [
    {
      productId: input.luminaireProductId,
      variantLabel: input.luminaireVariant,
      count: Math.max(0, input.luminaireCount || 0),
      accessories: input.accessories,
    },
  ];
}

export function calculatePricing(input: TechnicalInput): PricingResult {
  const cfg = pricingConfig;

  const luxNum = typeof input.luxLevel === "number" ? input.luxLevel : 300;
  const kelvinKey = String(input.kelvin);
  const kelvinSurcharge = cfg.luminaireByKelvin[kelvinKey] ?? 0;
  const luxFactor = lookupFactor(cfg.luxFactor, luxNum, "factor");
  const areaMult = cfg.areaFactor[input.areaType] ?? 1;

  // Materiale: summen over projektets armaturlinjer. Variantens LISTEPRIS
  // er slutprisen pr. armatur – styring/sensor/TW er inde i prisen.
  const lines = luminaireLinesOf(input);
  const totalCount = lines.reduce((s, l) => s + Math.max(0, l.count || 0), 0);

  let materialCost = 0;
  for (const line of lines) {
    const lineCount = Math.max(0, line.count || 0);
    if (lineCount === 0) continue;
    const product = resolveProduct(input.areaType, line.productId);
    const resolved = resolveUnitPrice(
      product,
      input.controlTypes ?? [],
      input.kelvin,
      line.variantLabel,
    );
    const unitCost =
      resolved.price + (resolved.tunableWhitePriced ? 0 : kelvinSurcharge);
    const accessoriesCost = (line.accessories ?? []).reduce((sum, name) => {
      const acc = product?.accessories?.find((a) => a.name === name);
      return sum + (acc ? acc.pricePerUnit * lineCount : 0);
    }, 0);
    materialCost += unitCost * lineCount * luxFactor + accessoriesCost;
  }

  // Styring: systemet er inkluderet i listeprisen (0 kr i config).
  // Strukturen bevares, så prissatte tilvalg kan tilføjes via Prisdata.
  let controlCost = (input.controlTypes ?? []).reduce((sum, key) => {
    const ctrl = cfg.controlSurcharge[key];
    if (!ctrl) return sum;
    return sum + ctrl.perLuminaire * totalCount + ctrl.fixed;
  }, 0);

  // Gateway ved Tunable White + Gateway: én gateway pr. påbegyndt
  // luminairesPerGateway armaturer.
  if (kelvinKey === "Tunable White + Gateway" && totalCount > 0) {
    const gw = cfg.tunableWhiteGateway;
    controlCost +=
      Math.ceil(totalCount / Math.max(1, gw.luminairesPerGateway)) *
      gw.pricePerGateway;
  }

  // Tilbudsrabat: procent af materiale + styringstilvalg (ikke installation).
  const discountPct = Math.min(100, Math.max(0, input.discountPct ?? 0));
  const discountAmount = (materialCost + controlCost) * (discountPct / 100);

  // Installation – pr. armatur * områdefaktor
  const installationCost = cfg.installationPerLuminaire * totalCount * areaMult;

  const totalCost =
    materialCost + controlCost - discountAmount + installationCost;
  const pricePerLuminaire = totalCount > 0 ? totalCost / totalCount : 0;

  const pct = cfg.budgetRangePct / 100;
  return {
    materialCost: round(materialCost),
    materialPerLuminaire: totalCount > 0 ? round(materialCost / totalCount) : 0,
    installationPerLuminaire:
      totalCount > 0 ? round(installationCost / totalCount) : 0,
    installationCost: round(installationCost),
    discountPct,
    discountAmount: round(discountAmount),
    controlCost: round(controlCost),
    totalCost: round(totalCost),
    pricePerLuminaire: round(pricePerLuminaire),
    budgetRange: {
      low: round(totalCost * (1 - pct)),
      high: round(totalCost * (1 + pct)),
    },
  };
}

/**
 * Læsevenlige etiketter for armaturlinjerne, fx
 * "9 × Rio 2 (60×60)" og "13 × Moon 2 · 165 mm (+ Wireophæng)".
 */
export function luminaireLinesLabels(input: TechnicalInput): string[] {
  const lines = luminaireLinesOf(input);
  const withCount = lines.filter((l) => (l.count || 0) > 0);
  const shown = withCount.length > 0 ? withCount : lines.slice(0, 1);
  return shown.map((line) => {
    const product = resolveProduct(input.areaType, line.productId);
    const name = product?.name ?? "Ukendt armatur";
    const variant =
      line.variantLabel && line.variantLabel !== "Standard"
        ? ` · ${line.variantLabel}`
        : "";
    const acc =
      line.accessories && line.accessories.length > 0
        ? ` (+ ${line.accessories.join(", ")})`
        : "";
    return `${line.count || 0} × ${name}${variant}${acc}`;
  });
}

/**
 * Vægtet gennemsnitlig watt pr. armatur for det nye anlæg (på tværs af
 * armaturlinjerne). Undefined hvis intet antal er angivet endnu.
 */
export function averageNewWatt(input: TechnicalInput): number | undefined {
  const lines = luminaireLinesOf(input);
  let watts = 0;
  let count = 0;
  for (const line of lines) {
    const lineCount = Math.max(0, line.count || 0);
    if (lineCount === 0) continue;
    const product = resolveProduct(input.areaType, line.productId);
    const w =
      resolveVariantWatt(product, line.variantLabel) ??
      pricingConfig.energyDefaults.newWattPerLuminaire;
    watts += w * lineCount;
    count += lineCount;
  }
  if (count === 0) return undefined;
  return watts / count;
}

export function calculateEnergy(
  input: TechnicalInput,
  referenceAnnualKwh?: number,
): EnergyCalculation {
  const cfg = pricingConfig;
  const luxNum = typeof input.luxLevel === "number" ? input.luxLevel : 300;
  const wattMult = lookupFactor(cfg.wattLuxMultiplier, luxNum, "multiplier");

  const wattsPerLuminaire = cfg.luminaireDefaultWatt * wattMult;
  const totalWatts = wattsPerLuminaire * input.luminaireCount;
  const annualKwh = (totalWatts * input.annualBurnHours) / 1000;
  const annualEnergyCost = annualKwh * input.electricityPrice;

  const result: EnergyCalculation = {
    totalWatts: round(totalWatts),
    annualKwh: round(annualKwh),
    annualEnergyCost: round(annualEnergyCost),
  };

  if (referenceAnnualKwh && referenceAnnualKwh > 0) {
    result.referenceAnnualKwh = referenceAnnualKwh;
    const savedKwh = Math.max(0, referenceAnnualKwh - annualKwh);
    result.estimatedAnnualSavings = round(savedKwh * input.electricityPrice);
  }

  return result;
}

// Energi-sammenligning: nuværende installation vs. ny (1:1) løsning.
// Besparelse fra styring lægges oven i forskellen mellem gammelt og nyt armatur.
//   forbrug = antal armaturer × watt × brændetimer / 1000 (kWh/år)
//   styringsbesparelse trækkes fra de nye armaturers forbrug.
export function calculateEnergyComparison(
  input: EnergyComparisonInput,
  electricityPrice: number,
): EnergyComparisonResult {
  const cfg = pricingConfig.energySavings;

  const kwh = (set: { luminaireCount: number; wattPerLuminaire: number; burnHours: number }) =>
    (set.luminaireCount * set.wattPerLuminaire * set.burnHours) / 1000;

  const currentAnnualKwh = kwh(input.current);

  // 1:1-udskiftning: de nye armaturers antal følger det nuværende antal.
  const replacementCount = input.oneToOne
    ? input.current.luminaireCount
    : input.replacement.luminaireCount;

  const newBaseAnnualKwh = kwh({
    luminaireCount: replacementCount,
    wattPerLuminaire: input.replacement.wattPerLuminaire,
    burnHours: input.replacement.burnHours,
  });

  // Tåler både 0.7 og 70 som konfigurationsværdi (normaliseres til andel).
  const normPct = (v: number) => (v > 1 ? v / 100 : v);

  // Styring: besparelse i % af det nye anlægs basisforbrug.
  const controlSavingsPct = input.withControl ? normPct(cfg.control) : 0;
  const controlSavedKwh = newBaseAnnualKwh * controlSavingsPct;
  const newAnnualKwhAfterControl = newBaseAnnualKwh - controlSavedKwh;

  // Dagslysstyring: besparelse i % af det RESTERENDE forbrug efter styring
  // (jf. green lights beregningsmetode) – vises separat.
  const daylightSavingsPct = input.withDaylightControl
    ? normPct(cfg.daylightControl)
    : 0;
  const daylightSavedKwh = newAnnualKwhAfterControl * daylightSavingsPct;

  // Endeligt forventet forbrug inkl. valgte tilvalg.
  const newAnnualKwh = newAnnualKwhAfterControl - daylightSavedKwh;

  const savedKwh = currentAnnualKwh - newAnnualKwh;
  const savedPct = currentAnnualKwh > 0 ? savedKwh / currentAnnualKwh : 0;

  const currentAnnualCost = currentAnnualKwh * electricityPrice;
  const newAnnualCost = newAnnualKwh * electricityPrice;

  return {
    currentAnnualKwh: round(currentAnnualKwh),
    newBaseAnnualKwh: round(newBaseAnnualKwh),
    controlSavingsPct,
    controlSavedKwh: round(controlSavedKwh),
    newAnnualKwhAfterControl: round(newAnnualKwhAfterControl),
    daylightSavingsPct,
    daylightSavedKwh: round(daylightSavedKwh),
    newAnnualKwh: round(newAnnualKwh),
    savedKwh: round(savedKwh),
    savedPct,
    currentAnnualCost: round(currentAnnualCost),
    newAnnualCost: round(newAnnualCost),
    savedAnnualCost: round(savedKwh * electricityPrice),
  };
}

/**
 * Afled "Energi"-nøgletallene (effekt, forbrug, omkostning) fra
 * før/efter-sammenligningen, så alle viste energital bygger på samme
 * grundlag: det nye anlægs antal × faktiske watt, med styringsbesparelse.
 */
export function deriveEnergyFromComparison(
  input: EnergyComparisonInput,
  result: EnergyComparisonResult,
): EnergyCalculation {
  const replacementCount = input.oneToOne
    ? input.current.luminaireCount
    : input.replacement.luminaireCount;
  return {
    totalWatts: round(replacementCount * input.replacement.wattPerLuminaire),
    annualKwh: result.newAnnualKwh,
    annualEnergyCost: result.newAnnualCost,
    referenceAnnualKwh: result.currentAnnualKwh,
    estimatedAnnualSavings: result.savedAnnualCost,
  };
}

// Confidence – baseret på hvor meget brugeren har udfyldt.
export function calculateConfidence(
  input: TechnicalInput,
  customerName: string,
  installerCompany: string,
): EstimateConfidence {
  const checks: { key: string; ok: boolean; label: string; weight: number }[] =
    [
      { key: "customer", ok: !!customerName.trim(), label: "Kundenavn", weight: 8 },
      {
        key: "installer",
        ok: !!installerCompany.trim(),
        label: "Installatør",
        weight: 6,
      },
      {
        key: "area",
        ok: !!input.areaType,
        label: "Områdetype",
        weight: 10,
      },
      {
        key: "count",
        ok: input.luminaireCount > 0,
        label: "Antal armaturer",
        weight: 18,
      },
      {
        key: "control",
        ok: (input.controlTypes ?? []).length > 0,
        label: "Styringsønske",
        weight: 12,
      },
      {
        key: "lux",
        ok: !!input.luxLevel,
        label: "Lux-niveau",
        weight: 12,
      },
      {
        key: "kelvin",
        ok: !!input.kelvin,
        label: "Kelvin",
        weight: 6,
      },
      {
        key: "burn",
        ok: input.annualBurnHours > 0,
        label: "Årlig brændetid",
        weight: 12,
      },
      {
        key: "price",
        ok: input.electricityPrice > 0,
        label: "Elpris",
        weight: 10,
      },
      {
        key: "budget",
        ok: !!input.budgetWish && input.budgetWish > 0,
        label: "Budgetønske",
        weight: 6,
      },
    ];

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  const score = Math.round((got / total) * 100);

  let level: EstimateConfidence["level"] = "Lav";
  if (score >= 80) level = "Høj";
  else if (score >= 55) level = "Middel";

  const missingFields = checks.filter((c) => !c.ok).map((c) => c.label);
  const notes: string[] = [];
  if (level !== "Høj") {
    notes.push(
      "Sikkerheden kan øges ved at udfylde flere felter samt indtaste det faktiske resultat senere.",
    );
  }
  if (level === "Lav") {
    notes.push(
      "Estimatet bør kun bruges som første indikation. Indhent flere oplysninger inden videre dialog.",
    );
  }

  return { level, score, missingFields, notes };
}
