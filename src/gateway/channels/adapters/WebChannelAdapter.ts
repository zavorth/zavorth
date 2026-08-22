import { logger } from '../../../logger.js';
import { GatewayChannelAdapter } from '../GatewayChannelAdapter';
import { GatewayEventBus } from '../../events/GatewayEventBus';
import { PublicApiRouter } from '../../../api/public/PublicApiRouter';

export class WebChannelAdapter implements GatewayChannelAdapter {
  id = 'web';
  name = 'REST/SSE/WS Web App';
  type = 'duplex' as const;

  constructor(
    private eventBus: GatewayEventBus,
    private apiRouter: PublicApiRouter
  ) {}

  async initialize(): Promise<void> {
    logger.info('[Gateway] Web Channel initialized (HTTP/WS endpoints routed).');
    // In production this would connect the native Node HTTP server to this.apiRouter.route().
  }

  async shutdown(): Promise<void> {
    logger.info('[Gateway] Web Channel closed.');
  }

  async onMessageReceived(payload: unknown): Promise<void> {
    // Traffic that comes from socket
  }

  async sendMessage(payload: unknown): Promise<void> {
    // Broadcast via SSE or WS to web clients hooked in this channel
  }
}
