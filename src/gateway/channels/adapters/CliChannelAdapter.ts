import { GatewayChannelAdapter } from '../GatewayChannelAdapter';
import { GatewayEventBus } from '../../events/GatewayEventBus';

export class CliChannelAdapter implements GatewayChannelAdapter {
  id = 'cli';
  name = 'Text CLI / REPL';
  type: 'sync' = 'sync';

  constructor(private eventBus: GatewayEventBus) {}

  async initialize(): Promise<void> {
    console.log('[Gateway] CLI Channel initialized. Listening on STDIN.');
    // Binding the CLI input streams to root Gateway events
  }

  async shutdown(): Promise<void> {
    console.log('[Gateway] CLI Channel closed.');
  }

  async onMessageReceived(payload: string): Promise<void> {
    // Roteia entrada do terminal pro runtime canônico
    // Sem bypassar o Gateway
    await this.eventBus.emit({
      type: 'public_ws', // Abusing ws format generically for local command transport internal
      payload: { id: 'cliloc', type: 'command', payload: { command: payload } }
    });
  }

  async sendMessage(payload: string): Promise<void> {
    // Imprime no terminal output canônico vindo do pipeline
    process.stdout.write(`[Zavorth] ${payload}\n`);
  }
}
