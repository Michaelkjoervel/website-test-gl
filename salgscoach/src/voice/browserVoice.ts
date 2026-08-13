// =============================================================================
// voice/browserVoice · Reservestemme
// -----------------------------------------------------------------------------
// Hvis realtime-motoren ikke kan nås (nøgle mangler, netværk blokerer WebRTC,
// browseren kan ikke), må produktet ikke bare dø. Så kører vi en enklere, men
// stadig talt samtale: browserens egen talegenkendelse ind, serverens
// tale-syntese ud.
//
// Det er mærkbart mindre flydende end realtime — der er ingen ægte barge-in
// midt i en sætning — men sælgeren kan stadig træne med stemmen. UI'et skal
// altid fortælle ærligt, at man kører på reservemotoren.
// =============================================================================

import type { VoiceState } from "./realtime";

/**
 * Ro-periode før modparten svarer. Browserens talegenkendelse melder "færdig
 * sætning" ved enhver lille pause — mennesker tænker i pauser, så uden denne
 * margin afbryder modparten konstant. 1,5 sekund føles som en naturlig
 * turtagning uden at gøre samtalen træg.
 */
const SILENCE_BEFORE_REPLY_MS = 1500;

/* SpeechRecognition er ikke i TypeScripts DOM-typer. Minimal erklæring. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function browserVoiceSupported(): boolean {
  return typeof window !== "undefined" && getRecognitionCtor() !== null;
}

export interface BrowserVoiceEvents {
  onState?: (s: VoiceState) => void;
  onTranscript?: (speaker: "saelger" | "modpart", text: string, final: boolean) => void;
  onLevel?: (mic: number, remote: number) => void;
  onError?: (message: string) => void;
}

export interface BrowserVoiceOptions {
  language: "da" | "en";
  events: BrowserVoiceEvents;
  /**
   * Kaldes når sælgeren har talt færdig — skal returnere modpartens svar.
   * `recorded` fortæller om replikken allerede står i referatet, så den ikke
   * bliver skrevet ind to gange.
   */
  respond: (
    sellerText: string,
    opts: { recorded: boolean },
  ) => Promise<{ text: string; audio?: string }>;
}

/**
 * Fejl hvor talegenkendelsen ikke kommer i gang igen af sig selv. De må ikke
 * fortie: står der "Lytter" på skærmen, mens mikrofonen er død, taler sælgeren
 * ud i ingenting uden at vide det.
 */
const FATAL_RECOGNITION_ERRORS: Readonly<Record<string, string>> = {
  "not-allowed": "Adgang til mikrofonen blev afvist.",
  "service-not-allowed": "Browseren må ikke bruge talegenkendelsen på denne maskine.",
  "audio-capture": "Der blev ikke fundet nogen mikrofon.",
  network: "Talegenkendelsen kunne ikke nå sin sprogtjeneste (netværket blokerer den).",
  "language-not-supported": "Talegenkendelsen understøtter ikke dansk i denne browser.",
};

export class BrowserVoiceSession {
  private rec: SpeechRecognitionLike | null = null;
  private audio: HTMLAudioElement | null = null;
  private opts: BrowserVoiceOptions;
  private state: VoiceState = "inaktiv";
  private stopped = false;
  private busy = false;
  private buffer = "";
  private flushTimer: number | undefined;
  private restartTimer: number | undefined;

  constructor(opts: BrowserVoiceOptions) {
    this.opts = opts;
  }

  get currentState() {
    return this.state;
  }

  private setState(s: VoiceState) {
    if (this.state === s) return;
    this.state = s;
    this.opts.events.onState?.(s);
  }

