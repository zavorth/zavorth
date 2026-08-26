/**
 * Audio Synthesis Service.
 * Channel-agnostic text-to-speech engine (edge-tts with Gemini TTS fallback),
 * serialized through a module-level queue with a process-wide synthesis cache.
 */

import { logger } from '../logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { config } from '../config/index.js';
import {
  estimateGeminiTtsCostUsd,
  EchoVoiceTelemetryService,
} from '../domain/observability/infrastructure/EchoVoiceTelemetryService.js';
import { GeminiVoiceService } from '../providers/GeminiVoiceService.js';
import {
  CapabilityUnavailableError,
  isCapabilityUnavailableError,
  loadOptionalDependency,
} from './OptionalCapabilityGuard.js';
import { asErrorLike } from '../utils/errorLike.js';

export type AudioSynthesisProvider = 'edge-tts' | 'gemini';

export interface MsEdgeTTSInstance {
  setMetadata(voice: string, outputFormat: string): Promise<void>;
  toStream(text: string): { audioStream: NodeJS.ReadableStream };
  close?(): void;
}

export interface MsEdgeTTSModule {
  new (): MsEdgeTTSInstance;
}

export interface AudioSynthesisOptions {
  voiceId?: string;
  preferredLanguageCode?: string;
  policyHint?: 'default' | 'short_reply' | 'long_reply' | 'safety';
  forceProvider?: AudioSynthesisProvider;
  traceId?: string;
  surface?: string;
  requestedBy?: string;
  sessionId?: string;
}

export interface AudioSynthesisServiceDeps {
  geminiVoiceService?: Pick<GeminiVoiceService, 'isConfigured' | 'synthesize' | 'cleanup'> & Partial<Pick<GeminiVoiceService, 'synthesizeDetailed'>>;
  loadEdgeTts?: () => Promise<{ MsEdgeTTS: MsEdgeTTSModule }>;
  voiceTelemetryService?: Pick<EchoVoiceTelemetryService, 'recordSuccess' | 'recordFailure'>;
  tmpDir?: string;
  onTrace?: (traceId: string, event: string, payload: Record<string, unknown>) => void;
}

let ttsQueue: Promise<unknown> = Promise.resolve();
const ttsCache = new Map<string, { buffer: Buffer; extension: string; expiresAt: number }>();

export class AudioSynthesisService {
  private readonly tmpDir: string;
  private readonly onTrace: ((traceId: string, event: string, payload: Record<string, unknown>) => void) | null;
  private readonly geminiVoiceService: Pick<GeminiVoiceService, 'isConfigured' | 'synthesize' | 'cleanup'> & Partial<Pick<GeminiVoiceService, 'synthesizeDetailed'>>;
  private readonly loadEdgeTts: () => Promise<{ MsEdgeTTS: MsEdgeTTSModule }>;
  private readonly voiceTelemetryService: Pick<EchoVoiceTelemetryService, 'recordSuccess' | 'recordFailure'>;

  constructor(deps: AudioSynthesisServiceDeps = {}) {
    this.tmpDir = deps.tmpDir || config.tmpDir;
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
    this.onTrace = deps.onTrace || null;
    this.geminiVoiceService = deps.geminiVoiceService || new GeminiVoiceService();
    this.loadEdgeTts = deps.loadEdgeTts || defaultEdgeTtsLoader;
    this.voiceTelemetryService = deps.voiceTelemetryService || new EchoVoiceTelemetryService();
  }

  /**
   * Synthesizes text to audio using local Edge-TTS with Gemini TTS fallback.
   */
  public async synthesize(text: string, voiceIdOrOptions?: string | AudioSynthesisOptions): Promise<string | null> {
    const run = ttsQueue
      .catch(() => undefined)
      .then(() => this.synthesizeInternal(text, voiceIdOrOptions));
    ttsQueue = run.catch(() => undefined);
    return await run;
  }

