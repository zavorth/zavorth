import type { SecurityPolicyBrokerReceipt } from '../../security/SecurityPolicyBroker.js';
import type { SubagentResultReceipt } from '../../runtime/agent/subagents/index.js';
import type {
  ZavorthSubagentAutoInvocationTelemetry,
} from './ZavorthSubagentAutoInvocationContract.js';
import type {
  ZavorthGovernedSubagentProfile,
  ZavorthGovernedSubagentProfileId,
} from './ZavorthGovernedSubagentContract.js';
import type { ZavorthInvocationReceipt } from './ZavorthInvocationReceiptContract.js';

export const ZAVORTH_SUBAGENT_RUNTIME_CONTRACT_VERSION =
  '2026-05-10.subagent-runtime-consistency-checkpoint-4' as const;

export type ZavorthSubagentRuntimeAction =
  | 'subagents.spawn'
  | 'subagents.wait'
  | 'subagents.send'
  | 'subagents.list'
  | 'subagents.cancel'
  | 'subagents.read'
  | 'subagents.summarize';

export type ZavorthSubagentRuntimeExecutionMode =
  | 'governed-in-process'
  | 'live-llm'
  | 'mock-live';

export type ZavorthSubagentRuntimeMode =
  | 'oneshot'
  | 'session'
  | 'thread-bound'
  | 'internal';

export type ZavorthSubagentRuntimeStatus =
  | 'ready'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'approval-required'
  | 'denied'
  | 'blocked'
  | 'not-found';

export type ZavorthSubagentMotionState =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'approval-required';

export type ZavorthSubagentVisualIdentity = {
  id: string;
  roleId: string;
  sessionId: string;
  label: string;
  displayName: string;
  glyph: string;
  status: ZavorthSubagentRuntimeStatus | 'idle';
  motionState: ZavorthSubagentMotionState;
  animationSeed: number;
  palette: {
    accent: string;
    muted: string;
    glow: string;
  };
  iconFrames: string[];
};

export type ZavorthSubagentRuntimeLimits = {
  maxWallClockMs: number;
  maxPromptChars: number;
  maxOutputChars: number;
  maxToolCalls: number;
  maxFileReads: number;
  maxFileWrites: number;
  maxNetworkCalls: number;
  maxCostUsd: number;
  maxSpawnDepth: number;
  maxChildren: number;
};

export type ZavorthSubagentRuntimeMessage = {
  id: string;
  generatedAt: string;
  role: 'user' | 'subagent' | 'system';
  text: string;
  receiptId: string | null;
};

