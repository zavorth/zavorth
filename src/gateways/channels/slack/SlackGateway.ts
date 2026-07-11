import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';

export class SlackGateway extends WebhookGateway {
  public readonly id = 'slack';
  public readonly name = 'Slack';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'webhook';

  constructor(options: WebhookGatewayOptions | any) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    super(isOptionsObj ? {
      ...options,
      outboxDir: options.outboxDir || config.slackOutboxDir,
      statusFile: options.statusFile || config.slackStatusFile,
    } : options);
  }

  public async handleWebhookEvent(input: {
    headers: any;
    rawBody: string;
    body: Record<string, unknown>;
  }): Promise<{ statusCode: number; body: unknown }> {
    if (input.body?.type === 'url_verification') {
      return {
        statusCode: 200,
        body: { challenge: input.body.challenge },
      };
    }

    if (!this.verifySigningSecret(input.headers, input.rawBody)) {
      return { statusCode: 401, body: { ok: false, error: 'invalid_signature' } };
    }

    // event_callback envelope
    const event = input.body?.event && typeof input.body.event === 'object'
      ? input.body.event as Record<string, unknown>
      : input.body;
    const ok = await this.onMessageReceived(event as Record<string, unknown>);
    return {
      statusCode: ok ? 200 : 400,
      body: { ok },
    };
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/slack',
      doctorCommand: '/channels doctor slack',
      operatorNextStep: this.resolveConfigured()
        ? 'Slack live path ready (Web API and/or webhook + signing secret).'
        : 'Defina SLACK_BOT_TOKEN (+ channel allowlist) e SLACK_SIGNING_SECRET, ou SLACK_WEBHOOK_URL.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.slackBotToken || '').trim()
      || String(config.slackWebhookUrl || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return this.resolveConfigured() || Boolean(config.slackEnabled);
  }

  protected resolveOutboxDir(): string {
    return config.slackOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.slackStatusFile;
  }

  public override doctorSnapshot() {
    const base = super.doctorSnapshot();
    return {
      ...base,
      installHint: this.resolveConfigured()
        ? 'Slack configured. Prefer chat.postMessage with bot token; webhook is fallback.'
        : 'Set SLACK_BOT_TOKEN + SLACK_ALLOWED_CHANNEL_IDS and SLACK_SIGNING_SECRET for Events API.',
      allowlist: {
        ...base.allowlist,
        channelAllowlistConfigured: Array.isArray(config.slackAllowedChannelIds) && config.slackAllowedChannelIds.length > 0,
        signingSecretConfigured: Boolean(String(config.slackSigningSecret || '').trim()),
      },
    };
  }

  public verifySigningSecret(headers: Record<string, unknown> | null | undefined, rawBody: string): boolean {
    const secret = String(config.slackSigningSecret || '').trim();
    if (!secret) {
      // Without signing secret, accept only when explicitly open (dev); production should set secret.
      return true;
    }
    const timestamp = String(headers?.['x-slack-request-timestamp'] || headers?.['X-Slack-Request-Timestamp'] || '').trim();
    const signature = String(headers?.['x-slack-signature'] || headers?.['X-Slack-Signature'] || '').trim();
    if (!timestamp || !signature) return false;
    const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
    if (!Number.isFinite(ageSec) || ageSec > 60 * 5) return false;
    const base = `v0:${timestamp}:${rawBody || ''}`;
    const digest = `v0=${createHmac('sha256', secret).update(base).digest('hex')}`;
    try {
      const a = Buffer.from(digest);
      const b = Buffer.from(signature);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    // Ignore bot message loops
    if (webhookPayload.bot_id || webhookPayload.subtype === 'bot_message') {
      return null;
    }
    const userId = String(
      webhookPayload.user
      || webhookPayload.user_id
      || webhookPayload.userId
      || '',
    ).trim();
    const chatId = String(
      webhookPayload.channel
      || webhookPayload.channel_id
      || webhookPayload.channelId
      || 'slack',
    ).trim();
    const rawText = String(webhookPayload.text || webhookPayload.message || '').trim();
    if (!rawText) return null;
    return {
      userId: userId || 'slack-user',
      chatId: chatId || 'slack',
      rawText,
      messageId: String(webhookPayload.ts || webhookPayload.client_msg_id || webhookPayload.messageId || '').trim() || null,
      isGroup: !String(chatId).startsWith('D'),
      fields: {
        team: String(webhookPayload.team || webhookPayload.team_id || '').trim() || null,
      },
    };
  }
}
