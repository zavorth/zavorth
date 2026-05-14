import type { ComputerUseAction, ComputerUseAgent, ComputerUseSnapshot } from '../../agents/ComputerUseAgent.js';
import type { ZavorthMutationPlan } from '../../contracts/ZavorthMutationPlaneContract.js';
import type { TrustDecision } from '../TrustDecisionService.js';

export type WatchModeRunStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WatchModeApprovalStatus = 'pending' | 'approved' | 'rejected';
export type WatchModeApprovalDecision = 'approve' | 'reject';
export type WatchModeRiskLevel = 'low' | 'medium' | 'high';
export type WatchModeScreenshotRedactionMode = 'redacted' | 'metadata-only' | 'raw';
export type WatchModeSensitiveScreenPolicy = 'pause' | 'redact' | 'allow';
export type WatchModeTimelineType =
  | 'started'
  | 'screenshot'
  | 'planned'
  | 'approval_requested'
  | 'approval_decided'
  | 'executed'
  | 'paused'
  | 'resumed'
  | 'stopped'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WatchModeAllowlistStatus = {
  appConfigured: boolean;
  appMatched: boolean;
  siteConfigured: boolean;
  siteMatched: boolean;
  mode: 'guarded' | 'allowlisted';
};

export type WatchModeArtifactEntry = {
  artifactId: string;
  kind: 'screenshot';
  createdAt: string;
  expiresAt: string | null;
  iteration: number | null;
  screenshotPath: string;
  redactionMode: WatchModeScreenshotRedactionMode;
  sensitiveScreenPolicy: WatchModeSensitiveScreenPolicy;
  sensitive: boolean;
};

export type WatchModeRunBuffers = {
  timelineEntries: number;
  timelineLimit: number;
  artifactEntries: number;
  artifactLimit: number;
  screenshotThrottleMs: number;
  throttledScreenshots: number;
  droppedTimelineEntries: number;
  persistedArtifacts: number;
  approvalDecisions: number;
  averageApprovalLatencyMs: number;
  expiredArtifacts: number;
  deletedScreenshotBytes: number;
  activeVisualHandles: number;
};

export type WatchModeRunBudget = {
  maxIterations: number;
  maxDurationMs: number;
  maxScreenshots: number;
  maxMemoryMb: number;
  idleTtlMs: number;
  delayBetweenActionsMs: number;
  screenshotTtlMs: number;
  maxScreenshotBytes: number;
  screenshotRedactionMode: WatchModeScreenshotRedactionMode;
  sensitiveScreenPolicy: WatchModeSensitiveScreenPolicy;
};

export type WatchModeApproval = {
  approvalId: string;
  iteration: number;
  status: WatchModeApprovalStatus;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  note: string | null;
  action: ComputerUseAction;
  riskLevel: WatchModeRiskLevel;
  screenshotPath: string | null;
  screenshotRedactionMode: WatchModeScreenshotRedactionMode;
  sensitiveScreenPolicy: WatchModeSensitiveScreenPolicy;
};

export type WatchModeTimelineEntry = {
  entryId: string;
  type: WatchModeTimelineType;
  createdAt: string;
  summary: string;
  iteration: number | null;
  riskLevel: WatchModeRiskLevel | null;
  action: ComputerUseAction | null;
  result: string | null;
  screenshotPath: string | null;
  approvalId: string | null;
};

export type WatchModeRunSnapshot = {
  runId: string;
  status: WatchModeRunStatus;
  requestedBy: string | null;
  targetWindow: string;
  objective: string;
  siteUrl: string | null;
  strictApproval: boolean;
  budget: WatchModeRunBudget;
  allowlist: WatchModeAllowlistStatus;
  startedAt: string;
  finishedAt: string | null;
  updatedAt: string;
  latestScreenshotPath: string | null;
  pendingApprovalId: string | null;
  pendingApprovalCount: number;
  nextOperatorStep: string;
  lastError: string | null;
  buffers: WatchModeRunBuffers;
  agent: ComputerUseSnapshot | null;
  approvals: WatchModeApproval[];
  timeline: WatchModeTimelineEntry[];
  artifacts: WatchModeArtifactEntry[];
};

