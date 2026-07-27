import crypto from 'crypto';
import type {
  ZavorthSubagentDynamicConfigSettings,
  ZavorthSubagentRoleMode,
  ZavorthSubagentRuntimeAction,
  ZavorthSubagentRuntimeDynamicConfigProjection,
  ZavorthSubagentRuntimeExecutionMode,
  ZavorthSubagentRuntimeLimits,
  ZavorthSubagentRuntimeMessage,
  ZavorthSubagentRuntimeMode,
  ZavorthSubagentRuntimeObservabilityEvent,
  ZavorthSubagentRuntimePairedDevicesProjection,
  ZavorthSubagentRuntimeRun,
  ZavorthSubagentRuntimeSandboxProjection,
  ZavorthSubagentRuntimeSession,
  ZavorthSubagentRuntimeSnapshot,
  ZavorthSubagentRuntimeStatus,
  ZavorthSubagentRuntimeTimelineEvent,
  ZavorthSubagentRuntimeWorkboardProjection,
  ZavorthSubagentSandboxBackendId,
} from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';
import type { ZavorthInvocationReceipt } from '../contracts/runtime/ZavorthInvocationReceiptContract.js';
import type { ZavorthSubagentAutoInvocationTelemetry } from '../contracts/runtime/ZavorthSubagentAutoInvocationContract.js';
import type { SecurityPolicyBrokerRequest } from '../security/SecurityPolicyBroker.js';
import type {
  ZavorthSubagentBoardSnapshot,
  ZavorthSubagentBoardTask,
} from '../services/ZavorthSubagentBoardService.js';
import type { ZavorthSubagentRuntimeCommandInput } from './ZavorthSubagentRuntimeService.js';

export type StoredState = {
  sessions: ZavorthSubagentRuntimeSession[];
  runs: ZavorthSubagentRuntimeRun[];
  timeline: ZavorthSubagentRuntimeTimelineEvent[];
  receipts: ZavorthInvocationReceipt[];
  autoInvocationDecisions: ZavorthSubagentAutoInvocationTelemetry[];
  dynamicConfig: ZavorthSubagentRuntimeDynamicConfigProjection;
  pairedDevices: ZavorthSubagentRuntimePairedDevicesProjection['devices'];
  observabilityEvents: ZavorthSubagentRuntimeObservabilityEvent[];
  batchRuns: number;
};

export const DEFAULT_LIMITS: ZavorthSubagentRuntimeLimits = {
  maxWallClockMs: 240000,
  maxPromptChars: 64000,
  maxOutputChars: 36000,
  maxToolCalls: 8,
  maxFileReads: 120,
  maxFileWrites: 0,
  maxNetworkCalls: 4,
  maxCostUsd: 0.25,
  maxSpawnDepth: 2,
  maxChildren: 8,
};

export const DEFAULT_DYNAMIC_CONFIG: ZavorthSubagentDynamicConfigSettings = {
  maxConcurrentChildren: 8,
  maxSpawnDepth: 2,
  childTimeoutMs: 240000,
  defaultRoleMode: 'leaf',
  sandboxBackend: 'local',
  cloudSandboxEnabled: false,
  inheritToolsets: false,
  boardDispatcherEnabled: true,
  approvalMode: 'policy',
};

export type RuntimeRisk = {
  surface: SecurityPolicyBrokerRequest['surface'];
  brokerRisk: 'safe' | 'review' | 'dangerous' | 'forbidden';
  receiptRisk: 'safe' | 'review' | 'dangerous' | 'forbidden';
  requiresApproval: boolean;
  reason: string;
  reasons: string[];
};

export type ClassifyRiskOptions = {
  /** Structured risk signals from tools/API — preferred over free-text task text. */
  riskHints?: Partial<RuntimeRisk> | null;
};

/**
 * Classify subagent runtime risk without free-text keyword routing.
 * Prefer structured `options.riskHints` / mode. Free-text alone never unlocks
 * mutation/live paths; non-internal modes require approval when hints are absent.
 */
