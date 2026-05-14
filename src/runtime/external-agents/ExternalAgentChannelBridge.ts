import type {
  AgentRunExecutionOptions,
  ZavorthAgentGateway,
} from '../agent/index.js';
import type {
  NormalizedInboundMessage,
} from '../agent/contracts/index.js';
import type {
  UniversalAgentChannel,
  UniversalAgentRunResult,
  UniversalReplyPacket,
  UniversalReplyPort,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ExternalAgentAdapter,
  ExternalAgentChannelDescriptor,
  ExternalAgentEventEnvelope,
  ExternalAgentOutboundActionEnvelope,
  ExternalAgentOutboundActionResult,
} from './contracts.js';

export type ExternalAgentBridgeMediaKind = 'image' | 'file' | 'audio' | 'video' | 'link' | 'unknown';

export type ExternalAgentBridgeMediaAttachment = {
  id: string;
  kind: ExternalAgentBridgeMediaKind;
  title: string;
  mimeType?: string;
  sizeBytes?: number;
  sourceUri?: string;
  artifactPolicy: 'map-to-zavorth-artifact' | 'drop-unsupported';
  status: 'mapped' | 'unsupported';
};

export type ExternalAgentBridgeChannelDescriptor = {
  id: string;
  label: string;
  channel: UniversalAgentChannel;
  status: ExternalAgentChannelDescriptor['status'];
  inbound: boolean;
  outbound: 'reply-pipeline-only' | 'unavailable';
  replyPort: UniversalReplyPort;
  media: {
    attachments: 'map-to-zavorth-artifacts';
    supportedKinds: ExternalAgentBridgeMediaKind[];
  };
  sourceDiagnosticsAvailable: boolean;
};

export type ExternalAgentBridgeChannelHealthSnapshot = {
  runtimeId: string;
  generatedAt: string;
  summary: {
    total: number;
    available: number;
    degraded: number;
    offline: number;
    replyPipelineOnly: number;
  };
  channels: ExternalAgentBridgeChannelDescriptor[];
};

export type ExternalAgentDeliveryReceipt = {
  id: string;
  actionId: string;
  replyPacketId: string;
  runId: string;
  sessionId: string;
  channelId: string;
  status: 'delivered' | 'dry-run' | 'blocked' | 'failed';
  deliveredAt: string;
  sourceReceiptId?: string;
  textDigest: string;
};

export type ExternalAgentChannelHistoryEntry = {
  id: string;
  sessionId: string;
  runId?: string;
  role: 'user' | 'assistant' | 'system';
  channel: UniversalAgentChannel;
  text: string;
  createdAt: string;
  eventId?: string;
  replyPacketId?: string;
  attachments?: ExternalAgentBridgeMediaAttachment[];
};

export type ExternalAgentChannelBridgeRunResult = {
  message: NormalizedInboundMessage;
  result: UniversalAgentRunResult;
  mediaAttachments: ExternalAgentBridgeMediaAttachment[];
  deliveries: ExternalAgentDeliveryReceipt[];
  history: ExternalAgentChannelHistoryEntry[];
  channelHealth: ExternalAgentBridgeChannelHealthSnapshot;
};

export type ExternalAgentChannelBridgeAdapter = ExternalAgentAdapter & {
  dispatchControlledOutboundAction(action: ExternalAgentOutboundActionEnvelope): Promise<ExternalAgentOutboundActionResult>;
};

