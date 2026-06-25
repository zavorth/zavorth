import type { ZavorthCapabilityUsageActionSummary } from './ZavorthCapabilityUsageSignalsContract.js';

export const ZAVORTH_CAPABILITY_LIFECYCLE_CONTRACT_VERSION = '2026-06-02.capability-lifecycle.v1' as const;

export type ZavorthCapabilityLifecycleDecisionKind = 'promote' | 'archive' | 'inspect' | 'keep';

export type ZavorthCapabilityLifecycleDecisionStatus = 'proposed' | 'applied' | 'skipped' | 'blocked';

export type ZavorthCapabilityLifecycleDecision = {
  id: string;
  at: string;
  actionId: string;
  capabilityId: string;
  title: string;
  kind: ZavorthCapabilityLifecycleDecisionKind;
  status: ZavorthCapabilityLifecycleDecisionStatus;
  reason: string;
  sourceRecommendation: ZavorthCapabilityUsageActionSummary['recommendation'];
  metrics: {
    events: number;
    previewRate: number;
    approvalRate: number;
    successRate: number;
    abandonmentRate: number;
    blockRate: number;
    p95Ms: number | null;
  };
  requiresApproval: boolean;
  reversible: true;
  nextSafeAction: string;
};

export type ZavorthCapabilityLifecycleReceipt = {
  id: string;
  at: string;
  actor: string;
  operation: 'capability-lifecycle-decision';
  status: 'applied' | 'skipped' | 'blocked';
  decisionId: string | null;
  actionId: string | null;
  summary: string;
};

export type ZavorthCapabilityLifecyclePreview = {
  generatedAt: string;
  selected: number;
  planned: number;
  skippedExisting: number;
  decisions: ZavorthCapabilityLifecycleDecision[];
  lines: string[];
  safety: {
    localOnly: true;
    noLiveActivation: true;
    noDeletion: true;
    approvalBoundaryPreserved: true;
  };
};

export type ZavorthCapabilityLifecycleSnapshot = {
  contractVersion: typeof ZAVORTH_CAPABILITY_LIFECYCLE_CONTRACT_VERSION;
  generatedAt: string;
  surface: 'capability-lifecycle';
  status: 'ready' | 'available' | 'attention';
  storeFile: string;
  summary: {
    decisions: number;
    applied: number;
    promoted: number;
    archived: number;
    inspect: number;
    keep: number;
    receipts: number;
  };
  decisions: ZavorthCapabilityLifecycleDecision[];
  receipts: ZavorthCapabilityLifecycleReceipt[];
  preview: ZavorthCapabilityLifecyclePreview;
  safety: {
    localOnly: true;
    usageSignalsOnly: true;
    noPromptContent: true;
    noSecrets: true;
    noNetworkUsed: true;
    noLiveActivation: true;
    noDeletion: true;
    reversibleReceipts: true;
  };
  commands: {
    status: string;
    preview: string;
    apply: string;
    json: string;
  };
};

export type ZavorthCapabilityLifecycleRunInput = {
  actionIds?: string[];
  apply?: boolean;
  actor?: string;
  approvalId?: string | null;
};
