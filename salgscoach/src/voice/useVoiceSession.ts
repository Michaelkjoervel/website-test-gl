// =============================================================================
// voice/useVoiceSession · Én hook der styrer hele den talte session
// -----------------------------------------------------------------------------
// UI'et skal ikke kende til WebRTC, SDP eller talegenkendelse. Det skal kun vide:
// hvem taler, hvad blev der sagt, og hvad kan jeg gøre lige nu.
//
// Motorvalg sker automatisk: realtime hvis den kan nås, ellers browserstemme,
// ellers ren tekst. Sælgeren får altid ærlig besked om hvilken motor der kører.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RealtimeVoiceSession, realtimeSupported, type VoiceState } from "./realtime";
import { BrowserVoiceSession, browserVoiceSupported } from "./browserVoice";
import { api, type SellerContext } from "../lib/api";
import { newId } from "../lib/ids";
import type {
  CoachMode,
  RealtimeVoice,
  Scenario,
  TrainingModeId,
  Utterance,
  VoiceEngine,
} from "../lib/types";

export interface StartParams {
  modeId: TrainingModeId;
  coachMode: CoachMode;
  language: "da" | "en";
  scenario?: Scenario;
  hiddenBlob?: string;
  intake?: string;
  documentText?: string;
  sellerContext?: SellerContext;
  voice?: RealtimeVoice;
  /** Telefonøvelser skal føles hurtige og ubehagelige. */
  eagerness?: "low" | "auto" | "high";
  /** Foretrukken motor — bruges til at teste reservevejen bevidst. */
  prefer?: VoiceEngine;
}

/**
 * Fejltype frem for kun en tekst. UI'et skal kunne give det RIGTIGE råd —
 * "klik på ikonet ved adressefeltet" hjælper ikke, hvis problemet er, at der
 * ikke er nogen mikrofon.
 */
export type VoiceErrorKind =
  | "mikrofon-afvist"
  | "ingen-mikrofon"
  | "forbindelse"
  | "login"
  | "motor";

export interface VoiceSessionApi {
  state: VoiceState;
  engine: VoiceEngine | null;
  /** Sat når vi måtte falde tilbage, så UI'et kan sige det ærligt. */
  engineNotice: string | null;
  errorKind: VoiceErrorKind | null;
  /** Sluttede sælgeren selv, eller faldt forbindelsen fra? */
  endedBy: "bruger" | "afbrudt" | null;
  transcript: Utterance[];
  /** Delvis tekst der stadig bliver talt/transskriberet. */
  live: { speaker: "saelger" | "modpart"; text: string } | null;
  micLevel: number;
  remoteLevel: number;
  error: string | null;
  starting: boolean;
  elapsedSec: number;
  muted: boolean;

  /** `keepTranscript` bruges ved genforbindelse — samtalen må ikke gå tabt. */
  start: (p: StartParams, opts?: { keepTranscript?: boolean }) => Promise<void>;
  end: () => Promise<Utterance[]>;
  /** Prøv igen efter et forbindelsestab, med samtalen i behold. */
  reconnect: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  toggleMute: () => void;
  interrupt: () => void;
  /** Sælgeren beder eksplicit om live-coaching midt i øvelsen. */
  requestCoaching: () => void;
  /** Skriftligt input (tilgængelighed + når mikrofonen driller). */
  sendText: (text: string) => void;
}

