import type { EstimateConfidence } from "../lib/types";

export function ConfidenceBadge({ confidence }: { confidence: EstimateConfidence }) {
  const map: Record<string, string> = {
    Lav: "bg-amber-100 text-amber-800",
    Middel: "bg-brand-100 text-brand-700",
    Høj: "bg-brand-500 text-white",
  };
  return (
    <span className={`chip ${map[confidence.level]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {confidence.level} sikkerhed · {confidence.score}%
    </span>
  );
}

export function ConfidenceMeter({ confidence }: { confidence: EstimateConfidence }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="label">Estimatets sikkerhed</span>
        <ConfidenceBadge confidence={confidence} />
      </div>
      <div className="h-2 rounded-full bg-surface-line overflow-hidden">
        <div
          className="h-full bg-brand-500 transition-all"
          style={{ width: `${confidence.score}%` }}
        />
      </div>
      {confidence.missingFields.length > 0 && (
        <div className="text-[11px] text-ink-mute mt-2">
          Manglende: {confidence.missingFields.join(", ")}
        </div>
      )}
    </div>
  );
}
