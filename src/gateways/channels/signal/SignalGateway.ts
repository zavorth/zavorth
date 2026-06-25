import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class SignalGateway extends WebhookGateway {
  public readonly id = 'signal';
  public readonly name = 'Signal';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions | any) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.signalOutboxDir,
      statusFile: options.statusFile || config.signalStatusFile,
    } : options);
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/signal',
      doctorCommand: '/channels doctor signal',
      operatorNextStep: this.resolveConfigured()
        ? 'Signal bridge configurado.'
        : 'Defina SIGNAL_JSONRPC_URL ou SIGNAL_CLI_PATH para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.signalJsonRpcUrl || '').trim() ||
      String(config.signalCliPath || '').trim()
    );
  }

  public resolveEnabled(): boolean {
    return Boolean(
      String(config.signalJsonRpcUrl || '').trim() ||
      String(config.signalCliPath || '').trim()
    );
  }

  protected resolveOutboxDir(): string {
    return config.signalOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.signalStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const userId = String(webhookPayload.sender || webhookPayload.from || '');
    const chatId = String(webhookPayload.chatId || webhookPayload.to || 'signal');
    const rawText = String(webhookPayload.text || '').trim();
    if (!rawText) return null;
    return {
      userId: userId || 'signal-user',
      chatId: chatId || 'signal',
      rawText,
      isGroup: false,
    };
  }
}