  private async synthesizeInternal(
    text: string,
    voiceIdOrOptions?: string | AudioSynthesisOptions,
  ): Promise<string | null> {
    const ttsStartedAt = Date.now();
    const options = this.normalizeSynthesisOptions(voiceIdOrOptions);
    const outputFile = path.join(this.tmpDir, `tts_${Date.now()}.mp3`);
    const cleanText = this.cleanTextForTTS(text);
    this.getAudioConfig();
    const responseLanguageCode =
      this.normalizeLanguageCode(options.preferredLanguageCode) || this.detectLanguageCode(cleanText);
    const edgeVoice = this.resolveEdgeVoice(responseLanguageCode, options.voiceId);
    const providerOrder = this.resolveSynthesisProviderOrder(cleanText, responseLanguageCode, options, edgeVoice);
    const traceId = String(options.traceId || '').trim();
    this.emitTrace(traceId, 'tts.policy.selected', {
      providers: providerOrder.join('>'),
      languageCode: responseLanguageCode || 'auto',
      edgeVoice: edgeVoice.voice || 'none',
      chars: cleanText.length,
      policyHint: options.policyHint || 'default',
    }, () => {
      logger.info(
        `[AudioHandler] TTS policy providers=${providerOrder.join('>')} lang=${responseLanguageCode || 'auto'} edgeVoice=${edgeVoice.voice || 'none'} chars=${cleanText.length}`,
      );
    });

    const cacheKey = this.buildTtsCacheKey(cleanText, providerOrder[0], responseLanguageCode, edgeVoice.voice || '');
    const cachedPath = this.tryWriteCachedTts(cacheKey);
    if (cachedPath) {
      this.emitTrace(traceId, 'tts.cache.hit', {
        provider: providerOrder[0],
        chars: cleanText.length,
        languageCode: responseLanguageCode || 'auto',
      }, () => {
        logger.info(`[AudioHandler] TTS cache hit chars=${cleanText.length} path=${cachedPath}`);
      });
      return cachedPath;
    }

    let capabilityError: CapabilityUnavailableError | null = null;
    let lastGeminiError: Error | null = null;
    for (const provider of providerOrder) {
      if (provider === 'edge-tts') {
        try {
          const edgePath = await this.tryEdgeTts(
            cleanText,
            edgeVoice.voice,
            responseLanguageCode,
            outputFile,
            options,
          );
          if (edgePath) {
            this.rememberTtsCache(cacheKey, edgePath, '.mp3');
            return edgePath;
          }
        } catch (error: unknown) {if (isCapabilityUnavailableError(error)) {
            capabilityError = error;
            logger.warn('[AudioHandler] edge-tts unavailable. Trying next provider...');
          } else {
            logger.error(`[AudioHandler] local TTS error: ${error}`);
          }
        }
        continue;
      }

      if (provider === 'gemini' && this.geminiVoiceService.isConfigured()) {
        try {
          const geminiPath = await this.tryGeminiTts(
            cleanText,
            responseLanguageCode,
            capabilityError ? 'edge-tts' : null,
            options,
          );
          if (geminiPath) {
            this.rememberTtsCache(cacheKey, geminiPath, path.extname(geminiPath) || '.wav');
            return geminiPath;
          }
        } catch (error: unknown) {
          asErrorLike(error);
          lastGeminiError = error instanceof Error ? error : new Error(String(error));
          logger.error(`[AudioHandler] Gemini TTS error: ${error}`);
        }
      }
    }

    await this.recordVoiceFailure({
      provider: lastGeminiError ? 'gemini' : 'edge-tts',
      inputChars: cleanText.length,
      latencyMs: Date.now() - ttsStartedAt,
      requestedBy: options.requestedBy || 'system',
      traceId: traceId || null,
      surface: options.surface || 'unknown',
      sessionId: options.sessionId || null,
      fallbackFrom: capabilityError ? 'edge-tts' : null,
      error: lastGeminiError?.message || capabilityError?.message || 'Failed to synthesize audio.',
    });

    if (capabilityError) {
      throw capabilityError;
    }

    return null;
  }

  private emitTrace(
    traceId: string,
    event: string,
    payload: Record<string, unknown>,
    fallback?: () => void,
  ): void {
    if (!traceId) {
      fallback?.();
      return;
    }
    if (this.onTrace) {
      this.onTrace(traceId, event, payload);
      return;
    }
    fallback?.();
  }

