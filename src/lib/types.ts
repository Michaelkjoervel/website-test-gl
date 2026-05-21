// Core type definitions for the green light estimator.
// All persisted data conforms to these interfaces.

export type ControlType =
  | "Ingen styring"
  | "Simpel on/off"
  | "Dagslysstyring"
  | "Bevægelsessensor"
  | "Trådløs styring"
  | "DALI"
  | "MasterConnect"
  | "Andet";

export type KelvinValue = 3000 | 4000 | 5000 | "Tunable White";

export type LuxLevel = 150 | 200 | 300 | 500 | 750 | number;

export type AreaType =
  | "Lager"
  | "Produktion"
  | "Kontor"
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

export interface TechnicalInput {
  areaType: AreaType;
  areaSqm?: number;
  luminaireCount: number;
  controlType: ControlType;
  luxLevel: LuxLevel;
  kelvin: KelvinValue;
  annualBurnHours: number;
  electricityPrice: number; // kr per kWh
  budgetWish?: number; // kr (optional)
  notes?: string;
}

export interface PricingResult {
  materialCost: number;
  installationCost: number;
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
