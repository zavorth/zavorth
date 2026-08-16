import fs from 'fs';
import type { SdkTtsProviderConfig } from '../TtsProviderConfigSchema.js';
import { resolveTtsApiKey } from '../TtsProviderConfigSchema.js';
import type {
  ISpeechSynthesisAdapter,
  TtsSynthesizeInput,
  TtsSynthesizeOutput,
  TtsTransportType,
  TtsVoiceInfo,
} from '../SpeechSynthesisContract.js';
import { ttsEvidence, ttsReadPath, ttsStringOrEmpty } from '../TtsAdapterUtils.js';

type ModuleLoader = (_modulePath: string) => unknown;

/**
 * SDK transport adapter.
 * Loads a vendor client library at runtime and calls its synthesis method,
 * keeping vendor SDKs out of the core bundle and out of Zavorth's dependency tree.
 */
export class SdkSynthesisAdapter implements ISpeechSynthesisAdapter {
  public readonly providerId: string;
  public readonly transport: TtsTransportType = 'sdk';
  public readonly modelId: string | null;
  public readonly defaultVoiceId: string | null;

  private readonly config: SdkTtsProviderConfig;
  private readonly apiKey: string | null;
  private readonly loader: ModuleLoader;

  constructor(
    config: SdkTtsProviderConfig,
    deps: { loader?: ModuleLoader } = {},
  ) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
    this.defaultVoiceId = config.defaultVoiceId || null;
    this.apiKey = resolveTtsApiKey(config);
    this.loader = deps.loader || ((modulePath: string) => require(modulePath));
  }

  public isAvailable(): boolean {
    return true;
  }

  public listVoices(): TtsVoiceInfo[] {
    return this.config.voices;
  }

  public async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    const mod = this.loader(this.config.sdkModule) as Record<string, unknown>;
    const factory = mod[this.config.factoryFunction];
    if (typeof factory !== 'function') {
      throw new Error(`${this.providerId} sdk adapter: module "${this.config.sdkModule}" has no function "${this.config.factoryFunction}".`);
    }
    const clientOptions: Record<string, unknown> = {};
    if (this.apiKey) {
      clientOptions[this.config.configField || 'apiKey'] = this.apiKey;
    }
    if (this.modelId) {
      clientOptions.model = this.modelId;
    }
    const client = (factory as (_options: Record<string, unknown>) => unknown)(clientOptions);
    const synthesizeFn = this.pickSynthesizeFn(client);
    if (typeof synthesizeFn !== 'function') {
      throw new Error(`${this.providerId} sdk adapter: loaded client has no synthesize function.`);
    }

    const result = await synthesizeFn.call(
      client,
      {
        text: input.text,
        voice: input.voiceId || this.defaultVoiceId || undefined,
        language: input.language || this.config.languageCode || undefined,
        speed: typeof input.speed === 'number' ? input.speed : undefined,
        pitch: typeof input.pitch === 'number' ? input.pitch : undefined,
        format: input.outputFormat || this.config.responseFormat || 'mp3',
        model: this.modelId || undefined,
      },
    );
    const audio = this.extractAudio(result);
    if (!audio || audio.length === 0) {
      throw new Error(`${this.providerId} sdk adapter returned no audio bytes.`);
    }
    const format = input.outputFormat || this.config.responseFormat || 'mp3';
    return {
      audio,
      format,
      contentType: this.config.responseContentType,
      providerEvidence: ttsEvidence(this.providerId, this.modelId, {
        mode: 'batch',
        transport: 'sdk',
        module: this.config.sdkModule,
      }),
    };
  }

  private pickSynthesizeFn(client: unknown): ((_args: Record<string, unknown>) => Promise<unknown>) | null {
    if (client === null || typeof client !== 'object') {
      return null;
    }
    const record = client as Record<string, unknown>;
    const preferred = this.config.synthesizeFunction;
    if (preferred && typeof record[preferred] === 'function') {
      return record[preferred] as (_args: Record<string, unknown>) => Promise<unknown>;
    }
    for (const key of ['synthesize', 'speak', 'generateSpeech', 'textToSpeech']) {
      const candidate = record[key];
      if (typeof candidate === 'function') {
        return candidate as (_args: Record<string, unknown>) => Promise<unknown>;
      }
    }
    return null;
  }

  private extractAudio(result: unknown): Buffer | null {
    if (Buffer.isBuffer(result)) {
      return result;
    }
    if (typeof result === 'string') {
      const raw = result.trim();
      if (!raw) return null;
      if (raw.startsWith('{') || raw.startsWith('[')) {
        return this.extractAudio(JSON.parse(raw));
      }
      const asBuffer = Buffer.from(raw, 'base64');
      return asBuffer.length > 0 ? asBuffer : null;
    }
    if (result && typeof result === 'object') {
      const record = result as Record<string, unknown>;
      const audio = record.audio || record.buffer || record.data || ttsReadPath(record, 'audio.base64');
      if (Buffer.isBuffer(audio)) {
        return audio;
      }
      if (typeof audio === 'string') {
        const raw = audio.trim();
        if (!raw) return null;
        const asBuffer = Buffer.from(raw, 'base64');
        return asBuffer.length > 0 ? asBuffer : null;
      }
      if (record.base64 && typeof record.base64 === 'string') {
        return Buffer.from(record.base64, 'base64');
      }
      if (record.path && typeof record.path === 'string') {
        try {
          return fs.readFileSync(record.path);
        } catch (error: unknown) {
          return null;
        }
      }
      const text = ttsStringOrEmpty(record.path || '');
      if (text) {
        try {
          return fs.readFileSync(text);
        } catch (error: unknown) {
          return null;
        }
      }
    }
    return null;
  }
}
