import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { vizStorage } from "../lib/visualizationStorage";
import { formatDate, num } from "../lib/format";
import type { Visualization } from "../lib/visualizationTypes";

export function Visualizations() {
  const [items, setItems] = useState<Visualization[]>(() => vizStorage.listVisualizations());

  const stats = useMemo(
    () => ({
      total: items.length,
      generated: items.filter((v) => v.renders.length > 0).length,
    }),
    [items],
  );

  const remove = (v: Visualization) => {
    if (confirm(`Slet "${v.projectName}"?`)) {
      vizStorage.deleteVisualization(v.id);
      setItems(vizStorage.listVisualizations());
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute">Visualisering</div>
          <h2 className="text-lg font-bold text-ink mt-0.5">Kundevisualiseringer</h2>
          <p className="text-sm text-ink-soft mt-1">
            {num.format(stats.total)} gemte · {num.format(stats.generated)} genereret. Vis kunden præcis, hvordan løsningen kommer til at se ud.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/univers" className="btn-outline">Åbn universet</Link>
          <Link to="/ny-visualisering" className="btn-primary">+ Ny visualisering</Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 mx-auto flex items-center justify-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-brand-500">
              <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
              <path d="M3 15l4-4 4 4 3-3 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="9" r="1.4" fill="currentColor" />
            </svg>
          </div>
          <p className="text-ink-soft">Ingen visualiseringer endnu. Upload et rumbillede og vælg armaturer for at lave den første.</p>
          <Link to="/ny-visualisering" className="btn-primary inline-flex">Lav din første visualisering</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((v) => {
            const thumb = v.renders[v.renders.length - 1]?.imageData ?? v.roomPhoto;
            return (
              <div key={v.id} className="card overflow-hidden flex flex-col group">
                <Link to={`/visualisering/${v.id}`} className="block aspect-[16/10] bg-surface-soft border-b border-surface-line overflow-hidden">
                  {thumb ? (
                    <img src={thumb} alt={v.projectName} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink-mute text-sm">Intet billede</div>
                  )}
                </Link>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/visualisering/${v.id}`} className="font-semibold text-ink hover:text-brand-700 truncate block">{v.projectName}</Link>
                      <div className="text-[12px] text-ink-mute truncate">{v.customerName}</div>
                    </div>
                    <span className={`chip shrink-0 ${v.renders.length ? "bg-brand-100 text-brand-800" : "bg-surface-soft text-ink-soft"}`}>{v.status}</span>
                  </div>
                  <div className="text-[11px] text-ink-mute mt-2">{v.roomType} · {formatDate(v.createdAt)}</div>
                  <div className="mt-auto pt-3 flex items-center justify-between">
                    <Link to={`/visualisering/${v.id}`} className="btn-outline px-3 py-1.5 text-xs">Åbn</Link>
                    <button className="btn-ghost px-3 py-1.5 text-xs text-ink-mute" onClick={() => remove(v)}>Slet</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
