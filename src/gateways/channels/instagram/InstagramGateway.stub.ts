import fs from 'fs';
import path from 'path';
import { IMessageBroker } from '../../../contracts/IMessageBroker.js';
import { type LiveChannelBroadcastGatewayContract, PlatformKey } from '../../../contracts/PlatformContract.js';
import { config } from '../../../config/index.js';
import { logger } from '../../../logger.js';

export interface InstagramGatewayStubMessage {
  userId: string;
  chatId: string;
  rawText: string;
}

type InstagramGatewayRuntime = {
  fetchImpl?: typeof fetch;
};

export type InstagramGatewayMode = 'stub' | 'meta-messaging';

export type InstagramRecipientPolicySnapshot = {
  state: 'allowlist' | 'empty';
  allowedCount: number;
  allowlistConfigured: boolean;
  summary: string;
};

export type InstagramGatewayStatusSnapshot = {
  mode: InstagramGatewayMode;
  enabled: boolean;
  started: boolean;
  running: boolean;
  linked: boolean;
  connected: boolean;
  recipientsConfigured: number;
  allowedRecipientIds: string[];
  provider: InstagramGatewayMode;
  providerConfigured: boolean;
  providerDecision: string;
  businessAccountId: string | null;
  webhookConfigured: boolean;
  webhookStatus: 'configured' | 'missing' | 'not_applicable';
  recipientPolicy: InstagramRecipientPolicySnapshot;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastStartAt: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

export interface InstagramApiResponse {
  recipient_id?: string;
  message_id?: string;
  ok?: boolean;
  error?: {
    message?: string;
    type?: string;
    code?: number;
  } | string;
}

export interface InstagramWebhookMessage {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    mid?: string;
    text?: string;
    [key: string]: unknown;
  };
  postback?: {
    title?: string;
    payload?: string;
    [key: string]: unknown;
  };
  timestamp?: number;
  [key: string]: unknown;
}

export interface InstagramWebhookEntry {
  id?: string;
  time?: number;
  messaging?: InstagramWebhookMessage[];
  [key: string]: unknown;
}

export interface InstagramWebhookBody {
  object?: string;
  entry?: InstagramWebhookEntry[];
  [key: string]: unknown;
}

export class InstagramGateway implements LiveChannelBroadcastGatewayContract {
  public readonly platform: PlatformKey = 'instagram';
  public readonly supportsRoleAwareBroadcast = false;

  private broker: IMessageBroker | null;
  private started = false;
  private lastStartAt: string | null = null;
  private lastConnectedAt: string | null = null;
  private lastInboundAt: string | null = null;
  private lastOutboundAt: string | null = null;
  private lastError: string | null = null;
  private readonly fetchImpl: typeof fetch | null;

  constructor(broker?: IMessageBroker, runtime: InstagramGatewayRuntime = {}) {
    this.broker = broker ?? null;
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public attachBroker(broker: IMessageBroker): void {
    this.broker = broker;
  }

  public async start(): Promise<void> {
    this.started = true;
    this.lastStartAt = new Date().toISOString();
    this.lastError = null;
    this.ensureRuntimePaths();
    if (this.resolveMode() === 'meta-messaging' && this.isProviderConfigured()) {
      this.lastConnectedAt = this.lastStartAt;
    }
    this.writeStatus();
  }

  public async stop(): Promise<void> {
    this.started = false;
    this.writeStatus();
  }

  public isStarted(): boolean {
    return this.started;
  }

  public readStatus(): InstagramGatewayStatusSnapshot | null {
    if (!fs.existsSync(config.instagramStatusFile)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(config.instagramStatusFile, 'utf8')) as InstagramGatewayStatusSnapshot;
    } catch (error) { logger.warn('[Instagram way.stub] JSON parse failed', error); return null; }
  }

  public getIdentityHints(): { linkedBy: string; verificationMethod: string } {
    return {
      linkedBy: 'instagram-gateway',
      verificationMethod: this.resolveMode() === 'meta-messaging'
        ? 'meta-instagram-messaging-api'
        : 'instagram-stub-outbox',
    };
  }

