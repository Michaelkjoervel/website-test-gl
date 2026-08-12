// =============================================================================
// format · dansk formatering + designsystemets farvesprog
// -----------------------------------------------------------------------------
// Ét sted for alt der skal se ens ud: datoer, varigheder, tal — og især
// oversættelsen fra vurdering (Rating) og kompetenceområde (SkillArea) til
// noget en sælger kan læse på et splitsekund.
//
// VIGTIGT om farverne: klassenavnene står som HELE strenge, fordi Tailwind
// scanner kildekoden efter literaler. Byg dem aldrig sammen dynamisk
// ("text-" + farve) — så forsvinder de ud af den byggede CSS.
// =============================================================================

import type { PatternTrend, Rating, SkillArea, UserRole } from "./types";

const LOCALE = "da-DK";

/* ------------------------------------------------------------------ Datoer */

/** Tolerant konvertering: ISO-streng, ms-tal, Date — eller null hvis ubrugelig. */
function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
const dateLongFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric" });
const dateNoYearFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "long" });

/** "10. aug. 2026" */
export function formatDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : "—";
}

/** "10. august 2026" */
export function formatDateLong(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateLongFmt.format(d) : "—";
}

/** "10. aug." — årstal udelades når det er i år. */
export function formatDateCompact(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.getFullYear() === new Date().getFullYear() ? dateNoYearFmt.format(d) : dateFmt.format(d);
}

/** "14.05" */
export function formatTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? timeFmt.format(d) : "—";
}

/** "10. aug. 2026 kl. 14.05" */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `${dateFmt.format(d)} kl. ${timeFmt.format(d)}` : "—";
}

/** "mandag" */
export function formatWeekday(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? weekdayFmt.format(d) : "—";
}

/** true når datoen er i dag (lokal tid). */
export function isToday(value: string | number | Date | null | undefined): boolean {
  const d = toDate(value);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * "for 3 dage siden", "for et minut siden", "om 2 timer", "lige nu".
 * Bevidst skrevet i hånden frem for Intl.RelativeTimeFormat, så teksten
 * lyder som noget et menneske ville sige — også ved 1 og 0.
 */
export function relativeTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";

  const diffMs = Date.now() - d.getTime();
  const future = diffMs < 0;
  const s = Math.abs(diffMs) / 1000;

  const wrap = (body: string) => (future ? `om ${body}` : `for ${body} siden`);

  if (s < 45) return future ? "om et øjeblik" : "lige nu";
  if (s < 90) return wrap("et minut");

  const min = Math.round(s / 60);
  if (min < 60) return wrap(`${min} minutter`);

  const hours = Math.round(min / 60);
  if (hours === 1) return wrap("en time");
  if (hours < 24) return wrap(`${hours} timer`);

  const days = Math.round(hours / 24);
  if (days === 1) return future ? "i morgen" : "i går";
  if (days < 7) return wrap(`${days} dage`);

  const weeks = Math.round(days / 7);
  if (weeks === 1) return wrap("en uge");
  if (weeks < 5) return wrap(`${weeks} uger`);

  const months = Math.round(days / 30.44);
  if (months === 1) return wrap("en måned");
  if (months < 12) return wrap(`${months} måneder`);

  const years = Math.round(days / 365.25);
  if (years === 1) return wrap("et år");
  return wrap(`${years} år`);
}

/** "I dag kl. 14.05" · "I går kl. 09.12" · "10. aug. kl. 14.05" */
export function formatWhen(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  if (isToday(d)) return `I dag kl. ${timeFmt.format(d)}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return `I går kl. ${timeFmt.format(d)}`;
  }
  return `${formatDateCompact(d)} kl. ${timeFmt.format(d)}`;
}

/* -------------------------------------------------------------- Varigheder */

/** Sekunder → "0.42" / "12.05" / "1.04.30" (samtaleur). */
export function formatClock(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}.${two(m)}.${two(s)}` : `${m}.${two(s)}`;
}

