import { useCallback, useRef, useState } from "react";
import { fileToScaledDataUrl } from "../lib/image";

interface ImageDropzoneProps {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  label: string;
  hint?: string;
  maxDim?: number;
  quality?: number; // JPEG-kvalitet (0..1) for nedskaleringen
  className?: string;
}

/**
 * Klik-eller-træk billed-upload. Nedskalerer automatisk til en gemme-venlig
 * dataURL, så localStorage ikke sprænges af rå telefonbilleder.
 */
export function ImageDropzone({
  value,
  onChange,
  label,
  hint,
  maxDim = 1400,
  quality = 0.82,
  className = "",
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || !file.type.startsWith("image/")) return;
      setBusy(true);
      try {
        const url = await fileToScaledDataUrl(file, maxDim, quality);
        onChange(url);
      } finally {
        setBusy(false);
      }
    },
    [maxDim, quality, onChange],
  );

  return (
    <div className={className}>
      <div className="label mb-1.5">{label}</div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer overflow-hidden transition-colors min-h-[180px]
          ${drag ? "border-brand-400 bg-brand-50" : "border-surface-line bg-surface-soft hover:border-brand-300"}`}
      >
        {value ? (
          <>
            <img src={value} alt={label} className="w-full h-full max-h-[340px] object-contain" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="absolute top-2 right-2 bg-white/90 text-ink text-xs font-semibold rounded-lg px-2.5 py-1 shadow-sm hover:bg-white"
            >
              Fjern
            </button>
          </>
        ) : (
          <div className="text-center px-6 py-8 text-ink-mute">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="mx-auto mb-2 text-brand-500">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <div className="text-sm font-medium text-ink-soft">
              {busy ? "Behandler billede…" : "Klik eller træk et billede hertil"}
            </div>
            {hint && <div className="text-[11px] mt-1">{hint}</div>}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
