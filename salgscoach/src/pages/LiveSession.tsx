// =============================================================================
// pages/LiveSession · Selve samtalen
// -----------------------------------------------------------------------------
// Dette er produktets vigtigste skærm, og den er bevidst næsten tom.
//
// Under en øvelse skal sælgeren SÆLGE — ikke betjene en app. Derfor er der kun
// tre lag på skærmen:
//
//   1. Toplinjen   – tid, øvelse, tilstand. Aflæses med et blik, aldrig læst.
//   2. Scenen      – orben, navnet og den ene sætning der bliver sagt lige nu.
//   3. Betjeningen – de fem ting man kan gøre med en samtale, nederst.
//
// Alt andet (referat, tekstfelt, indstillinger) er foldet væk. Referatet er
// LUKKET som standard: begynder man at læse, holder man op med at tale.
//
// Skjulte oplysninger: sessionens `hiddenBlob` er forseglet af serveren og
// sendes uændret videre. Den bliver aldrig vist, aldrig logget, aldrig åbnet.
// Rollespillet er kun noget værd, så længe sælgeren skal grave oplysningerne
// frem med spørgsmål.
// =============================================================================

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { api, buildSellerContext } from "../lib/api";
import { getProfile, getSession, saveSession } from "../lib/store";

import { useVoiceSession } from "../voice/useVoiceSession";
import type { VoiceState } from "../voice/realtime";
import {
  LiveCaption,
  ModeBadge,
  TranscriptRail,
  VoiceOrb,
  formatClock,
  type StageSpeaker,
} from "../ui/VoiceStage";
import { Icon } from "../ui/icons";
import { Avatar, CoachText, Modal, Panel, Skel, Spinner, StepWait } from "../ui/primitives";

import type {
  CoachMode,
  Difficulty,
  Scenario,
  Seller,
  SellerProfile,
  SpeakerRole,
  TrainingModeId,
  TrainingSession,
  Utterance,
  VoiceEngine,
} from "../lib/types";

/* ============================================================== Konstanter */

