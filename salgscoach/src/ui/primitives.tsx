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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h2 className="title-lg">{title}</h2>
        {desc && <p className="body mt-2 max-w-[62ch]">{desc}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/**
 * Sidehovedet. Alle sider begynder ens: kategori, navn, én linje der siger
 * hvad siden er til for. Ikke to linjer markedsføring.
 */
export function PageHeader({
  eyebrow,
  title,
  desc,
  right,
  meta,
  back,
}: {
  eyebrow?: string;
  title: string;
  desc?: ReactNode;
  /** Handlinger. Flugter med overskriften, ikke med brødteksten. */
  right?: ReactNode;
  /** Statuslinje under hovedet: tal, tidspunkter, forbehold. */
  meta?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="page-head">
      {back && <div className="mb-5">{back}</div>}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 className="title-xl mt-2">{title}</h1>
          {desc && <p className="body mt-2.5 max-w-[62ch]">{desc}</p>}
        </div>
        {right && <div className="shrink-0 md:pt-1">{right}</div>}
      </div>
      {meta && (
        <div className="mt-5 border-t border-base-line pt-3 text-sm text-ink-mute">{meta}</div>
      )}
    </header>
  );
}

/* ----------------------------------------------------------- Vurderinger */

const RATING_STYLE: Record<Rating, { cls: string; dot: string }> = {
  FREMRAGENDE: { cls: "border-brand-400 bg-brand-50 text-brand-800", dot: "bg-brand-400" },
  STÆRK: { cls: "border-brand-200 bg-brand-50/90 text-brand-700", dot: "bg-brand-500" },
  ACCEPTABEL: { cls: "border-base-line2 bg-base-panel2 text-ink-soft", dot: "bg-ink-mute" },
  "SKAL FORBEDRES": { cls: "border-warn-300 bg-warn-50 text-warn-700", dot: "bg-warn-500" },
  SVAG: { cls: "border-danger-300 bg-danger-50 text-danger-700", dot: "bg-danger-500" },
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

/**
 * Farve betyder noget i dette system: grøn er green light og salgsdirektøren,
 * blå er rollespilskunden. Derfor får sælgere IKKE en tilfældig kulør efter
 * deres initialer — det ville gøre farven til pynt. Kun kunderollen (tone
 * "client") og coachen (tone "brand") må hente en farve, og kun når rollen
 * faktisk er den.
 */
const AVATAR_TONES = {
  neutral: "bg-base-panel2 text-ink-soft border-base-line2",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  client: "bg-client-50 text-client-700 border-client-300",
} as const;

export type AvatarTone = keyof typeof AVATAR_TONES;

export function Avatar({
  initials,
  size = 36,
  tone = "neutral",
}: {
  initials: string;
  size?: number;
  tone?: AvatarTone;
}) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-xl border font-bold tracking-tight ${AVATAR_TONES[tone]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
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

/** Én grå bjælke. Bygger de skeletter siderne venter i. */
export function Skel({ w = "100%", h = 12, className = "" }: { w?: string | number; h?: number; className?: string }) {
  return <div className={`skel ${className}`} style={{ width: w, height: h }} aria-hidden="true" />;
}

/**
 * Ventetid med form. Bruges hvor der hentes en liste: samme kant, samme
 * radius og samme rytme som det indhold der lander bagefter, så siden ikke
 * hopper — og så det aldrig ligner at noget er gået i stå.
 */
export function LoadingBlock({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="panel-quiet p-4 md:p-5" aria-hidden="true">
          <div className="flex items-center gap-3">
            <Skel w={38} h={38} className="rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skel w={`${58 - i * 8}%`} h={11} />
              <Skel w={`${34 - i * 4}%`} h={9} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Den tomme tilstand er en tilstand — ikke et hul.
 * Venstrestillet, fast flade, tydelig kant: ingen stiplede rammer (de læses
 * som "her mangler noget der ikke er bygget endnu") og ingen centreret
 * midterklump med ujævn højrekant.
 */
export function EmptyState({
  title,
  desc,
  action,
  aside,
  icon,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
  /** Ekstra indhold under teksten — fx en liste med eksempler. */
  aside?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="panel-quiet border-l-2 border-l-base-line2 p-5 md:p-6">
      <div className="flex gap-4">
        {icon && (
          <span className="mt-0.5 hidden h-10 w-10 shrink-0 place-items-center rounded-xl border border-base-line bg-base-panel text-ink-mute sm:grid">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="title-md">{title}</h3>
          {desc && <p className="body-mute mt-2 max-w-[62ch]">{desc}</p>}
          {aside && <div className="mt-4">{aside}</div>}
          {action && <div className="mt-5 flex flex-wrap gap-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Fejl skal se ud som en beslutning, ikke som et uheld. Overskrift der siger
 * hvad der ikke lykkedes, den tekniske årsag nedtonet under, og handlingen
 * på egen linje så den ikke klemmes ud i højre kant på en telefon.
 */
export function ErrorNote({
  children,
  onRetry,
  title,
  retryLabel = "Prøv igen",
}: {
  children: ReactNode;
  onRetry?: () => void;
  title?: string;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-danger-300/70 bg-danger-50/70 p-4 md:p-5"
    >
      <div className="flex gap-3.5">
        <Icon.Warn className="mt-0.5 shrink-0 text-danger-700" width={18} height={18} />
        <div className="min-w-0 flex-1">
          {title && <h3 className="title-md text-danger-700">{title}</h3>}
          <div className={`max-w-[62ch] text-sm leading-relaxed text-danger-700/90 ${title ? "mt-1.5" : ""}`}>
            {children}
          </div>
          {onRetry && (
            <button
              className="btn-outline btn-sm mt-4 border-danger-300 bg-transparent text-danger-700 hover:border-danger-400 hover:text-danger-700"
              onClick={onRetry}
            >
              <Icon.Repeat width={14} height={14} />
              {retryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hele siden kunne ikke vises: ukendt id, manglende adgang, tomt svar.
 * Den skal stadig ligne en side — med hoved, ét klart udsagn og en vej videre
 * — frem for en løs boks midt i et sort felt.
 */
export function PageState({
  eyebrow,
  title,
  desc,
  detail,
  actions,
  tone = "neutral",
}: {
  eyebrow?: string;
  title: string;
  desc?: ReactNode;
  /** Teknisk årsag. Vises nedtonet, adskilt fra forklaringen. */
  detail?: string;
  actions?: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <section className="max-w-[62ch]">
      <div className="eyebrow">{eyebrow ?? "Salgscoach"}</div>
      <h1 className="title-xl mt-2">{title}</h1>
      {desc && <p className="body mt-3">{desc}</p>}
      {detail && (
        <p
          className={`mt-4 rounded-xl border px-4 py-3 text-xs leading-relaxed ${
            tone === "danger"
              ? "border-danger-300/70 bg-danger-50/60 text-danger-700/90"
              : "border-base-line bg-base-panel text-ink-mute"
          }`}
        >
          {detail}
        </p>
      )}
      {actions && <div className="mt-6 flex flex-wrap gap-2.5">{actions}</div>}
    </section>
  );
}

/**
 * Lange ventetider (10-40 sekunder) må ikke være en spinner. Her står der
 * hvad salgsdirektøren rent faktisk gør, i den rækkefølge det sker, med et
 * ur der bevæger sig — så ventetiden kan aflæses frem for gættes.
 */
export function StepWait({
  eyebrow,
  title,
  desc,
  steps,
  seconds,
  note,
}: {
  eyebrow?: string;
  title: string;
  desc?: ReactNode;
  steps: readonly { at: number; text: string }[];
  seconds: number;
  note?: string;
}) {
  let activeIndex = 0;
  for (let i = 0; i < steps.length; i++) if (seconds >= steps[i].at) activeIndex = i;

  return (
    <section className="panel p-5 md:p-6" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2 className="title-lg mt-2">{title}</h2>
        </div>
        <span className="text-sm tabular-nums text-ink-mute">{seconds} sek.</span>
      </div>

      {desc && <p className="body mt-2.5 max-w-[62ch]">{desc}</p>}

      <ol className="mt-6 space-y-3.5">
        {steps.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li key={step.text} className="flex items-start gap-3">
              <span
                className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                  done
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : active
                      ? "border-brand-400 bg-brand-50"
                      : "border-base-line bg-base-panel text-ink-faint"
                }`}
              >
                {done ? (
                  <Icon.Check width={12} height={12} />
                ) : active ? (
                  <Spinner size={11} />
                ) : (
                  <span className="h-1 w-1 rounded-full bg-current" />
                )}
              </span>
              <span
                className={`text-sm leading-snug ${
                  active ? "font-semibold text-ink" : done ? "text-ink-soft" : "text-ink-faint"
                }`}
              >
                {step.text}
                {done && <span className="sr-only"> — færdig</span>}
                {active && <span className="sr-only"> — i gang</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {note && <p className="mt-6 border-t border-base-line pt-4 text-xs text-ink-mute">{note}</p>}
    </section>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const cls =
    tone === "warn"
      ? "border-warn-300/80 bg-warn-50 text-warn-700"
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
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
                ? "border-danger-300 bg-danger-50 text-danger-700"
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
    tone === "client" ? "bg-client-500" : tone === "warn" ? "bg-warn-500" : "bg-brand-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-line">
      <div className={`h-full rounded-full ${cls} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}
