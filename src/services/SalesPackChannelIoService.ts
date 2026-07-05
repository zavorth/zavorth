import { randomUUID } from 'crypto';
import type {
  SalesPackChannelIoEnvelope,
  SalesPackChannelIoEvent,
  SalesPackChannelIoEventKind,
  SalesPackChannelIoNormalizedMessage,
  SalesPackChannelIoProvider,
  SalesPackChannelIoReceiveResult,
  SalesPackChannelIoSnapshot,
} from '../contracts/SalesPackChannelIoContract.js';
import type {
  SalesChannelPlatform,
  SalesPackMode,
} from '../contracts/SalesPackContract.js';
import { SalesPackMvpService } from '../domain/platform-ecosystem/application/sales-pack/index.js';
import { logger } from '../logger.js';

type SalesPackChannelIoRuntime = {
  mode?: SalesPackMode;
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  salesPack?: SalesPackMvpService;
};

type WhatsAppCloudExtraction =
  | { kind: 'message'; envelope: SalesPackChannelIoEnvelope }
  | { kind: 'status'; providerMessageId: string | null; status: string; tenantId: string; channelAccountId: string };

type NormalizedEnvelopeResult =
  | { kind: 'message'; message: SalesPackChannelIoNormalizedMessage | null }
  | Extract<WhatsAppCloudExtraction, { kind: 'status' }>;

export class SalesPackChannelIoService {
  private readonly mode: SalesPackMode;
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly salesPack: SalesPackMvpService;
  private readonly seenProviderMessageIds = new Set<string>();
  private readonly events: SalesPackChannelIoEvent[] = [];
  private processed = 0;
  private duplicates = 0;
  private rejected = 0;
  private statusOnly = 0;

  public constructor(runtime: SalesPackChannelIoRuntime = {}) {
    this.mode = runtime.mode || 'demo';
    this.now = runtime.now || (() => new Date());
    this.idFactory = runtime.idFactory || ((prefix) => `${prefix}-${randomUUID()}`);
    this.salesPack = runtime.salesPack || new SalesPackMvpService({
      mode: this.mode,
      now: this.now,
      idFactory: this.idFactory,
    });
  }

  public receiveInbound(envelope: SalesPackChannelIoEnvelope): SalesPackChannelIoReceiveResult {
    const normalized = this.normalizeEnvelope(envelope);
    if (normalized.kind === 'status') {
      this.statusOnly += 1;
      const event = this.appendEvent('delivery.status.received', {
        traceId: this.idFactory('channel-trace'),
        tenantId: normalized.tenantId,
        channelAccountId: normalized.channelAccountId,
        providerMessageId: normalized.providerMessageId,
        platform: 'whatsapp',
        provider: 'whatsapp-cloud-api',
        summary: `Delivery status received: ${normalized.status || 'unknown'}.`,
        metadata: { status: normalized.status },
      });
      return {
        ok: true,
        status: 'status_only',
        traceId: event.traceId,
        message: null,
        conversationResult: null,
        event,
      };
    }

    if (!normalized.message) {
      this.rejected += 1;
      const event = this.appendEvent('inbound.rejected', {
        traceId: clean(envelope.traceId, this.idFactory('channel-trace')),
        tenantId: clean(envelope.tenantId, 'default-tenant'),
        channelAccountId: clean(envelope.channelAccountId, 'sales-channel-whatsapp'),
        providerMessageId: cleanNullable(envelope.providerMessageId),
        platform: normalizePlatform(envelope.platform),
        provider: normalizeProvider(envelope.provider),
        summary: 'Inbound payload rejected because text or customer identity was missing.',
        metadata: {},
      });
      return {
        ok: false,
        status: 'rejected',
        traceId: event.traceId,
        message: null,
        conversationResult: null,
        event,
      };
    }

    const message = normalized.message;
    this.appendEvent('inbound.normalized', {
      traceId: message.traceId,
      tenantId: message.tenantId,
      channelAccountId: message.channelAccountId,
      providerMessageId: message.providerMessageId,
      platform: message.platform,
      provider: message.provider,
      summary: 'Inbound message normalized for Sales Pack processing.',
      metadata: {
        customerId: message.customerId,
        conversationId: message.conversationId,
      },
    });

    if (message.providerMessageId && this.seenProviderMessageIds.has(message.providerMessageId)) {
      this.duplicates += 1;
      const event = this.appendEvent('inbound.duplicate', {
        traceId: message.traceId,
        tenantId: message.tenantId,
        channelAccountId: message.channelAccountId,
        providerMessageId: message.providerMessageId,
        platform: message.platform,
        provider: message.provider,
        summary: 'Duplicate inbound message ignored by Channel I/O idempotency.',
        metadata: { customerId: message.customerId },
      });
      return {
        ok: true,
        status: 'duplicate',
        traceId: message.traceId,
        message,
        conversationResult: null,
        event,
      };
    }

    if (message.providerMessageId) {
      this.seenProviderMessageIds.add(message.providerMessageId);
    }

    const conversationResult = this.salesPack.processInboundMessage({
      tenantId: message.tenantId,
      channelAccountId: message.channelAccountId,
      customerId: message.customerId,
      conversationId: message.conversationId,
      actorId: message.actorId,
      text: message.text,
      traceId: message.traceId,
      runId: message.runId,
      surface: `channel-io:${message.platform}`,
      receivedAt: message.receivedAt,
      metadata: message.metadata,
    });
    this.processed += 1;
    const event = this.appendEvent('inbound.processed', {
      traceId: message.traceId,
      tenantId: message.tenantId,
      channelAccountId: message.channelAccountId,
      providerMessageId: message.providerMessageId,
      platform: message.platform,
      provider: message.provider,
      summary: `Inbound processed as ${conversationResult.signal.intent}.`,
      metadata: {
        leadScore: conversationResult.signal.leadScore,
        selectedAgentRole: conversationResult.selectedAgent.role,
      },
    });
    return {
      ok: conversationResult.ok,
      status: 'processed',
      traceId: message.traceId,
      message,
      conversationResult,
      event,
    };
  }

