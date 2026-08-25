import fs from 'fs';
import type { GeminiVoiceServiceTtsProviderConfig } from '../TtsProviderConfigSchema.js';
import { resolveTtsApiKey } from '../TtsProviderConfigSchema.js';
import type {
  ISpeechSynthesisAdapter,
  TtsSynthesizeInput,
  TtsSynthesizeOutput,
  TtsTransportType,
  TtsVoiceInfo,
} from '../SpeechSynthesisContract.js';
import { ttsEvidence } from '../TtsAdapterUtils.js';
import { GeminiVoiceService } from '../../../../providers/GeminiVoiceService.js';

export type GeminiVoiceServiceLike = Pick<
  GeminiVoiceService,
  'isConfigured' | 'synthesizeDetailed' | 'cleanup'
>;

type GeminiVoiceServiceDeps = { voiceService?: GeminiVoiceServiceLike };

/**
 * Gemini voice service transport adapter.
 * Exposes the local GeminiVoiceService through the neutral TTS adapter seam so
 * any channel/tool can synthesize speech without knowing provider internals.
 * The service writes PCM16 audio as a WAV temp file; this adapter reads the
 * bytes back and guarantees file cleanup.
 */
export class GeminiVoiceSynthesisAdapter implements ISpeechSynthesisAdapter {
  public readonly providerId: string;
  public readonly transport: TtsTransportType = 'gemini-voice-service';
  public readonly modelId: string | null;
  public readonly defaultVoiceId: string | null;

  private readonly config: GeminiVoiceServiceTtsProviderConfig;
  private readonly voiceService: GeminiVoiceServiceLike;

  constructor(config: GeminiVoiceServiceTtsProviderConfig, dependencies: GeminiVoiceServiceDeps = {}) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
    this.defaultVoiceId = config.defaultVoiceId || null;
    this.voiceService = dependencies.voiceService || new GeminiVoiceService(this.serviceOptions());
  }

  public isAvailable(): boolean {
    return this.voiceService.isConfigured();
  }

  public listVoices(): TtsVoiceInfo[] {
    return this.config.voices.map((voice) => ({
      id: voice.id,
      name: voice.name,
      language: voice.language,
      gender: voice.gender,
    }));
  }

  public async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    const voiceName = input.voiceId || this.defaultVoiceId || '';
    const languageCode = input.language || this.config.languageCode || 'en-US';
    const model = input.modelId || this.modelId;

    const startedAt = Date.now();
    const result = await this.voiceService.synthesizeDetailed(input.text, {
      ...(model ? { model } : {}),
      voiceName,
      languageCode,
    });
    if (!result) {
      throw new Error('Gemini voice synthesis returned no audio.');
    }

    try {
      const audio = await fs.promises.readFile(result.filePath);
      return {
        audio,
        format: 'wav',
        contentType: 'audio/wav',
        providerEvidence: ttsEvidence(this.providerId, result.model, {
          mode: 'batch',
          transport: 'gemini-voice-service',
          voiceName: result.voiceName,
          languageCode: result.languageCode,
          latencyMs: Date.now() - startedAt,
          outputBytes: result.outputBytes,
        }),
      };
    } finally {
      this.voiceService.cleanup(result.filePath);
    }
  }

  private serviceOptions() {
    const apiKey = resolveTtsApiKey(this.config);
    return {
      ...(apiKey ? { apiKey } : {}),
      ...(this.config.apiBaseUrl ? { apiBaseUrl: this.config.apiBaseUrl } : {}),
      ...(this.modelId ? { model: this.modelId } : {}),
      ...(this.defaultVoiceId ? { voiceName: this.defaultVoiceId } : {}),
      ...(this.config.languageCode ? { languageCode: this.config.languageCode } : {}),
    };
  }
}
