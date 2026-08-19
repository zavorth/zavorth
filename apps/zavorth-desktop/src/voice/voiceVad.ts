/**
 * Browser-side VAD using Web Audio AnalyserNode (RMS).
 * Gates MediaRecorder flushes so we only send speech / end-of-utterance.
 */

export type BrowserVadSnapshot = {
  rms: number;
  speaking: boolean;
  silenceMs: number;
};

export class BrowserVoiceVad {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private data: Uint8Array | null = null;
  private speaking = false;
  private silenceStartedAt: number | null = null;
  private lastSpeechAt = 0;
  private readonly speechThreshold: number;
  private readonly silenceMsToEnd: number;

  constructor(options: { speechThreshold?: number; silenceMsToEnd?: number } = {}) {
    this.speechThreshold = Number(options.speechThreshold || 0.02);
    this.silenceMsToEnd = Math.max(250, Number(options.silenceMsToEnd || 800));
  }

  public attach(stream: MediaStream): boolean {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return false;
      this.context = new Ctx();
      this.source = this.context.createMediaStreamSource(stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.75;
      this.source.connect(this.analyser);
      this.data = new Uint8Array(this.analyser.fftSize);
      this.speaking = false;
      this.silenceStartedAt = null;
      this.lastSpeechAt = 0;
      return true;
    } catch {
      return false;
    }
  }

  public sample(now = Date.now()): BrowserVadSnapshot {
    if (!this.analyser || !this.data) {
      return { rms: 0, speaking: false, silenceMs: 0 };
    }
    // TS DOM libs may type ArrayBuffer vs ArrayBufferLike; cast for analyser API.
    this.analyser.getByteTimeDomainData(this.data as unknown as Uint8Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < this.data.length; i += 1) {
      const v = (this.data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.data.length);
    const isSpeech = rms >= this.speechThreshold;

    if (isSpeech) {
      this.speaking = true;
      this.lastSpeechAt = now;
      this.silenceStartedAt = null;
      return { rms, speaking: true, silenceMs: 0 };
    }

    if (this.speaking) {
      if (this.silenceStartedAt == null) this.silenceStartedAt = now;
      const silenceMs = now - this.silenceStartedAt;
      if (silenceMs >= this.silenceMsToEnd) {
        this.speaking = false;
        return { rms, speaking: false, silenceMs };
      }
      return { rms, speaking: true, silenceMs };
    }

    return {
      rms,
      speaking: false,
      silenceMs: this.lastSpeechAt ? now - this.lastSpeechAt : 0,
    };
  }

  /** True once when speech ends after silence hold. */
  public consumeEndOfUtterance(now = Date.now()): boolean {
    const snap = this.sample(now);
    if (!this.speaking && this.silenceStartedAt != null) {
      const silenceMs = now - this.silenceStartedAt;
      if (silenceMs >= this.silenceMsToEnd && this.lastSpeechAt > 0) {
        this.silenceStartedAt = null;
        this.lastSpeechAt = 0;
        return true;
      }
    }
    // Detect transition: was speaking, now past silence
    if (snap.speaking === false && snap.silenceMs >= this.silenceMsToEnd && this.lastSpeechAt > 0) {
      const ended = now - this.lastSpeechAt >= this.silenceMsToEnd;
      if (ended) {
        this.lastSpeechAt = 0;
        return true;
      }
    }
    return false;
  }

  public dispose(): void {
    try {
      this.source?.disconnect();
    } catch {
      // ignore
    }
    try {
      void this.context?.close();
    } catch {
      // ignore
    }
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.data = null;
  }
}
