// =============================================================================
// pages/History · Sælgerens egen træningshistorik
// -----------------------------------------------------------------------------
// Et arkiv, ikke et scoreboard. Sælgeren kommer her af én af to grunde:
//   "jeg vil finde den øvelse, hvor kunden var umulig"  → skan og klik
//   "jeg vil prøve den igen"                            → én knap pr. række
//
// Derfor: nyeste først, én linje pr. øvelse med det coachen konkluderede, og
// filtre der fylder én række. Ingen grafer, ingen point, ingen streaks.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { listSessions, saveSession } from "../lib/store";
import {
  RATING_ORDER,
  formatDuration,
  formatWhen,
  plural,
  skillAreaLabel,
  truncate,
} from "../lib/format";
import type { Rating, SkillArea, TrainingModeId, TrainingSession } from "../lib/types";

import { Icon } from "../ui/icons";
import {
  EmptyState,
  ErrorNote,
  LoadingBlock,
  PageHeader,
  RatingPill,
  Spinner,
  useToast,
} from "../ui/primitives";
import { MODE_LABELS, buildRetrySession, modeLabel } from "./Debrief";

type ModeFilter = TrainingModeId | "alle";
type RatingFilter = Rating | "alle";

export function History() {
  const { seller } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<ModeFilter>("alle");
  const [rating, setRating] = useState<RatingFilter>("alle");
  const [query, setQuery] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  /* -------------------------------------------------------------- Hent data */

  const load = useCallback(async () => {
    if (!seller) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listSessions(seller.id);
      // Kladder uden samtale er øvelser der aldrig kom i gang — de er ikke historik.
      const real = list.filter((s) => s.status !== "kladde" || s.transcript.length > 0);
      setSessions(real.sort(byNewest));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Historikken kunne ikke hentes.");
    } finally {
      setLoading(false);
    }
  }, [seller]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ---------------------------------------------------------------- Udvalg */

  const modesInUse = useMemo(() => {
    const seen = new Set<TrainingModeId>();
    for (const s of sessions) seen.add(s.modeId);
    return [...seen].sort((a, b) => modeLabel(a).localeCompare(modeLabel(b), "da-DK"));
  }, [sessions]);

  const ratingsInUse = useMemo(() => {
    const seen = new Set<Rating>();
    for (const s of sessions) if (s.feedback) seen.add(s.feedback.overall);
    return RATING_ORDER.filter((r) => seen.has(r));
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (mode !== "alle" && s.modeId !== mode) return false;
      if (rating !== "alle" && s.feedback?.overall !== rating) return false;
      if (!q) return true;
      const haystack = `${s.scenario?.title ?? ""} ${s.feedback?.headline ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [sessions, mode, rating, query]);

  const filtersActive = mode !== "alle" || rating !== "alle" || query.trim() !== "";

  const summary = useMemo(() => {
    const totalSec = sessions.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);
    return {
      count: sessions.length,
      totalSec,
      focus: recurringFocus(sessions),
    };
  }, [sessions]);

  /* ------------------------------------------------------------- Prøv igen */

  const runAgain = useCallback(
    async (source: TrainingSession) => {
      if (retryingId) return;
      setRetryingId(source.id);
      const next = buildRetrySession(source);
      try {
        await saveSession(next);
        navigate(`/session/${next.id}`);
      } catch {
        toast("Øvelsen kunne ikke startes herfra — vi åbner opsætningen i stedet.", "fejl");
        navigate(`/traening/${source.modeId}`, { state: { retryOf: source.id } });
      } finally {
        setRetryingId(null);
      }
    },
    [retryingId, navigate, toast],
  );

  /* ------------------------------------------------------------------ Render */

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Din træning"
        title="Historik"
        desc="Alle dine øvelser, nyeste først. Kun dine egne — ingen andre kan se dem her."
      />

      <div className="space-y-5">
      {loading ? (
        <LoadingBlock label="Henter din historik" rows={4} />
      ) : error ? (
        <ErrorNote title="Historikken kunne ikke hentes" onRetry={() => void load()}>
          Dine øvelser er ikke slettet — de kunne bare ikke hentes lige nu.
          <span className="mt-3 block text-xs text-danger-700/80">{error}</span>
        </ErrorNote>
      ) : !sessions.length ? (
        <EmptyState
          icon={<Icon.History width={22} height={22} />}
          title="Du har ingen øvelser endnu"
          desc="Historikken samler dine samtaler og salgsdirektørens vurdering af dem. Den fyldes, når du har kørt den første."
          action={
            <Link to="/" className="btn-primary">
              <Icon.Mic width={16} height={16} />
              Gå til træningen
            </Link>
          }
        />
      ) : (
        <>
          {/* ------------------------------------------------------- Opsummering */}
          <p className="text-sm text-ink-mute">
            <span className="text-ink-soft">{plural(summary.count, "øvelse", "øvelser")}</span>
            <span className="mx-2 text-ink-faint">·</span>
            <span className="text-ink-soft">{formatDuration(summary.totalSec)} trænet</span>
            {summary.focus && (
              <>
                <span className="mx-2 text-ink-faint">·</span>
                Gennemgående fokus:{" "}
                <span className="text-ink-soft">{truncate(summary.focus, 90)}</span>
              </>
            )}
          </p>

          {/* ------------------------------------------------------------ Filtre */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Icon.Search
                width={16}
                height={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                className="input pl-10"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Søg i scenarie eller konklusion"
                aria-label="Søg i scenarie eller konklusion"
              />
            </div>

            <select
              className="select sm:w-52"
              value={mode}
              onChange={(e) => setMode(e.target.value as ModeFilter)}
              aria-label="Filtrér på træningsform"
            >
              <option value="alle">Alle træningsformer</option>
              {modesInUse.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m] ?? m}
                </option>
              ))}
            </select>

            <select
              className="select sm:w-48"
              value={rating}
              onChange={(e) => setRating(e.target.value as RatingFilter)}
              aria-label="Filtrér på vurdering"
            >
              <option value="alle">Alle vurderinger</option>
              {ratingsInUse.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* ------------------------------------------------------------ Listen */}
          {filtered.length ? (
            <ul className="space-y-2.5">
              {filtered.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  busy={retryingId === s.id}
                  onRetry={() => void runAgain(s)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Ingen øvelser matcher"
              desc="Prøv en anden søgning, eller ryd filtrene."
              action={
                filtersActive ? (
                  <button
                    className="btn-outline btn-sm"
                    onClick={() => {
                      setMode("alle");
                      setRating("alle");
                      setQuery("");
                    }}
                  >
                    Ryd filtre
                  </button>
                ) : undefined
              }
            />
          )}
        </>
      )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Én række                                                                    */
/* ========================================================================== */

function SessionRow({
  session,
  busy,
  onRetry,
}: {
  session: TrainingSession;
  busy: boolean;
  onRetry: () => void;
}) {
  const title = session.scenario?.title || modeLabel(session.modeId);
  const headline = session.feedback?.headline;

  return (
    <li className="panel-quiet flex flex-col gap-3 p-4 transition-colors hover:border-base-line2 sm:flex-row sm:items-start sm:gap-5">
      <Link
        to={`/debriefing/${session.id}`}
        className="min-w-0 flex-1 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-mute">
          <span className="font-medium text-ink-soft">{formatWhen(session.startedAt)}</span>
          <span className="text-ink-faint" aria-hidden="true">
            ·
          </span>
          <span>{modeLabel(session.modeId)}</span>
          <span className="text-ink-faint" aria-hidden="true">
            ·
          </span>
          <span>{formatDuration(session.durationSec)}</span>
        </div>

        <h3 className="title-md mt-1.5 truncate">{title}</h3>

        {headline ? (
          <p className="body mt-1 line-clamp-2 max-w-[70ch]">{headline}</p>
        ) : (
          <p className="body-mute mt-1">
            Ikke vurderet endnu — åbn øvelsen for at hente Salgsdirektørens gennemgang.
          </p>
        )}
      </Link>

      <div className="flex shrink-0 items-center gap-2.5 sm:flex-col sm:items-end">
        {session.feedback ? (
          <RatingPill rating={session.feedback.overall} size="sm" />
        ) : (
          <span className="chip">Ikke vurderet</span>
        )}
        <button
          className="btn-outline btn-sm"
          onClick={onRetry}
          disabled={busy}
          title={`Kør ${modeLabel(session.modeId).toLowerCase()} igen`}
        >
          {busy ? <Spinner size={13} /> : <Icon.Repeat width={14} height={14} />}
          Prøv igen
        </button>
      </div>
    </li>
  );
}

/* ========================================================================== */
/* Hjælpere                                                                    */
/* ========================================================================== */

function byNewest(a: TrainingSession, b: TrainingSession): number {
  return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
}

/**
 * Det udviklingsfokus der går igen. Først sælgerens egne fokuspunkter — de er
 * skrevet af coachen og siger mest. Går ingen af dem igen, falder vi tilbage
 * på det kompetenceområde der oftest er vurderet svagt. Går heller ikke det
 * igen, siger vi ingenting frem for at finde på et mønster.
 */
function recurringFocus(sessions: readonly TrainingSession[]): string | null {
  const byPhrase = new Map<string, { label: string; count: number }>();

  for (const s of sessions) {
    const items = s.developmentFocus?.length
      ? s.developmentFocus
      : (s.feedback?.focusNextTime ?? []);
    const seen = new Set<string>();
    for (const raw of items) {
      const label = raw.trim();
      if (!label) continue;
      const key = normalise(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = byPhrase.get(key);
      if (entry) entry.count += 1;
      else byPhrase.set(key, { label, count: 1 });
    }
  }

  const topPhrase = [...byPhrase.values()].sort((a, b) => b.count - a.count)[0];
  if (topPhrase && topPhrase.count >= 2) return topPhrase.label;

  const byArea = new Map<SkillArea, number>();
  for (const s of sessions) {
    for (const c of s.feedback?.categories ?? []) {
      if (c.rating === "SKAL FORBEDRES" || c.rating === "SVAG") {
        byArea.set(c.area, (byArea.get(c.area) ?? 0) + 1);
      }
    }
  }
  const topArea = [...byArea.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topArea && topArea[1] >= 2) return skillAreaLabel(topArea[0]);

  return null;
}

/** Sammenligningsnøgle: samme pointe skrevet lidt forskelligt tæller som én. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);
}
