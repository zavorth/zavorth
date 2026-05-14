import type {
  SalesChannelPlatform,
  SalesPackConversationResult,
  SalesPackMode,
} from './SalesPackContract.js';

export const ZAVORTH_SALES_PACK_CHANNEL_IO_CONTRACT_VERSION = '2026-05-09.sales-pack-channel-io' as const;

export type SalesPackChannelIoProvider = 'local-stub' | 'whatsapp-cloud-api' | 'generic-webhook';

export type SalesPackChannelIoEventKind =
  | 'inbound.normalized'
  | 'inbound.processed'
  | 'inbound.duplicate'
  | 'inbound.rejected'
  | 'delivery.status.received';

export type SalesPackChannelIoEnvelope = {
  tenantId?: string | null;
  channelAccountId?: string | null;
  platform?: SalesChannelPlatform | null;
  provider?: SalesPackChannelIoProvider | null;
  providerMessageId?: string | null;
  customerId?: string | null;
  conversationId?: string | null;
  actorId?: string | null;
  text?: string | null;
  traceId?: string | null;
  runId?: string | null;
  receivedAt?: string | null;
  headers?: Record<string, string | string[] | undefined> | null;
  rawBody?: string | null;
  body?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type SalesPackChannelIoNormalizedMessage = {
  tenantId: string;
  channelAccountId: string;
  platform: SalesChannelPlatform;
  provider: SalesPackChannelIoProvider;
  providerMessageId: string | null;
  customerId: string;
  conversationId: string | null;
  actorId: string;
  text: string;
  traceId: string;
  runId: string | null;
  receivedAt: string;
  metadata: Record<string, unknown>;
};

export type SalesPackChannelIoEvent = {
  id: string;
  kind: SalesPackChannelIoEventKind;
  createdAt: string;
  traceId: string;
  tenantId: string;
  channelAccountId: string;
  providerMessageId: string | null;
  platform: SalesChannelPlatform | null;
  provider: SalesPackChannelIoProvider | null;
  summary: string;
  metadata: Record<string, unknown>;
};

export type SalesPackChannelIoReceiveResult = {
  ok: boolean;
  status: 'processed' | 'duplicate' | 'rejected' | 'status_only';
  traceId: string;
  message: SalesPackChannelIoNormalizedMessage | null;
  conversationResult: SalesPackConversationResult | null;
  event: SalesPackChannelIoEvent;
};

export type SalesPackChannelIoSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SALES_PACK_CHANNEL_IO_CONTRACT_VERSION;
  mode: SalesPackMode;
  summary: {
    inboundReceived: number;
    processed: number;
    duplicates: number;
    rejected: number;
    statusOnly: number;
    knownMessageIds: number;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
  actions: Array<{
    id: string;
    label: string;
    severity: 'info' | 'warn' | 'critical';
    command: string | null;
  }>;
  sourceSnapshots: {
    recentEvents: SalesPackChannelIoEvent[];
  };
};
