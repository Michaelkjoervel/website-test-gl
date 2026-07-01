import { useRef, useState } from "react";
import type { PlacementPoint } from "../lib/visualizationTypes";
import { newVizId } from "../lib/visualizationStorage";

interface PlacementEditorProps {
  photo: string;
  placements: PlacementPoint[];
  onChange: (placements: PlacementPoint[]) => void;
  disabled?: boolean;
}

/**
 * Interaktiv placering af armaturer på rumbilledet. Klik for at sætte et punkt,
 * træk for at flytte, klik "×" for at fjerne. Koordinater gemmes i % (0..100),
 * så de er uafhængige af billedstørrelse.
 */
export function PlacementEditor({
  photo,
  placements,
  onChange,
  disabled,
}: PlacementEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const pctFromEvent = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return { x: 50, y: 50 };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const addPoint = (clientX: number, clientY: number) => {
    if (disabled) return;
    const { x, y } = pctFromEvent(clientX, clientY);
    onChange([...placements, { id: newVizId("pt"), xPct: x, yPct: y }]);
  };

  const movePoint = (id: string, clientX: number, clientY: number) => {
    const { x, y } = pctFromEvent(clientX, clientY);
    onChange(placements.map((p) => (p.id === id ? { ...p, xPct: x, yPct: y } : p)));
  };

  const removePoint = (id: string) => onChange(placements.filter((p) => p.id !== id));

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-2xl border border-surface-line bg-ink select-none"
      style={{ cursor: disabled ? "default" : "crosshair" }}
      onMouseDown={(e) => {
        // Tilføj punkt kun ved klik på baggrund/billede – ikke på et pin
        // (pins stopper propagation). Dette undgår også, at et pin-drag der
        // slippes over baggrunden fejlagtigt opretter et nyt punkt.
        const el = e.target as HTMLElement;
        if (el === e.currentTarget || el.tagName === "IMG") addPoint(e.clientX, e.clientY);
      }}
      onMouseMove={(e) => {
        if (dragId) movePoint(dragId, e.clientX, e.clientY);
      }}
      onMouseUp={() => setDragId(null)}
      onMouseLeave={() => setDragId(null)}
    >
      <img src={photo} alt="Rum" className="block w-full h-auto pointer-events-none" draggable={false} />

      {placements.map((p, i) => (
        <div
          key={p.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 group"
          style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (!disabled) setDragId(p.id);
          }}
        >
          <div className="relative w-7 h-7 rounded-full bg-brand-500 border-2 border-white shadow-glow flex items-center justify-center text-white text-[11px] font-bold cursor-grab active:cursor-grabbing">
            {i + 1}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePoint(p.id);
                }}
                className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-white text-ink text-[10px] leading-none shadow-sm opacity-0 group-hover:opacity-100 flex items-center justify-center"
                aria-label="Fjern punkt"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}

      {placements.length === 0 && !disabled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="chip bg-white/85 text-ink-soft">Klik på loftet for at placere armaturer</span>
        </div>
      )}
    </div>
  );
}
