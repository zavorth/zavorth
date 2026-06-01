import { GatewayChannelAdapter } from '../GatewayChannelAdapter';
import { GatewayEventBus } from '../../events/GatewayEventBus';
import {
  AcpGenericChannelAdapterService,
} from '../../../services/AcpGenericChannelAdapterService.js';
import type {
  AcpGenericChannelAdapterReceipt,
} from '../../../contracts/AcpGenericChannelAdapterContract.js';

export class AcpGenericChannelAdapter implements GatewayChannelAdapter {
  public readonly id = 'acp-generic';
  public readonly name = 'ACP Generic Channel Adapter';
  public readonly type: 'duplex' = 'duplex';

  private lastReceipt: AcpGenericChannelAdapterReceipt | null = null;

  public constructor(
    private readonly eventBus: GatewayEventBus,
    private readonly service = new AcpGenericChannelAdapterService(),
  ) {}

  public async initialize(): Promise<void> {
    await this.eventBus.emit({
      type: 'acp_generic_channel_frame',
      channelId: 'acp-generic',
      receiptId: 'acp-generic-adapter-initialized',
      status: 'ready',
      sessionId: 'acp-generic',
      reachesExecutor: false,
    });
  }

  public async shutdown(): Promise<void> {}

  public async onMessageReceived(payload: unknown): Promise<void> {
    const receipt = this.service.ingest(payload, { emitGatewayEvent: true });
    this.lastReceipt = receipt;
    await this.eventBus.emit({
      type: 'acp_generic_channel_frame',
      channelId: 'acp-generic',
      receiptId: receipt.id,
      status: receipt.status,
      sessionId: receipt.input.sessionId,
      reachesExecutor: receipt.normalization.reachesExecutor,
    });

    if (receipt.normalization.reachesExecutor && receipt.message) {
      await this.eventBus.emit({
        type: 'public_ws',
        payload: {
          id: receipt.id,
          type: 'event',
          payload: {
            topic: 'im_message',
            data: {
              normalizedInboundMessage: receipt.message,
              acpGenericChannelReceipt: {
                id: receipt.id,
                status: receipt.status,
                frameId: receipt.input.frameId,
                source: 'acp-generic-channel-adapter',
              },
            },
          },
        },
      });
    }
  }

  public async sendMessage(payload: unknown): Promise<void> {
    const receipt = this.service.ingest({
      kind: 'response',
      payload: {
        text: typeof payload === 'string' ? payload : JSON.stringify(payload),
        channel: 'api',
      },
      source: {
        runtimeName: 'zavorth',
        paths: ['zavorth://acp-generic-channel-adapter/outbound-diagnostic'],
      },
    });
    this.lastReceipt = receipt;
  }

  public getLastReceipt(): AcpGenericChannelAdapterReceipt | null {
    return this.lastReceipt;
  }
}