export type ZavorthSubagentRuntimeWorkerResult = {
  workerId: string;
  roleId: ZavorthGovernedSubagentProfileId;
  status: 'completed' | 'failed';
  backend: string;
  startedAt: string;
  completedAt: string;
  providerName: string | null;
  modelName: string | null;
  summary: string;
  output: string;
  error: string | null;
  receiptId: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export type ZavorthSubagentRuntimeRun = {
  runId: string;
  sessionId: string;
  parentRunId: string | null;
  mode: ZavorthSubagentRuntimeMode;
  executionMode: ZavorthSubagentRuntimeExecutionMode;
  sourceSurface: 'task' | 'channel' | 'cron' | 'skill' | 'plugin' | 'internal';
  roleIds: ZavorthGovernedSubagentProfileId[];
  task: string;
  status: ZavorthSubagentRuntimeStatus;
  startedAt: string;
  completedAt: string | null;
  summary: string | null;
  output: string | null;
  policyReceipt: SecurityPolicyBrokerReceipt;
  subagentReceipts: SubagentResultReceipt[];
  workerResults: ZavorthSubagentRuntimeWorkerResult[];
  invocationReceiptId: string;
  autoInvocation: ZavorthSubagentAutoInvocationTelemetry | null;
};

export type ZavorthSubagentRuntimeSession = {
  sessionId: string;
  mode: ZavorthSubagentRuntimeMode;
  executionMode: ZavorthSubagentRuntimeExecutionMode;
  sourceSurface: 'task' | 'channel' | 'cron' | 'skill' | 'plugin' | 'internal';
  channel: string;
  actorId: string | null;
  threadId: string | null;
  status: ZavorthSubagentRuntimeStatus;
  createdAt: string;
  updatedAt: string;
  roleIds: ZavorthGovernedSubagentProfileId[];
  profileSummaries: Array<Pick<ZavorthGovernedSubagentProfile, 'id' | 'label' | 'objective'> & {
    identity?: ZavorthSubagentVisualIdentity;
  }>;
  messages: ZavorthSubagentRuntimeMessage[];
  runIds: string[];
};

export type ZavorthSubagentRuntimeTimelineEvent = {
  id: string;
  generatedAt: string;
  kind:
    | 'spawn'
    | 'wait'
    | 'send'
    | 'list'
    | 'cancel'
    | 'read'
    | 'summarize'
    | 'worker'
    | 'approval'
    | 'denial'
    | 'policy';
  sessionId: string | null;
  runId: string | null;
  status: ZavorthSubagentRuntimeStatus;
  detail: string;
  receiptId: string | null;
};

export type ZavorthSubagentRuntimeSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SUBAGENT_RUNTIME_CONTRACT_VERSION;
  source: 'ZavorthSubagentRuntimeService';
  action: ZavorthSubagentRuntimeAction;
  status: ZavorthSubagentRuntimeStatus;
  projectRoot: string;
  mode: ZavorthSubagentRuntimeMode;
  selectedSessionId: string | null;
  selectedRunId: string | null;
  sessions: ZavorthSubagentRuntimeSession[];
  runs: ZavorthSubagentRuntimeRun[];
  timeline: ZavorthSubagentRuntimeTimelineEvent[];
  parentChildTree: Array<{
    runId: string;
    parentRunId: string | null;
    childRunIds: string[];
    depth: number;
  }>;
  summary: {
    sessions: number;
    activeSessions: number;
    runs: number;
    runningRuns: number;
    completedRuns: number;
    approvalRequiredRuns: number;
    deniedRuns: number;
    policyReceipts: number;
    subagentReceipts: number;
    workerResults: number;
    failedWorkerResults: number;
    liveRuns: number;
    invocationReceipts: number;
    workspaceMutationPerformed: boolean;
    externalIoPerformed: boolean;
    upstreamRuntimeCodeExecuted: boolean;
    autoInvocationDecisions: number;
  };
  autoInvocationTelemetry: {
    latest: ZavorthSubagentAutoInvocationTelemetry | null;
    decisions: ZavorthSubagentAutoInvocationTelemetry[];
    zavorthControlProjection: {
      available: boolean;
      title: string;
      summary: string;
      selectedBy: string;
      roles: string[];
      triggers: string[];
      riskSignals: string[];
      nextSafeAction: string;
    };
  };
  limits: ZavorthSubagentRuntimeLimits;
  policy: {
    explicitUserSubagentsCanRunReadOnly: true;
    internalReadOnlyCanRunAutomatically: true;
    writesRequirePolicyBrokerApproval: true;
    sensitiveNetworkRequiresApproval: true;
    liveExternalIoRequiresApproval: true;
    providerLlmCallsUseEgressGuard: true;
    readOnlyToolsRequirePolicyBroker: true;
    mutatingToolsRequireApproval: true;
    subagentToolCallsAreLimited: true;
    liveWorkersAreConcurrent: true;
    spawnDepthLimited: true;
    childCountLimited: true;
    receiptsRequired: true;
    noSecretValuesSerialized: true;
  };
  receipts: ZavorthInvocationReceipt[];
  commands: {
    spawn: 'npm run zavorth:subagents -- spawn --task "<task>"';
    spawnLive: 'npm run zavorth:subagents -- spawn --live --task "<task>"';
    wait: 'npm run zavorth:subagents -- wait --session <id>';
    send: 'npm run zavorth:subagents -- send --session <id> --message "<text>"';
    list: 'npm run zavorth:subagents -- list';
    cancel: 'npm run zavorth:subagents -- cancel --session <id>';
    read: 'npm run zavorth:subagents -- read --session <id>';
    summarize: 'npm run zavorth:subagents -- summarize --session <id>';
    surface: '/agents spawn --live <task>';
    check: 'npm run zavorth:subagents:check --silent';
    nextStage: 'Live runtime is wired; next expand UI projection only with approval.';
  };
};