export type WatchModeSnapshot = {
  generatedAt: string;
  summary: {
    totalRuns: number;
    runningRuns: number;
    pausedRuns: number;
    waitingApprovalRuns: number;
    pendingApprovals: number;
    artifactEntries: number;
    throttledScreenshots: number;
    droppedTimelineEntries: number;
    averageApprovalLatencyMs: number;
    expiredArtifacts: number;
    deletedScreenshotBytes: number;
    activeVisualHandles: number;
    lastStatus: WatchModeRunStatus | 'idle';
  };
  policy: {
    strictApprovalDefault: boolean;
    allowedApps: string[];
    allowedSites: string[];
    screenshotTtlMs: number;
    maxScreenshotBytes: number;
    screenshotRedactionMode: WatchModeScreenshotRedactionMode;
    sensitiveScreenPolicy: WatchModeSensitiveScreenPolicy;
    defaultBudget: WatchModeRunBudget;
  };
  activeRun: WatchModeRunSnapshot | null;
  runs: WatchModeRunSnapshot[];
};

export type StartWatchModeRunInput = {
  targetWindow: string;
  objective: string;
  siteUrl?: string | null;
  requestedBy?: string | null;
  strictApproval?: boolean | null;
  maxIterations?: number | null;
  maxDurationMs?: number | null;
  maxScreenshots?: number | null;
  maxMemoryMb?: number | null;
  idleTtlMs?: number | null;
  screenshotTtlMs?: number | null;
  maxScreenshotBytes?: number | null;
  screenshotRedactionMode?: WatchModeScreenshotRedactionMode | string | null;
  sensitiveScreenPolicy?: WatchModeSensitiveScreenPolicy | string | null;
  delayBetweenActionsMs?: number | null;
  approvedPlanId?: string | null;
};

export type WatchModeMutationPreview = {
  generatedAt: string;
  status: 'waiting_approval' | 'blocked';
  ok: false;
  summary: string;
  mutationPlan: ZavorthMutationPlan;
  trustDecision: TrustDecision;
  snapshot: WatchModeSnapshot;
};

export type PendingApprovalWaiter = {
  resolve: (decision: WatchModeApprovalDecision) => void;
};

export type InternalWatchModeRun = {
  runId: string;
  status: WatchModeRunStatus;
  requestedBy: string | null;
  targetWindow: string;
  objective: string;
  siteUrl: string | null;
  strictApproval: boolean;
  budget: WatchModeRunBudget;
  allowlist: WatchModeAllowlistStatus;
  startedAt: string;
  finishedAt: string | null;
  updatedAt: string;
  latestScreenshotPath: string | null;
  pendingApprovalId: string | null;
  lastError: string | null;
  timeline: WatchModeTimelineEntry[];
  artifacts: WatchModeArtifactEntry[];
  buffers: {
    timelineLimit: number;
    artifactLimit: number;
    screenshotThrottleMs: number;
    throttledScreenshots: number;
    droppedTimelineEntries: number;
    persistedArtifacts: number;
    approvalLatencyTotalMs: number;
    approvalDecisions: number;
    expiredArtifacts: number;
    deletedScreenshotBytes: number;
    lastScreenshotTimelineAt: string | null;
  };
  approvals: WatchModeApproval[];
  agentSnapshot: ComputerUseSnapshot | null;
  activeAgent: ComputerUseAgent | null;
  waiterByApprovalId: Map<string, PendingApprovalWaiter>;
};

export type ComputerUseWatchModeState = {
  maxRuns: number;
  timelineLimit: number;
  artifactLimit: number;
  screenshotThrottleMs: number;
  runs: Map<string, InternalWatchModeRun>;
  runOrder: string[];
  strictApprovalDefault: boolean;
  allowedApps: string[];
  allowedSites: string[];
  defaultBudget: WatchModeRunBudget;
};
