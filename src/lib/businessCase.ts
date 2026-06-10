// =============================================================================
// businessCase
// -----------------------------------------------------------------------------
// Bygger den kundevendte "forretningscase" oven på et eksisterende estimat:
// investering, årlig besparelse, tilbagebetalingstid, akkumuleret cashflow over
// en årrække samt CO₂-besparelse omsat til genkendelige størrelser.
//
// Som resten af lib/ er alt her rene funktioner uden side-effekter, og alle
// antagelser hentes fra pricingConfig.businessCase – så green light kan ændre
// satserne ét sted uden at røre UI'et.
// =============================================================================

import {
  calculateConfidence,
  calculateEnergy,
  calculateEnergyComparison,
  calculatePricing,
} from "./estimateEngine";
import { pricingConfig } from "./pricingConfig";
import type {
  CustomerEstimate,
  EnergyComparisonResult,
  TechnicalInput,
} from "./types";

export interface BusinessCaseAssumptions {
  horizonYears: number;
  escalationPct: number; // forventet årlig el-prisstigning i procent (fx 3)
}

export interface BusinessCaseInput {
  investment: number; // kr – typisk pricing.totalCost
  annualEnergySavingsKr: number; // år 1, før eskalering
  annualMaintenanceSavingsKr: number; // år 1
  annualKwhSaved: number;
  currentAnnualKwh: number;
  newAnnualKwh: number;
  electricityPrice: number; // kr/kWh (til visning)
}

export interface YearPoint {
  year: number; // 0..horizon
  annualSavings: number; // årets besparelse (kr)
  cumulativeSavings: number; // akkumuleret besparelse til og med året
  netPosition: number; // cumulativeSavings - investment
}

export interface Co2Result {
  factorKgPerKwh: number;
  annualKg: number;
  horizonKg: number;
  trees: number; // træer der optager den årlige besparelse
  cars: number; // personbiler taget af vejen (et år)
  flights: number; // flyrejser CPH–London t/r (et år)
}

export interface BusinessCaseResult {
  hasData: boolean;
  investment: number;
  annualEnergySavingsKr: number;
  annualMaintenanceSavingsKr: number;
  firstYearTotalSavingsKr: number;
  annualKwhSaved: number;
  currentAnnualKwh: number;
  newAnnualKwh: number;
  savedPct: number;
  paybackYears: number | null; // null hvis casen aldrig tjener sig hjem
  horizonYears: number;
  horizonGrossSavings: number; // samlet besparelse over perioden
  horizonNetSavings: number; // efter investering
  roiPct: number; // horizonNetSavings / investment * 100
  series: YearPoint[];
  breakEvenYear: number | null; // brøkår hvor nettoet krydser 0
  co2: Co2Result;
  householdsEquivalent: number; // årlig kWh-besparelse / husstands forbrug
  escalationPct: number;
  electricityPrice: number;
}

const cfg = () => pricingConfig.businessCase;

/**
 * Bygger forretningscasens råtal direkte fra estimat-flowets levende dele
 * (det aktuelle prisoverslag + før/efter-sammenligningen), så casen kan vises
 * live i energitrinnet, inden estimatet er gemt.
 */
export function buildLiveBusinessCaseInput(parts: {
  investment: number;
  comparison: EnergyComparisonResult;
  luminaireCount: number;
  electricityPrice: number;
}): BusinessCaseInput {
  const maintenancePerLum = cfg().annualMaintenanceSavingsPerLuminaire;
  return {
    investment: parts.investment,
    annualEnergySavingsKr: parts.comparison.savedAnnualCost,
    annualMaintenanceSavingsKr: maintenancePerLum * (parts.luminaireCount || 0),
    annualKwhSaved: parts.comparison.savedKwh,
    currentAnnualKwh: parts.comparison.currentAnnualKwh,
    newAnnualKwh: parts.comparison.newAnnualKwh,
    electricityPrice: parts.electricityPrice,
  };
}

/**
 * Udleder forretningscasens råtal fra et estimat. Bruger før/efter-energi-
 * sammenligningen hvis den findes, ellers det simple besparelsestal fra
 * energiblokken. Faktisk tilbudspris (hvis registreret) bruges som investering
 * frem for estimatet, så casen følger virkeligheden når den kendes.
 */
