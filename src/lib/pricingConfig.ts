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

export interface LuminaireProduct {
  id: string;
  name: string;
  pricePerUnit: number; // DKK pr. stk.
}

export interface ControlOption {
  perLuminaire: number;
  fixed: number;
  // Systemer udelukker hinanden – kun ét system kan vælges ad gangen.
  // Tilvalg (exclusive: false) kan kombineres frit.
  exclusive: boolean;
}

export interface PricingConfig {
  currency: "DKK";
  // Fokusområder i v1 – kun disse vises i UI'et. Udvid listen når flere
  // områder (Lager, Butik, Sportshal…) skal aktiveres.
  focusAreas: AreaType[];
  // Armaturprodukter pr. områdetype. Prisen pr. stk. er den primære
  // materialepris – udskiftes/udvides med rigtige produktdata senere.
  luminaireProducts: Partial<Record<AreaType, LuminaireProduct[]>>;
  // Fallback-pris pr. armatur hvis intet produkt er valgt
  luminaireBaseCost: number;
  // Tillæg pr. armatur afhængigt af farvetemperatur.
  // Kelvin flytter bevidst kun lidt på prisen – undtagen Tunable White,
  // hvor gateway-varianten er dyrere.
  luminaireByKelvin: Record<string, number>;
  // Watt-estimat pr. armatur ved 100% effekt (bruges til energi)
  luminaireDefaultWatt: number;
  // Justering af watt afhængigt af krævet lux-niveau
  wattLuxMultiplier: { lux: number; multiplier: number }[];
  // Pris pr. armatur for installation (basis montagepris)
  installationPerLuminaire: number;
  // Tillæg ved store/komplekse områder
  areaFactor: Record<string, number>; // multiplikator på installation
  // Lux-faktor – bevidst tæt på 1: lux flytter mest på energiforbruget,
  // kun minimalt på prisen.
  luxFactor: { lux: number; factor: number }[];
  // Styringsformer. Selve styringssystemet er INKLUDERET i armaturprisen
  // (0 kr). Det er tilvalgene – sensor og dagslysstyring – samt gateway
  // (via Tunable White + Gateway), der fordyrer løsningen.
  controlSurcharge: Record<string, ControlOption>;
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
    controlTypes: ControlType[];
    areaType: AreaType;
  };
}

export const pricingConfig: PricingConfig = {
  currency: "DKK",

  focusAreas: ["Kontor", "Industri"],

  luminaireProducts: {
    Kontor: [
      { id: "vivid", name: "Vivid", pricePerUnit: 1500 },
      { id: "rio2", name: "Rio 2", pricePerUnit: 1000 },
    ],
    Industri: [
      { id: "foxx", name: "Foxx", pricePerUnit: 1000 },
      { id: "linda", name: "Linda", pricePerUnit: 1400 },
      { id: "forte", name: "Forte", pricePerUnit: 1200 },
    ],
  },

  // Fallback hvis intet produkt er valgt (fx historiske/ukendte områder)
  luminaireBaseCost: 1200,

  // Kelvin gør ikke det store ved prisen – gateway-varianten af Tunable
  // White er den mærkbare undtagelse.
  luminaireByKelvin: {
    "3000": 0,
    "4000": 0,
    "5000": 0,
    "Tunable White": 250,
    "Tunable White + Gateway": 700,
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
    Kontor: 1.05,
    Industri: 1.15,
    // Bevaret til historiske data / senere aktivering:
    Lager: 1.0,
    Produktion: 1.15,
    Butik: 1.1,
    Skole: 1.1,
    Sportshal: 1.25,
    Parkering: 0.9,
    Udendørs: 1.35,
    Andet: 1.05,
  },

  // Lux flytter mest på energien – kun minimalt på prisen.
  luxFactor: [
    { lux: 150, factor: 0.99 },
    { lux: 200, factor: 0.995 },
    { lux: 300, factor: 1.0 },
    { lux: 500, factor: 1.01 },
    { lux: 750, factor: 1.02 },
  ],

  // Styringssystemet er inkluderet i armaturprisen (0 kr). Kun tilvalg
  // koster ekstra: sensor og dagslysstyring (pr. armatur, placeholder).
  controlSurcharge: {
    "Simpel on/off": { perLuminaire: 0, fixed: 0, exclusive: true },
    "Trådløs styring": { perLuminaire: 0, fixed: 0, exclusive: true },
    DALI: { perLuminaire: 0, fixed: 0, exclusive: true },
    "DALI-2": { perLuminaire: 0, fixed: 0, exclusive: true },
    "DALI+": { perLuminaire: 0, fixed: 0, exclusive: true },
    Casambi: { perLuminaire: 0, fixed: 0, exclusive: true },
    MasterConnect: { perLuminaire: 0, fixed: 0, exclusive: true },
    SmartScan: { perLuminaire: 0, fixed: 0, exclusive: true },
    Andet: { perLuminaire: 0, fixed: 0, exclusive: true },
    Bevægelsessensor: { perLuminaire: 220, fixed: 0, exclusive: false },
    Dagslysstyring: { perLuminaire: 180, fixed: 0, exclusive: false },
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
    controlTypes: [],
    areaType: "Kontor",
  },
};

// Hjælpere til produktopslag – bruges af beregningsmotor og UI.
export function productsForArea(area: AreaType): LuminaireProduct[] {
  return pricingConfig.luminaireProducts[area] ?? [];
}

export function resolveProduct(
  area: AreaType,
  productId?: string,
): LuminaireProduct | undefined {
  const products = productsForArea(area);
  return products.find((p) => p.id === productId) ?? products[0];
}