  private normalizeSynthesisOptions(voiceIdOrOptions?: string | AudioSynthesisOptions): AudioSynthesisOptions {
    if (typeof voiceIdOrOptions === 'string') {
      return { voiceId: voiceIdOrOptions };
    }
    return voiceIdOrOptions || {};
  }

  private resolveEdgeVoice(languageCode: string, requestedVoiceId?: string): {
    voice: string;
    languageCode: string;
    mismatched: boolean;
  } {
    const requestedVoice = String(requestedVoiceId || '').trim();
    if (requestedVoice) {
      const requestedLanguage = this.extractLanguageFromVoiceName(requestedVoice) || languageCode || 'auto';
      return {
        voice: requestedVoice,
        languageCode: requestedLanguage,
        mismatched:
          Boolean(languageCode)
          && languageCode !== 'auto'
          && requestedLanguage !== 'auto'
          && !requestedLanguage.startsWith(languageCode.split('-')[0] || ''),
      };
    }

    const normalizedLanguage = this.normalizeLanguageCode(languageCode) || 'auto';
    const baseLanguage = normalizedLanguage.split('-')[0];
    const configuredVoice =
      baseLanguage === 'en'
        ? String(config.ttsVoiceEnglish || config.ttsVoice || '').trim()
        : baseLanguage === 'es'
          ? String(config.ttsVoiceSpanish || '').trim()
          : String(config.ttsVoice || '').trim();
    const configuredLanguage = this.extractLanguageFromVoiceName(configuredVoice) || (baseLanguage === 'pt' ? 'en-US' : normalizedLanguage);

    return {
      voice: configuredVoice,
      languageCode: configuredLanguage,
      mismatched: Boolean(normalizedLanguage && normalizedLanguage !== 'auto' && configuredLanguage && configuredLanguage !== 'auto')
        && configuredLanguage.split('-')[0] !== baseLanguage,
    };
  }

  private resolveSynthesisProviderOrder(
    text: string,
    languageCode: string,
    options: AudioSynthesisOptions,
    edgeVoice: { voice: string; languageCode: string; mismatched: boolean },
  ): AudioSynthesisProvider[] {
    if (options.forceProvider) {
      return options.forceProvider === 'gemini' ? ['gemini', 'edge-tts'] : ['edge-tts', 'gemini'];
    }

    const cleanText = String(text || '').trim();
    const audioConfig = this.getAudioConfig();
    const longReplyThreshold = Math.min(900, Math.max(audioConfig.ttsMaxChars + 40, 360));
    const explicitLongHint = options.policyHint === 'long_reply';
    const explicitShortHint = options.policyHint === 'short_reply' || options.policyHint === 'safety';
    const isLongReply = explicitLongHint || (!explicitShortHint && cleanText.length > longReplyThreshold);
    const languageMismatch = edgeVoice.mismatched || !edgeVoice.voice;

    if (
      options.surface === 'telegram'
      && cleanText.length <= 900
      && !languageMismatch
    ) {
      return ['edge-tts', 'gemini'];
    }

    if (isLongReply || languageMismatch) {
      return ['gemini', 'edge-tts'];
    }

    return ['edge-tts', 'gemini'];
  }

  private extractLanguageFromVoiceName(voiceName: string): string {
    const match = String(voiceName || '').trim().match(/^([a-z]{2}(?:-[A-Z]{2})?)/);
    return match?.[1] || '';
  }

