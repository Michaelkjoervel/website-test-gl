import { useEffect, useState } from "react";
import {
  downloadDocumentDocx,
  generateDocument,
  listDocumentTypes,
} from "../lib/api";
import type { DocumentType, DocumentTypeInfo } from "../lib/types";

interface Props {
  jobId: string;
  jobTitle: string;
  disabled?: boolean;
}

interface ResultState {
  type: DocumentType;
  label: string;
  content: string;
}

export function DocumentGenerator({ jobId, jobTitle, disabled }: Props) {
  const [types, setTypes] = useState<DocumentTypeInfo[]>([]);
  const [generating, setGenerating] = useState<DocumentType | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDocumentTypes()
      .then(setTypes)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Kunne ikke hente dokumenttyper.")
      );
  }, []);

  async function handleGenerate(type: DocumentType) {
    if (generating || disabled) return;
    setGenerating(type);
    setError(null);
    try {
      const res = await generateDocument(jobId, type);
      setResult({ type: res.type, label: res.label, content: res.content });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Genereringen fejlede.");
    } finally {
      setGenerating(null);
    }
  }

  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    setError(null);
    const safe = jobTitle.replace(/[^A-Za-z0-9æøåÆØÅ_-]+/g, "_").slice(0, 80) || "dokument";
    const suffix = result.type.replace(/_/g, "-");
    try {
      await downloadDocumentDocx(jobId, result.type, result.content, `${safe}_${suffix}.docx`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Download fejlede.");
    } finally {
      setDownloading(false);
    }
  }

  if (disabled) {
    return (
      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900">AI-dokumenter</h2>
        <p className="mt-1 text-sm text-slate-500">
          Du kan generere AI-dokumenter, så snart transskriberingen er færdig.
        </p>
      </section>
    );
  }

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">AI-dokumenter</h2>
        <p className="mt-1 text-sm text-slate-600">
          Generér et professionelt dokument ud fra transskriberingen — vælg type, gennemse og hent som
          Word.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {types.map((t) => {
          const isLoading = generating === t.type;
          const isSelected = result?.type === t.type;
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => handleGenerate(t.type)}
              disabled={generating !== null}
              className={`text-left rounded-xl border p-4 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-slate-900">{t.label}</div>
                {isLoading && <span className="text-xs text-slate-500">Genererer…</span>}
                {!isLoading && isSelected && (
                  <span className="text-xs font-medium text-brand-600">Valgt</span>
                )}
              </div>
              <div className="mt-1 text-sm text-slate-600">{t.description}</div>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">{result.label}</div>
              <div className="text-xs text-slate-500">
                Du kan redigere teksten herunder, før du downloader.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleGenerate(result.type)}
                disabled={generating !== null}
              >
                {generating === result.type ? "Genererer…" : "Generér igen"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleDownload}
                disabled={downloading || generating !== null || !result.content.trim()}
              >
                {downloading ? "Henter…" : "Download som Word"}
              </button>
            </div>
          </div>
          <textarea
            value={result.content}
            onChange={(e) => setResult({ ...result, content: e.target.value })}
            className="min-h-[260px] w-full rounded-lg border border-slate-200 bg-white p-4 text-[15px] leading-7 text-slate-900 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      )}
    </section>
  );
}
