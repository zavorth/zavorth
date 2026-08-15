import type { ISpeechTranscriptionAdapter } from './SpeechTranscriptionContract.js';
import type { SttProviderConfig } from './SttProviderConfigSchema.js';
import { SttTransportFactory } from './SttTransportFactory.js';
import { logger } from '../../../logger.js';

/**
 * In-memory registry of STT providers.
 * Resolves a providerId to its configured adapter. Providers load lazily so a
 * broken pack never blocks the rest of the registry.
 */
export class SttBackendRegistry {
  private readonly adapters = new Map<string, ISpeechTranscriptionAdapter>();
  private readonly transportFactory: SttTransportFactory;

  constructor(transportFactory?: SttTransportFactory) {
    this.transportFactory = transportFactory || new SttTransportFactory();
  }

  /**
   * Builds and registers an adapter from a validated provider config.
   */
  public registerConfig(config: SttProviderConfig): void {
    const adapter = this.transportFactory.create(config);
    this.registerAdapter(adapter);
  }

  /**
   * Registers a prebuilt adapter under its providerId.
   */
  public registerAdapter(adapter: ISpeechTranscriptionAdapter): void {
    if (this.adapters.has(adapter.providerId)) {
      logger.warn(`[STT] Provider "${adapter.providerId}" is already registered; replacing it.`);
    }
    this.adapters.set(adapter.providerId, adapter);
  }

  public get(providerId: string): ISpeechTranscriptionAdapter | null {
    return this.adapters.get(providerId) || null;
  }

  public has(providerId: string): boolean {
    return this.adapters.has(providerId);
  }

  public list(): ISpeechTranscriptionAdapter[] {
    return Array.from(this.adapters.values());
  }

  public providerIds(): string[] {
    return Array.from(this.adapters.keys());
  }

  public clear(): void {
    this.adapters.clear();
  }
}