  async start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      this.opts.events.onError?.(
        "Din browser understøtter ikke talegenkendelse. Brug Chrome eller Edge — eller skriv i stedet.",
      );
      this.setState("fejl");
      return;
    }
    this.stopped = false;
    this.setState("forbinder");

    const rec = new Ctor();
    rec.lang = this.opts.language === "da" ? "da-DK" : "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onspeechstart = () => {
      // Barge-in på reservemotoren: sælgeren taler → stop afspilningen, og
      // aflys et eventuelt planlagt svar — hans replik er ikke færdig endnu.
      window.clearTimeout(this.flushTimer);
      if (this.audio && !this.audio.paused) {
        this.audio.pause();
        this.audio.currentTime = 0;
      }
      if (!this.busy) this.setState("lytter");
    };

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript || "";
        if (r.isFinal) this.buffer += text + " ";
        else interim += text;
      }
      const live = (this.buffer + interim).trim();
      if (live) this.opts.events.onTranscript?.("saelger", live, false);

      /*
       * Modparten svarer først efter en RO-PERIODE — ikke ved første færdige
       * sætning. Talegenkendelsen afslutter en sætning ved enhver lille pause,
       * og uden denne udskydelse afbrød modparten sælgeren midt i hans egen
       * tankerække. Kommer der mere tale (interim eller ny sætning), aflyses
       * det planlagte svar, og uret starter forfra.
       */
      window.clearTimeout(this.flushTimer);
      if (interim) return; // sælgeren er stadig i gang
      if (this.buffer.trim()) {
        this.flushTimer = window.setTimeout(() => void this.flush(), SILENCE_BEFORE_REPLY_MS);
      }
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      const fatal = FATAL_RECOGNITION_ERRORS[e.error];
      if (fatal) {
        // Genkendelsen kommer ikke igen af sig selv — stop genstarterne, og
        // sig det højt, så hooken kan skifte øvelsen over på skrift.
        this.stopped = true;
        window.clearTimeout(this.restartTimer);
        this.setState("fejl");
        this.opts.events.onError?.(fatal);
        return;
      }
      this.opts.events.onError?.(`Talegenkendelsen fejlede (${e.error}).`);
    };

    rec.onend = () => {
      // Genkendelsen stopper af sig selv med jævne mellemrum — start igen.
      if (this.stopped) return;
      this.restartTimer = window.setTimeout(() => {
        try {
          rec.start();
        } catch {
          /* allerede i gang */
        }
      }, 250);
    };

    this.rec = rec;
    try {
      rec.start();
      this.setState("lytter");
    } catch {
      this.opts.events.onError?.("Kunne ikke starte talegenkendelsen.");
      this.setState("fejl");
    }
  }

  /**
   * Send det sælgeren har sagt videre og afspil modpartens svar.
   * `record: false` bruges til beskeder der skal til modparten, men IKKE ind i
   * referatet — fx sælgerens anmodning om coaching.
   */
  private async flush(opts: { record?: boolean } = {}) {
    const record = opts.record !== false;
    const text = this.buffer.trim();
    if (!text || this.busy) return;
    this.buffer = "";
    this.busy = true;
    if (record) this.opts.events.onTranscript?.("saelger", text, true);
    this.setState("taenker");

    try {
      const reply = await this.opts.respond(text, { recorded: record });
      if (this.stopped) return;
      this.opts.events.onTranscript?.("modpart", reply.text, true);
      if (reply.audio) {
        await this.play(reply.audio);
      }
    } catch (e) {
      this.opts.events.onError?.((e as Error).message || "Kunne ikke hente svar.");
    } finally {
      this.busy = false;
      if (!this.stopped) this.setState("lytter");
    }
  }

  private play(dataUrl: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audio) {
        this.audio = new Audio();
        this.audio.style.display = "none";
      }
      this.audio.src = dataUrl;
      this.setState("taler");
      const done = () => {
        this.audio?.removeEventListener("ended", done);
        this.audio?.removeEventListener("error", done);
        resolve();
      };
      this.audio.addEventListener("ended", done);
      this.audio.addEventListener("error", done);
      void this.audio.play().catch(done);
    });
  }

  /** Skriftligt input i reservemotoren (fx hvis mikrofonen driller). */
  async say(text: string, opts: { record?: boolean } = {}) {
    this.buffer = text;
    await this.flush(opts);
  }

  /**
   * Afbryd modparten. Reservemotoren kan ikke stoppe midt i en sætning som
   * realtime — men den kan stoppe afspilningen, og det er trods alt det,
   * knappen lover sælgeren.
   */
  interrupt() {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
      this.audio.currentTime = 0;
      if (!this.stopped) this.setState("lytter");
    }
  }

  /**
   * Slå mikrofonen fra og til uden at forlade øvelsen. Reservemotoren har
   * ingen lydspor at slukke — genkendelsen SKAL stoppes, ellers lytter
   * browseren videre, mens knappen siger "Slået fra".
   */
  setMuted(muted: boolean) {
    if (muted) {
      this.stopped = true;
      window.clearTimeout(this.restartTimer);
      try {
        this.rec?.abort();
      } catch {
        /* ignorér */
      }
      return;
    }
    if (this.state === "afsluttet" || this.state === "fejl") return;
    this.stopped = false;
    void this.start();
  }

  pause() {
    this.stopped = true;
    try {
      this.rec?.stop();
    } catch {
      /* ignorér */
    }
    this.audio?.pause();
    this.setState("pause");
  }

  async resume() {
    this.stopped = false;
    await this.start();
  }

  stop() {
    this.stopped = true;
    window.clearTimeout(this.restartTimer);
    window.clearTimeout(this.flushTimer);
    try {
      this.rec?.abort();
    } catch {
      /* ignorér */
    }
    this.rec = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    this.setState("afsluttet");
  }
}