/** Sekunder → "42 sek." / "12 min." / "1 t. 4 min." (læsbar varighed). */
export function formatDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  if (total < 60) return `${total} sek.`;
  const min = Math.round(total / 60);
  if (min < 60) return `${min} min.`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} t. ${rest} min.` : `${h} t.`;
}

/** Minutter → "45 min." / "1 t. 30 min." */
export function formatMinutes(minutes: number | null | undefined): string {
  return formatDuration(Math.max(0, Math.round(minutes ?? 0)) * 60);
}

/** [20, 30] → "20-30 min." */
export function formatMinuteRange(range: [number, number] | null | undefined): string {
  if (!range) return "—";
  const [a, b] = range;
  return a === b ? `${a} min.` : `${a}-${b} min.`;
}

/* ---------------------------------------------------------------- Tal m.m. */

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** 0.62 → "62 %" (bemærk hårdt mellemrum som dansk typografi foreskriver). */
export function formatPercent(fraction: number | null | undefined, decimals = 0): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return "—";
  return `${formatNumber(fraction * 100, decimals)} %`;
}

export function formatBytes(bytes: number | null | undefined): string {
  const b = bytes ?? 0;
  if (b <= 0) return "0 KB";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${formatNumber(b / 1024, 0)} KB`;
  return `${formatNumber(b / (1024 * 1024), 1)} MB`;
}

/** ["a","b","c"] → "a, b og c" */
export function joinDanish(items: readonly string[]): string {
  const list = items.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")} og ${list[list.length - 1]}`;
}

