import { config } from '../config/index.js';
import type { ChannelAdapterStatus } from '../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from './WebhookGateway.js';

export class InstagramGateway extends WebhookGateway {
  public readonly id = 'instagram';
  public readonly name = 'Instagram';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions | any) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.instagramOutboxDir,
      statusFile: options.statusFile || config.instagramStatusFile,
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
      webhookPath: '/api/webhooks/instagram',
      doctorCommand: '/channels doctor instagram',
      operatorNextStep: this.resolveConfigured()
        ? 'Instagram Meta Messaging configurado.'
        : 'Defina INSTAGRAM_ACCESS_TOKEN para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(String(config.instagramAccessToken || '').trim());
  }

  public resolveEnabled(): boolean {
    return Boolean(String(config.instagramAccessToken || '').trim());
  }

  protected resolveOutboxDir(): string {
    return config.instagramOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.instagramStatusFile;
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
    const chatId = String(webhookPayload.chatId || webhookPayload.to || 'instagram');
    const rawText = String(webhookPayload.text || '').trim();
    if (!rawText) return null;
    return {
      userId: userId || 'instagram-user',
      chatId: chatId || 'instagram',
      rawText,
      isGroup: false,
    };
  }
}
