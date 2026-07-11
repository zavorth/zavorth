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
        ? 'Signal live path ready (JSON-RPC and/or signal-cli).'
        : 'Defina SIGNAL_JSONRPC_URL (+ account) ou SIGNAL_CLI_PATH.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.signalJsonRpcUrl || '').trim()
      || String(config.signalCliPath || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return this.resolveConfigured() || Boolean(config.signalEnabled);
  }

  protected resolveOutboxDir(): string {
    return config.signalOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.signalStatusFile;
  }

  public override doctorSnapshot() {
    const base = super.doctorSnapshot();
    return {
      ...base,
      installHint: this.resolveConfigured()
        ? 'Signal configured. Prefer JSON-RPC send for always-on bridge.'
        : 'Set SIGNAL_JSONRPC_URL and SIGNAL_ALLOWED_RECIPIENTS.',
      allowlist: {
        ...base.allowlist,
        recipientAllowlistConfigured: Array.isArray(config.signalAllowedRecipients) && config.signalAllowedRecipients.length > 0,
      },
    };
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    // signal-cli receive envelope: envelope.source / dataMessage.message
    const envelope = webhookPayload.envelope && typeof webhookPayload.envelope === 'object'
      ? webhookPayload.envelope as Record<string, unknown>
      : webhookPayload;
    const dataMessage = envelope.dataMessage && typeof envelope.dataMessage === 'object'
      ? envelope.dataMessage as Record<string, unknown>
      : null;
    const userId = String(
      envelope.source
      || envelope.sourceNumber
      || webhookPayload.sender
      || webhookPayload.from
      || '',
    ).trim();
    const groupInfo = dataMessage?.groupInfo && typeof dataMessage.groupInfo === 'object'
      ? dataMessage.groupInfo as Record<string, unknown>
      : null;
    const chatId = String(
      groupInfo?.groupId
      || webhookPayload.chatId
      || webhookPayload.to
      || userId
      || 'signal',
    ).trim();
    const rawText = String(
      dataMessage?.message
      || webhookPayload.text
      || webhookPayload.message
      || '',
    ).trim();
    if (!rawText) return null;
    return {
      userId: userId || 'signal-user',
      chatId: chatId || 'signal',
      rawText,
      messageId: String(envelope.timestamp || webhookPayload.messageId || '').trim() || null,
      isGroup: Boolean(groupInfo?.groupId),
      fields: {
        account: String(config.signalAccountNumber || '').trim() || null,
      },
    };
  }
}
