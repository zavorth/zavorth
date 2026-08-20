import {
  createBoundaryCorrelation,
  type ZavorthBoundaryCorrelation,
} from '../contracts/InternalBoundaryContract.js';
import type {
  EchoPermissionResolverContext,
} from '../tool-runtime/types/EchoTypes.js';
import type {
  EchoSpeechSynthesisFailure,
  EchoSpeechSynthesisSuccess,
} from '../domain/surface/application/EchoSpeechSynthesisService.js';
import type {
  EchoSurfaceOptions,
  NormalizedEchoSurfaceOptions,
} from './ZavorthEchoServiceTypes.js';

export function normalizeToolArgs(args: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(args || {}));
}

export function normalizeSurfaceOptions(options: EchoSurfaceOptions): NormalizedEchoSurfaceOptions {
  return {
    category: options.category,
    sessionId: String(options.sessionId || '').trim(),
    requestedBy: text(options.requestedBy, 'echo'),
    surface: text(options.surface, 'echo'),
  };
}

export function extractCorrelation(metadata: Record<string, unknown>): ZavorthBoundaryCorrelation | null {
  const raw = metadata?.correlation;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  return createBoundaryCorrelation(raw as Partial<ZavorthBoundaryCorrelation>);
}

export function normalizeResolverContext(
  input?: Partial<EchoPermissionResolverContext> | null,
): EchoPermissionResolverContext | null {
  if (!input) {
    return null;
  }
  const sessionId = optionalText(input.sessionId);
  const surface = optionalText(input.surface);
  const requestedBy = optionalText(input.requestedBy);
  if (!sessionId && !surface && !requestedBy) {
    return null;
  }
  return {
    sessionId,
    surface: surface || 'unknown',
    requestedBy: requestedBy || 'unknown',
    channel: optionalText(input.channel),
    chatId: optionalText(input.chatId),
    threadId: optionalText(input.threadId),
    userId: optionalText(input.userId),
  };
}

export function optionalText(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized.length > 0 ? normalized : null;
}

export function text(value: unknown, fallback: string): string {
  return String(value || '').trim() || fallback;
}

export function asSpeechSuccess(result: EchoSpeechSynthesisSuccess) {
  return {
    ok: true as const,
    audio: result.audio,
    mimeType: result.mimeType,
    model: result.model,
    voiceName: result.voiceName,
    languageCode: result.languageCode,
    latencyMs: result.latencyMs,
  };
}

export function asSpeechFailure(result: EchoSpeechSynthesisFailure) {
  return {
    ok: false as const,
    statusCode: result.statusCode,
    error: result.error,
  };
}
