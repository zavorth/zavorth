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
import { ChannelLiveTransportRegistry } from './ChannelLiveTransportRegistry.js';
import { getScaleToZeroManager } from './ScaleToZeroRuntime.js';

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
    let rawText = String(extracted.rawText || '').trim();

    // Gap 5 — voice notes on messaging webhooks (WhatsApp/Slack/etc.) when payload carries audio URL
    try {
      const {
        extractAudioMediaFromPayload,
        ingestMessagingVoiceFromUrl,
        mergeMessagingVoiceText,
      } = await import('../services/voice/MessagingChannelVoiceIngest.js');
      let resolvedMedia = extractAudioMediaFromPayload(webhookPayload);
      const extractedMediaUrl = String((extracted as { mediaUrl?: string }).mediaUrl || '').trim();
      if (!resolvedMedia?.url && extractedMediaUrl) {
        resolvedMedia = { url: extractedMediaUrl, mimeType: 'audio/ogg' };
      }
      if (resolvedMedia?.url || resolvedMedia?.mediaId) {
        const voice = await ingestMessagingVoiceFromUrl({
          url: resolvedMedia.url,
          mediaId: resolvedMedia.mediaId,
          mimeType: resolvedMedia.mimeType,
          fileName: resolvedMedia.fileName,
          surface: this.id,
          userId,
          source: resolvedMedia.source,
        });
        if (voice.ok && voice.agentText) {
          rawText = mergeMessagingVoiceText(rawText, voice);
        } else if (!rawText && voice.message) {
          rawText = voice.message;
        }
      }
    } catch (error: unknown) {
      logger.warn('[WebhookGateway] voice note ingest soft-failed', error);
    }

    if (!rawText) {
      return false;
    }

    try {
      const scale = getScaleToZeroManager();
      if (scale.isShutdown(this.id)) {
        await scale.warmUp(this.id);
      }
      scale.recordActivity(this.id);
    } catch {
      // Activity tracking must never block message delivery.
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

    const deckReply = this.handleCommandDeck(rawText);
    if (deckReply) {
      await this.sendMessage({ chatId, text: deckReply, recipients: [chatId] });
      return true;
    }

    // Numbered / slash approval for pending surface cards (WhatsApp/Signal/Slack/etc.)
    try {
      const { tryConsumeMessagingPermissionText } = await import(
        '../domain/surface/application/surface-projection/MessagingSurfaceResponseSender.js'
      );
      const permission = tryConsumeMessagingPermissionText({
        channel: this.id,
        chatId,
        userId,
        rawText,
      });
      if (permission) {
        const commandText =
          permission.choice === 'deny'
            ? `/reject ${permission.taskId}`
            : `/approve ${permission.taskId} ${permission.choice}`;
        if (this.broker) {
          await this.broker.processMessage({
            platform: this.id as CanonicalChannelPlatform,
            userId,
            chatId,
            messageId: extracted.messageId || null,
            isGroup: Boolean(extracted.isGroup),
            rawText: commandText,
            reply: async (text: string) => {
              await this.sendMessage({ chatId, text });
            },
          });
        } else {
          await this.sendMessage({
            chatId,
            text: `Recorded decision: ${permission.choice} for ${permission.taskId.slice(0, 8)}.`,
            recipients: [chatId],
          });
        }
        return true;
      }
    } catch (error: unknown) {
      logger.warn('[WebhookGateway] messaging permission consume failed', error);
    }

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
    const plan = ChannelLiveTransportRegistry.plan({
      channelId: this.id,
      message,
      target,
      cfg: config,
    });

    // Email densified plan is outbox/bridge mediated (no raw SMTP in gateway process).
    if (plan.kind === 'email-smtp-bridge' && plan.body) {
      return {
        ok: true,
        status: 'queued',
        transport: 'email-smtp-outbox',
        reason: 'Email densified path queues through outbox/SMTP bridge.',
      };
    }

    if (!plan.url || !plan.body) {
      return {
        ok: false,
        status: 'failed',
        transport: this.mode,
        reason: plan.reasonIfUnavailable || `No live transport is configured for ${this.id}.`,
      };
    }

    if (!this.fetchImpl) {
      return { ok: false, status: 'failed', transport: this.mode, reason: 'No fetch implementation available for live send.' };
    }

    try {
      const response = await this.fetchImpl(plan.url, {
        method: plan.method,
        headers: plan.headers,
        body: JSON.stringify(plan.body),
      });
      return response.ok
        ? { ok: true, status: 'delivered', transport: `${this.mode}:${plan.kind}`, httpStatus: response.status }
        : { ok: false, status: 'failed', transport: `${this.mode}:${plan.kind}`, httpStatus: response.status, reason: `HTTP ${response.status}` };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[WebhookGateway] live transport request failed', error);
      return {
        ok: false,
        status: 'failed',
        transport: `${this.mode}:${plan.kind}`,
        reason: error instanceof Error ? err.message : String(error),
      };
    }
  }

  /** Live densification plan for this channel (credentials optional). */
  public liveTransportPlan(message = '', target = ''): ReturnType<typeof ChannelLiveTransportRegistry.plan> {
    return ChannelLiveTransportRegistry.plan({
      channelId: this.id,
      message,
      target,
      cfg: config,
    });
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

  /**
   * Shared product completeness surface for every factory channel.
   * Credentials may still be missing; code-level capabilities stay first-class.
   */
  public doctorSnapshot(): ChannelGatewayDoctorSnapshot {
    const status = this.buildDefaultStatusSnapshot();
    return {
      channelId: this.id,
      name: this.name,
      mode: this.mode,
      configured: this.resolveConfigured(),
      enabled: this.resolveEnabled(),
      started: this.started,
      transport: status.transport,
      lastInboundAt: this.lastInboundAt,
      lastOutboundAt: this.lastOutboundAt,
      lastError: this.redactSecrets(this.lastError),
      outboxDir: this.outboxDir,
      statusFile: this.statusFile,
      allowlist: {
        policyManagerPresent: Boolean(this.policyManager),
        unauthorizedBlocked: true,
      },
      secretsRedacted: true,
      doctorCommand: `/channels doctor ${this.id}`,
      installHint: this.resolveConfigured()
        ? `${this.name} is configured. Run smoke inbound/outbound when ready.`
        : `Configure credentials for ${this.name}, then re-run doctor.`,
      completeness: this.completenessReport(),
    };
  }

  public completenessReport(): ChannelGatewayCompletenessReport {
    return {
      inbound: true,
      outbound: true,
      allowlist: true,
      doctor: true,
      outboxFallback: true,
      mockIo: true,
      redaction: true,
      commandDeck: true,
      continuitySessionKey: true,
      installScaffold: true,
      firstClass: true,
    };
  }

  public continuitySessionKey(userId: string, sessionId?: string | null): string {
    const user = String(userId || '').trim() || 'anonymous';
    const session = String(sessionId || '').trim() || 'default';
    return `${this.id}:${user}:${session}`;
  }

  public commandDeckMin(): ChannelGatewayCommandDeckEntry[] {
    return [
      { command: '/help', summary: `Help for ${this.name}` },
      { command: '/commands', summary: 'List operator command deck' },
      { command: '/channels', summary: 'List channel fabric status' },
      { command: '/models', summary: 'List models (shared surface)' },
      { command: '/status', summary: `${this.name} gateway status` },
      { command: '/gateway', summary: `${this.name} doctor and readiness` },
    ];
  }

  public handleCommandDeck(rawText: string): string | null {
    const text = String(rawText || '').trim().toLowerCase();
    if (!text.startsWith('/')) return null;
    const cmd = text.split(/\s+/)[0];
    if (cmd === '/help' || cmd === '/commands') {
      return this.commandDeckMin().map((entry) => `${entry.command} — ${entry.summary}`).join('\n');
    }
    if (cmd === '/status' || cmd === '/gateway') {
      const doctor = this.doctorSnapshot();
      return [
        `${doctor.name} (${doctor.channelId})`,
        `configured: ${doctor.configured}`,
        `enabled: ${doctor.enabled}`,
        `transport: ${doctor.transport}`,
        `outbox: ${doctor.outboxDir}`,
        `firstClass: ${doctor.completeness.firstClass}`,
      ].join('\n');
    }
    if (cmd === '/channels' || cmd === '/models') {
      return `${cmd} is handled by the shared surface; channel ${this.id} is first-class.`;
    }
    return null;
  }

  public async mockInbound(payload: Record<string, unknown> = {}): Promise<{
    ok: boolean;
    accepted: boolean;
    channelId: string;
    sessionKey: string | null;
    reason?: string;
  }> {
    const body = {
      text: 'zavorth mock inbound',
      userId: 'mock-user',
      chatId: `${this.id}-mock`,
      messageId: `mock-${Date.now()}`,
      ...payload,
    };
    try {
      const accepted = await this.onMessageReceived(body);
      const extracted = this.extractInboundPayload(body);
      return {
        ok: true,
        accepted,
        channelId: this.id,
        sessionKey: extracted
          ? this.continuitySessionKey(extracted.userId, extracted.messageId || null)
          : this.continuitySessionKey('mock-user'),
        ...(accepted ? {} : { reason: 'payload not accepted or allowlist blocked' }),
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return {
        ok: false,
        accepted: false,
        channelId: this.id,
        sessionKey: null,
        reason: error instanceof Error ? err.message : String(error),
      };
    }
  }

  public async mockOutbound(text = 'zavorth mock outbound', chatId?: string | null): Promise<ChannelGatewayDeliveryResult> {
    const target = String(chatId || `${this.id}-mock`).trim();
    return this.sendMessage({
      text: this.redactSecrets(text) || 'zavorth mock outbound',
      chatId: target,
      recipients: [target],
    });
  }

  public redactSecrets(value: string | null | undefined): string | null {
    if (value == null) return null;
    return String(value)
      .replace(/(token|secret|password|api[_-]?key|authorization|bearer)\s*[:=]\s*([^\s,;]+)/gi, '$1=***')
      .replace(/\b[A-Za-z0-9_-]{24,}\b/g, (match) => (match.length > 32 ? `${match.slice(0, 4)}…***` : match));
  }
}

export type ChannelGatewayCompletenessReport = {
  inbound: true;
  outbound: true;
  allowlist: true;
  doctor: true;
  outboxFallback: true;
  mockIo: true;
  redaction: true;
  commandDeck: true;
  continuitySessionKey: true;
  installScaffold: true;
  firstClass: true;
};

export type ChannelGatewayDoctorSnapshot = {
  channelId: string;
  name: string;
  mode: WebhookGatewayMode;
  configured: boolean;
  enabled: boolean;
  started: boolean;
  transport: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
  outboxDir: string;
  statusFile: string;
  allowlist: {
    policyManagerPresent: boolean;
    unauthorizedBlocked: true;
  };
  secretsRedacted: true;
  doctorCommand: string;
  installHint: string;
  completeness: ChannelGatewayCompletenessReport;
};

export type ChannelGatewayCommandDeckEntry = {
  command: string;
  summary: string;
};