  private normalizeLanguageCode(value: unknown): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }
    const lower = normalized.toLowerCase();
    if (lower === 'portuguese' || lower === 'pt') {
      logger.warn('[AudioSynthesis] Language "pt" not supported, falling back to "en-US"');
      return 'en-US';
    }
    if (lower === 'english' || lower === 'en') return 'en';
    if (lower === 'spanish' || lower === 'es') return 'es';
    return normalized;
  }

  private detectLanguageCode(_text: string): string {
    return 'auto';
  }

  private async tryEdgeTts(
    cleanText: string,
    voice: string,
    languageCode: string,
    outputFile: string,
    options: AudioSynthesisOptions,
  ): Promise<string | null> {
    const audioConfig = this.getAudioConfig();
    const edgeStart = Date.now();
    if (!voice) {
      throw new Error('No Edge-TTS voice configured for this language.');
    }

    const { MsEdgeTTS } = await this.withTimeout(
      this.loadEdgeTts(),
      audioConfig.ttsTimeoutMs,
      `Edge-TTS loading exceeded ${audioConfig.ttsTimeoutMs}ms`,
    );
    const tts = new MsEdgeTTS();
    await this.withTimeout(
      tts.setMetadata(voice, 'audio-24khz-48kbitrate-mono-mp3' as never),
      audioConfig.ttsTimeoutMs,
      `Edge-TTS config exceeded ${audioConfig.ttsTimeoutMs}ms`,
    );

    try {
      const { audioStream } = tts.toStream(cleanText);
      await this.withTimeout(
        pipeline(audioStream, fs.createWriteStream(outputFile)),
        audioConfig.ttsTimeoutMs,
        `Edge-TTS generation exceeded ${audioConfig.ttsTimeoutMs}ms`,
      );
    } finally {
      tts.close?.();
    }

    if (!fs.existsSync(outputFile) || fs.statSync(outputFile).size <= 0) {
      return null;
    }

    const outputBytes = fs.statSync(outputFile).size;
    await this.recordVoiceSuccess({
      surface: options.surface || 'unknown',
      provider: 'edge-tts',
      model: voice,
      voiceName: voice,
      languageCode: languageCode || this.extractLanguageFromVoiceName(voice) || 'auto',
      inputChars: cleanText.length,
      latencyMs: Date.now() - edgeStart,
      mimeType: 'audio/mpeg',
      outputBytes,
      estimatedCostUsd: 0,
      requestedBy: options.requestedBy || 'system',
      sessionId: options.sessionId || null,
      traceId: options.traceId || null,
    });
    this.emitTrace(options.traceId || '', 'tts.provider.completed', {
      provider: 'edge-tts',
      latencyMs: Date.now() - edgeStart,
      outputBytes,
      languageCode: languageCode || this.extractLanguageFromVoiceName(voice) || 'auto',
    });
    logger.info(`[AudioHandler] TTS audio generated via edge-tts: ${outputFile}`);
    return outputFile;
  }

  private async tryGeminiTts(
    cleanText: string,
    languageCode: string,
    fallbackFrom: 'edge-tts' | null,
    options: AudioSynthesisOptions,
  ): Promise<string | null> {
    const audioConfig = this.getAudioConfig();
    if (typeof this.geminiVoiceService.synthesizeDetailed === 'function') {
      const detailed = await this.withTimeout(
        this.geminiVoiceService.synthesizeDetailed(cleanText, {
          languageCode: languageCode || undefined,
        }),
        audioConfig.ttsTimeoutMs,
        `Gemini TTS exceeded ${audioConfig.ttsTimeoutMs}ms`,
      );
      if (detailed?.filePath && fs.existsSync(detailed.filePath)) {
        await this.recordVoiceSuccess({
          surface: options.surface || 'unknown',
          provider: 'gemini',
          model: detailed.model,
          voiceName: detailed.voiceName,
          languageCode: detailed.languageCode,
          inputChars: detailed.inputChars,
          latencyMs: detailed.latencyMs,
          mimeType: detailed.mimeType,
          outputBytes: detailed.outputBytes,
          estimatedCostUsd: estimateGeminiTtsCostUsd(detailed.inputChars),
          fallbackFrom,
          requestedBy: options.requestedBy || 'system',
          sessionId: options.sessionId || null,
          traceId: options.traceId || null,
        });
        this.emitTrace(options.traceId || '', 'tts.provider.completed', {
          provider: 'gemini',
          latencyMs: detailed.latencyMs,
          outputBytes: detailed.outputBytes,
          languageCode: detailed.languageCode,
          fallbackFrom: fallbackFrom || 'none',
        });
        logger.info(`[AudioHandler] Gemini TTS audio generated: ${detailed.filePath}`);
        return detailed.filePath;
      }
      return null;
    }

    const geminiAudio = await this.withTimeout(
      this.geminiVoiceService.synthesize(cleanText, {
        languageCode: languageCode || undefined,
      }),
      audioConfig.ttsTimeoutMs,
        `Gemini TTS exceeded ${audioConfig.ttsTimeoutMs}ms`,
    );
    if (geminiAudio && fs.existsSync(geminiAudio)) {
      const outputBytes = fs.statSync(geminiAudio).size;
      await this.recordVoiceSuccess({
        surface: options.surface || 'unknown',
        provider: 'gemini',
        inputChars: cleanText.length,
        latencyMs: 0,
        mimeType: 'audio/wav',
        outputBytes,
        estimatedCostUsd: estimateGeminiTtsCostUsd(cleanText.length),
        fallbackFrom,
        requestedBy: options.requestedBy || 'system',
        sessionId: options.sessionId || null,
        traceId: options.traceId || null,
      });
      this.emitTrace(options.traceId || '', 'tts.provider.completed', {
        provider: 'gemini',
        latencyMs: 0,
        outputBytes,
        languageCode: languageCode || 'auto',
        fallbackFrom: fallbackFrom || 'none',
      });
      logger.info(`[AudioHandler] Gemini TTS audio generated: ${geminiAudio}`);
      return geminiAudio;
    }
    return null;
  }

  private getAudioConfig() {
    return config.tools.media.audio;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private buildTtsCacheKey(
    text: string,
    provider: AudioSynthesisProvider,
    languageCode: string,
    voice: string,
  ): string {
    return createHash('sha256').update(`${provider}\n${languageCode}\n${voice}\n${text}`).digest('hex');
  }

  private tryWriteCachedTts(cacheKey: string): string | null {
    const audioConfig = this.getAudioConfig();
    if (!audioConfig.ttsCacheEnabled) {
      return null;
    }

    const cached = ttsCache.get(cacheKey);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt < Date.now()) {
      ttsCache.delete(cacheKey);
      return null;
    }

    const outputPath = path.join(this.tmpDir, `tts_cached_${Date.now()}${cached.extension}`);
    fs.writeFileSync(outputPath, cached.buffer);
    return outputPath;
  }

  private rememberTtsCache(cacheKey: string, filePath: string, extension: string): void {
    const audioConfig = this.getAudioConfig();
    if (!audioConfig.ttsCacheEnabled || !fs.existsSync(filePath)) {
      return;
    }

    try {
      ttsCache.set(cacheKey, {
        buffer: fs.readFileSync(filePath),
        extension: extension || '.mp3',
        expiresAt: Date.now() + audioConfig.ttsCacheTtlMs,
      });
    } catch (error: unknown) {// cache is an optimization only
      logger.warn('[Audio] filesystem operation failed', error);
    }
  }

  private cleanTextForTTS(text: string): string {
    return text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
  }

  private async recordVoiceSuccess(input: Parameters<Pick<EchoVoiceTelemetryService, 'recordSuccess'>['recordSuccess']>[0]): Promise<void> {
    try {
      await this.voiceTelemetryService.recordSuccess(input);
    } catch (error: unknown) {// observability should not break telegram audio delivery
      logger.warn('[Audio] delete operation failed', error);
    }
  }

  private async recordVoiceFailure(input: Parameters<Pick<EchoVoiceTelemetryService, 'recordFailure'>['recordFailure']>[0]): Promise<void> {
    try {
      await this.voiceTelemetryService.recordFailure(input);
    } catch (error: unknown) {// observability should not break telegram audio delivery
      logger.warn('[Audio] operation failed', error);
    }
  }
}

async function defaultEdgeTtsLoader(): Promise<{ MsEdgeTTS: MsEdgeTTSModule }> {
  return await loadOptionalDependency<{ MsEdgeTTS: MsEdgeTTSModule }>(
    'msedge-tts',
    'media',
    'The optional TTS synthesizer is not installed on this host.',
  );
}
