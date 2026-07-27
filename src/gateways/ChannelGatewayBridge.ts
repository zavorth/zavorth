import type {
  ChannelAdapterContract,
  ChannelAdapterStatus,
  ChannelMeshId,
} from '../contracts/ChannelMeshContract.js';
import type { WebhookGateway } from './WebhookGateway.js';

export class ChannelGatewayBridge implements ChannelAdapterContract {
  public readonly id: ChannelMeshId | string;

  constructor(private readonly gateway: WebhookGateway) {
    this.id = gateway.id;
  }

  public describe(): ChannelAdapterStatus {
    const describe = (this.gateway as WebhookGateway & { describe?: () => ChannelAdapterStatus }).describe;
    if (typeof describe === 'function') {
      return describe.call(this.gateway);
    }
    return {
      id: this.gateway.id,
      label: String((this.gateway as WebhookGateway & { name?: string }).name || this.gateway.id),
      readiness: 'planned',
      implementationState: 'planned',
      configured: false,
      transport: 'webhook',
      notes: ['Gateway does not expose a channel status descriptor yet.'],
      features: {
        inbound: false,
        outbound: false,
        sessionList: false,
        sessionHistory: false,
        sessionSend: false,
        sessionSpawn: false,
        attachments: false,
        threads: false,
        groupPolicy: false,
        identityHints: false,
      },
      lastHealth: 'unknown',
    };
  }

  public getGateway(): WebhookGateway {
    return this.gateway;
  }
}
