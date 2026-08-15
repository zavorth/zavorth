import type { SdkSttProviderConfig } from '../SttProviderConfigSchema.js';
import { resolveSttApiKey } from '../SttProviderConfigSchema.js';
import type {
  ISpeechTranscriptionAdapter,
  SttTranscribeInput,
  SttTranscribeOutput,
  SttTransportType,
} from '../SpeechTranscriptionContract.js';
import {
  sttBuildSegments,
  sttEvidence,
  sttReadPath,
  sttStringOrEmpty,
} from '../SttAdapterUtils.js';

type ModuleLoader = (_modulePath: string) => unknown;

/**
 * SDK transport adapter.
 * Loads a vendor client library at runtime and calls its transcription function,
 * keeping vendor SDKs out of the core bundle and out of Zavorth's dependency tree.
 */
export class SdkTranscriptionAdapter implements ISpeechTranscriptionAdapter {
  public readonly providerId: string;
  public readonly transport: SttTransportType = 'sdk';
  public readonly modelId: string | null;

  private readonly config: SdkSttProviderConfig;
  private readonly apiKey: string | null;
  private readonly loader: ModuleLoader;

  constructor(
    config: SdkSttProviderConfig,
    deps: { loader?: ModuleLoader } = {},
  ) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
    this.apiKey = resolveSttApiKey(config);
    this.loader = deps.loader || ((modulePath: string) => require(modulePath));
  }

  public isAvailable(): boolean {
    return true;
  }

  public async transcribe(input: SttTranscribeInput): Promise<SttTranscribeOutput> {
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
    const transcribeFn = this.pickTranscribeFn(client);
    if (typeof transcribeFn !== 'function') {
      throw new Error(`${this.providerId} sdk adapter: loaded client has no transcribe function.`);
    }

    const result = await transcribeFn.call(
      client,
      {
        buffer: input.audio,
        contentType: input.contentType,
        language: input.languageHint || undefined,
        model: this.modelId || undefined,
        wordTimestamps: input.wordTimestamps || undefined,
        temperature: typeof input.temperature === 'number' ? input.temperature : undefined,
        prompt: input.prompt || undefined,
      },
    );

    if (typeof result === 'string') {
      const text = sttStringOrEmpty(result);
      return {
        text,
        language: input.languageHint || null,
        segments: sttBuildSegments({}, text, input.speakerLabels),
        providerEvidence: sttEvidence(this.providerId, this.modelId, {
          mode: 'batch',
          transport: 'sdk',
          module: this.config.sdkModule,
        }),
      };
    }
    const record = result as Record<string, unknown>;
    const text = sttStringOrEmpty(
      this.config.transcriptPath
        ? sttReadPath(record, this.config.transcriptPath)
        : (record.text || record.transcript || record.result),
    );
    return {
      text,
      language: input.languageHint || null,
      segments: sttBuildSegments(record, text, input.speakerLabels),
      providerEvidence: sttEvidence(this.providerId, this.modelId, {
        mode: 'batch',
        transport: 'sdk',
        module: this.config.sdkModule,
      }),
    };
  }

  private pickTranscribeFn(client: unknown): ((_args: Record<string, unknown>) => Promise<unknown>) | null {
    if (client === null || typeof client !== 'object') {
      return null;
    }
    const record = client as Record<string, unknown>;
    for (const key of ['transcribe', 'transcribeAudio', 'recognize', 'recognizeSpeech']) {
      const candidate = record[key];
      if (typeof candidate === 'function') {
        return candidate as (_args: Record<string, unknown>) => Promise<unknown>;
      }
    }
    return null;
  }
}
