import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class WhatsAppGateway extends WebhookGateway {
  public readonly id = 'whatsapp';
  public readonly name = 'WhatsApp';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions | any) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.whatsappOutboxDir,
      statusFile: options.statusFile || config.whatsappStatusFile,
    } : options);
  }

  public handleWebhookVerification(url: URL): { statusCode: number; textBody: string } {
    const challenge = url.searchParams.get('hub.challenge') || '';
    return {
      statusCode: 200,
      textBody: challenge,
    };
  }

  public async handleWebhookEvent(input: { body: Record<string, unknown> }): Promise<{ statusCode: number; body: unknown }> {
    const ok = await this.onMessageReceived(input.body);
    return {
      statusCode: ok ? 200 : 400,
      body: { ok },
    };
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/whatsapp',
      doctorCommand: '/channels doctor whatsapp',
      operatorNextStep: this.resolveConfigured()
        ? 'WhatsApp bridge configurado.'
        : 'Defina WHATSAPP_BRIDGE_URL ou WHATSAPP_WEBHOOK_URL para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String((config as any).whatsappBridgeUrl || '').trim() ||
      String((config as any).whatsappWebhookUrl || '').trim()
    );
  }

  public resolveEnabled(): boolean {
    return Boolean(
      String((config as any).whatsappBridgeUrl || '').trim() ||
      String((config as any).whatsappWebhookUrl || '').trim()
    );
  }

  protected resolveOutboxDir(): string {
    return config.whatsappOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.whatsappStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const userId = String(webhookPayload.from || webhookPayload.sender || '');
    const chatId = String(webhookPayload.chatId || webhookPayload.to || 'whatsapp');
    const rawText = String(webhookPayload.text || '').trim();
    if (!rawText) return null;
    return {
      userId: userId || 'whatsapp-user',
      chatId: chatId || 'whatsapp',
      rawText,
      isGroup: chatId.includes('-') || chatId.endsWith('@g.us'),
    };
  }
}
