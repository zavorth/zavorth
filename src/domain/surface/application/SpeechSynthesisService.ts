import fs from 'fs';
import { errorMessage } from '../../../utils/errorLike.js';
import type {
  EchoSpeechCostEstimator,
  EchoSpeechSynthesisProvider,
  EchoVoiceTelemetryInput,
  EchoVoiceTelemetryRecorder,
} from '../domain/EchoSpeechSynthesisPorts.js';

export const DEFAULT_ECHO_GEMINI_TTS_MODEL = 'gemini-2.5-flash';

export type EchoSpeechSynthesisInput = {
  text: string;
  surface?: string;
  requestedBy?: string;
  sessionId?: string;
  model?: string;
  voiceName?: string;
  languageCode?: string;
};

export type EchoSpeechSynthesisSuccess = {
  ok: true;
  audio: Buffer;
  mimeType: string;
  model: string | null;
  voiceName: string | null;
  languageCode: string | null;
  latencyMs: number;
  outputBytes: number;
  traceId: string;
};

export type EchoSpeechSynthesisFailure = {
  ok: false;
  statusCode: number;
  error: string;
  traceId: string;
};

type EchoSpeechSynthesisRuntime = {
  voiceTelemetry?: EchoVoiceTelemetryRecorder;
  geminiVoiceService?: EchoSpeechSynthesisProvider;
  costEstimator?: EchoSpeechCostEstimator;
};

const NOOP_VOICE_TELEMETRY: EchoVoiceTelemetryRecorder = {
  async recordSuccess() {
    // Observability is optional at this application boundary.
  },
  async recordFailure() {
    // Observability is optional at this application boundary.
  },
};

const UNAVAILABLE_VOICE_PROVIDER: EchoSpeechSynthesisProvider = {
  isConfigured() {
    return false;
  },
  async synthesizeDetailed() {
    return null;
  },
  cleanup() {
    // No file is created by the unavailable provider.
  },
};

/**
 * Shared Gemini TTS pipeline for Echo surfaces.
 * Centralizing it here keeps zavorthControl, agent and IoT surfaces on the same
 * model, telemetry and failure semantics.
 */
export class EchoSpeechSynthesisService {
  private readonly voiceTelemetry: EchoVoiceTelemetryRecorder;
  private readonly geminiVoiceService: EchoSpeechSynthesisProvider;
  private readonly costEstimator: EchoSpeechCostEstimator;

  constructor(runtime: EchoSpeechSynthesisRuntime = {}) {
    this.voiceTelemetry = runtime.voiceTelemetry || NOOP_VOICE_TELEMETRY;
    this.geminiVoiceService = runtime.geminiVoiceService || UNAVAILABLE_VOICE_PROVIDER;
    this.costEstimator = runtime.costEstimator || (() => null);
  }

  public async synthesize(
    input: EchoSpeechSynthesisInput,
  ): Promise<EchoSpeechSynthesisSuccess | EchoSpeechSynthesisFailure> {
    const cleanText = String(input.text || '').trim();
    const surface = this.text(input.surface, 'zavorthControl');
    const requestedBy = this.text(input.requestedBy, `${surface}-tts`);
    const sessionId = this.optionalText(input.sessionId);
    const traceId = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const requestedModel = this.optionalText(input.model) || DEFAULT_ECHO_GEMINI_TTS_MODEL;
    const requestedVoiceName = this.optionalText(input.voiceName);
    const requestedLanguageCode = this.optionalText(input.languageCode);

    if (!cleanText) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Field "input" is required.',
        traceId,
      };
    }

    if (!this.geminiVoiceService.isConfigured()) {
      await this.recordVoiceFailure({
        traceId,
        surface,
        provider: 'gemini',
        model: requestedModel,
        voiceName: requestedVoiceName,
        languageCode: requestedLanguageCode,
        inputChars: cleanText.length,
        latencyMs: 0,
        requestedBy,
        sessionId,
        error: 'Gemini Voice is not configured on this host.',
      });
      return {
        ok: false,
        statusCode: 503,
        error: 'Gemini Voice is not configured on this host.',
        traceId,
      };
    }

    let filePath: string | null = null;
    try {
      const detailed = await this.geminiVoiceService.synthesizeDetailed(cleanText, {
        model: requestedModel,
        voiceName: requestedVoiceName || undefined,
        languageCode: requestedLanguageCode || undefined,
      });
      if (!detailed?.filePath || !fs.existsSync(detailed.filePath)) {
        await this.recordVoiceFailure({
          traceId,
          surface,
          provider: 'gemini',
          model: detailed?.model || requestedModel,
          voiceName: detailed?.voiceName || requestedVoiceName,
          languageCode: detailed?.languageCode || requestedLanguageCode,
          inputChars: cleanText.length,
          latencyMs: detailed?.latencyMs || 0,
          requestedBy,
          sessionId,
          error: 'Gemini TTS did not return usable audio.',
        });
        return {
          ok: false,
          statusCode: 502,
          error: 'Gemini TTS did not return usable audio.',
          traceId,
        };
      }

      filePath = detailed.filePath;
      const audio = await fs.promises.readFile(detailed.filePath);
      await this.recordVoiceSuccess({
        traceId,
        surface,
        provider: 'gemini',
        model: detailed.model,
        voiceName: detailed.voiceName,
        languageCode: detailed.languageCode,
        inputChars: detailed.inputChars,
        latencyMs: detailed.latencyMs,
        mimeType: detailed.mimeType,
        outputBytes: detailed.outputBytes,
        estimatedCostUsd: this.costEstimator(detailed.inputChars),
        requestedBy,
        sessionId,
      });
      return {
        ok: true,
        audio,
        mimeType: detailed.mimeType,
        model: detailed.model,
        voiceName: detailed.voiceName,
        languageCode: detailed.languageCode,
        latencyMs: detailed.latencyMs,
        outputBytes: detailed.outputBytes,
        traceId,
      };
    } catch (error: unknown) {await this.recordVoiceFailure({
        traceId,
        surface,
        provider: 'gemini',
        model: requestedModel,
        voiceName: requestedVoiceName,
        languageCode: requestedLanguageCode,
        inputChars: cleanText.length,
        latencyMs: 0,
        requestedBy,
        sessionId,
        error: String(errorMessage(error) || 'Failed to synthesize audio.'),
      });
      return {
        ok: false,
        statusCode: 502,
        error: errorMessage(error, 'Failed to synthesize audio.'),
        traceId,
      };
    } finally {
      if (filePath) {
        this.geminiVoiceService.cleanup(filePath);
      }
    }
  }

  private async recordVoiceSuccess(input: EchoVoiceTelemetryInput): Promise<void> {
    await this.voiceTelemetry.recordSuccess(input);
  }

  private async recordVoiceFailure(input: EchoVoiceTelemetryInput): Promise<void> {
    await this.voiceTelemetry.recordFailure(input);
  }

  private text(value: string | undefined, fallback: string): string {
    const normalized = this.optionalText(value);
    return normalized || fallback;
  }

  private optionalText(value: string | undefined): string | null {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}

export { EchoSpeechSynthesisService as SpeechSynthesisService };
