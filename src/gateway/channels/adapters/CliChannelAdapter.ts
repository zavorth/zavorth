import { logger } from '../../../logger.js';
import { GatewayChannelAdapter } from '../GatewayChannelAdapter';
import { GatewayEventBus } from '../../events/GatewayEventBus';

export class CliChannelAdapter implements GatewayChannelAdapter {
  id = 'cli';
  name = 'Text CLI / REPL';
  type = 'sync' as const;

  constructor(private eventBus: GatewayEventBus) {}

  async initialize(): Promise<void> {
    logger.info('[Gateway] CLI Channel initialized. Listening on STDIN.');
    // Binding the CLI input streams to root Gateway events
  }

  async shutdown(): Promise<void> {
    logger.info('[Gateway] CLI Channel closed.');
  }

  async onMessageReceived(payload: string): Promise<void> {
    // Routes terminal input to the canonical runtime without bypassing the Gateway.
    await this.eventBus.emit({
      type: 'public_ws', // Abusing ws format generically for local command transport internal
      payload: { id: 'cliloc', type: 'command', payload: { command: payload } }
    });
  }

  async sendMessage(payload: string): Promise<void> {
    // Prints canonical pipeline output to the terminal.
    process.stdout.write(`[Zavorth] ${payload}\n`);
  }
}
