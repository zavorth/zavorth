import type { SttProviderConfig } from './SttProviderConfigSchema.js';
import type { ISpeechTranscriptionAdapter, SttTransportType } from './SpeechTranscriptionContract.js';
import { HttpTranscriptionAdapter } from './transports/HttpTranscriptionAdapter.js';
import { WebsocketTranscriptionAdapter } from './transports/WebsocketTranscriptionAdapter.js';
import { SdkTranscriptionAdapter } from './transports/SdkTranscriptionAdapter.js';
import { CliTranscriptionAdapter } from './transports/CliTranscriptionAdapter.js';
import { InProcessTranscriptionAdapter } from './transports/InProcessTranscriptionAdapter.js';
import { McpTranscriptionAdapter } from './transports/McpTranscriptionAdapter.js';

/**
 * Maps each transport type to the adapter factory that builds it.
 * New transports register here once; the rest of the system stays untouched.
 */
export class SttTransportFactory {
  /**
   * Builds the adapter for a validated provider config.
   * The switch narrows the config union so each adapter receives its own type.
   */
  public create(config: SttProviderConfig): ISpeechTranscriptionAdapter {
    switch (config.transport) {
      case 'http': return new HttpTranscriptionAdapter(config);
      case 'websocket': return new WebsocketTranscriptionAdapter(config);
      case 'sdk': return new SdkTranscriptionAdapter(config);
      case 'cli': return new CliTranscriptionAdapter(config);
      case 'in-process': return new InProcessTranscriptionAdapter(config);
      case 'mcp': return new McpTranscriptionAdapter(config);
      default: {
        const transport = (config as { transport?: string }).transport;
        throw new Error(`No STT adapter factory registered for transport "${transport}".`);
      }
    }
  }
}

export type { SttTransportType };
