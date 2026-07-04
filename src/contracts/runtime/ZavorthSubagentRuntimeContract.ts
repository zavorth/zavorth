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
  '2026-07-02.subagent-capability-acquisition' as const;

export type ZavorthSubagentRuntimeAction =
  | 'subagents.spawn'
  | 'subagents.spawn_batch'
  | 'subagents.wait'
  | 'subagents.send'
  | 'subagents.list'
  | 'subagents.cancel'
  | 'subagents.read'
  | 'subagents.summarize'
  | 'subagents.board.create'
  | 'subagents.board.claim'
  | 'subagents.board.heartbeat'
  | 'subagents.board.complete'
  | 'subagents.board.block'
  | 'subagents.device.list'
  | 'subagents.device.approve'
  | 'subagents.device.revoke'
  | 'subagents.config.update';

export type ZavorthSubagentRuntimeExecutionMode =
  | 'governed-in-process'
  | 'live-llm'
  | 'mock-live';

export type ZavorthSubagentRuntimeMode =
  | 'oneshot'
  | 'session'
  | 'thread-bound'
  | 'internal';

export type ZavorthSubagentRoleMode =
  | 'leaf'
  | 'orchestrator';

export type ZavorthSubagentSandboxBackendId =
  | 'local'
  | 'docker'
  | 'wsl'
  | 'daytona'
  | 'modal'
  | 'external';

export type ZavorthPairedDeviceStatus =
  | 'pending'
  | 'approved'
  | 'revoked'
  | 'blocked';

export type ZavorthSubagentBoardTaskStatus =
  | 'queued'
  | 'claimed'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ZavorthSubagentRuntimeStatus =
  | 'queued'
  | 'claimed'
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
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'approval-required';

export type ZavorthSubagentIconMotion = {
  active: boolean;
  kind:
    | 'none'
    | 'research-scan'
    | 'audit-border'
    | 'debug-cursor'
    | 'orchestrator-ring'
    | 'general-orbit'
    | 'mascot-sprite';
  frameCount: number;
  intervalMs: number;
  delayMs: number;
  className: string;
};

export type ZavorthSubagentActivityMode =
  | 'research'
  | 'audit'
  | 'debug'
  | 'orchestrate'
  | 'general'
  | 'core';

export type ZavorthSubagentIdentitySurface = {
  className: string;
  i18nKey: string;
  ariaLabel: string;
  title: string;
  statusToken: string;
  activityToken: string;
};

export type ZavorthSubagentVisualIdentity = {
  id: string;
  roleId: string;
  sessionId: string;
  label: string;
  displayName: string;
  identiconSeed: string;
  glyph: string;
  iconSvg: string;
  isMascot: boolean;
  activityMode: ZavorthSubagentActivityMode;
  status: ZavorthSubagentRuntimeStatus | 'idle';
  motionState: ZavorthSubagentMotionState;
  animationSeed: number;
  motion: ZavorthSubagentIconMotion;
  statusGlyph: string;
  surface: ZavorthSubagentIdentitySurface;
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
  roleMode: ZavorthSubagentRoleMode;
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
  roleMode: ZavorthSubagentRoleMode;
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
    | 'spawn_batch'
    | 'wait'
    | 'send'
    | 'list'
    | 'cancel'
    | 'read'
    | 'summarize'
    | 'worker'
    | 'board'
    | 'heartbeat'
    | 'config'
    | 'device'
    | 'approval'
    | 'denial'
    | 'policy';
  sessionId: string | null;
  runId: string | null;
  status: ZavorthSubagentRuntimeStatus;
  detail: string;
  receiptId: string | null;
};

