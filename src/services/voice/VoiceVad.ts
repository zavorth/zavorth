/**
 * Lightweight voice activity helpers for media-chunk duplex.
 * Works on raw byte buffers (WebM/Opus is not decoded; we use energy of payload as proxy)
 * plus transcript-level utterance assembly.
 */

export const VOICE_VAD_VERSION = 'voice-vad/v1' as const;

export type VoiceEnergySample = {
  version: typeof VOICE_VAD_VERSION;
  bytes: number;
  /** 0..1 relative energy proxy from buffer bytes */
  energy: number;
  /** Heuristic: likely speech-bearing chunk */
  speechLikely: boolean;
  reason: string;
};

/**
 * Estimate whether a media chunk is worth STT (size + byte-energy proxy).
 * Not true PCM VAD — avoids ffmpeg dependency while filtering silence/tiny blobs.
 */
export function estimateChunkEnergy(
  audio: Buffer,
  options: { minBytes?: number; energyThreshold?: number } = {},
): VoiceEnergySample {
  const minBytes = Math.max(400, Number(options.minBytes || 1800));
  const energyThreshold = Number(options.energyThreshold || 0.012);
  const bytes = audio?.length || 0;
  if (bytes < minBytes) {
    return {
      version: VOICE_VAD_VERSION,
      bytes,
      energy: 0,
      speechLikely: false,
      reason: 'below_min_bytes',
    };
  }

  // Sample up to 8k bytes for mean absolute deviation from 128 (unsigned) / mid-byte.
  const step = Math.max(1, Math.floor(bytes / 4000));
  let sum = 0;
  let count = 0;
  for (let i = 0; i < bytes; i += step) {
    sum += Math.abs(audio[i] - 128);
    count += 1;
  }
  const energy = count > 0 ? Math.min(1, sum / count / 128) : 0;
  const speechLikely = energy >= energyThreshold && bytes >= minBytes;
  return {
    version: VOICE_VAD_VERSION,
    bytes,
    energy: Number(energy.toFixed(4)),
    speechLikely,
    reason: speechLikely ? 'speech_energy' : 'low_energy',
  };
}

export type UtteranceBufferState = {
  parts: string[];
  lastSpeechAt: number;
  startedAt: number;
};

/**
 * Assemble partial transcripts into one utterance; flush on silence gap or max wait.
 */
export class VoiceUtteranceAssembler {
  private readonly silenceMs: number;
  private readonly maxWaitMs: number;
  private readonly minChars: number;
  private state: UtteranceBufferState | null = null;

  constructor(options: {
    silenceMs?: number;
    maxWaitMs?: number;
    minChars?: number;
  } = {}) {
    this.silenceMs = Math.max(50, Number(options.silenceMs || 900));
    this.maxWaitMs = Math.max(this.silenceMs, Number(options.maxWaitMs || 6000));
    this.minChars = Math.max(1, Number(options.minChars || 2));
  }

  public push(transcript: string, now = Date.now()): {
    ready: boolean;
    utterance: string | null;
    buffered: string;
  } {
    const text = String(transcript || '').trim();
    if (!text) {
      return this.poll(now);
    }
    if (!this.state) {
      this.state = { parts: [text], lastSpeechAt: now, startedAt: now };
    } else {
      this.state.parts.push(text);
      this.state.lastSpeechAt = now;
    }
    return this.poll(now);
  }

  /** Call on silence ticks / empty chunks. */
  public poll(now = Date.now()): {
    ready: boolean;
    utterance: string | null;
    buffered: string;
  } {
    if (!this.state) {
      return { ready: false, utterance: null, buffered: '' };
    }
    const buffered = this.state.parts.join(' ').replace(/\s+/g, ' ').trim();
    const silentFor = now - this.state.lastSpeechAt;
    const waited = now - this.state.startedAt;
    const longEnough = buffered.length >= this.minChars;
    if (longEnough && (silentFor >= this.silenceMs || waited >= this.maxWaitMs)) {
      this.state = null;
      return { ready: true, utterance: buffered, buffered: '' };
    }
    return { ready: false, utterance: null, buffered };
  }

  public forceFlush(): string | null {
    if (!this.state) return null;
    const buffered = this.state.parts.join(' ').replace(/\s+/g, ' ').trim();
    this.state = null;
    return buffered || null;
  }

  public reset(): void {
    this.state = null;
  }
}
