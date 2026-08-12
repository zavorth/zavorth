/**
 * Dry-run probes for STT/TTS configuration (Desktop Settings → Test).
 * Does not invent providers — only validates preference + policy.
 */

import {
  getVoicePreferenceService,
  type VoicePreferenceService,
} from './VoicePreferenceService.js';
import { resolveVoiceTts } from './VoiceTtsPolicy.js';
import { recordVoiceMetric } from './VoiceMetricsService.js';

export const VOICE_PROBE_VERSION = 'voice-probe/v1' as const;

export type VoiceProbeSttResult = {
  version: typeof VOICE_PROBE_VERSION;
  kind: 'stt';
  ok: boolean;
  code: string;
  message: string;
  providers: string[];
  model: string | null;
  language: string;
  source: string | null;
  configureHint?: string;
};

export type VoiceProbeTtsResult = {
  version: typeof VOICE_PROBE_VERSION;
  kind: 'tts';
  ok: boolean;
  code: string;
  message: string;
  provider: string | null;
  voiceId: string | null;
  /** Short phrase the client may speak via browser speechSynthesis */
  sampleText: string;
  clientSpeakRecommended: boolean;
};

export type VoiceProbeAllResult = {
  version: typeof VOICE_PROBE_VERSION;
  kind: 'all';
  stt: VoiceProbeSttResult;
  tts: VoiceProbeTtsResult;
  mode: string;
  describe: string;
};

export class VoiceProbeService {
  private readonly preferences: VoicePreferenceService;

  constructor(options: { voicePreferences?: VoicePreferenceService } = {}) {
    this.preferences = options.voicePreferences || getVoicePreferenceService();
  }

  public probeStt(): VoiceProbeSttResult {
    const pref = this.preferences.get();
    const resolved = this.preferences.resolveStt();
    const result: VoiceProbeSttResult = resolved.ok === true
      ? {
          version: VOICE_PROBE_VERSION,
          kind: 'stt',
          ok: true,
          code: 'stt_ready',
          message: `STT ready via ${resolved.source}: ${resolved.providers.join(', ')}`,
          providers: resolved.providers,
          model: resolved.model,
          language: resolved.language || pref.stt.language || 'auto',
          source: resolved.source,
        }
      : {
          version: VOICE_PROBE_VERSION,
          kind: 'stt',
          ok: false,
          code: resolved.code || 'stt_not_configured',
          message: `${resolved.message} Type your message instead.`,
          providers: [],
          model: null,
          language: pref.stt.language || 'auto',
          source: null,
          configureHint: resolved.configureHint,
        };

    recordVoiceMetric({
      kind: 'stt',
      ok: result.ok,
      code: result.code,
      message: result.message,
      provider: result.providers[0] || null,
      model: result.model,
      language: result.language,
      source: 'probe',
      surface: 'desktop',
    });
    return result;
  }

  public probeTts(sampleText?: string): VoiceProbeTtsResult {
    const pref = this.preferences.get();
    const sample =
      String(sampleText || '').trim() ||
      'Voice test. Zavorth will only speak when you enable TTS.';
    const resolved = resolveVoiceTts(
      {
        preference: pref,
        // Probe treats enabled TTS as sufficient even if mode is dictation/off
        explicitVoiceRequest: true,
        ttsReplyDesired: true,
      },
      this.preferences,
    );

    const result: VoiceProbeTtsResult = resolved.ok === true
      ? {
          version: VOICE_PROBE_VERSION,
          kind: 'tts',
          ok: true,
          code: 'tts_ready',
          message: `TTS ready (${resolved.provider}${resolved.voiceId ? ` / ${resolved.voiceId}` : ''}). Speak sample in client.`,
          provider: resolved.provider,
          voiceId: resolved.voiceId,
          sampleText: sample,
          clientSpeakRecommended: true,
        }
      : {
          version: VOICE_PROBE_VERSION,
          kind: 'tts',
          ok: false,
          code: resolved.code,
          message: resolved.reason,
          provider: null,
          voiceId: null,
          sampleText: sample,
          clientSpeakRecommended: false,
        };

    recordVoiceMetric({
      kind: 'tts',
      ok: result.ok,
      code: result.code,
      message: result.message,
      provider: result.provider,
      source: 'probe',
      surface: 'desktop',
      chars: sample.length,
    });
    return result;
  }

  public probeAll(): VoiceProbeAllResult {
    const pref = this.preferences.get();
    return {
      version: VOICE_PROBE_VERSION,
      kind: 'all',
      stt: this.probeStt(),
      tts: this.probeTts(),
      mode: pref.mode,
      describe: this.preferences.describe(),
    };
  }
}

let defaultProbe: VoiceProbeService | null = null;

export function getVoiceProbeService(): VoiceProbeService {
  if (!defaultProbe) defaultProbe = new VoiceProbeService();
  return defaultProbe;
}

export function resetVoiceProbeForTests(): void {
  defaultProbe = null;
}
