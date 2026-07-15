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

import { pricingConfig, resolveProduct, resolveUnitPrice } from "./pricingConfig";
import type {
  EnergyCalculation,
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

export function calculatePricing(input: TechnicalInput): PricingResult {
  const cfg = pricingConfig;
  const count = Math.max(0, input.luminaireCount || 0);

  const luxNum = typeof input.luxLevel === "number" ? input.luxLevel : 300;
  const kelvinKey = String(input.kelvin);
  const kelvinSurcharge = cfg.luminaireByKelvin[kelvinKey] ?? 0;
  const luxFactor = lookupFactor(cfg.luxFactor, luxNum, "factor");
  const areaMult = cfg.areaFactor[input.areaType] ?? 1;

  // Materiale: variantens LISTEPRIS er slutprisen pr. armatur – styring,
  // sensor og evt. Tunable White er allerede inde i prisen. Kelvin-tillæg
  // og lux-faktor står til 0/1 i config, men mekanismen bevares.
  const product = resolveProduct(input.areaType, input.luminaireProductId);
  const resolved = resolveUnitPrice(
    product,
    input.controlTypes ?? [],
    input.kelvin,
    input.luminaireVariant,
  );

  const luminaireUnitCost =
    resolved.price + (resolved.tunableWhitePriced ? 0 : kelvinSurcharge);

  // Tilbehør (fx wireophæng, påbygningsramme) – pris pr. armatur.
  const accessoriesCost = (input.accessories ?? []).reduce((sum, name) => {
    const acc = product?.accessories?.find((a) => a.name === name);
    return sum + (acc ? acc.pricePerUnit * count : 0);
  }, 0);

  const materialCost = luminaireUnitCost * count * luxFactor + accessoriesCost;

  // Styring: systemet er inkluderet i listeprisen (0 kr i config).
  // Strukturen bevares, så prissatte tilvalg kan tilføjes via Prisdata.
  let controlCost = (input.controlTypes ?? []).reduce((sum, key) => {
    const ctrl = cfg.controlSurcharge[key];
    if (!ctrl) return sum;
    return sum + ctrl.perLuminaire * count + ctrl.fixed;
  }, 0);

  // Gateway ved Tunable White + Gateway: én gateway pr. påbegyndt
  // luminairesPerGateway armaturer.
  if (kelvinKey === "Tunable White + Gateway" && count > 0) {
    const gw = cfg.tunableWhiteGateway;
    controlCost +=
      Math.ceil(count / Math.max(1, gw.luminairesPerGateway)) *
      gw.pricePerGateway;
  }

  // Installation – pr. armatur * områdefaktor
  const installationCost = cfg.installationPerLuminaire * count * areaMult;

  const totalCost = materialCost + controlCost + installationCost;
  const pricePerLuminaire = count > 0 ? totalCost / count : 0;

  const pct = cfg.budgetRangePct / 100;
  return {
    materialCost: round(materialCost),
    materialPerLuminaire: count > 0 ? round(materialCost / count) : 0,
    installationPerLuminaire: count > 0 ? round(installationCost / count) : 0,
    installationCost: round(installationCost),
    controlCost: round(controlCost),
    totalCost: round(totalCost),
    pricePerLuminaire: round(pricePerLuminaire),
    budgetRange: {
      low: round(totalCost * (1 - pct)),
      high: round(totalCost * (1 + pct)),
    },
  };
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
