import { useMemo, useState } from "react";
import {
  parseFixturesText,
  fixtureCsvTemplate,
  fixtureJsonSample,
  type FixtureImportResult,
} from "../lib/fixtureImporter";
import { StorageQuotaError } from "../lib/visualizationStorage";
import { vizData } from "../lib/vizData";

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface FixtureImportProps {
  onDone: (added: number, skipped: number) => void;
  onCancel: () => void;
}

export function FixtureImport({ onDone, onCancel }: FixtureImportProps) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const result: FixtureImportResult = useMemo(
    () => (text.trim() ? parseFixturesText(text, fileName) : { fixtures: [], warnings: [] }),
    [text, fileName],
  );

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
  };

  const [busy, setBusy] = useState(false);

  const doImport = async () => {
    setError(null);
    setBusy(true);
    try {
      const { added, skipped } = await vizData.addFixtures(result.fixtures);
      onDone(added, skipped);
    } catch (e) {
      setError(e instanceof StorageQuotaError ? e.message : e instanceof Error ? e.message : "Import fejlede.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Importér mange armaturer på én gang fra <b>CSV</b> eller <b>JSON</b>. Kun <code>name</code> er
        påkrævet; resten udfyldes med fornuftige standarder. Billeder angives som <b>URL</b> i
        kolonnen <code>productImage</code>.
      </p>

      <div className="flex flex-wrap gap-2">
        <button className="btn-outline text-xs" onClick={() => downloadText("armaturer-skabelon.csv", fixtureCsvTemplate(), "text/csv")}>
          ↓ CSV-skabelon
        </button>
        <button className="btn-outline text-xs" onClick={() => downloadText("armaturer-eksempel.json", fixtureJsonSample(), "application/json")}>
          ↓ JSON-eksempel
        </button>
        <label className="btn-outline text-xs cursor-pointer">
          Vælg fil…
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>

      <textarea
        className="textarea font-mono text-[12px]"
        rows={8}
        placeholder="…eller indsæt CSV/JSON her"
        value={text}
        onChange={(e) => {
          setFileName("");
          setText(e.target.value);
        }}
      />

      {text.trim() && (
        <div className="rounded-xl border border-surface-line p-4 space-y-2">
          <div className="text-sm">
            <b>{result.fixtures.length}</b> armaturer klar til import
            {result.warnings.length > 0 && (
              <span className="text-amber-600"> · {result.warnings.length} advarsler</span>
            )}
          </div>
          {result.fixtures.length > 0 && (
            <div className="text-[12px] text-ink-mute">
              {result.fixtures.slice(0, 6).map((f) => f.name).join(", ")}
              {result.fixtures.length > 6 ? ` +${result.fixtures.length - 6} flere` : ""}
            </div>
          )}
          {result.warnings.length > 0 && (
            <ul className="text-[11px] text-amber-700 list-disc pl-4 max-h-28 overflow-auto">
              {result.warnings.slice(0, 20).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-line">
        <button className="btn-ghost" onClick={onCancel}>Annullér</button>
        <button
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={result.fixtures.length === 0 || busy}
          onClick={doImport}
        >
          {busy ? "Importerer…" : `Importér ${result.fixtures.length || ""} armaturer`}
        </button>
      </div>
    </div>
  );
}
