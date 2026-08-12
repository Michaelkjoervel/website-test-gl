// =============================================================================
// pages/ManagerDashboard · Ledelsesoverblik
// -----------------------------------------------------------------------------
// Skærmen salgsdirektøren åbner FØR en 1:1 eller et salgsmøde. Den svarer på
// fire spørgsmål og ikke andet:
//
//   1) Hvad skal vi træne som hold?          → Teamudvikling + Anbefalet træning
//   2) Bliver værktøjet overhovedet brugt?   → Træningsaktivitet
//   3) Hvilke mønstre er ved at tegne sig?   → Tilbagevendende svagheder
//   4) Hvor driver vi væk fra Salgsmanualen? → Salgsmanual-emner
//
// Den rangerer bevidst IKKE mennesker. Ingen score, ingen rangliste, ingen
// "top/bund". Sælgerne ved at værktøjet findes, og formålet står skrevet på
// skærmen, så der ikke er tvivl om hvad det bruges til.
//
// Analysen (api.teamOverview) er dyr. Den kører derfor kun når nogen beder om
// det: resultatet caches i modulet OG i localStorage, og en ændring i
// datagrundlaget udløser en diskret note — aldrig et automatisk genkald.
// =============================================================================

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../lib/auth";
import * as api from "../lib/api";
import { listAllSessions, listProfiles, summariseSessionsForProfile } from "../lib/store";
import { listSellers } from "../lib/sellers";
import * as fmt from "../lib/format";

import {
  Avatar,
  Bar,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  Notice,
  PageHeader,
  PageState,
  Panel,
  SectionHeader,
  Skel,
  Spinner,
} from "../ui/primitives";
import { Icon } from "../ui/icons";
import type {
  PatternTrend,
  Seller,
  SellerProfile,
  SkillArea,
  TeamOverview,
  TeamTheme,
  TrainingModeId,
  TrainingSession,
} from "../lib/types";

/* ------------------------------------------------------------------ Tekster */

const MODE_LABELS: Record<TrainingModeId, string> = {
  kunderollespil: "Kunderollespil",
  afdaekning: "Afdækning",
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

function modeLabel(id: TrainingModeId | string): string {
  return MODE_LABELS[id as TrainingModeId] ?? String(id);
}

const SEVERITY: Record<TeamTheme["severity"], { label: string; chip: string; rank: number }> = {
  hoej: { label: "Træn først", chip: "chip-warn", rank: 0 },
  middel: { label: "Træn løbende", chip: "chip-client", rank: 1 },
  lav: { label: "Hold øje", chip: "chip", rank: 2 },
};

/* ------------------------------------------------------- Cache af overblikket */

const CACHE_KEY = "gl.coach.teamoverblik.v1";

interface CachedOverview {
  overview: TeamOverview;
  /** Hvornår analysen faktisk blev kørt. */
  builtAt: string;
  /** Fingeraftryk af datagrundlaget, så vi kan sige "der er kommet nyt". */
  fingerprint: string;
}

/** Lever på modulet, så et skift til en sælger og retur ikke koster en ny analyse. */
let memoryCache: CachedOverview | null = null;

function readCache(): CachedOverview | null {
  if (memoryCache) return memoryCache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedOverview | null;
    if (!parsed || !parsed.overview) return null;
    memoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(entry: CachedOverview): void {
  memoryCache = entry;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Fuldt lager må ikke koste overblikket — hukommelsescachen bærer det.
  }
}

function fingerprintOf(profiles: readonly SellerProfile[], sessions: readonly TrainingSession[]): string {
  let lastSession = "";
  for (const s of sessions) if (s.startedAt > lastSession) lastSession = s.startedAt;
  let lastProfile = "";
  for (const p of profiles) if (p.updatedAt > lastProfile) lastProfile = p.updatedAt;
  return `${sessions.length}|${lastSession}|${profiles.length}|${lastProfile}`;
}

function errorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Der opstod en uventet fejl.";
}

/* --------------------------------------------------------------- Indgangen */

