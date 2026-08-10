// =============================================================================
// ui/primitives · De byggeklodser hele appen består af
// -----------------------------------------------------------------------------
// Få, faste komponenter frem for mange næsten-ens. Alt hviler på klasserne i
// index.css, så designet kan justeres ét sted.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./icons";
import type { Rating } from "../lib/types";

/* ------------------------------------------------------------------ Flader */

export function Panel({
  children,
  className = "",
  as: As = "div",
  id,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
  id?: string;
  "aria-labelledby"?: string;
  role?: string;
}) {
  return (
    <As id={id} className={`panel p-5 md:p-6 ${className}`} {...rest}>
      {children}
    </As>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  desc,
  right,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h2 className="title-lg">{title}</h2>
        {desc && <p className="body mt-1.5 max-w-2xl">{desc}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/* ----------------------------------------------------------- Vurderinger */

const RATING_STYLE: Record<Rating, { cls: string; dot: string }> = {
  FREMRAGENDE: { cls: "border-brand-600 bg-brand-950 text-brand-200", dot: "bg-brand-400" },
  STÆRK: { cls: "border-brand-800 bg-brand-950/70 text-brand-300", dot: "bg-brand-500" },
  ACCEPTABEL: { cls: "border-base-line2 bg-base-panel2 text-ink-soft", dot: "bg-ink-mute" },
  "SKAL FORBEDRES": { cls: "border-warn-600/50 bg-warn-900 text-warn-300", dot: "bg-warn-500" },
  SVAG: { cls: "border-danger-600/50 bg-danger-900 text-danger-300", dot: "bg-danger-500" },
};

export function RatingPill({ rating, size = "md" }: { rating: Rating; size?: "sm" | "md" }) {
  const s = RATING_STYLE[rating] ?? RATING_STYLE.ACCEPTABEL;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-semibold tracking-wide ${s.cls} ${
        size === "sm" ? "px-2.5 py-1 text-2xs" : "px-3 py-1.5 text-xs"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {rating}
    </span>
  );
}

/* ---------------------------------------------------------------- Avatar */

const AVATAR_TONES = [
  "bg-brand-900 text-brand-200 border-brand-700",
  "bg-client-900 text-client-300 border-client-600/50",
  "bg-warn-900 text-warn-300 border-warn-600/50",
  "bg-base-panel2 text-ink-soft border-base-line2",
];

export function Avatar({
  initials,
  size = 36,
  tone,
}: {
  initials: string;
  size?: number;
  tone?: number;
}) {
  const idx =
    typeof tone === "number"
      ? tone % AVATAR_TONES.length
      : [...initials].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length;
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-xl border font-bold ${AVATAR_TONES[idx]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials.slice(0, 3).toUpperCase()}
    </span>
  );
}

/* --------------------------------------------------------------- Tilstand */

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-base-line2 border-t-brand-500"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Arbejder"
    />
  );
}

export function EmptyState({
  title,
  desc,
  action,
  icon,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-base-line px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <div className="title-md">{title}</div>
      {desc && <p className="body-mute mt-1.5 max-w-md">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-danger-600/40 bg-danger-900/50 px-4 py-3 text-sm text-danger-300">
      <Icon.Warn className="mt-0.5 shrink-0" width={17} height={17} />
      <div className="flex-1">{children}</div>
      {onRetry && (
        <button className="btn btn-sm bg-danger-900 text-danger-300 hover:bg-danger-900/70" onClick={onRetry}>
          Prøv igen
        </button>
      )}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const cls =
    tone === "warn"
      ? "border-warn-600/40 bg-warn-900/60 text-warn-300"
      : "border-base-line2 bg-base-panel2 text-ink-soft";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

/* ----------------------------------------------------------------- Felter */

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label className="block space-y-1.5" htmlFor={htmlFor}>
      <span className="label block">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

/** Valgfri konfiguration som chips — hurtigere end dropdowns, og mindre formular. */
export function ChipGroup({
  options,
  value,
  onChange,
  allowClear = true,
}: {
  options: string[];
  value?: string;
  onChange: (v: string | undefined) => void;
  allowClear?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o;
        return (
          <button
            key={o}
            type="button"
            data-on={on}
            className="chip-select"
            onClick={() => onChange(on && allowClear ? undefined : o)}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`panel relative max-h-[86vh] w-full overflow-y-auto p-6 animate-fade-up ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="title-md">{title}</h3>
          <button className="btn-ghost btn-sm -mr-2" onClick={onClose} aria-label="Luk">
            <Icon.X width={16} height={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Toast */

type Toast = { id: number; text: string; tone: "ok" | "fejl" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "fejl") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((text: string, tone: "ok" | "fejl" = "ok") => {
    const id = ++seq.current;
    setItems((x) => [...x, { id, text, tone }]);
    window.setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-fade-up rounded-xl border px-4 py-2.5 text-sm shadow-lift ${
              t.tone === "fejl"
                ? "border-danger-600/50 bg-danger-900 text-danger-300"
                : "border-base-line2 bg-base-panel text-ink"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------- Coach-tekstvisning */

/**
 * Coachens tekst er skrevet til at blive læst, ikke parset. Vi understøtter
 * derfor kun det minimale: **fed** og linjer der starter med "- ".
 * Ingen markdown-afhængighed, ingen HTML fra modellen.
 */
export function CoachText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = useMemo(() => splitBlocks(text || ""), [text]);
  return (
    <div className={`prose-coach space-y-3 ${className}`}>
      {blocks.map((b, i) =>
        b.type === "list" ? (
          <ul key={i} className="space-y-1.5">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2.5">
                <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-brand-600" />
                <span>{bold(it)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{bold(b.text)}</p>
        ),
      )}
    </div>
  );
}

type Block = { type: "p"; text: string } | { type: "list"; items: string[] };

function splitBlocks(src: string): Block[] {
  const out: Block[] = [];
  let list: string[] = [];
  for (const raw of src.split(/\n/)) {
    const line = raw.trim();
    if (/^[-•*]\s+/.test(line)) {
      list.push(line.replace(/^[-•*]\s+/, ""));
      continue;
    }
    if (list.length) {
      out.push({ type: "list", items: list });
      list = [];
    }
    if (line) out.push({ type: "p", text: line });
  }
  if (list.length) out.push({ type: "list", items: list });
  return out;
}

function bold(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/* --------------------------------------------------------------- Diverse */

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="panel-quiet p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-mute">{sub}</div>}
    </div>
  );
}

export function Bar({ value, max = 1, tone = "brand" }: { value: number; max?: number; tone?: "brand" | "client" | "warn" }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const cls =
    tone === "client" ? "bg-client-400" : tone === "warn" ? "bg-warn-500" : "bg-brand-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-line">
      <div className={`h-full rounded-full ${cls} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}
