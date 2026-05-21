// =============================================================================
// pricingConfig
// -----------------------------------------------------------------------------
// Central konfiguration for første versions placeholder-prisdata.
//
// Når green light leverer reelle data (armaturpriser, timepriser, leverandør-
// priser, historiske tilbud), skal følgende erstattes:
//   1. luminaireBaseCost / luminaireByKelvin   -> rigtige armaturpriser
//   2. installationHourlyRate / install minutes -> rigtige montørpriser
//   3. controlSurcharge                         -> rigtige styringspriser
//   4. areaFactor / luxFactor / complexity      -> evt. fjernes når historiske
//      tilbud bruges direkte som referencegrundlag.
//
// Alle satser er i DKK ekskl. moms.
// =============================================================================

import type { AreaType, ControlType, KelvinValue } from "./types";

export interface PricingConfig {
  currency: "DKK";
  // Pris pr. armatur (basis) – placeholder
  luminaireBaseCost: number;
  // Tillæg pr. armatur afhængigt af farvetemperatur
  luminaireByKelvin: Record<string, number>;
  // Watt-estimat pr. armatur ved 100% effekt (bruges til energi)
  luminaireDefaultWatt: number;
  // Justering af watt afhængigt af krævet lux-niveau
  wattLuxMultiplier: { lux: number; multiplier: number }[];
  // Pris pr. armatur for installation (basis montagepris)
  installationPerLuminaire: number;
  // Tillæg ved store/komplekse områder
  areaFactor: Record<string, number>; // multiplikator på installation
  // Lux-faktor (højere lux -> evt. flere/stærkere armaturer påvirker pris)
  luxFactor: { lux: number; factor: number }[];
  // Styringssystem – pr. armatur tillæg + et evt. fast tillæg
  controlSurcharge: Record<string, { perLuminaire: number; fixed: number }>;
  // Margin / budgetinterval – ±%
  budgetRangePct: number;
  // Standardværdier for nye estimater (sliders, defaults)
  defaults: {
    luxLevel: number;
    kelvin: KelvinValue;
    annualBurnHours: number;
    electricityPrice: number;
    luminaireCount: number;
    controlType: ControlType;
    areaType: AreaType;
  };
}

export const pricingConfig: PricingConfig = {
  currency: "DKK",

  // PLACEHOLDER – udskiftes med rigtige armaturpriser pr. produktkategori
  luminaireBaseCost: 1450,

  luminaireByKelvin: {
    "3000": 0,
    "4000": 0,
    "5000": 50,
    "Tunable White": 380,
  },

  luminaireDefaultWatt: 35,

  wattLuxMultiplier: [
    { lux: 150, multiplier: 0.55 },
    { lux: 200, multiplier: 0.7 },
    { lux: 300, multiplier: 1.0 },
    { lux: 500, multiplier: 1.45 },
    { lux: 750, multiplier: 1.9 },
  ],

  installationPerLuminaire: 520,

  areaFactor: {
    Lager: 1.0,
    Produktion: 1.15,
    Kontor: 1.05,
    Butik: 1.1,
    Skole: 1.1,
    Sportshal: 1.25,
    Parkering: 0.9,
    Udendørs: 1.35,
    Andet: 1.05,
  },

  luxFactor: [
    { lux: 150, factor: 0.92 },
    { lux: 200, factor: 0.97 },
    { lux: 300, factor: 1.0 },
    { lux: 500, factor: 1.12 },
    { lux: 750, factor: 1.25 },
  ],

  controlSurcharge: {
    "Ingen styring": { perLuminaire: 0, fixed: 0 },
    "Simpel on/off": { perLuminaire: 35, fixed: 0 },
    Dagslysstyring: { perLuminaire: 180, fixed: 2500 },
    Bevægelsessensor: { perLuminaire: 220, fixed: 1500 },
    "Trådløs styring": { perLuminaire: 260, fixed: 4500 },
    DALI: { perLuminaire: 310, fixed: 6500 },
    MasterConnect: { perLuminaire: 290, fixed: 5500 },
    Andet: { perLuminaire: 150, fixed: 2000 },
  },

  budgetRangePct: 12,

  defaults: {
    luxLevel: 300,
    kelvin: 4000,
    annualBurnHours: 2500,
    electricityPrice: 2.1,
    luminaireCount: 50,
    controlType: "MasterConnect",
    areaType: "Lager",
  },
};
