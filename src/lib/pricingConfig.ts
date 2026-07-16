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

// Pris pr. stk. pr. styringssystem, fx { "MasterConnect": 1000, "DALI-2": 700 }
export type VariantPrices = Record<string, number>;

export interface LuminaireVariant {
  label: string; // fx "Standard", "165 mm", "High output · 12 m sensor"
  prices: VariantPrices;
  // Pris når Tunable White er valgt (inkluderer TW – kelvin-tillæg springes over)
  pricesTunableWhite?: VariantPrices;
  // Nominel effekt pr. armatur (W) – bruges i energiberegningen
  watt?: number;
}

export interface LuminaireAccessory {
  name: string; // fx "Wireophæng", "Påbygningsramme"
  pricePerUnit: number; // DKK pr. armatur
}

export interface LuminaireProduct {
  id: string;
  name: string;
  // Fallback-pris når ingen variant matcher det valgte styringssystem
  pricePerUnit: number; // DKK pr. stk.
  // Varianter (størrelse/output) med priser pr. styringssystem.
  // For downlights er driverprisen regnet ind i variantprisen.
  variants?: LuminaireVariant[];
  // Valgfrit tilbehør, der kan slås til (pris pr. armatur)
  accessories?: LuminaireAccessory[];
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
  // Styringsformer. Variantens listepris er SLUTPRISEN – styring/sensor er
  // allerede inde i prisen, så alle systemer står til 0 kr. Strukturen
  // beholdes, så prissatte tilvalg kan tilføjes senere via Prisdata.
  controlSurcharge: Record<string, ControlOption>;
  // Gateway-tillæg ved "Tunable White + Gateway": pris pr. gateway, hvor
  // én gateway dækker op til luminairesPerGateway armaturer.
  tunableWhiteGateway: {
    pricePerGateway: number;
    luminairesPerGateway: number;
  };
  // Margin / budgetinterval – ±%
  budgetRangePct: number;
  // Energibesparelse ved tilvalg af styring (før/efter-beregner).
  // control: andel af det nye anlægs basisforbrug, der spares ved styring.
  // daylightControl: andel af det RESTERENDE forbrug (efter styring), der
  // spares ved dagslysstyring – vises separat, jf. green lights metode.
  energySavings: {
    control: number; // 0..1
    daylightControl: number; // 0..1 af resterende
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

  // PLACEHOLDER-priser (runde dummytal). De RIGTIGE variantpriser
  // vedligeholdes i Supabase via Administration → Prisdata.
  luminaireProducts: {
    Kontor: [
      {
        id: "rio-g6",
        name: "Rio G6 (60×60, T-skinne)",
        pricePerUnit: 900,
        variants: [
          {
            label: "Standard",
            watt: 42,
            prices: {
              "Simpel on/off": 900,
              "DALI-2": 1000,
              MasterConnect: 1400,
            },
            pricesTunableWhite: { MasterConnect: 1700 },
          },
        ],
      },
      {
        id: "rio2",
        name: "Rio 2 (60×60)",
        pricePerUnit: 600,
        variants: [
          {
            label: "Standard",
            watt: 39,
            prices: {
              "Simpel on/off": 600,
              "DALI-2": 700,
              MasterConnect: 1000,
            },
            pricesTunableWhite: { MasterConnect: 1300 },
          },
        ],
        accessories: [{ name: "Påbygningsramme", pricePerUnit: 200 }],
      },
      {
        id: "vivid",
        name: "Vivid (lineært)",
        pricePerUnit: 900,
        variants: [
          {
            label: "Standard",
            watt: 38,
            prices: {
              "Simpel on/off": 900,
              "DALI-2": 1100,
              MasterConnect: 1400,
            },
            pricesTunableWhite: { MasterConnect: 1700 },
          },
        ],
        accessories: [{ name: "Wireophæng (2 stk.)", pricePerUnit: 150 }],
      },
      {
        id: "moon2",
        name: "Moon 2 (downlight ECO, inkl. driver)",
        pricePerUnit: 500,
        variants: [
          {
            label: "95 mm",
            watt: 9,
            prices: {
              "Simpel on/off": 400,
              "DALI-2": 500,
              MasterConnect: 600,
            },
          },
          {
            label: "165 mm",
            watt: 18,
            prices: {
              "Simpel on/off": 500,
              "DALI-2": 600,
              MasterConnect: 700,
            },
          },
        ],
      },
      {
        id: "ares",
        name: "Ares (downlight, inkl. driver)",
        pricePerUnit: 700,
        variants: [
          {
            label: "Mini · 115 mm",
            watt: 9,
            prices: {
              "Simpel on/off": 600,
              "DALI-2": 700,
              MasterConnect: 800,
            },
          },
          {
            label: "Midi · 165 mm",
            watt: 14,
            prices: {
              "Simpel on/off": 700,
              "DALI-2": 800,
              MasterConnect: 900,
            },
          },
        ],
      },
    ],
    Industri: [
      {
        id: "forte",
        name: "GL Forte (1595 mm)",
        pricePerUnit: 1400,
        variants: [
          {
            label: "60 W · sensor op til 6 m",
            watt: 60,
            prices: { MasterConnect: 1400 },
          },
          {
            label: "87 W High output · sensor op til 6 m",
            watt: 87,
            prices: { MasterConnect: 1600 },
          },
          {
            label: "60 W · sensor op til 12 m",
            watt: 60,
            prices: { MasterConnect: 1700 },
          },
          {
            label: "87 W High output · sensor op til 12 m",
            watt: 87,
            prices: { MasterConnect: 1900 },
          },
        ],
      },
      {
        id: "linda",
        name: "Linda G2 (1480 mm)",
        pricePerUnit: 2000,
        variants: [
          {
            label: "128 W Ultra output · sensor op til 6 m",
            watt: 128,
            prices: { MasterConnect: 2000 },
          },
          {
            label: "128 W Ultra output · sensor op til 16 m",
            watt: 128,
            prices: { MasterConnect: 2200 },
          },
        ],
      },
    ],
  },

  // Fallback hvis intet produkt er valgt (fx historiske/ukendte områder)
  luminaireBaseCost: 1200,

  // Kelvin gør ikke det store ved prisen – gateway-varianten af Tunable
  // White er den mærkbare undtagelse.
  // Kelvin-tillæg er 0 – Tunable White har sin egen variantpris, og
  // gateway håndteres via tunableWhiteGateway nedenfor.
  luminaireByKelvin: {
    "3000": 0,
    "4000": 0,
    "5000": 0,
    "Tunable White": 0,
    "Tunable White + Gateway": 0,
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
  // Listeprisen er slutprisen – lux påvirker kun energiberegningen.
  luxFactor: [
    { lux: 150, factor: 1.0 },
    { lux: 200, factor: 1.0 },
    { lux: 300, factor: 1.0 },
    { lux: 500, factor: 1.0 },
    { lux: 750, factor: 1.0 },
  ],

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
  },

  // PLACEHOLDER – det rigtige gateway-tillæg vedligeholdes i Prisdata.
  tunableWhiteGateway: {
    pricePerGateway: 2500,
    luminairesPerGateway: 50,
  },

  budgetRangePct: 12,

  energySavings: {
    control: 0.7, // styring: 70% af basisforbruget (jf. beregningsark)
    daylightControl: 0.2, // dagslys: 20% af det resterende forbrug
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
    // Dansk miljødeklaration (~2023). Justeres her ét sted.
    co2FactorKgPerKwh: 0.133,
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

// -----------------------------------------------------------------------------
// Fortroligt prisgrundlag (cloud)
// -----------------------------------------------------------------------------
// Værdierne ovenfor er ufarlige PLACEHOLDERS og må gerne ligge i koden.
// Green lights RIGTIGE priser gemmes i Supabase (tabellen estimator_pricing,
// kun læselig for loggede-ind brugere) og lægges ind over placeholder-værdierne
// efter login via applyPricingConfig(). De rigtige priser ender dermed hverken
// i repoet eller i den offentlige JS-bundle.

export type PricingSource = "placeholder" | "cloud";

let pricingSource: PricingSource = "placeholder";

export function getPricingSource(): PricingSource {
  return pricingSource;
}

/**
 * Læg en (evt. delvis) konfiguration ind over placeholder-værdierne.
 * Ukendte nøgler ignoreres; manglende nøgler beholder placeholder-værdien,
 * så en ældre gemt konfiguration ikke kan vælte appen.
 */
export function applyPricingConfig(partial: Partial<PricingConfig>): void {
  const keys = Object.keys(pricingConfig) as (keyof PricingConfig)[];
  for (const key of keys) {
    const value = partial[key];
    if (value !== undefined && value !== null) {
      (pricingConfig as unknown as Record<string, unknown>)[key] = value;
    }
  }
  pricingSource = "cloud";
}

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

/** Nominel watt for valgt produkt/variant – undefined hvis ukendt. */
export function resolveVariantWatt(
  product: LuminaireProduct | undefined,
  variantLabel?: string,
): number | undefined {
  if (!product) return undefined;
  const variants = product.variants ?? [];
  const variant = variants.find((v) => v.label === variantLabel) ?? variants[0];
  return variant?.watt;
}

export interface ResolvedUnitPrice {
  price: number;
  variantLabel?: string;
  // true når Tunable White allerede er inkluderet i variantprisen
  tunableWhitePriced: boolean;
}

/**
 * Find stykprisen for et produkt ud fra valgt variant, styringssystem og
 * kelvin. Prislogik: variantens pris pr. styringssystem; ved Tunable White
 * bruges variantens TW-pris hvis den findes. Fallback-rækkefølge når det
 * valgte system ikke har en pris: intet system → "Simpel on/off", ellers
 * MasterConnect, ellers første pris, ellers produktets fallback-pris.
 */
export function resolveUnitPrice(
  product: LuminaireProduct | undefined,
  controlTypes: string[],
  kelvin: string | number,
  variantLabel?: string,
): ResolvedUnitPrice {
  if (!product) {
    return { price: pricingConfig.luminaireBaseCost, tunableWhitePriced: false };
  }
  const variants = product.variants ?? [];
  const variant =
    variants.find((v) => v.label === variantLabel) ?? variants[0];
  if (!variant) {
    return { price: product.pricePerUnit, tunableWhitePriced: false };
  }

  const isTW = String(kelvin).startsWith("Tunable White");
  const system = controlTypes.find(
    (c) => pricingConfig.controlSurcharge[c]?.exclusive,
  );

  const pick = (table?: VariantPrices): number | undefined => {
    if (!table) return undefined;
    if (system && table[system] !== undefined) return table[system];
    if (!system && table["Simpel on/off"] !== undefined) {
      return table["Simpel on/off"];
    }
    if (table["MasterConnect"] !== undefined) return table["MasterConnect"];
    const values = Object.values(table);
    return values.length > 0 ? values[0] : undefined;
  };

  if (isTW) {
    const twPrice = pick(variant.pricesTunableWhite);
    if (twPrice !== undefined) {
      return { price: twPrice, variantLabel: variant.label, tunableWhitePriced: true };
    }
  }
  const price = pick(variant.prices);
  if (price !== undefined) {
    return { price, variantLabel: variant.label, tunableWhitePriced: false };
  }
  return {
    price: product.pricePerUnit,
    variantLabel: variant.label,
    tunableWhitePriced: false,
  };
}
