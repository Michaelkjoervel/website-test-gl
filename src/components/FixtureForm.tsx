import { useState, type ChangeEvent } from "react";
import type {
  Fixture,
  FixtureCategory,
  MountingType,
} from "../lib/visualizationTypes";
import { newVizId } from "../lib/visualizationStorage";
import { getExtractEndpoint } from "../lib/visualizationConfig";
import { getAccessToken } from "../lib/supabase";
import { fileToDataUrl } from "../lib/image";
import { Field } from "./Field";
import { ImageDropzone } from "./ImageDropzone";

// Svaret fra proxyens datablad-ekstraktion (alle felter kan være null).
interface ExtractedFixture {
  name: string | null;
  sku: string | null;
  category: string | null;
  mounting: string | null;
  lumen: number | null;
  watt: number | null;
  kelvin: number | null;
  tunableWhite: boolean | null;
  cri: number | null;
  beamAngle: number | null;
  ip: string | null;
  ugr: number | null;
  lifetimeHours: number | null;
  dimmable: boolean | null;
  dimensions: string | null;
  description: string | null;
  lightCharacter: string | null;
  tags: string[] | null;
}

function matchOption<T extends string>(value: string | null, options: readonly T[]): T | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return options.find((o) => o.toLowerCase() === v) ?? null;
}

const posNum = (n: number | null): number | null =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;

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

interface FixtureFormProps {
  initial?: Fixture;
  onSave: (fx: Fixture) => void;
  onCancel: () => void;
}

const iso = () => new Date().toISOString();