export function classifyRisk(
  task: string,
  mode: ZavorthSubagentRuntimeMode,
  options?: ClassifyRiskOptions,
): RuntimeRisk {
  const hints = options?.riskHints || null;

  if (hints) {
    const base = mode === 'internal' ? internalReadOnlyRisk() : unstructuredRequiresApprovalRisk();
    return {
      surface: hints.surface || base.surface,
      brokerRisk: hints.brokerRisk || base.brokerRisk,
      receiptRisk: hints.receiptRisk || base.receiptRisk,
      requiresApproval: typeof hints.requiresApproval === 'boolean' ? hints.requiresApproval : base.requiresApproval,
      reason: hints.reason || base.reason,
      reasons: Array.isArray(hints.reasons) && hints.reasons.length > 0 ? hints.reasons : base.reasons,
    };
  }

  // Internal / governed read-only surfaces stay safe without keyword scans.
  if (mode === 'internal') {
    return internalReadOnlyRisk();
  }

  // Free-text task with no structured riskHints: never keyword-route risk.
  // Safer default — unstructured non-internal work requires approval.
  void task;
  return unstructuredRequiresApprovalRisk();
}

function internalReadOnlyRisk(): RuntimeRisk {
  return {
    surface: 'skill',
    brokerRisk: 'safe',
    receiptRisk: 'safe',
    requiresApproval: false,
    reason: 'Read-only subagent task can run in governed runtime.',
    reasons: ['read-only-subagent-precleared'],
  };
}

function unstructuredRequiresApprovalRisk(): RuntimeRisk {
  return {
    surface: 'workspace',
    brokerRisk: 'review',
    receiptRisk: 'review',
    requiresApproval: true,
    reason: 'Unstructured task requires approval (no free-text risk keyword routing).',
    reasons: ['unstructured-task-requires-approval'],
  };
}

export function buildPolicyReasons(input: {
  risk: RuntimeRisk;
  requestedExplicitly: boolean;
  explicitRequired: boolean;
  approvalRequired: boolean;
  blockedByDepth: boolean;
  blockedByLeafRole: boolean;
  depth: number;
  childCount: number;
}): string[] {
  const reasons = ['Subagent runtime spawn evaluated by central Policy Broker.', input.risk.reason];
  if (input.requestedExplicitly) {
    reasons.push('User explicitly requested subagents; read-only launch can proceed without extra approval.');
  }
  if (input.explicitRequired) {
    reasons.push('Subagent launch denied because the request did not explicitly ask for subagents.');
  }
  if (input.approvalRequired) {
    reasons.push('Approval id is required before writes, sensitive network, commands or live I/O.');
  }
  if (input.blockedByDepth) {
    reasons.push(`Spawn depth or child limit exceeded: depth=${input.depth}, children=${input.childCount}.`);
  }
  if (input.blockedByLeafRole) {
    reasons.push('Leaf subagents cannot delegate child subagents.');
  }
  return reasons;
}

export function buildRuntimeOutput(task: string, roleIds: string[], mode: ZavorthSubagentRuntimeMode): string {
  return [
    `Governed ${mode} subagent result.`,
    `Task: ${firstLine(task)}`,
    `Roles: ${roleIds.join(', ') || 'planner'}.`,
    'Execution boundary: in-process, receipt-backed, no workspace mutation, no external I/O, no upstream code execution.',
  ].join('\n');
}

export function summarizeMessages(messages: ZavorthSubagentRuntimeMessage[]): string {
  const userMessages = messages.filter((message) => message.role === 'user').length;
  const subagentMessages = messages.filter((message) => message.role === 'subagent').length;
  const lastText = messages.at(-1)?.text || 'No messages.';
  return `Subagent session summary: userMessages=${userMessages}, subagentMessages=${subagentMessages}. Last: ${firstLine(lastText)}`;
}

export function buildTree(runs: ZavorthSubagentRuntimeRun[]): ZavorthSubagentRuntimeSnapshot['parentChildTree'] {
  return runs.map((run) => ({
    runId: run.runId,
    parentRunId: run.parentRunId,
    childRunIds: runs.filter((candidate) => candidate.parentRunId === run.runId).map((candidate) => candidate.runId),
    depth: resolveDepthFromRuns(runs, run.runId),
  }));
}

export function resolveDepthFromRuns(runs: ZavorthSubagentRuntimeRun[], runId: string): number {
  let depth = 0;
  let current = runs.find((run) => run.runId === runId)?.parentRunId || null;
  while (current) {
    depth += 1;
    current = runs.find((run) => run.runId === current)?.parentRunId || null;
    if (depth > 20) {
      return depth;
    }
  }
  return depth;
}

