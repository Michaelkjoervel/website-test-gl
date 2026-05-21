// =============================================================================
// importer
// -----------------------------------------------------------------------------
// Parser CSV eller JSON-filer med historiske tilbud.
// Tager højde for at felter senere kan udvides – ukendte kolonner bevares
// som metadata på objektet, så de er til rådighed for fremtidig ML-træning.
// =============================================================================

import type { HistoricalOffer } from "./types";

const EXPECTED_KEYS = [
  "projectName",
  "areaType",
  "luminaireCount",
  "controlType",
  "luxLevel",
  "kelvin",
  "annualBurnHours",
  "electricityPrice",
  "estimatedPrice",
  "actualPrice",
  "status",
];

export interface ImportResult {
  rows: HistoricalOffer[];
  warnings: string[];
}

export async function parseImportFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  if (file.name.toLowerCase().endsWith(".json") || text.trim().startsWith("[")) {
    return parseJson(text);
  }
  return parseCsv(text);
}

function parseJson(text: string): ImportResult {
  const warnings: string[] = [];
  try {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : [data];
    const rows = arr.map((o, i) => normalize(o, i, warnings));
    return { rows, warnings };
  } catch (e) {
    return { rows: [], warnings: [`Ugyldigt JSON: ${(e as Error).message}`] };
  }
}

function parseCsv(text: string): ImportResult {
  const warnings: string[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], warnings: ["CSV indeholder ingen datarækker."] };
  }
  const header = splitCsvLine(lines[0]);
  const rows: HistoricalOffer[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const obj: Record<string, unknown> = {};
    header.forEach((key, idx) => {
      obj[key.trim()] = cells[idx]?.trim() ?? "";
    });
    rows.push(normalize(obj, i, warnings));
  }
  return { rows, warnings };
}

// En meget enkel CSV-splitter der respekterer "double-quoted" felter.
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
  if (typeof v === "string") {
    const cleaned = v.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalize(
  raw: Record<string, unknown>,
  index: number,
  warnings: string[],
): HistoricalOffer {
  const offer: HistoricalOffer = {
    projectName: String(raw.projectName ?? raw.name ?? `Importeret #${index}`),
    areaType: String(raw.areaType ?? raw.area ?? "Andet"),
    luminaireCount: toNumber(raw.luminaireCount ?? raw.count),
    controlType: String(raw.controlType ?? raw.control ?? "Andet"),
    luxLevel: toNumber(raw.luxLevel ?? raw.lux),
    kelvin: toNumber(raw.kelvin),
    annualBurnHours: toNumber(raw.annualBurnHours ?? raw.burnHours),
    electricityPrice: toNumber(raw.electricityPrice ?? raw.kwhPrice),
    estimatedPrice: toNumber(raw.estimatedPrice ?? raw.estimate),
    actualPrice: toNumber(raw.actualPrice ?? raw.actual),
    status: String(raw.status ?? "Ukendt"),
  };

  // Behold ukendte kolonner som metadata (rotter-stabil for fremtidig brug)
  for (const k of Object.keys(raw)) {
    if (!EXPECTED_KEYS.includes(k)) {
      offer[k] = raw[k];
    }
  }

  if (offer.estimatedPrice === 0 && offer.actualPrice === 0) {
    warnings.push(`Række ${index}: mangler både estimat- og faktisk pris.`);
  }
  return offer;
}

export function downloadSampleHistoricalJson(): void {
  const sample: HistoricalOffer[] = [
    {
      projectName: "Eksempelprojekt",
      areaType: "Lager",
      luminaireCount: 120,
      controlType: "MasterConnect",
      luxLevel: 300,
      kelvin: 4000,
      annualBurnHours: 3500,
      electricityPrice: 2.1,
      estimatedPrice: 450000,
      actualPrice: 472000,
      status: "Vundet",
    },
  ];
  const blob = new Blob([JSON.stringify(sample, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "greenlight-historiske-tilbud-eksempel.json";
  a.click();
  URL.revokeObjectURL(url);
}
