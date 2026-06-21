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
    return this.gateway.describe();
  }

  public getGateway(): WebhookGateway {
    return this.gateway;
  }
}
