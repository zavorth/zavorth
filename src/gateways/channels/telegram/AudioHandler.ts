import { logger } from '../../../logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { config } from '../../../config/index.js';
import {
  estimateGeminiTtsCostUsd,
  EchoVoiceTelemetryService,
} from '../../../domain/observability/infrastructure/EchoVoiceTelemetryService.js';
import { GeminiVoiceService } from '../../../providers/GeminiVoiceService.js';
import { logEchoTrace } from '../../../gateways/channels/telegram/EchoTrace.js';

import { GeminiVideoAnalyzer } from '../../../gateways/channels/telegram/GeminiVideoAnalyzer.js';
import {
  CapabilityUnavailableError,
  isCapabilityUnavailableError,
  loadOptionalDependency,
} from '../../../services/OptionalCapabilityGuard.js';

import { LocalVoiceDictation } from '../../../voice/LocalVoiceDictation.js';
import { AudioTranscriptionService } from '../../../services/AudioTranscriptionService.js';
import type { AudioTranscriptionResult as SharedAudioTranscriptionResult } from '../../../services/AudioTranscriptionService.js';
import { asErrorLike } from '../../../utils/errorLike.js';
const TELEGRAM_TRANSCRIPTION_TITLE = 'audio do Telegram';
const TELEGRAM_TRANSCRIPTION_INSTRUCTION = [
  'Transcribe only the audible words as plain text.',
  'Do not use Markdown, headings, timestamps, comments, or introductions.',
  'Do not invent names, identity, intent, emotion, or context when it is not audible.',
  'If the audio is short, the transcript must also be short.',
  'If a segment is uncertain, write [inaudible] or [uncertain].',
  'Preserve the speaker language and do not translate the audio.',
].join(' ');

export interface TranscriptionOptions {
  language?: string;
  prompt?: string;
  validator?: (result: AudioTranscriptionResult) => { accepted: boolean; reason?: string };
}

export type AudioTranscriptionProvider = 'gemini' | 'openai' | 'groq' | 'deepgram' | 'whisper.cpp';
export type AudioSynthesisProvider = 'edge-tts' | 'gemini';

export interface MsEdgeTTSInstance {
  setMetadata(voice: string, outputFormat: string): Promise<void>;
  toStream(text: string): { audioStream: NodeJS.ReadableStream };
  close?(): void;
}

export interface MsEdgeTTSModule {
  new (): MsEdgeTTSInstance;
}

export interface OpenAiTranscriptionResponse {
  text?: string;
  language?: string;
}

export interface DeepgramTranscriptionResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{ transcript?: string }>;
      detected_language?: string;
    }>;
  };
  metadata?: { detected_language?: string };
  language?: string;
}

export interface AudioTranscriptionResult {
  text: string;
  provider: AudioTranscriptionProvider;
  model?: string;
  languageCode: string;
  latencyMs: number;
  warnings: string[];
  failures: Array<{ provider: string; error: string; latencyMs: number }>;
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

/**
 * AudioHandler - modulo de audio para STT (OpenAI) e TTS (Edge-TTS).
 */
export interface AudioHandlerDeps {
  geminiAnalyzer?: Pick<GeminiVideoAnalyzer, 'isEnabled' | 'transcribeLocalAudio'>;
  geminiVoiceService?: Pick<GeminiVoiceService, 'isConfigured' | 'synthesize' | 'cleanup'> & Partial<Pick<GeminiVoiceService, 'synthesizeDetailed'>>;
  localVoiceDictation?: Pick<LocalVoiceDictation, 'transcribeFile'>;
  loadEdgeTts?: () => Promise<{ MsEdgeTTS: MsEdgeTTSModule }>;
  voiceTelemetryService?: Pick<EchoVoiceTelemetryService, 'recordSuccess' | 'recordFailure'>;
  fetchImpl?: typeof fetch;
  audioTranscriptionService?: Pick<AudioTranscriptionService, 'transcribe'>;
}

export class AudioHandler {
  private static ttsQueue: Promise<unknown> = Promise.resolve();
  private static ttsCache = new Map<string, { buffer: Buffer; extension: string; expiresAt: number }>();

