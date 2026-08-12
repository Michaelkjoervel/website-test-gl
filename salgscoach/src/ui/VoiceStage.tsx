// =============================================================================
// ui/VoiceStage · Den visuelle side af en talt samtale
// -----------------------------------------------------------------------------
// Under en øvelse skal skærmen svare på præcis fire ting — og ikke andet:
//   1. Hvem taler lige nu?      (farve + navn)
//   2. Hører den mig?           (mikrofonkurven bevæger sig)
//   3. Tænker den?              (pulserende tilstand)
//   4. Hvor langt er jeg?       (tid + tilstand)
// Alt andet er støj midt i en samtale, hvor sælgeren skal koncentrere sig om
// at sælge — ikke om at læse skærmen.
// =============================================================================

import { useEffect, useRef } from "react";
import type { VoiceState } from "../voice/realtime";

export type StageSpeaker = "kunde" | "coach";

const LABEL: Record<VoiceState, string> = {
  inaktiv: "Klar",
  forbinder: "Forbinder…",
  lytter: "Lytter",
  taenker: "Tænker",
  taler: "Taler",
  pause: "På pause",
  afsluttet: "Afsluttet",
  fejl: "Fejl",
};

/* ------------------------------------------------------------------- Orb */

export function VoiceOrb({
  speaker,
  state,
  micLevel,
  remoteLevel,
  size = 168,
  name,
}: {
  speaker: StageSpeaker;
  state: VoiceState;
  micLevel: number;
  remoteLevel: number;
  size?: number;
  name: string;
}) {
  const isClient = speaker === "kunde";
  const speaking = state === "taler";
  const listening = state === "lytter";
  const thinking = state === "taenker";

  // Når modparten taler, følger orben modpartens lyd. Når sælgeren taler,
  // følger den mikrofonen — så man kan SE at man bliver hørt.
  const level = speaking ? remoteLevel : micLevel;
  const scale = 1 + Math.min(0.16, level * 0.22);

  const ring = isClient ? "border-client-400/60" : "border-brand-500/60";
  const fill = isClient
    ? "from-client-50 to-base-panel border-client-300"
    : "from-brand-50 to-base-panel border-brand-300/70";
  const glow = speaking ? (isClient ? "shadow-glowClient" : "shadow-glow") : "";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* Ringene puster kun når nogen faktisk taler — ellers står billedet stille. */}
      {(speaking || listening) && (
        <>
          <span className={`orb-ring animate-pulse-ring ${ring}`} style={{ animationDelay: "0ms" }} />
          <span className={`orb-ring animate-pulse-ring ${ring}`} style={{ animationDelay: "800ms" }} />
        </>
      )}
      <div
        className={`orb border bg-gradient-to-b ${fill} ${glow} transition-transform duration-100`}
        style={{ width: size * 0.72, height: size * 0.72, transform: `scale(${scale})` }}
      >
        {thinking ? (
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 animate-think rounded-full ${isClient ? "bg-client-500" : "bg-brand-500"}`}
                style={{ animationDelay: `${i * 180}ms` }}
              />
            ))}
          </div>
        ) : (
          <Waveform active={speaking || listening} level={level} tone={isClient ? "client" : "brand"} />
        )}
      </div>
      <div className="absolute -bottom-1 translate-y-full text-center">
        <div className={`text-sm font-semibold ${isClient ? "text-client-700" : "text-brand-700"}`}>{name}</div>
        <div className="mt-0.5 text-xs text-ink-mute">{LABEL[state]}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Waveform */

export function Waveform({
  active,
  level,
  tone = "brand",
  bars = 5,
}: {
  active: boolean;
  level: number;
  tone?: "brand" | "client";
  bars?: number;
}) {
  const cls = tone === "client" ? "bg-client-500" : "bg-brand-500";
  return (
    <div className="flex h-8 items-center gap-1" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const centre = 1 - Math.abs(i - (bars - 1) / 2) / bars;
        const h = active ? 6 + level * 26 * (0.55 + centre) : 5;
        return (
          <span
            key={i}
            className={`w-1 rounded-full transition-all duration-100 ${cls} ${active ? "" : "opacity-40"}`}
            style={{ height: `${Math.max(4, h)}px` }}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- Undertekst */

/**
 * Live-undertekst. Bevidst STOR og kort: sælgeren skal kunne følge samtalen
 * med et blik, ikke læse et referat mens han taler.
 */
export function LiveCaption({
  speaker,
  text,
  partial,
  speakerName,
}: {
  speaker: "saelger" | "kunde" | "coach";
  text: string;
  partial?: boolean;
  speakerName: string;
}) {
  if (!text) return null;
  const tone =
    speaker === "saelger"
      ? "text-ink"
      : speaker === "kunde"
        ? "text-client-800"
        : "text-brand-800";
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="eyebrow mb-2">{speakerName}</div>
      <p className={`text-[17px] leading-relaxed md:text-lg ${tone} ${partial ? "opacity-70" : ""}`}>
        {text}
        {partial && <span className="ml-0.5 inline-block h-4 w-[2px] animate-think bg-current align-middle" />}
      </p>
    </div>
  );
}

/* --------------------------------------------------------- Rullende referat */

export function TranscriptRail({
  lines,
  labels,
}: {
  lines: { id: string; role: string; text: string }[];
  labels: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [lines.length]);

  return (
    <div ref={ref} className="scroll-fade h-full space-y-3 overflow-y-auto pr-1">
      {lines.map((l) => (
        <div key={l.id} className="animate-fade-up">
          <div
            className={`text-2xs font-semibold uppercase tracking-[0.12em] ${
              l.role === "saelger"
                ? "text-ink-mute"
                : l.role === "kunde"
                  ? "text-client-600"
                  : l.role === "coach"
                    ? "text-brand-700"
                    : "text-ink-faint"
            }`}
          >
            {labels[l.role] || l.role}
          </div>
          <p
            className={`mt-1 text-sm leading-relaxed ${
              l.role === "system" ? "italic text-ink-faint" : "text-ink-soft"
            }`}
          >
            {l.text}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Tilstandschip */

export function ModeBadge({ coachMode }: { coachMode: "realistisk" | "coach" | "hybrid" }) {
  const map = {
    realistisk: { text: "Realistisk", cls: "chip-client", hint: "Ingen coaching før øvelsen slutter" },
    coach: { text: "Coach", cls: "chip-brand", hint: "Salgsdirektøren må afbryde og udfordre" },
    hybrid: { text: "Hybrid", cls: "chip-brand", hint: "Realistisk — men coachen bryder ind ved vigtige fejl" },
  } as const;
  const m = map[coachMode];
  return (
    <span className={m.cls} title={m.hint}>
      {m.text}
    </span>
  );
}

export function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
