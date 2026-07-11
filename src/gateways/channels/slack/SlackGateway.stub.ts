import fs from 'fs';
import crypto from 'crypto';
import type * as http from 'http';
import path from 'path';
import { IMessageBroker } from '../../../contracts/IMessageBroker.js';
import { truncateSlackText } from '../../../utils/text.js';import { type LiveChannelBroadcastGatewayContract, PlatformKey } from '../../../contracts/PlatformContract.js';
import { config } from '../../../config/index.js';
import { logger } from '../../../logger.js';

export interface SlackGatewayStubMessage {
  userId: string;
  channelId: string;
  rawText: string;
  threadTs?: string | null;
  isGroup?: boolean;
}

type SlackGatewayRuntime = {
  fetchImpl?: typeof fetch;
};

type SlackWebhookResult = {
  statusCode: number;
  body: unknown;
};

export type SlackGatewayStatusSnapshot = {
  mode: 'stub' | 'native';
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  allowedChannelIds: string[];
  workspaceId: string | null;
  workspaceConfigured: boolean;
  transport: 'native' | 'local';
  nativeConfigured: boolean;
  apiBaseUrl: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

export class SlackGateway implements LiveChannelBroadcastGatewayContract {
  public readonly platform: PlatformKey = 'slack';
  public readonly supportsRoleAwareBroadcast = false;

  private broker: IMessageBroker | null;
  private started = false;
  private lastInboundAt: string | null = null;
  private lastOutboundAt: string | null = null;
  private lastError: string | null = null;
  private readonly fetchImpl: typeof fetch | null;

  constructor(broker?: IMessageBroker, runtime: SlackGatewayRuntime = {}) {
    this.broker = broker ?? null;
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public attachBroker(broker: IMessageBroker): void {
    this.broker = broker;
  }

  public async start(): Promise<void> {
    this.started = true;
    this.lastError = null;
    this.ensureRuntimePaths();
    this.writeStatus();
  }

  public async stop(): Promise<void> {
    this.started = false;
    this.writeStatus();
  }

  public isStarted(): boolean {
    return this.started;
  }

  public readStatus(): SlackGatewayStatusSnapshot | null {
    if (!fs.existsSync(config.slackStatusFile)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(config.slackStatusFile, 'utf8')) as SlackGatewayStatusSnapshot;
    } catch (error: unknown) {logger.warn('[Slack way.stub] JSON parse failed', error); return null; }
  }

  public async simulateIncomingMessage(message: SlackGatewayStubMessage): Promise<void> {
    await this.dispatchIncomingMessage({
      userId: String(message.userId || ''),
      channelId: String(message.channelId || ''),
      rawText: String(message.rawText || ''),
      threadTs: String(message.threadTs || '').trim() || null,
      isGroup: Boolean(message.isGroup ?? true),
      messageId: null,
    });
  }

  public async handleWebhookEvent(input: {
    headers: http.IncomingHttpHeaders;
    rawBody: string;
    body: Record<string, unknown>;
  }): Promise<SlackWebhookResult> {
    if (!this.verifySlackSignature(input.headers, input.rawBody)) {
      this.lastError = 'Slack webhook rejeitado por assinatura invalida.';
      this.writeStatus();
      return {
        statusCode: 401,
        body: { ok: false, error: 'Slack signature invalid.' },
      };
    }

    const webhookType = String(input.body.type || '').trim().toLowerCase();
    if (webhookType === 'url_verification') {
      return {
        statusCode: 200,
        body: { challenge: String(input.body.challenge || '') },
      };
    }

    if (webhookType !== 'event_callback') {
      return {
        statusCode: 200,
        body: { ok: true, ignored: true },
      };
    }

    const event = input.body.event && typeof input.body.event === 'object'
      ? input.body.event as Record<string, unknown>
      : null;
    if (!event) {
      return {
        statusCode: 200,
        body: { ok: true, ignored: true },
      };
    }

    const eventType = String(event.type || '').trim().toLowerCase();
    const subtype = String(event.subtype || '').trim().toLowerCase();
    if ((eventType !== 'message' && eventType !== 'app_mention') || subtype === 'message_changed' || event.bot_id) {
      return {
        statusCode: 200,
        body: { ok: true, ignored: true },
      };
    }

    await this.dispatchIncomingMessage({
      userId: String(event.user || '').trim(),
      channelId: String(event.channel || '').trim(),
      rawText: String(event.text || '').trim(),
      threadTs: String(event.thread_ts || event.ts || '').trim() || null,
      isGroup: true,
      messageId: String(event.ts || '').trim() || null,
    });

    return {
      statusCode: 200,
      body: { ok: true, accepted: true },
    };
  }

  private async dispatchIncomingMessage(input: {
    userId: string;
    channelId: string;
    rawText: string;
    threadTs: string | null;
    isGroup: boolean;
    messageId: string | null;
  }): Promise<void> {
    if (!this.broker) {
      throw new Error('SlackGateway has no broker attached.');
    }

    this.lastInboundAt = new Date().toISOString();
    this.lastError = null;
    this.writeStatus();
    await this.broker.processMessage({
      platform: 'slack',
      userId: input.userId,
      chatId: input.channelId,
      channelId: input.channelId,
      threadId: input.threadTs,
      messageId: input.messageId,
      isGroup: input.isGroup,
      rawText: input.rawText,
      reply: async (text: string) => {
        await this.replyToChannel(input.channelId, text, input.threadTs || input.messageId);
      },
      editMessage: async (messageId: string, text: string) => {
        await this.editSlackMessage(input.channelId, messageId, text);
      },
    });
  }

  public resolveBroadcastRecipients(): string[] {
    return config.slackAllowedChannelIds
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  public async broadcast(message: string): Promise<void> {
    if (!this.started) {
      this.lastError = `Slack ${this.resolveModeLabel()} has not started yet.`;
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const recipients = this.resolveBroadcastRecipients();
    if (recipients.length === 0) {
      this.lastError = `Slack ${this.resolveModeLabel()} has no configured allowed channels.`;
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const normalizedMessage = String(message || '');
    const mode = this.resolveMode();
    if (mode === 'native') {
      await this.broadcastViaSlackApi(normalizedMessage, recipients);
      return;
    }

    this.writeStubEnvelope(normalizedMessage, recipients);
  }

  public getIdentityHints(): { linkedBy: string; verificationMethod: string } {
    if (this.resolveMode() === 'native') {
      return {
        linkedBy: 'slack-gateway',
        verificationMethod: 'slack-web-api',
      };
    }

    return {
      linkedBy: 'slack-gateway',
      verificationMethod: 'slack-stub-outbox',
    };
  }

  public doctorSnapshot(): {
    channelId: 'slack';
    mode: 'stub' | 'native';
    enabled: boolean;
    configured: boolean;
    allowlistConfigured: boolean;
    outboxDir: string;
    statusFile: string;
    summary: string;
  } {
    const recipients = this.resolveBroadcastRecipients();
    const mode = this.resolveMode();
    const tokenConfigured = Boolean(String(config.slackBotToken || '').trim());
    const allowlistConfigured = recipients.length > 0;
    const enabled = tokenConfigured || allowlistConfigured || this.started || Boolean(config.slackEnabled);
    return {
      channelId: 'slack',
      mode,
      enabled,
      configured: allowlistConfigured || tokenConfigured,
      allowlistConfigured,
      outboxDir: config.slackOutboxDir,
      statusFile: config.slackStatusFile,
      summary: allowlistConfigured
        ? `Slack spine ${mode} ready for mock inbound/outbound with allowlist.`
        : 'Slack spine needs SLACK_ALLOWED_CHANNEL_IDS (and token for native mode).',
    };
  }

  private ensureRuntimePaths(): void {
    fs.mkdirSync(config.slackOutboxDir, { recursive: true });
    fs.mkdirSync(path.dirname(config.slackStatusFile), { recursive: true });
  }

  private resolveMode(): 'native' | 'stub' {
    if (config.slackTransport === 'native') {
      return 'native';
    }
    if (config.slackTransport === 'stub') {
      return 'stub';
    }
    return String(config.slackBotToken || '').trim() ? 'native' : 'stub';
  }

  private resolveModeLabel(): string {
    return this.resolveMode() === 'native' ? 'native' : 'stub';
  }

  private verifySlackSignature(
    headers: http.IncomingHttpHeaders,
    rawBody: string,
  ): boolean {
    const signingSecret = String(config.slackSigningSecret || '').trim();
    if (!signingSecret) {
      return true;
    }

    const timestamp = String(headers['x-slack-request-timestamp'] || '').trim();
    const signature = String(headers['x-slack-signature'] || '').trim();
    if (!timestamp || !signature) {
      return false;
    }

    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds)) {
      return false;
    }

    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
    if (ageSeconds > 300) {
      return false;
    }

    const base = `v0:${timestamp}:${rawBody}`;
    const expectedSignature = `v0=${crypto.createHmac('sha256', signingSecret).update(base).digest('hex')}`;
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  }

  private async broadcastViaSlackApi(message: string, recipients: string[]): Promise<void> {
    const token = String(config.slackBotToken || '').trim();
    if (!token) {
      this.lastError = 'Native Slack requires SLACK_BOT_TOKEN to be configured.';
      this.writeStatus();
      throw new Error(this.lastError);
    }
    if (!this.fetchImpl) {
      this.lastError = 'Native Slack requires fetch to be available in the runtime.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const failures: string[] = [];

    for (const channel of recipients) {
      const payload = await this.callSlackApi('chat.postMessage', {
        channel,
        text: truncateSlackText(message, 8000),
      });

      if (payload?.ok !== true) {
        const responseError =
          typeof payload?.error === 'string'
            ? payload.error
            : 'unknown_error';
        failures.push(`${channel}: ${responseError}`);
      }
    }

    if (failures.length > 0) {
      this.lastError = `Native Slack failed in ${failures.length} channel(s): ${failures.join(' | ')}`;
      this.writeStatus();
      throw new Error(this.lastError);
    }

    this.lastOutboundAt = new Date().toISOString();
    this.lastError = null;
    this.writeStatus();
  }

  private async replyToChannel(channelId: string, text: string, threadTs: string | null): Promise<void> {
    if (this.resolveMode() === 'native') {
      const payload = await this.callSlackApi('chat.postMessage', {
        channel: channelId,
        text: truncateSlackText(text, 8000),
        ...(threadTs ? { thread_ts: threadTs } : {}),
      });
      if (payload?.ok !== true) {
        const responseError = typeof payload?.error === 'string' ? payload.error : 'unknown_error';
        this.lastError = `Native Slack could not reply in channel ${channelId}: ${responseError}`;
        this.writeStatus();
        throw new Error(this.lastError);
      }
      this.lastOutboundAt = new Date().toISOString();
      this.lastError = null;
      this.writeStatus();
      return;
    }

    this.writeStubEnvelope(text, [channelId], {
      channelId,
      threadTs,
      kind: 'reply',
    });
  }

  private async editSlackMessage(channelId: string, messageId: string, text: string): Promise<void> {
    if (!messageId) {
      return;
    }

    if (this.resolveMode() === 'native') {
      const payload = await this.callSlackApi('chat.update', {
        channel: channelId,
        ts: messageId,
        text: truncateSlackText(text, 8000),
      });
      if (payload?.ok !== true) {
        const responseError = typeof payload?.error === 'string' ? payload.error : 'unknown_error';
        this.lastError = `Native Slack could not edit message ${messageId}: ${responseError}`;
        this.writeStatus();
        throw new Error(this.lastError);
      }
      this.lastOutboundAt = new Date().toISOString();
      this.lastError = null;
      this.writeStatus();
      return;
    }

    this.writeStubEnvelope(text, [channelId], {
      channelId,
      threadTs: null,
      kind: 'edit',
      messageTs: messageId,
    });
  }

  private async callSlackApi(
    method: 'chat.postMessage' | 'chat.update',
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const token = String(config.slackBotToken || '').trim();
    if (!token) {
      this.lastError = 'Slack nativo exige SLACK_BOT_TOKEN configurado.';
      this.writeStatus();
      throw new Error(this.lastError);
    }
    if (!this.fetchImpl) {
      this.lastError = 'Slack nativo exige fetch disponivel no runtime.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const baseUrl = String(config.slackApiBaseUrl || '').trim().replace(/\/+$/, '');
    const response = await this.fetchImpl(`${baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    let responsePayload: Record<string, unknown> | null = null;
    try {
      responsePayload = (await response.json()) as Record<string, unknown>;
    } catch (error: unknown) {logger.warn('[Slack way.stub] network request failed', error);
    responsePayload = null;
  }

    if (!response.ok && !responsePayload) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return responsePayload || { ok: response.ok };
  }

  private persistStubEnvelope(envelope: Record<string, unknown>): void {
    const envelopeFile = path.join(
      config.slackOutboxDir,
      `${String(envelope.createdAt || '').replace(/[:.]/g, '-')}-${String(envelope.id || '')}.json`,
    );
    fs.writeFileSync(envelopeFile, JSON.stringify(envelope, null, 2), 'utf8');
    this.lastOutboundAt = String(envelope.createdAt || '').trim() || new Date().toISOString();
    this.lastError = null;
    this.writeStatus();
  }

  private writeStubEnvelope(message: string, recipients: string[]): void;
  private writeStubEnvelope(
    message: string,
    recipients: string[],
    extra: {
      channelId?: string | null;
      threadTs?: string | null;
      kind?: 'broadcast' | 'reply' | 'edit';
      messageTs?: string | null;
    },
  ): void;
  private writeStubEnvelope(
    message: string,
    recipients: string[],
    extra: {
      channelId?: string | null;
      threadTs?: string | null;
      kind?: 'broadcast' | 'reply' | 'edit';
      messageTs?: string | null;
    } = {},
  ): void {
    this.ensureRuntimePaths();
    this.persistStubEnvelope({
      id: `slack-${Date.now()}`,
      createdAt: new Date().toISOString(),
      transport: 'stub',
      workspaceId: String(config.slackWorkspaceId || '').trim() || null,
      recipients,
      message,
      kind: extra.kind || 'broadcast',
      channelId: String(extra.channelId || '').trim() || null,
      threadTs: String(extra.threadTs || '').trim() || null,
      messageTs: String(extra.messageTs || '').trim() || null,
    });
  }

  private writeStatus(): void {
    this.ensureRuntimePaths();
    const recipients = this.resolveBroadcastRecipients();
    const updatedAt = new Date().toISOString();
    const mode = this.resolveMode();
    fs.writeFileSync(
      config.slackStatusFile,
      JSON.stringify(
        {
          mode,
          enabled: Boolean(config.slackEnabled || config.slackBotToken || config.slackWorkspaceId),
          started: this.started,
          recipientsConfigured: recipients.length,
          allowedChannelIds: recipients,
          workspaceId: String(config.slackWorkspaceId || '').trim() || null,
          workspaceConfigured: Boolean(String(config.slackWorkspaceId || '').trim()),
          transport: mode === 'native' ? 'native' : 'local',
          nativeConfigured: Boolean(String(config.slackBotToken || '').trim()),
          apiBaseUrl: mode === 'native' ? String(config.slackApiBaseUrl || '').trim() || null : null,
          lastInboundAt: this.lastInboundAt,
          lastOutboundAt: this.lastOutboundAt,
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
