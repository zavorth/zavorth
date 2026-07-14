/**
 * Pure PCM utilities for server-side voice quality before STT.
 * Mono downmix, simple AGC, linear resample → 16 kHz mono.
 */

import { pcmRms } from './VoicePcmWav.js';

export const VOICE_AUDIO_QUALITY_VERSION = 'voice-audio-quality/v1' as const;

const DEFAULT_TARGET_RMS = 0.12;
const DEFAULT_MAX_GAIN = 12;
const STT_SAMPLE_RATE = 16000 as const;

/**
 * Average interleaved multi-channel Int16 PCM into mono.
 * If already mono (channels <= 1), returns a copy.
 */
export function downmixToMono(
  samples: Int16Array,
  channels: number,
  frames?: number,
): Int16Array {
  const ch = Math.max(1, Math.floor(channels || 1));
  if (ch <= 1) {
    return Int16Array.from(samples);
  }
  const nFrames =
    frames != null && frames > 0
      ? Math.min(frames, Math.floor(samples.length / ch))
      : Math.floor(samples.length / ch);
  const out = new Int16Array(nFrames);
  for (let i = 0; i < nFrames; i += 1) {
    let sum = 0;
    const base = i * ch;
    for (let c = 0; c < ch; c += 1) {
      sum += samples[base + c] || 0;
    }
    out[i] = Math.max(-32768, Math.min(32767, Math.round(sum / ch)));
  }
  return out;
}

/**
 * Simple RMS-based automatic gain control with a hard max gain clamp.
 */
export function applyAgc(
  samples: Int16Array,
  options?: { targetRms?: number; maxGain?: number },
): Int16Array {
  const targetRms = Math.max(0.01, Number(options?.targetRms ?? DEFAULT_TARGET_RMS));
  const maxGain = Math.max(1, Number(options?.maxGain ?? DEFAULT_MAX_GAIN));
  if (!samples.length) return new Int16Array(0);

  const rms = pcmRms(samples);
  if (rms < 1e-6) {
    return Int16Array.from(samples);
  }

  const gain = Math.min(maxGain, targetRms / rms);
  // Skip tiny adjustments to avoid needless copies
  if (Math.abs(gain - 1) < 0.03) {
    return Int16Array.from(samples);
  }

  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i]! * gain)));
  }
  return out;
}

/**
 * Linear-interpolation resample of mono Int16 PCM.
 * Default destination rate is 16 kHz (Whisper / common STT).
 */
export function resamplePcmInt16(
  samples: Int16Array,
  fromRate: number,
  toRate: number = STT_SAMPLE_RATE,
): Int16Array {
  const srcRate = Math.max(1, Math.floor(fromRate || STT_SAMPLE_RATE));
  const dstRate = Math.max(1, Math.floor(toRate || STT_SAMPLE_RATE));
  if (!samples.length || srcRate === dstRate) {
    return Int16Array.from(samples);
  }

  const ratio = srcRate / dstRate;
  const outLen = Math.max(1, Math.round(samples.length / ratio));
  const out = new Int16Array(outLen);
  const last = samples.length - 1;

  for (let i = 0; i < outLen; i += 1) {
    const src = i * ratio;
    const i0 = Math.min(last, Math.floor(src));
    const i1 = Math.min(last, i0 + 1);
    const frac = src - i0;
    const a = samples[i0] || 0;
    const b = samples[i1] || 0;
    out[i] = Math.max(
      -32768,
      Math.min(32767, Math.round(a * (1 - frac) + b * frac)),
    );
  }
  return out;
}

/**
 * Speech RMS with DC bias removed (slightly more stable than raw pcmRms).
 */
export function improvedSpeechRms(samples: Int16Array): number {
  if (!samples.length) return 0;
  let mean = 0;
  for (let i = 0; i < samples.length; i += 1) {
    mean += samples[i] || 0;
  }
  mean /= samples.length;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = ((samples[i] || 0) - mean) / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Full STT prep: mono → AGC → 16 kHz mono.
 */
export function preparePcmForStt(input: {
  samples: Int16Array;
  sampleRate: number;
  channels?: number;
}): { samples: Int16Array; sampleRate: 16000; channels: 1 } {
  const channels = Math.max(1, Math.floor(input.channels || 1));
  let samples =
    channels > 1
      ? downmixToMono(input.samples, channels)
      : Int16Array.from(input.samples);

  samples = applyAgc(samples);
  samples = resamplePcmInt16(samples, input.sampleRate, STT_SAMPLE_RATE);

  return {
    samples,
    sampleRate: STT_SAMPLE_RATE,
    channels: 1,
  };
}
