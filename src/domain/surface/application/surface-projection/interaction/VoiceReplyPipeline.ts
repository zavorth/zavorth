/**
 * F5f — voice_reply affordance path.
 * Audio → STT (adapter) → text → parseSurfaceInteraction.
 * Default OFF on all presets; enable per surface when ready.
 */

import type { SurfaceProfile } from '../../surface-affordance/index.js';
import { isSurfaceAffordanceEnabled } from '../../surface-affordance/index.js';
import {
  SEMANTIC_INTERACTION_CONTRACT_VERSION,
  type SemanticInteractionEvent,
} from './SemanticInteractionContract.js';
import { parseSurfaceInteraction } from './parseSurfaceInteraction.js';
import { getDefaultZavorthSpeechToTextAdapter } from './ZavorthSpeechToTextBridge.js';
import { getVoicePreferenceService } from '../../../../../services/voice/VoicePreferenceService.js';

export const VOICE_REPLY_CONTRACT_VERSION = 'surface-voice-reply/v1' as const;

export type SpeechToTextResult = {
  text: string;
  confidence?: number | null;
  language?: string | null;
  provider?: string | null;
};

export type SpeechToTextAdapter = {
  transcribe(input: {
    audio: Buffer | Uint8Array | string;
    mimeType?: string | null;
    language?: string | null;
    surface?: string | null;
  }): Promise<SpeechToTextResult>;
};

export type ProcessVoiceReplyInput = {
  surface: string;
  profile?: SurfaceProfile | null;
  /** Precomputed transcript (skips STT). */
  transcript?: string | null;
  /** Raw audio when STT adapter is provided. */
  audio?: Buffer | Uint8Array | string | null;
  mimeType?: string | null;
  language?: string | null;
  stt?: SpeechToTextAdapter | null;
  actorId?: string | null;
  sessionId?: string | null;
  approvalId?: string | null;
  numberedOptions?: string[] | null;
  metadata?: Record<string, unknown>;
};

export type ProcessVoiceReplyResult =
  | {
      ok: true;
      transcript: string;
      event: SemanticInteractionEvent;
      stt?: SpeechToTextResult | null;
    }
  | {
      ok: false;
      error: string;
      code:
        | 'voice_reply_disabled'
        | 'stt_not_configured'
        | 'missing_transcript_and_audio'
        | 'missing_stt_adapter'
        | 'stt_failed'
        | 'empty_transcript';
      event?: SemanticInteractionEvent | null;
    };

export function isVoiceReplyEnabled(profile?: SurfaceProfile | null): boolean {
  if (!profile) return false;
  return isSurfaceAffordanceEnabled(profile, 'voice_reply');
}

function blockedEvent(
  input: ProcessVoiceReplyInput,
  reason: string,
  raw = '',
): SemanticInteractionEvent {
  return {
    version: SEMANTIC_INTERACTION_CONTRACT_VERSION,
    surface: String(input.surface || 'plain').toLowerCase(),
    kind: 'voice',
    controlId: null,
    optionId: null,
    approvalId: String(input.approvalId || input.metadata?.approvalId || '').trim() || null,
    choice: null,
    action: 'unknown',
    raw,
    actorId: input.actorId ?? null,
    sessionId: input.sessionId ?? null,
    metadata: {
      ...(input.metadata || {}),
      blocked: true,
      reason,
      voiceReplyContract: VOICE_REPLY_CONTRACT_VERSION,
    },
  };
}

/**
 * Process a voice reply into the same SemanticInteractionEvent as text/slash.
 * Does not execute approvals — caller uses toPermissionApprovalArgs(event).
 */
export async function processVoiceReply(
  input: ProcessVoiceReplyInput,
): Promise<ProcessVoiceReplyResult> {
  const surface = String(input.surface || 'plain').trim().toLowerCase() || 'plain';

  if (input.profile && !isVoiceReplyEnabled(input.profile)) {
    return {
      ok: false,
      code: 'voice_reply_disabled',
      error: 'voice_reply affordance is disabled for this surface profile',
      event: blockedEvent(input, 'voice_reply_disabled'),
    };
  }

  let transcript = String(input.transcript || '').trim();
  let sttResult: SpeechToTextResult | null = null;

  if (!transcript) {
    // Phase 1: refuse silent product defaults — require user/env STT preference.
    const sttResolved = getVoicePreferenceService().resolveStt();
    if (!sttResolved.ok && !input.stt) {
      return {
        ok: false,
        code: 'stt_not_configured',
        error: `${sttResolved.message} ${sttResolved.configureHint}`,
        event: blockedEvent(input, 'stt_not_configured', sttResolved.message),
      };
    }

    const audio = input.audio;
    if (audio == null || (typeof audio === 'string' && !audio.trim())) {
      return {
        ok: false,
        code: 'missing_transcript_and_audio',
        error: 'Provide transcript or audio (STT uses your VoicePreference — no automatic model cascade)',
        event: blockedEvent(input, 'missing_transcript_and_audio'),
      };
    }
    // Prefer explicit adapter; otherwise Zavorth AudioTranscriptionService
    // (which also honors VoicePreference).
    const stt = input.stt || getDefaultZavorthSpeechToTextAdapter();
    try {
      sttResult = await stt.transcribe({
        audio,
        mimeType: input.mimeType,
        language: input.language,
        surface,
      });
      transcript = String(sttResult?.text || '').trim();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        code: 'stt_failed',
        error: `STT failed: ${message}`,
        event: blockedEvent(input, 'stt_failed', message),
      };
    }
  }

  if (!transcript) {
    return {
      ok: false,
      code: 'empty_transcript',
      error: 'Transcript is empty after STT',
      event: blockedEvent(input, 'empty_transcript'),
    };
  }

  const event =
    parseSurfaceInteraction({
      surface,
      raw: transcript,
      kindHint: 'text',
      actorId: input.actorId,
      sessionId: input.sessionId,
      numberedOptions: input.numberedOptions,
      metadata: {
        ...(input.metadata || {}),
        approvalId: input.approvalId ?? input.metadata?.approvalId ?? null,
        source: 'voice_reply',
        voiceReplyContract: VOICE_REPLY_CONTRACT_VERSION,
        sttProvider: sttResult?.provider ?? null,
        sttConfidence: sttResult?.confidence ?? null,
      },
    }) || blockedEvent(input, 'parse_failed', transcript);

  // Mark as voice kind while preserving parsed choice/action
  const voiceEvent: SemanticInteractionEvent = {
    ...event,
    kind: event.kind === 'unknown' ? 'voice' : event.kind,
    raw: transcript,
    metadata: {
      ...(event.metadata || {}),
      source: 'voice_reply',
      originalKind: event.kind,
      voiceReplyContract: VOICE_REPLY_CONTRACT_VERSION,
      transcript,
    },
  };

  return {
    ok: true,
    transcript,
    event: voiceEvent,
    stt: sttResult,
  };
}

/**
 * Minimal passthrough STT for tests / when host already transcribed.
 */
export function createPassthroughSpeechToText(
  fixedText?: string,
): SpeechToTextAdapter {
  return {
    async transcribe(input) {
      if (fixedText != null) {
        return { text: fixedText, provider: 'passthrough', confidence: 1 };
      }
      if (typeof input.audio === 'string') {
        return { text: input.audio, provider: 'passthrough', confidence: 1 };
      }
      return { text: '', provider: 'passthrough', confidence: 0 };
    },
  };
}
