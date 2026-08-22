import { logger } from '../logger.js';
import { config } from '../config/index.js';
import type { AudioSynthesisOptions } from '../gateways/channels/telegram/AudioHandler.js';
import { logEchoTrace } from '../gateways/channels/telegram/EchoTrace.js';
import { asErrorLike } from '../utils/errorLike.js';
import { getVoicePreferenceService } from './voice/VoicePreferenceService.js';
import { resolveVoiceTts, shouldAttemptPreferenceTts } from './voice/VoiceTtsPolicy.js';
import { recordVoiceMetric } from './voice/VoiceMetricsService.js';

export type EchoOutputStageAudioHandler = {
  synthesize: (text: string, voiceIdOrOptions?: string | AudioSynthesisOptions) => Promise<string | null>;
  cleanup: (filePath: string) => void;
};

export type EchoOutputStagePreferenceStore = {
  isEchoModeActive: () => Promise<boolean>;
};

export type EchoOutputStageSink = {
  sendText: (text: string, options?: Record<string, unknown>) => Promise<unknown>;
  sendVoice?: (audioPath: string) => Promise<unknown>;
  sendChatAction?: (action: 'record_voice' | 'typing') => Promise<unknown>;
};

export type EchoOutputStageRequest = {
  surface: string;
  text: string;
  rawInput?: string;
  options?: Record<string, unknown>;
  sink: EchoOutputStageSink;
  traceId?: string | null;
  taskId?: string | null;
  requestedBy?: string | null;
  sessionId?: string | null;
  voiceFlow?: Record<string, unknown> | null;
  allowVoice?: boolean;
  fallbackToText?: boolean;
  preferredLanguageCode?: string | null;
  policyHint?: AudioSynthesisOptions['policyHint'];
  forceVoice?: boolean;
  /** Structured voice-reply request (UI / slash / session). Free text never sets this. */
  preferVoiceReply?: boolean;
  replyWithAudio?: boolean;
};

export type EchoOutputStageResult = {
  delivered: 'voice' | 'text';
  spokenChars?: number;
  ttsLatencyMs?: number;
};

type EchoOutputStageDeps = {
  audioHandler?: EchoOutputStageAudioHandler | null;
  preferenceStore?: EchoOutputStagePreferenceStore | null;
};

/**
 * Cross-surface output post-processr for Echo voice mode.
 *
 * Surfaces provide delivery primitives (text, optional voice, optional action)
 * and this output stage decides whether a reply should become voice or remain text.
 */
export class EchoOutputStageService {
  constructor(private readonly deps: EchoOutputStageDeps = {}) {}

  public async deliver(request: EchoOutputStageRequest): Promise<EchoOutputStageResult> {
    const text = String(request.text || '').trim();
    if (!text) {
      return { delivered: 'text' };
    }

    if (await this.tryDeliverVoice(request, text)) {
      return { delivered: 'voice', spokenChars: this.prepareSpokenText(text).length };
    }

    if (request.fallbackToText === false) {
      return { delivered: 'text' };
    }

    await request.sink.sendText(text, request.options);
    return { delivered: 'text' };
  }

