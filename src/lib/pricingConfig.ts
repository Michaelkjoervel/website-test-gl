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
  // Energibesparelse ved tilvalg af styring (før/efter-beregner)
  energySavings: {
    control: number; // andel sparet ved styring (0..1)
    daylightControl: number; // yderligere andel ved dagslysstyring (0..1)
  };
  // Standardværdier til energi-sammenligningen
  energyDefaults: {
    currentWattPerLuminaire: number;
    newWattPerLuminaire: number;
  };
  // Forretningscase – antagelser til den kundevendte ROI/CO₂-præsentation.
  // Alle værdier er bevidst samlet her, så green light kan justere ét sted.
  businessCase: {
    horizonYears: number; // betragtningsperiode (typisk armaturets levetid)
    electricityPriceEscalationPct: number; // forventet årlig el-prisstigning (%)
    annualMaintenanceSavingsPerLuminaire: number; // sparet vedligehold pr. armatur/år (kr)
    co2FactorKgPerKwh: number; // CO₂ pr. kWh – dansk el (konfigurerbar)
    equivalents: {
      treeKgPerYear: number; // CO₂ optaget af ét træ pr. år
      carKgPerYear: number; // CO₂-udledning fra én personbil pr. år
      flightCphLondonReturnKg: number; // CO₂ pr. flyrejse CPH–London t/r pr. passager
      householdKwhPerYear: number; // gennemsnitlig dansk husstands elforbrug pr. år
    };
  };
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

  energySavings: {
    control: 0.5, // styring: 50%
    daylightControl: 0.2, // dagslysstyring: yderligere 20%
  },

  energyDefaults: {
    currentWattPerLuminaire: 58, // typisk eksisterende armatur (fx lysstofrør)
    newWattPerLuminaire: 35, // typisk nyt LED-armatur
  },

  businessCase: {
    horizonYears: 15,
    electricityPriceEscalationPct: 3,
    // Konservativt 0 indtil green light har et reelt vedligeholdsgrundlag.
    annualMaintenanceSavingsPerLuminaire: 0,
    // ~ dansk forbrugsdeklaration de senere år. Justeres her ét sted.
    co2FactorKgPerKwh: 0.12,
    equivalents: {
      treeKgPerYear: 21,
      carKgPerYear: 2000,
      flightCphLondonReturnKg: 230,
      householdKwhPerYear: 4000,
    },
  },

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
