import fs from 'fs';
import path from 'path';
import type * as http from 'http';
import { IMessageBroker } from '../../../contracts/IMessageBroker.js';
import { type LiveChannelBroadcastGatewayContract, PlatformKey } from '../../../contracts/PlatformContract.js';
import { config } from '../../../config/index.js';
import { TeamsGraphBotClient } from '../../../adapters/channels/TeamsGraphBotClient.js';
import { logger } from '../../../logger.js';

export interface TeamsGatewayStubMessage {
  userId: string;
  chatId: string;
  rawText: string;
  messageId?: string | null;
  replyToId?: string | null;
}

export type TeamsGatewayStatusSnapshot = {
  mode: 'graph-bot';
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  allowedConversationIds: string[];
  providerConfigured: boolean;
  transport: 'webhook' | 'local';
  webhookConfigured: boolean;
  tenantId: string | null;
  appId: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

type TeamsWebhookResult = {
  statusCode: number;
  body: unknown;
};

type TeamsGatewayRuntime = {
  graphClient?: TeamsGraphBotClient;
};

export class TeamsGateway implements LiveChannelBroadcastGatewayContract {
  public readonly platform: PlatformKey = 'teams';
  public readonly supportsRoleAwareBroadcast = false;

  private broker: IMessageBroker | null;
  private started = false;
  private lastInboundAt: string | null = null;
  private lastOutboundAt: string | null = null;
  private lastError: string | null = null;
  private readonly graphClient: TeamsGraphBotClient;

  constructor(broker?: IMessageBroker, runtime: TeamsGatewayRuntime = {}) {
    this.broker = broker ?? null;
    this.graphClient = runtime.graphClient || new TeamsGraphBotClient();
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

  public readStatus(): TeamsGatewayStatusSnapshot | null {
    if (!fs.existsSync(config.teamsStatusFile)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(config.teamsStatusFile, 'utf8')) as TeamsGatewayStatusSnapshot;
    } catch (error: any) { const err = error; const e = error; logger.warn('[Teams way.stub] JSON parse failed', error); return null; }
  }

  public getIdentityHints(): { linkedBy: string; verificationMethod: string } {
    return {
      linkedBy: 'teams-gateway',
      verificationMethod: this.graphClient.isConfigured() ? 'microsoft-graph' : 'teams-fallback-outbox',
    };
  }

  public resolveBroadcastRecipients(): string[] {
    return [...config.teamsAllowedConversationIds];
  }

  public async simulateIncomingMessage(message: TeamsGatewayStubMessage): Promise<void> {
    await this.dispatchIncomingMessage({
      userId: String(message.userId || ''),
      chatId: String(message.chatId || ''),
      rawText: String(message.rawText || ''),
      messageId: String(message.messageId || '').trim() || null,
      replyToId: String(message.replyToId || '').trim() || null,
    });
  }

  public async handleWebhookEvent(input: {
    headers: http.IncomingHttpHeaders;
    rawBody: string;
    body: Record<string, unknown>;
  }): Promise<TeamsWebhookResult> {
    if (!this.verifySecret(input.headers)) {
      this.lastError = 'Teams webhook rejeitado por secret invalido.';
      this.writeStatus();
      return {
        statusCode: 401,
        body: { ok: false, error: 'Teams webhook secret invalid.' },
      };
    }

    const activityType = String(input.body.type || '').trim().toLowerCase();
    if (activityType !== 'message') {
      return {
        statusCode: 200,
        body: { ok: true, ignored: true },
      };
    }

    await this.dispatchIncomingMessage({
      userId: String((input.body.from as any)?.id || (input.body.from as any)?.aadObjectId || '').trim(),
      chatId: String((input.body.conversation as any)?.id || '').trim(),
      rawText: String(input.body.text || '').trim(),
      messageId: String(input.body.id || '').trim() || null,
      replyToId: String(input.body.replyToId || '').trim() || null,
    });

    return {
      statusCode: 200,
      body: { ok: true, accepted: true },
    };
  }

  public async broadcast(message: string): Promise<void> {
    if (!this.started) {
      this.lastError = 'Teams gateway has not started yet.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const recipients = this.resolveBroadcastRecipients();
    if (recipients.length === 0) {
      this.lastError = 'Teams has no configured allowed conversation ids.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    await this.sendOrFallback({
      recipients,
      message,
      kind: 'broadcast',
    });
  }

  private async dispatchIncomingMessage(input: {
    userId: string;
    chatId: string;
    rawText: string;
    messageId: string | null;
    replyToId: string | null;
  }): Promise<void> {
    if (!this.broker) {
      throw new Error('TeamsGateway has no broker attached.');
    }

    this.lastInboundAt = new Date().toISOString();
    this.lastError = null;
    this.writeStatus();
    await this.broker.processMessage({
      platform: 'teams',
      userId: input.userId,
      chatId: input.chatId,
      channelId: input.chatId,
      threadId: input.replyToId || input.messageId,
      messageId: input.messageId,
      isGroup: true,
      rawText: input.rawText,
      reply: async (text: string) => {
        await this.sendOrFallback({
          recipient: input.chatId,
          message: text,
          kind: 'reply',
          replyToId: input.messageId,
        });
      },
      editMessage: async (messageId: string, text: string) => {
        await this.editOrFallback(input.chatId, messageId, text);
      },
    });
  }

  private verifySecret(headers: http.IncomingHttpHeaders): boolean {
    const expected = String(config.teamsWebhookSecret || '').trim();
    if (!expected) {
      return true;
    }
    const provided = String(headers['x-zavorth-teams-secret'] || headers['x-teams-secret'] || '').trim();
    return Boolean(provided && provided === expected);
  }

  private ensureRuntimePaths(): void {
    fs.mkdirSync(config.teamsOutboxDir, { recursive: true });
    fs.mkdirSync(path.dirname(config.teamsStatusFile), { recursive: true });
  }

  private writeEnvelope(input: {
    recipient?: string | null;
    recipients?: string[];
    message: string;
    kind: 'broadcast' | 'reply';
    replyToId?: string | null;
  }): void {
    this.ensureRuntimePaths();
    const createdAt = new Date().toISOString();
    const envelope = {
      id: `teams-${Date.now()}`,
      createdAt,
      platform: 'teams',
      transport: config.teamsAppId ? 'graph-bot-configured' : 'local-outbox',
      tenantId: String(config.teamsTenantId || '').trim() || null,
      appId: String(config.teamsAppId || '').trim() || null,
      recipient: String(input.recipient || '').trim() || null,
      recipients: Array.isArray(input.recipients) ? input.recipients : [],
      message: input.message,
      kind: input.kind,
      replyToId: String(input.replyToId || '').trim() || null,
    };
    const targetFile = path.join(
      config.teamsOutboxDir,
      `${createdAt.replace(/[:.]/g, '-')}-${String(envelope.id)}.json`,
    );
    fs.writeFileSync(targetFile, JSON.stringify(envelope, null, 2), 'utf8');
    this.lastOutboundAt = createdAt;
    this.lastError = null;
    this.writeStatus();
  }

  private async sendOrFallback(input: {
    recipient?: string | null;
    recipients?: string[];
    message: string;
    kind: 'broadcast' | 'reply';
    replyToId?: string | null;
  }): Promise<void> {
    const recipients = Array.isArray(input.recipients)
      ? input.recipients
      : [String(input.recipient || '').trim()].filter(Boolean);
    if (this.graphClient.isConfigured()) {
      try {
        for (const conversationId of recipients) {
          if (input.kind === 'reply') {
            await this.graphClient.replyText({
              conversationId,
              message: input.message,
              replyToMessageId: input.replyToId,
            });
          } else {
            await this.graphClient.sendText({
              conversationId,
              message: input.message,
            });
          }
        }
        this.lastOutboundAt = new Date().toISOString();
        this.lastError = null;
        this.writeStatus();
        return;
      } catch (error: any) { const err = error; const e = error;
        this.lastError = `Teams Graph live send failed: ${error?.message || error}`;
        this.writeStatus();
        throw error;
      }
    }

    this.writeEnvelope(input);
  }

  private async editOrFallback(conversationId: string, messageId: string, text: string): Promise<void> {
    if (!messageId) {
      return;
    }
    if (this.graphClient.isConfigured()) {
      try {
        await this.graphClient.editText({
          conversationId,
          messageId,
          message: text,
        });
        this.lastOutboundAt = new Date().toISOString();
        this.lastError = null;
        this.writeStatus();
        return;
      } catch (error: any) { const err = error; const e = error;
        this.lastError = `Teams Graph live edit failed: ${error?.message || error}`;
        this.writeStatus();
        throw error;
      }
    }

    this.writeEnvelope({
      recipient: conversationId,
      message: text,
      kind: 'reply',
      replyToId: messageId,
    });
  }

  private writeStatus(): void {
    this.ensureRuntimePaths();
    const updatedAt = new Date().toISOString();
    fs.writeFileSync(
      config.teamsStatusFile,
      JSON.stringify(
        {
          mode: 'graph-bot',
          enabled: Boolean(config.teamsEnabled || config.teamsAppId),
          started: this.started,
          recipientsConfigured: config.teamsAllowedConversationIds.length,
          allowedConversationIds: [...config.teamsAllowedConversationIds],
          providerConfigured: this.graphClient.isConfigured(),
          transport: this.graphClient.isConfigured() ? 'webhook' : 'local',
          webhookConfigured: this.started,
          tenantId: String(config.teamsTenantId || '').trim() || null,
          appId: String(config.teamsAppId || '').trim() || null,
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
