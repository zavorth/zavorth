import {
  applyAgc,
  downmixToMono,
  improvedSpeechRms,
  preparePcmForStt,
  resamplePcmInt16,
} from '../../src/services/voice/VoiceAudioQuality.js';
import { pcmRms } from '../../src/services/voice/VoicePcmWav.js';

describe('VoiceAudioQuality', () => {
  it('downmixes stereo Int16 to mono by averaging channels', () => {
    // Interleaved L/R: [1000, 3000, -2000, -4000] → frames [2000, -3000]
    const stereo = new Int16Array([1000, 3000, -2000, -4000]);
    const mono = downmixToMono(stereo, 2);
    expect(mono.length).toBe(2);
    expect(mono[0]).toBe(2000);
    expect(mono[1]).toBe(-3000);
  });

  it('downmix respects explicit frame count', () => {
    const stereo = new Int16Array([10, 30, 50, 70, 90, 110]);
    const mono = downmixToMono(stereo, 2, 2);
    expect(mono.length).toBe(2);
    expect(mono[0]).toBe(20);
    expect(mono[1]).toBe(60);
  });

  it('resample length is roughly correct for 48k → 16k', () => {
    const fromRate = 48000;
    const toRate = 16000;
    const durationSec = 0.25;
    const input = new Int16Array(Math.floor(fromRate * durationSec));
    for (let i = 0; i < input.length; i += 1) {
      input[i] = Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / fromRate));
    }
    const out = resamplePcmInt16(input, fromRate, toRate);
    const expected = Math.round(input.length * (toRate / fromRate));
    // Allow small rounding slack
    expect(Math.abs(out.length - expected)).toBeLessThanOrEqual(2);
    expect(out.length).toBeGreaterThan(1000);
  });

  it('identity resample returns same length', () => {
    const samples = new Int16Array([1, 2, 3, 4, 5]);
    const out = resamplePcmInt16(samples, 16000, 16000);
    expect(out.length).toBe(5);
    expect([...out]).toEqual([1, 2, 3, 4, 5]);
  });

  it('AGC increases quiet signal toward target RMS', () => {
    const quiet = new Int16Array(2000);
    for (let i = 0; i < quiet.length; i += 1) {
      quiet[i] = i % 2 === 0 ? 200 : -200;
    }
    const before = pcmRms(quiet);
    const boosted = applyAgc(quiet, { targetRms: 0.12, maxGain: 20 });
    const after = pcmRms(boosted);
    expect(before).toBeGreaterThan(0);
    expect(after).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(0.05);
  });

  it('preparePcmForStt outputs 16k mono', () => {
    // Quiet stereo at 48 kHz, ~100 ms
    const frames = 4800;
    const stereo = new Int16Array(frames * 2);
    for (let i = 0; i < frames; i += 1) {
      const v = Math.round(300 * Math.sin((2 * Math.PI * 300 * i) / 48000));
      stereo[i * 2] = v;
      stereo[i * 2 + 1] = v;
    }
    const prepared = preparePcmForStt({
      samples: stereo,
      sampleRate: 48000,
      channels: 2,
    });
    expect(prepared.sampleRate).toBe(16000);
    expect(prepared.channels).toBe(1);
    const expectedLen = Math.round(frames * (16000 / 48000));
    expect(Math.abs(prepared.samples.length - expectedLen)).toBeLessThanOrEqual(2);
    // AGC should lift quiet speech
    expect(pcmRms(prepared.samples)).toBeGreaterThan(0.04);
  });

  it('improvedSpeechRms is stable with DC offset', () => {
    const pure = new Int16Array(1000);
    const biased = new Int16Array(1000);
    for (let i = 0; i < 1000; i += 1) {
      const v = i % 2 === 0 ? 4000 : -4000;
      pure[i] = v;
      biased[i] = v + 5000;
    }
    const a = improvedSpeechRms(pure);
    const b = improvedSpeechRms(biased);
    expect(a).toBeGreaterThan(0.1);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
  });
});