/** Titler bruges kun til visning her; øvelsesregistret bor et andet sted. */
const MODE_TITLE: Record<TrainingModeId, string> = {
  kunderollespil: "Kunderollespil",
  afdaekning: "Afdækning",
  indvendinger: "Indvendinger",
  salgsmoede: "Salgsmøde",
  telefon: "Telefonopkald",
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

/** Øvelser hvor modparten ER salgsdirektøren — samme liste som i stemmehooken. */
const COACH_LED: readonly TrainingModeId[] = [
  "kvalificering",
  "forberedelse",
  "debriefing",
  "lynild",
  "manualeksamen",
  "fri-coaching",
];

/** Hvad salgsdirektøren gør i de øvelser, der ikke har et scenarie. */
const MODE_INTENT: Partial<Record<TrainingModeId, string>> = {
  kvalificering:
    "Salgsdirektøren gennemgår din opportunity og skiller det, du VED, fra det, du antager. Regn med at blive spurgt om, hvad der skal være sandt, før den er kvalificeret.",
  forberedelse:
    "Salgsdirektøren forbereder mødet sammen med dig: hvad er målet, hvilke spørgsmål skal stilles, og hvad mangler du at vide før du går ind.",
  debriefing:
    "Salgsdirektøren spørger ind til mødet, du lige har haft, indtil det står klart hvad der reelt skete — ikke hvad du håber der skete.",
  lynild:
    "Salgsdirektøren fyrer korte spørgsmål af i højt tempo. Svar kort, og lad være med at pynte.",
  manualeksamen:
    "Salgsdirektøren eksaminerer dig i salgsmanualen og beder dig anvende principperne på konkrete situationer.",
  "fri-coaching":
    "Salgsdirektøren tager fat i det, du selv bringer op. Sig hvad du gerne vil have hjælp til.",
};

/** Øvelser hvor tempoet er en del af pointen. */
const FAST_MODES: readonly TrainingModeId[] = ["telefon", "lynild"];

const ENGINE_LABEL: Record<VoiceEngine, string> = {
  realtime: "Realtime-stemme",
  browser: "Reservestemme",
  tekst: "Skriftlig",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  moderat: "Moderat",
  haard: "Hård",
  braendende: "Brændende platform",
};

/** Under denne længde spørger vi, før vi afslutter. En fejlklikket øvelse er tabt. */
const KORT_OEVELSE_SEK = 60;

/** Hvad salgsdirektøren laver, mens sælgeren venter på feedbacken. */
const ANALYSE_STEPS: readonly { at: number; text: string }[] = [
  { at: 0, text: "Læser hele samtalen igennem" },
  { at: 6, text: "Skiller fakta fra antagelser" },
  { at: 14, text: "Vurderer spørgsmål, lytning og taletid" },
  { at: 23, text: "Holder samtalen op mod salgsmanualen" },
  { at: 32, text: "Skriver feedbacken og dit næste fokus" },
];

const ORB_WIDE = 196;
const ORB_NARROW = 140;

/* ============================================================== Skærmens faser
 *
 *   indlaeser → briefing → samtale → afslutter → analyserer → (debriefing)
 *                   ↑          ↓
 *                   └────── tynd (for lidt samtale til en analyse)
 *
 * Fejl er ikke en fase for sig: en fejl før start vises i briefingen, og en
 * fejl undervejs lægger sig som et lag OVEN PÅ samtalen, så sælgeren kan se
 * hvad der skete med det, der allerede er sagt.
 */
type Phase = "indlaeser" | "briefing" | "samtale" | "afslutter" | "analyserer" | "tynd";

/**
 * Felter serveren har brug for, men som datamodellen endnu ikke navngiver.
 * `hiddenBlob` sættes af TrainingSetup med præcis samme udvidelse — den er
 * forseglet af serveren og sendes uændret videre til stemme og analyse.
 */
type SessionExtras = TrainingSession & { hiddenBlob?: string; documentText?: string };

/* ================================================================ Skærmen */

export function LiveSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { seller } = useAuth();

  const voice = useVoiceSession();
  const { state, engine, engineNotice, transcript, live, micLevel, remoteLevel, elapsedSec } = voice;

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [phase, setPhase] = useState<Phase>("indlaeser");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisSec, setAnalysisSec] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [confirm, setConfirm] = useState<null | "kort" | "forlad">(null);
  const wide = useIsWide();

  /* Refs, fordi de asynkrone forløb (start, afslut, analyse) skal se den
     nyeste sandhed — ikke den de blev lukket om. */
  const sessionRef = useRef<TrainingSession | null>(null);
  const profileRef = useRef<SellerProfile | null>(null);
  const sellerRef = useRef<Seller | null>(null);
  const startedAtRef = useRef(0);
  const endingRef = useRef(false);
  const runningRef = useRef(false);
  const voiceRef = useRef(voice);

  sessionRef.current = session;
  profileRef.current = profile;
  sellerRef.current = seller;
  voiceRef.current = voice;
  runningRef.current = phase === "samtale" && state !== "afsluttet" && state !== "fejl";

  /* ------------------------------------------------------------ Indlæsning */

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!sessionId) {
        setLoadError("Øvelsen mangler et id. Gå tilbage og start øvelsen forfra.");
        setPhase("briefing");
        return;
      }
      try {
        const found = await getSession(sessionId);
        if (cancelled) return;
        if (!found) {
          setLoadError(
            "Der ligger ingen øvelse på det link. Den kan være afsluttet, slettet, eller høre til en anden konto. Dine egne øvelser står i historikken.",
          );
          setPhase("briefing");
          return;
        }
        // En gennemført øvelse skal ikke kunne startes forfra ovenpå sig selv.
        if (found.status === "afsluttet" || found.status === "analyseret") {
          navigate(`/debriefing/${found.id}`, { replace: true });
          return;
        }
        setSession(found);
        setPhase("briefing");
      } catch (e) {
        if (cancelled) return;
        setLoadError(messageOf(e, "Øvelsen kunne ikke hentes."));
        setPhase("briefing");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  /* Udviklingsprofilen gør coachen konkret. Den må aldrig blokere øvelsen. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await getProfile();
        if (!cancelled && p) setProfile(p);
      } catch {
        /* uden profil coacher salgsdirektøren bare uden hukommelse */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------- Sikkerhed omkring livet */

  /* Luk aldrig fanen med en åben mikrofon uden at spørge. */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!runningRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /* Forlader man skærmen på anden vis, lukkes forbindelsen alligevel. */
  useEffect(() => {
    return () => {
      if (runningRef.current) void voiceRef.current.end();
    };
  }, []);

  /*
   * Løbende sikring af samtalen. Uden den lever referatet kun i hukommelsen,
   * indtil øvelsen afsluttes — et lukket faneblad, en flad telefon eller et
   * browserkrak, og alt det sagte er væk. Vi gemmer derfor stille et par
   * sekunder efter hver ny replik. Den endelige version skrives stadig af
   * finish(), så det her aldrig kan komme til at overhale afslutningen.
   */
  useEffect(() => {
    if (phase !== "samtale" || endingRef.current || transcript.length === 0) return;
    const timer = window.setTimeout(() => {
      const s = sessionRef.current;
      if (!s || endingRef.current) return;
      void saveSession({
        ...s,
        status: "aktiv",
        transcript,
        durationSec: elapsedOf(startedAtRef.current, voiceRef.current.elapsedSec),
      }).catch(() => {
        /* et mislykket mellemgem må aldrig forstyrre samtalen */
      });
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [transcript, phase]);

  /* Uret under analysen — kun mens vi venter, og kun ét sekund ad gangen. */
  useEffect(() => {
    if (phase !== "analyserer" || analysisError) return;
    const t = window.setInterval(() => setAnalysisSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase, analysisError]);

  /* ------------------------------------------------------------- Afledt data */

  const coachLed = session ? COACH_LED.includes(session.modeId) : false;
  const scenario: Scenario | undefined = session?.scenario;
  const counterpartSpeaker: StageSpeaker = coachLed ? "coach" : "kunde";
  const counterpartName = coachLed
    ? "Salgsdirektøren"
    : scenario?.persona.name || "Kunden";
  const counterpartSub = coachLed
    ? "green light · salgsledelse"
    : [scenario?.persona.role, scenario?.persona.company].filter(Boolean).join(" · ");
  const counterpartRole: SpeakerRole = coachLed ? "coach" : "kunde";
  const modeTitle = session ? MODE_TITLE[session.modeId] : "Øvelse";

  /* Motoren når at hente en nøgle, før den melder "forbinder". Uden dette skub
     ville orben stå og sige "Klar" midt i en opstart. */
  const connecting =
    voice.starting && state !== "lytter" && state !== "taler" && state !== "taenker";
  const stageState: VoiceState = connecting ? "forbinder" : state;

  /** Hvem er hvem i referatet og i underteksten. */
  const speakerLabel: Record<SpeakerRole, string> = useMemo(
    () => ({
      saelger: "Dig",
      kunde: coachLed ? "Kunden" : counterpartName,
      coach: "Salgsdirektøren",
      system: "Noteret",
    }),
    [coachLed, counterpartName],
  );

  const announcement = useMemo(
    () => announce(stageState, counterpartName, voice.error),
    [stageState, counterpartName, voice.error],
  );

  /** Undertekst: det der siges NU, ellers den sidste hele replik. */
  const caption = useMemo(() => {
    if (live && live.text) {
      const role: SpeakerRole = live.speaker === "saelger" ? "saelger" : counterpartRole;
      return { role, name: speakerLabel[role], text: live.text, partial: true };
    }
    for (let i = transcript.length - 1; i >= 0; i--) {
      const u = transcript[i];
      if (u.role === "system" || !u.text.trim()) continue;
      return { role: u.role, name: speakerLabel[u.role], text: u.text, partial: false };
    }
    return null;
  }, [live, transcript, speakerLabel, counterpartRole]);

  /* ------------------------------------------------------------------ Start */

  const handleStart = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    const ext = s as SessionExtras;

    setLoadError(null);
    setPhase("samtale");
    startedAtRef.current = Date.now();
    endingRef.current = false;

    // Markér øvelsen som i gang, så en afbrudt session ikke ligner en kladde.
    const started: TrainingSession = {
      ...s,
      status: "aktiv",
      startedAt: new Date(startedAtRef.current).toISOString(),
    };
    setSession(started);
    try {
      await saveSession(started);
    } catch {
      /* kan ikke gemmes nu — samtalen er vigtigere end statusfeltet */
    }

    try {
      await voiceRef.current.start({
        modeId: s.modeId,
        coachMode: s.coachMode,
        language: s.language,
        scenario: s.scenario,
        hiddenBlob: ext.hiddenBlob,
        intake: s.intake,
        documentText: ext.documentText,
        sellerContext: buildSellerContext(profileRef.current, sellerRef.current),
        voice: s.scenario?.persona.voice,
        eagerness: FAST_MODES.includes(s.modeId) ? "high" : "auto",
      });
    } catch {
      /* hooken har allerede sat en læsbar fejl — den vises på scenen */
    }
  }, []);

  /* --------------------------------------------------------------- Afslutning */

  const runAnalysis = useCallback(
    async (ended: TrainingSession) => {
      const ext = ended as SessionExtras;
      setAnalysisError(null);
      setAnalysisSec(0);
      setPhase("analyserer");

      try {
        const { feedback } = await api.analyseSession({
          modeId: ended.modeId,
          coachMode: ended.coachMode,
          language: ended.language,
          scenario: ended.scenario,
          hiddenBlob: ext.hiddenBlob,
          messages: ended.transcript,
          sellerContext: buildSellerContext(profileRef.current, sellerRef.current),
          intake: ended.intake,
          documentText: ext.documentText,
          durationSec: ended.durationSec,
        });

        const analysed: TrainingSession = {
          ...ended,
          status: "analyseret",
          feedback,
          summary: feedback.headline || ended.summary,
          developmentFocus: (feedback.focusNextTime ?? []).slice(0, 2),
        };
        setSession(analysed);
        try {
          await saveSession(analysed);
        } catch {
          /* feedbacken vises alligevel — debriefingen henter fra samme objekt */
        }
        navigate(`/debriefing/${analysed.id}`, { replace: true });
      } catch (e) {
        // Samtalen er allerede gemt. Sælgeren mister ingenting her.
        setAnalysisError(messageOf(e, "Feedbacken kunne ikke laves lige nu."));
      }
    },
    [navigate],
  );

  const finish = useCallback(
    async (opts: { force?: boolean } = {}) => {
      const s = sessionRef.current;
      if (!s || endingRef.current) return;

      const seconds = elapsedOf(startedAtRef.current, voiceRef.current.elapsedSec);
      if (!opts.force && seconds < KORT_OEVELSE_SEK) {
        setConfirm("kort");
        return;
      }

      endingRef.current = true;
      setConfirm(null);
      setPhase("afslutter");

      const lines = await voiceRef.current.end();
      const ended: TrainingSession = {
        ...s,
        status: "afsluttet",
        endedAt: new Date().toISOString(),
        durationSec: seconds,
        transcript: lines,
        voiceEngine: voiceRef.current.engine ?? s.voiceEngine,
      };
      setSession(ended);

      try {
        await saveSession(ended);
      } catch {
        /* gemt lokalt eller ej — vi går videre med samtalen i hånden */
      }

      // En tom samtale skal ikke sendes til analyse. Sig det i stedet.
      if (isTooThin(lines)) {
        setPhase("tynd");
        return;
      }
      await runAnalysis(ended);
    },
    [runAnalysis],
  );

  /** Forlad øvelsen uden analyse — men gem altid det, der blev sagt. */
  const abandon = useCallback(async () => {
    const s = sessionRef.current;
    endingRef.current = true;
    setConfirm(null);
    const lines = await voiceRef.current.end();
    if (s && lines.length) {
      try {
        await saveSession({
          ...s,
          status: "afsluttet",
          endedAt: new Date().toISOString(),
          durationSec: elapsedOf(startedAtRef.current, voiceRef.current.elapsedSec),
          transcript: lines,
          voiceEngine: voiceRef.current.engine ?? s.voiceEngine,
        });
      } catch {
        /* ingenting at gøre — vi forlader alligevel */
      }
    }
    navigate("/", { replace: true });
  }, [navigate]);

  const leave = useCallback(() => {
    if (runningRef.current) {
      setConfirm("forlad");
      return;
    }
    navigate("/");
  }, [navigate]);

  /** Efter en start der aldrig kom i gang: tilbage til briefingen, ikke ud af appen. */
  const backToBriefing = useCallback(async () => {
    endingRef.current = true;
    await voiceRef.current.end();
    endingRef.current = false;
    setPhase("briefing");
  }, []);

  /* Uden talegenkendelse er skrivefeltet den eneste vej ind i samtalen. */
  useEffect(() => {
    if (engine === "tekst") setShowTextInput(true);
  }, [engine]);

  /* ------------------------------------------------------------ Betjening */

  const onMute = useCallback(() => voiceRef.current.toggleMute(), []);
  const onPause = useCallback(() => voiceRef.current.pause(), []);
  const onResume = useCallback(() => voiceRef.current.resume(), []);
  const onInterrupt = useCallback(() => voiceRef.current.interrupt(), []);
  const onCoaching = useCallback(() => voiceRef.current.requestCoaching(), []);
  const onEnd = useCallback(() => void finish(), [finish]);
  const onSendText = useCallback((text: string) => voiceRef.current.sendText(text), []);
  const onToggleText = useCallback(() => setShowTextInput((v) => !v), []);
  const onToggleTranscript = useCallback(() => setShowTranscript((v) => !v), []);
  const onCloseTranscript = useCallback(() => setShowTranscript(false), []);

  /* ================================================================ Render */

  if (phase === "indlaeser") {
    return (
      <div className="flex h-[100dvh] flex-col bg-base" role="status" aria-label="Henter øvelsen">
        <div className="safe-t border-b border-base-line">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 py-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-800 bg-brand-950 text-sm font-bold text-brand-400">
              gl
            </span>
            <span className="text-sm font-bold tracking-tight">
              green light <span className="text-brand-400">Salgscoach</span>
            </span>
            <span className="ml-auto flex items-center gap-2.5 text-xs text-ink-mute">
              <Spinner size={14} />
              Henter øvelsen
            </span>
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10" aria-hidden="true">
          <Skel w={96} h={11} />
          <div className="mt-3">
            <Skel w="62%" h={30} />
          </div>
          <div className="mt-4 space-y-2">
            <Skel w="88%" h={11} />
            <Skel w="54%" h={11} />
          </div>
          <div className="panel mt-8 space-y-3 p-5">
            <Skel w={112} h={10} />
            <Skel w="70%" h={14} />
            <Skel w="94%" h={10} />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <FullScreenMessage
        title="Øvelsen kunne ikke åbnes"
        body={
          loadError ??
          "Der ligger ingen øvelse på det link. Den kan være afsluttet, slettet, eller høre til en anden konto."
        }
        primary={{ label: "Vælg en øvelse", onClick: () => navigate("/", { replace: true }) }}
        secondary={{ label: "Se din historik", onClick: () => navigate("/historik", { replace: true }) }}
      />
    );
  }

  const showStage = phase === "samtale" || phase === "afslutter";
  const canCoach = session.coachMode !== "realistisk";

  const failed = !connecting && !endingRef.current && (state === "fejl" || state === "afsluttet");

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-base text-ink">
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <TopBar
        elapsedSec={showStage ? elapsedSec : 0}
        modeTitle={modeTitle}
        coachMode={session.coachMode}
        engine={engine}
        engineNotice={engineNotice}
        showClock={showStage}
        transcriptOpen={showTranscript}
        onToggleTranscript={onToggleTranscript}
        showTranscriptToggle={showStage || phase === "tynd"}
        onLeave={leave}
      />

      <main className="relative flex-1 overflow-y-auto">
        {phase === "briefing" && (
          <Briefing
            session={session}
            coachLed={coachLed}
            modeTitle={modeTitle}
            counterpartName={counterpartName}
            counterpartSub={counterpartSub}
            loadError={loadError}
            starting={voice.starting}
            onStart={() => void handleStart()}
            savedLines={session.transcript.filter((u) => u.role !== "system" && u.text.trim()).length}
            onFeedbackOnSaved={() => navigate(`/debriefing/${session.id}`)}
          />
        )}

        {showStage && (
          <Stage
            state={stageState}
            speaker={counterpartSpeaker}
            name={counterpartName}
            sub={counterpartSub}
            micLevel={micLevel}
            remoteLevel={remoteLevel}
            size={wide ? ORB_WIDE : ORB_NARROW}
            caption={caption}
            ending={phase === "afslutter"}
          />
        )}

        {phase === "analyserer" && (
          <Analysing
            seconds={analysisSec}
            error={analysisError}
            lines={session.transcript.length}
            durationSec={session.durationSec}
            onRetry={() => void runAnalysis(session)}
            onSkip={() => navigate(`/debriefing/${session.id}`, { replace: true })}
          />
        )}

        {phase === "tynd" && (
          <FullScreenMessage
            inline
            title="Der er ikke nok samtale til en analyse"
            body="Øvelsen blev afsluttet, før der var noget at give feedback på. Samtalen er gemt, som den var, men salgsdirektøren får ikke noget ud af den. Prøv igen — og lad kunden svare et par gange, før du afslutter."
            primary={{ label: "Start øvelsen forfra", onClick: () => void handleStart() }}
            secondary={{ label: "Tilbage til forsiden", onClick: () => navigate("/", { replace: true }) }}
          />
        )}

        {/* Fejl midt i en samtale lægger sig OVEN PÅ scenen — det der allerede
            er sagt, må ikke forsvinde for øjnene af sælgeren. */}
        {showStage && failed && (
          <VoiceFailure
            message={describeVoiceError(voice.error, state)}
            hasConversation={transcript.length > 0}
            onRetry={() => void handleStart()}
            onFinish={() => void finish({ force: true })}
            onBack={() => void backToBriefing()}
            onLeave={() => void abandon()}
          />
        )}
      </main>

      {showStage && (
        <Controls
          state={stageState}
          engine={engine}
          muted={voice.muted}
          coachMode={session.coachMode}
          canCoach={canCoach}
          busy={phase === "afslutter"}
          connecting={connecting}
          textOpen={showTextInput}
          onMute={onMute}
          onPause={onPause}
          onResume={onResume}
          onInterrupt={onInterrupt}
          onCoaching={onCoaching}
          onEnd={onEnd}
          onToggleText={onToggleText}
          onSendText={onSendText}
        />
      )}

      <TranscriptSheet
        open={showTranscript}
        lines={transcript}
        labels={speakerLabel}
        onClose={onCloseTranscript}
      />

      <Modal
        open={confirm === "kort"}
        onClose={() => setConfirm(null)}
        title="Afslut øvelsen allerede nu?"
      >
        <p className="body">
          Samtalen har kun kørt {formatClock(elapsedSec)}. Der er sjældent nok til en brugbar
          feedback så tidligt — og øvelsen kan ikke genoptages, når den først er afsluttet.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button className="btn-outline" onClick={() => setConfirm(null)}>
            Fortsæt samtalen
          </button>
          <button className="btn-danger" onClick={() => void finish({ force: true })}>
            Afslut alligevel
          </button>
        </div>
      </Modal>

      <Modal open={confirm === "forlad"} onClose={() => setConfirm(null)} title="Øvelsen kører stadig">
        <p className="body">
          Forlader du siden nu, bliver samtalen afbrudt og ikke analyseret. Det, der allerede er
          sagt, bliver gemt — men du får ingen feedback på det.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button className="btn-outline" onClick={() => setConfirm(null)}>
            Bliv i øvelsen
          </button>
          <button className="btn-danger" onClick={() => void abandon()}>
            Afbryd øvelsen
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================ Toplinjen */

const TopBar = memo(function TopBar({
  elapsedSec,
  modeTitle,
  coachMode,
  engine,
  engineNotice,
  showClock,
  transcriptOpen,
  showTranscriptToggle,
  onToggleTranscript,
  onLeave,
}: {
  elapsedSec: number;
  modeTitle: string;
  coachMode: CoachMode;
  engine: VoiceEngine | null;
  engineNotice: string | null;
  showClock: boolean;
  transcriptOpen: boolean;
  showTranscriptToggle: boolean;
  onToggleTranscript: () => void;
  onLeave: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-base-line bg-base/80 backdrop-blur">
      <div className="flex items-center gap-3 px-3 py-2.5 md:px-5">
        <button className="btn-ghost btn-sm -ml-1 shrink-0" onClick={onLeave} aria-label="Forlad øvelsen">
          <Icon.Back width={16} height={16} />
          <span className="hidden sm:inline">Forlad</span>
        </button>

        {showClock && (
          <span
            className="font-mono text-sm tabular-nums text-ink"
            aria-label={`Forløbet tid ${formatClock(elapsedSec)}`}
          >
            {formatClock(elapsedSec)}
          </span>
        )}

        <span className="truncate text-sm font-semibold text-ink-soft">{modeTitle}</span>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden sm:inline">
            <ModeBadge coachMode={coachMode} />
          </span>
          {engine && (
            <span
              className={engineNotice ? "chip-warn" : "chip"}
              title={engineNotice ?? "Samtalen kører på den rigtige stemmemotor."}
            >
              {ENGINE_LABEL[engine]}
            </span>
          )}
          {showTranscriptToggle && (
            <button
              className="btn-outline btn-sm"
              onClick={onToggleTranscript}
              aria-expanded={transcriptOpen}
              aria-label={transcriptOpen ? "Skjul referat" : "Vis referat"}
            >
              <Icon.Doc width={15} height={15} />
              <span className="hidden md:inline">{transcriptOpen ? "Skjul referat" : "Vis referat"}</span>
            </button>
          )}
        </div>
      </div>

      {engineNotice && (
        <p className="border-t border-base-line px-3 py-1.5 text-xs leading-relaxed text-ink-mute md:px-5">
          {engineNotice}
        </p>
      )}
    </header>
  );
});

/* ================================================================== Scenen */

function Stage({
  state,
  speaker,
  name,
  sub,
  micLevel,
  remoteLevel,
  size,
  caption,
  ending,
}: {
  state: VoiceState;
  speaker: StageSpeaker;
  name: string;
  sub: string;
  micLevel: number;
  remoteLevel: number;
  size: number;
  caption: { role: SpeakerRole; name: string; text: string; partial: boolean } | null;
  ending: boolean;
}) {
  const paused = state === "pause";
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-5 py-8">
      <div className={paused ? "opacity-45 transition-opacity" : "transition-opacity"}>
        <VoiceOrb
          speaker={speaker}
          state={state}
          micLevel={micLevel}
          remoteLevel={remoteLevel}
          size={size}
          name={name}
        />
      </div>

      <div className="mt-16 text-center text-xs text-ink-mute">{sub}</div>

      {paused && (
        <div className="mt-6 rounded-xl border border-warn-600/40 bg-warn-900/60 px-4 py-2.5 text-sm text-warn-300">
          Øvelsen er på pause. Mikrofonen er slukket, og modparten venter.
        </div>
      )}

      {ending && (
        <div className="mt-6 flex items-center gap-2.5 text-sm text-ink-mute">
          <Spinner size={15} />
          Afslutter samtalen…
        </div>
      )}

      {!paused && !ending && (
        <div className="mt-8 min-h-[104px] w-full max-w-2xl">
          {caption && (
            <LiveCaption
              speaker={caption.role === "system" ? "coach" : caption.role}
              speakerName={caption.name}
              text={caption.text}
              partial={caption.partial}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================== Betjeningen */

const Controls = memo(function Controls({
  state,
  engine,
  muted,
  coachMode,
  canCoach,
  busy,
  connecting,
  textOpen,
  onMute,
  onPause,
  onResume,
  onInterrupt,
  onCoaching,
  onEnd,
  onToggleText,
  onSendText,
}: {
  state: VoiceState;
  engine: VoiceEngine | null;
  muted: boolean;
  coachMode: CoachMode;
  canCoach: boolean;
  busy: boolean;
  connecting: boolean;
  textOpen: boolean;
  onMute: () => void;
  onPause: () => void;
  onResume: () => void;
  onInterrupt: () => void;
  onCoaching: () => void;
  onEnd: () => void;
  onToggleText: () => void;
  onSendText: (text: string) => void;
}) {
  const paused = state === "pause";
  const dead = state === "fejl" || state === "afsluttet" || busy || connecting;
  const speaking = state === "taler";
  // Kun realtime-motoren kan afbrydes midt i en sætning.
  const canInterrupt = speaking && engine === "realtime" && !dead;
  // Kører øvelsen på skrift, er der ingen mikrofon at slå fra.
  const hasMic = engine !== "tekst";

  return (
    <div className="pad-b-safe shrink-0 border-t border-base-line bg-base/85 px-3 pt-3 backdrop-blur md:px-5">
      <div className="mx-auto w-full max-w-3xl">
        {textOpen && <TextBar onSend={onSendText} disabled={dead} />}

        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
          <ControlButton
            label={muted ? "Slå mikrofonen til" : "Slå mikrofonen fra"}
            text={muted ? "Slået fra" : "Mikrofon"}
            onClick={onMute}
            disabled={dead || paused || !hasMic}
            tone={muted ? "warn" : "quiet"}
            icon={muted ? <Icon.MicOff width={19} height={19} /> : <Icon.Mic width={19} height={19} />}
            title={hasMic ? undefined : "Øvelsen kører på skrift — der er ingen mikrofon i brug"}
          />

          <ControlButton
            label={paused ? "Genoptag øvelsen" : "Sæt øvelsen på pause"}
            text={paused ? "Genoptag" : "Pause"}
            onClick={paused ? onResume : onPause}
            disabled={dead}
            tone={paused ? "accent" : "quiet"}
            icon={paused ? <Icon.Play width={19} height={19} /> : <Icon.Pause width={19} height={19} />}
          />

          <ControlButton
            label="Afbryd modparten og tag ordet"
            text="Afbryd"
            onClick={onInterrupt}
            disabled={!canInterrupt}
            tone="quiet"
            icon={<Icon.Stop width={18} height={18} />}
            title={
              engine === "realtime"
                ? "Kan bruges, mens modparten taler"
                : "Reservestemmen kan ikke afbrydes midt i en sætning"
            }
          />

          {canCoach && (
            <ControlButton
              label="Bed salgsdirektøren om coaching nu"
              text="Bed om coaching"
              onClick={onCoaching}
              disabled={dead || paused}
              tone="quiet"
              icon={<Icon.Spark width={18} height={18} />}
            />
          )}

          <ControlButton
            label={textOpen ? "Luk skrivefeltet" : "Skriv i stedet for at tale"}
            text="Skriv"
            onClick={onToggleText}
            disabled={dead}
            tone="quiet"
            hideText
            expanded={textOpen}
            icon={<KeyboardIcon />}
          />

          <span className="mx-1 hidden h-8 w-px bg-base-line md:block" aria-hidden="true" />

          <button
            className="btn-danger px-5 py-3"
            onClick={onEnd}
            disabled={busy || connecting}
            aria-label="Afslut øvelsen og få feedback"
          >
            {busy ? <Spinner size={15} /> : <Icon.Check width={18} height={18} />}
            Afslut øvelsen
          </button>
        </div>

        {coachMode === "realistisk" && (
          <p className="mt-2.5 text-center text-xs text-ink-mute">
            Realistisk øvelse: coachingen kommer, når du afslutter — ikke undervejs.
          </p>
        )}
      </div>
    </div>
  );
});

function ControlButton({
  label,
  text,
  icon,
  onClick,
  disabled,
  tone,
  hideText,
  title,
  expanded,
}: {
  label: string;
  text: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: "quiet" | "warn" | "accent";
  hideText?: boolean;
  title?: string;
  expanded?: boolean;
}) {
  const cls =
    tone === "warn"
      ? "border-warn-600/50 bg-warn-900/60 text-warn-300 hover:bg-warn-900"
      : tone === "accent"
        ? "border-brand-700 bg-brand-950 text-brand-200 hover:bg-brand-900"
        : "border-base-line2 bg-base-panel text-ink-soft hover:border-brand-700 hover:text-ink";
  return (
    <button
      type="button"
      className={`btn min-h-[48px] border px-3.5 py-3 md:px-4 ${cls}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-expanded={expanded}
      title={title ?? label}
    >
      {icon}
      <span className={hideText ? "sr-only" : "hidden text-[13px] sm:inline"}>{text}</span>
    </button>
  );
}

/** Nødudgangen: skriv i stedet for at tale. Bevidst lille og lukket som standard. */
function TextBar({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const send = () => {
    const clean = value.trim();
    if (!clean) return;
    onSend(clean);
    setValue("");
  };

  return (
    <form
      className="mb-3 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <input
        ref={ref}
        className="input"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Skriv det, du ville have sagt…"
        aria-label="Skriv til modparten"
      />
      <button type="submit" className="btn-outline shrink-0" disabled={disabled || !value.trim()}>
        Send
      </button>
    </form>
  );
}

/* =============================================================== Referatet */

const TranscriptSheet = memo(function TranscriptSheet({
  open,
  lines,
  labels,
  onClose,
}: {
  open: boolean;
  lines: Utterance[];
  labels: Record<string, string>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-label="Luk referatet"
        />
      )}
      <aside
        aria-hidden={!open}
        aria-label="Referat af samtalen"
        className={`fixed z-40 flex flex-col border-base-line bg-base-panel shadow-lift transition-transform duration-200
          inset-x-0 bottom-0 h-[62vh] rounded-t-2xl border-t
          md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[360px] md:rounded-none md:border-l md:border-t-0
          ${open ? "translate-y-0 md:translate-x-0" : "pointer-events-none translate-y-full md:translate-y-0 md:translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-base-line px-4 py-3">
          <span className="eyebrow">Referat</span>
          {open && (
            <button className="btn-ghost btn-sm -mr-2" onClick={onClose} aria-label="Luk referatet">
              <Icon.X width={16} height={16} />
            </button>
          )}
        </div>
        <div className="pad-b-safe flex-1 overflow-hidden px-4 pt-4">
          {lines.length === 0 ? (
            <p className="body-mute">Der er ikke sagt noget endnu.</p>
          ) : (
            <TranscriptRail lines={lines} labels={labels} />
          )}
        </div>
      </aside>
    </>
  );
});

/* ================================================================ Briefingen */

function Briefing({
  session,
  coachLed,
  modeTitle,
  counterpartName,
  counterpartSub,
  loadError,
  starting,
  onStart,
  savedLines,
  onFeedbackOnSaved,
}: {
  session: TrainingSession;
  coachLed: boolean;
  modeTitle: string;
  counterpartName: string;
  counterpartSub: string;
  loadError: string | null;
  starting: boolean;
  onStart: () => void;
  /** Replikker fra en afbrudt samtale, der allerede ligger gemt. */
  savedLines: number;
  onFeedbackOnSaved: () => void;
}) {
  const scenario = session.scenario;
  const persona = scenario?.persona;
  const intent = MODE_INTENT[session.modeId];

  const chips = scenario
    ? [
        scenario.config.industry,
        scenario.config.customerRole,
        scenario.config.meetingType,
        scenario.config.salesStage,
        scenario.config.attitude,
        scenario.config.difficulty ? DIFFICULTY_LABEL[scenario.config.difficulty] : undefined,
      ].filter((v): v is string => Boolean(v))
    : [];

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-9 md:py-14">
      <div className="eyebrow">{modeTitle}</div>
      <h1 className="title-xl mt-2">{scenario?.title || modeTitle}</h1>
      <p className="body mt-3">
        {coachLed
          ? "Du skal tale med salgsdirektøren. Samtalen er talt — du taler, og han svarer."
          : `Du skal om lidt tale med ${counterpartName}. Læs briefingen, og start når du er klar.`}
      </p>

      {loadError && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-danger-600/40 bg-danger-900/50 px-4 py-3 text-sm text-danger-300">
          <Icon.Warn className="mt-0.5 shrink-0" width={17} height={17} />
          <div>{loadError}</div>
        </div>
      )}

      {/* En afbrudt samtale er stadig en samtale. Den skal kunne bruges. */}
      {savedLines > 0 && (
        <div className="mt-5 rounded-xl border border-warn-600/40 bg-warn-900/40 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <Icon.Warn className="mt-0.5 shrink-0 text-warn-500" width={17} height={17} />
            <p className="text-sm leading-relaxed text-warn-200">
              Øvelsen blev afbrudt undervejs. Der ligger {savedLines} gemte replikker. Starter du
              forfra, bliver de erstattet af den nye samtale.
            </p>
          </div>
          <button type="button" className="btn-outline btn-sm mt-3" onClick={onFeedbackOnSaved}>
            <Icon.Check width={15} height={15} />
            Få feedback på det, der allerede er sagt
          </button>
        </div>
      )}

      {persona && (
        <Panel className="mt-6">
          <div className="eyebrow">Du skal tale med</div>
          <div className="mt-2.5 flex items-start gap-3">
            {/* Blå = rollespilskunden. Det er hele pointen med farven her. */}
            <Avatar initials={nameInitials(persona.name)} size={42} tone="client" />
            <div className="min-w-0">
              <div className="title-md">{persona.name}</div>
              <div className="body-mute">{counterpartSub}</div>
              {persona.industry && (
                <div className="mt-0.5 text-xs text-ink-mute">{persona.industry}</div>
              )}
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span key={c} className="chip">
                  {c}
                </span>
              ))}
            </div>
          )}

          {scenario?.briefing && (
            <>
              <div className="divider my-5" />
              <div className="eyebrow mb-2">Briefing</div>
              <CoachText text={scenario.briefing} />
            </>
          )}

          {scenario?.config.knownInformation && (
            <>
              <div className="eyebrow mb-2 mt-5">Det du ved i forvejen</div>
              <CoachText text={scenario.config.knownInformation} />
            </>
          )}

          {scenario && scenario.objectives.length > 0 && (
            <>
              <div className="eyebrow mb-2 mt-5">Dine mål med samtalen</div>
              <ul className="space-y-1.5">
                {scenario.objectives.map((o, i) => (
                  <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-soft">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-brand-600" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      )}

      {!persona && (
        <Panel className="mt-6">
          <div className="eyebrow">Sådan kører øvelsen</div>
          <p className="body mt-2">
            {intent ??
              "Salgsdirektøren tager samtalen med dig og presser dig på det, der betyder noget."}
          </p>
          {session.intake && (
            <>
              <div className="divider my-5" />
              <div className="eyebrow mb-2">Det du har skrevet</div>
              <CoachText text={session.intake} />
            </>
          )}
        </Panel>
      )}

      <div className="mt-7">
        <button
          className="btn-primary btn-lg w-full md:w-auto"
          onClick={onStart}
          disabled={starting}
          aria-label="Start samtalen"
        >
          {starting ? <Spinner size={17} /> : <Icon.Mic width={18} height={18} />}
          {starting ? "Forbinder…" : "Start samtalen"}
        </button>
        <p className="mt-3 max-w-lg text-xs leading-relaxed text-ink-mute">
          Mikrofonen tændes først, når du trykker. Du kan sætte øvelsen på pause undervejs, og
          feedbacken kommer, når du afslutter.
        </p>
      </div>
    </div>
  );
}

/* ================================================================= Analysen */

function Analysing({
  seconds,
  error,
  lines,
  durationSec,
  onRetry,
  onSkip,
}: {
  seconds: number;
  error: string | null;
  lines: number;
  durationSec: number;
  onRetry: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-5 py-10">
      {error ? (
        <div>
          <div className="eyebrow">Vurdering</div>
          <h2 className="title-xl mt-2">Feedbacken kunne ikke laves</h2>
          <p className="body mt-3.5 max-w-[54ch]">
            Samtalen er gemt. Du mister ingenting ved at prøve igen — eller ved at gå videre og
            hente feedbacken senere.
          </p>
          <p className="mt-4 rounded-xl border border-danger-600/35 bg-danger-900/30 px-4 py-3 text-xs leading-relaxed text-danger-300/90">
            {error}
          </p>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <button className="btn-primary" onClick={onRetry}>
              <Icon.Repeat width={17} height={17} />
              Prøv analysen igen
            </button>
            <button className="btn-outline" onClick={onSkip}>
              Gå til debriefingen
            </button>
          </div>
        </div>
      ) : (
        <StepWait
          eyebrow="Vurdering"
          title="Salgsdirektøren gennemgår samtalen"
          desc={`${lines} replikker · ${formatClock(durationSec)} samtale. Hele samtalen bliver læst igennem frem for skimmet, så det tager typisk 10-40 sekunder.`}
          steps={ANALYSE_STEPS}
          seconds={seconds}
          note="Du kan blive på siden. Samtalen er allerede gemt."
        />
      )}
    </div>
  );
}

/* ============================================================= Fejl på scenen */

function VoiceFailure({
  message,
  hasConversation,
  onRetry,
  onFinish,
  onBack,
  onLeave,
}: {
  message: string;
  hasConversation: boolean;
  onRetry: () => void;
  onFinish: () => void;
  onBack: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-base/90 px-5 backdrop-blur-sm">
      <div className="panel w-full max-w-md p-6">
        <div className="flex items-start gap-3">
          <Icon.Warn className="mt-0.5 shrink-0 text-warn-500" width={19} height={19} />
          <div>
            <h2 className="title-md">
              {hasConversation ? "Samtalen blev afbrudt" : "Øvelsen kunne ikke startes"}
            </h2>
            <p className="body mt-2">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {hasConversation ? (
            <>
              <button className="btn-primary" onClick={onFinish}>
                Afslut og få feedback på det, der nåede at ske
              </button>
              <button className="btn-outline" onClick={onLeave}>
                Forlad øvelsen
              </button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={onRetry}>
                <Icon.Repeat width={17} height={17} />
                Prøv igen
              </button>
              <button className="btn-outline" onClick={onBack}>
                Tilbage til briefingen
              </button>
            </>
          )}
        </div>

        {hasConversation && (
          <p className="mt-4 text-xs leading-relaxed text-ink-mute">
            Forbindelsen kan ikke genoptages midt i en samtale — en ny forbindelse starter forfra.
            Derfor er det bedre at afslutte og få feedback på det, der allerede blev sagt.
          </p>
        )}
      </div>
    </div>
  );
}

/* ============================================================ Hele skærmen */

/**
 * Samtaleskærmen har ingen app-skal. Når den ikke kan vise en samtale, må
 * beskeden derfor selv bære identiteten — ellers ligner en tom sort skærm med
 * to linjer tekst en fejl i udrulningen frem for en tilstand i værktøjet.
 */
function FullScreenMessage({
  eyebrow = "Øvelse",
  title,
  body,
  primary,
  secondary,
  inline,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  inline?: boolean;
}) {
  const content = (
    <div className="w-full max-w-[54ch]">
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="title-xl mt-2">{title}</h2>
      <p className="body mt-3.5">{body}</p>
      <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
        <button className="btn-primary" onClick={primary.onClick}>
          {primary.label}
        </button>
        {secondary && (
          <button className="btn-outline" onClick={secondary.onClick}>
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  );
  if (inline) return <div className="mx-auto grid min-h-full max-w-3xl place-items-center px-5 py-10">{content}</div>;
  return (
    <div className="flex h-[100dvh] flex-col bg-base">
      <div className="safe-t border-b border-base-line">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-800 bg-brand-950 text-sm font-bold text-brand-400">
            gl
          </span>
          <span className="text-sm font-bold tracking-tight">
            green light <span className="text-brand-400">Salgscoach</span>
          </span>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 items-start px-5 pb-10 pt-[14vh]">{content}</div>
    </div>
  );
}

/* ================================================================ Hjælpere */

/** Tastatur-ikonet findes ikke i ikonsættet — og hører kun til her. */
function KeyboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={19}
      height={19}
      aria-hidden="true"
    >
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M6 13h.01M18 13h.01M9.5 15.5h5" />
      <path d="M9.5 13h5" />
    </svg>
  );
}

function useIsWide(): boolean {
  const [wide, setWide] = useState<boolean>(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

/** Sekunder siden start — vores eget ur er sandheden, hookens er reserven. */
function elapsedOf(startedAt: number, fallback: number): number {
  if (!startedAt) return Math.max(0, fallback);
  return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
}

/** Er der overhovedet en samtale at analysere? */
function isTooThin(lines: readonly Utterance[]): boolean {
  const real = lines.filter((u) => u.role !== "system" && u.text.trim().length > 0);
  if (real.length < 2) return true;
  if (!real.some((u) => u.role === "saelger")) return true;
  const words = real.reduce((n, u) => n + u.text.trim().split(/\s+/).length, 0);
  return words < 20;
}

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function messageOf(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message.trim() : "";
  return msg || fallback;
}

/** Hvad skal en skærmlæser sige, når tilstanden skifter? */
function announce(state: VoiceState, counterpart: string, error: string | null): string {
  switch (state) {
    case "forbinder":
      return "Forbinder til stemmen";
    case "lytter":
      return "Lytter — du har ordet";
    case "taenker":
      return `${counterpart} tænker`;
    case "taler":
      return `${counterpart} taler`;
    case "pause":
      return "Øvelsen er på pause";
    case "afsluttet":
      return "Samtalen er afsluttet";
    case "fejl":
      return error ? `Fejl: ${error}` : "Der opstod en fejl i samtalen";
    default:
      return "";
  }
}

/**
 * Oversæt en teknisk fejl til noget en sælger kan gøre noget ved.
 * Hooken giver os enten en dansk sætning fra stemmemotoren eller ingenting —
 * en tavs "fejl"-tilstand betyder i praksis, at forbindelsen faldt fra.
 */
function describeVoiceError(error: string | null, state: VoiceState): string {
  const raw = (error || "").trim();
  const low = raw.toLowerCase();

  if (low.includes("afvist") || low.includes("not-allowed") || low.includes("notallowed")) {
    return "Browseren har ikke adgang til mikrofonen. Klik på ikonet til venstre for adressefeltet, giv siden lov til at bruge mikrofonen, og start øvelsen igen.";
  }
  if (low.includes("tilsluttet") || low.includes("notfound") || low.includes("ingen mikrofon")) {
    return "Vi kan ikke finde en mikrofon. Tjek at headset eller mikrofon er tilsluttet og valgt i systemets lydindstillinger, og start øvelsen igen.";
  }
  if (low.includes("talegenkendelse")) {
    return `${raw} Du kan bruge skrivefeltet, indtil mikrofonen virker igen.`;
  }
  if (raw) return raw;
  if (state === "afsluttet") return "Forbindelsen til stemmen blev lukket, før øvelsen var slut.";
  return "Forbindelsen til stemmemotoren blev afbrudt. Det sker typisk, når netværket skifter eller falder ud.";
}

/** "Start forfra" efter en tom øvelse: tilbage til briefingen og i gang igen. */
async function restart(setPhase: (p: Phase) => void, start: () => Promise<void>): Promise<void> {
  setPhase("briefing");
  await start();
}