  private geminiAnalyzer: Pick<GeminiVideoAnalyzer, 'isEnabled' | 'transcribeLocalAudio'>;
  private geminiVoiceService: Pick<GeminiVoiceService, 'isConfigured' | 'synthesize' | 'cleanup'> & Partial<Pick<GeminiVoiceService, 'synthesizeDetailed'>>;
  private localVoiceDictation: Pick<LocalVoiceDictation, 'transcribeFile'>;
  private loadEdgeTts: () => Promise<{ MsEdgeTTS: MsEdgeTTSModule }>;
  private voiceTelemetryService: Pick<EchoVoiceTelemetryService, 'recordSuccess' | 'recordFailure'>;
  private fetchImpl: typeof fetch;
  private audioTranscriptionService: Pick<AudioTranscriptionService, 'transcribe'>;

  constructor(deps: AudioHandlerDeps = {}) {
    if (!fs.existsSync(config.tmpDir)) {
      fs.mkdirSync(config.tmpDir, { recursive: true });
    }

    this.geminiAnalyzer = deps.geminiAnalyzer || new GeminiVideoAnalyzer({
      apiKey: config.geminiTranscriptionApiKey || config.geminiApiKey,
      model: config.geminiTranscriptionModel || config.geminiVideoModel,
    });
    this.geminiVoiceService = deps.geminiVoiceService || new GeminiVoiceService();
    this.localVoiceDictation = deps.localVoiceDictation || new LocalVoiceDictation({ language: 'auto' });
    this.loadEdgeTts = deps.loadEdgeTts || defaultEdgeTtsLoader;
    this.voiceTelemetryService = deps.voiceTelemetryService || new EchoVoiceTelemetryService();
    this.fetchImpl = deps.fetchImpl || fetch;
    this.audioTranscriptionService = deps.audioTranscriptionService || new AudioTranscriptionService();
  }

  public async transcribe(filePath: string, options: TranscriptionOptions = {}): Promise<string> {
    const result = await this.transcribeDetailed(filePath, options);
    return result.text;
  }

  public async transcribeDetailed(filePath: string, options: TranscriptionOptions = {}): Promise<AudioTranscriptionResult> {
    const stats = fs.statSync(filePath);
    const startedAt = Date.now();
    const mimeType = this.resolveMimeType(filePath);
    logger.info(
      `[AudioHandler] STT start file=${path.basename(filePath)} bytes=${stats.size} mime=${mimeType}`,
    );
    const sharedResult = await this.audioTranscriptionService.transcribe({
      audio: fs.readFileSync(filePath),
      mimeType,
      fileName: path.basename(filePath),
      prompt: options.prompt || TELEGRAM_TRANSCRIPTION_INSTRUCTION,
      language: options.language || null,
    });
    const result = this.toTelegramTranscriptionResult(sharedResult, startedAt);
    const validation = options.validator?.(result);
    if (validation && !validation.accepted) {
      const reason = validation.reason || 'transcription rejected by validator';
      logger.warn(`[AudioHandler] STT rejected provider=${result.provider} chars=${result.text.length}: ${reason}`);
      throw new Error(reason);
    }
    logger.info(
      `[AudioHandler] STT ok provider=${result.provider} model=${result.model || 'default'} lang=${result.languageCode} chars=${result.text.length} latencyMs=${result.latencyMs} totalMs=${Date.now() - startedAt}`,
    );
    return result;
  }

  /**
   * Sintetiza texto em audio usando Edge-TTS local com fallback Gemini TTS.
   */
  public async synthesize(text: string, voiceIdOrOptions?: string | AudioSynthesisOptions): Promise<string | null> {
    const run = AudioHandler.ttsQueue
      .catch(() => undefined)
      .then(() => this.synthesizeInternal(text, voiceIdOrOptions));
    AudioHandler.ttsQueue = run.catch(() => undefined);
    return await run;
  }

