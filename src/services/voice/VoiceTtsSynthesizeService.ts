/**
 * Preference-aware TTS synthesis for Desktop / duplex (edge-tts | gemini via AudioHandler).
 * Returns base64 audio for browser playback — not silent speechSynthesis fallback only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { AudioHandler } from '../../gateways/channels/telegram/AudioHandler.js';
import {
  getVoicePreferenceService,
  type VoicePreferenceService,
} from './VoicePreferenceService.js';
import { resolveVoiceTts } from './VoiceTtsPolicy.js';
import { normalizeVoiceLanguage } from './VoiceLanguage.js';
import { recordVoiceMetric } from './VoiceMetricsService.js';

export const VOICE_TTS_SYNTH_VERSION = 'voice-tts-synth/v1' as const;

export type VoiceTtsSynthOk = {
  version: typeof VOICE_TTS_SYNTH_VERSION;
  ok: true;
  provider: 'edge-tts' | 'gemini';
  voiceId: string | null;
  mimeType: string;
  audioBase64: string;
  chars: number;
  latencyMs: number;
  fileName: string;
};

export type VoiceTtsSynthFail = {
  version: typeof VOICE_TTS_SYNTH_VERSION;
  ok: false;
  code: string;
  message: string;
};

export type VoiceTtsSynthResult = VoiceTtsSynthOk | VoiceTtsSynthFail;

export class VoiceTtsSynthesizeService {
  private readonly preferences: VoicePreferenceService;
  private readonly audioHandler: AudioHandler;

  constructor(options: {
    voicePreferences?: VoicePreferenceService;
    audioHandler?: AudioHandler;
  } = {}) {
    this.preferences = options.voicePreferences || getVoicePreferenceService();
    this.audioHandler = options.audioHandler || new AudioHandler();
  }

  public async synthesize(input: {
    text: string;
    /** Prefer preference language / STT language for voice selection */
    language?: string | null;
    surface?: string;
    /** Force even if mode is off when user explicitly tests */
    force?: boolean;
  }): Promise<VoiceTtsSynthResult> {
    const text = String(input.text || '').trim();
    if (!text) {
      return {
        version: VOICE_TTS_SYNTH_VERSION,
        ok: false,
        code: 'empty_text',
        message: 'Nothing to speak.',
      };
    }

    const pref = this.preferences.get();
    const resolved = resolveVoiceTts(
      {
        preference: pref,
        explicitVoiceRequest: input.force === true,
        ttsReplyDesired: true,
      },
      this.preferences,
    );

    if (!resolved.ok) {
      recordVoiceMetric({
        kind: 'tts',
        ok: false,
        code: resolved.code,
        message: resolved.reason,
        surface: input.surface || 'desktop',
        source: 'tts_synth',
      });
      return {
        version: VOICE_TTS_SYNTH_VERSION,
        ok: false,
        code: resolved.code,
        message: resolved.reason,
      };
    }

    const lang = normalizeVoiceLanguage(
      input.language || pref.stt.language || 'auto',
    );
    const t0 = Date.now();

    try {
      const filePath = await this.audioHandler.synthesize(text, {
        forceProvider: resolved.forceProvider,
        voiceId: resolved.voiceId || undefined,
        preferredLanguageCode: lang.isAuto ? undefined : lang.bcp47,
        surface: input.surface || 'desktop',
      });

      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(
          'TTS synthesis returned no audio file. Check edge-tts/gemini configuration. Type your message instead.',
        );
      }

      const buf = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase() || '.mp3';
      const mimeType =
        ext === '.wav'
          ? 'audio/wav'
          : ext === '.ogg'
            ? 'audio/ogg'
            : 'audio/mpeg';
      const latencyMs = Date.now() - t0;

      recordVoiceMetric({
        kind: 'tts',
        ok: true,
        provider: resolved.provider,
        latencyMs,
        chars: text.length,
        surface: input.surface || 'desktop',
        language: lang.whisper,
        source: 'tts_synth',
      });

      return {
        version: VOICE_TTS_SYNTH_VERSION,
        ok: true,
        provider: resolved.provider,
        voiceId: resolved.voiceId,
        mimeType,
        audioBase64: buf.toString('base64'),
        chars: text.length,
        latencyMs,
        fileName: path.basename(filePath),
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error || 'TTS failed');
      recordVoiceMetric({
        kind: 'tts',
        ok: false,
        message,
        provider: resolved.provider,
        surface: input.surface || 'desktop',
        source: 'tts_synth',
      });
      return {
        version: VOICE_TTS_SYNTH_VERSION,
        ok: false,
        code: 'tts_failed',
        message: `${message}. Type your message instead.`,
      };
    }
  }
}

let defaultSynth: VoiceTtsSynthesizeService | null = null;

export function getVoiceTtsSynthesizeService(): VoiceTtsSynthesizeService {
  if (!defaultSynth) defaultSynth = new VoiceTtsSynthesizeService();
  return defaultSynth;
}

export function resetVoiceTtsSynthesizeForTests(): void {
  defaultSynth = null;
}
