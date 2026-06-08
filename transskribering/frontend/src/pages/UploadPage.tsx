import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dropzone } from "../components/Dropzone";
import { ProgressBar } from "../components/ProgressBar";
import { startJob, uploadFile } from "../lib/api";
import { formatDuration, formatFileSize } from "../lib/format";
import type { JobOut, TimestampMode, TranscriptionMode } from "../lib/types";

interface Settings {
  title: string;
  transcription_mode: TranscriptionMode;
  timestamp_mode: TimestampMode;
  speaker_detection_enabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  title: "",
  transcription_mode: "cleaned",
  timestamp_mode: "none",
  speaker_detection_enabled: false,
};

export function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile(picked: File) {
    setFile(picked);
    setError(null);
    if (!settings.title) {
      setSettings({ ...settings, title: picked.name.replace(/\.[^.]+$/, "") });
    }
  }

  async function handleStart() {
    if (!file || submitting) return;
    setSubmitting(true);
    setError(null);
    setUploadPercent(0);
    let created: JobOut;
    try {
      created = await uploadFile(file, {
        title: settings.title.trim() || undefined,
        transcription_mode: settings.transcription_mode,
        timestamp_mode: settings.timestamp_mode,
        speaker_detection_enabled: settings.speaker_detection_enabled,
        onProgress: (p) => setUploadPercent(p),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload fejlede.");
      setUploadPercent(null);
      setSubmitting(false);
      return;
    }
    try {
      await startJob(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transskriberingen kunne ikke startes.");
      setSubmitting(false);
      return;
    }
    navigate(`/jobs/${created.id}/status`);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">Transskriber din lydoptagelse</h1>
        <p className="mx-auto max-w-2xl text-base text-slate-600">
          Upload en lydfil på op til 2 timer, og få den transskriberet til dansk tekst.
        </p>
      </header>

      <section className="card">
        {!file ? (
          <Dropzone onFile={pickFile} maxMb={500} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{file.name}</div>
                <div className="text-xs text-slate-500">
                  {formatFileSize(file.size)} · {file.type || "ukendt MIME-type"}
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setFile(null);
                  setUploadPercent(null);
                  setError(null);
                }}
                disabled={submitting}
              >
                Skift fil
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="title">
                  Titel (valgfri)
                </label>
                <input
                  id="title"
                  className="input"
                  value={settings.title}
                  onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                  placeholder={file.name}
                />
              </div>
              <div>
                <label className="label" htmlFor="mode">
                  Transskriberingstype
                </label>
                <select
                  id="mode"
                  className="input"
                  value={settings.transcription_mode}
                  onChange={(e) =>
                    setSettings({ ...settings, transcription_mode: e.target.value as TranscriptionMode })
                  }
                >
                  <option value="cleaned">Let renset (anbefalet)</option>
                  <option value="verbatim">Ordret</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ts">
                  Tidskoder
                </label>
                <select
                  id="ts"
                  className="input"
                  value={settings.timestamp_mode}
                  onChange={(e) => setSettings({ ...settings, timestamp_mode: e.target.value as TimestampMode })}
                >
                  <option value="none">Ingen</option>
                  <option value="paragraph">Ved hvert afsnit</option>
                  <option value="interval">Hvert minut</option>
                </select>
              </div>
              <div>
                <label className="label">Talere</label>
                <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-100"
                    checked={settings.speaker_detection_enabled}
                    onChange={(e) =>
                      setSettings({ ...settings, speaker_detection_enabled: e.target.checked })
                    }
                  />
                  Forsøg automatisk taleropdeling
                </label>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {uploadPercent !== null && (
              <ProgressBar percent={uploadPercent} label="Uploader filen til serveren" />
            )}

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Upload kun lydoptagelser, som du har ret til at behandle. Lydfilen behandles med det formål at
                generere en transskribering. Den slettes automatisk efter den opbevaringsperiode, der er valgt på
                serveren.
              </p>
              <button type="button" className="btn-primary" onClick={handleStart} disabled={submitting}>
                {submitting ? "Starter…" : "Start transskribering"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Info title="Op til 2 timer" body="Lange optagelser opdeles automatisk i mindre stykker og samles igen." />
        <Info title="Dansk som standard" body="Æ, ø og å, naturlig tegnsætning og læsevenlige afsnit." />
        <Info title="Eksport som du vil" body="Hent som Word, PDF eller TXT — og som SRT hvis der er tidsstempler." />
      </section>
    </div>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{body}</div>
    </div>
  );
}
