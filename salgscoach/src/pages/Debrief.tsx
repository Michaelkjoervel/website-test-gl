// =============================================================================
// pages/Debrief · Salgsdirektørens vurdering af den øvelse der lige er kørt
// -----------------------------------------------------------------------------
// Det er her produktet betaler sig tilbage. Skærmen er derfor bygget som en
// vurdering, ikke som et resultat: overskriften er coachens ene skarpe sætning,
// og karakteren står ved siden af som en biting.
//
// Rækkefølgen er bevidst og ændres ikke:
//   1) Hvad skete der   – de fem faste blokke
//   2) Hvad ved du      – fakta vs. antagelser (kernen i hele tænkningen)
//   3) Hvordan gjorde du – kategorier, manualen, eventuel ekstern teori
//   4) Hvad er sandt    – kvalificeringskortet
//   5) Hvad viser tallene – taletid og spørgsmål, køligt præsenteret
//
// Mangler analysen, hentes den her — sælgeren kan være landet direkte fra en
// afbrudt session. Udviklingsprofilen opdateres bagefter i baggrunden og må
// aldrig kunne vælte selve feedbacken.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../lib/auth";
// Navneområde-import: lib/api eksponerer navngivne funktioner (analyseSession,
// buildProfile, buildSellerContext …), og kaldene læses stadig som api.x().
import * as api from "../lib/api";
import {
  getProfile,
  getSession,
  listSessions,
  saveProfile,
  saveSession,
  summariseSessionsForProfile,
} from "../lib/store";
import {
  formatClock,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  plural,
  ratingLabel,
  skillAreaLabel,
} from "../lib/format";

/**
 * Hvad salgsdirektøren rent faktisk laver, mens sælgeren venter. Samme
 * rækkefølge og samme ordlyd som under selve øvelsen — ventetiden skal føles
 * som ét forløb, ikke to forskellige skærme.
 */
const ANALYSE_STEPS: readonly { at: number; text: string }[] = [
  { at: 0, text: "Læser hele samtalen igennem" },
  { at: 6, text: "Skiller fakta fra antagelser" },
  { at: 14, text: "Vurderer spørgsmål, lytning og taletid" },
  { at: 23, text: "Holder samtalen op mod salgsmanualen" },
  { at: 32, text: "Skriver feedbacken og dit næste fokus" },
];
import { newId } from "../lib/ids";
import type {
  ConversationMetrics,
  ManualReference,
  QualificationMap,
  SessionFeedback,
  SpeakerRole,
  TrainingModeId,
  TrainingSession,
  Utterance,
} from "../lib/types";

import { Icon } from "../ui/icons";
import {
  Bar,
  CoachText,
  ErrorNote,
  Modal,
  Notice,
  PageState,
  Panel,
  RatingPill,
  SectionHeader,
  Skel,
  Spinner,
  Stat,
  StepWait,
  useToast,
} from "../ui/primitives";

/* ========================================================================== */
/* Fælles for de to sessionsskærme                                             */
/* ========================================================================== */

/**
 * Træningsformernes danske navne. Ligger her, indtil hele modekataloget har
 * en fast plads — Historikken importerer den samme liste, så en øvelse aldrig
 * hedder to ting i den samme app.
 */
export const MODE_LABELS: Record<TrainingModeId, string> = {
  kunderollespil: "Kunderollespil",
  afdaekning: "Afdækning",
  indvendinger: "Indvendinger",
  salgsmoede: "Salgsmøde",
  telefon: "Telefonsamtale",
  kvalificering: "Kvalificering",
  "naeste-skridt": "Næste skridt",
  forhandling: "Forhandling",
  forberedelse: "Forberedelse",
  debriefing: "Debriefing",
  tilbudsopfoelgning: "Tilbudsopfølgning",
  lynild: "Lynild",
  manualeksamen: "Manualeksamen",
  "fri-coaching": "Fri coaching",
  materialepraesentation: "Materialepræsentation",
};

export function modeLabel(id: TrainingModeId | string | null | undefined): string {
  if (!id) return "Øvelse";
  return MODE_LABELS[id as TrainingModeId] ?? String(id).replace(/-/g, " ");
}

/** Øvelser hvor modparten er salgsdirektøren og ikke en kunde. */
const COACH_LED: readonly TrainingModeId[] = [
  "kvalificering",
  "forberedelse",
  "debriefing",
  "lynild",
  "manualeksamen",
  "fri-coaching",
];

function counterpartLabel(modeId: TrainingModeId): string {
  return COACH_LED.includes(modeId) ? "Salgsdirektøren" : "Kunden";
}

/**
 * Samme øvelse en gang til: samme form, samme scenarie, tom samtale — og et
 * spor tilbage til den session man vil gøre bedre end.
 */
export function buildRetrySession(source: TrainingSession): TrainingSession {
  return {
    ...source,
    id: newId("ses"),
    status: "kladde",
    startedAt: new Date().toISOString(),
    endedAt: undefined,
    durationSec: 0,
    transcript: [],
    feedback: undefined,
    summary: undefined,
    developmentFocus: [],
    retryOf: source.id,
  };
}

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message.trim() : "";
  return msg || "Noget gik galt. Prøv igen.";
}

