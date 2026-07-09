import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { GatewayChannelAdapter } from '../gateway/channels/GatewayChannelAdapter.js';
import { GatewayEventBus } from '../gateway/events/GatewayEventBus.js';
import {
  buildInboundChannelEvent,
  buildOutboundChannelEnvelope,
  persistChannelOutboxEnvelope,
} from '../channels/contracts/ChannelMessageContract.js';
import type { CanonicalChannelPlatform } from '../channels/contracts/ChannelMessageContract.js';
import { ChannelPolicyManager } from '../channels/policies/ChannelPolicyManager.js';
import { SecurityAuditLogger } from '../services/SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';
import type { ChannelAdapterStatus, ChannelFeatureSet } from '../contracts/ChannelMeshContract.js';
import type { PlatformReadiness, PlatformImplementationState, PlatformTransport, PlatformKey } from '../contracts/PlatformContract.js';
import type { IMessageContext } from '../contracts/core/IMessageBroker.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

export type WebhookGatewayMode = 'webhook' | 'bot-http' | 'local-bridge' | 'matrix' | 'line';

export type WebhookGatewayStatusSnapshot = {
  id: string;
  mode: WebhookGatewayMode;
  enabled: boolean;
  started: boolean;
  configured: boolean;
  transport: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

export type ChannelGatewayDeliveryResult = {
  ok: boolean;
  status: 'delivered' | 'queued' | 'failed';
  transport: string;
  httpStatus?: number;
  reason?: string;
};

export type WebhookGatewayOptions = {
  eventBus: GatewayEventBus;
  policyManager: ChannelPolicyManager;
  auditLogger?: SecurityAuditLogger;
  logRepo?: LogRepository;
  now?: () => Date;
  outboxDir?: string;
  statusFile?: string;
  fetchImpl?: typeof fetch;
};

interface WebhookBroker {
  processMessage(ctx: Pick<IMessageContext, 'platform' | 'userId' | 'chatId' | 'messageId' | 'isGroup' | 'rawText' | 'reply'>): Promise<void>;
}

interface OutboundPayload {
  text?: string;
  message?: string;
  recipients?: string[];
  chatId?: string;
  to?: string;
  [key: string]: unknown;
}

function isWebhookBroker(value: unknown): value is WebhookBroker {
  return typeof value === 'object' && value !== null && typeof (value as WebhookBroker).processMessage === 'function';
}

function isOutboundPayload(value: unknown): value is OutboundPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidPlatformTransport(mode: string): mode is PlatformTransport {
  return ['native', 'webhook', 'local', 'stub', 'bridge', 'virtual', 'planned'].includes(mode);
}

export abstract class WebhookGateway implements GatewayChannelAdapter {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly type: 'sync' | 'async' | 'duplex';
  public abstract readonly mode: WebhookGatewayMode;

  protected readonly eventBus: GatewayEventBus;
  protected readonly policyManager: ChannelPolicyManager;
  protected readonly auditLogger: SecurityAuditLogger;
  protected readonly now: () => Date;
  protected readonly outboxDir: string;
  protected readonly statusFile: string;
  protected readonly fetchImpl: typeof fetch | null;
  protected broker: WebhookBroker | null = null;

  private started = false;
  private lastInboundAt: string | null = null;
  private lastOutboundAt: string | null = null;
  private lastError: string | null = null;

  public get platform(): PlatformKey {
    return this.id as PlatformKey;
  }

  public get outboxDirectory(): string {
    return this.outboxDir;
  }

  constructor(options: WebhookGatewayOptions | Record<string, unknown>) {
    const isOptionsObj = options && typeof options === 'object' && 'eventBus' in options;
    const opts = isOptionsObj ? options as WebhookGatewayOptions : null;

    this.eventBus = opts?.eventBus || new GatewayEventBus();
    this.policyManager = opts?.policyManager || new ChannelPolicyManager();
    this.auditLogger = opts?.auditLogger || new SecurityAuditLogger(opts?.logRepo || new LogRepository());
    this.now = opts?.now || (() => new Date());
    this.outboxDir = path.resolve(opts?.outboxDir || this.resolveOutboxDir());
    this.statusFile = path.resolve(opts?.statusFile || this.resolveStatusFile());
    this.fetchImpl = opts?.fetchImpl || globalThis.fetch || null;

    if (!isOptionsObj && isWebhookBroker(options)) {
      this.broker = options;
    }
  }

  public async initialize(): Promise<void> {
    this.ensureRuntimePaths();
    this.started = true;
    this.lastError = null;
    this.writeStatus();
  }

  public async shutdown(): Promise<void> {
    this.started = false;
    this.writeStatus();
  }

  public isStarted(): boolean {
    return this.started;
  }

  public readStatus(): WebhookGatewayStatusSnapshot | null {
    if (!fs.existsSync(this.statusFile)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(this.statusFile, 'utf8')) as WebhookGatewayStatusSnapshot;
    } catch (error: unknown) {logger.warn('[Webhook way] JSON parse failed', error); return null; }
  }

  public abstract describe(): ChannelAdapterStatus;

  public abstract resolveConfigured(): boolean;

  public abstract resolveEnabled(): boolean;

  protected abstract resolveOutboxDir(): string;

  protected abstract resolveStatusFile(): string;

  protected abstract extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null;

  public async onMessageReceived(webhookPayload: Record<string, unknown>): Promise<boolean> {
    const extracted = this.extractInboundPayload(webhookPayload);
    if (!extracted) {
      return false;
    }

    const userId = String(extracted.userId || '').trim();
    const chatId = String(extracted.chatId || '').trim() || this.id;
    const rawText = String(extracted.rawText || '').trim();
    if (!rawText) {
      return false;
    }

    const isAllowed = await this.policyManager.verifyAccess(this.id, userId);
    if (!isAllowed) {
      this.auditLogger.logChannelAccessDecision({
        event: 'channel_message_blocked',
        decision: 'blocked',
        channel: this.id,
        chatId,
        isGroup: Boolean(extracted.isGroup),
        channelUserId: userId,
        channelUserIdAllowed: false,
        reason: 'unauthorized_user',
        triggerType: 'none',
      });
      return false;
    }

    this.lastInboundAt = this.now().toISOString();
    this.lastError = null;
    this.writeStatus();

    if (this.broker) {
      const { withMiddleware } = await import('./ZavorthGatewayMiddlewareIntegration.js');
      await withMiddleware(
        async () => {
          await this.broker!.processMessage({
            platform: this.id as CanonicalChannelPlatform,
            userId,
            chatId,
            messageId: extracted.messageId || null,
            isGroup: Boolean(extracted.isGroup),
            rawText,
            reply: async (text: string) => {
              await this.sendMessage({ chatId, text });
            },
          });
        },
        {
          text: rawText,
          channelId: this.id,
          userId,
          reply: async (text: string) => {
            await this.sendMessage({ chatId, text });
          },
        }
      );
    }

    await this.eventBus.emit(buildInboundChannelEvent({
      platform: this.id as CanonicalChannelPlatform,
      userId,
      chatId,
      rawText,
      messageId: extracted.messageId || null,
      now: this.now(),
      fields: extracted.fields || {},
    }));
    return true;
  }

  public async sendMessage(outboundPayload: Record<string, unknown> | string): Promise<ChannelGatewayDeliveryResult> {
    const message = typeof outboundPayload === 'string'
      ? outboundPayload
      : String(outboundPayload?.text || outboundPayload?.message || '').trim();

    const recipients = isOutboundPayload(outboundPayload) && Array.isArray(outboundPayload.recipients)
      ? outboundPayload.recipients
      : [];

    if (this.resolveConfigured() && this.fetchImpl) {
      const live = await this.dispatchLive(message, recipients, outboundPayload);
      if (live.ok) {
        this.markOutbound();
        return live;
      }
      this.recordError(live.reason || `Channel delivery failed${live.httpStatus ? `: HTTP ${live.httpStatus}` : ''}.`);

      if (this.isTransientError(live)) {
        const envelope = buildOutboundChannelEnvelope({
          platform: this.id as CanonicalChannelPlatform,
          transport: `${this.mode}-configured`,
          recipients,
          message,
          payload: outboundPayload && typeof outboundPayload === 'object' ? outboundPayload as Record<string, unknown> : null,
          now: this.now(),
          fields: {
            chatId: String((outboundPayload as OutboundPayload)?.chatId || (outboundPayload as OutboundPayload)?.to || '').trim() || null,
          },
        });
        persistChannelOutboxEnvelope(this.outboxDir, envelope);
        return { ok: false, status: 'queued', transport: 'local-outbox', reason: `Transient error (${live.reason}), queued for retry.` };
      }

      return live;
    }

    const envelope = buildOutboundChannelEnvelope({
      platform: this.id as CanonicalChannelPlatform,
      transport: this.resolveConfigured() ? `${this.mode}-configured` : 'local-outbox',
      recipients,
      message,
      payload: outboundPayload && typeof outboundPayload === 'object' ? outboundPayload as Record<string, unknown> : null,
      now: this.now(),
      fields: {
        chatId: String((outboundPayload as OutboundPayload)?.chatId || (outboundPayload as OutboundPayload)?.to || '').trim() || null,
      },
    });

    persistChannelOutboxEnvelope(this.outboxDir, envelope);
    this.lastOutboundAt = this.now().toISOString();
    this.lastError = null;
    this.writeStatus();
    return { ok: true, status: 'queued', transport: 'local-outbox' };
  }

  public isTransientError(result: ChannelGatewayDeliveryResult): boolean {
    if (result.ok) return false;
    if (result.httpStatus !== undefined) {
      if (result.httpStatus === 429 || (result.httpStatus >= 500 && result.httpStatus < 600)) {
        return true;
      }
      return false;
    }
    const transientKeywords = [
      'fetch failed', 'timeout', 'econnrefused', 'enotfound', 'etimedout',
      'network error', 'socket hung up', 'aborted', 'failed to fetch'
    ];
    const reason = String(result.reason || '').toLowerCase();
    return transientKeywords.some(keyword => reason.includes(keyword));
  }

  public async retrySendLive(message: string, recipients: unknown[], rawPayload: Record<string, unknown> | string): Promise<ChannelGatewayDeliveryResult> {
    return this.dispatchLive(message, recipients, rawPayload);
  }

  private async dispatchLive(message: string, recipients: unknown[], rawPayload: Record<string, unknown> | string): Promise<ChannelGatewayDeliveryResult> {
    const target = String((rawPayload as OutboundPayload)?.chatId || (rawPayload as OutboundPayload)?.to || recipients[0] || '').trim();
    const request = async (url: string, init: RequestInit): Promise<ChannelGatewayDeliveryResult> => {
      try {
        const response = await this.fetchImpl!(url, init);
        return response.ok
          ? { ok: true, status: 'delivered', transport: this.mode, httpStatus: response.status }
          : { ok: false, status: 'failed', transport: this.mode, httpStatus: response.status, reason: `HTTP ${response.status}` };
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn('[Webhook way] network request failed', error);
    return { ok: false, status: 'failed', transport: this.mode, reason: error instanceof Error ? err.message : String(error) };
  }
    };
    const json = (url: string, body: Record<string, unknown>, headers: Record<string, string> = {}) => request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    if (this.id === 'matrix') {
      if (!target) return { ok: false, status: 'failed', transport: this.mode, reason: 'Matrix requires a room id.' };
      const baseUrl = String(config.matrixBaseUrl || '').replace(/\/+$/, '');
      return request(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(target)}/send/m.room.message/zav-${Date.now()}`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.matrixAccessToken}` }, body: JSON.stringify({ msgtype: 'm.text', body: message }) });
    }
    if (this.id === 'line') {
      if (!target) return { ok: false, status: 'failed', transport: this.mode, reason: 'LINE requires a target id.' };
      return json('https://api.line.me/v2/bot/message/push', { to: target, messages: [{ type: 'text', text: message }] }, { authorization: `Bearer ${config.lineChannelAccessToken}` });
    }
    if (this.id === 'telegram') {
      const token = String(config.telegramBotToken || '').trim();
      const chatId = target || String(config.telegramDefaultChatId || '').trim();
      if (!token || !chatId) return { ok: false, status: 'failed', transport: this.mode, reason: 'Telegram requires a bot token and chat id.' };
      return json(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text: message });
    }
    const webhookUrls: Record<string, string> = {
      'google-chat': String(config.googleChatWebhookUrl || ''), feishu: String(config.feishuWebhookUrl || ''), wecom: String(config.wecomWebhookUrl || ''),
      'home-assistant': String(config.homeAssistantWebhookUrl || ''), 'nextcloud-talk': String(config.nextcloudTalkWebhookUrl || ''), mattermost: String(config.mattermostWebhookUrl || ''),
      'synology-chat': String(config.synologyChatWebhookUrl || ''), clickclack: String(config.clickclackWebhookUrl || ''),
      discord: String(config.discordWebhookUrl || ''), slack: String(config.slackWebhookUrl || ''), teams: String(config.teamsWebhookUrl || ''),
      instagram: String(config.instagramWebhookUrl || ''),
    };
    if (webhookUrls[this.id]) {
      const body = this.id === 'feishu' ? { msg_type: 'text', content: { text: message } }
        : this.id === 'wecom' ? { msgtype: 'text', text: { content: message } }
        : this.id === 'discord' ? { content: message }
        : { text: message };
      return json(webhookUrls[this.id], body);
    }
    const endpointUrls: Record<string, string> = { qq: String(config.qqSendUrl || ''), zalo: String(config.zaloSendUrl || ''), sms: String(config.smsSendUrl || config.smsApiBaseUrl || '') };
    if (endpointUrls[this.id]) {
      if (!target) return { ok: false, status: 'failed', transport: this.mode, reason: `${this.name} requires a recipient.` };
      const token = this.id === 'zalo' ? String(config.zaloAccessToken || '') : this.id === 'sms' ? String(config.smsProviderToken || '') : '';
      return json(endpointUrls[this.id], { to: target, target, text: message, message }, token ? { authorization: `Bearer ${token}` } : {});
    }
    const bridgeUrls: Record<string, string> = {
      irc: String(config.ircBridgeUrl || ''), weixin: String(config.weixinBridgeUrl || ''), yuanbao: String(config.yuanbaoBridgeUrl || ''),
      'voice-call': String(config.voiceCallBridgeUrl || ''), 'google-meet': String(config.googleMeetBridgeUrl || ''), twitch: String(config.twitchBridgeUrl || ''), nostr: String(config.nostrBridgeUrl || ''),
      whatsapp: String(config.whatsappBridgeUrl || ''), signal: String(config.signalJsonRpcUrl || ''), imessage: String(config.imessageBridgeUrl || ''),
      email: String(config.emailSmtpHost || ''),
    };
    if (bridgeUrls[this.id]) return json(`${bridgeUrls[this.id].replace(/\/+$/, '')}/send`, { channel: target || this.id, text: message, message });
    return { ok: false, status: 'failed', transport: this.mode, reason: `No live transport is configured for ${this.id}.` };
  }

  protected buildDefaultFeatures(): ChannelFeatureSet {
    return {
      inbound: true,
      outbound: true,
      sessionList: false,
      sessionHistory: false,
      sessionSend: true,
      sessionSpawn: false,
      attachments: false,
      threads: false,
      groupPolicy: true,
      identityHints: true,
      webhook: this.mode === 'webhook' || this.mode === 'bot-http',
      localBridge: this.mode === 'local-bridge',
    };
  }

  protected buildDefaultDescribe(): ChannelAdapterStatus {
    const configured = this.resolveConfigured();
    const enabled = this.resolveEnabled();
    return {
      id: this.id,
      label: this.name,
      readiness: configured ? 'ready' : enabled ? 'partial' : 'planned',
      implementationState: configured ? 'full' : 'stub',
      configured,
      transport: isValidPlatformTransport(this.mode) ? this.mode : 'planned',
      notes: configured
        ? [`${this.name} is configured and ready.`]
        : [`Configure environment variables to enable ${this.name}.`],
      features: this.buildDefaultFeatures(),
      riskLevel: 'low',
      setupMode: this.mode,
      provider: this.mode,
      lastHealth: configured ? 'passed' : 'unknown',
      lastEventAt: this.lastInboundAt,
    };
  }

  protected buildDefaultStatusSnapshot(): WebhookGatewayStatusSnapshot {
    return {
      id: this.id,
      mode: this.mode,
      enabled: this.resolveEnabled(),
      started: this.started,
      configured: this.resolveConfigured(),
      transport: this.resolveConfigured() ? this.mode : 'local-outbox',
      lastInboundAt: this.lastInboundAt,
      lastOutboundAt: this.lastOutboundAt,
      lastError: this.lastError,
      updatedAt: this.now().toISOString(),
    };
  }

  protected ensureRuntimePaths(): void {
    fs.mkdirSync(this.outboxDir, { recursive: true });
    fs.mkdirSync(path.dirname(this.statusFile), { recursive: true });
  }

  protected writeStatus(): void {
    this.ensureRuntimePaths();
    fs.writeFileSync(this.statusFile, JSON.stringify(this.buildDefaultStatusSnapshot(), null, 2), 'utf8');
  }

  protected recordError(message: string): void {
    this.lastError = message;
    this.writeStatus();
  }

  protected markOutbound(): void {
    this.lastOutboundAt = this.now().toISOString();
    this.lastError = null;
    this.writeStatus();
  }

  protected markInbound(): void {
    this.lastInboundAt = this.now().toISOString();
    this.lastError = null;
    this.writeStatus();
  }
}
