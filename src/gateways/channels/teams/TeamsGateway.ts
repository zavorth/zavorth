import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class TeamsGateway extends WebhookGateway {
  public readonly id = 'teams';
  public readonly name = 'Microsoft Teams';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions | any) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.teamsOutboxDir,
      statusFile: options.statusFile || config.teamsStatusFile,
    } : options);
  }

  public async handleWebhookEvent(input: {
    headers: any;
    rawBody: string;
    body: Record<string, unknown>;
  }): Promise<{ statusCode: number; body: unknown }> {
    // Bot Framework activity types
    if (input.body?.type === 'conversationUpdate') {
      return { statusCode: 200, body: { ok: true, ignored: 'conversationUpdate' } };
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
      webhookPath: '/api/webhooks/teams',
      doctorCommand: '/channels doctor teams',
      operatorNextStep: this.resolveConfigured()
        ? 'Teams live path ready (incoming webhook / connector).'
        : 'Defina TEAMS_WEBHOOK_URL (e opcionalmente TEAMS_APP_ID / TEAMS_CLIENT_SECRET para bot).',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.teamsWebhookUrl || '').trim()
      || (String(config.teamsAppId || '').trim() && String(config.teamsClientSecret || config.teamsAppPassword || '').trim()),
    );
  }

  public resolveEnabled(): boolean {
    return this.resolveConfigured() || Boolean(config.teamsEnabled);
  }

  protected resolveOutboxDir(): string {
    return config.teamsOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.teamsStatusFile;
  }

  public override doctorSnapshot() {
    const base = super.doctorSnapshot();
    return {
      ...base,
      installHint: this.resolveConfigured()
        ? 'Teams configured. Incoming webhook path densified for Adaptive Card text.'
        : 'Set TEAMS_WEBHOOK_URL for connector outbound.',
      allowlist: {
        ...base.allowlist,
        conversationAllowlistConfigured: Array.isArray(config.teamsAllowedConversationIds)
          && config.teamsAllowedConversationIds.length > 0,
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
    const from = webhookPayload.from && typeof webhookPayload.from === 'object'
      ? webhookPayload.from as Record<string, unknown>
      : null;
    const conversation = webhookPayload.conversation && typeof webhookPayload.conversation === 'object'
      ? webhookPayload.conversation as Record<string, unknown>
      : null;
    const userId = String(
      from?.id
      || from?.aadObjectId
      || webhookPayload.userId
      || '',
    ).trim();
    const chatId = String(
      conversation?.id
      || webhookPayload.conversationId
      || webhookPayload.chatId
      || 'teams',
    ).trim();
    const rawText = String(
      webhookPayload.text
      || webhookPayload.summary
      || '',
    ).trim();
    if (!rawText) return null;
    return {
      userId: userId || 'teams-user',
      chatId: chatId || 'teams',
      rawText,
      messageId: String(webhookPayload.id || webhookPayload.messageId || '').trim() || null,
      isGroup: String(conversation?.conversationType || '').toLowerCase() !== 'personal',
      fields: {
        serviceUrl: String(webhookPayload.serviceUrl || '').trim() || null,
        tenantId: String(config.teamsTenantId || '').trim() || null,
      },
    };
  }
}