  private async tryDeliverVoice(request: EchoOutputStageRequest, text: string): Promise<boolean> {
    const audioHandler = this.deps.audioHandler || null;
    const preferenceStore = this.deps.preferenceStore || null;
    const hasInteractiveControls = Boolean((request.options as Record<string, unknown> | undefined)?.reply_markup);
    const voiceAvailable = Boolean(request.sink.sendVoice);
    const voiceFlow = request.voiceFlow || {};
    // Structured flags only — free-text phrases never auto-enable voice replies.
    const explicitVoiceRequest = this.isExplicitVoiceReplyRequest(request);
    const voicePrefs = getVoicePreferenceService();
    const preference = voicePrefs.get();
    const allowLegacyEcho =
      process.env.ZAVORTH_VOICE_ALLOW_LEGACY_ECHO_TTS === '1' ||
      process.env.ZAVORTH_VOICE_ALLOW_LEGACY_ECHO_TTS === 'true';

    // prefer sovereign VoicePreference TTS over silent product defaults.
    const preferenceTts = resolveVoiceTts({
      preference,
      ttsReplyDesired: voiceFlow.ttsReplyDesired === true || request.preferVoiceReply === true,
      explicitVoiceRequest,
      allowLegacyEchoTts: allowLegacyEcho,
    });

    const wantsPreferenceTts = shouldAttemptPreferenceTts({
      voiceFlow: {
        ...voiceFlow,
        ttsReplyDesired:
          voiceFlow.ttsReplyDesired === true || request.preferVoiceReply === true || request.replyWithAudio === true,
      },
      forceVoice: request.forceVoice === true || explicitVoiceRequest,
      preference,
    });

    if (
      request.allowVoice === false ||
      !voiceAvailable ||
      !audioHandler ||
      hasInteractiveControls ||
      text.length >= 4000
    ) {
      return false;
    }

    // Preference path: conversation + tts.enabled (or explicit voice request with TTS configured)
    const usePreferenceTts = preferenceTts.ok && wantsPreferenceTts;

    // Legacy Echo path only when preference TTS is not driving the reply
    if (!usePreferenceTts) {
      if (!preferenceStore && !explicitVoiceRequest) {
        return false;
      }
      try {
        if (!explicitVoiceRequest && preferenceStore && !(await preferenceStore.isEchoModeActive())) {
          return false;
        }
      } catch {
        return false;
      }
      // An active legacy Echo preference is itself an explicit user choice. Keep it
      // compatible while VoicePreference remains the preferred configuration path.
    }

    try {
      const preferredLanguageCode =
        String(request.preferredLanguageCode || '').trim() ||
        this.resolvePreferredLanguageCode(request.rawInput || '', text);
      const policyHint = request.policyHint || this.resolvePolicyHint(text, preferredLanguageCode);
      const spokenText = this.prepareSpokenText(text, policyHint);
      if (!spokenText) {
        return false;
      }
      const traceId = String(request.traceId || '').trim();
      const ttsStartedAt = Date.now();

      if (traceId) {
        logEchoTrace(traceId, 'tts.started', {
          taskId: request.taskId || null,
          chars: spokenText.length,
          preferredLanguageCode,
          policyHint,
          surface: request.surface,
          llmMs: voiceFlow.llmLatencyMs || null,
          sttMs: voiceFlow.sttLatencyMs || null,
          ttsSource: usePreferenceTts ? 'voice_preference' : 'legacy_echo',
          ttsProvider: usePreferenceTts && preferenceTts.ok ? preferenceTts.provider : null,
        });
      }

      await request.sink.sendChatAction?.('record_voice').catch(() => undefined);

      const synthesisOptions: AudioSynthesisOptions = {
        preferredLanguageCode,
        policyHint,
        traceId,
        surface: request.surface,
        requestedBy: request.requestedBy || `${request.surface}-output-stage`,
        sessionId: request.sessionId || '',
      };
      if (usePreferenceTts && preferenceTts.ok) {
        if (preferenceTts.voiceId) {
          synthesisOptions.voiceId = preferenceTts.voiceId;
        }
        synthesisOptions.forceProvider = preferenceTts.forceProvider;
      }

      const audioPath = await audioHandler.synthesize(spokenText, synthesisOptions);
      if (!audioPath) {
        recordVoiceMetric({
          kind: 'tts',
          ok: false,
          surface: request.surface,
          message: 'synthesize returned empty path',
          source: usePreferenceTts ? 'voice_preference' : 'legacy_echo',
        });
        return false;
      }

      const ttsLatencyMs = Date.now() - ttsStartedAt;
      try {
        const sendStartedAt = Date.now();
        await request.sink.sendVoice!(audioPath);
        recordVoiceMetric({
          kind: 'tts',
          ok: true,
          surface: request.surface,
          provider: usePreferenceTts && preferenceTts.ok ? preferenceTts.provider : 'legacy_echo',
          latencyMs: ttsLatencyMs,
          chars: spokenText.length,
          language: preferredLanguageCode,
          source: usePreferenceTts ? 'voice_preference' : 'legacy_echo',
        });
        if (traceId) {
          logEchoTrace(traceId, 'voice.send.completed', {
            taskId: request.taskId || null,
            surface: request.surface,
            ttsMs: ttsLatencyMs,
            sendMs: Date.now() - sendStartedAt,
            totalMs: typeof voiceFlow.startedAtMs === 'number' ? Date.now() - Number(voiceFlow.startedAtMs) : null,
            downloadMs: voiceFlow.downloadLatencyMs || null,
            sttMs: voiceFlow.sttLatencyMs || null,
            llmMs: voiceFlow.llmLatencyMs || null,
          });
        }
        logger.info(
          `[EchoOutputStage] voice sent surface=${request.surface} chars=${spokenText.length} ttsMs=${ttsLatencyMs} sendMs=${Date.now() - sendStartedAt}`,
        );
      } finally {
        audioHandler.cleanup(audioPath);
      }

      return true;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error || 'unknown error');
      recordVoiceMetric({
        kind: 'tts',
        ok: false,
        surface: request.surface,
        message,
        source: 'echo_output_stage',
      });
      if (request.traceId) {
        logEchoTrace(request.traceId, 'voice.send.failed', {
          taskId: request.taskId || null,
          surface: request.surface,
          error: message,
        });
      }
      logger.warn(`[EchoOutputStage] voice failed, falling back to text: ${message}`);
      return false;
    }
  }

  private prepareSpokenText(text: string, policyHint: AudioSynthesisOptions['policyHint'] = 'default'): string {
    const normalized = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    const configuredMaxChars = Math.max(120, config.tools.media.audio.ttsMaxChars);
    const maxChars =
      policyHint === 'safety'
        ? Math.min(configuredMaxChars, 180)
        : policyHint === 'short_reply'
          ? Math.min(configuredMaxChars, 320)
          : configuredMaxChars;
    if (normalized.length <= maxChars) {
      return normalized;
    }

    const sentences = normalized
      .split(/(?<=[.!...])\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    let output = '';
    for (const sentence of sentences) {
      if (output && output.length + sentence.length + 1 > maxChars) {
        break;
      }
      output = output ? `${output} ${sentence}` : sentence;
    }

    return (output || normalized.slice(0, maxChars)).trim();
  }

  private resolvePolicyHint(spokenText: string, _preferredLanguageCode: string): AudioSynthesisOptions['policyHint'] {
    const normalized = String(spokenText || '').trim();

    if (normalized.length <= 900) {
      return 'short_reply';
    }

    return normalized.length > 1200 ? 'long_reply' : 'short_reply';
  }

  private resolvePreferredLanguageCode(rawInput: string, _responseText: string): string {
    const detected = String(rawInput || '')
      .match(/Detected language:\s*([a-z]{2}(?:-[A-Z]{2})?)/i)
      ?.at(1)
      ?.trim();
    if (detected) {
      return detected;
    }
    return 'auto';
  }

  /**
   * Voice-reply product activation is structured-only.
   * Free-text phrases in rawInput/response never flip voice delivery.
   */
  private isExplicitVoiceReplyRequest(request: EchoOutputStageRequest): boolean {
    if (request.forceVoice === true) return true;
    if (request.preferVoiceReply === true) return true;
    if (request.replyWithAudio === true) return true;

    const flow = request.voiceFlow || {};
    if (flow.forceVoice === true) return true;
    if (flow.preferVoiceReply === true) return true;
    if (flow.replyWithAudio === true) return true;
    if (flow.ttsReplyDesired === true) return true;
    if (flow.dictationMode === 'conversation') return true;

    return false;
  }
}

export { EchoOutputStageService as OutputStageService };
