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
import { api } from "../lib/api";
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
  sellerContext: unknown;
  voice?: RealtimeVoice;
  /** Telefonøvelser skal føles hurtige og ubehagelige. */
  eagerness?: "low" | "auto" | "high";
  /** Foretrukken motor — bruges til at teste reservevejen bevidst. */
  prefer?: VoiceEngine;
}

export interface VoiceSessionApi {
  state: VoiceState;
  engine: VoiceEngine | null;
  /** Sat når vi måtte falde tilbage, så UI'et kan sige det ærligt. */
  engineNotice: string | null;
  transcript: Utterance[];
  /** Delvis tekst der stadig bliver talt/transskriberet. */
  live: { speaker: "saelger" | "modpart"; text: string } | null;
  micLevel: number;
  remoteLevel: number;
  error: string | null;
  starting: boolean;
  elapsedSec: number;
  muted: boolean;

  start: (p: StartParams) => Promise<void>;
  end: () => Promise<Utterance[]>;
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
  const [starting, setStarting] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [muted, setMuted] = useState(false);

  const rt = useRef<RealtimeVoiceSession | null>(null);
  const bv = useRef<BrowserVoiceSession | null>(null);
  const startedAt = useRef<number>(0);
  const params = useRef<StartParams | null>(null);
  /** Sandheden om samtalen — state kan halte bagefter ved hurtig tale. */
  const lines = useRef<Utterance[]>([]);

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

  /* Ur — sælgeren skal kunne se, hvor længe øvelsen har kørt. */
  useEffect(() => {
    if (state === "inaktiv" || state === "afsluttet") return;
    const t = window.setInterval(() => {
      if (startedAt.current) setElapsedSec(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(t);
  }, [state]);

  /* Ryd altid op — en glemt mikrofon er en åben mikrofon. */
  useEffect(() => {
    return () => {
      void rt.current?.close("Siden blev forladt.");
      bv.current?.stop();
    };
  }, []);

  const startBrowserVoice = useCallback(
    async (p: StartParams, notice: string | null) => {
      if (!browserVoiceSupported()) {
        setEngine("tekst");
        setEngineNotice(
          notice
            ? `${notice} Din browser kan heller ikke talegenkendelse, så øvelsen kører på skrift.`
            : "Øvelsen kører på skrift, fordi browseren ikke understøtter talegenkendelse.",
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
          onError: setError,
        },
        respond: async (sellerText) => {
          push("saelger", sellerText);
          const res = await api.converse({
            modeId: p.modeId,
            coachMode: p.coachMode,
            language: p.language,
            scenario: p.scenario,
            hiddenBlob: p.hiddenBlob,
            intake: p.intake,
            sellerContext: p.sellerContext,
            messages: lines.current.map((u) => ({
              role: u.role === "saelger" ? ("user" as const) : ("assistant" as const),
              content: u.text,
            })),
          });
          let audio: string | undefined;
          try {
            const spoken = await api.speak({ text: res.reply, voice: p.voice || "cedar" });
            audio = spoken.audio;
          } catch {
            /* uden lyd viser vi stadig teksten */
          }
          return { text: res.reply, audio };
        },
      });
      bv.current = session;
      setEngine("browser");
      setEngineNotice(notice);
      await session.start();
    },
    [push],
  );

  const start = useCallback(
    async (p: StartParams) => {
      setError(null);
      setStarting(true);
      setTranscript([]);
      setLive(null);
      lines.current = [];
      startedAt.current = Date.now();
      setElapsedSec(0);
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

          if ("clientSecret" in res && res.clientSecret) {
            const session = new RealtimeVoiceSession();
            rt.current = session;
            await session.connect({
              clientSecret: res.clientSecret,
              model: res.model,
              api: res.api,
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
                onError: setError,
                onClosed: () => setState("afsluttet"),
              },
            });
            setEngine("realtime");
            setEngineNotice(null);
            setStarting(false);
            return;
          }

          const reason =
            "error" in res && res.error
              ? String(res.error)
              : "Realtime-stemmen er ikke tilgængelig lige nu.";
          await startBrowserVoice(p, `${reason} Vi kører videre på reservestemmen.`);
          setStarting(false);
          return;
        } catch (e) {
          await startBrowserVoice(
            p,
            `${(e as Error).message || "Realtime-stemmen kunne ikke starte."} Vi kører videre på reservestemmen.`,
          );
          setStarting(false);
          return;
        }
      }

      await startBrowserVoice(p, wantsRealtime ? "Browseren understøtter ikke realtime-stemme." : null);
      setStarting(false);
    },
    [push, startBrowserVoice],
  );

  const end = useCallback(async () => {
    await rt.current?.close("Øvelsen blev afsluttet.");
    bv.current?.stop();
    rt.current = null;
    bv.current = null;
    setState("afsluttet");
    setLive(null);
    return lines.current;
  }, []);

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
      return !m;
    });
  }, []);

  const interrupt = useCallback(() => {
    rt.current?.interrupt();
  }, []);

  const requestCoaching = useCallback(() => {
    const msg =
      "[SÆLGEREN BEDER OM COACHING NU] Bryd ud af rollen som kunde. Sig kort hvad du så, hvad der var problemet, og hvad sælgeren skal gøre anderledes — og gå så tilbage i rollen og fortsæt samtalen derfra.";
    if (rt.current) rt.current.sendText(msg, "user");
    else void bv.current?.say(msg);
    push("system", "Sælgeren bad om live-coaching.");
  }, [push]);

  const sendText = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      if (rt.current) {
        push("saelger", clean);
        rt.current.sendText(clean, "user");
        return;
      }
      void bv.current?.say(clean);
    },
    [push],
  );

  return useMemo(
    () => ({
      state,
      engine,
      engineNotice,
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