  private async synthesizeInternal(
    text: string,
    voiceIdOrOptions?: string | AudioSynthesisOptions,
  ): Promise<string | null> {
    const ttsStartedAt = Date.now();
    const options = this.normalizeSynthesisOptions(voiceIdOrOptions);
    const outputFile = path.join(config.tmpDir, `tts_${Date.now()}.mp3`);
    const cleanText = this.cleanTextForTTS(text);
    const audioConfig = this.getAudioConfig();
    const responseLanguageCode =
      this.normalizeLanguageCode(options.preferredLanguageCode) || this.detectLanguageCode(cleanText);
    const edgeVoice = this.resolveEdgeVoice(responseLanguageCode, options.voiceId);
    const providerOrder = this.resolveSynthesisProviderOrder(cleanText, responseLanguageCode, options, edgeVoice);
    const traceId = String(options.traceId || '').trim();
    if (traceId) {
      logEchoTrace(traceId, 'tts.policy.selected', {
        providers: providerOrder.join('>'),
        languageCode: responseLanguageCode || 'auto',
        edgeVoice: edgeVoice.voice || 'none',
        chars: cleanText.length,
        policyHint: options.policyHint || 'default',
      });
    } else {
      logger.info(
        `[AudioHandler] TTS policy providers=${providerOrder.join('>')} lang=${responseLanguageCode || 'auto'} edgeVoice=${edgeVoice.voice || 'none'} chars=${cleanText.length}`,
      );
    }

    const cacheKey = this.buildTtsCacheKey(cleanText, providerOrder[0], responseLanguageCode, edgeVoice.voice || '');
    const cachedPath = this.tryWriteCachedTts(cacheKey);
    if (cachedPath) {
      if (traceId) {
        logEchoTrace(traceId, 'tts.cache.hit', {
          provider: providerOrder[0],
          chars: cleanText.length,
          languageCode: responseLanguageCode || 'auto',
        });
      } else {
        logger.info(`[AudioHandler] TTS cache hit chars=${cleanText.length} path=${cachedPath}`);
      }
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
            logger.warn('[AudioHandler] edge-tts unavailable. Tentando proximo provider...');
          } else {
            logger.error(`[AudioHandler] Erro no TTS local: ${error}`);
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
          const err = asErrorLike(error);
          lastGeminiError = error instanceof Error ? error : new Error(String(error));
          logger.error(`[AudioHandler] Erro no Gemini TTS: ${error}`);
        }
      }
    }

    await this.recordVoiceFailure({
      provider: lastGeminiError ? 'gemini' : 'edge-tts',
      inputChars: cleanText.length,
      latencyMs: Date.now() - ttsStartedAt,
      requestedBy: 'telegram-bot',
      traceId: traceId || null,
      surface: options.surface || 'telegram',
      sessionId: options.sessionId || null,
      fallbackFrom: capabilityError ? 'edge-tts' : null,
      error: lastGeminiError?.message || capabilityError?.message || 'Failed to synthesize audio.',
    });

    if (capabilityError) {
      throw capabilityError;
    }

