
import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';
import { TtsBackendRegistry } from '../adapters/speech/tts/TtsBackendRegistry.js';
import { builtinTtsProviderConfigs } from '../adapters/speech/tts/builtinTtsProviderConfigs.js';
import type { ISpeechSynthesisAdapter } from '../adapters/speech/tts/SpeechSynthesisContract.js';
import type { TtsSynthesizeOutput } from '../adapters/speech/tts/SpeechSynthesisContract.js';
import {
  resolveVoiceTts,
  type ResolveVoiceTtsInput,
  type VoiceTtsResolveResult,
} from '../services/voice/VoiceTtsPolicy.js';

/** Legacy aliases map old tool backend ids to registry provider ids. */
const LEGACY_BACKEND_ALIASES: Record<string, string> = {
  mac: 'local',
  linux: 'local',
  windows: 'local',
};

type ResolvedBackend = {
  backend?: string;
  voiceId?: string | null;
  error?: string;
};

export class ZavorthTtsTool extends BaseTool {
  public readonly name = 'zavorth_tts';

  public readonly description =
    'Converts text to speech using configurable backends (local/OS, Azure Speech, ElevenLabs, MLX, Gemini TTS, Deepgram, plus any installed TTS provider pack). Supports voice selection, speed, language, and saving to file. Explicit backend calls always work; the default path respects the VoicePreference TTS policy.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'speak', 'list_voices', 'list_backends', 'set_default'.",
      },
      text: {
        type: 'string',
        description: 'Text to convert to speech.',
      },
      backend: {
        type: 'string',
        description: "Backend TTS: 'local' (default), 'azure', 'elevenlabs', 'mlx', 'gemini', 'deepgram', or any registered provider.",
      },
      voice_id: {
        type: 'string',
        description: 'Voice ID for the selected backend.',
      },
      language: {
        type: 'string',
        description: "Language (ISO 639-1). Default: 'en-US'.",
      },
      speed: {
        type: 'number',
        description: 'Speech speed (0.5 to 2.0). Default: 1.0.',
      },
      pitch: {
        type: 'number',
        description: 'Voice pitch (-20 to 20 semitones). Default: 0.',
      },
      output_path: {
        type: 'string',
        description: 'Path to save the audio file (mp3/wav).',
      },
      output_format: {
        type: 'string',
        description: "Audio format: 'mp3' (default), 'wav', 'ogg'.",
      },
      ssml: {
        type: 'boolean',
        description: 'If true, text is interpreted as SSML. Default: false.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private readonly registry: TtsBackendRegistry;
  private readonly voicePolicy: (_input?: ResolveVoiceTtsInput) => VoiceTtsResolveResult;
  private defaultBackend = 'local';

  constructor(options?: {
    storageDir?: string;
    registry?: TtsBackendRegistry;
    voicePolicy?: (_input?: ResolveVoiceTtsInput) => VoiceTtsResolveResult;
  }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'tts');
    this.registry = options?.registry || this.buildDefaultRegistry();
    this.voicePolicy = options?.voicePolicy || ((input?: ResolveVoiceTtsInput) => resolveVoiceTts(input));
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return "Error: 'action' parameter is required.";

    const validActions = ['speak', 'list_voices', 'list_backends', 'set_default'];
    if (!validActions.includes(action)) {
      return `Error: action "${action}" is invalid. Use: ${validActions.join(', ')}.`;
    }

    this.ensureStorageDir();

    try {
      switch (action) {
        case 'speak': return await this.speak(args);
        case 'list_voices': return this.listVoices(args);
        case 'list_backends': return this.listBackends();
        case 'set_default': return this.setDefault(args);
        default: return `Error: action "${action}" is not implemented.`;
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Tts] async operation failed', error);
      const message = error instanceof Error ? err.message : String(error);
      return `TTS error: ${message}`;
    }
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private async speak(args: Record<string, unknown>): Promise<string> {
    const text = String(args.text || '');
    if (!text) return 'Error: "text" parameter is required for speak.';

    if (text.length > 10000) {
      return 'Error: text exceeds 10,000 characters. Split into smaller parts.';
    }

    const explicitBackend = typeof args.backend === 'string' && args.backend.trim().length > 0;
    const resolved = explicitBackend
      ? this.resolveExplicitBackend(args.backend as string)
      : this.resolvePolicyBackend();
    if (resolved.error) {
      return resolved.error;
    }

    const backend = resolved.backend as string;
    const voiceId = (explicitBackend && typeof args.voice_id === 'string')
      ? args.voice_id
      : (resolved.voiceId || undefined);    const language = String(args.language || 'en-US');
    const speed = typeof args.speed === 'number' ? Math.max(0.5, Math.min(2.0, args.speed)) : 1.0;
    const pitch = typeof args.pitch === 'number' ? Math.max(-20, Math.min(20, args.pitch)) : 0;
    const outputFormat = String(args.output_format || 'mp3');
    const isSsml = args.ssml === true;

    const outputPath = typeof args.output_path === 'string'
      ? args.output_path
      : path.join(this.storageDir, `tts_${Date.now()}.${outputFormat}`);

    try {
      const result = await this.executeTts(text, {
        backend,
        voiceId,
        language,
        speed,
        pitch,
        outputPath,
        outputFormat,
        ssml: isSsml,
      });

      const fileSize = fs.existsSync(result.path) ? (fs.statSync(result.path).size / 1024).toFixed(1) : '...';

      const lines: string[] = [
        `Audio generated successfully.`,
        `  - Backend: ${backend}`,
        `  - Voice: ${voiceId || 'default'}`,
        `  - Language: ${language}`,
        `  - Speed: ${speed}x`,
        `  - Format: ${result.format}`,
        `  - File: ${result.path}`,
        `  - Size: ${fileSize} KB`,
        `  ? Text: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`,
      ];
      return lines.join('\n');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Tts] creation failed', error);
      const message = error instanceof Error ? err.message : String(error);
      return `Audio generation error: ${message}`;
    }
  }

  private resolveExplicitBackend(backend: string): ResolvedBackend {
    const resolved = this.resolveBackend(backend);
    const adapter = this.registry.get(resolved);
    if (!adapter) {
      return { error: `Backend TTS "${backend}" not supported. Use: ${this.registry.providerIds().join(', ')}.` };
    }
    if (!adapter.isAvailable()) {
      return { error: `Backend TTS "${backend}" is not available in this runtime.` };
    }
    return { backend: resolved };
  }

  private resolvePolicyBackend(): ResolvedBackend {
    const decision = this.voicePolicy({ ttsReplyDesired: true });
    if (!decision.ok) {
      return {
        error: `TTS is not enabled by your voice policy: ${decision.reason} `
          + `(pass an explicit "backend" to bypass, e.g. backend: "local").`,
      };
    }
    const mapped = this.mapPolicyProvider(decision.provider);
    const adapter = mapped ? this.registry.get(mapped) : null;
    if (mapped && adapter && adapter.isAvailable()) {
      return { backend: mapped, voiceId: decision.voiceId };
    }
    const fallback = this.registry.get(this.defaultBackend);
    if (!fallback) {
      return { error: 'No registered TTS backend is available. Configure a backend or pass an explicit one.' };
    }
    if (!fallback.isAvailable()) {
      return { error: `Default TTS backend "${this.defaultBackend}" is not available in this runtime.` };
    }
    return { backend: this.defaultBackend, voiceId: null };
  }

  private mapPolicyProvider(provider: 'edge-tts' | 'gemini'): string {
    return provider;
  }

  private listVoices(args: Record<string, unknown>): string {
    const backend = String(args.backend || this.defaultBackend);
    const language = typeof args.language === 'string' ? args.language : undefined;

    const adapter = this.registry.get(backend);
    if (!adapter) {
      return `No voices found for backend "${backend}".`;
    }

    const voices = adapter.listVoices();
    const filtered = language
      ? voices.filter((voice) => voice.language.startsWith(language.split('-')[0]))
      : voices;

    if (filtered.length === 0) {
      return `No voices found for backend "${backend}".`;
    }

    const lines: string[] = [`Available voices (${backend}):`];
    for (const voice of filtered) {
      const genderIcon = { male: '👨', female: '👩', neutral: '🧑' }[voice.gender];
      lines.push(`  ${genderIcon} ${voice.id} — ${voice.name} (${voice.language})`);
    }
    return lines.join('\n');
  }

  private listBackends(): string {
    const adapters = this.registry.list();
    const lines: string[] = ['Available TTS backends:'];

    if (adapters.length === 0) {
      lines.push('  (no TTS providers registered)');
      return lines.join('\n');
    }

    for (const adapter of adapters) {
      const available = adapter.isAvailable() ? '✅' : '❌';
      const key = this.describeApiKey(adapter);
      lines.push(`  ${available} ${adapter.providerId} — ${adapter.transport} transport`);
      lines.push(`     Key: ${key}`);
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
    return `Default TTS backend changed to "${resolved}".`;
  }

  private resolveBackend(id: string): string {
    return LEGACY_BACKEND_ALIASES[id] || id;
  }

  private describeApiKey(adapter: ISpeechSynthesisAdapter): string {
    const config = builtinTtsProviderConfigs().find((c) => c.providerId === adapter.providerId);
    if (config && config.apiKeyEnvVar) {
      return config.apiKeyEnvVar;
    }
    if (adapter.transport === 'cli' || adapter.transport === 'in-process') {
      return 'Local (no key)';
    }
    return 'Configured via provider pack';
  }

  private buildDefaultRegistry(): TtsBackendRegistry {
    const registry = new TtsBackendRegistry();
    for (const config of builtinTtsProviderConfigs()) {
      registry.registerConfig(config);
    }
    return registry;
  }

  private async executeTts(
    text: string,
    options: {
      backend: string;
      voiceId?: string;
      language: string;
      speed: number;
      pitch: number;
      outputPath: string;
      outputFormat: string;
      ssml: boolean;
    },
  ): Promise<TtsSynthesizeOutput & { path: string }> {
    const adapter = this.registry.get(options.backend);
    if (!adapter) {
      throw new Error(`Backend TTS "${options.backend}" not supported.`);
    }
    if (!adapter.isAvailable()) {
      throw new Error(`Backend TTS "${options.backend}" is not available in this runtime.`);
    }

    const output = await adapter.synthesize({
      text,
      voiceId: options.voiceId,
      language: options.language,
      speed: options.speed,
      pitch: options.pitch,
      ssml: options.ssml,
      outputFormat: options.outputFormat,
    });

    this.ensureStorageDir();
    fs.writeFileSync(options.outputPath, output.audio);
    return { ...output, path: options.outputPath };
  }
}