  public resolveBroadcastRecipients(): string[] {
    return config.instagramAllowedRecipientIds
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  public async simulateIncomingMessage(message: InstagramGatewayStubMessage): Promise<void> {
    await this.dispatchIncomingMessage({
      userId: String(message.userId || '').trim(),
      chatId: String(message.chatId || message.userId || '').trim(),
      rawText: String(message.rawText || ''),
      messageId: null,
    });
  }

  public handleWebhookVerification(url: URL): { statusCode: number; textBody: string } {
    if (this.resolveMode() !== 'meta-messaging') {
      return {
        statusCode: 503,
        textBody: 'Instagram Messaging API indisponivel neste runtime.',
      };
    }

    const verifyToken = String(config.instagramWebhookVerifyToken || '').trim();
    if (!verifyToken) {
      this.lastError = 'Instagram Messaging API exige INSTAGRAM_WEBHOOK_VERIFY_TOKEN configurado.';
      this.writeStatus();
      return {
        statusCode: 503,
        textBody: 'Instagram webhook verify token ausente.',
      };
    }

    const mode = String(url.searchParams.get('hub.mode') || '').trim();
    const token = String(url.searchParams.get('hub.verify_token') || '').trim();
    const challenge = String(url.searchParams.get('hub.challenge') || '').trim();
    if (mode !== 'subscribe' || token !== verifyToken) {
      this.lastError = 'Instagram Messaging API rejeitou a verificacao do webhook.';
      this.writeStatus();
      return {
        statusCode: 403,
        textBody: 'forbidden',
      };
    }

    this.lastError = null;
    this.writeStatus();
    return {
      statusCode: 200,
      textBody: challenge,
    };
  }

  public async handleWebhookEvent(input: {
    body: Record<string, unknown>;
  }): Promise<{
    statusCode: number;
    body: unknown;
  }> {
    if (this.resolveMode() !== 'meta-messaging') {
      return {
        statusCode: 503,
        body: { ok: false, error: 'Instagram Messaging API indisponivel neste runtime.' },
      };
    }

    const messages = this.extractInstagramMessages(input.body);
    let accepted = 0;

    for (const message of messages) {
      const rawText = this.extractTextFromInstagramMessage(message);
      const senderId = this.extractSenderId(message);
      if (!rawText || !senderId) {
        continue;
      }

      accepted += 1;
      await this.dispatchIncomingMessage({
        userId: senderId,
        chatId: senderId,
        rawText,
        messageId: this.extractMessageId(message),
      });
    }

    return {
      statusCode: 200,
      body: {
        ok: true,
        accepted: accepted > 0,
        received: messages.length,
        processed: accepted,
      },
    };
  }

  public async broadcast(message: string): Promise<void> {
    if (!this.started) {
      this.lastError = `Instagram ${this.resolveModeLabel()} has not started yet.`;
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const recipients = this.resolveBroadcastRecipients();
    if (recipients.length === 0) {
      this.lastError = 'Instagram has no configured allowed recipients.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const normalizedMessage = String(message || '');
    if (this.resolveMode() === 'meta-messaging') {
      await this.broadcastViaMetaMessaging(normalizedMessage, recipients);
      return;
    }

    this.writeStubEnvelope(normalizedMessage, recipients);
  }

  private ensureRuntimePaths(): void {
    fs.mkdirSync(config.instagramOutboxDir, { recursive: true });
    fs.mkdirSync(path.dirname(config.instagramStatusFile), { recursive: true });
  }

  private resolveMode(): InstagramGatewayMode {
    return config.instagramProvider === 'meta-messaging' ? 'meta-messaging' : 'stub';
  }

  private resolveModeLabel(): string {
    return this.resolveMode() === 'meta-messaging' ? 'Meta Messaging API' : 'local stub';
  }

  private isProviderConfigured(): boolean {
    return Boolean(
      String(config.instagramBusinessAccountId || '').trim()
      && String(config.instagramAccessToken || '').trim()
      && String(config.instagramWebhookVerifyToken || '').trim(),
    );
  }

  private async dispatchIncomingMessage(input: {
    userId: string;
    chatId: string;
    rawText: string;
    messageId: string | null;
  }): Promise<void> {
    if (!this.broker) {
      throw new Error('InstagramGateway has no broker attached.');
    }

    this.lastInboundAt = new Date().toISOString();
    this.lastError = null;
    this.writeStatus();
    await this.broker.processMessage({
      platform: 'instagram',
      userId: input.userId,
      chatId: input.chatId,
      channelId: input.chatId,
      messageId: input.messageId,
      isGroup: false,
      rawText: input.rawText,
      reply: async (text: string) => {
        await this.replyToRecipient(input.chatId, text);
      },
      editMessage: async () => undefined,
    });
  }

  private async broadcastViaMetaMessaging(message: string, recipients: string[]): Promise<void> {
    const failures: string[] = [];
    for (const recipient of recipients) {
      const payload = await this.sendMetaTextMessage(recipient, message);
      const responseError = this.describeMetaMessagingError(payload);
      if (payload?.recipient_id || payload?.message_id || payload?.ok === true) {
        continue;
      }
      failures.push(`${recipient}: ${responseError || 'unknown_error'}`);
    }

    if (failures.length > 0) {
      this.lastError = `Instagram Messaging API failed for ${failures.length} recipient(s): ${failures.join(' | ')}`;
      this.writeStatus();
      throw new Error(this.lastError);
    }

    this.lastOutboundAt = new Date().toISOString();
    this.lastError = null;
    this.writeStatus();
  }

  private async replyToRecipient(recipientId: string, text: string): Promise<void> {
    if (this.resolveMode() === 'meta-messaging') {
      const payload = await this.sendMetaTextMessage(recipientId, text);
      const responseError = this.describeMetaMessagingError(payload);
      if (!payload?.recipient_id && !payload?.message_id && payload?.ok !== true) {
        this.lastError = `Instagram Messaging API could not reply to ${recipientId}: ${responseError || 'unknown_error'}`;
        this.writeStatus();
        throw new Error(this.lastError);
      }
      this.lastOutboundAt = new Date().toISOString();
      this.lastError = null;
      this.writeStatus();
      return;
    }

    this.writeStubEnvelope(text, [recipientId], {
      recipientId,
      kind: 'reply',
    });
  }

  private async sendMetaTextMessage(recipientId: string, text: string): Promise<InstagramApiResponse> {
    const businessAccountId = String(config.instagramBusinessAccountId || '').trim();
    const accessToken = String(config.instagramAccessToken || '').trim();
    const apiVersion = String(config.instagramGraphApiVersion || 'v20.0').trim() || 'v20.0';
    if (!businessAccountId || !accessToken) {
      this.lastError = 'Instagram Messaging API requires INSTAGRAM_BUSINESS_ACCOUNT_ID and INSTAGRAM_ACCESS_TOKEN.';
      this.writeStatus();
      throw new Error(this.lastError);
    }
    if (!this.fetchImpl) {
      this.lastError = 'Instagram Messaging API requires fetch to be available in the runtime.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const response = await this.fetchImpl(
      `https://graph.facebook.com/${apiVersion}/${businessAccountId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: {
            id: recipientId,
          },
          message: {
            text,
          },
        }),
      },
    );

    let responsePayload: InstagramApiResponse | null = null;
    try {
      responsePayload = await response.json() as InstagramApiResponse;
    } catch (error) {
    logger.warn('[Instagram way.stub] load operation failed', error);
    responsePayload = null;
  }

    if (!response.ok && !responsePayload) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return responsePayload || { ok: response.ok };
  }

  private describeMetaMessagingError(payload: InstagramApiResponse | null): string | null {
    const error = payload?.error;
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error.message === 'string') {
      return error.message;
    }
    return null;
  }

  private extractInstagramMessages(body: InstagramWebhookBody): InstagramWebhookMessage[] {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    const messages: InstagramWebhookMessage[] = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
      messages.push(...messaging);
    }

    return messages;
  }

  private extractSenderId(message: InstagramWebhookMessage): string | null {
    const sender = message.sender && typeof message.sender === 'object'
      ? String(message.sender.id || '').trim()
      : '';
    return sender || null;
  }

  private extractMessageId(message: InstagramWebhookMessage): string | null {
    const messageNode = message.message && typeof message.message === 'object'
      ? message.message
      : null;
    return String(messageNode?.mid || message.mid || '').trim() || null;
  }

  private extractTextFromInstagramMessage(message: InstagramWebhookMessage): string | null {
    const messageNode = message.message && typeof message.message === 'object'
      ? message.message
      : null;
    const text = String(messageNode?.text || '').trim();
    if (text) {
      return text;
    }
    const postback = message.postback && typeof message.postback === 'object'
      ? message.postback
      : null;
    return String(postback?.title || postback?.payload || '').trim() || null;
  }

  private writeStubEnvelope(
    message: string,
    recipients: string[],
    extra: {
      recipientId?: string | null;
      kind?: 'broadcast' | 'reply';
    } = {},
  ): void {
    this.ensureRuntimePaths();
    const createdAt = new Date().toISOString();
    const envelope = {
      id: `instagram-${Date.now()}`,
      createdAt,
      platform: 'instagram',
      transport: 'stub',
      businessAccountId: String(config.instagramBusinessAccountId || '').trim() || null,
      recipients,
      recipientId: String(extra.recipientId || '').trim() || null,
      message,
      kind: extra.kind || 'broadcast',
    };
    const envelopeFile = path.join(
      config.instagramOutboxDir,
      `${createdAt.replace(/[:.]/g, '-')}-${envelope.id}.json`,
    );
    fs.writeFileSync(envelopeFile, JSON.stringify(envelope, null, 2), 'utf8');
    this.lastOutboundAt = createdAt;
    this.lastError = null;
    this.writeStatus();
  }

  private buildRecipientPolicy(recipients: string[]): InstagramRecipientPolicySnapshot {
    const count = recipients.length;
    return {
      state: count > 0 ? 'allowlist' : 'empty',
      allowedCount: count,
      allowlistConfigured: count > 0,
      summary: count > 0
        ? `${count} recipient(s) allowed by INSTAGRAM_ALLOWED_RECIPIENT_IDS.`
        : 'No allowed recipients; real outbound remains blocked until an allowlist is configured.',
    };
  }

  private writeStatus(): void {
    this.ensureRuntimePaths();
    const mode = this.resolveMode();
    const recipients = this.resolveBroadcastRecipients();
    const providerConfigured = this.isProviderConfigured();
    const enabled = Boolean(
      config.instagramEnabled
      || mode !== 'stub'
      || config.instagramBusinessAccountId
      || config.instagramAccessToken
      || config.instagramWebhookVerifyToken
      || recipients.length > 0
    );
    const webhookConfigured = Boolean(String(config.instagramWebhookVerifyToken || '').trim());
    const connected = this.started && mode === 'meta-messaging' && providerConfigured && !this.lastError;
    const linked = mode === 'meta-messaging' ? providerConfigured : recipients.length > 0;
    const updatedAt = new Date().toISOString();

    fs.writeFileSync(
      config.instagramStatusFile,
      JSON.stringify(
        {
          mode,
          enabled,
          started: this.started,
          running: this.started,
          linked,
          connected,
          recipientsConfigured: recipients.length,
          allowedRecipientIds: recipients,
          provider: mode,
          providerConfigured,
          providerDecision: mode === 'meta-messaging'
            ? providerConfigured
              ? 'Instagram Messaging API configurada para webhook inbound e outbound real via Meta Graph.'
              : 'Instagram Messaging API escolhida, mas faltam business account id, access token ou webhook verify token.'
            : 'Instagram segue em stub/outbox local ate receber credenciais oficiais da Meta.',
          businessAccountId: String(config.instagramBusinessAccountId || '').trim() || null,
          webhookConfigured,
          webhookStatus: mode === 'meta-messaging'
            ? webhookConfigured
              ? 'configured'
              : 'missing'
            : 'not_applicable',
          recipientPolicy: this.buildRecipientPolicy(recipients),
          lastInboundAt: this.lastInboundAt,
          lastOutboundAt: this.lastOutboundAt,
          lastStartAt: this.lastStartAt,
          lastConnectedAt: this.lastConnectedAt,
          lastError: this.lastError,
          updatedAt,
        },
        null,
        2,
      ),
      'utf8',
    );
  }
}