export function emptyState(): StoredState {
  return {
    sessions: [],
    runs: [],
    timeline: [],
    receipts: [],
    autoInvocationDecisions: [],
    dynamicConfig: defaultDynamicConfigProjection(),
    pairedDevices: [],
    observabilityEvents: [],
    batchRuns: 0,
  };
}

export function normalizeAction(value: unknown): ZavorthSubagentRuntimeAction {
  const normalized = String(value || 'subagents.list')
    .trim()
    .toLowerCase();
  if (
    normalized === 'spawn' ||
    normalized === 'subagents.spawn' ||
    normalized === 'subagent.spawn' ||
    normalized === 'subagent' ||
    normalized === 'sessions_spawn' ||
    normalized === 'sessions.spawn'
  )
    return 'subagents.spawn';
  if (normalized === 'spawn-batch' || normalized === 'spawn_batch' || normalized === 'subagents.spawn_batch')
    return 'subagents.spawn_batch';
  if (normalized === 'wait' || normalized === 'subagents.wait') return 'subagents.wait';
  if (normalized === 'send' || normalized === 'subagents.send') return 'subagents.send';
  if (normalized === 'cancel' || normalized === 'subagents.cancel') return 'subagents.cancel';
  if (normalized === 'read' || normalized === 'subagents.read') return 'subagents.read';
  if (normalized === 'summarize' || normalized === 'summary' || normalized === 'subagents.summarize')
    return 'subagents.summarize';
  if (normalized === 'board.create' || normalized === 'subagents.board.create') return 'subagents.board.create';
  if (normalized === 'board.claim' || normalized === 'subagents.board.claim') return 'subagents.board.claim';
  if (normalized === 'board.heartbeat' || normalized === 'subagents.board.heartbeat')
    return 'subagents.board.heartbeat';
  if (normalized === 'board.complete' || normalized === 'subagents.board.complete') return 'subagents.board.complete';
  if (normalized === 'board.block' || normalized === 'subagents.board.block') return 'subagents.board.block';
  if (normalized === 'device.list' || normalized === 'devices.list' || normalized === 'subagents.device.list')
    return 'subagents.device.list';
  if (normalized === 'device.approve' || normalized === 'devices.approve' || normalized === 'subagents.device.approve')
    return 'subagents.device.approve';
  if (normalized === 'device.revoke' || normalized === 'devices.revoke' || normalized === 'subagents.device.revoke')
    return 'subagents.device.revoke';
  if (normalized === 'config.update' || normalized === 'subagents.config.update') return 'subagents.config.update';
  return 'subagents.list';
}

export function resolveExecutionMode(
  input: Partial<Pick<ZavorthSubagentRuntimeCommandInput, 'executionMode' | 'live' | 'dryLive'>>,
  fallback?: ZavorthSubagentRuntimeExecutionMode | string | null,
): ZavorthSubagentRuntimeExecutionMode {
  const explicit = String(input.executionMode || '')
    .trim()
    .toLowerCase();
  if (explicit === 'dry-live' || input.dryLive === true) return 'dry-live';
  if (explicit === 'live-llm' || explicit === 'live' || input.live === true) return 'live-llm';
  if (explicit === 'governed-in-process' || explicit === 'in-process' || explicit === 'plan')
    return 'governed-in-process';
  const inherited = String(fallback || '')
    .trim()
    .toLowerCase();
  if (inherited === 'dry-live') return 'dry-live';
  if (inherited === 'live-llm') return 'live-llm';
  return 'governed-in-process';
}

export function normalizeSourceSurface(
  value: unknown,
  mode: ZavorthSubagentRuntimeMode,
): 'task' | 'channel' | 'cron' | 'skill' | 'plugin' | 'internal' {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'channel') return 'channel';
  if (normalized === 'cron' || normalized === 'automation' || normalized === 'schedule') return 'cron';
  if (normalized === 'skill') return 'skill';
  if (normalized === 'plugin') return 'plugin';
  if (normalized === 'internal' || mode === 'internal') return 'internal';
  return 'task';
}

export function normalizeMode(value: unknown): ZavorthSubagentRuntimeMode {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'session') return 'session';
  if (normalized === 'thread-bound' || normalized === 'thread') return 'thread-bound';
  if (normalized === 'internal') return 'internal';
  return 'oneshot';
}

export function normalizeRoleMode(value: unknown, fallback: ZavorthSubagentRoleMode = 'leaf'): ZavorthSubagentRoleMode {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'orchestrator') return 'orchestrator';
  if (normalized === 'leaf') return 'leaf';
  return fallback;
}

