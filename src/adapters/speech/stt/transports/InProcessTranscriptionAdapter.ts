import type { InProcessSttProviderConfig } from '../SttProviderConfigSchema.js';
import type {
  ISpeechTranscriptionAdapter,
  SttTranscribeInput,
  SttTranscribeOutput,
  SttTransportType,
} from '../SpeechTranscriptionContract.js';
import {
  sttBuildSegments,
  sttEvidence,
  sttStringOrEmpty,
} from '../SttAdapterUtils.js';

type ModuleLoader = (_modulePath: string) => unknown;

/**
 * In-process transport adapter.
 * Imports a local transcriber module and calls it directly in this process.
 * Useful for engines bundled with the deployment or tiny custom hooks.
 */
export class InProcessTranscriptionAdapter implements ISpeechTranscriptionAdapter {
  public readonly providerId: string;
  public readonly transport: SttTransportType = 'in-process';
  public readonly modelId: string | null;

  private readonly config: InProcessSttProviderConfig;
  private readonly loader: ModuleLoader;

  constructor(
    config: InProcessSttProviderConfig,
    deps: { loader?: ModuleLoader } = {},
  ) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
    this.loader = deps.loader || ((modulePath: string) => require(modulePath));
  }

  public isAvailable(): boolean {
    return true;
  }

  public async transcribe(input: SttTranscribeInput): Promise<SttTranscribeOutput> {
    const mod = this.loader(this.config.engineModule) as Record<string, unknown>;
    const fn = mod[this.config.engineFunction];
    if (typeof fn !== 'function') {
      throw new Error(`${this.providerId} in-process adapter: module "${this.config.engineModule}" has no function "${this.config.engineFunction}".`);
    }
    const result = await (fn as (_args: Record<string, unknown>) => Promise<unknown>)({
      buffer: input.audio,
      contentType: input.contentType,
      language: input.languageHint || undefined,
      model: this.modelId || undefined,
      wordTimestamps: input.wordTimestamps || undefined,
      temperature: typeof input.temperature === 'number' ? input.temperature : undefined,
      prompt: input.prompt || undefined,
    });

    if (typeof result === 'string') {
      const text = sttStringOrEmpty(result);
      return {
        text,
        language: input.languageHint || null,
        segments: sttBuildSegments({}, text, input.speakerLabels),
        providerEvidence: sttEvidence(this.providerId, this.modelId, {
          mode: 'batch',
          transport: 'in-process',
          engine: this.config.engineModule,
        }),
      };
    }
    const record = result as Record<string, unknown>;
    const text = sttStringOrEmpty(record.text || record.transcript || record.result);
    return {
      text,
      language: input.languageHint || null,
      segments: sttBuildSegments(record, text, input.speakerLabels),
      providerEvidence: sttEvidence(this.providerId, this.modelId, {
        mode: 'batch',
        transport: 'in-process',
        engine: this.config.engineModule,
      }),
    };
  }
}
