import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class HomeAssistantGateway extends WebhookGateway {
  public readonly id = 'home-assistant';
  public readonly name = 'Home Assistant';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.homeAssistantOutboxDir,
      statusFile: options.statusFile || config.homeAssistantStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/home-assistant',
      doctorCommand: '/channels doctor home-assistant',
      operatorNextStep: this.resolveConfigured()
        ? 'Home Assistant configurado. Pronto para enviar notificacoes.'
        : 'Defina HOME_ASSISTANT_WEBHOOK_URL ou HOME_ASSISTANT_URL e HOME_ASSISTANT_TOKEN para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.homeAssistantWebhookUrl || '').trim()
      || (String(config.homeAssistantUrl || '').trim() && String(config.homeAssistantToken || '').trim()),
    );
  }

  public resolveEnabled(): boolean {
    return Boolean(
      String(config.homeAssistantWebhookUrl || '').trim()
      || String(config.homeAssistantUrl || '').trim()
      || String(config.homeAssistantToken || '').trim(),
    );
  }

  protected resolveOutboxDir(): string {
    return config.homeAssistantOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.homeAssistantStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const userId = String(
      (webhookPayload as any).user_id
      || (webhookPayload as any).userId
      || (webhookPayload as any).entity_id
      || '',
    ).trim();
    const chatId = String(
      (webhookPayload as any).chatId
      || (webhookPayload as any).source
      || 'home-assistant',
    ).trim();
    const rawText = String(
      (webhookPayload as any).message
      || (webhookPayload as any).text
      || (webhookPayload as any).rawText
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload as any).messageId
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: userId || 'ha-user',
      chatId: chatId || 'home-assistant',
      rawText,
      messageId,
      isGroup: false,
      fields: {
        eventType: String((webhookPayload as any).event_type || ''),
      },
    };
  }

  public async sendText(text: string, title?: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.sendMessage({ text });
      return;
    }

    const webhookUrl = String(config.homeAssistantWebhookUrl || '').trim();
    const haUrl = String(config.homeAssistantUrl || '').replace(/\/+$/, '');
    const haToken = String(config.homeAssistantToken || '').trim();

    const targetUrl = webhookUrl || `${haUrl}/api/services/notify/notify`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
    if (haToken && !webhookUrl) {
      headers.Authorization = `Bearer ${haToken}`;
    }

    try {
      const body = webhookUrl
        ? JSON.stringify({ message: text, title: title || 'Zavorth' })
        : JSON.stringify({ message: text, title: title || 'Zavorth' });

      const response = await this.fetchImpl(targetUrl, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        this.recordError(`Home Assistant error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: any) {
      this.recordError(`Home Assistant send failed: ${error?.message || error}`);
    }
  }
}
