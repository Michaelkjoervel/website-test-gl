import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { vizData } from "../lib/vizData";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { VISUALIZATION_DISCLAIMER } from "../lib/visualizationProvider";
import { formatDate, num } from "../lib/format";
import type { Fixture, Visualization } from "../lib/visualizationTypes";

export function VisualizationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [viz, setViz] = useState<Visualization | undefined>(undefined);
  const [library, setLibrary] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [renderIdx, setRenderIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [v, lib] = await Promise.all([
          id ? vizData.getVisualization(id) : Promise.resolve(undefined),
          vizData.listFixtures(),
        ]);
        if (!alive) return;
        setViz(v);
        setLibrary(lib);
        setRenderIdx((v?.renders.length ?? 1) - 1);
      } catch (e) {
        if (alive) alert(e instanceof Error ? e.message : "Kunne ikke hente visualiseringen.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="card p-10 flex items-center justify-center gap-3 text-ink-mute">
        <span className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        Henter visualiseringen…
      </div>
    );
  }

  if (!viz) {
    return (
      <div className="card p-10 text-center space-y-4">
        <p className="text-ink-soft">Visualiseringen findes ikke (måske slettet).</p>
        <Link to="/visualiseringer" className="btn-primary inline-flex">Til visualiseringer</Link>
      </div>
    );
  }

  const render = viz.renders[Math.max(0, Math.min(renderIdx, viz.renders.length - 1))];

  const fixtures = viz.selectedFixtures
    .map((sf) => {
      const f = library.find((x) => x.id === sf.fixtureId);
      return f ? { f, qty: sf.quantity } : null;
    })
    .filter((x): x is { f: Fixture; qty: number } => x !== null);

  const totalWatt = fixtures.reduce((n, x) => n + x.f.specs.watt * x.qty, 0);
  const totalLumen = fixtures.reduce((n, x) => n + x.f.specs.lumen * x.qty, 0);
  const totalCount = fixtures.reduce((n, x) => n + x.qty, 0);

  const remove = async () => {
    if (!confirm("Slet denne visualisering?")) return;
    try {
      await vizData.deleteVisualization(viz.id);
      navigate("/visualiseringer");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kunne ikke slette.");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-mute">{viz.roomType}</div>
          <h2 className="text-xl font-bold text-ink">{viz.projectName}</h2>
          <div className="text-sm text-ink-soft">{viz.customerName} · oprettet {formatDate(viz.createdAt)}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`chip ${viz.status === "Genereret" ? "bg-brand-100 text-brand-800" : "bg-surface-soft text-ink-soft"}`}>{viz.status}</span>
          <button className="btn-ghost text-ink-mute" onClick={remove}>Slet</button>
        </div>
      </div>

      {viz.roomPhoto && render ? (
        <BeforeAfterSlider before={viz.roomPhoto} after={render.imageData} />
      ) : viz.roomPhoto ? (
        <img src={viz.roomPhoto} alt="Rum" className="rounded-2xl border border-surface-line w-full" />
      ) : null}

      {render && (
        <div className="flex flex-wrap items-center gap-3">
          <a href={render.imageData} download={`${viz.customerName || "visualisering"}-${viz.projectName || viz.id}.jpg`} className="btn-outline">Download billede</a>
          <span className="text-[12px] text-ink-mute">Scenarie: {render.scenario} · motor: {render.provider}</span>
        </div>
      )}

      {viz.renders.length > 1 && (
        <div>
          <div className="label mb-1.5">Varianter ({num.format(viz.renders.length)})</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {viz.renders.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setRenderIdx(i)}
                className={`shrink-0 rounded-xl overflow-hidden border-2 ${i === renderIdx ? "border-brand-500" : "border-surface-line"}`}
              >
                <img src={r.imageData} alt={r.scenario} className="h-20 w-28 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <Kpi label="Armaturer" value={num.format(totalCount)} />
        <Kpi label="Samlet effekt" value={`${num.format(totalWatt)} W`} />
        <Kpi label="Samlet lysstrøm" value={`${num.format(totalLumen)} lm`} />
      </div>

      <div className="card p-5">
        <div className="label mb-3">Valgte armaturer</div>
        <div className="divide-y divide-surface-line">
          {fixtures.map(({ f, qty }) => (
            <div key={f.id} className="flex items-center gap-3 py-2.5">
              <div className="w-11 h-11 rounded-lg bg-surface-soft border border-surface-line shrink-0 flex items-center justify-center overflow-hidden">
                {f.productImage ? <img src={f.productImage} alt={f.name} className="w-full h-full object-contain p-0.5" /> : <span className="text-[10px] text-ink-mute">—</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">{f.name}</div>
                <div className="text-[11px] text-ink-mute">{f.category} · {num.format(f.specs.lumen)} lm · {f.specs.watt} W</div>
              </div>
              <div className="text-sm font-semibold text-ink">{qty}×</div>
            </div>
          ))}
          {fixtures.length === 0 && <div className="text-sm text-ink-mute py-2">Ingen armaturer registreret.</div>}
        </div>
      </div>

      {viz.notes && (
        <div className="card p-5">
          <div className="label mb-1.5">Note</div>
          <p className="text-sm text-ink-soft whitespace-pre-wrap">{viz.notes}</p>
        </div>
      )}

      {viz.estimateId && (
        <div className="card p-5 flex items-center justify-between gap-3">
          <div className="text-sm text-ink-soft">Knyttet til et estimat.</div>
          <div className="flex gap-2">
            <Link to={`/estimat/${viz.estimateId}`} className="btn-outline">Se estimat</Link>
            <Link to={`/forretningscase/${viz.estimateId}`} className="btn-outline">Forretningscase</Link>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 text-[12px] text-brand-800">{VISUALIZATION_DISCLAIMER}</div>

      <div className="flex justify-between">
        <Link to="/visualiseringer" className="btn-ghost">← Alle visualiseringer</Link>
        <Link to="/ny-visualisering" className="btn-primary">Ny visualisering</Link>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="kpi-label">{label}</div>
      <div className="kpi-num mt-1">{value}</div>
    </div>
  );
}