export function ManagerDashboard() {
  const { seller, isManager } = useAuth();

  // Adgangskontrollen ligger FØR alt dataarbejde. Ruten forsvarer sig selv;
  // at menupunktet er skjult for sælgere er ikke en sikkerhedsforanstaltning.
  if (!seller) return <AuthPending />;
  if (!isManager) return <NoManagerAccess />;

  return <DashboardInner />;
}

function AuthPending() {
  return (
    <div role="status" aria-label="Henter din adgang">
      <div className="page-head" aria-hidden="true">
        <Skel w={120} h={11} />
        <div className="mt-3">
          <Skel w="34%" h={32} />
        </div>
      </div>
      <LoadingBlock label="Henter din adgang" rows={3} />
    </div>
  );
}

export function NoManagerAccess() {
  return (
    <div>
      <PageState
        eyebrow="Salgsledelse"
        title="Du har ikke adgang til ledelsesoverblikket"
        desc="Ledelsesoverblikket er forbeholdt salgsledelsen. Din konto er registreret som sælger, og derfor vises hverken holdets sessioner, udviklingsprofiler eller noter her."
        detail="Din egen udvikling finder du under Min udvikling. Er rollen forkert, skal den rettes i brugeropsætningen."
        actions={
          <>
            <Link to="/udvikling" className="btn-primary">
              Gå til Min udvikling
            </Link>
            <Link to="/" className="btn-outline">
              Til forsiden
            </Link>
          </>
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------- Faner */

const TABS = [
  { id: "team", label: "Teamudvikling" },
  { id: "aktivitet", label: "Træningsaktivitet" },
  { id: "svagheder", label: "Tilbagevendende svagheder" },
  { id: "individuel", label: "Individuel udvikling" },
  { id: "traening", label: "Anbefalet næste træning" },
  { id: "manual", label: "Salgsmanual" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ------------------------------------------------------------- Afledte rækker */

interface RosterRow {
  initials: string;
  name: string;
  sessions: number;
  minutes: number;
  lastSessionAt?: string;
  topStrength?: string;
  topDevelopmentArea?: string;
  trend?: PatternTrend;
}

interface AreaWeakness {
  area: SkillArea;
  /** Initialer på de sælgere der viser noget i området. */
  sellers: string[];
  established: number;
  entries: { initials: string; statement: string; occurrences: number; trend: PatternTrend }[];
  themeNote?: string;
  severity?: TeamTheme["severity"];
}

/* ---------------------------------------------------------------- Skærmen */

function DashboardInner() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [profiles, setProfiles] = useState<SellerProfile[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [cached, setCached] = useState<CachedOverview | null>(() => readCache());

  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("team");

  const uid = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const autoBuilt = useRef(false);

  /* ----------------------------------------------------------- Datagrundlag */

  const loadBase = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, p, ses] = await Promise.all([listSellers(), listProfiles(), listAllSessions()]);
      setSellers(s);
      setProfiles(p);
      setSessions(ses);
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  const fingerprint = useMemo(() => fingerprintOf(profiles, sessions), [profiles, sessions]);

  const analysedSessions = useMemo(
    () => sessions.filter((s) => s.status !== "kladde" && Boolean(s.feedback)),
    [sessions],
  );

  /* -------------------------------------------------------- Selve analysen */

  const build = useCallback(async () => {
    if (!profiles.length && !sessions.length) return;
    setBuilding(true);
    setBuildError(null);
    try {
      const digests = summariseSessionsForProfile(sessions, { limit: 200 });
      const result = await api.teamOverview({ profiles, sessions: digests });
      const entry: CachedOverview = {
        overview: result.overview,
        builtAt: result.overview.updatedAt || new Date().toISOString(),
        fingerprint: fingerprintOf(profiles, sessions),
      };
      writeCache(entry);
      setCached(entry);
    } catch (e) {
      setBuildError(errorText(e));
    } finally {
      setBuilding(false);
    }
  }, [profiles, sessions]);

  // Kun ét automatisk kald: første gang der overhovedet ikke findes et overblik.
  // Derefter er det manageren der bestemmer hvornår analysen køres igen.
  useEffect(() => {
    if (loading || autoBuilt.current) return;
    if (cached) return;
    if (!analysedSessions.length) return;
    autoBuilt.current = true;
    void build();
  }, [loading, cached, analysedSessions.length, build]);

  const overview = cached?.overview ?? null;
  const stale = Boolean(cached && cached.fingerprint !== fingerprint && !loading);

  /* ------------------------------------------------------------ Afledt data */

  const roster = useMemo<RosterRow[]>(() => {
    const rows = new Map<string, RosterRow>();
    const add = (initials: string | undefined, name?: string) => {
      const key = (initials ?? "").trim().toUpperCase();
      if (!key) return;
      const existing = rows.get(key);
      if (!existing) {
        rows.set(key, { initials: key, name: name?.trim() || key, sessions: 0, minutes: 0 });
      } else if (name?.trim() && existing.name === existing.initials) {
        existing.name = name.trim();
      }
    };

    for (const s of sellers) if (s.active) add(s.initials, s.name);
    for (const p of profiles) add(p.initials);
    for (const s of sessions) add(s.sellerInitials);

    for (const s of sessions) {
      if (s.status === "kladde") continue;
      const row = rows.get((s.sellerInitials ?? "").trim().toUpperCase());
      if (!row) continue;
      row.sessions += 1;
      row.minutes += Math.max(0, Math.round((s.durationSec ?? 0) / 60));
      if (!row.lastSessionAt || s.startedAt > row.lastSessionAt) row.lastSessionAt = s.startedAt;
    }

    for (const o of overview?.sellers ?? []) {
      const row = rows.get(o.initials.trim().toUpperCase());
      if (!row) continue;
      row.topStrength = o.topStrength;
      row.topDevelopmentArea = o.topDevelopmentArea;
      row.trend = o.trend;
    }

    for (const p of profiles) {
      const row = rows.get(p.initials.trim().toUpperCase());
      if (!row) continue;
      if (!row.topStrength) row.topStrength = p.strengths.find((x) => x.status === "aktiv")?.statement;
      if (!row.topDevelopmentArea) {
        row.topDevelopmentArea = p.weaknesses.find((x) => x.status === "aktiv")?.statement;
      }
    }

    return [...rows.values()].sort((a, b) => a.initials.localeCompare(b.initials, "da-DK"));
  }, [sellers, profiles, sessions, overview]);

  const areaWeaknesses = useMemo<AreaWeakness[]>(() => {
    const byArea = new Map<SkillArea, AreaWeakness>();

    for (const p of profiles) {
      for (const w of p.weaknesses) {
        if (w.status === "loest") continue;
        const entry = byArea.get(w.area) ?? {
          area: w.area,
          sellers: [],
          established: 0,
          entries: [],
        };
        if (!entry.sellers.includes(p.initials)) entry.sellers.push(p.initials);
        if (w.occurrences >= 2) entry.established += 1;
        entry.entries.push({
          initials: p.initials,
          statement: w.statement,
          occurrences: w.occurrences,
          trend: w.trend,
        });
        byArea.set(w.area, entry);
      }
    }

    for (const t of overview?.recurringThemes ?? []) {
      const entry = byArea.get(t.area);
      if (entry) {
        entry.themeNote = t.note;
        entry.severity = t.severity;
        for (const a of t.affected) if (!entry.sellers.includes(a)) entry.sellers.push(a);
      } else {
        byArea.set(t.area, {
          area: t.area,
          sellers: [...t.affected],
          established: 0,
          entries: [],
          themeNote: t.note,
          severity: t.severity,
        });
      }
    }

    return [...byArea.values()].sort(
      (a, b) => b.sellers.length - a.sellers.length || b.established - a.established,
    );
  }, [profiles, overview]);

  const activeSellers = roster.filter((r) => r.sessions > 0).length;
  const thinData = analysedSessions.length < 10 || activeSellers < 3;

  /* --------------------------------------------------------- Tastaturstyring */

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    let next = -1;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  /* ------------------------------------------------------------------ Render */

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ Hoved */}
      <PageHeader
        eyebrow="Salgsledelse"
        title="Ledelsesoverblik"
        desc="Et coachingværktøj, ikke et måleværktøj. Overblikket svarer på hvad holdet skal træne — ikke hvem der er bedst. Der er hverken score, rangliste eller sammenligning af personer, og sælgerne ved at værktøjet findes."
        right={
          <div className="flex flex-col items-start gap-2 md:items-end">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => void build()}
              disabled={building || loading || !analysedSessions.length}
            >
              {building ? <Spinner size={14} /> : <Icon.Repeat width={15} height={15} />}
              {building ? "Analyserer holdet" : "Opdatér overblik"}
            </button>
            <span className="text-xs text-ink-mute">
              {cached ? `Overblik genereret ${fmt.formatWhen(cached.builtAt)}` : "Overblikket er ikke genereret endnu"}
            </span>
          </div>
        }
      />

      {loadError && (
        <ErrorNote title="Holdets data kunne ikke hentes" onRetry={() => void loadBase()}>
          <span className="text-xs text-danger-700/80">{loadError}</span>
        </ErrorNote>
      )}
      {buildError && (
        <ErrorNote title="Overblikket kunne ikke genereres" onRetry={() => void build()}>
          <span className="text-xs text-danger-700/80">{buildError}</span>
        </ErrorNote>
      )}

      {loading ? (
        <LoadingBlock label="Henter holdets sessioner og udviklingsprofiler" rows={4} />
      ) : (
        <>
          {stale && (
            <Notice>
              Der er kommet nye sessioner eller opdaterede profiler, siden overblikket blev genereret.
              Tallene for aktivitet er altid friske, mens mønstre og noter først bliver regnet om når du
              trykker Opdatér overblik.
            </Notice>
          )}

          {thinData && analysedSessions.length > 0 && (
            <Notice>
              Datagrundlaget er stadig tyndt: {fmt.plural(analysedSessions.length, "analyseret session", "analyserede sessioner")}{" "}
              fordelt på {fmt.plural(activeSellers, "sælger", "sælgere")}. Mønstre siger først noget
              pålideligt når den enkelte har flere samtaler bag sig. Læs overblikket som en pegepind, ikke
              som en konklusion.
            </Notice>
          )}

          {/* ------------------------------------------------------- Faner */}
          <div className="-mx-4 overflow-x-auto px-4 no-scrollbar md:mx-0 md:px-0">
            <div role="tablist" aria-label="Ledelsesoverblikkets visninger" className="flex min-w-max gap-1 border-b border-base-line">
              {TABS.map((t, i) => {
                const on = tab === t.id;
                return (
                  <button
                    key={t.id}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`${uid}-tab-${t.id}`}
                    aria-selected={on}
                    aria-controls={`${uid}-panel-${t.id}`}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setTab(t.id)}
                    onKeyDown={(e) => onTabKey(e, i)}
                    className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                      on
                        ? "border-brand-500 text-ink"
                        : "border-transparent text-ink-mute hover:text-ink-soft"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            role="tabpanel"
            id={`${uid}-panel-${tab}`}
            aria-labelledby={`${uid}-tab-${tab}`}
            tabIndex={0}
            className="space-y-5 focus:outline-none"
          >
            {tab === "team" && (
              <TeamTab
                overview={overview}
                roster={roster}
                sessions={sessions}
                analysed={analysedSessions.length}
                building={building}
                onBuild={() => void build()}
                onGoToManual={() => setTab("manual")}
              />
            )}
            {tab === "aktivitet" && <ActivityTab overview={overview} roster={roster} />}
            {tab === "svagheder" && <WeaknessTab items={areaWeaknesses} hasOverview={Boolean(overview)} />}
            {tab === "individuel" && <RosterTab roster={roster} hasOverview={Boolean(overview)} />}
            {tab === "traening" && (
              <TrainingTab overview={overview} building={building} onBuild={() => void build()} />
            )}
            {tab === "manual" && (
              <ManualTab overview={overview} building={building} onBuild={() => void build()} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Byggeklodser */

function TrendTag({ trend }: { trend?: PatternTrend }) {
  if (!trend) return <span className="text-xs text-ink-mute">Retning ikke vurderet endnu</span>;
  const t = fmt.trendStyle(trend);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${t.text}`}>
      <span aria-hidden="true">{t.arrow}</span>
      {t.label}
    </span>
  );
}

function SeverityTag({ severity }: { severity: TeamTheme["severity"] }) {
  const s = SEVERITY[severity];
  return <span className={s.chip}>{s.label}</span>;
}

function AffectedList({ initials, label = "Berører" }: { initials: readonly string[]; label?: string }) {
  if (!initials.length) {
    return <span className="text-xs text-ink-mute">Ingen sælgere knyttet til emnet endnu</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-ink-mute">{label}</span>
      {initials.map((i) => (
        <Link
          key={i}
          to={`/ledelse/${i.toUpperCase()}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-base-line bg-base-panel2 py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand-300 hover:text-ink"
        >
          <Avatar initials={i} size={20} />
          {i.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

function NeedsOverview({ building, onBuild }: { building: boolean; onBuild: () => void }) {
  return (
    <EmptyState
      title="Overblikket er ikke genereret endnu"
      desc="Analysen af holdet køres kun når du beder om det, fordi den er tung. Resultatet gemmes bagefter, så du kan gå frem og tilbage uden at den kører igen."
      action={
        <button type="button" className="btn-primary btn-sm" onClick={onBuild} disabled={building}>
          {building ? <Spinner size={14} /> : <Icon.Spark width={15} height={15} />}
          {building ? "Analyserer holdet" : "Generér overblik"}
        </button>
      }
    />
  );
}

/* ---------------------------------------------------------- Fane: Teamudvikling */

function TeamTab({
  overview,
  roster,
  sessions,
  analysed,
  building,
  onBuild,
  onGoToManual,
}: {
  overview: TeamOverview | null;
  roster: RosterRow[];
  sessions: TrainingSession[];
  analysed: number;
  building: boolean;
  onBuild: () => void;
  onGoToManual: () => void;
}) {
  const themes = useMemo(
    () => [...(overview?.recurringThemes ?? [])].sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank),
    [overview],
  );

  const totalMinutes = roster.reduce((a, r) => a + r.minutes, 0);
  const lastSession = roster.reduce<string | undefined>(
    (acc, r) => (r.lastSessionAt && (!acc || r.lastSessionAt > acc) ? r.lastSessionAt : acc),
    undefined,
  );

  if (!sessions.length) {
    return (
      <Panel as="section">
        <EmptyState
          title="Der er ingen træningssessioner endnu"
          desc="Så snart holdet begynder at træne, samler værktøjet de gennemgående udviklingstemaer her. Indtil da ville ethvert mønster være gætværk."
        />
      </Panel>
    );
  }

  return (
    <>
      <Panel as="section">
        <SectionHeader
          eyebrow="Holdets billede"
          title="Gennemgående udviklingstemaer"
          desc="Det holdet samlet set skal arbejde med. Temaerne er skrevet ud fra samtalerne — ikke ud fra resultater, budgetter eller aktivitet."
        />

        <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuietStat label="Sælgere der træner" value={`${roster.filter((r) => r.sessions > 0).length} af ${roster.length}`} />
          <QuietStat label="Analyserede sessioner" value={fmt.formatNumber(analysed)} />
          <QuietStat label="Samlet træningstid" value={fmt.formatMinutes(totalMinutes)} />
          <QuietStat label="Seneste session" value={lastSession ? fmt.formatDateCompact(lastSession) : "—"} />
        </dl>

        {!overview ? (
          <NeedsOverview building={building} onBuild={onBuild} />
        ) : themes.length === 0 ? (
          <Notice>
            Analysen har ikke fundet temaer der går igen på tværs af holdet. Med det nuværende antal
            sessioner er det det ærlige svar — et enkelt sammenfald er ikke et tema.
          </Notice>
        ) : (
          <ul className="space-y-3">
            {themes.map((t, i) => (
              <li key={`${t.area}-${i}`}>
                <article className="panel-quiet p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="title-md">{t.title}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="chip">{fmt.skillAreaLabel(t.area)}</span>
                        <SeverityTag severity={t.severity} />
                        <span className="text-xs text-ink-mute">
                          {fmt.plural(t.affected.length, "sælger", "sælgere")} berørt
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="body mt-3">{t.note}</p>
                  <div className="mt-3.5 border-t border-base-line pt-3">
                    <AffectedList initials={t.affected} />
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {overview && overview.manualDrift.length > 0 && (
        <Panel as="section">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="title-md">
                {fmt.plural(overview.manualDrift.length, "emne i Salgsmanualen", "emner i Salgsmanualen")} kræver
                opmærksomhed
              </h2>
              <p className="body-mute mt-1">
                {fmt.joinDanish(overview.manualDrift.slice(0, 3).map((d) => d.title))}
                {overview.manualDrift.length > 3 ? " med flere" : ""}
              </p>
            </div>
            <button type="button" className="btn-outline btn-sm" onClick={onGoToManual}>
              Se manual-emnerne
              <Icon.Arrow width={15} height={15} />
            </button>
          </div>
        </Panel>
      )}
    </>
  );
}

function QuietStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-inset p-3.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-lg font-bold tracking-tight text-ink">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------- Fane: Træningsaktivitet */

function ActivityTab({ overview, roster }: { overview: TeamOverview | null; roster: RosterRow[] }) {
  const modes = useMemo(
    () => [...(overview?.activityByMode ?? [])].sort((a, b) => b.sessions - a.sessions),
    [overview],
  );
  const maxMode = modes.reduce((a, m) => Math.max(a, m.sessions), 0);

  return (
    <>
      <Panel as="section">
        <SectionHeader
          eyebrow="Bliver værktøjet brugt"
          title="Hvilke øvelser bliver taget i brug"
          desc="Aktivitet siger noget om værktøjet, ikke om sælgeren. Få sessioner betyder at en øvelse ikke er faldet i hak endnu — det er en opgave for ledelsen, ikke en anmærkning på nogen."
        />

        {modes.length === 0 ? (
          <Notice>Ingen øvelser er taget i brug endnu.</Notice>
        ) : (
          <ul className="space-y-3">
            {modes.map((m) => (
              <li key={m.modeId}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium text-ink">{modeLabel(m.modeId)}</span>
                  <span className="shrink-0 text-xs text-ink-mute">
                    {fmt.plural(m.sessions, "session", "sessioner")}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar value={m.sessions} max={maxMode || 1} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel as="section">
        <SectionHeader
          eyebrow="Pr. sælger"
          title="Brug af værktøjet"
          desc="Tallene er talt direkte fra sessionerne og er derfor altid opdaterede — også når selve analysen af holdet er ældre."
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Sessioner, træningstid og seneste session pr. sælger</caption>
            <thead>
              <tr className="border-b border-base-line text-left">
                <th scope="col" className="py-2 pr-3 font-semibold text-ink-soft">Sælger</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold text-ink-soft">Sessioner</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold text-ink-soft">Træningstid</th>
                <th scope="col" className="py-2 text-right font-semibold text-ink-soft">Seneste</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.initials} className="border-b border-base-line/70 last:border-0">
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                    <span className="flex items-center gap-2.5">
                      <Avatar initials={r.initials} size={26} />
                      <span className="text-ink">{r.name === r.initials ? r.initials : `${r.name} (${r.initials})`}</span>
                    </span>
                  </th>
                  {r.sessions === 0 ? (
                    <td className="py-2.5 text-right text-ink-mute" colSpan={3}>
                      Ingen sessioner endnu
                    </td>
                  ) : (
                    <>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-soft">
                        {fmt.formatNumber(r.sessions)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-soft">
                        {fmt.formatMinutes(r.minutes)}
                      </td>
                      <td className="py-2.5 text-right text-ink-soft">
                        {fmt.formatDateCompact(r.lastSessionAt)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ------------------------------------------------ Fane: Tilbagevendende svagheder */

function WeaknessTab({ items, hasOverview }: { items: AreaWeakness[]; hasOverview: boolean }) {
  return (
    <Panel as="section">
      <SectionHeader
        eyebrow="På tværs af holdet"
        title="Tilbagevendende salgssvagheder"
        desc="Grupperet på kompetenceområde, så det er området der er i fokus — ikke personen. Et mønster tæller først med, når det er set flere gange hos den samme sælger."
      />

      {items.length === 0 ? (
        <Notice>
          {hasOverview
            ? "Der er endnu ingen svagheder der går igen hos flere sælgere. Med det nuværende datagrundlag er det det ærlige svar."
            : "Grundlaget hentes fra sælgernes udviklingsprofiler. Der er ingen aktive udviklingsmønstre endnu."}
        </Notice>
      ) : (
        <ul className="space-y-3">
          {items.map((w) => (
            <li key={w.area}>
              <article className="panel-quiet p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="title-md">{fmt.skillAreaLabel(w.area)}</h3>
                    <p className="mt-1 text-xs text-ink-mute">
                      {fmt.plural(w.sellers.length, "sælger viser noget her", "sælgere viser noget her")}
                      {w.established > 0
                        ? ` · ${fmt.plural(w.established, "etableret mønster", "etablerede mønstre")}`
                        : " · endnu ingen etablerede mønstre"}
                    </p>
                  </div>
                  {w.severity && <SeverityTag severity={w.severity} />}
                </div>

                {w.themeNote && <p className="body mt-3">{w.themeNote}</p>}

                {w.entries.length > 0 && (
                  <ul className="mt-3.5 space-y-2 border-t border-base-line pt-3">
                    {w.entries.map((e, i) => (
                      <li key={`${e.initials}-${i}`} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <Link
                          to={`/ledelse/${e.initials.toUpperCase()}`}
                          className="text-xs font-semibold text-ink-soft underline decoration-base-line2 underline-offset-4 hover:text-ink"
                        >
                          {e.initials.toUpperCase()}
                        </Link>
                        <span className="min-w-0 flex-1 text-sm text-ink-soft">{e.statement}</span>
                        <span className="text-xs text-ink-mute">
                          {e.occurrences <= 1
                            ? "Set én gang — endnu ikke et mønster"
                            : `Set ${fmt.formatNumber(e.occurrences)} gange`}
                        </span>
                        <TrendTag trend={e.trend} />
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------- Fane: Individuel udvikling */

function RosterTab({ roster, hasOverview }: { roster: RosterRow[]; hasOverview: boolean }) {
  return (
    <Panel as="section">
      <SectionHeader
        eyebrow="Til samtalen"
        title="Individuel udvikling"
        desc="Én indgang pr. sælger. Rækkefølgen er alfabetisk med vilje — der er ingen placering at læse ud af den."
      />

      {!hasOverview && (
        <div className="mb-4">
          <Notice>
            Styrke, udviklingsområde og retning kommer fra holdanalysen. Indtil den er genereret, vises kun
            det der kan tælles direkte.
          </Notice>
        </div>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {roster.map((r) => (
          <li key={r.initials}>
            <Link to={`/ledelse/${r.initials}`} className="tile h-full">
              <div className="flex items-start gap-3">
                <Avatar initials={r.initials} size={40} />
                <div className="min-w-0 flex-1">
                  <h3 className="title-md truncate">
                    {r.name === r.initials ? r.initials : `${r.name} (${r.initials})`}
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-mute">
                    {r.sessions === 0
                      ? "Ingen sessioner endnu"
                      : `${fmt.plural(r.sessions, "session", "sessioner")} · senest ${fmt.formatDateCompact(r.lastSessionAt)}`}
                  </p>
                </div>
                <span className="mt-1 shrink-0 text-ink-faint transition-colors group-hover:text-brand-700">
                  <Icon.Arrow width={16} height={16} />
                </span>
              </div>

              {r.sessions > 0 && (
                <dl className="mt-3 space-y-2 border-t border-base-line pt-3">
                  <div>
                    <dt className="eyebrow">Stærkest lige nu</dt>
                    <dd className="body mt-0.5">{r.topStrength ?? "Ikke vurderet endnu"}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Skal coaches på</dt>
                    <dd className="body mt-0.5">{r.topDevelopmentArea ?? "Ikke vurderet endnu"}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="eyebrow">Retning</dt>
                    <dd>
                      <TrendTag trend={r.trend} />
                    </dd>
                  </div>
                </dl>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* --------------------------------------------- Fane: Anbefalet næste træning */

function TrainingTab({
  overview,
  building,
  onBuild,
}: {
  overview: TeamOverview | null;
  building: boolean;
  onBuild: () => void;
}) {
  return (
    <Panel as="section">
      <SectionHeader
        eyebrow="Næste skridt for holdet"
        title="Anbefalet næste træning"
        desc="Hvad der giver mest mening at træne samlet — og hvorfor. Tænkt som dagsorden til et salgsmøde, ikke som en plan der skal følges slavisk."
      />

      {!overview ? (
        <NeedsOverview building={building} onBuild={onBuild} />
      ) : overview.recommendedTeamTraining.length === 0 ? (
        <Notice>
          Analysen peger ikke på én bestemt fælles øvelse endnu. Det sker typisk når sælgerne arbejder med
          hver sit — så er individuel coaching det rigtige før fælles træning.
        </Notice>
      ) : (
        <ol className="space-y-3">
          {overview.recommendedTeamTraining.map((r, i) => (
            <li key={`${r.modeId}-${i}`}>
              <article className="panel-quiet p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="title-md">{r.title}</h3>
                  <span className="chip-brand">Øvelse: {modeLabel(r.modeId)}</span>
                </div>
                <p className="body mt-2.5">{r.why}</p>
              </article>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ----------------------------------------------------- Fane: Salgsmanual-emner */

function ManualTab({
  overview,
  building,
  onBuild,
}: {
  overview: TeamOverview | null;
  building: boolean;
  onBuild: () => void;
}) {
  return (
    <Panel as="section">
      <SectionHeader
        eyebrow="green lights egen Salgsmanual"
        title="Manual-emner der kræver opmærksomhed"
        desc="Hvor holdet i praksis driver væk fra manualen. Det handler om hvilke principper der ikke bliver brugt i samtalerne — ikke om hvem der laver fejl."
      />

      {!overview ? (
        <NeedsOverview building={building} onBuild={onBuild} />
      ) : overview.manualDrift.length === 0 ? (
        <Notice>
          Analysen finder ikke systematisk afvigelse fra manualen i de sessioner der er analyseret. Det er
          ikke det samme som at manualen bliver brugt overalt — det kræver flere sessioner at afgøre.
        </Notice>
      ) : (
        <ul className="space-y-3">
          {overview.manualDrift.map((d, i) => (
            <li key={`${d.principleId}-${i}`}>
              <article className="rounded-2xl border border-warn-300/60 bg-warn-50/60 p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="title-md">{d.title}</h3>
                    <span className="mt-1 inline-block font-mono text-2xs uppercase tracking-wider text-ink-mute">
                      Princip {d.principleId}
                    </span>
                  </div>
                  <span className="chip-warn">Driver væk fra manualen</span>
                </div>
                <p className="body mt-3">{d.note}</p>
                <div className="mt-3.5 border-t border-warn-200 pt-3">
                  <AffectedList initials={d.affected} label="Ses hos" />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <p className="body-mute mt-5 border-t border-base-line pt-4">
        Manualen er holdets fælles sprog. Når et princip ikke bliver brugt, er det som regel fordi det
        ikke er trænet nok — ikke fordi nogen er uenige i det.
      </p>
    </Panel>
  );
}