  public buildSnapshot(): SalesPackChannelIoSnapshot {
    const inboundReceived = this.processed + this.duplicates + this.rejected + this.statusOnly;
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: '2026-05-09.sales-pack-channel-io',
      mode: this.mode,
      summary: {
        inboundReceived,
        processed: this.processed,
        duplicates: this.duplicates,
        rejected: this.rejected,
        statusOnly: this.statusOnly,
        knownMessageIds: this.seenProviderMessageIds.size,
      },
      narrative: {
        headline: 'Sales Pack Channel I/O',
        operatorSummary: `${this.processed} processada(s), ${this.duplicates} duplicada(s), ${this.rejected} rejeitada(s).`,
        nextAction: this.processed > 0
          ? 'Abrir Inbox/CRM do Sales OS para acompanhar leads atualizados.'
          : 'Enviar payload local ou WhatsApp Cloud API para validar inbound.',
      },
      actions: [
        {
          id: 'sales-pack-channel-io:send-demo-inbound',
          label: 'Testar inbound local',
          severity: 'info',
          command: '/sales inbound-demo',
        },
        {
          id: 'sales-pack-channel-io:configure-whatsapp-cloud',
          label: 'Configurar webhook oficial do WhatsApp',
          severity: this.mode === 'cloud-api' ? 'info' : 'warn',
          command: '/channels whatsapp',
        },
      ],
      sourceSnapshots: {
        recentEvents: this.events.slice(-25).reverse().map(cloneEvent),
      },
    };
  }

  public getSalesPack(): SalesPackMvpService {
    return this.salesPack;
  }

  private normalizeEnvelope(
    envelope: SalesPackChannelIoEnvelope,
  ): NormalizedEnvelopeResult {
    const provider = normalizeProvider(envelope.provider);
    if (provider === 'whatsapp-cloud-api') {
      const extracted = extractWhatsAppCloudPayload(envelope);
      if (extracted.kind === 'status') {
        return extracted;
      }
      return {
        kind: 'message',
        message: this.buildMessage({
          ...envelope,
          platform: 'whatsapp',
          provider,
          ...extracted.envelope,
          metadata: {
            ...(envelope.metadata || {}),
            provider: 'whatsapp-cloud-api',
          },
        }),
      };
    }
    return {
      kind: 'message',
      message: this.buildMessage(envelope),
    };
  }

  private buildMessage(envelope: SalesPackChannelIoEnvelope): SalesPackChannelIoNormalizedMessage | null {
    const text = cleanNullable(envelope.text);
    const customerId = cleanNullable(envelope.customerId);
    if (!text || !customerId) {
      return null;
    }
    const platform = normalizePlatform(envelope.platform) || 'whatsapp';
    const provider = normalizeProvider(envelope.provider);
    const tenantId = clean(envelope.tenantId, 'default-tenant');
    const channelAccountId = clean(envelope.channelAccountId, `sales-channel-${platform}`);
    const traceId = clean(envelope.traceId, this.idFactory('channel-trace'));
    return {
      tenantId,
      channelAccountId,
      platform,
      provider,
      providerMessageId: cleanNullable(envelope.providerMessageId),
      customerId,
      conversationId: cleanNullable(envelope.conversationId),
      actorId: clean(envelope.actorId, customerId),
      text,
      traceId,
      runId: cleanNullable(envelope.runId),
      receivedAt: clean(envelope.receivedAt, this.now().toISOString()),
      metadata: sanitizeMetadata({
        ...(envelope.metadata || {}),
        providerMessageId: cleanNullable(envelope.providerMessageId),
      }),
    };
  }

  private appendEvent(kind: SalesPackChannelIoEventKind, input: Omit<SalesPackChannelIoEvent, 'id' | 'kind' | 'createdAt'>): SalesPackChannelIoEvent {
    const event: SalesPackChannelIoEvent = {
      id: this.idFactory('channel-io-event'),
      kind,
      createdAt: this.now().toISOString(),
      traceId: clean(input.traceId, 'trace-unknown'),
      tenantId: clean(input.tenantId, 'default-tenant'),
      channelAccountId: clean(input.channelAccountId, 'sales-channel-whatsapp'),
      providerMessageId: cleanNullable(input.providerMessageId),
      platform: input.platform,
      provider: input.provider,
      summary: clean(input.summary, 'Channel I/O event.'),
      metadata: sanitizeMetadata(input.metadata),
    };
    this.events.push(event);
    if (this.events.length > 500) {
      this.events.shift();
    }
    return cloneEvent(event);
  }
}