export function buildBusinessCaseInput(
  est: CustomerEstimate,
): BusinessCaseInput {
  const investment = est.actual?.actualTotal ?? est.pricing.totalCost;

  if (est.energyComparison) {
    return buildLiveBusinessCaseInput({
      investment,
      comparison: est.energyComparison,
      luminaireCount: est.technical.luminaireCount,
      electricityPrice: est.technical.electricityPrice,
    });
  }

  let annualEnergySavingsKr = 0;
  let annualKwhSaved = 0;
  let currentAnnualKwh = 0;
  if (est.energy.estimatedAnnualSavings && est.energy.referenceAnnualKwh) {
    annualEnergySavingsKr = est.energy.estimatedAnnualSavings;
    annualKwhSaved = Math.max(
      0,
      est.energy.referenceAnnualKwh - est.energy.annualKwh,
    );
    currentAnnualKwh = est.energy.referenceAnnualKwh;
  }

  const maintenancePerLum = cfg().annualMaintenanceSavingsPerLuminaire;
  const annualMaintenanceSavingsKr =
    maintenancePerLum * (est.technical.luminaireCount || 0);

  return {
    investment,
    annualEnergySavingsKr,
    annualMaintenanceSavingsKr,
    annualKwhSaved,
    currentAnnualKwh,
    newAnnualKwh: est.energy.annualKwh,
    electricityPrice: est.technical.electricityPrice,
  };
}

/**
 * Beregner den fulde forretningscase ud fra råtallene og et sæt antagelser.
 * Antagelserne defaultes fra config men kan overstyres (fx fra en slider).
 */
export function computeBusinessCase(
  input: BusinessCaseInput,
  assumptions?: Partial<BusinessCaseAssumptions>,
): BusinessCaseResult {
  const c = cfg();
  const horizonYears = Math.max(
    1,
    Math.round(assumptions?.horizonYears ?? c.horizonYears),
  );
  const escalationPct =
    assumptions?.escalationPct ?? c.electricityPriceEscalationPct;
  const esc = escalationPct / 100;

  const firstYearTotalSavingsKr =
    input.annualEnergySavingsKr + input.annualMaintenanceSavingsKr;
  const hasData = firstYearTotalSavingsKr > 0 && input.investment > 0;

  // Akkumuleret cashflow. År 0 er udgangspunktet: netto = -investering.
  const series: YearPoint[] = [
    {
      year: 0,
      annualSavings: 0,
      cumulativeSavings: 0,
      netPosition: -input.investment,
    },
  ];
  let cumulative = 0;
  for (let t = 1; t <= horizonYears; t++) {
    // El-prisstigning gælder energidelen; vedligehold holdes fladt (konservativt).
    const energyPart = input.annualEnergySavingsKr * Math.pow(1 + esc, t - 1);
    const annualSavings = energyPart + input.annualMaintenanceSavingsKr;
    cumulative += annualSavings;
    series.push({
      year: t,
      annualSavings,
      cumulativeSavings: cumulative,
      netPosition: cumulative - input.investment,
    });
  }

  // Tilbagebetalingstid: første år hvor nettoet bliver positivt, lineært
  // interpoleret inden for året.
  let paybackYears: number | null = null;
  let breakEvenYear: number | null = null;
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const cur = series[i];
    if (cur.netPosition >= 0 && prev.netPosition < 0) {
      const span = cur.netPosition - prev.netPosition;
      const frac = span !== 0 ? -prev.netPosition / span : 0;
      breakEvenYear = prev.year + frac;
      paybackYears = breakEvenYear;
      break;
    }
  }
  // Investering allerede tjent hjem fra år 0 (gratis-case).
  if (paybackYears === null && input.investment <= 0 && hasData) {
    paybackYears = 0;
    breakEvenYear = 0;
  }

  const last = series[series.length - 1];
  const horizonGrossSavings = last.cumulativeSavings;
  const horizonNetSavings = last.netPosition;
  const roiPct =
    input.investment > 0
      ? (horizonNetSavings / input.investment) * 100
      : 0;

  const savedPct =
    input.currentAnnualKwh > 0
      ? input.annualKwhSaved / input.currentAnnualKwh
      : 0;

  // CO₂ – baseret på den årlige kWh-besparelse.
  const annualKg = input.annualKwhSaved * c.co2FactorKgPerKwh;
  const co2: Co2Result = {
    factorKgPerKwh: c.co2FactorKgPerKwh,
    annualKg,
    horizonKg: annualKg * horizonYears,
    trees: annualKg / c.equivalents.treeKgPerYear,
    cars: annualKg / c.equivalents.carKgPerYear,
    flights: annualKg / c.equivalents.flightCphLondonReturnKg,
  };

  const householdsEquivalent =
    input.annualKwhSaved / c.equivalents.householdKwhPerYear;

  return {
    hasData,
    investment: input.investment,
    annualEnergySavingsKr: input.annualEnergySavingsKr,
    annualMaintenanceSavingsKr: input.annualMaintenanceSavingsKr,
    firstYearTotalSavingsKr,
    annualKwhSaved: input.annualKwhSaved,
    currentAnnualKwh: input.currentAnnualKwh,
    newAnnualKwh: input.newAnnualKwh,
    savedPct,
    paybackYears,
    horizonYears,
    horizonGrossSavings,
    horizonNetSavings,
    roiPct,
    series,
    breakEvenYear,
    co2,
    householdsEquivalent,
    escalationPct,
    electricityPrice: input.electricityPrice,
  };
}