export type ZavorthSubagentRuntimeWorkboardProjection = {
  selectedTaskId: string | null;
  selectedTask: {
    taskId: string;
    sessionId: string;
    parentTaskId: string | null;
    title: string;
    status: ZavorthSubagentBoardTaskStatus;
    risk: string;
    attempts: number;
    failureCount: number;
    maxRetries: number;
    claimedBy: string | null;
    claimedAt: string | null;
    heartbeatAt: string | null;
    heartbeatDeadlineAt: string | null;
    blockedReason: string | null;
    artifactRefs: string[];
    comments: Array<{
      id: string;
      author: string;
      body: string;
      createdAt: string;
    }>;
    summary: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  sessions: Array<{
    sessionId: string;
    objective: string;
    status: string;
    maxDepth: number;
    maxChildren: number;
  }>;
  tasks: Array<{
    taskId: string;
    sessionId: string;
    parentTaskId: string | null;
    title: string;
    status: ZavorthSubagentBoardTaskStatus;
    risk: string;
    attempts: number;
    failureCount: number;
    maxRetries: number;
    claimedBy: string | null;
    claimedAt: string | null;
    heartbeatAt: string | null;
    heartbeatDeadlineAt: string | null;
    blockedReason: string | null;
    artifactRefs: string[];
    comments: Array<{
      id: string;
      author: string;
      body: string;
      createdAt: string;
    }>;
    summary: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  workers: Array<{
    workerId: string;
    status: 'busy' | 'idle' | 'expired';
    currentTaskId: string | null;
  }>;
  receipts: Array<{
    receiptId: string;
    action: string;
    taskId: string | null;
    workerId: string | null;
    status: string;
  }>;
  summary: {
    sessions: number;
    queued: number;
    running: number;
    completed: number;
    blocked: number;
  };
  safety: {
    sqliteDurable: true;
    mutationRequiresApproval: true;
    retryBounded: true;
    spawnDepthBounded: true;
  };
};

export type ZavorthSubagentDynamicConfigSettings = {
  maxConcurrentChildren: number;
  maxSpawnDepth: number;
  childTimeoutMs: number;
  defaultRoleMode: ZavorthSubagentRoleMode;
  sandboxBackend: ZavorthSubagentSandboxBackendId;
  cloudSandboxEnabled: boolean;
  inheritToolsets: boolean;
  boardDispatcherEnabled: boolean;
  approvalMode: 'explicit' | 'policy';
};

export type ZavorthSubagentRuntimeDynamicConfigProjection = {
  settings: ZavorthSubagentDynamicConfigSettings;
  updatedAt: string;
  updatedBy: string | null;
  receiptId: string | null;
  auditReceipts: Array<{
    receiptId: string;
    status: string;
    summary: string;
  }>;
};

export type ZavorthSubagentRuntimeSandboxProjection = {
  contractVersion: 'zavorth-subagent-sandbox/1';
  selectedBackend: ZavorthSubagentSandboxBackendId;
  backends: Array<{
    id: ZavorthSubagentSandboxBackendId;
    status: 'disabled' | 'missing-config' | 'doctor-only' | 'live-disabled' | 'ready' | 'blocked';
    remote: boolean;
    strongIsolation: boolean;
    enabled: boolean;
    liveReady: boolean;
  }>;
  safety: {
    cloudAdaptersDisabledByDefault: true;
    liveIoRequiresApproval: true;
    secretsNeverSerialized: true;
    ttlAndCostCapsRequired: true;
  };
};

export type ZavorthSubagentRuntimePairedDevicesProjection = {
  contractVersion: 'zavorth-subagent-devices/1';
  devices: Array<{
    deviceId: string;
    label: string;
    status: ZavorthPairedDeviceStatus;
    transport: 'mock' | 'pwa' | 'desktop-companion' | 'ios' | 'android' | 'external';
    capabilities: string[];
    approvedCapabilities: string[];
    sensitiveCapabilitiesRequireApproval: true;
    lastSeenAt: string | null;
    trust: {
      publicKeyFingerprint: string | null;
      approvalId: string | null;
      revokedReason: string | null;
    };
  }>;
  summary: {
    total: number;
    approved: number;
    pending: number;
    revoked: number;
    blocked: number;
    invokable: number;
  };
  policy: {
    approvedCapabilityAllowlistRequired: true;
    heartbeatBeforeAssignment: true;
    noSecretsSerialized: true;
  };
};

export type ZavorthSubagentRuntimeObservabilityEvent = {
  id: string;
  generatedAt: string;
  name:
    | 'subagent.created'
    | 'subagent.started'
    | 'subagent.heartbeat'
    | 'subagent.completed'
    | 'subagent.failed'
    | 'subagent.blocked'
    | 'subagent.cancelled'
    | 'subagent.approval_required';
  taskId: string | null;
  parentSessionId: string | null;
  childSessionId: string | null;
  parentRunId: string | null;
  childRunId: string | null;
  subagentId: string | null;
  roleId: string | null;
  motionState: ZavorthSubagentMotionState;
  identity?: ZavorthSubagentVisualIdentity | null;
  receiptId: string | null;
  policyDecisionId: string | null;
  sandboxBackend: ZavorthSubagentSandboxBackendId;
  status: ZavorthSubagentRuntimeStatus;
  detail: string;
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
    batchRuns: number;
  };
  autoInvocationTelemetry: {
    latest: ZavorthSubagentAutoInvocationTelemetry | null;
    decisions: ZavorthSubagentAutoInvocationTelemetry[];
    dashboardProjection: {
      available: boolean;
      title: string;
      summary: string;
      selectedBy: string;
      roles: string[];
      triggers: string[];
      riskSignals: string[];
      nextSafeAction: string;
    };
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
    leafSubagentsCannotDelegate: true;
    orchestratorSubagentsCanDelegateWithinLimits: true;
    receiptsRequired: true;
    noSecretValuesSerialized: true;
  };
  workboard: ZavorthSubagentRuntimeWorkboardProjection;
  dynamicConfig: ZavorthSubagentRuntimeDynamicConfigProjection;
  sandbox: ZavorthSubagentRuntimeSandboxProjection;
  pairedDevices: ZavorthSubagentRuntimePairedDevicesProjection;
  observability: {
    events: ZavorthSubagentRuntimeObservabilityEvent[];
    summary: {
      total: number;
      running: number;
      completed: number;
      blocked: number;
      approvalRequired: number;
    };
  };
  receipts: ZavorthInvocationReceipt[];
  commands: {
    spawn: 'npm run zavorth:subagents -- spawn --task "<task>"';
    spawnBatch: 'npm run zavorth:subagents -- spawn-batch --tasks tasks.json';
    spawnLive: 'npm run zavorth:subagents -- spawn --live --task "<task>"';
    board: 'npm run zavorth:subagents -- board status';
    devices: 'npm run zavorth:subagents -- devices list';
    config: 'npm run zavorth:subagents -- config set maxConcurrentChildren 4';
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
