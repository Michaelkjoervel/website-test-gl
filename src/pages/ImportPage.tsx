import { useEffect, useRef, useState } from "react";
import { storage } from "../lib/storage";
import {
  downloadSampleHistoricalJson,
  parseImportFile,
} from "../lib/importer";
import { dkkInt, num } from "../lib/format";
import type { HistoricalOffer } from "../lib/types";

export function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<HistoricalOffer[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [stored, setStored] = useState<HistoricalOffer[]>([]);

  useEffect(() => {
    setStored(storage.listHistorical());
  }, []);

  const handleFile = async (file: File) => {
    const result = await parseImportFile(file);
    setPreview(result.rows);
    setWarnings(result.warnings);
  };

  const confirmImport = () => {
    if (preview.length === 0) return;
    storage.appendHistorical(preview);
    setStored(storage.listHistorical());
    setPreview([]);
    setWarnings([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const clear = () => {
    if (!confirm("Slet alle importerede historiske tilbud?")) return;
    storage.saveHistorical([]);
    setStored([]);
  };

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h3 className="text-lg font-bold text-ink">Importér tidligere tilbud</h3>
        <p className="text-sm text-ink-mute mt-1 max-w-2xl">
          Upload en CSV- eller JSON-fil med historiske tilbud. Disse bruges som
          datagrundlag i læringsmodulet og forbedrer fremtidige estimater. Når
          green light senere leverer en stor datasamling, kan strukturen
          udvides – ukendte kolonner bevares automatisk.
        </p>

        <div
          className="mt-5 rounded-2xl border-2 border-dashed border-surface-line bg-surface-soft px-6 py-10 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <div className="w-12 h-12 rounded-2xl bg-white border border-surface-line mx-auto flex items-center justify-center text-brand-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="mt-3 font-semibold text-ink">
            Træk filen hertil eller klik for at vælge
          </div>
          <div className="text-xs text-ink-mute mt-1">
            Understøttede formater: CSV, JSON
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,application/json,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            className="btn-primary mt-4"
            onClick={() => fileRef.current?.click()}
          >
            Vælg fil
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <button
            className="btn-outline"
            onClick={downloadSampleHistoricalJson}
          >
            Download eksempel-JSON
          </button>
          <p className="text-xs text-ink-mute max-w-md">
            JSON-strukturen følger feltnavnene: projectName, areaType,
            luminaireCount, controlType, luxLevel, kelvin, annualBurnHours,
            electricityPrice, estimatedPrice, actualPrice, status.
          </p>
        </div>
      </section>

      {preview.length > 0 && (
        <section className="card p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="kpi-label">Eksempel på importerede rækker</div>
              <div className="text-sm text-ink-mute mt-0.5">
                {preview.length} rækker klar til import
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setPreview([])}>
                Annullér
              </button>
              <button className="btn-primary" onClick={confirmImport}>
                Bekræft import
              </button>
            </div>
          </div>
          {warnings.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-3 mb-3">
              {warnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}
          <PreviewTable rows={preview.slice(0, 10)} />
          {preview.length > 10 && (
            <div className="text-xs text-ink-mute mt-2">
              Viser 10 af {preview.length} rækker.
            </div>
          )}
        </section>
      )}

      <section className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="kpi-label">Gemte historiske tilbud</div>
            <div className="text-sm text-ink-mute mt-0.5">
              {stored.length} datapunkter
            </div>
          </div>
          {stored.length > 0 && (
            <button className="btn-ghost text-red-600" onClick={clear}>
              Slet alle
            </button>
          )}
        </div>
        {stored.length === 0 ? (
          <div className="text-sm text-ink-mute">
            Ingen historiske tilbud gemt endnu.
          </div>
        ) : (
          <PreviewTable rows={stored.slice(0, 20)} />
        )}
      </section>
    </div>
  );
}

function PreviewTable({ rows }: { rows: HistoricalOffer[] }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-ink-mute">
          <tr>
            <th className="text-left px-2 py-2">Projekt</th>
            <th className="text-left px-2 py-2">Område</th>
            <th className="text-right px-2 py-2">Antal</th>
            <th className="text-left px-2 py-2">Styring</th>
            <th className="text-right px-2 py-2">Estimat</th>
            <th className="text-right px-2 py-2">Faktisk</th>
            <th className="text-left px-2 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-surface-line">
              <td className="px-2 py-2 font-medium text-ink">
                {r.projectName}
              </td>
              <td className="px-2 py-2 text-ink-soft">{r.areaType}</td>
              <td className="px-2 py-2 text-right">
                {num.format(r.luminaireCount)}
              </td>
              <td className="px-2 py-2 text-ink-soft">{r.controlType}</td>
              <td className="px-2 py-2 text-right">
                {dkkInt(r.estimatedPrice)}
              </td>
              <td className="px-2 py-2 text-right">
                {dkkInt(r.actualPrice)}
              </td>
              <td className="px-2 py-2 text-ink-soft">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
