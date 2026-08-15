import type {
  SpeechProviderEvidence,
  SpeechTranscriptSegment,
} from '../../../contracts/core/SpeechContract.js';

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

export function sttBuildSegments(
  payload: unknown,
  text: string,
  speakerLabels?: boolean,
  segmentsPath = 'segments',
): SpeechTranscriptSegment[] {
  const segments = sttReadPath(payload, segmentsPath);
  if (Array.isArray(segments)) {
    return segments.map((segment, index) => ({
      text: sttStringOrEmpty(sttReadPath(segment, 'text')) || text,
      startMs: sttNumberOrNull(sttReadPath(segment, 'startMs') || sttReadPath(segment, 'start')),
      endMs: sttNumberOrNull(sttReadPath(segment, 'endMs') || sttReadPath(segment, 'end')),
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
