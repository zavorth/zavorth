import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';
import { SttBackendRegistry } from '../adapters/speech/stt/SttBackendRegistry.js';
import { builtinSttProviderConfigs } from '../adapters/speech/stt/builtinSttProviderConfigs.js';
import type { ISpeechTranscriptionAdapter } from '../adapters/speech/stt/SpeechTranscriptionContract.js';
import type { SttTranscribeOutput } from '../adapters/speech/stt/SpeechTranscriptionContract.js';

interface TranscriptionResult {
  success: boolean;
  text: string;
  language?: string;
  duration_seconds?: number;
  words?: Array<{ word: string; start: number; end: number; confidence: number }>;
  backend: string;
  providerEvidence?: SttTranscribeOutput['providerEvidence'];
  error?: string;
}

/** Legacy aliases map old tool backend ids to registry provider ids. */
const LEGACY_BACKEND_ALIASES: Record<string, string> = {
  whisper: 'openai',
  local: 'whisper.cpp',
};

export class ZavorthSttTool extends BaseTool {
  public readonly name = 'zavorth_stt';

  public readonly description =
    'Converts speech to text (Speech-to-Text) using configurable backends (OpenAI Whisper, Deepgram, Gemini, Azure Speech, local/whisper.cpp, plus any installed STT provider pack). Supports language detection, word timestamps, and multiple audio formats.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'transcribe', 'detect_language', 'list_backends', 'set_default'.",
      },
      audio_path: {
        type: 'string',
        description: 'Path to the audio file (mp3, wav, ogg, flac, m4a, webm).',
      },
      backend: {
        type: 'string',
        description: "Backend STT: 'openai' (default), 'deepgram', 'gemini', 'azure', 'whisper.cpp', or any registered provider. Legacy aliases 'whisper' and 'local' still work.",
      },
      language: {
        type: 'string',
        description: "Audio language (ISO 639-1). Default: auto-detect.",
      },
      model: {
        type: 'string',
        description: "Specific model (whisper-1, nova-2, etc).",
      },
      word_timestamps: {
        type: 'boolean',
        description: 'If true, returns word timestamps. Default: false.',
      },
      output_format: {
        type: 'string',
        description: "Output format: 'text' (default), 'json', 'srt', 'vtt'.",
      },
      output_path: {
        type: 'string',
        description: 'Path to save the transcription.',
      },
      prompt: {
        type: 'string',
        description: 'Context prompt to improve transcription (proper nouns, technical terms).',
      },
      temperature: {
        type: 'number',
        description: 'Generation temperature (0-1). Default: 0.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private readonly registry: SttBackendRegistry;
  private defaultBackend = 'openai';

  constructor(options?: { storageDir?: string; registry?: SttBackendRegistry }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'stt');
    this.registry = options?.registry || this.buildDefaultRegistry();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return "Error: 'action' parameter is required.";

    const validActions = ['transcribe', 'detect_language', 'list_backends', 'set_default'];
    if (!validActions.includes(action)) {
      return `Error: action "${action}" is invalid. Use: ${validActions.join(', ')}.`;
    }

    this.ensureStorageDir();

    try {
      switch (action) {
        case 'transcribe': return await this.transcribe(args);
        case 'detect_language': return await this.detectLanguage(args);
        case 'list_backends': return this.listBackends();
        case 'set_default': return this.setDefault(args);
        default: return `Error: action "${action}" is not implemented.`;
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Stt] async operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `STT error: ${message}`;
  }
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private async transcribe(args: Record<string, unknown>): Promise<string> {
    const audioPath = String(args.audio_path || '');
    if (!audioPath) return 'Error: "audio_path" parameter is required.';

    const resolvedPath = path.resolve(audioPath);
    if (!fs.existsSync(resolvedPath)) {
      return `Error: audio file "${audioPath}" not found.`;
    }

    const stat = fs.statSync(resolvedPath);
    if (stat.size > 25 * 1024 * 1024) {
      return 'Error: audio file exceeds 25MB. Split or compress.';
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const supportedFormats = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.webm', '.mp4', '.aac', '.wma'];
    if (!supportedFormats.includes(ext)) {
      return `Error: format "${ext}" not supported. Use: ${supportedFormats.join(', ')}.`;
    }

    const backend = this.resolveBackend(String(args.backend || this.defaultBackend));
    const language = typeof args.language === 'string' ? args.language : undefined;
    const model = typeof args.model === 'string' ? args.model : undefined;
    const wordTimestamps = args.word_timestamps === true;
    const outputFormat = String(args.output_format || 'text');
    const outputPath = typeof args.output_path === 'string' ? args.output_path : undefined;
    const prompt = typeof args.prompt === 'string' ? args.prompt : undefined;
    const temperature = typeof args.temperature === 'number' ? args.temperature : 0;

    try {
      const result = await this.executeTranscription(resolvedPath, {
        backend,
        language,
        model,
        wordTimestamps,
        prompt,
        temperature,
      });

      if (!result.success) {
        return `Transcription error: ${result.error}`;
      }

      const formatted = this.formatTranscription(result, outputFormat);

      if (outputPath) {
        fs.writeFileSync(path.resolve(outputPath), formatted, 'utf-8');
        return `transcription saved at ${outputPath}. Backend: ${backend}. Size: ${formatted.length} chars.`;
      }

      const lines: string[] = [
        `transcription (${backend}):`,
        formatted,
      ];
      if (result.language) lines.push(`Detected language: ${result.language}`);
      if (result.duration_seconds) lines.push(`Duration: ${result.duration_seconds.toFixed(1)}s`);
      if (result.words && result.words.length > 0) {
        lines.push(`Palavras: ${result.words.length}`);
      }

      return lines.join('\n');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Stt] operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Transcription error: ${message}`;
  }
  }

  private async detectLanguage(args: Record<string, unknown>): Promise<string> {
    const audioPath = String(args.audio_path || '');
    if (!audioPath) return 'Error: "audio_path" parameter is required.';

    const resolvedPath = path.resolve(audioPath);
    if (!fs.existsSync(resolvedPath)) {
      return `Error: audio file "${audioPath}" not found.`;
    }

    const backend = this.resolveBackend(String(args.backend || this.defaultBackend));

    try {
      const result = await this.executeTranscription(resolvedPath, {
        backend,
        language: undefined,
        wordTimestamps: false,
        prompt: undefined,
        temperature: 0,
      });

      if (!result.success) {
        return `Detection error: ${result.error}`;
      }

      return `Detected language: ${result.language || 'unknown'}. Text: "${result.text.slice(0, 100)}..."`;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Stt] process execution failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Language detection error: ${message}`;
  }
  }

  private listBackends(): string {
    const adapters = this.registry.list();
    const lines: string[] = ['Available STT backends:'];

    if (adapters.length === 0) {
      lines.push('  (no STT providers registered)');
      return lines.join('\n');
    }

    for (const adapter of adapters) {
      const available = adapter.isAvailable() ? '✅' : '❌';
      const key = this.describeApiKey(adapter);
      lines.push(`  ${available} ${adapter.providerId} — ${adapter.transport} transport`);
      lines.push(`     Chave: ${key}`);
    }
    return lines.join('\n');
  }

  private setDefault(args: Record<string, unknown>): string {
    const backend = String(args.backend || '');
    if (!backend) return 'Error: "backend" is required.';

    const resolved = this.resolveBackend(backend);
    if (!this.registry.has(resolved)) {
      return `Error: backend "${backend}" is invalid. Use: ${this.registry.providerIds().join(', ')}.`;
    }

    this.defaultBackend = resolved;
    return `Default STT backend changed to "${resolved}".`;
  }

  private isBackendAvailable(backend: string): boolean {
    const adapter = this.registry.get(this.resolveBackend(backend));
    return adapter ? adapter.isAvailable() : false;
  }

  private async executeTranscription(
    audioPath: string,
    options: {
      backend: string;
      language?: string;
      model?: string;
      wordTimestamps: boolean;
      prompt?: string;
      temperature: number;
    },
  ): Promise<TranscriptionResult> {
    const adapter = this.registry.get(options.backend);
    if (!adapter) {
      throw new Error(`Backend STT "${options.backend}" not supported.`);
    }
    if (!adapter.isAvailable()) {
      throw new Error(`Backend STT "${options.backend}" is not available in this runtime.`);
    }

    const audio = fs.readFileSync(audioPath);
    const contentType = contentTypeForExtension(path.extname(audioPath));

    const output = await adapter.transcribe({
      audio,
      contentType,
      languageHint: options.language,
      modelId: options.model,
      wordTimestamps: options.wordTimestamps,
      temperature: options.temperature,
      prompt: options.prompt,
    });

    const words = this.deriveWords(output.segments);

    return {
      success: true,
      text: output.text,
      language: output.language || options.language || undefined,
      words,
      backend: options.backend,
      providerEvidence: output.providerEvidence,
    };
  }

  private deriveWords(segments: Array<{ text: string; startMs: number | null; endMs: number | null }>): Array<{ word: string; start: number; end: number; confidence: number }> {
    return segments
      .filter((segment) => segment.text && segment.startMs !== null && segment.endMs !== null)
      .map((segment) => ({
        word: segment.text,
        start: segment.startMs as number / 1000,
        end: segment.endMs as number / 1000,
        confidence: 1.0,
      }));
  }

  private resolveBackend(id: string): string {
    return LEGACY_BACKEND_ALIASES[id] || id;
  }

  private describeApiKey(adapter: ISpeechTranscriptionAdapter): string {
    const config = builtinSttProviderConfigs().find((c) => c.providerId === adapter.providerId);
    if (config && config.apiKeyEnvVar) {
      return config.apiKeyEnvVar;
    }
    if (adapter.transport === 'cli' || adapter.transport === 'in-process') {
      return 'Local (no key)';
    }
    return 'Configured via provider pack';
  }

  private buildDefaultRegistry(): SttBackendRegistry {
    const registry = new SttBackendRegistry();
    for (const config of builtinSttProviderConfigs()) {
      registry.registerConfig(config);
    }
    return registry;
  }

  private formatTranscription(result: TranscriptionResult, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);

      case 'srt': {
        if (!result.words || result.words.length === 0) return result.text;
        const lines: string[] = [];
        let idx = 1;
        for (let i = 0; i < result.words.length; i += 10) {
          const chunk = result.words.slice(i, i + 10);
          const start = this.formatSrtTime(chunk[0].start);
          const end = this.formatSrtTime(chunk[chunk.length - 1].end);
          lines.push(`${idx}`);
          lines.push(`${start} --> ${end}`);
          lines.push(chunk.map((w) => w.word).join(' '));
          lines.push('');
          idx++;
        }
        return lines.join('\n');
      }

      case 'vtt': {
        if (!result.words || result.words.length === 0) return result.text;
        const vttLines: string[] = ['WEBVTT', ''];
        for (let i = 0; i < result.words.length; i += 10) {
          const chunk = result.words.slice(i, i + 10);
          const start = this.formatVttTime(chunk[0].start);
          const end = this.formatVttTime(chunk[chunk.length - 1].end);
          vttLines.push(`${start} --> ${end}`);
          vttLines.push(chunk.map((w) => w.word).join(' '));
          vttLines.push('');
        }
        return vttLines.join('\n');
      }

      case 'text':
      default:
        return result.text;
    }
  }

  private formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  private formatVttTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
}

function contentTypeForExtension(ext: string): string {
  switch (ext) {
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.ogg': return 'audio/ogg';
    case '.flac': return 'audio/flac';
    case '.m4a': return 'audio/mp4';
    case '.webm': return 'audio/webm';
    case '.mp4': return 'audio/mp4';
    case '.aac': return 'audio/aac';
    case '.wma': return 'audio/x-ms-wma';
    default: return 'audio/mpeg';
  }
}
