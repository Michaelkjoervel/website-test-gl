import { statusLabel } from "../lib/format";

const TONES: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-50 text-slate-600 border-slate-200",
};

const DEFAULT_TONE = "bg-amber-50 text-amber-700 border-amber-200";

export function StatusBadge({ status }: { status: string }) {
  const tone = TONES[status] ?? DEFAULT_TONE;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {statusLabel(status)}
    </span>
  );
}