    return null;
  }

  private async transcribeWithProvider(
    provider: AudioTranscriptionProvider,
    filePath: string,
    options: TranscriptionOptions,
  ): Promise<{ text: string; model?: string; languageCode?: string }> {
    switch (provider) {
      case 'gemini':
        return await this.transcribeWithGemini(filePath, options);
      case 'openai':
        return await this.transcribeWithOpenAiCompatible({
          provider,
          filePath,
          apiKey: config.openaiApiKey,
          endpoint: 'https://api.openai.com/v1/audio/transcriptions',
          model: config.openaiTranscriptionModel,
          options,
        });
      case 'groq':
        return await this.transcribeWithOpenAiCompatible({
          provider,
          filePath,
          apiKey: config.groqApiKey,
          endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
          model: config.groqTranscriptionModel,
          options,
        });
      case 'deepgram':
        return await this.transcribeWithDeepgram(filePath);
      case 'whisper.cpp':
        return await this.transcribeWithLocalWhisper(filePath);
      default:
        throw new Error(`Provider de STT desconhecido: ${provider}`);
    }
  }

  private toTelegramTranscriptionResult(
    result: SharedAudioTranscriptionResult,
    startedAt: number,
  ): AudioTranscriptionResult {
    const failures = result.attempts
      .filter((attempt) => attempt.status !== 'succeeded')
      .map((attempt) => ({
        provider: attempt.provider,
        error: attempt.reason || attempt.status,
        latencyMs: attempt.latencyMs,
      }));
    if (!result.ok || !result.text || !result.provider) {
      throw new Error(
        result.error || `Failed to transcribe audio with all providers: ${
          failures.map((failure) => `${failure.provider}: ${failure.error}`).join(' | ')
        }`,
      );
    }
    const provider = this.normalizeTranscriptionProvider(result.provider);
    const text = this.normalizeTranscriptionText(result.text);
    if (!text) {
      throw new Error('Audio transcription response missing usable text.');
    }
    return {
      text,
      provider,
      model: result.model || undefined,
      languageCode: this.detectLanguageCode(text),
      latencyMs: Date.now() - startedAt,
      warnings: failures.map((failure) => `${failure.provider}: ${failure.error}`),
      failures,
    };
  }

  private normalizeTranscriptionProvider(provider: string): AudioTranscriptionProvider {
    return ['gemini', 'openai', 'groq', 'deepgram', 'whisper.cpp'].includes(provider)
      ? provider as AudioTranscriptionProvider
      : 'whisper.cpp';
  }

  private async transcribeWithGemini(
    filePath: string,
    options: TranscriptionOptions,
  ): Promise<{ text: string; model?: string; languageCode?: string }> {
    const result = await this.geminiAnalyzer.transcribeLocalAudio(
      filePath,
      this.resolveMimeType(filePath),
      TELEGRAM_TRANSCRIPTION_TITLE,
      options.prompt || TELEGRAM_TRANSCRIPTION_INSTRUCTION,
    );

    if (!result || !result.analysisText) {
      throw new Error('O Gemini nao retornou texto util para este audio.');
    }

    return {
      text: result.analysisText,
      model: config.geminiTranscriptionModel || config.geminiVideoModel,
    };
  }

  private async transcribeWithOpenAiCompatible(input: {
    provider: 'openai' | 'groq';
    filePath: string;
    apiKey: string;
    endpoint: string;
    model: string;
    options: TranscriptionOptions;
  }): Promise<{ text: string; model?: string; languageCode?: string }> {
    const buffer = fs.readFileSync(input.filePath);
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array(buffer)], { type: this.resolveMimeType(input.filePath) }),
      path.basename(input.filePath),
    );
    formData.append('model', input.model);
    formData.append('response_format', 'verbose_json');
    const normalizedLanguage = String(input.options.language || '').trim();
    if (normalizedLanguage && normalizedLanguage.toLowerCase() !== 'auto') {
      formData.append('language', normalizedLanguage);
    }

    const response = await this.fetchImpl(input.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.apiKey}`,
      },
      body: formData as unknown as BodyInit,
    });

    if (!response.ok) {
      throw new Error(`${input.provider} STT HTTP ${response.status}: ${await this.safeReadResponseText(response)}`);
    }

    const payload = await response.json() as OpenAiTranscriptionResponse;
    return {
      text: String(payload?.text || '').trim(),
      model: input.model,
      languageCode: this.normalizeLanguageCode(payload?.language),
    };
  }

  private async transcribeWithDeepgram(filePath: string): Promise<{ text: string; model?: string; languageCode?: string }> {
    const model = config.deepgramTranscriptionModel;
    const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}&detect_language=true&smart_format=true`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        authorization: `Token ${config.deepgramApiKey}`,
        'content-type': this.resolveMimeType(filePath),
      },
      body: fs.readFileSync(filePath) as unknown as BodyInit,
    });

    if (!response.ok) {
      throw new Error(`deepgram STT HTTP ${response.status}: ${await this.safeReadResponseText(response)}`);
    }

    const payload = await response.json() as DeepgramTranscriptionResponse;
    const alternative = payload?.results?.channels?.[0]?.alternatives?.[0];
    return {
      text: String(alternative?.transcript || '').trim(),
      model,
      languageCode: this.normalizeLanguageCode(
        payload?.results?.channels?.[0]?.detected_language ||
        payload?.metadata?.detected_language ||
        payload?.language,
      ),
    };
  }

  private async transcribeWithLocalWhisper(filePath: string): Promise<{ text: string; model?: string; languageCode?: string }> {
    const text = await this.localVoiceDictation.transcribeFile(filePath);
    return {
      text,
      model: path.basename(process.env.ZAVORTH_WHISPER_MODEL_PATH || 'whisper.cpp'),
    };
  }

  private resolveTranscriptionProviders(rawProviders: string[]): AudioTranscriptionProvider[] {
    const providers = rawProviders.length > 0 ? rawProviders : ['gemini', 'openai', 'groq', 'deepgram', 'whisper.cpp'];
    const normalized = providers
      .map((entry) => String(entry || '').trim().toLowerCase())
      .map((entry) => (entry === 'whisper' || entry === 'local' ? 'whisper.cpp' : entry))
      .filter((entry): entry is AudioTranscriptionProvider =>
        ['gemini', 'openai', 'groq', 'deepgram', 'whisper.cpp'].includes(entry),
      );
    return Array.from(new Set(normalized));
  }

  private isTranscriptionProviderConfigured(provider: AudioTranscriptionProvider): boolean {
    switch (provider) {
      case 'gemini':
        return Boolean(config.geminiTranscriptionApiKey || config.geminiApiKey);
      case 'openai':
        return Boolean(config.openaiApiKey);
      case 'groq':
        return Boolean(config.groqApiKey);
      case 'deepgram':
        return Boolean(config.deepgramApiKey);
      case 'whisper.cpp':
        return true;
      default:
        return false;
    }
  }

  private resolveMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.ogg' || ext === '.opus') return 'audio/ogg';
    if (ext === '.wav') return 'audio/wav';
    if (ext === '.m4a') return 'audio/mp4';
    if (ext === '.mp4') return 'video/mp4';
    if (ext === '.webm') return 'audio/webm';
    if (ext === '.flac') return 'audio/flac';
    return 'audio/mpeg';
  }

  private detectLanguageCode(text: string): string {
    const normalized = String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const ptHits = (normalized.match(/\b(voce|nao|sim|audio|noticias?|ultimas?|obrigado|consegue|ouvir|resuma|explique|ola|fale|resposta|voz|certo|tudo)\b/g) || []).length;
    const enHits = (normalized.match(/\b(you|not|yes|audio|news|latest|thanks|can|hear|summarize|explain|hello|reply|voice|right|okay)\b/g) || []).length;
    const esHits = (normalized.match(/\b(usted|tu|no|si|audio|noticias?|ultimas?|gracias|puedes|oir|resume|explica|hola|respuesta|voz|claro)\b/g) || []).length;
    if (ptHits >= enHits && ptHits >= esHits && ptHits > 0) return 'en-US';
    if (esHits >= enHits && esHits > 0) return 'es';
    if (enHits > 0) return 'en';
    return 'auto';
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
    if (lower === 'portuguese' || lower === 'pt') return 'en-US';
    if (lower === 'english' || lower === 'en') return 'en';
    if (lower === 'spanish' || lower === 'es') return 'es';
    return normalized;
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
      throw new Error('Nenhuma voz Edge-TTS configurada para este idioma.');
    }

    const { MsEdgeTTS } = await this.withTimeout(
      this.loadEdgeTts(),
      audioConfig.ttsTimeoutMs,
      `Carregamento Edge-TTS excedeu ${audioConfig.ttsTimeoutMs}ms`,
    );
    const tts = new MsEdgeTTS();
    await this.withTimeout(
      tts.setMetadata(voice, 'audio-24khz-48kbitrate-mono-mp3' as never),
      audioConfig.ttsTimeoutMs,
      `Config Edge-TTS excedeu ${audioConfig.ttsTimeoutMs}ms`,
    );

    try {
      const { audioStream } = tts.toStream(cleanText);
      await this.withTimeout(
        pipeline(audioStream, fs.createWriteStream(outputFile)),
        audioConfig.ttsTimeoutMs,
        `Geracao Edge-TTS excedeu ${audioConfig.ttsTimeoutMs}ms`,
      );
    } finally {
      tts.close?.();
    }

    if (!fs.existsSync(outputFile) || fs.statSync(outputFile).size <= 0) {
      return null;
    }

    const outputBytes = fs.statSync(outputFile).size;
    await this.recordVoiceSuccess({
      surface: options.surface || 'telegram',
      provider: 'edge-tts',
      model: voice,
      voiceName: voice,
      languageCode: languageCode || this.extractLanguageFromVoiceName(voice) || 'auto',
      inputChars: cleanText.length,
      latencyMs: Date.now() - edgeStart,
      mimeType: 'audio/mpeg',
      outputBytes,
      estimatedCostUsd: 0,
      requestedBy: options.requestedBy || 'telegram-bot',
      sessionId: options.sessionId || null,
      traceId: options.traceId || null,
    });
    if (options.traceId) {
      logEchoTrace(options.traceId, 'tts.provider.completed', {
        provider: 'edge-tts',
        latencyMs: Date.now() - edgeStart,
        outputBytes,
        languageCode: languageCode || this.extractLanguageFromVoiceName(voice) || 'auto',
      });
    }
    logger.info(`[AudioHandler] Audio TTS gerado via edge-tts: ${outputFile}`);
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
        `Gemini TTS excedeu ${audioConfig.ttsTimeoutMs}ms`,
      );
      if (detailed?.filePath && fs.existsSync(detailed.filePath)) {
        await this.recordVoiceSuccess({
          surface: options.surface || 'telegram',
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
          requestedBy: options.requestedBy || 'telegram-bot',
          sessionId: options.sessionId || null,
          traceId: options.traceId || null,
        });
        if (options.traceId) {
          logEchoTrace(options.traceId, 'tts.provider.completed', {
            provider: 'gemini',
            latencyMs: detailed.latencyMs,
            outputBytes: detailed.outputBytes,
            languageCode: detailed.languageCode,
            fallbackFrom: fallbackFrom || 'none',
          });
        }
        logger.info(`[AudioHandler] Audio Gemini TTS gerado: ${detailed.filePath}`);
        return detailed.filePath;
      }
      return null;
    }

    const geminiAudio = await this.withTimeout(
      this.geminiVoiceService.synthesize(cleanText, {
        languageCode: languageCode || undefined,
      }),
      audioConfig.ttsTimeoutMs,
      `Gemini TTS excedeu ${audioConfig.ttsTimeoutMs}ms`,
    );
    if (geminiAudio && fs.existsSync(geminiAudio)) {
      const outputBytes = fs.statSync(geminiAudio).size;
      await this.recordVoiceSuccess({
        surface: options.surface || 'telegram',
        provider: 'gemini',
        inputChars: cleanText.length,
        latencyMs: 0,
        mimeType: 'audio/wav',
        outputBytes,
        estimatedCostUsd: estimateGeminiTtsCostUsd(cleanText.length),
        fallbackFrom,
        requestedBy: options.requestedBy || 'telegram-bot',
        sessionId: options.sessionId || null,
        traceId: options.traceId || null,
      });
      if (options.traceId) {
        logEchoTrace(options.traceId, 'tts.provider.completed', {
          provider: 'gemini',
          latencyMs: 0,
          outputBytes,
          languageCode: languageCode || 'auto',
          fallbackFrom: fallbackFrom || 'none',
        });
      }
      logger.info(`[AudioHandler] Audio Gemini TTS gerado: ${geminiAudio}`);
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

  private async safeReadResponseText(response: Response): Promise<string> {
    try {
      return (await response.text()).slice(0, 500);
    } catch (error: unknown) {logger.warn('[Audio] string operation failed', error); return response.statusText || 'sem corpo de erro'; }
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

    const cached = AudioHandler.ttsCache.get(cacheKey);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt < Date.now()) {
      AudioHandler.ttsCache.delete(cacheKey);
      return null;
    }

    const outputPath = path.join(config.tmpDir, `tts_cached_${Date.now()}${cached.extension}`);
    fs.writeFileSync(outputPath, cached.buffer);
    return outputPath;
  }

  private rememberTtsCache(cacheKey: string, filePath: string, extension: string): void {
    const audioConfig = this.getAudioConfig();
    if (!audioConfig.ttsCacheEnabled || !fs.existsSync(filePath)) {
      return;
    }

    try {
      AudioHandler.ttsCache.set(cacheKey, {
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

  private normalizeTranscriptionText(text: string): string {
    const normalized = String(text || '')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !/^#{1,6}\s/.test(line))
      .filter((line) => !/^[-*_]{3,}$/.test(line))
      .filter((line) => !/^aqui est[aÃ¡]\s+a\s+transcri/i.test(line))
      .filter((line) => !/^transcri[cÃ§][aÃ£]o\b/i.test(line))
      .join(' ')
      .replace(/\[(?:\d{1,2}:)?\d{1,2}:\d{2}\]\s*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return normalized || String(text || '').trim();
  }

  public cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error: unknown) {logger.warn(`[AudioHandler] Failed to remove temporario: ${error}`);
    }
    this.geminiVoiceService.cleanup(filePath);
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
    'O sintetizador TTS opcional nao esta instalado neste host.',
  );
}
