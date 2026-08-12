// =============================================================================
// voice/realtime · Realtime-stemmemotor (WebRTC)
// -----------------------------------------------------------------------------
// Hele produktet hviler på, at samtalen føles som en samtale — ikke som en
// chatbot der skiftes til at skrive. Derfor WebRTC direkte mod realtime-modellen:
// lyd ind og lyd ud i samme forbindelse, med barge-in (kunden/coachen kan blive
// afbrudt midt i en sætning, og omvendt).
//
// Nøglen er MIDLERTIDIG: serveren udsteder en kortlivet "ek_"-nøgle, som kun
// kan bruges til denne ene session. Den rigtige OpenAI-nøgle forlader aldrig
// serveren, og systeminstruktionen (salgsmanual + skjult kundeviden) er allerede
// bagt ind i sessionen server-side — browseren ser den aldrig.
//
// Begivenhedsnavnene har ændret sig mellem beta og GA. Vi lytter derfor på
// begge varianter frem for at binde os til én.
// =============================================================================

export type VoiceState =
  | "inaktiv"
  | "forbinder"
  | "lytter"
  | "taenker"
  | "taler"
  | "pause"
  | "afsluttet"
  | "fejl";

export type RealtimeSpeaker = "saelger" | "modpart";

export interface RealtimeEvents {
  /** Tilstandsskift — driver hele den visuelle stemme-UI. */
  onState?: (state: VoiceState) => void;
  /** Løbende transskription. `final` = sætningen er færdig. */
  onTranscript?: (speaker: RealtimeSpeaker, text: string, final: boolean) => void;
  /** Lydniveau 0-1 for hhv. mikrofon og modpart — bruges til kurverne. */
  onLevel?: (mic: number, remote: number) => void;
  /** Modellen kaldte et værktøj (fx "afslut øvelsen"). */
  onTool?: (name: string, args: Record<string, unknown>, callId: string) => void;
  onError?: (message: string) => void;
  /** Forbindelsen faldt uigenkaldeligt fra. */
  onClosed?: (reason: string) => void;
}

export interface RealtimeConnectOptions {
  clientSecret: string;
  model: string;
  /** "ga" bruger /v1/realtime/calls, "beta" bruger /v1/realtime. */
  api?: "ga" | "beta";
  events: RealtimeEvents;
}

const CALLS_URL_GA = "https://api.openai.com/v1/realtime/calls";
const CALLS_URL_BETA = "https://api.openai.com/v1/realtime";

/** Enkel eksponentiel udjævning, så niveaumåleren ikke flimrer. */
function smooth(prev: number, next: number, factor = 0.35) {
  return prev + (next - prev) * factor;
}

export class RealtimeVoiceSession {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private micStream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private remoteAnalyser: AnalyserNode | null = null;
  private raf = 0;
  private events: RealtimeEvents = {};
  private state: VoiceState = "inaktiv";
  private micLevel = 0;
  private remoteLevel = 0;
  private closed = false;

  /** Sidste kendte delvise transskriptioner, så vi kan lukke dem korrekt af. */
  private partial: Record<RealtimeSpeaker, string> = { saelger: "", modpart: "" };

  get currentState(): VoiceState {
    return this.state;
  }

  private setState(s: VoiceState) {
    if (this.state === s) return;
    this.state = s;
    this.events.onState?.(s);
  }

  // ------------------------------------------------------------- forbindelse

