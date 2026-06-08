import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ProgressBar } from "../components/ProgressBar";
import { getJobStatus } from "../lib/api";
import { statusLabel } from "../lib/format";
import type { JobStatusOut } from "../lib/types";

const POLL_MS = 2000;

const STEP_ORDER = [
  { keys: ["queued"], label: "Filen uploades" },
  { keys: ["analyzing"], label: "Lydfilen analyseres" },
  { keys: ["preparing"], label: "Lydfilen klargøres" },
  { keys: ["chunking"], label: "Lydfilen opdeles" },
  { keys: ["transcribing"], label: "Transskribering er i gang" },
  { keys: ["merging"], label: "Teksten samles" },
  { keys: ["completed"], label: "Transskriberingen er færdig" },
];

export function StatusPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<JobStatusOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const s = await getJobStatus(id);
        if (cancelled) return;
        setStatus(s);
        setError(null);
        if (s.status === "completed") {
          navigate(`/jobs/${id}`);
          return;
        }
        if (s.status === "failed") return;
        timerRef.current = window.setTimeout(tick, POLL_MS);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Kunne ikke hente status.");
        timerRef.current = window.setTimeout(tick, POLL_MS * 2);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [id, navigate]);

  if (!status && !error) {
    return <div className="card text-center text-slate-600">Henter status…</div>;
  }

  if (status?.status === "failed") {
    return (
      <div className="space-y-4">
        <div className="card">
          <h1 className="text-xl font-semibold text-rose-700">Transskriberingen kunne ikke gennemføres</h1>
          <p className="mt-2 text-sm text-slate-700">
            {status.error_message ?? "Der opstod en fejl. Prøv igen, eller upload en anden fil."}
          </p>
          <div className="mt-4 flex gap-3">
            <Link to="/" className="btn-primary">
              Prøv igen
            </Link>
            <Link to="/historik" className="btn-secondary">
              Se mine transskriberinger
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentIdx = STEP_ORDER.findIndex((s) => s.keys.includes(status?.status ?? ""));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Transskriberingen er i gang</h1>
        <p className="mt-1 text-sm text-slate-600">
          Du kan trygt lukke fanen — vi fortsætter behandlingen, og du finder resultatet under
          {" "}
          <Link to="/historik" className="text-brand-600 hover:underline">
            Mine transskriberinger
          </Link>
          .
        </p>
      </header>

      {status && (
        <div className="card space-y-6">
          <ProgressBar percent={status.progress_percent} label={status.current_step || statusLabel(status.status)} />

          {status.total_chunks > 1 && (
            <p className="text-sm text-slate-600">
              Del {Math.max(1, status.current_chunk)} af {status.total_chunks} transskriberes
            </p>
          )}

          <ol className="space-y-2">
            {STEP_ORDER.map((step, idx) => {
              const state =
                idx < currentIdx
                  ? "done"
                  : idx === currentIdx
                    ? "active"
                    : "pending";
              return (
                <li
                  key={step.label}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                    state === "active" ? "bg-brand-50" : ""
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      state === "done"
                        ? "bg-emerald-500 text-white"
                        : state === "active"
                          ? "bg-brand-500 text-white"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {state === "done" ? "✓" : idx + 1}
                  </span>
                  <span className={`text-sm ${state === "pending" ? "text-slate-500" : "text-slate-900"}`}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}
    </div>
  );
}
