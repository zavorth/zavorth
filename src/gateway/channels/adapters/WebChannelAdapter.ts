import { GatewayChannelAdapter } from '../GatewayChannelAdapter';
import { GatewayEventBus } from '../../events/GatewayEventBus';
import { PublicApiRouter } from '../../../api/public/PublicApiRouter';

export class WebChannelAdapter implements GatewayChannelAdapter {
  id = 'web';
  name = 'REST/SSE/WS Web App';
  type: 'duplex' = 'duplex';

  constructor(
    private eventBus: GatewayEventBus,
    private apiRouter: PublicApiRouter
  ) {}

  async initialize(): Promise<void> {
    console.log('[Gateway] Web Channel initialized (HTTP/WS endpoints routed).');
    // Em Produção conectaria o server nativo HTTP do Node para disparar o this.apiRouter.route()
  }

  async shutdown(): Promise<void> {
    console.log('[Gateway] Web Channel closed.');
  }

  async onMessageReceived(payload: unknown): Promise<void> {
    // Traffic that comes from socket
  }

  async sendMessage(payload: unknown): Promise<void> {
    // Broadcast via SSE or WS to web clients hooked in this channel
  }
}
