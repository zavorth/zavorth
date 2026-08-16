import type { TtsProviderConfig } from './TtsProviderConfigSchema.js';
import type { ISpeechSynthesisAdapter, TtsTransportType } from './SpeechSynthesisContract.js';
import { HttpSynthesisAdapter } from './transports/HttpSynthesisAdapter.js';
import { SdkSynthesisAdapter } from './transports/SdkSynthesisAdapter.js';
import { CliSynthesisAdapter } from './transports/CliSynthesisAdapter.js';
import { InProcessSynthesisAdapter } from './transports/InProcessSynthesisAdapter.js';
import { McpSynthesisAdapter } from './transports/McpSynthesisAdapter.js';

/**
 * Maps each transport type to the adapter factory that builds it.
 * New transports register here once; the rest of the system stays untouched.
 */
export class TtsTransportFactory {
  /**
   * Builds the adapter for a validated provider config.
   * The switch narrows the config union so each adapter receives its own type.
   */
  public create(config: TtsProviderConfig): ISpeechSynthesisAdapter {
    switch (config.transport) {
      case 'http': return new HttpSynthesisAdapter(config);
      case 'sdk': return new SdkSynthesisAdapter(config);
      case 'cli': return new CliSynthesisAdapter(config);
      case 'in-process': return new InProcessSynthesisAdapter(config);
      case 'mcp': return new McpSynthesisAdapter(config);
      default: {
        const transport = (config as { transport?: string }).transport;
        throw new Error(`No TTS adapter factory registered for transport "${transport}".`);
      }
    }
  }
}

export type { TtsTransportType };
