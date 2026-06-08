import { useCallback, useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
  accept?: string;
  maxMb?: number;
}

const DEFAULT_ACCEPT = ".mp3,.wav,.m4a,.mp4,.mpeg,.mpga,.webm,.aac,.ogg";

export function Dropzone({ onFile, accept = DEFAULT_ACCEPT, maxMb }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files?.[0]);
      }}
      className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition ${
        over ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50"
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-500 shadow-sm">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 16V4M5 11l7-7 7 7M4 20h16" />
        </svg>
      </div>
      <div>
        <div className="text-base font-medium text-slate-900">Træk en lydfil hertil</div>
        <div className="text-sm text-slate-500">eller</div>
      </div>
      <button type="button" className="btn-primary" onClick={() => inputRef.current?.click()}>
        Vælg fil fra computeren
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <p className="text-xs text-slate-500">
        Understøttede filtyper: MP3, WAV, M4A, MP4, MPEG, WebM, AAC, OGG.
        {maxMb ? ` Maks. ${maxMb} MB. ` : " "}Maks. 2 timer.
      </p>
    </div>
  );
}