export function useVoiceSession(): VoiceSessionApi {
  const [state, setState] = useState<VoiceState>("inaktiv");
  const [engine, setEngine] = useState<VoiceEngine | null>(null);
  const [engineNotice, setEngineNotice] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Utterance[]>([]);
  const [live, setLive] = useState<{ speaker: "saelger" | "modpart"; text: string } | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [remoteLevel, setRemoteLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<VoiceErrorKind | null>(null);
  const [endedBy, setEndedBy] = useState<"bruger" | "afbrudt" | null>(null);
  const [starting, setStarting] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [muted, setMuted] = useState(false);

  const rt = useRef<RealtimeVoiceSession | null>(null);
  const bv = useRef<BrowserVoiceSession | null>(null);
  const startedAt = useRef<number>(0);
  const params = useRef<StartParams | null>(null);
  /** Sandheden om samtalen — state kan halte bagefter ved hurtig tale. */
  const lines = useRef<Utterance[]>([]);
  /** Sat mens sælgeren selv afslutter, så et forbindelsestab ikke meldes som fejl. */
  const endingRef = useRef(false);
  /** Ren tekst-tilstand: ingen mikrofon, men samtalen skal stadig kunne føres. */
  const textOnly = useRef(false);
  const textBusy = useRef(false);

  /** Én fejlvej, så UI'et altid får både en type og en tekst. */
  const fail = useCallback((kind: VoiceErrorKind, message: string) => {
    setErrorKind(kind);
    setError(message);
  }, []);

  /** Oversæt motorens frie tekst til en type, UI'et kan handle på. */
  const classify = useCallback((message: string): VoiceErrorKind => {
    const m = message.toLowerCase();
    if (m.includes("afvist") || m.includes("lov til")) return "mikrofon-afvist";
    if (m.includes("mikrofon")) return "ingen-mikrofon";
    if (m.includes("log ind") || m.includes("session")) return "login";
    if (m.includes("forbind")) return "forbindelse";
    return "motor";
  }, []);

  const push = useCallback((role: Utterance["role"], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const u: Utterance = {
      id: newId("u"),
      role,
      text: clean,
      at: startedAt.current ? Date.now() - startedAt.current : 0,
    };
    lines.current = [...lines.current, u];
    setTranscript(lines.current);
    setLive(null);
  }, []);

  /*
   * Ur. Tæller kun mens der faktisk trænes — en pause er ikke træningstid, og
   * varigheden bruges både i feedbacken og i ledelsesoverblikket.
   */
  useEffect(() => {
    if (state === "inaktiv" || state === "afsluttet" || state === "pause" || state === "fejl") return;
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [state]);

  /* Ryd altid op — en glemt mikrofon er en åben mikrofon. */
  useEffect(() => {
    return () => {
      void rt.current?.close("Siden blev forladt.");
      bv.current?.stop();
    };
  }, []);

  /**
   * Modpartens svar, når vi ikke kører realtime. Bruges både af
   * reservestemmen og af den rene tekst-tilstand — samme vej ind til serveren,
   * så samtalen opfører sig ens uanset motor.
   *
   * `recorded` fortæller om replikken allerede står i referatet. Er den ikke
   * skrevet ind (fx en anmodning om coaching), sendes den med til modellen
   * uden at havne i udskriften — ellers ville coachen bagefter analysere
   * sælgeren på ord, han aldrig har sagt.
   */
  const textRespond = useCallback(
    async (p: StartParams, sellerText: string, opts: { recorded?: boolean } = {}) => {
      const history = opts.recorded
        ? lines.current
        : [...lines.current, { role: "saelger" as const, text: sellerText }];
      const res = await api.converse({
        modeId: p.modeId,
        coachMode: p.coachMode,
        language: p.language,
        scenario: p.scenario,
        hiddenBlob: p.hiddenBlob,
        intake: p.intake,
        documentText: p.documentText,
        sellerContext: p.sellerContext,
        messages: history,
      });
      return res.reply;
    },
    [],
  );

  /** Skift øvelsen over på skrift. Sidste udvej — men altid bedre end at dø. */
  const fallBackToText = useCallback((notice: string) => {
    bv.current?.stop();
    bv.current = null;
    textOnly.current = true;
    setEngine("tekst");
    setEngineNotice(notice);
    setError(null);
    setErrorKind(null);
    setState("lytter");
  }, []);

  const startBrowserVoice = useCallback(
    async (p: StartParams, notice: string | null) => {
      // Ren tekst: enten fordi browseren ikke kan tale, eller fordi sælgeren
      // bevidst har valgt det (fx i et storrumskontor). Samtalen SKAL virke —
      // det er stadig en øvelse, bare uden lyd.
      if (p.prefer === "tekst" || !browserVoiceSupported()) {
        textOnly.current = true;
        setEngine("tekst");
        setEngineNotice(
          notice ??
            (p.prefer === "tekst"
              ? "Du kører øvelsen på skrift. Skriv dine replikker, som du ville sige dem."
              : "Øvelsen kører på skrift, fordi browseren ikke understøtter talegenkendelse."),
        );
        setState("lytter");
        return;
      }

      const session = new BrowserVoiceSession({
        language: p.language,
        events: {
          onState: setState,
          onTranscript: (speaker, text, final) => {
            if (final) push(speaker === "saelger" ? "saelger" : counterpartRole(p.modeId), text);
            else setLive({ speaker, text });
          },
          onError: (m) => {
            const kind = classify(m);
            // Er mikrofonen eller talegenkendelsen ude af spil, er der ingen
            // vej tilbage til lyd i denne øvelse. Så flytter vi samtalen over
            // på skrift frem for at lade orben stå og sige "Lytter".
            if (bv.current && (kind === "mikrofon-afvist" || kind === "ingen-mikrofon" || bv.current.currentState === "fejl")) {
              fallBackToText(`${m} Øvelsen fortsætter på skrift — skriv dine replikker herunder.`);
              return;
            }
            fail(kind, m);
          },
        },
        respond: async (sellerText, opts) => {
          const reply = await textRespond(p, sellerText, { recorded: opts.recorded });
          let audio: string | undefined;
          try {
            const spoken = await api.speak({ text: reply, voice: p.voice || "cedar" });
            audio = api.toAudioDataUrl(spoken.audio);
          } catch {
            /* uden lyd viser vi stadig teksten */
          }
          return { text: reply, audio };
        },
      });
      bv.current = session;
      setEngine("browser");
      setEngineNotice(notice);
      await session.start();
    },
    [push, textRespond, fail, classify, fallBackToText],
  );

  /**
   * Smid en død realtime-forbindelse væk. Uden det her ville hooken tro, at
   * den stadig kørte realtime: alt sælgeren skrev og alle knapper ville gå til
   * en lukket datakanal, og INTET ville ske — uden en eneste fejlbesked.
   */
  const discardRealtime = useCallback(async (reason: string) => {
    const dead = rt.current;
    rt.current = null;
    if (!dead) return;
    // Et bevidst fald tilbage er ikke et forbindelsestab; luk stille.
    const wasEnding = endingRef.current;
    endingRef.current = true;
    try {
      await dead.close(reason);
    } finally {
      endingRef.current = wasEnding;
    }
  }, []);

  const start = useCallback(
    async (p: StartParams, opts: { keepTranscript?: boolean } = {}) => {
      setError(null);
      setErrorKind(null);
      setEndedBy(null);
      setStarting(true);
      setLive(null);
      endingRef.current = false;
      textOnly.current = false;
      if (!opts.keepTranscript) {
        setTranscript([]);
        lines.current = [];
        startedAt.current = Date.now();
        setElapsedSec(0);
      }
      params.current = p;

      const wantsRealtime = p.prefer !== "browser" && p.prefer !== "tekst";

      if (wantsRealtime && realtimeSupported()) {
        try {
          const res = await api.createRealtimeSession({
            modeId: p.modeId,
            coachMode: p.coachMode,
            language: p.language,
            scenario: p.scenario,
            hiddenBlob: p.hiddenBlob,
            intake: p.intake,
            documentText: p.documentText,
            sellerContext: p.sellerContext,
            voice: p.voice,
            eagerness: p.eagerness,
          });

          if (res.ok) {
            const session = new RealtimeVoiceSession();
            rt.current = session;
            await session.connect({
              clientSecret: res.clientSecret,
              model: res.model,
              api: res.api === "beta" ? "beta" : "ga",
              events: {
                onState: setState,
                onTranscript: (speaker, text, final) => {
                  if (final) push(speaker === "saelger" ? "saelger" : counterpartRole(p.modeId), text);
                  else setLive({ speaker, text });
                },
                onLevel: (m, r) => {
                  setMicLevel(m);
                  setRemoteLevel(r);
                },
                onError: (m) => fail(classify(m), m),
                onClosed: (reason) => {
                  // Sluttede sælgeren selv, er det ikke en fejl. Faldt
                  // forbindelsen derimod fra midt i en samtale, SKAL det siges
                  // — ellers står sælgeren og taler ud i ingenting.
                  if (endingRef.current) {
                    setEndedBy("bruger");
                    setState("afsluttet");
                    return;
                  }
                  setEndedBy("afbrudt");
                  fail("forbindelse", reason || "Forbindelsen til stemmen blev afbrudt.");
                  setState("fejl");
                },
              },
            });
            setEngine("realtime");
            setEngineNotice(null);
            setStarting(false);
            return;
          }

          const reason = res.error || "Realtime-stemmen er ikke tilgængelig lige nu.";
          if (!res.fallbackToBrowserVoice) {
            // Fx 401/403: reservestemmen hjælper ikke — sælgeren skal logge ind.
            setError(reason);
            setState("fejl");
            setStarting(false);
            return;
          }
          await startBrowserVoice(p, `${reason} Vi kører videre på reservestemmen.`);
          setStarting(false);
          return;
        } catch (e) {
          // Forbindelsen nåede måske at blive halvt oprettet. Den skal væk,
          // før vi falder tilbage — ellers går sælgerens replikker til en
          // lukket kanal, hvor der aldrig kommer et svar.
          await discardRealtime("Stemmeforbindelsen kunne ikke etableres.");

          const message = (e as Error).message || "Realtime-stemmen kunne ikke starte.";
          const kind = classify(message);
          const micProblem = kind === "mikrofon-afvist" || kind === "ingen-mikrofon";

          // Er det mikrofonen den er gal med, hjælper reservestemmen ikke —
          // den skal bruge præcis den samme mikrofon. Så på skrift med det samme.
          await startBrowserVoice(
            micProblem ? { ...p, prefer: "tekst" } : p,
            micProblem
              ? `${message} Øvelsen kører videre på skrift, så du kan træne nu.`
              : `${message} Vi kører videre på reservestemmen.`,
          );
          setStarting(false);
          return;
        }
      }

      await startBrowserVoice(p, wantsRealtime ? "Browseren understøtter ikke realtime-stemme." : null);
      setStarting(false);
    },
    [push, startBrowserVoice, discardRealtime, classify],
  );

  const end = useCallback(async () => {
    endingRef.current = true;
    setEndedBy("bruger");
    await rt.current?.close("Øvelsen blev afsluttet.");
    bv.current?.stop();
    rt.current = null;
    bv.current = null;
    textOnly.current = false;
    setState("afsluttet");
    setLive(null);
    return lines.current;
  }, []);

  /** Genopret forbindelsen efter et tab — med samtalen i behold. */
  const reconnect = useCallback(async () => {
    const p = params.current;
    if (!p) return;
    await rt.current?.close("Genopretter forbindelsen.");
    bv.current?.stop();
    rt.current = null;
    bv.current = null;
    await start(p, { keepTranscript: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  const pause = useCallback(() => {
    rt.current?.pause();
    bv.current?.pause();
    setState("pause");
  }, []);

  const resume = useCallback(() => {
    rt.current?.resume();
    void bv.current?.resume();
    setState("lytter");
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      rt.current?.setMuted(!m);
      bv.current?.setMuted(!m);
      return !m;
    });
  }, []);

  const interrupt = useCallback(() => {
    rt.current?.interrupt();
    bv.current?.interrupt();
  }, []);

  const requestCoaching = useCallback(() => {
    const msg =
      "[SÆLGEREN BEDER OM COACHING NU] Bryd ud af rollen som kunde. Sig kort hvad du så, hvad der var problemet, og hvad sælgeren skal gøre anderledes — og gå så tilbage i rollen og fortsæt samtalen derfra.";
    push("system", "Sælgeren bad om live-coaching.");
    if (rt.current) {
      rt.current.sendText(msg, "user");
      return;
    }
    if (bv.current) {
      // record: false — instruktionen er ikke noget sælgeren har sagt, og må
      // aldrig stå i referatet, som coachen bagefter bedømmer ham på.
      void bv.current.say(msg, { record: false });
      return;
    }
    // Ren tekst-tilstand: send beskeden gennem samme vej som skrevne replikker.
    const p = params.current;
    if (!p || textBusy.current) return;
    textBusy.current = true;
    setState("taenker");
    void textRespond(p, msg, { recorded: false })
      .then((reply) => {
        push(counterpartRole(p.modeId), reply);
        setState("lytter");
      })
      .catch(() => setState("lytter"))
      .finally(() => {
        textBusy.current = false;
      });
  }, [push, textRespond]);

  const sendText = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      if (rt.current) {
        push("saelger", clean);
        rt.current.sendText(clean, "user");
        return;
      }
      if (bv.current) {
        void bv.current.say(clean);
        return;
      }

      // Ren tekst-tilstand: der er ingen motor at give bolden videre til, så
      // hooken fører selv samtalen. Uden det her ville "kører på skrift" være
      // en blindgyde — sælgeren kunne skrive, men ingen svarede.
      const p = params.current;
      if (!p || textBusy.current) return;
      textBusy.current = true;
      push("saelger", clean);
      setState("taenker");
      void textRespond(p, clean, { recorded: true })
        .then((reply) => {
          push(counterpartRole(p.modeId), reply);
          setState("lytter");
        })
        .catch((e: Error) => {
          fail("motor", e.message || "Kunne ikke hente svar.");
          setState("fejl");
        })
        .finally(() => {
          textBusy.current = false;
        });
    },
    [push, textRespond, fail],
  );

  return useMemo(
    () => ({
      state,
      engine,
      engineNotice,
      errorKind,
      endedBy,
      transcript,
      live,
      micLevel,
      remoteLevel,
      error,
      starting,
      elapsedSec,
      muted,
      start,
      end,
      reconnect,
      pause,
      resume,
      toggleMute,
      interrupt,
      requestCoaching,
      sendText,
    }),
    [
      state,
      engine,
      engineNotice,
      errorKind,
      endedBy,
      transcript,
      live,
      micLevel,
      remoteLevel,
      error,
      starting,
      elapsedSec,
      muted,
      start,
      end,
      reconnect,
      pause,
      resume,
      toggleMute,
      interrupt,
      requestCoaching,
      sendText,
    ],
  );
}

/** I nogle øvelser er modparten kunden, i andre er det salgsdirektøren. */
function counterpartRole(modeId: TrainingModeId): Utterance["role"] {
  const coachLed: TrainingModeId[] = [
    "kvalificering",
    "forberedelse",
    "debriefing",
    "lynild",
    "manualeksamen",
    "fri-coaching",
  ];
  return coachLed.includes(modeId) ? "coach" : "kunde";
}
