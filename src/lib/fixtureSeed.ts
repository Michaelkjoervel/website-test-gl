// =============================================================================
// fixtureSeed
// -----------------------------------------------------------------------------
// Realistiske pladsholder-armaturer, der seedes ind i "Universet" første gang.
// Dækker de rumtyper green light typisk arbejder med: reception, administration,
// kontor/møde og industri/lager. Erstat trygt med rigtige data i UI'et.
// =============================================================================

import type { Fixture } from "./visualizationTypes";

// Statisk asset-URL der virker både lokalt og under GitHub Pages' sub-sti.
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path}`.replace(/([^:])\/\//g, "$1/");
}

const now = "2024-01-01T00:00:00.000Z"; // fast tidsstempel – seed er deterministisk

type SeedFixture = Omit<Fixture, "id" | "createdAt" | "updatedAt"> & { id: string };

const SEED: SeedFixture[] = [
  {
    id: "fx_panel_pro_600",
    name: "GL Panel Pro 600",
    sku: "GL-PP-600-40",
    category: "LED-panel",
    mounting: "Indbygning",
    specs: {
      lumen: 4000,
      watt: 32,
      kelvin: 4000,
      cri: 90,
      beamAngle: 110,
      ip: "IP20",
      ugr: 19,
      lifetimeHours: 50000,
      dimmable: true,
      dimensions: "595×595×28 mm",
    },
    description:
      "Fladt UGR<19 backlit-panel til nedhængte lofter. Blændfrit, jævnt arbejdslys – standardvalg til administration og mødelokaler.",
    lightCharacter: "bredt, jævnt og blændfrit neutralt hvidt arbejdslys fra loftet",
    productImage: assetUrl("fixtures/fx_panel_pro_600.svg"),
    datasheetName: "GL-Panel-Pro-600.pdf",
    iesFileName: "GL-PP-600-40.ies",
    hasPhotometry: true,
    listPrice: 620,
    tags: ["kontor", "administration", "møde"],
  },
  {
    id: "fx_downlight_flex",
    name: "GL Downlight Flex 150",
    sku: "GL-DF-150-30",
    category: "Downlight",
    mounting: "Indbygning",
    specs: {
      lumen: 1200,
      watt: 11,
      kelvin: 3000,
      cri: 90,
      beamAngle: 60,
      ip: "IP44",
      ugr: 19,
      lifetimeHours: 50000,
      dimmable: true,
      dimensions: "Ø150 × 45 mm, udskæring Ø120",
    },
    description:
      "Diskret indbygningsdownlight med varm, indbydende tone. Ideel til reception, gange og fællesarealer.",
    lightCharacter: "varmt, indbydende punktlys nedad, der skaber komfort og dybde",
    productImage: assetUrl("fixtures/fx_downlight_flex.svg"),
    datasheetName: "GL-Downlight-Flex.pdf",
    iesFileName: "GL-DF-150-30.ies",
    hasPhotometry: true,
    listPrice: 240,
    tags: ["reception", "gang", "fællesareal"],
  },
  {
    id: "fx_line_suspend",
    name: "GL Line Suspend 1500",
    sku: "GL-LS-1500-40",
    category: "Lineær / pendel",
    mounting: "Pendel",
    specs: {
      lumen: 5600,
      watt: 42,
      kelvin: 4000,
      cri: 90,
      beamAngle: 110,
      ip: "IP20",
      ugr: 16,
      lifetimeHours: 60000,
      dimmable: true,
      dimensions: "1500×70×45 mm",
    },
    description:
      "Nedhængt lineært armatur med op/ned-lys (direkte/indirekte). Giver et roligt, moderne udtryk i kontorlandskaber.",
    lightCharacter: "moderne lineært op/ned-lys der løfter loftet og fjerner skygger",
    productImage: assetUrl("fixtures/fx_line_suspend.svg"),
    datasheetName: "GL-Line-Suspend.pdf",
    iesFileName: "GL-LS-1500-40.ies",
    hasPhotometry: true,
    listPrice: 1180,
    tags: ["kontorlandskab", "møde"],
  },
  {
    id: "fx_highbay_max",
    name: "GL HighBay Max 150",
    sku: "GL-HB-150-50",
    category: "Highbay / lavbay",
    mounting: "Påbygning",
    specs: {
      lumen: 22500,
      watt: 150,
      kelvin: 5000,
      cri: 80,
      beamAngle: 90,
      ip: "IP65",
      ugr: 25,
      lifetimeHours: 70000,
      dimmable: true,
      dimensions: "Ø300 × 120 mm",
    },
    description:
      "Kraftig, robust highbay til høje lofter i lager og produktion. Høj effektivitet (150 lm/W) og IP65.",
    lightCharacter: "kraftigt, køligt hvidt industrilys der lyser store haller jævnt op",
    productImage: assetUrl("fixtures/fx_highbay_max.svg"),
    datasheetName: "GL-HighBay-Max.pdf",
    iesFileName: "GL-HB-150-50.ies",
    hasPhotometry: true,
    listPrice: 1650,
    tags: ["lager", "produktion", "højlager"],
  },
  {
    id: "fx_track_spot",
    name: "GL Track Spot 20",
    sku: "GL-TS-20-30",
    category: "Spot / skinne",
    mounting: "Skinne",
    specs: {
      lumen: 1800,
      watt: 20,
      kelvin: 3000,
      cri: 95,
      beamAngle: 24,
      ip: "IP20",
      ugr: 22,
      lifetimeHours: 50000,
      dimmable: true,
      dimensions: "Ø65 × 165 mm",
    },
    description:
      "Justerbar skinnespot med høj farvegengivelse (CRI 95) til accent og fremhævning i reception og showroom.",
    lightCharacter: "fokuseret accentlys der fremhæver flader, logo og materialer",
    productImage: assetUrl("fixtures/fx_track_spot.svg"),
    datasheetName: "GL-Track-Spot.pdf",
    iesFileName: "GL-TS-20-30.ies",
    hasPhotometry: true,
    listPrice: 380,
    tags: ["reception", "showroom", "accent"],
  },
  {
    id: "fx_facade_grazer",
    name: "GL Facade Grazer 28",
    sku: "GL-FG-28-40",
    category: "Facade / væg",
    mounting: "Væg",
    specs: {
      lumen: 3000,
      watt: 28,
      kelvin: 4000,
      cri: 80,
      beamAngle: 10,
      ip: "IP65",
      lifetimeHours: 60000,
      dimmable: false,
      dimensions: "300×90×70 mm",
    },
    description:
      "Vejrbestandig facadearmatur til wall-grazing. Skaber arkitektonisk dybde på facader og ved indgangspartier.",
    lightCharacter: "smalt, opadrettet facadelys der tegner arkitekturens struktur i mørke",
    productImage: assetUrl("fixtures/fx_facade_grazer.svg"),
    datasheetName: "GL-Facade-Grazer.pdf",
    iesFileName: "GL-FG-28-40.ies",
    hasPhotometry: true,
    listPrice: 540,
    tags: ["facade", "udendørs", "indgang"],
  },
];

export function seedFixtures(): Fixture[] {
  return SEED.map((f) => ({ ...f, createdAt: now, updatedAt: now }));
}
