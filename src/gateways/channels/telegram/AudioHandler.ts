import { logger } from '../../../logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../../config/index.js';
import { GeminiVoiceService } from '../../../providers/GeminiVoiceService.js';

import { EchoVoiceTelemetryService } from '../../../domain/observability/infrastructure/EchoVoiceTelemetryService.js';
import type {
  AudioSynthesisOptions,
  MsEdgeTTSModule,
} from '../../../services/AudioSynthesisService.js';
import { AudioSynthesisService } from '../../../services/AudioSynthesisService.js';
import { logEchoTrace } from '../../../gateways/channels/telegram/EchoTrace.js';

import { AudioTranscriptionService } from '../../../services/AudioTranscriptionService.js';
import type { AudioTranscriptionResult as SharedAudioTranscriptionResult } from '../../../services/AudioTranscriptionService.js';

export interface TranscriptionOptions {
  language?: string;
  prompt?: string;
  validator?: (result: AudioTranscriptionResult) => { accepted: boolean; reason?: string };
}

export type AudioTranscriptionProvider = 'gemini' | 'openai' | 'groq' | 'deepgram' | 'whisper.cpp';

export interface AudioTranscriptionResult {
  text: string;
  provider: AudioTranscriptionProvider;
  model?: string;
  languageCode: string;
  latencyMs: number;
  warnings: string[];
  failures: Array<{ provider: string; error: string; latencyMs: number }>;
}

/**
 * AudioHandler - Telegram audio facade over AudioTranscriptionService (STT)
 * and AudioSynthesisService (TTS).
 */
export interface AudioHandlerDeps {
  geminiVoiceService?: Pick<GeminiVoiceService, 'isConfigured' | 'synthesize' | 'cleanup'> & Partial<Pick<GeminiVoiceService, 'synthesizeDetailed'>>;
  loadEdgeTts?: () => Promise<{ MsEdgeTTS: MsEdgeTTSModule }>;
  voiceTelemetryService?: Pick<EchoVoiceTelemetryService, 'recordSuccess' | 'recordFailure'>;
  audioTranscriptionService?: Pick<AudioTranscriptionService, 'transcribe'>;
}

const TELEGRAM_TRANSCRIPTION_INSTRUCTION = [
  'Transcribe only the audible words as plain text.',
  'Do not use Markdown, headings, timestamps, comments, or introductions.',
  'Do not invent names, identity, intent, emotion, or context when it is not audible.',
  'If the audio is short, the transcript must also be short.',
  'If a segment is uncertain, write [inaudible] or [uncertain].',
  'Preserve the speaker language and do not translate the audio.',
].join(' ');

export class AudioHandler {
  private readonly audioSynthesisService: AudioSynthesisService;
  private readonly geminiVoiceService: Pick<GeminiVoiceService, 'isConfigured' | 'synthesize' | 'cleanup'> & Partial<Pick<GeminiVoiceService, 'synthesizeDetailed'>>;
  private readonly audioTranscriptionService: Pick<AudioTranscriptionService, 'transcribe'>;

  constructor(deps: AudioHandlerDeps = {}) {
    if (!fs.existsSync(config.tmpDir)) {
      fs.mkdirSync(config.tmpDir, { recursive: true });
    }

    this.geminiVoiceService = deps.geminiVoiceService || new GeminiVoiceService();
    const voiceTelemetryService = deps.voiceTelemetryService || new EchoVoiceTelemetryService();
    this.audioSynthesisService = new AudioSynthesisService({
      geminiVoiceService: this.geminiVoiceService,
      loadEdgeTts: deps.loadEdgeTts,
      voiceTelemetryService,
      onTrace: logEchoTrace,
    });
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
   * Synthesizes text to audio using local Edge-TTS with Gemini TTS fallback.
   */
  public async synthesize(text: string, voiceIdOrOptions?: string | AudioSynthesisOptions): Promise<string | null> {
    return await this.audioSynthesisService.synthesize(text, voiceIdOrOptions);
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

  private detectLanguageCode(_text: string): string {
    return 'auto';
  }

  private normalizeTranscriptionText(text: string): string {
    const normalized = String(text || '')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !/^#{1,6}\s/.test(line))
      .filter((line) => !/^[-*_]{3,}$/.test(line))
      .filter((line) => !(/:\s*$/.test(line) && !/^\[/.test(line)))
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
    } catch (error: unknown) {logger.warn(`[AudioHandler] Failed to remove temporary file: ${error}`);
    }
    this.geminiVoiceService.cleanup(filePath);
  }
}
