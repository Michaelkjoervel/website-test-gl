import { useState, type ChangeEvent } from "react";
import type {
  Fixture,
  FixtureCategory,
  MountingType,
} from "../lib/visualizationTypes";
import { newVizId } from "../lib/visualizationStorage";
import { Field } from "./Field";
import { ImageDropzone } from "./ImageDropzone";

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
