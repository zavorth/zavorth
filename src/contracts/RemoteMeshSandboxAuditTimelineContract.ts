import type {
  RemoteExecutionReceipt,
  RemoteMeshJson,
  RemoteMeshRiskTier,
} from './RemoteMeshSandboxContract.js';
import type { RemoteMeshSandboxLiveActivationSnapshot } from './RemoteMeshSandboxLiveActivationContract.js';
import type {
  RemoteMeshLiveProbeExecutionStatus,
  RemoteMeshSandboxLiveProbeSnapshot,
} from './RemoteMeshSandboxLiveProbeContract.js';

export const ZAVORTH_REMOTE_MESH_SANDBOX_R6_AUDIT_TIMELINE_VERSION =
  '2026-05-05.remote-mesh-sandbox-r6-audit-timeline' as const;

export type RemoteMeshAuditTimelineStatus =
  | 'timeline-ready'
  | 'timeline-attention'
  | 'timeline-blocked';

export type RemoteMeshAuditTimelineEntryKind =
  | 'readiness-summary'
  | 'policy-evaluation'
  | 'adapter-binding'
  | 'activation-gate'
  | 'live-probe-guard'
  | 'live-probe-execution'
  | 'live-probe-result'
  | 'receipt'
  | 'operator-next-action';

export type RemoteMeshAuditTimelineEntryStatus =
  | 'passed'
  | 'waiting'
  | 'blocked'
  | 'planned'
  | 'allowed'
  | 'executed'
  | 'failed'
  | 'attention';

export type RemoteMeshAuditTimelineEntry = {
  id: string;
  sequence: number;
  at: string;
  phase: 'R0' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';
  kind: RemoteMeshAuditTimelineEntryKind;
  status: RemoteMeshAuditTimelineEntryStatus;
  title: string;
  evidence: string;
  cause: string;
  impact: string;
  safeNextAction: string;
  retryable: boolean;
  risk: RemoteMeshRiskTier | null;
  related: {
    actionId: string | null;
    decisionId: string | null;
    receiptId: string | null;
    sessionId: string | null;
    runId: string | null;
    traceId: string | null;
    nodeId: string | null;
    toolId: string | null;
  };
  sideEffects: {
    liveNetworkCallPerformed: boolean;
    remoteProcessSpawned: boolean;
    filesystemMutationPerformed: boolean;
    mutationPerformed: boolean;
    rawCommandSerialized: false;
    secretValuesSerialized: false;
  };
  payloadPreview: Record<string, RemoteMeshJson>;
};

export type RemoteMeshAuditTimelineIndexes = {
  byActionId: Record<string, string[]>;
  byDecisionId: Record<string, string[]>;
  byReceiptId: Record<string, string[]>;
  bySessionId: Record<string, string[]>;
  byRunId: Record<string, string[]>;
  byTraceId: Record<string, string[]>;
  byNodeId: Record<string, string[]>;
  byToolId: Record<string, string[]>;
  byStatus: Record<string, string[]>;
};

export type RemoteMeshAuditQuerySurface = {
  traceId: string | null;
  runId: string | null;
  sessionId: string | null;
  actionId: string | null;
  decisionId: string | null;
  nodeId: string | null;
  toolId: string | null;
  receiptIds: string[];
};

export type RemoteMeshSandboxAuditTimelineSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMOTE_MESH_SANDBOX_R6_AUDIT_TIMELINE_VERSION;
  phase: 'R6';
  status: RemoteMeshAuditTimelineStatus;
  summary: {
    entries: number;
    receipts: number;
    passed: number;
    waiting: number;
    blocked: number;
    attention: number;
    executed: number;
    failed: number;
    activationStatus: RemoteMeshSandboxLiveActivationSnapshot['status'];
    liveProbeStatus: RemoteMeshLiveProbeExecutionStatus;
    timelineHasExecutionReceipt: boolean;
    timelineHasOperatorNextAction: boolean;
    liveNetworkCallPerformed: boolean;
    remoteProcessSpawned: boolean;
    filesystemMutationPerformed: boolean;
    mutationPerformed: boolean;
    rawCommandSerialized: false;
    secretValuesSerialized: false;
  };
  source: {
    activationPhase: 'R4';
    liveProbePhase: 'R5';
    activationStatus: RemoteMeshSandboxLiveActivationSnapshot['status'];
    liveProbeStatus: RemoteMeshLiveProbeExecutionStatus;
  };
  query: RemoteMeshAuditQuerySurface;
  indexes: RemoteMeshAuditTimelineIndexes;
  timeline: RemoteMeshAuditTimelineEntry[];
  receipts: RemoteExecutionReceipt[];
  commands: {
    check: 'npm run remote-mesh:sandbox:audit-timeline --silent';
    focusedTests: 'npx jest tests/services/RemoteMeshSandboxAuditTimelineService.test.ts --runInBand';
    typecheck: 'npm run runtime:check --silent';
    nextStage: 'R7 - Scoped MCP Status Transport';
  };
};

export type RemoteMeshAuditTimelineSource = {
  liveProbeSnapshot: RemoteMeshSandboxLiveProbeSnapshot;
};