export function FixtureForm({ initial, onSave, onCancel }: FixtureFormProps) {
  const [f, setF] = useState<Fixture>(
    initial ?? {
      id: newVizId("fx"),
      createdAt: iso(),
      updatedAt: iso(),
      name: "",
      sku: "",
      category: "LED-panel",
      mounting: "Indbygning",
      specs: { lumen: 3000, watt: 25, kelvin: 4000, cri: 90, beamAngle: 100, ip: "IP20" },
      description: "",
      lightCharacter: "",
      hasPhotometry: false,
    },
  );

  const set = (patch: Partial<Fixture>) => setF((prev) => ({ ...prev, ...patch }));
  const setSpec = (patch: Partial<Fixture["specs"]>) =>
    setF((prev) => ({ ...prev, specs: { ...prev.specs, ...patch } }));

  // --- Auto-udfyld fra PDF-datablad ---------------------------------------
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const applyExtracted = (x: ExtractedFixture, fileName: string) => {
    setF((prev) => ({
      ...prev,
      name: x.name?.trim() || prev.name,
      sku: x.sku?.trim() || prev.sku,
      category: matchOption(x.category, CATEGORIES) ?? prev.category,
      mounting: matchOption(x.mounting, MOUNTINGS) ?? prev.mounting,
      specs: {
        ...prev.specs,
        lumen: posNum(x.lumen) ?? prev.specs.lumen,
        watt: posNum(x.watt) ?? prev.specs.watt,
        kelvin: posNum(x.kelvin) ?? prev.specs.kelvin,
        tunableWhite: x.tunableWhite ?? prev.specs.tunableWhite,
        cri: posNum(x.cri) ?? prev.specs.cri,
        beamAngle: posNum(x.beamAngle) ?? prev.specs.beamAngle,
        ip: x.ip?.trim() || prev.specs.ip,
        ugr: posNum(x.ugr) ?? prev.specs.ugr,
        lifetimeHours: posNum(x.lifetimeHours) ?? prev.specs.lifetimeHours,
        dimmable: x.dimmable ?? prev.specs.dimmable,
        dimensions: x.dimensions?.trim() || prev.specs.dimensions,
      },
      description: x.description?.trim() || prev.description,
      lightCharacter: x.lightCharacter?.trim() || prev.lightCharacter,
      tags: x.tags && x.tags.length ? x.tags : prev.tags,
      datasheetName: fileName,
    }));
  };

  const extractFromPdf = async (file: File) => {
    setExtractError(null);
    setExtractNote(null);
    if (file.size > 15 * 1024 * 1024) {
      setExtractError("PDF'en er for stor (maks 15 MB).");
      return;
    }
    const endpoint = getExtractEndpoint();
    if (!endpoint) {
      setExtractError("Live AI-proxyen er ikke konfigureret – den bruges til at læse databladet.");
      return;
    }
    setExtracting(true);
    try {
      const pdf = await fileToDataUrl(file);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = await getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ pdf, filename: file.name }),
      });
      const data = (await res.json().catch(() => ({}))) as { fixture?: ExtractedFixture; error?: string };
      if (!res.ok) throw new Error(data?.error || `Serveren svarede ${res.status}.`);
      if (!data.fixture) throw new Error("Serveren returnerede ingen data.");
      applyExtracted(data.fixture, file.name);
      const missing = Object.values(data.fixture).filter((v) => v === null).length;
      setExtractNote(
        `Felterne er udfyldt fra databladet${missing > 4 ? ` (${missing} felter fremgik ikke og er uændrede)` : ""} – gennemgå dem, før du gemmer.`,
      );
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Kunne ikke læse databladet.");
    } finally {
      setExtracting(false);
    }
  };

  const lmPerW = f.specs.watt > 0 ? Math.round(f.specs.lumen / f.specs.watt) : 0;
  const canSave = f.name.trim().length > 0 && f.specs.lumen > 0 && f.specs.watt > 0;

  const numInput =
    (get: () => number, apply: (n: number) => void) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      apply(Number.isFinite(v) ? v : get());
    };

  return (
    <div className="space-y-5">
      {/* Auto-udfyld fra datablad */}
      <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-3 flex flex-wrap items-center gap-3">
        <label className={`btn-outline text-xs cursor-pointer ${extracting ? "opacity-60 pointer-events-none" : ""}`}>
          {extracting ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
              Læser datablad…
            </span>
          ) : (
            "📄 Udfyld fra datablad (PDF)"
          )}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={extracting}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) extractFromPdf(file);
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-[11px] text-ink-mute flex-1 min-w-[180px]">
          AI læser PDF'en og udfylder felterne automatisk – gennemgå dem altid, før du gemmer.
        </span>
      </div>
      {extractNote && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 text-brand-800 text-sm px-4 py-2.5">{extractNote}</div>
      )}
      {extractError && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5">{extractError}</div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Navn" required>
          <input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="fx GL Panel Pro 600" />
        </Field>
        <Field label="Varenummer (SKU)">
          <input className="input" value={f.sku ?? ""} onChange={(e) => set({ sku: e.target.value })} placeholder="GL-PP-600-40" />
        </Field>
        <Field label="Kategori">
          <select className="select" value={f.category} onChange={(e) => set({ category: e.target.value as FixtureCategory })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Montering">
          <select className="select" value={f.mounting} onChange={(e) => set({ mounting: e.target.value as MountingType })}>
            {MOUNTINGS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="Lysstrøm (lm)" required>
          <input type="number" className="input" value={f.specs.lumen} onChange={numInput(() => f.specs.lumen, (n) => setSpec({ lumen: n }))} />
        </Field>
        <Field label="Effekt (W)" required>
          <input type="number" className="input" value={f.specs.watt} onChange={numInput(() => f.specs.watt, (n) => setSpec({ watt: n }))} />
        </Field>
        <Field label="Virkningsgrad" hint={`${lmPerW} lm/W (beregnet)`}>
          <input className="input bg-surface-soft" value={`${lmPerW} lm/W`} readOnly />
        </Field>
        <Field label="Farvetemp. (K)">
          <input type="number" className="input" value={f.specs.kelvin} disabled={f.specs.tunableWhite} onChange={numInput(() => f.specs.kelvin, (n) => setSpec({ kelvin: n }))} />
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="CRI (Ra)">
          <input type="number" className="input" value={f.specs.cri} onChange={numInput(() => f.specs.cri, (n) => setSpec({ cri: n }))} />
        </Field>
        <Field label="Spredning (°)">
          <input type="number" className="input" value={f.specs.beamAngle} onChange={numInput(() => f.specs.beamAngle, (n) => setSpec({ beamAngle: n }))} />
        </Field>
        <Field label="Kapsling (IP)">
          <input className="input" value={f.specs.ip} onChange={(e) => setSpec({ ip: e.target.value })} placeholder="IP20" />
        </Field>
        <Field label="UGR (blænding)">
          <input type="number" className="input" value={f.specs.ugr ?? ""} onChange={numInput(() => f.specs.ugr ?? 0, (n) => setSpec({ ugr: n }))} />
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
        <Field label="Levetid (t)">
          <input type="number" className="input" value={f.specs.lifetimeHours ?? ""} onChange={numInput(() => f.specs.lifetimeHours ?? 0, (n) => setSpec({ lifetimeHours: n }))} placeholder="50000" />
        </Field>
        <Field label="Mål">
          <input className="input" value={f.specs.dimensions ?? ""} onChange={(e) => setSpec({ dimensions: e.target.value })} placeholder="595×595×28 mm" />
        </Field>
        <Field label="Vejl. pris (kr/stk)">
          <input type="number" className="input" value={f.listPrice ?? ""} onChange={numInput(() => f.listPrice ?? 0, (n) => set({ listPrice: n }))} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-soft pb-2.5">
          <input type="checkbox" checked={!!f.specs.tunableWhite} onChange={(e) => setSpec({ tunableWhite: e.target.checked })} />
          Tunable White
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Field label="Beskrivelse">
            <textarea className="textarea" rows={2} value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <Field label="Lyskarakter (bruges af AI'en)" hint="Kort beskrivelse af lysets udtryk, fx 'bredt, jævnt neutralt arbejdslys'.">
            <input className="input" value={f.lightCharacter ?? ""} onChange={(e) => set({ lightCharacter: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Datablad-navn">
              <input className="input" value={f.datasheetName ?? ""} onChange={(e) => set({ datasheetName: e.target.value })} placeholder="datablad.pdf" />
            </Field>
            <Field label="Datablad-link (URL)">
              <input className="input" value={f.datasheetUrl ?? ""} onChange={(e) => set({ datasheetUrl: e.target.value })} placeholder="https://…" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <Field label="IES/LDT-fil">
              <input className="input" value={f.iesFileName ?? ""} onChange={(e) => set({ iesFileName: e.target.value, hasPhotometry: e.target.value.trim().length > 0 })} placeholder="armatur.ies" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink-soft pb-2.5">
              <input type="checkbox" checked={!!f.hasPhotometry} onChange={(e) => set({ hasPhotometry: e.target.checked })} />
              Har fotometri
            </label>
          </div>
        </div>
        <ImageDropzone label="Produktbillede" value={f.productImage} onChange={(url) => set({ productImage: url })} hint="PNG/JPG – vises i universet og på visualiseringer." maxDim={900} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-line">
        <button type="button" className="btn-ghost" onClick={onCancel}>Annullér</button>
        <button
          type="button"
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!canSave}
          onClick={() => onSave({ ...f, updatedAt: iso() })}
        >
          Gem armatur
        </button>
      </div>
    </div>
  );
}