  async connect(opts: RealtimeConnectOptions): Promise<void> {
    this.events = opts.events;
    this.closed = false;
    this.setState("forbinder");

    // 1) Mikrofon. 24 kHz mono med ekkoannullering — ellers hører modellen sig selv.
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 24000,
        },
      });
    } catch (e) {
      const msg =
        (e as DOMException)?.name === "NotAllowedError"
          ? "Adgang til mikrofonen blev afvist. Giv browseren lov til at bruge mikrofonen og prøv igen."
          : "Kunne ikke få adgang til mikrofonen. Tjek at der er en mikrofon tilsluttet.";
      this.setState("fejl");
      this.events.onError?.(msg);
      throw new Error(msg);
    }

    // 2) Peer connection + modpartens lyd.
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    this.pc = pc;

    this.audioEl = document.createElement("audio");
    this.audioEl.autoplay = true;
    // Skjult element — lyden er indholdet, ikke en afspiller.
    this.audioEl.style.display = "none";
    document.body.appendChild(this.audioEl);

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (this.audioEl && stream) {
        this.audioEl.srcObject = stream;
        void this.audioEl.play().catch(() => {
          /* autoplay-blokering: sessionen startes altid fra et klik, så dette er sjældent */
        });
        this.attachRemoteAnalyser(stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.closed) return;
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.events.onClosed?.("Forbindelsen til stemmemotoren blev afbrudt.");
        this.setState("fejl");
      }
    };

    for (const track of this.micStream.getAudioTracks()) {
      pc.addTrack(track, this.micStream);
    }
    this.attachMicAnalyser(this.micStream);

    // 3) Datakanal til begivenheder (transskription, afbrydelser, værktøjskald).
    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onmessage = (e) => this.handleEvent(e.data);
    dc.onerror = () => this.events.onError?.("Datakanalen til stemmemotoren fejlede.");

    // 4) SDP-håndtryk.
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const answer = await this.exchangeSdp(offer.sdp || "", opts);
    await pc.setRemoteDescription({ type: "answer", sdp: answer });

    this.startLevelLoop();
    this.setState("lytter");
  }

  /** POST SDP-tilbuddet. Falder tilbage til beta-endpointet, hvis GA afviser. */
  private async exchangeSdp(sdp: string, opts: RealtimeConnectOptions): Promise<string> {
    const attempts: { url: string; headers: Record<string, string> }[] = [];
    const base = { Authorization: `Bearer ${opts.clientSecret}`, "Content-Type": "application/sdp" };

    if (opts.api === "beta") {
      attempts.push({
        url: `${CALLS_URL_BETA}?model=${encodeURIComponent(opts.model)}`,
        headers: { ...base, "OpenAI-Beta": "realtime=v1" },
      });
    } else {
      attempts.push({ url: `${CALLS_URL_GA}?model=${encodeURIComponent(opts.model)}`, headers: base });
      attempts.push({ url: CALLS_URL_GA, headers: base });
      attempts.push({
        url: `${CALLS_URL_BETA}?model=${encodeURIComponent(opts.model)}`,
        headers: { ...base, "OpenAI-Beta": "realtime=v1" },
      });
    }

    let lastError = "";
    for (const attempt of attempts) {
      try {
        const r = await fetch(attempt.url, { method: "POST", headers: attempt.headers, body: sdp });
        const text = await r.text();
        if (r.ok && text.includes("v=0")) return text;
        lastError = `${r.status}: ${text.slice(0, 200)}`;
      } catch (e) {
        lastError = (e as Error).message;
      }
    }
    this.setState("fejl");
    throw new Error(`Kunne ikke etablere stemmeforbindelsen (${lastError}).`);
  }

  // -------------------------------------------------------- begivenheder ind

  private handleEvent(raw: unknown) {
    let ev: { type?: string; [k: string]: unknown };
    try {
      ev = JSON.parse(String(raw));
    } catch {
      return;
    }
    const type = String(ev.type || "");

    // --- Sælgeren taler -----------------------------------------------------
    if (type === "input_audio_buffer.speech_started") {
      // Barge-in: modellen stopper selv, men UI'et skal reagere med det samme.
      this.setState("lytter");
      return;
    }
    if (type === "input_audio_buffer.speech_stopped") {
      if (this.state === "lytter") this.setState("taenker");
      return;
    }
    if (type.endsWith("input_audio_transcription.delta")) {
      const delta = String((ev as { delta?: string }).delta || "");
      this.partial.saelger += delta;
      this.events.onTranscript?.("saelger", this.partial.saelger, false);
      return;
    }
    if (type.endsWith("input_audio_transcription.completed")) {
      const text = String((ev as { transcript?: string }).transcript || this.partial.saelger || "").trim();
      this.partial.saelger = "";
      if (text) this.events.onTranscript?.("saelger", text, true);
      return;
    }
    if (type.endsWith("input_audio_transcription.failed")) {
      this.partial.saelger = "";
      return;
    }

    // --- Modparten svarer ---------------------------------------------------
    if (type === "response.created") {
      this.setState("taenker");
      return;
    }
    if (type === "response.output_audio.delta" || type === "response.audio.delta") {
      this.setState("taler");
      return;
    }
    if (
      type === "response.output_audio_transcript.delta" ||
      type === "response.audio_transcript.delta"
    ) {
      const delta = String((ev as { delta?: string }).delta || "");
      this.partial.modpart += delta;
      this.setState("taler");
      this.events.onTranscript?.("modpart", this.partial.modpart, false);
      return;
    }
    if (
      type === "response.output_audio_transcript.done" ||
      type === "response.audio_transcript.done"
    ) {
      const text = String((ev as { transcript?: string }).transcript || this.partial.modpart || "").trim();
      this.partial.modpart = "";
      if (text) this.events.onTranscript?.("modpart", text, true);
      return;
    }
    // Ren tekst (hvis modellen svarer i tekst-modalitet).
    if (type === "response.output_text.done" || type === "response.text.done") {
      const text = String((ev as { text?: string }).text || "").trim();
      if (text) this.events.onTranscript?.("modpart", text, true);
      return;
    }

    if (type === "response.done" || type === "response.completed") {
      this.partial.modpart = "";
      if (this.state !== "pause" && this.state !== "afsluttet") this.setState("lytter");
      return;
    }

    // --- Værktøjskald (fx "afslut øvelsen", "bryd ind som coach") -----------
    if (
      type === "response.function_call_arguments.done" ||
      type === "response.output_item.done"
    ) {
      const item = (ev as { item?: { type?: string; name?: string; arguments?: string; call_id?: string } }).item;
      const name = String((ev as { name?: string }).name || item?.name || "");
      const rawArgs = String((ev as { arguments?: string }).arguments || item?.arguments || "");
      const callId = String((ev as { call_id?: string }).call_id || item?.call_id || "");
      if (name) {
        let args: Record<string, unknown> = {};
        try {
          args = rawArgs ? JSON.parse(rawArgs) : {};
        } catch {
          /* ignorér ugyldige argumenter */
        }
        this.events.onTool?.(name, args, callId);
      }
      return;
    }

    if (type === "error") {
      const message =
        (ev as { error?: { message?: string } }).error?.message || "Ukendt fejl i stemmemotoren.";
      this.events.onError?.(String(message));
      return;
    }
  }

  // ------------------------------------------------------------ styring ud

  private send(payload: Record<string, unknown>) {
    if (this.dc && this.dc.readyState === "open") {
      this.dc.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  /** Afbryd modparten midt i en sætning (sælgeren tager ordet). */
  interrupt() {
    this.send({ type: "response.cancel" });
    if (this.state === "taler") this.setState("lytter");
  }

  /** Send en skriftlig besked ind i den talte samtale (fx systembesked). */
  sendText(text: string, role: "user" | "system" = "user", respond = true) {
    this.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role,
        content: [{ type: "input_text", text }],
      },
    });
    if (respond) this.send({ type: "response.create" });
  }

  /** Svar tilbage på et værktøjskald. */
  sendToolResult(callId: string, output: unknown) {
    this.send({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) },
    });
    this.send({ type: "response.create" });
  }

  /** Opdatér sessionen undervejs (fx skift af coach-tilstand). */
  updateSession(session: Record<string, unknown>) {
    this.send({ type: "session.update", session });
  }

  setMuted(muted: boolean) {
    this.micStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  pause() {
    this.setMuted(true);
    this.interrupt();
    if (this.audioEl) this.audioEl.muted = true;
    this.setState("pause");
  }

  resume() {
    this.setMuted(false);
    if (this.audioEl) this.audioEl.muted = false;
    this.setState("lytter");
  }

  // ------------------------------------------------------------- niveauer

  private attachContext() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  private attachMicAnalyser(stream: MediaStream) {
    try {
      const ctx = this.attachContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      this.micAnalyser = analyser;
    } catch {
      /* niveaumåleren er pynt — den må aldrig vælte sessionen */
    }
  }

  private attachRemoteAnalyser(stream: MediaStream) {
    try {
      const ctx = this.attachContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      this.remoteAnalyser = analyser;
    } catch {
      /* ignorér */
    }
  }

  private read(analyser: AnalyserNode | null): number {
    if (!analyser) return 0;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
  }

  private startLevelLoop() {
    const tick = () => {
      if (this.closed) return;
      this.micLevel = smooth(this.micLevel, this.read(this.micAnalyser));
      this.remoteLevel = smooth(this.remoteLevel, this.read(this.remoteAnalyser));
      this.events.onLevel?.(this.micLevel, this.remoteLevel);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- oprydning

  async close(reason = "Sessionen blev afsluttet.") {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.raf);
    try {
      this.dc?.close();
    } catch {
      /* ignorér */
    }
    try {
      this.pc?.getSenders().forEach((s) => s.track?.stop());
      this.pc?.close();
    } catch {
      /* ignorér */
    }
    this.micStream?.getTracks().forEach((t) => t.stop());
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.srcObject = null;
      this.audioEl.remove();
      this.audioEl = null;
    }
    try {
      await this.ctx?.close();
    } catch {
      /* ignorér */
    }
    this.ctx = null;
    this.pc = null;
    this.dc = null;
    this.micStream = null;
    this.setState("afsluttet");
    this.events.onClosed?.(reason);
  }
}

/** Findes de API'er browseren skal bruge for at køre den rigtige stemmemotor? */
export function realtimeSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.RTCPeerConnection === "function" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}