function extractWhatsAppCloudPayload(envelope: SalesPackChannelIoEnvelope): WhatsAppCloudExtraction {
  const body = envelope.body || parseRawJson(envelope.rawBody);
  const entry = firstRecord((body?.entry as unknown[]) || []);
  const change = firstRecord((entry?.changes as unknown[]) || []);
  const value = asRecord(change?.value);
  const metadata = asRecord(value?.metadata);
  const message = firstRecord((value?.messages as unknown[]) || []);
  if (message) {
    const text = cleanNullable(asRecord(message.text)?.body) || cleanNullable(message.body);
    return {
      kind: 'message',
      envelope: {
        tenantId: cleanNullable(entry?.id) || cleanNullable(envelope.tenantId) || undefined,
        channelAccountId: cleanNullable(metadata?.phone_number_id) || cleanNullable(envelope.channelAccountId) || undefined,
        providerMessageId: cleanNullable(message.id) || cleanNullable(envelope.providerMessageId) || undefined,
        customerId: cleanNullable(message.from) || cleanNullable(envelope.customerId) || undefined,
        actorId: cleanNullable(message.from) || cleanNullable(envelope.actorId) || undefined,
        text: text || undefined,
        receivedAt: normalizeWhatsAppTimestamp(message.timestamp) || cleanNullable(envelope.receivedAt) || undefined,
      },
    };
  }
  const status = firstRecord((value?.statuses as unknown[]) || []);
  return {
    kind: 'status',
    providerMessageId: cleanNullable(status?.id) || cleanNullable(envelope.providerMessageId),
    status: clean(status?.status, 'unknown'),
    tenantId: clean(entry?.id || envelope.tenantId, 'default-tenant'),
    channelAccountId: clean(metadata?.phone_number_id || envelope.channelAccountId, 'sales-channel-whatsapp'),
  };
}

function normalizeWhatsAppTimestamp(value: unknown): string | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return new Date(numeric * 1000).toISOString();
}

function normalizePlatform(value: unknown): SalesChannelPlatform | null {
  const normalized = String(value || '').trim().toLowerCase();
  const allowed = new Set<SalesChannelPlatform>(['whatsapp', 'instagram', 'site-chat', 'email', 'telegram', 'sms', 'slack']);
  return allowed.has(normalized as SalesChannelPlatform) ? normalized as SalesChannelPlatform : null;
}

function normalizeProvider(value: unknown): SalesPackChannelIoProvider {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'whatsapp-cloud-api') return 'whatsapp-cloud-api';
  if (normalized === 'generic-webhook') return 'generic-webhook';
  return 'local-stub';
}

function parseRawJson(rawBody: unknown): Record<string, unknown> | null {
  const raw = cleanNullable(rawBody);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) { logger.warn('[Sales Pack Channel Io] JSON parse failed', error); return null; }
}

function firstRecord(values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    const record = asRecord(value);
    if (record) return record;
  }
  return null;
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function sanitizeMetadata(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input || {})) {
    const normalizedKey = cleanNullable(key);
    if (!normalizedKey || value === undefined) continue;
    output[normalizedKey] = typeof value === 'string' ? sanitizeText(value) : value;
  }
  return output;
}

function sanitizeText(value: string): string {
  return value
    .replace(/\b(?:token|secret|password|senha)\s*[:=]\s*['"]?[^,'"\s]+/gi, '[secret-redacted]')
    .slice(0, 500);
}

function cloneEvent(event: SalesPackChannelIoEvent): SalesPackChannelIoEvent {
  return {
    ...event,
    metadata: { ...event.metadata },
  };
}

function clean(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function cleanNullable(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}
