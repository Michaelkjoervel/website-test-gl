import { useCallback, useRef, useState } from "react";

interface BeforeAfterSliderProps {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

/**
 * Før/efter-slider: kundens rum til venstre, den genererede visualisering til
 * højre. Træk håndtaget (mus eller touch) for at afsløre "efter".
 */
export function BeforeAfterSlider({
  before,
  after,
  beforeLabel = "Før",
  afterLabel = "Efter",
  className = "",
}: BeforeAfterSliderProps) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  return (
    <div
      ref={ref}
      className={`relative select-none overflow-hidden rounded-2xl border border-surface-line bg-ink ${className}`}
      onMouseDown={(e) => {
        dragging.current = true;
        setFromClientX(e.clientX);
      }}
      onMouseMove={(e) => {
        if (dragging.current) setFromClientX(e.clientX);
      }}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onTouchStart={(e) => setFromClientX(e.touches[0].clientX)}
      onTouchMove={(e) => setFromClientX(e.touches[0].clientX)}
    >
      {/* Efter (fuld baggrund – definerer højden) */}
      <img src={after} alt={afterLabel} className="block w-full h-auto pointer-events-none" draggable={false} />
      <span className="absolute top-3 right-3 chip bg-brand-500 text-white shadow-sm">{afterLabel}</span>

      {/* Før (samme størrelse, klippet til venstre for håndtaget) */}
      <img
        src={before}
        alt={beforeLabel}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      <span className="absolute top-3 left-3 chip bg-white/90 text-ink shadow-sm">{beforeLabel}</span>

      {/* Håndtag */}
      <div className="absolute inset-y-0 pointer-events-none" style={{ left: `calc(${pos}% - 1px)` }}>
        <div className="w-0.5 h-full bg-white/90 shadow-[0_0_0_1px_rgba(15,26,10,0.15)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-brand-600">
            <path d="M9 7l-4 5 4 5M15 7l4 5-4 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
