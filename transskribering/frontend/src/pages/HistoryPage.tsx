import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { deleteJob, exportUrl, listJobs, startJob } from "../lib/api";
import { formatDateTime, formatDuration } from "../lib/format";
import type { JobOut } from "../lib/types";

export function HistoryPage() {
  const [jobs, setJobs] = useState<JobOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setJobs(await listJobs());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente listen.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onDelete(job: JobOut) {
    if (!window.confirm(`Slet "${job.title}" permanent?`)) return;
    try {
      await deleteJob(job.id);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sletning fejlede.");
    }
  }

  async function onRetry(job: JobOut) {
    try {
      await startJob(job.id);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Genstart fejlede.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Mine transskriberinger</h1>
        <Link to="/" className="btn-primary">
          Ny transskribering
        </Link>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {!jobs ? (
        <div className="card text-center text-slate-600">Henter…</div>
      ) : jobs.length === 0 ? (
        <div className="card text-center">
          <p className="text-slate-600">Du har endnu ikke lavet en transskribering.</p>
          <Link to="/" className="btn-primary mt-4 inline-flex">
            Lav den første
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Titel</th>
                <th className="px-4 py-3">Filnavn</th>
                <th className="px-4 py-3">Længde</th>
                <th className="px-4 py-3">Dato</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link to={`/jobs/${job.id}`} className="hover:text-brand-700">
                      {job.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{job.original_filename}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDuration(job.duration_seconds)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(job.updated_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {job.status === "completed" && (
                        <>
                          <a className="btn-secondary !px-3 !py-1.5 text-xs" href={exportUrl(job.id, "docx")}>
                            Word
                          </a>
                          <a className="btn-secondary !px-3 !py-1.5 text-xs" href={exportUrl(job.id, "pdf")}>
                            PDF
                          </a>
                        </>
                      )}
                      {job.status === "failed" && (
                        <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => onRetry(job)}>
                          Prøv igen
                        </button>
                      )}
                      <button
                        className="btn-danger !px-3 !py-1.5 text-xs"
                        onClick={() => onDelete(job)}
                        title="Slet permanent"
                      >
                        Slet
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="divide-y divide-slate-100 md:hidden">
            {jobs.map((job) => (
              <li key={job.id} className="p-4">
                <Link to={`/jobs/${job.id}`} className="block">
                  <div className="font-medium text-slate-900">{job.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {job.original_filename} · {formatDuration(job.duration_seconds)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{formatDateTime(job.updated_at)}</div>
                </Link>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={job.status} />
                  <div className="flex gap-2">
                    {job.status === "completed" && (
                      <a className="btn-secondary !px-3 !py-1.5 text-xs" href={exportUrl(job.id, "docx")}>
                        Word
                      </a>
                    )}
                    <button className="btn-danger !px-3 !py-1.5 text-xs" onClick={() => onDelete(job)}>
                      Slet
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