export function normalizeSandboxBackend(
  value: unknown,
  fallback: ZavorthSubagentSandboxBackendId = 'local',
): ZavorthSubagentSandboxBackendId {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (
    normalized === 'local' ||
    normalized === 'docker' ||
    normalized === 'wsl' ||
    normalized === 'daytona' ||
    normalized === 'modal' ||
    normalized === 'external'
  ) {
    return normalized;
  }
  return fallback;
}

export function normalizeDynamicConfig(
  value: Partial<ZavorthSubagentDynamicConfigSettings>,
): ZavorthSubagentDynamicConfigSettings {
  return {
    maxConcurrentChildren: clampInt(value.maxConcurrentChildren, 1, 64, DEFAULT_DYNAMIC_CONFIG.maxConcurrentChildren),
    maxSpawnDepth: clampInt(value.maxSpawnDepth, 0, 8, DEFAULT_DYNAMIC_CONFIG.maxSpawnDepth),
    childTimeoutMs: clampInt(value.childTimeoutMs, 1000, 24 * 60 * 60 * 1000, DEFAULT_DYNAMIC_CONFIG.childTimeoutMs),
    defaultRoleMode: normalizeRoleMode(value.defaultRoleMode, DEFAULT_DYNAMIC_CONFIG.defaultRoleMode),
    sandboxBackend: normalizeSandboxBackend(value.sandboxBackend, DEFAULT_DYNAMIC_CONFIG.sandboxBackend),
    cloudSandboxEnabled: value.cloudSandboxEnabled === true,
    inheritToolsets: value.inheritToolsets === true,
    boardDispatcherEnabled: value.boardDispatcherEnabled !== false,
    approvalMode: value.approvalMode === 'explicit' ? 'explicit' : 'policy',
  };
}

export function defaultDynamicConfigProjection(): ZavorthSubagentRuntimeDynamicConfigProjection {
  return {
    settings: { ...DEFAULT_DYNAMIC_CONFIG },
    updatedAt: new Date(0).toISOString(),
    updatedBy: null,
    receiptId: null,
    auditReceipts: [],
  };
}

export function coerceDynamicConfigProjection(value: unknown): ZavorthSubagentRuntimeDynamicConfigProjection {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<ZavorthSubagentRuntimeDynamicConfigProjection>)
      : null;
  if (!raw) return defaultDynamicConfigProjection();
  return {
    settings: normalizeDynamicConfig({
      ...DEFAULT_DYNAMIC_CONFIG,
      ...(raw.settings || {}),
    }),
    updatedAt: normalizeText(raw.updatedAt, new Date(0).toISOString()),
    updatedBy: normalizeNullable(raw.updatedBy),
    receiptId: normalizeNullable(raw.receiptId),
    auditReceipts: Array.isArray(raw.auditReceipts)
      ? raw.auditReceipts
          .map((receipt) => ({
            receiptId: normalizeText((receipt as { receiptId?: unknown }).receiptId, 'receipt'),
            status: normalizeText((receipt as { status?: unknown }).status, 'applied'),
            summary: normalizeText((receipt as { summary?: unknown }).summary, 'Configuration receipt.'),
          }))
          .slice(0, 25)
      : [],
  };
}

export function normalizeTasks(tasks: unknown, fallback: unknown): string[] {
  const values = Array.isArray(tasks) ? tasks.map((task) => normalizeText(task)) : [];
  if (values.filter(Boolean).length > 0) {
    return values.filter(Boolean).slice(0, 32);
  }
  return [normalizeText(fallback, 'Inspect runtime state safely.')];
}

export function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
        .slice(0, 100)
    : [];
}

export function mapBoardRisk(
  risk: RuntimeRisk,
): 'read-only' | 'mutation' | 'shell' | 'network-sensitive' | 'external-io' {
  if (risk.reasons.includes('workspace-mutation-or-command-requires-approval')) return 'mutation';
  if (risk.reasons.includes('unstructured-task-requires-approval')) return 'mutation';
  if (risk.reasons.includes('sensitive-network-read-requires-approval')) return 'network-sensitive';
  if (risk.reasons.includes('live-external-io-requires-approval')) return 'external-io';
  if (risk.requiresApproval) return 'mutation';
  return 'read-only';
}

