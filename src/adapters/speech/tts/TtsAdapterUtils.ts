import type { SpeechProviderEvidence } from '../../../contracts/core/SpeechContract.js';

/**
 * Shared helper functions for TTS transport adapters.
 * Keeps normalization logic in one place instead of duplicating it per transport.
 */

export function ttsReadPath(payload: unknown, pathExpression: string): unknown {
  return String(pathExpression || '')
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((current, part) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (Array.isArray(current) && /^\d+$/.test(part)) {
        return current[Number(part)];
      }
      if (typeof current === 'object') {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, payload);
}

export function ttsStringOrEmpty(value: unknown): string {
  return String(value || '').trim();
}

export function ttsReadError(payload: unknown, status: number): string {
  return String(
    ttsReadPath(payload, 'error.message')
    || ttsReadPath(payload, 'message')
    || ttsReadPath(payload, 'error')
    || `HTTP ${status}`,
  );
}

export async function ttsReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error: unknown) {
    return null;
  }
}

export function ttsEvidence(
  providerId: string,
  modelId: string | null,
  metadata: Record<string, unknown>,
): SpeechProviderEvidence {
  return {
    providerId,
    modelId,
    metadata: {
      ...metadata,
      secretValuesSerialized: false,
    },
  };
}

/**
 * Correct XML escaping. The legacy tool escaped `'` as `&after;` which is not a
 * valid XML entity; the proper escape is `&apos;`.
 */
export function ttsXmlEscape(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds Azure-compatible SSML from plain text.
 * When `ssml` is true the raw text is returned verbatim (caller owns markup).
 */
export function ttsBuildSsml(input: {
  text: string;
  voice: string;
  language: string;
  speed: number;
  pitch: number;
  ssml?: boolean;
}): string {
  if (input.ssml) {
    return input.text;
  }
  const ratePercent = Math.round((input.speed - 1) * 100);
  const pitchHz = input.pitch !== 0 ? `${input.pitch}Hz` : '+0Hz';
  const safeText = ttsXmlEscape(input.text);
  return `<speak version='1.0' xml:lang='${ttsXmlEscape(input.language)}'>`
    + `<voice name='${ttsXmlEscape(input.voice)}'>`
    + `<prosody rate='${ratePercent}%' pitch='${pitchHz}'>${safeText}</prosody>`
    + `</voice></speak>`;
}

/**
 * Wraps raw PCM16 audio into a RIFF/WAVE container. Gemini TTS returns
 * PCM16 payloads that need this header before they are playable.
 */
export function ttsWrapPcmAsWav(
  pcmData: Buffer,
  options: { sampleRate: number; channels: number },
): Buffer {
  const { sampleRate, channels } = options;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([header, pcmData]);
}

/**
 * Maps a requested output format (mp3/wav/ogg) to a MIME content type.
 */
export function ttsContentTypeFor(format: string): string {
  const normalized = String(format || '').toLowerCase();
  if (normalized.includes('wav')) return 'audio/wav';
  if (normalized.includes('ogg') || normalized.includes('opus')) return 'audio/ogg';
  if (normalized.includes('aiff')) return 'audio/aiff';
  return 'audio/mpeg';
}
