/**
 * Phase 3 — TTS only under user VoicePreference (no silent Kore/default cascade as product policy).
 */

import type { VoicePreference } from '../../contracts/voice/VoicePreferenceContract.js';
import {
  getVoicePreferenceService,
  type VoicePreferenceService,
} from './VoicePreferenceService.js';

export const VOICE_TTS_POLICY_VERSION = 'voice-tts-policy/v1' as const;

export type VoiceTtsResolveOk = {
  ok: true;
  version: typeof VOICE_TTS_POLICY_VERSION;
  provider: 'edge-tts' | 'gemini';
  voiceId: string | null;
  /** Pass to AudioHandler.synthesize forceProvider */
  forceProvider: 'edge-tts' | 'gemini';
  source: 'preference' | 'force_request';
  reason: string;
};

export type VoiceTtsResolveFail = {
  ok: false;
  version: typeof VOICE_TTS_POLICY_VERSION;
  code: 'tts_disabled' | 'tts_not_configured' | 'mode_blocks_tts';
  reason: string;
};

export type VoiceTtsResolveResult = VoiceTtsResolveOk | VoiceTtsResolveFail;

export type ResolveVoiceTtsInput = {
  preference?: VoicePreference | null;
  /**
   * From dictation ingress: conversation mode asked for spoken reply.
   */
  ttsReplyDesired?: boolean;
  /**
   * Explicit "reply in voice" in user text / forceVoice flag.
   * Still requires TTS to be configured when preference is the source of truth.
   */
  explicitVoiceRequest?: boolean;
  /**
   * Legacy Echo mode (bridge preference). Used only when VoicePreference TTS is off
   * and ZAVORTH_VOICE_ALLOW_LEGACY_ECHO_TTS=true.
   */
  allowLegacyEchoTts?: boolean;
};

/**
 * Decide whether TTS may run and which voice/provider to use.
 * Default: no TTS until user enables tts.enabled + provider.
 */
export function resolveVoiceTts(
  input: ResolveVoiceTtsInput = {},
  voicePreferences?: VoicePreferenceService,
): VoiceTtsResolveResult {
  const prefs = voicePreferences || getVoicePreferenceService();
  const preference = input.preference || prefs.get();
  const tts = preference.tts;
  const mode = preference.mode;

  const wantsSpoken =
    input.ttsReplyDesired === true ||
    input.explicitVoiceRequest === true ||
    mode === 'conversation';

  if (!wantsSpoken && !tts.enabled) {
    return {
      ok: false,
      version: VOICE_TTS_POLICY_VERSION,
      code: 'tts_disabled',
      reason: 'TTS not requested (enable conversation mode or tts.enabled).',
    };
  }

  if (!tts.enabled || tts.provider === 'none') {
    if (input.allowLegacyEchoTts && input.explicitVoiceRequest) {
      // Caller may still use legacy Echo path — signal not configured for preference TTS.
      return {
        ok: false,
        version: VOICE_TTS_POLICY_VERSION,
        code: 'tts_not_configured',
        reason:
          'VoicePreference TTS is off; legacy Echo TTS may apply if echo mode is active.',
      };
    }
    return {
      ok: false,
      version: VOICE_TTS_POLICY_VERSION,
      code: 'tts_not_configured',
      reason:
        'TTS is not configured. Enable with: `npx tsx scripts/zavorth-voice-pref.ts set --mode conversation --tts-enabled true --tts-provider edge-tts --tts-voice en-US-JennyNeural`',
    };
  }

  if (mode === 'off' && !input.explicitVoiceRequest && !input.ttsReplyDesired) {
    return {
      ok: false,
      version: VOICE_TTS_POLICY_VERSION,
      code: 'mode_blocks_tts',
      reason: 'Voice mode is off; set --mode conversation (or dictation + explicit voice request).',
    };
  }

  const provider = tts.provider === 'gemini' ? 'gemini' : 'edge-tts';

  return {
    ok: true,
    version: VOICE_TTS_POLICY_VERSION,
    provider,
    voiceId: tts.voiceId,
    forceProvider: provider,
    source: 'preference',
    reason: `preference tts provider=${provider} voiceId=${tts.voiceId || '(provider default)'}`,
  };
}

export function shouldAttemptPreferenceTts(input: {
  voiceFlow?: Record<string, unknown> | null;
  forceVoice?: boolean;
  rawInput?: string;
  preference?: VoicePreference | null;
}): boolean {
  const flow = input.voiceFlow || {};
  if (flow.ttsReplyDesired === true) return true;
  if (input.forceVoice === true) return true;
  const pref = input.preference || getVoicePreferenceService().get();
  if (pref.mode === 'conversation' && pref.tts.enabled) return true;
  return false;
}
