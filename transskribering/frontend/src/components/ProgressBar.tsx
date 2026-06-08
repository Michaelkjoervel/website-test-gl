interface Props {
  percent: number;
  label?: string;
}

export function ProgressBar({ percent, label }: Props) {
  const clamped = Math.min(100, Math.max(0, percent || 0));
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm text-slate-700">
        <span>{label ?? "Fremdrift"}</span>
        <span className="tabular-nums text-slate-500">{clamped}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
