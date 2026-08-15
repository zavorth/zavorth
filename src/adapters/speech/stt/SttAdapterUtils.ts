import type {
  SpeechProviderEvidence,
  SpeechTranscriptSegment,
} from '../../../contracts/core/SpeechContract.js';
import type { SttWordTimestamp } from './SpeechTranscriptionContract.js';

/**
 * Time unit used by a provider payload. Word/segment start-end fields are
 * normalized into milliseconds via {@link sttTimeToMs}.
 */
export type SttTimeUnit = 'seconds' | 'milliseconds' | 'ticks';

/**
 * Converts a provider time value into milliseconds.
 * - 'seconds': OpenAI/Deepgram word and segment timestamps (e.g. 12.5).
 * - 'milliseconds': whisper.cpp JSON timestamps.
 * - 'ticks': Azure REST offset/duration in 100-nanosecond ticks.
 */
export function sttTimeToMs(value: unknown, unit: SttTimeUnit): number | null {
  const number = sttNumberOrNull(value);
  if (number === null) {
    return null;
  }
  if (unit === 'seconds') {
    return number * 1000;
  }
  if (unit === 'ticks') {
    return number / 10_000;
  }
  return number;
}

/**
 * Shared helper functions for STT transport adapters.
 * Keeps normalization logic in one place instead of duplicating it per transport.
 */

export function sttReadPath(payload: unknown, pathExpression: string): unknown {
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

export function sttStringOrEmpty(value: unknown): string {
  return String(value || '').trim();
}

export function sttNumberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function sttReadError(payload: unknown, status: number): string {
  return String(
    sttReadPath(payload, 'error.message')
    || sttReadPath(payload, 'message')
    || sttReadPath(payload, 'error')
    || `HTTP ${status}`,
  );
}

export async function sttReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error: unknown) {
    return null;
  }
}

/**
 * Reads a start/end timestamp from a segment or word item, normalizing the
 * provider's native unit into milliseconds.
 * Accepts `startMs`/`endMs` (already ms), Azure `Offset`/`Duration` ticks,
 * whisper.cpp `timestamps.from`/`to` (ms) and unit-converted `start`/`end`.
 */
function sttReadStartMs(item: unknown, unit: SttTimeUnit): number | null {
  const explicitMs = sttNumberOrNull(sttReadPath(item, 'startMs'));
  if (explicitMs !== null) return explicitMs;
  const offsetTicks = sttNumberOrNull(sttReadPath(item, 'Offset'));
  if (offsetTicks !== null) return offsetTicks / 10_000;
  const fromTimestamp = sttNumberOrNull(sttReadPath(item, 'timestamps.from'));
  if (fromTimestamp !== null) return fromTimestamp;
  return sttTimeToMs(sttReadPath(item, 'start'), unit);
}

function sttReadEndMs(item: unknown, unit: SttTimeUnit): number | null {
  const explicitMs = sttNumberOrNull(sttReadPath(item, 'endMs'));
  if (explicitMs !== null) return explicitMs;
  const offsetTicks = sttNumberOrNull(sttReadPath(item, 'Offset'));
  if (offsetTicks !== null) {
    const durationTicks = sttNumberOrNull(sttReadPath(item, 'Duration'));
    return (offsetTicks + (durationTicks || 0)) / 10_000;
  }
  const toTimestamp = sttNumberOrNull(sttReadPath(item, 'timestamps.to'));
  if (toTimestamp !== null) return toTimestamp;
  return sttTimeToMs(sttReadPath(item, 'end'), unit);
}

export function sttBuildSegments(
  payload: unknown,
  text: string,
  speakerLabels?: boolean,
  segmentsPath = 'segments',
  unit: SttTimeUnit = 'seconds',
): SpeechTranscriptSegment[] {
  const segments = sttReadPath(payload, segmentsPath);
  if (Array.isArray(segments)) {
    return segments.map((segment, index) => ({
      text: sttStringOrEmpty(sttReadPath(segment, 'text')) || text,
      startMs: sttReadStartMs(segment, unit),
      endMs: sttReadEndMs(segment, unit),
      speakerId: sttStringOrEmpty(sttReadPath(segment, 'speakerId') || sttReadPath(segment, 'speaker'))
        || (speakerLabels ? `speaker-${index + 1}` : null),
      confidence: sttNumberOrNull(sttReadPath(segment, 'confidence')),
    }));
  }
  return [{
    text,
    startMs: 0,
    endMs: null,
    speakerId: speakerLabels ? 'speaker-1' : null,
    confidence: sttNumberOrNull(
      sttReadPath(payload, 'confidence')
      || sttReadPath(payload, 'results.channels.0.alternatives.0.confidence'),
    ),
  }];
}

/**
 * Extracts real word-level timestamps from a provider payload.
 * When `wordsPath` is configured (Deepgram: alternatives.words), it is read
 * directly; otherwise OpenAI verbose_json `segments[].words[]` is collected.
 */
export function sttBuildWords(
  payload: unknown,
  wordsPath?: string,
  unit: SttTimeUnit = 'seconds',
): SttWordTimestamp[] {
  const words: SttWordTimestamp[] = [];
  const collect = (raw: unknown): void => {
    if (!Array.isArray(raw)) return;
    for (const item of raw) {
      if (item === null || typeof item !== 'object') continue;
      const word = sttStringOrEmpty(
        sttReadPath(item, 'word') || sttReadPath(item, 'text'),
      );
      if (!word) continue;
      words.push({
        word,
        startMs: sttReadStartMs(item, unit),
        endMs: sttReadEndMs(item, unit),
        confidence: sttNumberOrNull(sttReadPath(item, 'confidence')),
      });
    }
  };

  if (wordsPath) {
    collect(sttReadPath(payload, wordsPath));
    return words;
  }

  const segments = sttReadPath(payload, 'segments');
  if (Array.isArray(segments)) {
    for (const segment of segments) {
      collect(sttReadPath(segment, 'words'));
    }
  }
  return words;
}

export function sttEvidence(
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