/* ========================================================================== */
/* Skærmen                                                                     */
/* ========================================================================== */

export function Debrief() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { seller } = useAuth();
  const toast = useToast();

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState<string | null>(null);
  const [analyseSec, setAnalyseSec] = useState(0);

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [profileUpdated, setProfileUpdated] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const analyseStarted = useRef(false);
  const profileStarted = useRef(false);

  /* ------------------------------------------------------------ Hent session */

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const found = await getSession(sessionId);
      setSession(found ?? null);
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    analyseStarted.current = false;
    profileStarted.current = false;
    void load();
  }, [load]);

  /* Uret under analysen. Ventetiden er lang nok til, at den skal kunne aflæses
     — ikke gættes. Kører kun mens vi faktisk venter. */
  useEffect(() => {
    if (!analysing) return;
    setAnalyseSec(0);
    const from = Date.now();
    const id = window.setInterval(() => setAnalyseSec(Math.floor((Date.now() - from) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [analysing]);

  /* ---------------------------------------------------------------- Analyse */

  const analyse = useCallback(
    async (target: TrainingSession) => {
      setAnalysing(true);
      setAnalyseError(null);
      try {
        // Sælgerkonteksten gør vurderingen personlig — men den er en fordel,
        // ikke en betingelse. Fejler den, analyserer vi uden.
        let sellerContext: api.SellerContext | undefined;
        try {
          const [profile, recent] = await Promise.all([
            getProfile(target.sellerId),
            listSessions(target.sellerId),
          ]);
          sellerContext = api.buildSellerContext(profile, seller, recent.slice(0, 8));
        } catch {
          sellerContext = undefined;
        }

        // Den forseglede brief og materialeteksten følger sessionen, men står
        // ikke i TrainingSession — de sættes af opsætningen og samtalen.
        const extras = target as TrainingSession & {
          hiddenBlob?: string;
          documentText?: string;
        };

        const { feedback } = await api.analyseSession({
          modeId: target.modeId,
          coachMode: target.coachMode,
          language: target.language,
          scenario: target.scenario,
          hiddenBlob: extras.hiddenBlob,
          messages: target.transcript,
          sellerContext,
          intake: target.intake,
          documentText: extras.documentText,
          durationSec: target.durationSec,
          // Hårde tal tælles i browseren: modellen skal vurdere, ikke tælle ord.
          metrics: countMetrics(target),
        });

        const updated: TrainingSession = {
          ...target,
          feedback,
          status: "analyseret",
          summary: feedback.headline || target.summary,
          developmentFocus: target.developmentFocus?.length
            ? target.developmentFocus
            : (feedback.focusNextTime ?? []).slice(0, 2),
        };
        setSession(updated);

        try {
          await saveSession(updated);
        } catch {
          // Vurderingen er hentet — den skal vises, også selvom lageret driller.
        }
      } catch (e) {
        setAnalyseError(errorText(e));
      } finally {
        setAnalysing(false);
      }
    },
    [seller],
  );

  useEffect(() => {
    if (!session || session.feedback || analyseStarted.current) return;
    if (!session.transcript.length) return; // ingen samtale at vurdere
    analyseStarted.current = true;
    void analyse(session);
  }, [session, analyse]);

  /* ------------------------------------------------- Udviklingsprofil (baggrund) */

  useEffect(() => {
    if (!session?.feedback || !seller || profileStarted.current) return;
    // Kun sælgerens egen profil skrives her. En leder der kigger med, ændrer intet.
    if (session.sellerId !== seller.id) return;
    profileStarted.current = true;

    void (async () => {
      try {
        const previousProfile = await getProfile(seller.id);
        // Er profilen allerede skrevet efter denne vurdering, er der intet nyt.
        if (
          previousProfile?.updatedAt &&
          new Date(previousProfile.updatedAt).getTime() >=
            new Date(session.feedback?.generatedAt ?? 0).getTime()
        ) {
          return;
        }

        const all = await listSessions(seller.id);
        // Den netop analyserede session kan nå at være ældre i lageret.
        const merged = [session, ...all.filter((s) => s.id !== session.id)];
        const analysed = merged.filter((s) => s.status !== "kladde");

        const { profile } = await api.buildProfile({
          initials: seller.initials,
          previousProfile,
          sessions: summariseSessionsForProfile(analysed, { limit: 20 }),
        });

        await saveProfile({
          ...profile,
          // Tællingerne kender vi præcist — dem gætter vi ikke om.
          sellerId: seller.id,
          initials: seller.initials,
          sessionsCount: analysed.length,
          totalMinutes: Math.round(analysed.reduce((sum, s) => sum + (s.durationSec ?? 0), 0) / 60),
          lastSessionAt: analysed[0]?.startedAt ?? profile.lastSessionAt,
        });

        setProfileUpdated(true);
        toast("Din udviklingsprofil er opdateret");
      } catch {
        // Profilen er en sidegevinst. Den må aldrig ødelægge en debriefing.
      }
    })();
  }, [session, seller, toast]);

  /* ------------------------------------------------------------ Kør igen */

  const runAgain = useCallback(async () => {
    if (!session || retrying) return;
    setRetrying(true);
    const next = buildRetrySession(session);
    try {
      await saveSession(next);
      navigate(`/session/${next.id}`);
    } catch {
      // Kan sessionen ikke oprettes, sender vi sælgeren til opsætningen i stedet.
      navigate(`/traening/${session.modeId}`, { state: { retryOf: session.id } });
    } finally {
      setRetrying(false);
    }
  }, [session, retrying, navigate]);

  /* ------------------------------------------------------------------ Render */

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Henter debriefingen">
        <div>
          <Skel w={148} h={11} />
          <div className="mt-3">
            <Skel w="58%" h={30} />
          </div>
          <div className="mt-4">
            <Skel w="40%" h={12} />
          </div>
        </div>
        <div className="panel space-y-3 p-5 md:p-6" aria-hidden="true">
          <Skel w="34%" h={13} />
          <Skel w="100%" h={10} />
          <Skel w="92%" h={10} />
          <Skel w="68%" h={10} />
        </div>
        <div className="panel space-y-3 p-5 md:p-6" aria-hidden="true">
          <Skel w="28%" h={13} />
          <Skel w="100%" h={10} />
          <Skel w="80%" h={10} />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <PageState
        eyebrow="Debriefing"
        title="Debriefingen kunne ikke hentes"
        desc="Samtalen er ikke væk. Den ligger, hvor den blev gemt — det er kun visningen her, der ikke kunne bygges."
        detail={loadError}
        tone="danger"
        actions={
          <>
            <button type="button" className="btn-primary" onClick={() => void load()}>
              <Icon.Repeat width={16} height={16} />
              Prøv igen
            </button>
            <Link to="/historik" className="btn-outline">
              <Icon.Back width={15} height={15} />
              Til historikken
            </Link>
          </>
        }
      />
    );
  }

  if (!session) {
    return (
      <PageState
        eyebrow="Debriefing"
        title="Øvelsen findes ikke"
        desc="Enten er den slettet, eller også hører den til en anden sælger. Dine egne øvelser står i historikken."
        actions={
          <>
            <Link to="/historik" className="btn-primary">
              Se din historik
            </Link>
            <Link to="/" className="btn-outline">
              Til træningen
            </Link>
          </>
        }
      />
    );
  }

  const fb = session.feedback;
  const metrics = fb?.metrics ?? countMetrics(session);
  const metricsFromCount = !fb?.metrics && Boolean(metrics);

  return (
    <div className="animate-fade-up space-y-6 pb-4">
      <Header session={session} feedback={fb} />

      {/* ------------------------------------------------------ Venteposition */}
      {!fb && analysing && (
        <StepWait
          eyebrow="Vurdering"
          title="Salgsdirektøren gennemgår samtalen"
          desc={`${plural(session.transcript.length, "replik", "replikker")} · ${formatDuration(
            session.durationSec,
          )} samtale. Hele referatet bliver læst igennem frem for skimmet, så det tager typisk 10-40 sekunder.`}
          steps={ANALYSE_STEPS}
          seconds={analyseSec}
          note="Du kan blive på siden. Samtalen er allerede gemt, og vurderingen lægger sig oven på den."
        />
      )}

      {!fb && !analysing && analyseError && (
        <ErrorNote
          title="Vurderingen kunne ikke hentes"
          onRetry={() => void analyse(session)}
          retryLabel="Prøv vurderingen igen"
        >
          Samtalen er gemt, og referatet forsvinder ikke. Det er kun salgsdirektørens gennemgang,
          der mangler.
          <span className="mt-3 block text-xs text-danger-300/70">{analyseError}</span>
        </ErrorNote>
      )}

      {!fb && !analysing && !analyseError && !session.transcript.length && (
        <Notice tone="warn">
          Der blev ikke sagt noget i den her øvelse, så der er ikke noget at vurdere. Kør den igen,
          når du er klar.
        </Notice>
      )}

      {/* ----------------------------------------------------------- Vurdering */}
      {fb && (
        <>
          <div className="space-y-4">
            <VerdictBlock
              tone="brand"
              icon={Icon.Check}
              title="Det gjorde du godt"
              items={fb.didWell ?? []}
            />
            <VerdictBlock
              tone="warn"
              icon={Icon.Warn}
              title="Det holdt dig tilbage"
              items={fb.heldBack ?? []}
            />
            <VerdictBlock
              tone="danger"
              icon={Icon.Target}
              title="Det gik du glip af"
              items={fb.missed ?? []}
            />
            <VerdictBlock
              tone="client"
              icon={Icon.Handshake}
              title="Sådan ville jeg have gjort"
              items={fb.iWouldHaveDone ?? []}
            />
            <VerdictBlock
              tone="focus"
              icon={Icon.Arrow}
              title="Fokus næste gang"
              eyebrow="Det du skal tage med videre"
              items={fb.focusNextTime ?? []}
              emphasis
            />
          </div>

          <FactCheckSection feedback={fb} modeId={session.modeId} />
          <CategorySection feedback={fb} />
          <ManualSection references={fb.manualReferences} />
          <ExternalTheorySection items={fb.externalTheory} />
          <QualificationSection map={fb.qualification} />
          {metrics && (
            <MetricsSection
              metrics={metrics}
              modeId={session.modeId}
              counted={metricsFromCount}
            />
          )}
        </>
      )}

      {/* ------------------------------------------------------------ Handling */}
      <Panel as="section" className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2.5">
          <button className="btn-primary" onClick={() => void runAgain()} disabled={retrying}>
            {retrying ? <Spinner size={15} /> : <Icon.Repeat width={16} height={16} />}
            Kør øvelsen igen
          </button>
          <button
            className="btn-outline"
            onClick={() => setTranscriptOpen(true)}
            disabled={!session.transcript.length}
          >
            <Icon.Doc width={16} height={16} />
            Se hele referatet
          </button>
          <Link to="/" className="btn-ghost">
            <Icon.Back width={16} height={16} />
            Tilbage til træning
          </Link>
        </div>

        {profileUpdated && (
          <p className="flex items-center gap-2 text-xs text-ink-mute">
            <Icon.Check width={14} height={14} className="text-brand-500" />
            Din udviklingsprofil er opdateret.{" "}
            <Link to="/udvikling" className="underline decoration-base-line2 hover:text-ink">
              Se din udvikling
            </Link>
          </p>
        )}
      </Panel>

      <TranscriptModal
        open={transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        session={session}
      />
    </div>
  );
}

/* ========================================================================== */
/* Hoved                                                                       */
/* ========================================================================== */

function Header({
  session,
  feedback,
}: {
  session: TrainingSession;
  feedback?: SessionFeedback;
}) {
  const meta = [
    modeLabel(session.modeId),
    session.scenario?.title,
    formatDateTime(session.startedAt),
    formatDuration(session.durationSec),
  ].filter((x): x is string => Boolean(x));

  return (
    <Panel as="section">
      <div className="eyebrow">Debriefing</div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-soft">
        {meta.map((m, i) => (
          <span key={i} className="flex items-center gap-2.5">
            {i > 0 && <span className="text-ink-faint">·</span>}
            <span className={i === 0 ? "font-semibold text-ink" : undefined}>{m}</span>
          </span>
        ))}
      </div>

      {feedback ? (
        <>
          <div className="mt-5 flex items-center gap-3">
            <span className="eyebrow">Samlet vurdering</span>
            <RatingPill rating={feedback.overall} size="sm" />
          </div>
          <h1 className="title-xl mt-3 max-w-[44ch]">
            {feedback.headline?.trim() || `Samlet vurdering: ${ratingLabel(feedback.overall)}`}
          </h1>
          <p className="mt-4 text-xs text-ink-faint">
            Vurderet af Salgsdirektøren · {formatDateTime(feedback.generatedAt)}
          </p>
        </>
      ) : (
        <h1 className="title-xl mt-4 max-w-[30ch]">
          {session.scenario?.title || modeLabel(session.modeId)}
        </h1>
      )}
    </Panel>
  );
}

/* ========================================================================== */
/* De fem blokke                                                               */
/* ========================================================================== */

type BlockTone = "brand" | "warn" | "danger" | "client" | "focus";

const BLOCK_TONES: Record<BlockTone, { rail: string; badge: string; dot: string }> = {
  brand: {
    rail: "border-l-brand-600",
    badge: "border-brand-800 bg-brand-950 text-brand-300",
    dot: "bg-brand-500",
  },
  warn: {
    rail: "border-l-warn-600",
    badge: "border-warn-600/40 bg-warn-900 text-warn-300",
    dot: "bg-warn-500",
  },
  danger: {
    rail: "border-l-danger-600",
    badge: "border-danger-600/40 bg-danger-900 text-danger-300",
    dot: "bg-danger-500",
  },
  client: {
    rail: "border-l-client-600",
    badge: "border-client-600/40 bg-client-900 text-client-300",
    dot: "bg-client-400",
  },
  focus: {
    rail: "border-l-brand-500",
    badge: "border-brand-600 bg-brand-900 text-brand-200",
    dot: "bg-brand-400",
  },
};

function VerdictBlock({
  title,
  eyebrow,
  items,
  tone,
  icon: I,
  emphasis = false,
}: {
  title: string;
  eyebrow?: string;
  items: string[];
  tone: BlockTone;
  icon: typeof Icon.Check;
  emphasis?: boolean;
}) {
  const t = BLOCK_TONES[tone];
  return (
    <Panel
      as="section"
      className={`border-l-[3px] ${t.rail} ${emphasis ? "border-brand-800 bg-brand-950/40" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${t.badge}`}>
          <I width={16} height={16} />
        </span>
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2 className={emphasis ? "title-lg" : "title-md"}>{title}</h2>
        </div>
      </div>

      {items.length ? (
        <ul className="mt-4 max-w-[70ch] space-y-3.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />
              <CoachText text={item} className="min-w-0 flex-1" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="body-mute mt-3">Ikke noteret i denne øvelse.</p>
      )}
    </Panel>
  );
}

/* ========================================================================== */
/* Fakta vs. antagelser                                                        */
/* ========================================================================== */

function FactCheckSection({
  feedback,
  modeId,
}: {
  feedback: SessionFeedback;
  modeId: TrainingModeId;
}) {
  const fc = feedback.factCheck;
  if (!fc) return null;

  const facts = fc.facts ?? [];
  const assumptions = fc.assumptions ?? [];
  const gaps = fc.knowledgeGaps ?? [];
  if (!facts.length && !assumptions.length && !gaps.length) return null;

  const source = counterpartLabel(modeId).toLowerCase();

  return (
    <Panel as="section">
      <SectionHeader
        eyebrow="Kernen i coachingen"
        title="Fakta og antagelser"
        desc={`Et faktum er noget ${source} har sagt. Alt andet er noget du selv har lagt ind — og det er dér, sager bliver tabt.`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel-quiet border-brand-800 p-4 md:p-5">
          <div className="flex items-center gap-2.5">
            <Icon.Check width={17} height={17} className="text-brand-400" />
            <h3 className="title-md">Fakta du fik etableret</h3>
            <span className="ml-auto text-xs text-ink-mute">{facts.length}</span>
          </div>
          {facts.length ? (
            <ul className="mt-3.5 space-y-3">
              {facts.map((f, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                  <CoachText text={f} className="min-w-0 flex-1" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="body-mute mt-3">
              Du fik ikke bekræftet noget konkret. Alt herunder er derfor stadig formodninger.
            </p>
          )}
        </div>

        <div className="panel-quiet border-warn-600/40 p-4 md:p-5">
          <div className="flex items-center gap-2.5">
            <Icon.Warn width={17} height={17} className="text-warn-500" />
            <h3 className="title-md">Antagelser du bærer videre</h3>
            <span className="ml-auto text-xs text-ink-mute">{assumptions.length}</span>
          </div>
          {assumptions.length ? (
            <ul className="mt-3.5 space-y-3">
              {assumptions.map((a, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-warn-500" aria-hidden="true" />
                  <CoachText text={a} className="min-w-0 flex-1" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="body-mute mt-3">Ingen ubekræftede antagelser noteret.</p>
          )}
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="mt-4 panel-inset p-4 md:p-5">
          <div className="flex items-center gap-2.5">
            <Icon.Search width={17} height={17} className="text-ink-mute" />
            <h3 className="title-md">Det ved du stadig ikke</h3>
          </div>
          <p className="body-mute mt-1.5 max-w-[70ch]">
            Hullerne lukkes kun ét sted: hos {source}. Sådan spørger du.
          </p>
          <ul className="mt-4 space-y-3">
            {gaps.map((g, i) => (
              <li key={i} className="rounded-xl border border-base-line bg-base-panel2 p-4">
                <div className="max-w-[70ch] text-[15px] font-semibold leading-snug text-ink">
                  {g.gap}
                </div>
                <div className="mt-2.5 border-l-2 border-brand-800 pl-3">
                  <div className="eyebrow mb-1">Sådan får du det</div>
                  <CoachText text={g.howToFind} className="max-w-[70ch]" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/* ========================================================================== */
/* Kategorier                                                                  */
/* ========================================================================== */

function CategorySection({ feedback }: { feedback: SessionFeedback }) {
  const categories = (feedback.categories ?? []).filter((c) => Boolean(c?.area));
  if (!categories.length) return null;

  return (
    <Panel as="section">
      <SectionHeader
        eyebrow="Områder der blev vurderet"
        title="Sådan gjorde du det"
        desc="Kun det der faktisk var i spil i denne øvelse er vurderet."
      />

      <div className="grid gap-3.5 lg:grid-cols-2">
        {categories.map((c, i) => (
          <article key={`${c.area}-${i}`} className="panel-quiet p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="title-md">{skillAreaLabel(c.area)}</h3>
              <RatingPill rating={c.rating} size="sm" />
            </div>
            <CoachText text={c.comment} className="mt-3 max-w-[70ch]" />
            {c.evidence && (
              <figure className="mt-3.5">
                <figcaption className="eyebrow mb-1.5">Fra samtalen</figcaption>
                <blockquote className="border-l-2 border-base-line2 pl-3.5 text-[15px] italic leading-relaxed text-ink">
                  <span aria-hidden="true">»</span>
                  {c.evidence}
                  <span aria-hidden="true">«</span>
                </blockquote>
              </figure>
            )}
          </article>
        ))}
      </div>
    </Panel>
  );
}

/* ========================================================================== */
/* Salgsmanualen                                                               */
/* ========================================================================== */

const APPLIED: Record<
  ManualReference["applied"],
  { label: string; chip: string; icon: typeof Icon.Check }
> = {
  ja: { label: "Anvendt", chip: "chip-brand", icon: Icon.Check },
  delvist: { label: "Delvist anvendt", chip: "chip-warn", icon: Icon.Warn },
  nej: { label: "Ikke anvendt", chip: "chip-danger", icon: Icon.X },
};

function ManualSection({ references }: { references: ManualReference[] }) {
  const list = (references ?? []).filter((r) => Boolean(r?.title));
  if (!list.length) return null;

  return (
    <Panel as="section">
      <SectionHeader
        eyebrow="green lights salgsmanual"
        title="Principperne der var i spil"
        desc="Vurderingen hviler på manualen — ikke på en tilfældig salgsteori."
      />

      <ul className="space-y-3">
        {list.map((r, i) => {
          const a = APPLIED[r.applied] ?? APPLIED.delvist;
          const A = a.icon;
          return (
            <li key={r.id || i} className="panel-quiet p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2.5">
                <h3 className="title-md max-w-[52ch]">{r.title}</h3>
                <span className={a.chip}>
                  <A width={13} height={13} />
                  {a.label}
                </span>
              </div>
              <CoachText text={r.relevance} className="mt-2.5 max-w-[70ch]" />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ========================================================================== */
/* Ekstern teori                                                               */
/* ========================================================================== */

function ExternalTheorySection({
  items,
}: {
  items?: { framework: string; point: string; whyRelevant: string }[];
}) {
  const list = (items ?? []).filter((x) => Boolean(x?.framework));
  if (!list.length) return null;

  return (
    <section className="rounded-2xl border border-dashed border-client-600/50 bg-client-900/25 p-5 md:p-6">
      <div className="flex items-center gap-2.5">
        <Icon.Book width={18} height={18} className="text-client-300" />
        <h2 className="title-md text-client-200">Uden for salgsmanualen</h2>
      </div>
      <p className="body-mute mt-1.5 max-w-[70ch]">
        Det følgende er ekstern salgsteori og står ikke i green lights egen manual. Det siges højt,
        så du selv kan vurdere, om du vil bruge det.
      </p>

      <ul className="mt-4 space-y-3">
        {list.map((x, i) => (
          <li key={i} className="rounded-xl border border-client-600/30 bg-base-panel/70 p-4">
            <h3 className="title-md">{x.framework}</h3>
            <CoachText text={x.point} className="mt-2 max-w-[70ch]" />
            <div className="mt-2.5 border-l-2 border-client-600/50 pl-3">
              <div className="eyebrow mb-1">Derfor er det relevant her</div>
              <CoachText text={x.whyRelevant} className="max-w-[70ch]" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ========================================================================== */
/* Kvalificeringskortet                                                        */
/* ========================================================================== */

const QUALIFICATION_CELLS: {
  key: keyof Omit<QualificationMap, "whatMustBeTrue">;
  label: string;
  desc: string;
  icon: typeof Icon.Check;
  accent: string;
  dot: string;
}[] = [
  {
    key: "known",
    label: "KENDT",
    desc: "Bekræftet af kunden",
    icon: Icon.Check,
    accent: "border-brand-800",
    dot: "bg-brand-500",
  },
  {
    key: "unknown",
    label: "UKENDT",
    desc: "Endnu ikke afdækket",
    icon: Icon.Search,
    accent: "border-base-line2",
    dot: "bg-ink-mute",
  },
  {
    key: "assumed",
    label: "ANTAGET",
    desc: "Tror — ved ikke",
    icon: Icon.Warn,
    accent: "border-warn-600/40",
    dot: "bg-warn-500",
  },
  {
    key: "risks",
    label: "RISIKO",
    desc: "Kan vælte sagen",
    icon: Icon.Shield,
    accent: "border-danger-600/40",
    dot: "bg-danger-500",
  },
  {
    key: "strengths",
    label: "STYRKE",
    desc: "Det du står stærkt på",
    icon: Icon.Spark,
    accent: "border-brand-800",
    dot: "bg-brand-400",
  },
  {
    key: "nextInformation",
    label: "NÆSTE INFORMATION",
    desc: "Det du skal have fat i nu",
    icon: Icon.Target,
    accent: "border-client-600/40",
    dot: "bg-client-400",
  },
];

function QualificationSection({ map }: { map?: QualificationMap }) {
  if (!map) return null;

  const mustBeTrue = map.whatMustBeTrue ?? [];

  return (
    <Panel as="section">
      <SectionHeader
        eyebrow="Kvalificering"
        title="Hvor står sagen"
        desc="Kortet er en status, ikke en dom. Det viser hvad der er på plads, og hvad der mangler."
      />

      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {QUALIFICATION_CELLS.map((cell) => {
          const values = map[cell.key] ?? [];
          const C = cell.icon;
          return (
            <div key={cell.key} className={`panel-quiet p-4 ${cell.accent}`}>
              <div className="flex items-center gap-2">
                <C width={15} height={15} className="text-ink-mute" />
                <h3 className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink">
                  {cell.label}
                </h3>
                <span className="ml-auto text-xs text-ink-faint">{values.length}</span>
              </div>
              <div className="mt-0.5 text-xs text-ink-mute">{cell.desc}</div>

              {values.length ? (
                <ul className="mt-3 space-y-2">
                  {values.map((v, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                      <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${cell.dot}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">{v}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-faint">Intet noteret.</p>
              )}
            </div>
          );
        })}
      </div>

      {mustBeTrue.length > 0 && (
        <div className="mt-5 rounded-2xl border border-brand-800 bg-brand-950/40 p-5">
          <h3 className="title-md">Det skal være sandt, før det er en god sag</h3>
          <p className="body-mute mt-1.5 max-w-[70ch]">
            Ikke en vurdering af om sagen er god eller dårlig — men de forudsætninger, du skal have
            bekræftet, før den er det.
          </p>
          <ul className="mt-4 max-w-[70ch] space-y-3">
            {mustBeTrue.map((m, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-brand-800 bg-brand-950 text-2xs font-bold text-brand-300">
                  {i + 1}
                </span>
                <CoachText text={m} className="min-w-0 flex-1" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/* ========================================================================== */
/* Tal fra samtalen                                                            */
/* ========================================================================== */

function MetricsSection({
  metrics,
  modeId,
  counted,
}: {
  metrics: ConversationMetrics;
  modeId: TrainingModeId;
  counted: boolean;
}) {
  const other = counterpartLabel(modeId);
  const ratio = clamp01(metrics.sellerTalkRatio);
  const questions = Math.max(0, metrics.questionsAsked);

  return (
    <Panel as="section">
      <SectionHeader
        eyebrow="Tal fra samtalen"
        title="Taletid og spørgsmål"
        desc="Observationer, ikke en karakter. Tallene siger noget om adfærd — ikke om hvor dygtig du er."
      />

      <div className="panel-quiet p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-ink">
            Dig <span className="font-bold">{formatPercent(ratio)}</span>
          </span>
          <span className="text-sm text-ink-soft">
            {other} <span className="font-bold text-ink">{formatPercent(1 - ratio)}</span>
          </span>
        </div>
        <div className="mt-2.5">
          <Bar value={ratio} max={1} tone={ratio > 0.55 ? "warn" : "brand"} />
        </div>
        <div className="mt-2 text-xs text-ink-mute">
          {formatNumber(metrics.sellerWords)} ord fra dig mod {formatNumber(metrics.counterpartWords)}{" "}
          ord fra {other.toLowerCase()}
        </div>
      </div>

      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Spørgsmål i alt" value={formatNumber(questions)} sub="Stillet af dig" />
        <MetricWithBar
          label="Åbne spørgsmål"
          value={formatNumber(metrics.openQuestions)}
          ratio={questions ? metrics.openQuestions / questions : 0}
          sub={questions ? `af ${formatNumber(questions)} spørgsmål` : "Ingen spørgsmål stillet"}
          tone="brand"
        />
        <MetricWithBar
          label="Konsekvensspørgsmål"
          value={formatNumber(metrics.consequenceQuestions)}
          ratio={questions ? metrics.consequenceQuestions / questions : 0}
          sub={
            metrics.consequenceQuestions === 0
              ? "Ingen — problemet blev aldrig sat i kroner eller drift"
              : `af ${formatNumber(questions)} spørgsmål`
          }
          tone={metrics.consequenceQuestions === 0 ? "warn" : "brand"}
        />
        <Stat
          label="Længste monolog"
          value={formatClock(metrics.longestMonologueSec)}
          sub="Din længste passage i træk"
        />
      </div>

      <p className="body mt-4 max-w-[70ch]">{metricsNote(metrics, other)}</p>

      {counted && (
        <p className="mt-2 text-xs text-ink-faint">Tallene er talt op ud fra referatet.</p>
      )}
    </Panel>
  );
}

function MetricWithBar({
  label,
  value,
  sub,
  ratio,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  ratio: number;
  tone: "brand" | "warn" | "client";
}) {
  return (
    <div className="panel-quiet p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-ink">{value}</div>
      <div className="mt-2.5">
        <Bar value={clamp01(ratio)} max={1} tone={tone} />
      </div>
      {sub && <div className="mt-1.5 text-xs text-ink-mute">{sub}</div>}
    </div>
  );
}

/** Én linje fortolkning. Taletiden er det tal sælgere reelt ændrer adfærd på. */
function metricsNote(m: ConversationMetrics, other: string): string {
  const ratio = clamp01(m.sellerTalkRatio);
  const who = other.toLowerCase();

  const talk =
    ratio > 0.6
      ? `Du fyldte klart mest i samtalen. Så længe du taler, får du ingen nye oplysninger — og du fylder selv hullerne ud, i stedet for at lade ${who} gøre det.`
      : ratio > 0.45
        ? `Taletiden var nogenlunde delt. Det er brugbart i en præsentation, men i en afdækning bør ${who} fylde mest.`
        : `${other} talte mest. Det er sådan en afdækning skal se ud — du spurgte, og der blev svaret.`;

  if (m.questionsAsked > 0 && m.consequenceQuestions === 0) {
    return `${talk} Du stillede ${formatNumber(m.questionsAsked)} spørgsmål, men ingen af dem gik på konsekvensen af problemet.`;
  }
  if (m.longestMonologueSec >= 90) {
    return `${talk} Din længste passage varede ${formatClock(m.longestMonologueSec)} — dér mistede du kontakten til, hvad ${who} tænkte.`;
  }
  return talk;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/* ========================================================================== */
/* Referat                                                                     */
/* ========================================================================== */

const SPEAKER: Record<SpeakerRole, { label: string; chip: string; rail: string }> = {
  saelger: { label: "Dig", chip: "chip-brand", rail: "border-l-brand-600" },
  kunde: { label: "Kunden", chip: "chip-client", rail: "border-l-client-500" },
  coach: { label: "Salgsdirektøren", chip: "chip-brand", rail: "border-l-brand-800" },
  system: { label: "Note", chip: "chip", rail: "border-l-base-line2" },
};

function TranscriptModal({
  open,
  onClose,
  session,
}: {
  open: boolean;
  onClose: () => void;
  session: TrainingSession;
}) {
  const lines = session.transcript.filter((u) => !u.partial && u.text.trim());
  const personaName = session.scenario?.persona?.name;

  return (
    <Modal open={open} onClose={onClose} title="Hele referatet" wide>
      <p className="body-mute mb-4">
        {modeLabel(session.modeId)}
        {session.scenario?.title ? ` · ${session.scenario.title}` : ""} ·{" "}
        {formatDuration(session.durationSec)}
      </p>

      {lines.length ? (
        <ol className="space-y-4">
          {lines.map((u) => (
            <TranscriptLine key={u.id} utterance={u} personaName={personaName} />
          ))}
        </ol>
      ) : (
        <p className="body-mute">Der er ikke gemt noget referat for den her øvelse.</p>
      )}
    </Modal>
  );
}

function TranscriptLine({
  utterance,
  personaName,
}: {
  utterance: Utterance;
  personaName?: string;
}) {
  const s = SPEAKER[utterance.role] ?? SPEAKER.system;
  const label =
    utterance.role === "kunde" && personaName ? `${s.label} · ${personaName}` : s.label;

  if (utterance.role === "system") {
    return (
      <li className="text-center text-xs italic text-ink-faint">{utterance.text}</li>
    );
  }

  return (
    <li className={`border-l-2 pl-4 ${s.rail}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={s.chip}>{label}</span>
        <span className="text-2xs text-ink-faint">{formatClock(utterance.at / 1000)}</span>
      </div>
      <p className="mt-1.5 max-w-[70ch] text-[15px] leading-relaxed text-ink-soft">
        {utterance.text}
      </p>
    </li>
  );
}

/* ========================================================================== */
/* Optælling                                                                   */
/* ========================================================================== */

const WORDS = /[\p{L}\p{N}'’-]+/gu;
/** Åbne spørgsmål: dem der ikke kan besvares med ja eller nej. */
const OPEN_MARKERS =
  /\b(hvad|hvordan|hvorfor|hvilke|hvilken|hvilket|hvem|hvornår|hvor meget|hvor mange|fortæl|beskriv|uddyb)\b/i;
/** Konsekvensspørgsmål: dem der sætter problemet i kroner, tid eller drift. */
const CONSEQUENCE_MARKERS =
  /\b(konsekvens\w*|betyder det|hvad betyder|koster|omkostning\w*|risik\w*|går tabt|påvirker|effekt\w*|hvis I ikke|hvis ikke|hvad sker der|går ud over|følger)\b/i;

function wordCount(text: string): number {
  return (text.match(WORDS) ?? []).length;
}

function questionSentences(text: string): string[] {
  return (text.match(/[^.!?]*\?/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

/**
 * Hårde tal fra referatet. Bevidst konservativt: ord og spørgsmålstegn kan
 * tælles præcist, mens "åben" og "konsekvens" er sproglige skøn — derfor
 * præsenteres tallene som observationer og aldrig som en score.
 */
export function countMetrics(session: TrainingSession): ConversationMetrics | undefined {
  const lines = session.transcript.filter(
    (u) => !u.partial && u.role !== "system" && u.text.trim(),
  );
  if (lines.length < 2) return undefined;

  let sellerWords = 0;
  let counterpartWords = 0;
  let questionsAsked = 0;
  let openQuestions = 0;
  let consequenceQuestions = 0;

  for (const u of lines) {
    const words = wordCount(u.text);
    if (u.role === "saelger") {
      sellerWords += words;
      for (const q of questionSentences(u.text)) {
        questionsAsked += 1;
        if (OPEN_MARKERS.test(q)) openQuestions += 1;
        if (CONSEQUENCE_MARKERS.test(q)) consequenceQuestions += 1;
      }
    } else {
      counterpartWords += words;
    }
  }

  const total = sellerWords + counterpartWords;
  if (!total) return undefined;

  // Længste sammenhængende passage fra sælgeren. Med tidsstempler måler vi;
  // uden dem skønner vi ud fra taletempo (~2,4 ord i sekundet).
  const timed = lines.some((u) => u.at > 0);
  let longest = 0;
  let runStart: number | null = null;
  let runWords = 0;

  for (let i = 0; i < lines.length; i++) {
    const u = lines[i];
    if (u.role !== "saelger") continue;
    if (runStart === null) {
      runStart = u.at;
      runWords = 0;
    }
    runWords += wordCount(u.text);

    const next = lines[i + 1];
    if (!next || next.role !== "saelger") {
      const measured = timed && next ? (next.at - runStart) / 1000 : 0;
      longest = Math.max(longest, measured > 0 ? measured : runWords / 2.4);
      runStart = null;
    }
  }

  return {
    sellerWords,
    counterpartWords,
    sellerTalkRatio: sellerWords / total,
    questionsAsked,
    openQuestions,
    consequenceQuestions,
    longestMonologueSec: Math.round(longest),
  };
}
