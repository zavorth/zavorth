export const ZAVORTH_CAPABILITY_USAGE_SIGNALS_CONTRACT_VERSION = '2026-06-02.capability-usage-signals.v1' as const;

export type ZavorthCapabilityUsageEventKind =
  | 'shown'
  | 'looked_up'
  | 'previewed'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'succeeded'
  | 'failed'
  | 'blocked'
  | 'abandoned'
  | 'receipt_read';

export type ZavorthCapabilityUsageSurface = 'cli' | 'zavorthControl' | 'tui' | 'setup' | 'api' | 'channel' | 'llm';

export type ZavorthCapabilityUsageEvent = {
  id: string;
  at: string;
  actionId: string;
  capabilityId: string;
  kind: ZavorthCapabilityUsageEventKind;
  surface: ZavorthCapabilityUsageSurface;
  actor: string;
  status: 'ok' | 'attention' | 'blocked';
  durationMs: number | null;
  receiptId: string | null;
  metadata: Record<string, string>;
};

export type ZavorthCapabilityUsageActionSummary = {
  actionId: string;
  capabilityId: string;
  title: string;
  status: 'active' | 'quiet' | 'attention' | 'blocked';
  counters: {
    shown: number;
    lookedUp: number;
    previewed: number;
    approved: number;
    rejected: number;
    applied: number;
    succeeded: number;
    failed: number;
    blocked: number;
    abandoned: number;
    receiptRead: number;
  };
  rates: {
    previewRate: number;
    approvalRate: number;
    successRate: number;
    abandonmentRate: number;
    blockRate: number;
  };
  performance: {
    samples: number;
    p50Ms: number | null;
    p95Ms: number | null;
    maxMs: number | null;
  };
  lastSeenAt: string | null;
  recommendation: 'promote_candidate' | 'keep_learning' | 'needs_attention' | 'archive_candidate';
  nextSafeAction: string;
};

export type ZavorthCapabilityUsageSignalsSnapshot = {
  contractVersion: typeof ZAVORTH_CAPABILITY_USAGE_SIGNALS_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'capability-usage-signals';
  status: 'ready' | 'available' | 'attention';
  storeFile: string;
  summary: {
    actions: number;
    events: number;
    activeActions: number;
    attentionActions: number;
    promoteCandidates: number;
    archiveCandidates: number;
  };
  actions: ZavorthCapabilityUsageActionSummary[];
  recentEvents: ZavorthCapabilityUsageEvent[];
  safety: {
    localOnly: true;
    noPromptContent: true;
    noSecrets: true;
    noNetworkUsed: true;
    aggregatedForPromotion: true;
  };
  commands: {
    list: string;
    record: string;
    json: string;
    nextAction: string;
  };
};

export type ZavorthCapabilityUsageRecordInput = {
  actionId: string;
  capabilityId?: string;
  title?: string;
  kind: ZavorthCapabilityUsageEventKind;
  surface?: ZavorthCapabilityUsageSurface;
  actor?: string;
  status?: 'ok' | 'attention' | 'blocked';
  durationMs?: number | null;
  receiptId?: string | null;
  metadata?: Record<string, unknown>;
};
