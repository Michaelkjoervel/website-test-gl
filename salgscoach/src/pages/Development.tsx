// =============================================================================
// pages/Development · "Min udvikling"
// -----------------------------------------------------------------------------
// Sælgerens private spejl. Skærmen er skrevet som en erfaren salgsdirektørs
// løbende vurdering — ikke som et HR-skema. Derfor:
//
//   · Vurderingen (narrative) er overskriften. Ikke en sidebemærkning.
//   · Tallene er stille. Ingen streaks, niveauer, point eller mærkater.
//   · Mønstre er hjertet: hvad gør du igen og igen — og hvad har du flyttet.
//   · Et mønster set ÉN gang er markeret som en enkelt observation. Vi bygger
//     ikke en profil på én fejl, og det siger skærmen højt.
// =============================================================================

import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { getProfile, listSessions, saveProfile } from "../lib/store";
import {
  formatDateCompact,
  formatMinutes,
  formatWhen,
  plural,
  skillAreaLabel,
  trendStyle,
} from "../lib/format";
import {
  CoachText,
  EmptyState,
  ErrorNote,
  Notice,
  Panel,
  RatingPill,
  SectionHeader,
  Spinner,
  useToast,
} from "../ui/primitives";
import { Icon } from "../ui/icons";
import type {
  DevelopmentPattern,
  RecommendedTraining,
  SellerProfile,
  SkillArea,
  SkillSignal,
  TrainingModeId,
  TrainingSession,
} from "../lib/types";

/* -------------------------------------------------------------------------- */
/* Træningsformernes navne                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Manifestet er sandheden om titlerne, men udviklingsskærmen må aldrig vente
 * på et netværkskald for at kunne vise en anbefaling. Derfor et lokalt fald-
 * back-navn, som opgraderes stille, hvis manifestet når frem.
 */
const MODE_FALLBACK_TITLE: Record<TrainingModeId, string> = {
  kunderollespil: "Kunderollespil",
  afdaekning: "Behovsafdækning",
  indvendinger: "Indvendinger",
  salgsmoede: "Salgsmøde",
  telefon: "Telefonsamtale",
  kvalificering: "Kvalificering",
  "naeste-skridt": "Næste skridt",
  forhandling: "Forhandling",
  forberedelse: "Mødeforberedelse",
  debriefing: "Debriefing",
  tilbudsopfoelgning: "Tilbudsopfølgning",
  lynild: "Lynild",
  manualeksamen: "Manualeksamen",
  "fri-coaching": "Fri coaching",
  materialepraesentation: "Materialepræsentation",
};

interface ModeLite {
  id: TrainingModeId;
  title?: string;
}

/* -------------------------------------------------------------------------- */
/* Skærmen                                                                     */
/* -------------------------------------------------------------------------- */

