import type { InProcessTtsProviderConfig } from '../TtsProviderConfigSchema.js';
import type {
  ISpeechSynthesisAdapter,
  TtsSynthesizeInput,
  TtsSynthesizeOutput,
  TtsTransportType,
  TtsVoiceInfo,
} from '../SpeechSynthesisContract.js';
import { ttsEvidence, ttsStringOrEmpty } from '../TtsAdapterUtils.js';

type ModuleLoader = (_modulePath: string) => unknown;

/**
 * In-process transport adapter.
 * Imports a local synthesis engine and calls it directly in this process.
 * The engine function receives the normalized input and returns either a
 * Buffer, a base64 string, or an object with `audio`/`buffer`/`data` bytes.
 */
export class InProcessSynthesisAdapter implements ISpeechSynthesisAdapter {
  public readonly providerId: string;
  public readonly transport: TtsTransportType = 'in-process';
  public readonly modelId: string | null;
  public readonly defaultVoiceId: string | null;

  private readonly config: InProcessTtsProviderConfig;
  private readonly loader: ModuleLoader;

  constructor(
    config: InProcessTtsProviderConfig,
    deps: { loader?: ModuleLoader } = {},
  ) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
    this.defaultVoiceId = config.defaultVoiceId || null;
    this.loader = deps.loader || ((modulePath: string) => require(modulePath));
  }

  public isAvailable(): boolean {
    return this.moduleResolvable();
  }

  private moduleResolvable(): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require.resolve(this.config.engineModule);
      return true;
    } catch (error: unknown) {
      return false;
    }
  }

  public listVoices(): TtsVoiceInfo[] {
    return this.config.voices;
  }

  public async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    const mod = this.loader(this.config.engineModule) as Record<string, unknown>;
    const fn = mod[this.config.engineFunction];
    if (typeof fn !== 'function') {
      throw new Error(`${this.providerId} in-process adapter: module "${this.config.engineModule}" has no function "${this.config.engineFunction}".`);
    }
    const result = await (fn as (_args: Record<string, unknown>) => Promise<unknown>)({
      text: input.text,
      voice: input.voiceId || this.defaultVoiceId || undefined,
      language: input.language || this.config.languageCode || undefined,
      speed: typeof input.speed === 'number' ? input.speed : undefined,
      pitch: typeof input.pitch === 'number' ? input.pitch : undefined,
      format: input.outputFormat || this.config.responseFormat || 'mp3',
      model: this.modelId || undefined,
    });
    const audio = this.extractAudio(result);
    if (!audio || audio.length === 0) {
      throw new Error(`${this.providerId} in-process adapter returned no audio bytes.`);
    }
    const format = input.outputFormat || this.config.responseFormat || 'mp3';
    return {
      audio,
      format,
      contentType: this.config.responseContentType,
      providerEvidence: ttsEvidence(this.providerId, this.modelId, {
        mode: 'batch',
        transport: 'in-process',
        engine: this.config.engineModule,
      }),
    };
  }

  private extractAudio(result: unknown): Buffer | null {
    if (Buffer.isBuffer(result)) {
      return result;
    }
    if (typeof result === 'string') {
      const raw = result.trim();
      if (!raw) return null;
      const asBuffer = Buffer.from(raw, 'base64');
      return asBuffer.length > 0 ? asBuffer : null;
    }
    if (result && typeof result === 'object') {
      const record = result as Record<string, unknown>;
      const audio = record.audio || record.buffer || record.data;
      if (Buffer.isBuffer(audio)) {
        return audio;
      }
      if (typeof audio === 'string') {
        const base64 = ttsStringOrEmpty(audio);
        return base64 ? Buffer.from(base64, 'base64') : null;
      }
    }
    return null;
  }
}
