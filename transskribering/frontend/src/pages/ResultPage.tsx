import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DocumentGenerator } from "../components/DocumentGenerator";
import { StatusBadge } from "../components/StatusBadge";
import { audioUrl, deleteJob, exportUrl, getJob, updateJob } from "../lib/api";
import { formatDateTime, formatDuration, formatFileSize } from "../lib/format";
import type { JobDetail } from "../lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ResultPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [search, setSearch] = useState("");
  const [replace, setReplace] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  const lastSavedRef = useRef<{ text: string; title: string }>({ text: "", title: "" });
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await getJob(id);
        if (cancelled) return;
        setJob(j);
        setText(j.edited_text || j.raw_text || "");
        setTitle(j.title);
        lastSavedRef.current = { text: j.edited_text || j.raw_text || "", title: j.title };
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Kunne ikke hente transskriberingen.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const flushSave = useCallback(async () => {
    if (!job) return;
    const current = { text, title };
    if (
      current.text === lastSavedRef.current.text &&
      current.title === lastSavedRef.current.title
    ) {
      return;
    }
    setSaveState("saving");
    try {
      const updated = await updateJob(id, { title: current.title, edited_text: current.text });
      lastSavedRef.current = { text: updated.edited_text, title: updated.title };
      setSaveState("saved");
      window.setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (err: unknown) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Lagring fejlede.");
    }
  }, [id, job, text, title]);

  useEffect(() => {
    if (!job) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(flushSave, 1200);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [text, title, flushSave, job]);

  useEffect(() => {
    function onUnload() {
      navigator.sendBeacon?.(
        `/api/transcriptions/${id}`,
        new Blob([JSON.stringify({ title, edited_text: text })], { type: "application/json" })
      );
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [id, text, title]);

  const audioAvailable = !!job && !job.audio_deleted_at && job.status === "completed";

  const timestampRegex = useMemo(() => /\[(\d{2}):(\d{2}):(\d{2})\]/g, []);

  function jumpToTimestamp(ts: string) {
    const m = ts.match(/(\d{2}):(\d{2}):(\d{2})/);
    if (!m) return;
    const seconds = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = seconds;
      audio.play().catch(() => undefined);
    }
  }

  function copyAll() {
    navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  function applyReplace() {
    if (!search) return;
    setText(text.split(search).join(replace));
  }

  async function handleDelete() {
    if (!job) return;
    if (!window.confirm("Slet transskriberingen og den tilhørende lydfil permanent?")) return;
    try {
      await deleteJob(job.id);
      navigate("/historik");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sletning fejlede.");
    }
  }

  if (error && !job) {
    return (
      <div className="card">
        <p className="text-rose-700">{error}</p>
        <Link to="/historik" className="btn-secondary mt-3 inline-flex">
          Tilbage til mine transskriberinger
        </Link>
      </div>
    );
  }

  if (!job) return <div className="card text-center text-slate-600">Henter transskriberingen…</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full max-w-xl border-0 bg-transparent text-2xl font-semibold text-slate-900 focus:outline-none focus:ring-0"
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>{job.original_filename}</span>
            <span>·</span>
            <span>{formatDuration(job.duration_seconds)}</span>
            <span>·</span>
            <span>{formatFileSize(job.file_size)}</span>
            <span>·</span>
            <span>{formatDateTime(job.created_at)}</span>
            <StatusBadge status={job.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} />
        </div>
      </header>

      {audioAvailable && (
        <div className="card">
          <audio ref={audioRef} controls className="w-full" src={audioUrl(job.id)} />
          <p className="mt-2 text-xs text-slate-500">
            Klik på en tidskode i teksten for at hoppe til det tidspunkt.
          </p>
        </div>
      )}

      <div className="card space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Søg</label>
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Søg i teksten" />
          </div>
          <div>
            <label className="label">Erstat med</label>
            <div className="flex gap-2">
              <input className="input" value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Erstatning" />
              <button type="button" className="btn-secondary" onClick={applyReplace} disabled={!search}>
                Erstat alle
              </button>
            </div>
          </div>
        </div>

        <TimestampedTextarea
          value={text}
          onChange={setText}
          highlight={search}
          regex={timestampRegex}
          onTimestampClick={audioAvailable ? jumpToTimestamp : undefined}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-secondary" onClick={copyAll}>
            Kopiér hele teksten
          </button>
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary" href={exportUrl(job.id, "txt")}>TXT</a>
            <a className="btn-secondary" href={exportUrl(job.id, "docx")}>Word</a>
            <a className="btn-secondary" href={exportUrl(job.id, "pdf")}>PDF</a>
            <a className="btn-secondary" href={exportUrl(job.id, "srt")}>SRT</a>
          </div>
        </div>
      </div>

      <DocumentGenerator jobId={job.id} jobTitle={title} disabled={job.status !== "completed"} />

      <div className="flex items-center justify-between">
        <Link to="/historik" className="text-sm text-slate-600 hover:text-slate-900">
          ← Tilbage til mine transskriberinger
        </Link>
        <button type="button" className="btn-danger" onClick={handleDelete}>
          Slet transskribering
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <span className="text-xs text-slate-500">Gemmer…</span>;
  if (state === "saved") return <span className="text-xs text-emerald-600">Gemt</span>;
  if (state === "error") return <span className="text-xs text-rose-600">Lagring fejlede</span>;
  return null;
}

interface TextareaProps {
  value: string;
  onChange: (v: string) => void;
  highlight: string;
  regex: RegExp;
  onTimestampClick?: (ts: string) => void;
}

function TimestampedTextarea({ value, onChange, onTimestampClick }: TextareaProps) {
  const timestamps = useMemo(() => {
    const out: string[] = [];
    const re = /\[(\d{2}):(\d{2}):(\d{2})\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(value)) !== null) {
      out.push(m[0]);
    }
    return Array.from(new Set(out));
  }, [value]);

  return (
    <div className="space-y-2">
      {onTimestampClick && timestamps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {timestamps.slice(0, 30).map((ts) => (
            <button
              key={ts}
              type="button"
              className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
              onClick={() => onTimestampClick(ts)}
            >
              {ts}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="min-h-[55vh] w-full rounded-lg border border-slate-200 bg-white p-4 font-mono text-[15px] leading-7 text-slate-900 shadow-inner focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}