export function mapWorkboardTask(
  task: ZavorthSubagentBoardTask,
  receipts: ZavorthSubagentBoardSnapshot['receipts'] = [],
): ZavorthSubagentRuntimeWorkboardProjection['tasks'][number] {
  const taskReceipts = receipts.filter((receipt) => receipt.taskId === task.taskId);
  return {
    taskId: task.taskId,
    sessionId: task.sessionId,
    parentTaskId: task.parentTaskId,
    title: task.title,
    status: mapWorkboardStatus(task.status),
    risk: task.risk,
    attempts: task.attempts,
    failureCount: taskReceipts.filter((receipt) => receipt.status === 'failed' || receipt.status === 'blocked').length,
    maxRetries: task.maxRetries,
    claimedBy: task.claimedBy,
    claimedAt: task.claimedAt,
    heartbeatAt: task.heartbeatAt,
    heartbeatDeadlineAt: task.heartbeatDeadlineAt,
    blockedReason: task.blockedReason,
    artifactRefs: task.artifactRefs,
    comments: task.comments,
    summary: task.summary,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function mapWorkboardStatus(
  status: string,
): ZavorthSubagentRuntimeWorkboardProjection['tasks'][number]['status'] {
  if (status === 'done') return 'completed';
  if (status === 'approval-required') return 'blocked';
  if (
    status === 'queued' ||
    status === 'claimed' ||
    status === 'running' ||
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'blocked'
  ) {
    return status;
  }
  return 'blocked';
}

export function buildSandboxProjection(
  settings: ZavorthSubagentDynamicConfigSettings,
): ZavorthSubagentRuntimeSandboxProjection {
  const backends: ZavorthSubagentSandboxBackendId[] = ['local', 'docker', 'wsl', 'daytona', 'modal', 'external'];
  return {
    contractVersion: 'zavorth-subagent-sandbox/1',
    selectedBackend: settings.sandboxBackend,
    backends: backends.map((id) => {
      const remote = id === 'daytona' || id === 'modal' || id === 'external';
      const selected = id === settings.sandboxBackend;
      const enabled = remote ? settings.cloudSandboxEnabled && selected : selected || id === 'local';
      return {
        id,
        status: enabled ? (remote ? 'live-disabled' : 'doctor-only') : remote ? 'disabled' : 'doctor-only',
        remote,
        strongIsolation: id === 'docker' || id === 'wsl' || remote,
        enabled,
        liveReady: false,
      };
    }),
    safety: {
      cloudAdaptersDisabledByDefault: true,
      liveIoRequiresApproval: true,
      secretsNeverSerialized: true,
      ttlAndCostCapsRequired: true,
    },
  };
}

export function buildPairedDevicesProjection(
  devices: ZavorthSubagentRuntimePairedDevicesProjection['devices'],
): ZavorthSubagentRuntimePairedDevicesProjection {
  return {
    contractVersion: 'zavorth-subagent-devices/1',
    devices,
    summary: {
      total: devices.length,
      approved: devices.filter((device) => device.status === 'approved').length,
      pending: devices.filter((device) => device.status === 'pending').length,
      revoked: devices.filter((device) => device.status === 'revoked').length,
      blocked: devices.filter((device) => device.status === 'blocked').length,
      invokable: devices.filter((device) => device.status === 'approved' && device.approvedCapabilities.length > 0)
        .length,
    },
    policy: {
      approvedCapabilityAllowlistRequired: true,
      heartbeatBeforeAssignment: true,
      noSecretsSerialized: true,
    },
  };
}

export function motionStateForStatus(
  status: ZavorthSubagentRuntimeStatus,
): ZavorthSubagentRuntimeObservabilityEvent['motionState'] {
  if (status === 'queued' || status === 'claimed') return 'queued';
  if (status === 'running' || status === 'ready') return 'running';
  if (status === 'completed') return 'completed';
  if (status === 'approval-required') return 'approval-required';
  if (status === 'blocked' || status === 'denied') return 'blocked';
  if (status === 'failed') return 'failed';
  return 'idle';
}

export function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value || '').trim();
  return text || fallback;
}

export function normalizeNullable(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

export function normalizeChannel(value: unknown): string {
  return (
    normalizeText(value, 'cli')
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-') || 'cli'
  );
}

export function firstLine(value: string, maxLength = 240): string {
  const text = normalizeText(value).replace(/\s+/g, ' ');
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

export function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function stableId(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 16);
}

export function last(values: string[]): string | null {
  return values.length > 0 ? values[values.length - 1] || null : null;
}
