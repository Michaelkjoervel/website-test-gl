// =============================================================================
// components/DocumentDropzone · Klik-eller-træk upload af salgsmateriale
// -----------------------------------------------------------------------------
// Samme interaktionskvalitet som billed-dropzonen i resten af green lights
// værktøjer — men til dokumenter, i det mørke design, og med validering der
// siger præcis hvad der er galt frem for bare at afvise filen.
//
// Tilgængelighed: selve feltet ER en <button>, så Enter/mellemrum virker uden
// at vi selv skal genopfinde tastaturhåndtering. Filfeltet ligger skjult
// bagved og bliver aldrig fokuseret.
//
// Komponenten læser ALDRIG filen. Den validerer og giver den videre — hvad der
// skal ske med indholdet, bestemmer siden der bruger den.
// =============================================================================

import { useCallback, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { Icon } from "../ui/icons";
import { Spinner } from "../ui/primitives";
import { formatBytes, joinDanish } from "../lib/format";

/* ------------------------------------------------------------- Filtyper */

/**
 * Hvilke mime-typer der er troværdige for en given endelse. Browsere er ikke
 * enige med sig selv: Office-filer meldes ofte som zip eller slet ikke, og
 * .csv kommer i mindst fire varianter. Derfor: kendt-og-forkert afvises,
 * ukendt-eller-tom accepteres.
 */
const MIME_BY_EXT: Readonly<Record<string, readonly string[]>> = {
  ".pdf": ["application/pdf", "application/x-pdf", "text/pdf"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".csv": ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"],
  ".txt": ["text/plain"],
  ".md": ["text/plain", "text/markdown", "text/x-markdown"],
};

/** Typer browseren melder, uden at det siger noget om indholdet. */
const NEUTRAL_MIME: readonly string[] = [
  "application/octet-stream",
  "binary/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
];

/** Gamle binære Office-formater: afvises, men med en brugbar vej videre. */
const LEGACY_ADVICE: Readonly<Record<string, string>> = {
  ".ppt": "Gamle .ppt-filer kan ikke læses. Åbn præsentationen, vælg Gem som, og gem den som .pptx eller PDF.",
  ".doc": "Gamle .doc-filer kan ikke læses. Åbn dokumentet, vælg Gem som, og gem det som .docx eller PDF.",
  ".xls": "Gamle .xls-filer kan ikke læses. Åbn regnearket, vælg Gem som, og gem det som .xlsx.",
  ".pages": "Pages-filer kan ikke læses. Eksportér dokumentet til PDF eller .docx.",
  ".key": "Keynote-filer kan ikke læses. Eksportér præsentationen til PDF eller .pptx.",
  ".numbers": "Numbers-filer kan ikke læses. Eksportér regnearket til .xlsx.",
};

/** Filer sælgeren tit kommer til at trække med — værd at afvise venligt. */
const WRONG_KIND_ADVICE: Readonly<Record<string, string>> = {
  ".jpg": "Billeder kan ikke analyseres. Upload selve tilbuddet, præsentationen eller beregningen som fil.",
  ".jpeg": "Billeder kan ikke analyseres. Upload selve tilbuddet, præsentationen eller beregningen som fil.",
  ".png": "Billeder kan ikke analyseres. Upload selve tilbuddet, præsentationen eller beregningen som fil.",
  ".heic": "Billeder kan ikke analyseres. Upload selve tilbuddet, præsentationen eller beregningen som fil.",
  ".zip": "Zip-arkiver kan ikke åbnes her. Pak filen ud, og upload ét materiale ad gangen.",
  ".msg": "Mails kan ikke analyseres. Upload den vedhæftede fil i stedet.",
  ".eml": "Mails kan ikke analyseres. Upload den vedhæftede fil i stedet.",
};

/** ".PDF" / "pdf" / " .pdf " → ".pdf" */
function normalizeExt(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return "";
  return v.startsWith(".") ? v : `.${v}`;
}

/** Endelsen på et filnavn, inkl. punktum. Tom streng når der ingen er. */
export function extensionOf(name: string): string {
  const clean = (name ?? "").trim().toLowerCase();
  const i = clean.lastIndexOf(".");
  return i > 0 ? clean.slice(i) : "";
}

/* ----------------------------------------------------------------- Props */

export interface DocumentDropzoneProps {
  /** Kaldes kun med en fil der har bestået både type- og størrelsestjek. */
  onFile: (file: File) => void;
  /** Tilladte endelser, fx [".pdf", ".pptx"]. Punktum er valgfrit. */
  accept: string[];
  maxBytes: number;
  /** Blokerer klik og drop mens der arbejdes. */
  busy?: boolean;
  hint?: string;
  /** Teksten der vises mens busy er sat. */
  busyText?: string;
  className?: string;
}

/* ------------------------------------------------------------ Komponent */

export function DocumentDropzone({
  onFile,
  accept,
  maxBytes,
  busy = false,
  hint,
  busyText = "Arbejder på materialet",
  className = "",
}: DocumentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Tæller, så dragleave fra et barn ikke slukker træk-tilstanden. */
  const depth = useRef(0);
  const hintId = useId();
  const errorId = useId();

  const exts = useMemo(
    () => accept.map(normalizeExt).filter((e) => e.length > 1),
    [accept],
  );

  const acceptAttr = useMemo(() => {
    const mimes = exts.flatMap((e) => MIME_BY_EXT[e] ?? []);
    return [...exts, ...new Set(mimes)].join(",");
  }, [exts]);

  const formatList = useMemo(
    () => joinDanish(exts.map((e) => e.slice(1).toUpperCase())),
    [exts],
  );

  /** Returnerer en dansk fejltekst, eller null når filen er i orden. */
  const validate = useCallback(
    (file: File): string | null => {
      const ext = extensionOf(file.name);

      if (!ext) {
        return `Filen »${file.name}« har ingen filendelse, så vi kan ikke se hvad det er. Gem den som ${formatList}.`;
      }
      if (!exts.includes(ext)) {
        const advice = LEGACY_ADVICE[ext] ?? WRONG_KIND_ADVICE[ext];
        if (advice) return advice;
        return `Filtypen »${ext}« kan ikke læses. Upload materialet som ${formatList}.`;
      }
      if (file.size === 0) {
        return "Filen er tom. Tjek at den blev gemt færdig, og prøv igen.";
      }
      if (file.size > maxBytes) {
        return `Filen fylder ${formatBytes(file.size)}, og grænsen er ${formatBytes(
          maxBytes,
        )}. Gem PDF'en i en mindre udgave, eller del materialet op og upload den vigtigste del.`;
      }

      const mime = (file.type || "").trim().toLowerCase();
      const expected = MIME_BY_EXT[ext] ?? [];
      const suspicious =
        mime.length > 0 &&
        expected.length > 0 &&
        !expected.includes(mime) &&
        !NEUTRAL_MIME.includes(mime);

      if (suspicious) {
        return `Filen hedder »${ext}«, men indholdet er registreret som »${mime}«. Åbn materialet, gem det igen i det rigtige format, og prøv forfra.`;
      }
      return null;
    },
    [exts, formatList, maxBytes],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (busy) {
        setError("Vent til den igangværende analyse er færdig, før du uploader et nyt materiale.");
        return;
      }
      const list = files ? Array.from(files) : [];
      if (list.length === 0) return;
      if (list.length > 1) {
        setError("Du kan analysere ét materiale ad gangen. Træk kun én fil hertil.");
        return;
      }

      const file = list[0];
      const problem = validate(file);
      if (problem) {
        setError(problem);
        return;
      }
      setError(null);
      onFile(file);
    },
    [busy, onFile, validate],
  );

  const onDragEnter = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    depth.current += 1;
    if (!busy) setDrag(true);
  };

  const onDragLeave = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDrag(false);
  };

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    depth.current = 0;
    setDrag(false);
    handleFiles(e.dataTransfer?.files ?? null);
  };

  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy || undefined}
        aria-describedby={describedBy || undefined}
        data-drag={drag}
        onClick={() => inputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDrag(true);
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed
          px-6 py-9 text-center transition-colors duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2
          focus-visible:ring-offset-base
          ${
            busy
              ? "cursor-progress border-base-line bg-base-panel2/60"
              : drag
                ? "border-brand-500 bg-brand-950 ring-2 ring-brand-900"
                : "cursor-pointer border-base-line2 bg-base-panel2/40 hover:border-brand-700 hover:bg-base-panel2"
          }`}
      >
        {busy ? (
          <>
            <Spinner size={22} />
            <span className="title-md">{busyText}</span>
            <span className="body-mute max-w-sm">Feltet er låst, indtil analysen er færdig.</span>
          </>
        ) : (
          <>
            <span
              className={`grid h-12 w-12 place-items-center rounded-2xl border transition-colors ${
                drag
                  ? "border-brand-500 bg-brand-900 text-brand-200"
                  : "border-base-line2 bg-base-panel text-ink-mute"
              }`}
            >
              <Icon.Upload width={22} height={22} />
            </span>
            <span className="title-md">
              {drag ? "Slip filen her" : "Klik, eller træk materialet hertil"}
            </span>
            <span className="body-mute max-w-md">
              {formatList} · maks. {formatBytes(maxBytes)}
            </span>
          </>
        )}
      </button>

      {hint && (
        <p id={hintId} className="mt-3 max-w-[68ch] text-xs leading-relaxed text-ink-mute">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-xl border border-danger-600/40 bg-danger-900/50 px-4 py-3 text-sm text-danger-300"
        >
          <Icon.Warn className="mt-0.5 shrink-0" width={17} height={17} />
          <span>{error}</span>
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          // Så den samme fil kan vælges igen efter en fejl.
          e.target.value = "";
        }}
      />
    </div>
  );
}