export type ExternalAgentChannelBridgeOptions = {
  adapter: ExternalAgentChannelBridgeAdapter;
  gateway: Pick<ZavorthAgentGateway, 'handle'>;
  now?: () => Date;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeId(value: unknown, fallback: string): string {
  const normalized = normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function textDigest(value: string): string {
  const normalized = normalizeText(value);
  return `${normalized.slice(0, 48)}${normalized.length > 48 ? '...' : ''}`;
}

function inferMediaKind(input: Record<string, unknown>): ExternalAgentBridgeMediaKind {
  const kind = normalizeText(input.kind || input.type).toLowerCase();
  if (kind === 'image' || kind === 'file' || kind === 'audio' || kind === 'video' || kind === 'link') {
    return kind;
  }
  const mime = normalizeText(input.mimeType || input.mime).toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'text/uri-list') return 'link';
  return mime ? 'file' : 'unknown';
}

function replyStatusFromAction(result: ExternalAgentOutboundActionResult): ExternalAgentDeliveryReceipt['status'] {
  if (result.status === 'dispatched') return 'delivered';
  if (result.status === 'dry-run') return 'dry-run';
  if (result.status === 'blocked') return 'blocked';
  return 'failed';
}

export class ExternalAgentChannelBridge {
  private readonly adapter: ExternalAgentChannelBridgeAdapter;
  private readonly gateway: Pick<ZavorthAgentGateway, 'handle'>;
  private readonly now: () => Date;
  private readonly history: ExternalAgentChannelHistoryEntry[] = [];
  private readonly deliveries: ExternalAgentDeliveryReceipt[] = [];

  constructor(options: ExternalAgentChannelBridgeOptions) {
    this.adapter = options.adapter;
    this.gateway = options.gateway;
    this.now = options.now || (() => new Date());
  }

  public normalizeChannelDescriptor(channel: ExternalAgentChannelDescriptor): ExternalAgentBridgeChannelDescriptor {
    return {
      id: `external-channel:${normalizeId(channel.id, 'channel')}`,
      label: normalizeText(channel.label, 'External channel'),
      channel: channel.channel,
      status: channel.status,
      inbound: channel.inbound,
      outbound: channel.replyBoundary === 'zavorth-reply-port-only' ? 'reply-pipeline-only' : 'unavailable',
      replyPort: {
        id: `reply-port:${normalizeId(channel.id, 'channel')}`,
        label: `${normalizeText(channel.label, 'External channel')} replies`,
        kind: channel.channel,
        status: channel.status === 'available' ? 'available' : channel.status,
        primary: true,
        description: 'Zavorth reply pipeline port for an external channel bridge.',
      },
      media: {
        attachments: 'map-to-zavorth-artifacts',
        supportedKinds: ['image', 'file', 'audio', 'video', 'link'],
      },
      sourceDiagnosticsAvailable: Boolean(this.adapter.descriptor.diagnostics),
    };
  }

  public async buildChannelHealthSnapshot(): Promise<ExternalAgentBridgeChannelHealthSnapshot> {
    const channels = (await this.adapter.listChannels()).map((channel) => this.normalizeChannelDescriptor(channel));
    return {
      runtimeId: this.adapter.descriptor.id,
      generatedAt: this.now().toISOString(),
      summary: {
        total: channels.length,
        available: channels.filter((channel) => channel.status === 'available').length,
        degraded: channels.filter((channel) => channel.status === 'degraded').length,
        offline: channels.filter((channel) => channel.status === 'offline').length,
        replyPipelineOnly: channels.filter((channel) => channel.outbound === 'reply-pipeline-only').length,
      },
      channels,
    };
  }

  public mapMediaAttachments(event: ExternalAgentEventEnvelope): ExternalAgentBridgeMediaAttachment[] {
    const rawAttachments = event.payload.data?.attachments;
    if (!Array.isArray(rawAttachments)) {
      return [];
    }

    return rawAttachments.map((attachment, index) => {
      const record = attachment && typeof attachment === 'object'
        ? attachment as Record<string, unknown>
        : {};
      const kind = inferMediaKind(record);
      const supported = kind !== 'unknown';
      return {
        id: `external-media:${normalizeId(record.id || `${event.id}-${index + 1}`, 'attachment')}`,
        kind,
        title: normalizeText(record.title || record.name, `Attachment ${index + 1}`),
        ...(record.mimeType || record.mime ? { mimeType: normalizeText(record.mimeType || record.mime) } : {}),
        ...(typeof record.sizeBytes === 'number' ? { sizeBytes: record.sizeBytes } : {}),
        ...(record.uri || record.url ? { sourceUri: normalizeText(record.uri || record.url) } : {}),
        artifactPolicy: supported ? 'map-to-zavorth-artifact' : 'drop-unsupported',
        status: supported ? 'mapped' : 'unsupported',
      };
    });
  }

  public async bridgeInboundEvent(
    event: ExternalAgentEventEnvelope,
    options: AgentRunExecutionOptions = {},
  ): Promise<ExternalAgentChannelBridgeRunResult> {
    const message = this.adapter.normalizeEvent(event);
    const mediaAttachments = this.mapMediaAttachments(event);
    message.metadata = {
      ...(message.metadata || {}),
      mediaAttachments,
      attachmentPolicy: 'map-to-zavorth-artifacts',
    };

    const inboundHistory: ExternalAgentChannelHistoryEntry = {
      id: `external-history:${normalizeId(event.id, 'event')}:inbound`,
      sessionId: normalizeText(message.sessionId, `external:${normalizeId(event.sessionId, 'session')}`),
      role: 'user',
      channel: message.channel,
      text: message.text,
      createdAt: event.occurredAt,
      eventId: event.id,
      attachments: mediaAttachments,
    };
    this.history.push(inboundHistory);

    const result = await this.gateway.handle(message, options);
    const deliveries = await this.deliverReplies(result.replies);

    result.replies.forEach((reply) => {
      this.history.push({
        id: `external-history:${normalizeId(reply.id, 'reply')}:assistant`,
        sessionId: reply.runId ? result.run.sessionId : normalizeText(message.sessionId),
        runId: result.run.id,
        role: 'assistant',
        channel: reply.port.kind,
        text: reply.text,
        createdAt: reply.createdAt,
        replyPacketId: reply.id,
      });
    });

    return {
      message,
      result,
      mediaAttachments,
      deliveries,
      history: this.listSessionHistory(result.run.sessionId),
      channelHealth: await this.buildChannelHealthSnapshot(),
    };
  }

  public async deliverReplies(replies: UniversalReplyPacket[]): Promise<ExternalAgentDeliveryReceipt[]> {
    const receipts: ExternalAgentDeliveryReceipt[] = [];
    for (const reply of replies) {
      const channelId = `external-channel:${normalizeId(reply.port.id, 'channel')}`;
      const action: ExternalAgentOutboundActionEnvelope = {
        id: `external-reply-action:${normalizeId(reply.id, 'reply')}`,
        runtimeId: this.adapter.descriptor.id,
        sessionId: reply.metadata?.sessionId ? String(reply.metadata.sessionId) : null,
        requestedAt: this.now().toISOString(),
        kind: 'message',
        label: 'Zavorth reply pipeline delivery',
        risk: 'safe',
        dryRun: false,
        replyBoundary: 'zavorth-reply-port-only',
        payload: {
          text: reply.text,
          target: channelId,
          data: {
            replyPacketId: reply.id,
            runId: reply.runId,
            channel: reply.port.kind,
            traceId: reply.metadata?.traceId || null,
          },
        },
        approval: null,
      };
      const result = await this.adapter.dispatchControlledOutboundAction(action);
      const receipt: ExternalAgentDeliveryReceipt = {
        id: `external-delivery:${normalizeId(reply.id, 'reply')}`,
        actionId: action.id,
        replyPacketId: reply.id,
        runId: reply.runId,
        sessionId: normalizeText(action.sessionId, 'external-session'),
        channelId,
        status: replyStatusFromAction(result),
        deliveredAt: result.dispatchedAt,
        sourceReceiptId: result.receipt?.id,
        textDigest: textDigest(reply.text),
      };
      receipts.push(receipt);
      this.deliveries.push(receipt);
    }
    return receipts;
  }

  public listSessionHistory(sessionId: string): ExternalAgentChannelHistoryEntry[] {
    return this.history.filter((entry) => entry.sessionId === sessionId);
  }

  public listDeliveryReceipts(): ExternalAgentDeliveryReceipt[] {
    return this.deliveries.slice();
  }
}
