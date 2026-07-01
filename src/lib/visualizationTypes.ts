// =============================================================================
// visualizationTypes
// -----------------------------------------------------------------------------
// Datamodel for green lights visualiseringsunivers:
//   - "Universet"     : produktbibliotek af armaturer (datablade, billeder, specs)
//   - "Visualisering" : et kundeprojekt hvor et rumbillede + valgte armaturer
//                       bliver til en fotorealistisk før/efter-visualisering.
//
// Alt persisteres via localStorage-repositoryet i visualizationStorage.ts.
// =============================================================================

// ---------------------------------------------------------------------------
// Armatur ("Universet")
// ---------------------------------------------------------------------------

export type FixtureCategory =
  | "LED-panel"
  | "Downlight"
  | "Lineær / pendel"
  | "Highbay / lavbay"
  | "Spot / skinne"
  | "Facade / væg"
  | "Udendørs";

export type MountingType =
  | "Indbygning"
  | "Påbygning"
  | "Pendel"
  | "Væg"
  | "Skinne"
  | "Mast / stander";

export interface FixtureSpecs {
  lumen: number; // lm (systemlysstrøm)
  watt: number; // W (systemeffekt)
  kelvin: number; // CCT i Kelvin
  tunableWhite?: boolean; // true = Tunable White (kelvin = midtpunkt)
  cri: number; // Ra
  beamAngle: number; // spredning i grader
  ip: string; // kapslingsklasse, fx "IP20" / "IP65"
  ugr?: number; // blændingstal (Unified Glare Rating)
  lifetimeHours?: number; // levetid, fx L80B10 @ 50.000 t
  dimmable?: boolean;
  dimensions?: string; // fysiske mål, fx "600×600×40 mm"
}

export interface Fixture {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  name: string;
  sku?: string;
  category: FixtureCategory;
  mounting: MountingType;
  specs: FixtureSpecs;
  description?: string;
  productImage?: string; // dataURL (nedskaleret) ELLER sti til statisk billede
  datasheetName?: string; // filnavn på PDF-datablad
  datasheetUrl?: string; // link til datablad (alternativ til fil-upload)
  iesFileName?: string; // navn på vedhæftet IES/LDT-fil
  hasPhotometry?: boolean; // true når fotometri-fil (IES/LDT) er tilknyttet
  listPrice?: number; // vejledende kr pr. stk
  tags?: string[];
  // Kort, naturligt sprog der beskriver lysets karakter. Bruges til at prompte
  // AI-visualiseringen (fx "bredt, jævnt neutralt hvidt arbejdslys").
  lightCharacter?: string;
}

// ---------------------------------------------------------------------------
// Visualisering (kundeprojekt)
// ---------------------------------------------------------------------------

export type VisualizationRoomType =
  | "Reception"
  | "Administration / kontor"
  | "Kontorlandskab"
  | "Mødelokale"
  | "Gang / fællesareal"
  | "Kantine"
  | "Lager"
  | "Produktion"
  | "Højlager"
  | "Andet";

export type VisualizationStatus = "Kladde" | "Genereret" | "Delt";

// Lysscenarie – styrer stemningen i den genererede visualisering.
export type LightingScenario =
  | "Dagslys, tændt"
  | "Aften, tændt"
  | "Nat, tændt"
  | "Slukket (reference)";

// Et manuelt placeret armatur-punkt på rumbilledet (0..100 % af billedets mål).
export interface PlacementPoint {
  id: string;
  xPct: number;
  yPct: number;
  fixtureId?: string; // hvilket armatur punktet repræsenterer (valgfrit)
}

export interface SelectedFixture {
  fixtureId: string;
  quantity: number;
}

// Hvordan armaturerne placeres i visualiseringen.
export type PlacementMode =
  | "ai" // AI foreslår placeringen automatisk
  | "manual" // sælger har sat punkter på billedet
  | "floorplan"; // en uploadet plantegning styrer placeringen

export interface GeneratedRender {
  id: string;
  createdAt: string; // ISO
  imageData: string; // dataURL af "efter"-billedet
  prompt: string; // prompten der blev brugt
  provider: string; // provider-id der genererede billedet
  scenario: LightingScenario;
  note?: string;
}

export interface Visualization {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  customerName: string;
  projectName: string;
  roomType: VisualizationRoomType;
  roomPhoto?: string; // dataURL – "før"-billedet af kundens lokale
  floorPlan?: string; // dataURL – valgfri plantegning
  selectedFixtures: SelectedFixture[];
  placements: PlacementPoint[]; // manuelle markører på rumbilledet
  placementMode: PlacementMode;
  scenario: LightingScenario;
  renders: GeneratedRender[]; // genererede "efter"-billeder (nyeste sidst)
  status: VisualizationStatus;
  estimateId?: string; // valgfri kobling til et CustomerEstimate
  notes?: string;
}
