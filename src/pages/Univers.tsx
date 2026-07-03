import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Fixture, FixtureCategory } from "../lib/visualizationTypes";
import { vizData, type DataMode } from "../lib/vizData";
import { FixtureForm } from "../components/FixtureForm";
import { FixtureImport } from "../components/FixtureImport";
import { DataModeBadge } from "../components/DataModeBadge";
import { dkkInt, num } from "../lib/format";

const ALL_CATEGORIES: (FixtureCategory | "Alle")[] = [
  "Alle",
  "LED-panel",
  "Downlight",
  "Lineær / pendel",
  "Highbay / lavbay",
  "Spot / skinne",
  "Facade / væg",
  "Udendørs",
];

export function Univers() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<DataMode>("local");
  const [editing, setEditing] = useState<Fixture | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [cat, setCat] = useState<(typeof ALL_CATEGORIES)[number]>("Alle");
  const [q, setQ] = useState("");

  const refresh = async () => {
    try {
      setMode(await vizData.mode());
      setFixtures(await vizData.listFixtures());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kunne ikke hente kataloget.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return fixtures.filter(
      (f) =>
        (cat === "Alle" || f.category === cat) &&
        (!needle ||
          f.name.toLowerCase().includes(needle) ||
          (f.sku ?? "").toLowerCase().includes(needle) ||
          (f.tags ?? []).some((t) => t.toLowerCase().includes(needle))),
    );
  }, [fixtures, cat, q]);

  const saveFixture = async (fx: Fixture) => {
    try {
      await vizData.saveFixture(fx);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kunne ikke gemme armaturet.");
      return;
    }
    setEditing(null);
    setCreating(false);
    refresh();
  };

  const remove = async (fx: Fixture) => {
    if (!confirm(`Slet "${fx.name}" fra universet?${mode === "shared" ? " (Slettes for hele teamet.)" : ""}`)) return;
    try {
      await vizData.deleteFixture(fx.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kunne ikke slette.");
      return;
    }
    refresh();
  };

  const resetDemo = async () => {
    const warn =
      mode === "shared"
        ? "Nulstil universet til demo-armaturerne? Dette sletter HELE TEAMETS katalog og kan ikke fortrydes."
        : "Nulstil universet til demo-armaturerne? Dine egne ændringer i universet slettes.";
    if (!confirm(warn)) return;
    try {
      setFixtures(await vizData.resetFixtures());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kunne ikke nulstille.");
    }
  };

  const modalOpen = creating || editing !== null;

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="card p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute">Visualisering</div>
            <DataModeBadge mode={mode} />
          </div>
          <h2 className="text-lg font-bold text-ink mt-0.5">Universet · produktbibliotek</h2>
          <p className="text-sm text-ink-soft mt-1 max-w-2xl">
            Jeres armaturer med datablade, billeder, fotometri (IES/LDT) og specs. Grundlaget som
            visualiseringerne bygger på. <b>{num.format(fixtures.length)}</b> armaturer i universet.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={resetDemo}>Nulstil demo</button>
          <button className="btn-outline" onClick={() => setImporting(true)}>Importér</button>
          <button className="btn-primary" onClick={() => setCreating(true)}>+ Tilføj armatur</button>
        </div>
      </div>

      {/* Filtre */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Søg navn, SKU eller tag…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`chip border ${cat === c ? "bg-brand-500 text-white border-brand-500" : "bg-white text-ink-soft border-surface-line hover:border-brand-300"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="card p-10 flex items-center justify-center gap-3 text-ink-mute">
          <span className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          Henter kataloget…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-ink-mute">Ingen armaturer matcher. Justér filteret, eller tilføj et nyt.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <FixtureCard key={f.id} fx={f} onEdit={() => setEditing(f)} onDelete={() => remove(f)} />
          ))}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Link to="/ny-visualisering" className="btn-primary">Lav en visualisering →</Link>
      </div>

      {modalOpen && (
        <Modal
          title={creating ? "Nyt armatur" : "Redigér armatur"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          <FixtureForm
            initial={editing ?? undefined}
            onSave={saveFixture}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        </Modal>
      )}

      {importing && (
        <Modal title="Importér armaturer" onClose={() => setImporting(false)}>
          <FixtureImport
            onCancel={() => setImporting(false)}
            onDone={(added, skipped) => {
              setImporting(false);
              refresh();
              if (added > 0 || skipped > 0) {
                alert(
                  `${added} armaturer importeret${skipped > 0 ? `, ${skipped} sprunget over (findes allerede med samme SKU/navn)` : ""}.`,
                );
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function FixtureCard({ fx, onEdit, onDelete }: { fx: Fixture; onEdit: () => void; onDelete: () => void }) {
  const s = fx.specs;
  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="aspect-[4/3] bg-surface-soft border-b border-surface-line flex items-center justify-center overflow-hidden">
        {fx.productImage ? (
          <img src={fx.productImage} alt={fx.name} className="w-full h-full object-contain p-3" />
        ) : (
          <span className="text-ink-mute text-sm">Intet billede</span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-ink leading-tight">{fx.name}</div>
            <div className="text-[11px] text-ink-mute">{fx.sku || "—"}</div>
          </div>
          <span className="chip bg-brand-50 text-brand-700 shrink-0">{fx.category}</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-[12px]">
          <Spec label="Lysstrøm" value={`${num.format(s.lumen)} lm`} />
          <Spec label="Effekt" value={`${s.watt} W`} />
          <Spec label="Farve" value={s.tunableWhite ? "Tunable" : `${s.kelvin} K`} />
          <Spec label="Virkning" value={`${s.watt > 0 ? Math.round(s.lumen / s.watt) : 0} lm/W`} />
          <Spec label="Spredning" value={`${s.beamAngle}°`} />
          <Spec label="Kapsling" value={s.ip} />
        </dl>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {fx.hasPhotometry && <span className="chip bg-brand-100 text-brand-800 text-[10px]">IES/LDT</span>}
          {(fx.datasheetName || fx.datasheetUrl) && <span className="chip bg-surface-soft text-ink-soft text-[10px]">Datablad</span>}
          <span className="chip bg-surface-soft text-ink-soft text-[10px]">{fx.mounting}</span>
        </div>

        <div className="mt-auto pt-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">{fx.listPrice ? dkkInt(fx.listPrice) : "—"}</span>
          <div className="flex gap-1.5">
            <button className="btn-outline px-3 py-1.5 text-xs" onClick={onEdit}>Redigér</button>
            <button className="btn-ghost px-3 py-1.5 text-xs text-ink-mute" onClick={onDelete}>Slet</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-mute">{label}</dt>
      <dd className="text-ink font-medium">{value}</dd>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-ink/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="card w-full max-w-3xl my-8 p-5 md:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button className="btn-ghost px-2 py-1" onClick={onClose} aria-label="Luk">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
