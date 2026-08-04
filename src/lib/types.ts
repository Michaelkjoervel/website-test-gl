// Core type definitions for the green light estimator.
// All persisted data conforms to these interfaces.

// Styringsformer. Styringssystemet er inkluderet i armaturprisen og
// systemerne udelukker hinanden. Tilvalg (sensor, dagslysstyring) kan
// kombineres frit og koster ekstra.
export type ControlType =
  | "Simpel on/off"
  | "Trådløs styring"
  | "DALI"
  | "DALI-2"
  | "DALI+"
  | "Casambi"
  | "MasterConnect"
  | "SmartScan"
  | "Andet"
  | "Bevægelsessensor"
  | "Dagslysstyring";

export type KelvinValue =
  | 3000
  | 4000
  | 5000
  | "Tunable White"
  | "Tunable White + Gateway";

export type LuxLevel = 150 | 200 | 300 | 500 | 750 | number;

// Fokusområder i v1 er Kontor og Industri – resten bevares for
// bagudkompatibilitet med historiske data og kan aktiveres senere.
export type AreaType =
  | "Kontor"
  | "Industri"
  | "Lager"
  | "Produktion"
  | "Butik"
  | "Skole"
  | "Sportshal"
  | "Parkering"
  | "Udendørs"
  | "Andet";

export type EstimateStatus =
  | "Kladde"
  | "Sendt"
  | "Vundet"
  | "Tabt"
  | "Opdateret til faktisk tilbud";

export type ConfidenceLevel = "Lav" | "Middel" | "Høj";

export interface InstallerInfo {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
}

// Én armaturlinje i projektet (produkt + variant + antal + tilbehør).
// Et estimat kan bestå af flere linjer, fx 9 × Rio 2 og 13 × Moon 2.
export interface LuminaireLine {
  productId?: string;
  variantLabel?: string;
  count: number;
  accessories?: string[];
}

export interface TechnicalInput {
  areaType: AreaType;
  areaSqm?: number;
  // Samlet antal armaturer (summen af luminaireLines – holdes synkroniseret)
  luminaireCount: number;
  // Armaturlinjerne i projektet. Tom/udeladt = brug legacy-felterne nedenfor.
  luminaireLines?: LuminaireLine[];
  // LEGACY (ét produkt pr. estimat) – bevaret så gamle estimater kan vises.
  luminaireProductId?: string;
  luminaireVariant?: string;
  accessories?: string[];
  // Tilbudsrabat i procent (0-100) på armaturer + styringstilvalg.
  discountPct?: number;
  // Flere styringsformer kan vælges; tom liste = ingen styring.
  controlTypes: ControlType[];
  luxLevel: LuxLevel;
  kelvin: KelvinValue;
  annualBurnHours: number;
  electricityPrice: number; // kr per kWh
  budgetWish?: number; // kr (optional)
  notes?: string;
}

export interface PricingResult {
  materialCost: number;
  // Armaturpris pr. stk. (materiale inkl. tilbehør) – uden installation
  materialPerLuminaire: number;
  // Installationsomkostning pr. armatur
  installationPerLuminaire: number;
  installationCost: number;
  // Tilbudsrabat: procent og beløb (af materiale + styringstilvalg)
  discountPct: number;
  discountAmount: number;
  controlCost: number;
  totalCost: number;
  pricePerLuminaire: number;
  budgetRange: { low: number; high: number };
}

export interface EnergyCalculation {
  totalWatts: number;
  annualKwh: number;
  annualEnergyCost: number;
  // Optional reference for savings comparison (filled when reference is known).
  referenceAnnualKwh?: number;
  estimatedAnnualSavings?: number;
}

// Before/after energy estimate: existing installation vs. new (1:1) solution,
// with an extra saving when lighting control is added.
export interface EnergyFixtureSet {
  luminaireCount: number;
  wattPerLuminaire: number;
  burnHours: number;
}

export interface EnergyComparisonInput {
  current: EnergyFixtureSet;
  replacement: EnergyFixtureSet;
  oneToOne: boolean; // when true, replacement count follows the current count
  withControl: boolean; // styring
  withDaylightControl: boolean; // dagslysstyring (yderligere)
}

export interface EnergyComparisonResult {
  currentAnnualKwh: number;
  newBaseAnnualKwh: number; // nye armaturer uden styring
  // Styring: besparelse i % af det nye anlægs basisforbrug
  controlSavingsPct: number; // 0..1
  controlSavedKwh: number;
  newAnnualKwhAfterControl: number; // basis − styringsbesparelse
  // Dagslysstyring: besparelse i % af det RESTERENDE forbrug efter styring.
  // Vises separat (jf. green lights beregningsmetode).
  daylightSavingsPct: number; // 0..1 (0 hvis fravalgt)
  daylightSavedKwh: number;
  // Endelige tal (inkl. dagslys hvis valgt) – bruges i totaler/forretningscase
  newAnnualKwh: number;
  savedKwh: number;
  savedPct: number;
  currentAnnualCost: number;
  newAnnualCost: number;
  savedAnnualCost: number;
}

export interface EstimateConfidence {
  level: ConfidenceLevel;
  score: number; // 0-100
  missingFields: string[];
  notes: string[];
}

export interface ActualResult {
  actualTotal?: number;
  actualMaterial?: number;
  actualInstallation?: number;
  actualControl?: number;
  comment?: string;
  finalStatus?: "Vundet" | "Tabt";
  registeredAt?: string; // ISO date
}

export interface CustomerEstimate {
  id: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  projectName: string;
  customerName: string;
  installer: InstallerInfo;
  technical: TechnicalInput;
  pricing: PricingResult;
  energy: EnergyCalculation;
  energyComparison?: EnergyComparisonResult;
  energyComparisonInput?: EnergyComparisonInput;
  confidence: EstimateConfidence;
  status: EstimateStatus;
  actual?: ActualResult;
  // Adjustment suggestion captured at the time of estimation.
  learningAdjustmentPct?: number;
  learningNote?: string;
}

// Imported historical offer (matches the example JSON in the brief).
export interface HistoricalOffer {
  projectName: string;
  areaType: AreaType | string;
  luminaireCount: number;
  controlType: ControlType | string;
  luxLevel: number;
  kelvin: number;
  annualBurnHours: number;
  electricityPrice: number;
  estimatedPrice: number;
  actualPrice: number;
  status: "Vundet" | "Tabt" | string;
  // Free-form metadata that may exist in CSVs.
  [extra: string]: unknown;
}
