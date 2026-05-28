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

import { pricingConfig } from "./pricingConfig";
import type {
  EnergyCalculation,
  EnergyComparisonInput,
  EnergyComparisonResult,
  EstimateConfidence,
  PricingResult,
  TechnicalInput,
} from "./types";

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

  // Materiale: armaturpris * antal * luxfaktor
  const luminaireUnitCost = cfg.luminaireBaseCost + kelvinSurcharge;
  const materialCost = luminaireUnitCost * count * luxFactor;

  // Styring – pr. armatur + fast tillæg
  const ctrl = cfg.controlSurcharge[input.controlType] ?? {
    perLuminaire: 0,
    fixed: 0,
  };
  const controlCost = ctrl.perLuminaire * count + ctrl.fixed;

  // Installation – pr. armatur * områdefaktor
  const installationCost = cfg.installationPerLuminaire * count * areaMult;

  const totalCost = materialCost + controlCost + installationCost;
  const pricePerLuminaire = count > 0 ? totalCost / count : 0;

  const pct = cfg.budgetRangePct / 100;
  return {
    materialCost: round(materialCost),
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

  // Styringsbesparelse: styring 50% + evt. dagslysstyring yderligere 20%.
  const controlSavingsPct = Math.min(
    1,
    (input.withControl ? cfg.control : 0) +
      (input.withDaylightControl ? cfg.daylightControl : 0),
  );

  const newAnnualKwh = newBaseAnnualKwh * (1 - controlSavingsPct);

  const savedKwh = currentAnnualKwh - newAnnualKwh;
  const savedPct = currentAnnualKwh > 0 ? savedKwh / currentAnnualKwh : 0;

  const currentAnnualCost = currentAnnualKwh * electricityPrice;
  const newAnnualCost = newAnnualKwh * electricityPrice;

  return {
    currentAnnualKwh: round(currentAnnualKwh),
    newBaseAnnualKwh: round(newBaseAnnualKwh),
    controlSavingsPct,
    newAnnualKwh: round(newAnnualKwh),
    savedKwh: round(savedKwh),
    savedPct,
    currentAnnualCost: round(currentAnnualCost),
    newAnnualCost: round(newAnnualCost),
    savedAnnualCost: round(savedKwh * electricityPrice),
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
        ok: !!input.controlType,
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
