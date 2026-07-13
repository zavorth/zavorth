import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';
import { hookMiddleware } from '../../../services/ZavorthMiddlewareHook.js';

export class WhatsAppGateway extends WebhookGateway {
  public readonly id = 'whatsapp';
  public readonly name = 'WhatsApp';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'local-bridge';

  constructor(options: WebhookGatewayOptions | Record<string, unknown>) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.whatsappOutboxDir,
      statusFile: options.statusFile || config.whatsappStatusFile,
    } : options);
  }

  public handleWebhookVerification(url: URL): { statusCode: number; textBody: string } {
    const mode = url.searchParams.get('hub.mode') || '';
    const token = url.searchParams.get('hub.verify_token') || '';
    const challenge = url.searchParams.get('hub.challenge') || '';
    const expected = String(config.whatsappWebhookVerifyToken || '').trim();
    if (mode === 'subscribe' && expected && token === expected) {
      return { statusCode: 200, textBody: challenge };
    }
    if (!expected) {
      return { statusCode: 200, textBody: challenge };
    }
    return { statusCode: 403, textBody: 'forbidden' };
  }

  public async handleWebhookEvent(input: { body: Record<string, unknown> }): Promise<{ statusCode: number; body: unknown }> {
    const messages = this.extractCloudApiMessages(input.body);
    if (messages.length > 0) {
      let any = false;
      for (const message of messages) {
        any = (await this.onMessageReceived(message)) || any;
      }
      return { statusCode: any ? 200 : 400, body: { ok: any, count: messages.length } };
    }
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
        ? 'WhatsApp live path ready (Cloud API and/or bridge).'
        : 'Defina WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_BRIDGE_URL.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      (String(config.whatsappAccessToken || config.whatsappBotToken || '').trim()
        && String(config.whatsappPhoneNumberId || '').trim())
      || String(config.whatsappBridgeUrl || '').trim()
      || String(config.whatsappWebhookUrl || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return this.resolveConfigured() || Boolean(config.whatsappEnabled);
  }

  protected resolveOutboxDir(): string {
    return config.whatsappOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.whatsappStatusFile;
  }

  public override doctorSnapshot() {
    const base = super.doctorSnapshot();
    const provider = String(config.whatsappProvider || 'stub').trim().toLowerCase();
    const baileys = provider === 'baileys';
    return {
      ...base,
      provider,
      productTier: baileys ? 'T2' : this.resolveConfigured() ? 'T1' : 'catalog',
      productionClaim: baileys ? 'experimental' : 'when-certified-live',
      experimental: baileys,
      installHint: baileys
        ? 'Baileys is T2 experimental. Install scripts/whatsapp-bridge deps, run zavorth whatsapp-bridge start, set WHATSAPP_BRIDGE_URL.'
        : this.resolveConfigured()
          ? 'WhatsApp configured for Cloud API or bridge outbound.'
          : 'Set Cloud API tokens (T1) or WHATSAPP_BRIDGE_URL with Baileys bridge (T2 experimental).',
      allowlist: {
        ...base.allowlist,
        chatAllowlistConfigured: Array.isArray(config.whatsappAllowedChatIds) && config.whatsappAllowedChatIds.length > 0,
      },
    };
  }

  public override async onMessageReceived(payload: Record<string, unknown>): Promise<boolean> {
    const extracted = this.extractInboundPayload(payload);
    if (!extracted) {
      return false;
    }

    const { userId, chatId, rawText } = extracted;
    const middlewareResult = await hookMiddleware({
      text: rawText,
      channelId: 'whatsapp',
      userId,
      reply: async (text: string) => {
        await this.sendMessage({ chatId, text });
      },
    });

    if (middlewareResult.handled) {
      return true;
    }

    return super.onMessageReceived(payload);
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    // Flat bridge shape
    const userId = String(
      webhookPayload.from
      || webhookPayload.sender
      || webhookPayload.wa_id
      || '',
    ).trim();
    const chatId = String(
      webhookPayload.chatId
      || webhookPayload.to
      || webhookPayload.from
      || 'whatsapp',
    ).trim();
    let rawText = String(
      webhookPayload.text
      || webhookPayload.body
      || (webhookPayload.text && typeof webhookPayload.text === 'object'
        ? (webhookPayload.text as Record<string, unknown>).body
        : '')
      || '',
    ).trim();

    // Nested Cloud API message object
    if (!rawText && webhookPayload.type === 'text' && webhookPayload.text && typeof webhookPayload.text === 'object') {
      rawText = String((webhookPayload.text as Record<string, unknown>).body || '').trim();
    }

    if (!rawText) return null;
    return {
      userId: userId || 'whatsapp-user',
      chatId: chatId || 'whatsapp',
      rawText,
      messageId: String(webhookPayload.id || webhookPayload.messageId || '').trim() || null,
      isGroup: chatId.includes('-') || chatId.endsWith('@g.us'),
      fields: {
        provider: config.whatsappProvider || 'stub',
      },
    };
  }

  private extractCloudApiMessages(body: Record<string, unknown>): Record<string, unknown>[] {
    const entry = Array.isArray(body.entry) ? body.entry : [];
    const messages: Record<string, unknown>[] = [];
    for (const item of entry) {
      if (!item || typeof item !== 'object') continue;
      const changes = Array.isArray((item as Record<string, unknown>).changes)
        ? (item as Record<string, unknown>).changes as unknown[]
        : [];
      for (const change of changes) {
        if (!change || typeof change !== 'object') continue;
        const value = (change as Record<string, unknown>).value;
        if (!value || typeof value !== 'object') continue;
        const list = Array.isArray((value as Record<string, unknown>).messages)
          ? (value as Record<string, unknown>).messages as unknown[]
          : [];
        const contacts = Array.isArray((value as Record<string, unknown>).contacts)
          ? (value as Record<string, unknown>).contacts as unknown[]
          : [];
        const waId = contacts[0] && typeof contacts[0] === 'object'
          ? String((contacts[0] as Record<string, unknown>).wa_id || '')
          : '';
        for (const message of list) {
          if (!message || typeof message !== 'object') continue;
          messages.push({
            ...(message as Record<string, unknown>),
            from: (message as Record<string, unknown>).from || waId,
            chatId: (message as Record<string, unknown>).from || waId,
          });
        }
      }
    }
    return messages;
  }
}
