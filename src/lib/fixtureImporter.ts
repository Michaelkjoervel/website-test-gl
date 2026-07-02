// =============================================================================
// fixtureImporter
// -----------------------------------------------------------------------------
// Bulk-import af armaturer til "Universet" fra CSV eller JSON.
// Samme robuste CSV-håndtering som src/lib/importer.ts (citat-felter, da-tal).
//
// Billeder importeres som URL (kolonnen productImage) – ikke som filer – så
// localStorage ikke sprænges. Fysiske billeder kan tilføjes pr. armatur bagefter.
// =============================================================================

import type {
  Fixture,
  FixtureCategory,
  MountingType,
} from "./visualizationTypes";
import { newVizId } from "./visualizationStorage";

const CATEGORIES: FixtureCategory[] = [
  "LED-panel",
  "Downlight",
  "Lineær / pendel",
  "Highbay / lavbay",
  "Spot / skinne",
  "Facade / væg",
  "Udendørs",
];
const MOUNTINGS: MountingType[] = [
  "Indbygning",
  "Påbygning",
  "Pendel",
  "Væg",
  "Skinne",
  "Mast / stander",
];

export interface FixtureImportResult {
  fixtures: Fixture[];
  warnings: string[];
}

export function parseFixturesText(text: string, fileName = ""): FixtureImportResult {
  const isJson = fileName.toLowerCase().endsWith(".json") || text.trim().startsWith("[") || text.trim().startsWith("{");
  return isJson ? parseJson(text) : parseCsv(text);
}

function parseJson(text: string): FixtureImportResult {
  const warnings: string[] = [];
  try {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : [data];
    const fixtures = arr
      .map((o, i) => normalize(o as Record<string, unknown>, i + 1, warnings))
      .filter((f): f is Fixture => f !== null);
    return { fixtures, warnings };
  } catch (e) {
    return { fixtures: [], warnings: [`Ugyldigt JSON: ${(e as Error).message}`] };
  }
}

function parseCsv(text: string): FixtureImportResult {
  const warnings: string[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    return { fixtures: [], warnings: ["CSV indeholder ingen datarækker (kun overskrift?)."] };
  }
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const fixtures: Fixture[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const obj: Record<string, unknown> = {};
    header.forEach((key, idx) => {
      obj[key] = cells[idx]?.trim() ?? "";
    });
    const f = normalize(obj, i, warnings);
    if (f) fixtures.push(f);
  }
  return { fixtures, warnings };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) {
    const cleaned = v.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toBool(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return ["true", "ja", "yes", "1", "x", "sand"].includes(s);
}

function toTags(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map((t) => String(t).trim()).filter(Boolean);
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  return s.split(/[;|]/).map((t) => t.trim()).filter(Boolean);
}

function matchEnum<T extends string>(v: unknown, allowed: T[], fallback: T, label: string, row: number, warnings: string[]): T {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  const hit = allowed.find((a) => a.toLowerCase() === s.toLowerCase());
  if (hit) return hit;
  warnings.push(`Række ${row}: ukendt ${label} "${s}" – bruger "${fallback}".`);
  return fallback;
}

const iso = () => new Date().toISOString();

function normalize(raw: Record<string, unknown>, row: number, warnings: string[]): Fixture | null {
  const name = String(raw.name ?? raw.navn ?? "").trim();
  if (!name) {
    warnings.push(`Række ${row}: mangler navn – springes over.`);
    return null;
  }

  const iesFileName = String(raw.iesFileName ?? raw.ies ?? "").trim() || undefined;
  const hasPhotometry = raw.hasPhotometry !== undefined ? toBool(raw.hasPhotometry) : !!iesFileName;

  return {
    id: newVizId("fx"),
    createdAt: iso(),
    updatedAt: iso(),
    name,
    sku: String(raw.sku ?? "").trim() || undefined,
    category: matchEnum(raw.category ?? raw.kategori, CATEGORIES, "LED-panel", "kategori", row, warnings),
    mounting: matchEnum(raw.mounting ?? raw.montering, MOUNTINGS, "Indbygning", "montering", row, warnings),
    specs: {
      lumen: toNumber(raw.lumen),
      watt: toNumber(raw.watt),
      kelvin: toNumber(raw.kelvin) || 4000,
      tunableWhite: toBool(raw.tunableWhite),
      cri: toNumber(raw.cri) || 80,
      beamAngle: toNumber(raw.beamAngle ?? raw.beam) || 100,
      ip: String(raw.ip ?? "").trim() || "IP20",
      ugr: raw.ugr !== undefined && String(raw.ugr).trim() !== "" ? toNumber(raw.ugr) : undefined,
      lifetimeHours: raw.lifetimeHours !== undefined && String(raw.lifetimeHours).trim() !== "" ? toNumber(raw.lifetimeHours) : undefined,
      dimmable: raw.dimmable !== undefined ? toBool(raw.dimmable) : undefined,
      dimensions: String(raw.dimensions ?? raw.maal ?? "").trim() || undefined,
    },
    description: String(raw.description ?? raw.beskrivelse ?? "").trim() || undefined,
    lightCharacter: String(raw.lightCharacter ?? raw.lyskarakter ?? "").trim() || undefined,
    productImage: String(raw.productImage ?? raw.billede ?? "").trim() || undefined,
    datasheetName: String(raw.datasheetName ?? "").trim() || undefined,
    datasheetUrl: String(raw.datasheetUrl ?? raw.datablad ?? "").trim() || undefined,
    iesFileName,
    hasPhotometry,
    listPrice: raw.listPrice !== undefined && String(raw.listPrice).trim() !== "" ? toNumber(raw.listPrice ?? raw.pris) : undefined,
    tags: toTags(raw.tags),
  };
}

const TEMPLATE_HEADER =
  "name,sku,category,mounting,lumen,watt,kelvin,cri,beamAngle,ip,ugr,lifetimeHours,dimmable,tunableWhite,dimensions,listPrice,description,lightCharacter,datasheetUrl,iesFileName,productImage,tags";

export function fixtureCsvTemplate(): string {
  const example =
    '"GL Panel Pro 600",GL-PP-600-40,LED-panel,Indbygning,4000,32,4000,90,110,IP20,19,50000,ja,nej,"595×595×28 mm",620,"Blændfrit backlit-panel","bredt jævnt arbejdslys",https://eksempel.dk/datablad.pdf,GL-PP-600-40.ies,https://eksempel.dk/panel.jpg,kontor;møde';
  return `${TEMPLATE_HEADER}\n${example}\n`;
}

export function fixtureJsonSample(): string {
  return JSON.stringify(
    [
      {
        name: "GL Panel Pro 600",
        sku: "GL-PP-600-40",
        category: "LED-panel",
        mounting: "Indbygning",
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
        listPrice: 620,
        description: "Blændfrit backlit-panel",
        lightCharacter: "bredt jævnt arbejdslys",
        datasheetUrl: "https://eksempel.dk/datablad.pdf",
        iesFileName: "GL-PP-600-40.ies",
        productImage: "https://eksempel.dk/panel.jpg",
        tags: ["kontor", "møde"],
      },
    ],
    null,
    2,
  );
}