export function Development() {
  const { seller } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [modeTitles, setModeTitles] = useState<Partial<Record<TrainingModeId, string>>>({});
  const [attempt, setAttempt] = useState(0);

  const sellerId = seller?.id ?? "";

  useEffect(() => {
    if (!sellerId) return;
    let alive = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const [p, s] = await Promise.all([getProfile(sellerId), listSessions(sellerId)]);
        if (!alive) return;
        setProfile(p ?? null);
        setSessions(Array.isArray(s) ? s : []);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Udviklingsprofilen kunne ikke hentes.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [sellerId, attempt]);

  // Kanoniske navne på træningsformerne — helt uden betydning for om siden virker.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const manifest = (await api.getManifest()) as unknown as { modes?: ModeLite[] };
        if (!alive || !Array.isArray(manifest?.modes)) return;
        const map: Partial<Record<TrainingModeId, string>> = {};
        for (const m of manifest.modes) if (m?.id && m.title) map[m.id] = m.title;
        setModeTitles(map);
      } catch {
        // Fallback-navnene bærer skærmen. Ingen grund til at sige noget.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const modeTitle = useCallback(
    (id: TrainingModeId): string => modeTitles[id] ?? MODE_FALLBACK_TITLE[id] ?? id,
    [modeTitles],
  );

  /* ---------------------------------------------------------------- Tal */

  const stats = useMemo(() => {
    const done = sessions
      .filter((s) => s.status === "afsluttet" || s.status === "analyseret")
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    const count = done.length || profile?.sessionsCount || 0;
    const minutes =
      Math.round(done.reduce((sum, s) => sum + (s.durationSec || 0), 0) / 60) ||
      profile?.totalMinutes ||
      0;
    const last = done[0]?.startedAt ?? profile?.lastSessionAt;
    return { count, minutes, last };
  }, [sessions, profile]);

  /* ------------------------------------------------------------ Mønstre */

  const patterns = useMemo(() => {
    const weak = (profile?.weaknesses ?? []).filter((p) => p.status !== "loest");
    const strong = (profile?.strengths ?? []).filter((p) => p.status !== "loest");
    const solved = [...(profile?.weaknesses ?? []), ...(profile?.strengths ?? [])].filter(
      (p) => p.status === "loest",
    );
    return { weak: sortPatterns(weak), strong: sortPatterns(strong), solved: sortPatterns(solved) };
  }, [profile]);

  const signals = useMemo(() => {
    const raw = profile?.signals ?? {};
    return (Object.keys(raw) as SkillArea[])
      .map((area) => raw[area])
      .filter((s): s is SkillSignal => Boolean(s))
      .sort((a, b) => skillAreaLabel(a.area).localeCompare(skillAreaLabel(b.area), "da-DK"));
  }, [profile]);

  const recommended = useMemo(
    () => [...(profile?.recommended ?? [])].sort((a, b) => a.priority - b.priority).slice(0, 3),
    [profile],
  );

  /* --------------------------------------------------------- Egne mål */

  const [goalDraft, setGoalDraft] = useState("");
  const [savingGoals, setSavingGoals] = useState(false);

  const commitGoals = useCallback(
    async (next: string[]) => {
      if (!profile) return;
      const previous = profile;
      const updated: SellerProfile = { ...profile, ownGoals: next };
      setProfile(updated);
      setSavingGoals(true);
      try {
        await saveProfile(updated);
      } catch (e) {
        setProfile(previous);
        toast(e instanceof Error ? e.message : "Kunne ikke gemmes. Prøv igen.", "fejl");
      } finally {
        setSavingGoals(false);
      }
    },
    [profile, toast],
  );

  const addGoal = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const text = goalDraft.trim();
      if (!text || !profile) return;
      const existing = profile.ownGoals ?? [];
      if (existing.some((g) => g.toLowerCase() === text.toLowerCase())) {
        setGoalDraft("");
        return;
      }
      setGoalDraft("");
      void commitGoals([...existing, text]);
    },
    [goalDraft, profile, commitGoals],
  );

  /* ------------------------------------------------------------ Render */

  if (!seller) {
    return (
      <div className="flex items-center gap-3 py-20 text-ink-mute">
        <Spinner /> Henter din profil…
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-20 text-ink-mute">
        <Spinner /> Henter din udvikling…
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-6">
      <header>
        <div className="eyebrow">Fortroligt · dig og salgsledelsen</div>
        <h1 className="title-xl mt-1.5">Min udvikling</h1>
        <p className="body mt-2 max-w-2xl">
          Salgsdirektørens løbende vurdering af dig. Den skrives om efter hver øvelse og bygger
          udelukkende på det, du faktisk har sagt i samtalerne.
        </p>
      </header>

      {error && (
        <ErrorNote onRetry={() => setAttempt((n) => n + 1)}>
          {error} Vurderingen er ikke hentet — prøv igen.
        </ErrorNote>
      )}

      {!profile ? (
        <NoProfileYet sessions={stats.count} />
      ) : (
        <>
          {/* --------------------------------------------------- Vurderingen */}
          <Panel as="section" className="border-brand-800/70">
            <div className="eyebrow">Salgsdirektørens vurdering</div>
            <h2 className="sr-only">Salgsdirektørens vurdering</h2>
            {profile.narrative?.trim() ? (
              <CoachText
                text={profile.narrative}
                className="mt-3 text-[16px] leading-[1.7] md:text-[17px]"
              />
            ) : (
              <p className="body mt-3">
                Vurderingen er ikke skrevet endnu. Den kommer, når der er samtaler nok til at sige
                noget, der holder.
              </p>
            )}
            <p className="mt-5 border-t border-base-line pt-4 text-xs text-ink-mute">
              Senest skrevet om {formatWhen(profile.updatedAt)} · bygger på{" "}
              {plural(stats.count, "gennemført samtale", "gennemførte samtaler")}
            </p>
          </Panel>

          {/* ----------------------------------------------------- Tallene */}
          <dl className="panel-quiet flex flex-col divide-y divide-base-line sm:flex-row sm:divide-x sm:divide-y-0">
            <StatCell label="Samtaler gennemført" value={String(stats.count)} />
            <StatCell label="Trænet i alt" value={formatMinutes(stats.minutes)} />
            <StatCell label="Seneste samtale" value={stats.last ? formatWhen(stats.last) : "—"} />
          </dl>

          {/* ----------------------------------------------------- Mønstre */}
          <section>
            <SectionHeader
              eyebrow="Det, der gentager sig"
              title="Mønstre"
              desc="Et mønster bliver først en konklusion, når det er set flere gange. Det, der kun er set én gang, står nedenfor som netop det — en enkelt observation."
            />

            <div className="space-y-8">
              <PatternGroup
                heading="Det, der holder dig tilbage"
                intro="Rækkefølgen er ikke tilfældig. Det øverste koster dig mest."
                patterns={patterns.weak}
                kind="svaghed"
                emptyText="Der er endnu ikke registreret gentagne svagheder. Det betyder oftest, at der mangler samtaler — ikke at der ikke er noget."
              />
              <PatternGroup
                heading="Det, du kan bygge på"
                intro="Styrker tælles på samme måde: kun det, der er set flere gange, står som en styrke."
                patterns={patterns.strong}
                kind="styrke"
                emptyText="Ingen bekræftede styrker endnu."
              />
            </div>
          </section>

          {/* --------------------------------------------- Det har du flyttet */}
          {patterns.solved.length > 0 && (
            <section>
              <SectionHeader
                eyebrow="Lukket"
                title="Det har du flyttet"
                desc="Mønstre der ikke længere dukker op i samtalerne. De bliver stående, fordi fremgang skal kunne ses."
              />
              <div className="space-y-3">
                {patterns.solved.map((p) => (
                  <SolvedRow key={p.id} pattern={p} />
                ))}
              </div>
            </section>
          )}

          {/* ---------------------------------------------------- Signaler */}
          {signals.length > 0 && (
            <section>
              <SectionHeader
                eyebrow="Kompetenceområder"
                title="Signaler"
                desc="Coachens aktuelle læsning af de områder, der er observeret nok til at kunne vurderes. Områder uden observationer står ikke på listen."
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {signals.map((s) => (
                  <SignalCard key={s.area} signal={s} />
                ))}
              </div>
            </section>
          )}

          {/* -------------------------------------------- Anbefalet træning */}
          {recommended.length > 0 && (
            <section>
              <SectionHeader
                eyebrow="Næste øvelser"
                title="Anbefalet træning"
                desc="Anbefalingerne rammer bevidst det, du er dårligst til. Det er ikke der, det er behageligt at træne — det er der, der er mest at hente."
              />
              <div className="grid gap-4 lg:grid-cols-3">
                {recommended.map((r) => (
                  <RecommendationCard key={`${r.modeId}-${r.priority}`} rec={r} title={modeTitle(r.modeId)} />
                ))}
              </div>
            </section>
          )}

          {/* ------------------------------------------------ Manual-huller */}
          {(profile.manualGaps?.length ?? 0) > 0 && (
            <section>
              <SectionHeader
                eyebrow="green lights salgsmanual"
                title="Manual-huller"
                desc="Principper fra manualen, du gentagne gange ikke anvender i praksis."
                right={
                  <Link to="/manual" className="btn-outline btn-sm">
                    Åbn manualen
                  </Link>
                }
              />
              <div className="space-y-3">
                {profile.manualGaps.map((g) => (
                  <Panel key={g.principleId} as="article" className="p-4 md:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="title-md min-w-0">{g.title}</h3>
                      <Link
                        to="/manual"
                        state={{ focusPrincipleId: g.principleId, focusTitle: g.title }}
                        className="btn-ghost btn-sm shrink-0"
                      >
                        Find i manualen
                        <Icon.Arrow width={15} height={15} />
                      </Link>
                    </div>
                    <p className="body mt-2">{g.note}</p>
                  </Panel>
                ))}
              </div>
            </section>
          )}

          {/* ---------------------------------------------------- Egne mål */}
          <section>
            <SectionHeader
              eyebrow="Dine egne"
              title="Det, du selv har bedt om at blive presset på"
              desc="Skriv det, du vil holdes fast på. Coachen bruger listen aktivt i øvelserne."
            />
            <Panel>
              <form onSubmit={addGoal} className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor="eget-maal" className="sr-only">
                  Nyt punkt du vil presses på
                </label>
                <input
                  id="eget-maal"
                  className="input flex-1"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  placeholder="Fx: Stop mig, hvis jeg begynder at præsentere før behovet er forstået"
                  maxLength={180}
                />
                <button type="submit" className="btn-primary shrink-0" disabled={!goalDraft.trim() || savingGoals}>
                  {savingGoals ? <Spinner size={14} /> : <Icon.Check width={16} height={16} />}
                  Tilføj
                </button>
              </form>

              {(profile.ownGoals?.length ?? 0) === 0 ? (
                <p className="body-mute mt-4">Ingen punkter endnu.</p>
              ) : (
                <ul className="mt-4 divide-y divide-base-line">
                  {profile.ownGoals.map((g, i) => (
                    <li key={`${g}-${i}`} className="flex items-start gap-3 py-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1 text-sm leading-relaxed text-ink-soft">{g}</span>
                      <button
                        type="button"
                        className="btn-ghost btn-sm shrink-0 px-2 text-ink-mute hover:text-danger-300"
                        onClick={() =>
                          void commitGoals((profile.ownGoals ?? []).filter((_, idx) => idx !== i))
                        }
                        disabled={savingGoals}
                        aria-label={`Fjern: ${g}`}
                      >
                        <Icon.X width={15} height={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tom profil                                                                  */
/* -------------------------------------------------------------------------- */

function NoProfileYet({ sessions }: { sessions: number }) {
  return (
    <div className="space-y-5">
      <EmptyState
        icon={<Icon.Chart width={26} height={26} />}
        title="Din profil er ikke bygget endnu"
        desc="Vurderingen skrives ud fra rigtige samtaler — ikke ud fra en test. Der skal typisk fire-fem gennemførte øvelser til, før mønstrene er til at stole på. Indtil da ville en profil være et gæt, og et gæt er værre end ingenting."
        action={
          <Link to="/" className="btn-primary">
            Se træningsformerne
            <Icon.Arrow width={16} height={16} />
          </Link>
        }
      />
      <Notice>
        {sessions > 0
          ? `Du har ${plural(sessions, "gennemført samtale", "gennemførte samtaler")}. Der er endnu ikke nok til, at coachen vil skrive en vurdering.`
          : "Så snart du har gennemført din første samtale, begynder coachen at samle op."}
      </Notice>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tal                                                                         */
/* -------------------------------------------------------------------------- */

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-5 py-4">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mønstre                                                                     */
/* -------------------------------------------------------------------------- */

function sortPatterns(list: DevelopmentPattern[]): DevelopmentPattern[] {
  return [...list].sort((a, b) => {
    if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
  });
}

function PatternGroup({
  heading,
  intro,
  patterns,
  kind,
  emptyText,
}: {
  heading: string;
  intro: string;
  patterns: DevelopmentPattern[];
  kind: "svaghed" | "styrke";
  emptyText: string;
}) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="title-md">{heading}</h3>
        <p className="body-mute mt-1">{intro}</p>
      </div>
      {patterns.length === 0 ? (
        <Notice>{emptyText}</Notice>
      ) : (
        <div className="space-y-3">
          {patterns.map((p) => (
            <PatternCard key={p.id} pattern={p} kind={kind} />
          ))}
        </div>
      )}
    </div>
  );
}

function PatternCard({ pattern, kind }: { pattern: DevelopmentPattern; kind: "svaghed" | "styrke" }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const single = pattern.occurrences <= 1;
  const trend = trendStyle(pattern.trend);
  const evidence = pattern.evidence ?? [];

  const edge = single
    ? "border-dashed border-base-line2"
    : kind === "svaghed"
      ? "border-warn-600/40"
      : "border-brand-800";

  return (
    <article className={`panel border ${edge} p-4 md:p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip">{skillAreaLabel(pattern.area)}</span>

        {single ? (
          <span className="chip border-dashed text-ink-mute">Enkelt observation</span>
        ) : (
          <span className="chip">Set {pattern.occurrences} gange</span>
        )}

        <span className={`chip ${trend.text}`}>
          <span className="sr-only">Tendens: </span>
          <span aria-hidden="true">{trend.arrow}</span>
          {trend.label}
        </span>
      </div>

      <h4 className="mt-3 text-[16px] font-semibold leading-snug text-ink md:text-[17px]">
        {pattern.statement}
      </h4>

      {single && (
        <p className="mt-2.5 rounded-xl border border-dashed border-base-line2 bg-base/50 px-3.5 py-2.5 text-xs leading-relaxed text-ink-mute">
          Set én gang. Det er ikke et mønster — en profil bliver aldrig bygget på én fejl. Sker det
          igen, bliver det stående som en konklusion.
        </p>
      )}

      <p className="mt-3 text-xs text-ink-mute">
        Først set {formatDateCompact(pattern.firstSeen)} · sidst set {formatDateCompact(pattern.lastSeen)}
      </p>

      {evidence.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            className="btn-ghost btn-sm -ml-2"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon.Doc width={15} height={15} />
            {open
              ? "Skjul citaterne"
              : `Vis ${plural(evidence.length, "citat fra samtalerne", "citater fra samtalerne")}`}
          </button>

          <ul id={bodyId} hidden={!open} className="mt-2 space-y-2">
            {evidence.map((e, i) => (
              <li key={`${e.sessionId}-${i}`} className="panel-inset p-3.5">
                <blockquote className="text-sm leading-relaxed text-ink-soft">
                  <span aria-hidden="true">»</span>
                  {e.quote}
                  <span aria-hidden="true">«</span>
                </blockquote>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-ink-mute">{formatDateCompact(e.date)}</span>
                  <Link to={`/debriefing/${e.sessionId}`} className="btn-ghost btn-sm -mr-2">
                    Åbn samtalen
                    <Icon.Arrow width={14} height={14} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function SolvedRow({ pattern }: { pattern: DevelopmentPattern }) {
  return (
    <article className="panel-quiet flex items-start gap-3 p-4">
      <span className="mt-0.5 shrink-0 text-brand-400" aria-hidden="true">
        <Icon.Check width={17} height={17} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold leading-snug text-ink-soft">{pattern.statement}</h3>
        <p className="mt-1.5 text-xs text-ink-mute">
          <span className="sr-only">Status: lukket. </span>
          {skillAreaLabel(pattern.area)} · set {pattern.occurrences} gange · sidst{" "}
          {formatDateCompact(pattern.lastSeen)}
        </p>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Signaler                                                                    */
/* -------------------------------------------------------------------------- */

function SignalCard({ signal }: { signal: SkillSignal }) {
  return (
    <article className="panel-quiet flex flex-col gap-2.5 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="title-md min-w-0">{skillAreaLabel(signal.area)}</h3>
        <RatingPill rating={signal.level} size="sm" />
      </div>
      <p className="text-sm leading-relaxed text-ink-soft">{signal.note}</p>
      <p className="mt-auto text-xs text-ink-mute">
        {plural(signal.observations, "observation", "observationer")} · opdateret{" "}
        {formatDateCompact(signal.updatedAt)}
      </p>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Anbefalet træning                                                           */
/* -------------------------------------------------------------------------- */

function RecommendationCard({ rec, title }: { rec: RecommendedTraining; title: string }) {
  const top = rec.priority === 1;
  return (
    <article
      className={`flex flex-col rounded-2xl border p-5 ${
        top
          ? "border-brand-700 bg-brand-950/40 shadow-panel"
          : "border-base-line bg-base-panel"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`eyebrow ${top ? "text-brand-300" : ""}`}>
          {top ? "Start her" : `Prioritet ${rec.priority}`}
        </span>
      </div>

      <h3 className={`mt-1.5 ${top ? "title-lg" : "title-md"}`}>{title}</h3>

      <p className="body mt-2.5">{rec.why}</p>

      <div className="mt-4 space-y-2 border-t border-base-line pt-4">
        <div>
          <div className="eyebrow">Der presses på</div>
          <p className="mt-1 text-sm leading-relaxed text-ink">{rec.focus}</p>
        </div>
        {rec.scenarioHint && (
          <div className="pt-1">
            <div className="eyebrow">Forslag til scenarie</div>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{rec.scenarioHint}</p>
          </div>
        )}
      </div>

      <Link
        to={`/traening/${rec.modeId}`}
        className={`mt-5 w-full ${top ? "btn-primary" : "btn-outline"}`}
      >
        Start øvelsen
        <Icon.Arrow width={16} height={16} />
      </Link>
    </article>
  );
}