/** Klipper pænt af på ordgrænse, med ellipse. */
export function truncate(text: string | null | undefined, max = 160): string {
  const t = (text ?? "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** "3 sessioner" / "1 session" — dansk flertal uden at gætte. */
export function plural(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

/* ------------------------------------------------------- Vurderinger (Rating) */

/** Bedste først — brug denne rækkefølge overalt hvor ratings sorteres/vises. */
export const RATING_ORDER: readonly Rating[] = [
  "FREMRAGENDE",
  "STÆRK",
  "ACCEPTABEL",
  "SKAL FORBEDRES",
  "SVAG",
];

/** 5 = bedst. Bruges til gennemsnit, trends og søjlehøjder. */
export const RATING_SCORE: Record<Rating, number> = {
  FREMRAGENDE: 5,
  STÆRK: 4,
  ACCEPTABEL: 3,
  "SKAL FORBEDRES": 2,
  SVAG: 1,
};

/** Pæn visning i sætninger ("Stærk") frem for RÅB. */
export const RATING_LABEL: Record<Rating, string> = {
  FREMRAGENDE: "Fremragende",
  STÆRK: "Stærk",
  ACCEPTABEL: "Acceptabel",
  "SKAL FORBEDRES": "Skal forbedres",
  SVAG: "Svag",
};

export interface RatingStyle {
  /** Tekstfarve alene (fx til en overskrift). */
  text: string;
  /** Baggrund til flader/pilleform. */
  bg: string;
  /** Kantfarve. */
  border: string;
  /** Færdig chip-klasse fra designsystemet. */
  chip: string;
  /** Lille prik/indikator. */
  dot: string;
  /** Udfyldning i søjler/målere. */
  bar: string;
}

/**
 * Farvesproget: grøn = green light-niveau, blå = acceptabelt (neutralt,
 * "en anden i rummet"), gul = opmærksomhed, rød = hård advarsel.
 */
export const RATING_STYLES: Record<Rating, RatingStyle> = {
  FREMRAGENDE: {
    text: "text-brand-200",
    bg: "bg-brand-900",
    border: "border-brand-600",
    chip: "chip-brand",
    dot: "bg-brand-300",
    bar: "bg-brand-400",
  },
  STÆRK: {
    text: "text-brand-300",
    bg: "bg-brand-950",
    border: "border-brand-800",
    chip: "chip-brand",
    dot: "bg-brand-400",
    bar: "bg-brand-500",
  },
  ACCEPTABEL: {
    text: "text-client-300",
    bg: "bg-client-900",
    border: "border-client-600/40",
    chip: "chip-client",
    dot: "bg-client-400",
    bar: "bg-client-500",
  },
  "SKAL FORBEDRES": {
    text: "text-warn-300",
    bg: "bg-warn-900",
    border: "border-warn-600/40",
    chip: "chip-warn",
    dot: "bg-warn-500",
    bar: "bg-warn-500",
  },
  SVAG: {
    text: "text-danger-300",
    bg: "bg-danger-900",
    border: "border-danger-600/40",
    chip: "chip-danger",
    dot: "bg-danger-500",
    bar: "bg-danger-500",
  },
};

/** Neutral stil når vurderingen mangler (endnu ikke analyseret). */
const RATING_STYLE_UNKNOWN: RatingStyle = {
  text: "text-ink-mute",
  bg: "bg-base-panel2",
  border: "border-base-line",
  chip: "chip",
  dot: "bg-ink-faint",
  bar: "bg-base-line2",
};

export function ratingStyle(rating: Rating | null | undefined): RatingStyle {
  return rating ? RATING_STYLES[rating] : RATING_STYLE_UNKNOWN;
}

/** Genvej: klassen til en chip med vurderingen i. */
export function ratingChipClass(rating: Rating | null | undefined): string {
  return ratingStyle(rating).chip;
}

/** Genvej: kun tekstfarven. */
export function ratingTextClass(rating: Rating | null | undefined): string {
  return ratingStyle(rating).text;
}

/** Genvej: udfyldning til søjler/målere. */
export function ratingBarClass(rating: Rating | null | undefined): string {
  return ratingStyle(rating).bar;
}

export function ratingLabel(rating: Rating | null | undefined): string {
  return rating ? RATING_LABEL[rating] : "Ikke vurderet";
}

/** 1-5 (0 når der ikke er nogen vurdering). */
export function ratingScore(rating: Rating | null | undefined): number {
  return rating ? RATING_SCORE[rating] : 0;
}

/** Rund et gennemsnit tilbage til nærmeste vurdering. */
export function ratingFromScore(score: number): Rating {
  const s = Math.max(1, Math.min(5, Math.round(score)));
  const found = RATING_ORDER.find((r) => RATING_SCORE[r] === s);
  return found ?? "ACCEPTABEL";
}

/** Gennemsnit af flere vurderinger — null når listen er tom. */
export function averageRating(ratings: readonly (Rating | null | undefined)[]): Rating | null {
  const scores = ratings.filter((r): r is Rating => Boolean(r)).map((r) => RATING_SCORE[r]);
  if (!scores.length) return null;
  return ratingFromScore(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/* --------------------------------------------------- Kompetenceområder m.m. */

/** Alle SkillArea-værdier fra types.ts — holdt komplet med Record-typen. */
export const SKILL_AREA_LABELS: Record<SkillArea, string> = {
  afdaekning: "Afdækning",
  spoergeteknik: "Spørgeteknik",
  lytning: "Lytning",
  "kommerciel-nysgerrighed": "Kommerciel nysgerrighed",
  kvalificering: "Kvalificering",
  konsekvens: "Konsekvens",
  vaerdiskabelse: "Værdiskabelse",
  kundefokus: "Kundefokus",
  beslutningsproces: "Beslutningsproces",
  indvendinger: "Indvendinger",
  forhandling: "Forhandling",
  selvsikkerhed: "Selvsikkerhed",
  klarhed: "Klarhed",
  afslutning: "Afslutning",
  "naeste-skridt": "Næste skridt",
  taletid: "Taletid",
  udfordring: "Udfordring",
  forberedelse: "Forberedelse",
  "opportunity-styring": "Opportunity-styring",
};

/** Tåler også ukendte strenge fra serveren (viser dem pænt frem for at knække). */
export function skillAreaLabel(area: SkillArea | string | null | undefined): string {
  if (!area) return "—";
  const known = SKILL_AREA_LABELS[area as SkillArea];
  if (known) return known;
  const pretty = String(area).replace(/-/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export const TREND_LABELS: Record<PatternTrend, string> = {
  forbedres: "Forbedres",
  uaendret: "Uændret",
  forvaerres: "Forværres",
  ny: "Ny",
};

/** Pil + farve til et udviklingsmønsters trend. */
export function trendStyle(trend: PatternTrend): { label: string; arrow: string; text: string } {
  switch (trend) {
    case "forbedres":
      return { label: TREND_LABELS.forbedres, arrow: "↑", text: "text-brand-300" };
    case "forvaerres":
      return { label: TREND_LABELS.forvaerres, arrow: "↓", text: "text-danger-300" };
    case "ny":
      return { label: TREND_LABELS.ny, arrow: "•", text: "text-client-300" };
    case "uaendret":
    default:
      return { label: TREND_LABELS.uaendret, arrow: "→", text: "text-ink-mute" };
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  saelger: "Sælger",
  leder: "Salgsleder",
};

export function roleLabel(role: UserRole | null | undefined): string {
  return role ? ROLE_LABELS[role] : "Sælger";
}
