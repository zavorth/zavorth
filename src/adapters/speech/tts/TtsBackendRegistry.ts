import type { ISpeechSynthesisAdapter } from './SpeechSynthesisContract.js';
import type { TtsProviderConfig } from './TtsProviderConfigSchema.js';
import { TtsTransportFactory } from './TtsTransportFactory.js';
import { logger } from '../../../logger.js';

/**
 * In-memory registry of TTS providers.
 * Resolves a providerId to its configured adapter. Providers load lazily so a
 * broken pack never blocks the rest of the registry.
 */
export class TtsBackendRegistry {
  private readonly adapters = new Map<string, ISpeechSynthesisAdapter>();
  private readonly transportFactory: TtsTransportFactory;

  constructor(transportFactory?: TtsTransportFactory) {
    this.transportFactory = transportFactory || new TtsTransportFactory();
  }

  /**
   * Builds and registers an adapter from a validated provider config.
   */
  public registerConfig(config: TtsProviderConfig): void {
    const adapter = this.transportFactory.create(config);
    this.registerAdapter(adapter);
  }

  /**
   * Registers a prebuilt adapter under its providerId.
   */
  public registerAdapter(adapter: ISpeechSynthesisAdapter): void {
    if (this.adapters.has(adapter.providerId)) {
      logger.warn(`[TTS] Provider "${adapter.providerId}" is already registered; replacing it.`);
    }
    this.adapters.set(adapter.providerId, adapter);
  }

  public get(providerId: string): ISpeechSynthesisAdapter | null {
    return this.adapters.get(providerId) || null;
  }

  public has(providerId: string): boolean {
    return this.adapters.has(providerId);
  }

  public list(): ISpeechSynthesisAdapter[] {
    return Array.from(this.adapters.values());
  }

  public providerIds(): string[] {
    return Array.from(this.adapters.keys());
  }

  public clear(): void {
    this.adapters.clear();
  }
}