/** Dansk formatering af en tilbagebetalingstid i år (fx "6 år og 4 mdr."). */
export function formatPayback(years: number | null): string {
  if (years === null) return "Tjener sig ikke hjem i perioden";
  if (years <= 0) return "Straks";
  const whole = Math.floor(years);
  const months = Math.round((years - whole) * 12);
  if (months === 0) return `${whole} år`;
  if (months === 12) return `${whole + 1} år`;
  const yearLabel = whole === 0 ? "" : `${whole} år`;
  const monthLabel = `${months} ${months === 1 ? "måned" : "mdr."}`;
  return [yearLabel, monthLabel].filter(Boolean).join(" og ");
}

// -----------------------------------------------------------------------------
// Demo-estimat: et realistisk, internt konsistent eksempel bygget med den
// rigtige beregningsmotor. Bruges når forretningscasen åbnes uden et gemt
// estimat (id "demo"), så hele oplevelsen kan vises med ét klik.
// -----------------------------------------------------------------------------
export function buildDemoEstimate(): CustomerEstimate {
  const technical: TechnicalInput = {
    areaType: "Lager",
    areaSqm: 4200,
    luminaireCount: 240,
    controlType: "MasterConnect",
    luxLevel: 300,
    kelvin: 4000,
    annualBurnHours: 4000,
    electricityPrice: 2.1,
    budgetWish: 550000,
    notes: "Demo – udskiftning af lysstofarmaturer i højlager.",
  };

  const pricing = calculatePricing(technical);
  const energy = calculateEnergy(technical);
  const energyComparisonInput = {
    current: { luminaireCount: 240, wattPerLuminaire: 58, burnHours: 4000 },
    replacement: { luminaireCount: 240, wattPerLuminaire: 35, burnHours: 4000 },
    oneToOne: true,
    withControl: true,
    withDaylightControl: false,
  };
  const energyComparison = calculateEnergyComparison(
    energyComparisonInput,
    technical.electricityPrice,
  );
  const confidence = calculateConfidence(
    technical,
    "Nordisk Logistik A/S",
    "El-Partner Vest ApS",
  );

  const now = new Date().toISOString();
  return {
    id: "demo",
    createdAt: now,
    updatedAt: now,
    projectName: "Højlager · LED-renovering",
    customerName: "Nordisk Logistik A/S",
    installer: {
      companyName: "El-Partner Vest ApS",
      contactPerson: "Jens Vestergaard",
      email: "jv@elpartner.dk",
      phone: "+45 70 20 30 40",
    },
    technical,
    pricing,
    energy,
    energyComparison,
    energyComparisonInput,
    confidence,
    status: "Sendt",
  };
}
