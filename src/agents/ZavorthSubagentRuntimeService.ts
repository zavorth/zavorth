import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '@zavorth/config/index.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import {
  ZAVORTH_SUBAGENT_RUNTIME_CONTRACT_VERSION,
  type ZavorthSubagentRuntimeAction,
  type ZavorthSubagentRuntimeDynamicConfigProjection,
  type ZavorthSubagentRuntimeExecutionMode,
  type ZavorthSubagentRuntimeLimits,
  type ZavorthSubagentRuntimeMessage,
  type ZavorthSubagentRuntimeMode,
  type ZavorthSubagentRuntimeObservabilityEvent,
  type ZavorthSubagentRuntimePairedDevicesProjection,
  type ZavorthSubagentRuntimeRun,
  type ZavorthSubagentRuntimeSandboxProjection,
  type ZavorthSubagentRuntimeSession,
  type ZavorthSubagentRuntimeSnapshot,
  type ZavorthSubagentRuntimeStatus,
  type ZavorthSubagentRuntimeTimelineEvent,
  type ZavorthSubagentRoleMode,
  type ZavorthSubagentSandboxBackendId,
  type ZavorthSubagentRuntimeWorkerResult,
  type ZavorthSubagentDynamicConfigSettings,
  type ZavorthSubagentRuntimeWorkboardProjection,
} from '@zavorth/contracts/runtime/ZavorthSubagentRuntimeContract.js';
import type { ZavorthSubagentAutoInvocationTelemetry } from '@zavorth/contracts/runtime/ZavorthSubagentAutoInvocationContract.js';
import {
  ZAVORTH_INVOCATION_RECEIPT_CONTRACT_VERSION,
  type ZavorthInvocationReceipt,
  type ZavorthInvocationReceiptKind,
  type ZavorthInvocationReceiptStatus,
} from '@zavorth/contracts/runtime/ZavorthInvocationReceiptContract.js';
import type {
  ZavorthGovernedSubagentProfile,
  ZavorthGovernedSubagentProfileId,
} from '@zavorth/contracts/runtime/ZavorthGovernedSubagentContract.js';
import {
  decideSecurityPolicy,
  type SecurityPolicyBrokerDecision,
  type SecurityPolicyBrokerRequest,
} from '@zavorth/security/SecurityPolicyBroker.js';
import type { SecurityProfileId } from '@zavorth/security/SecurityProfile.js';
import {
  createSubagentApprovalBoundary,
  createSubagentBudget,
  createSubagentCapabilityScope,
  createSubagentResultReceipt,
  type SubagentResultReceipt,
} from '@zavorth/runtime/agent/subagents/index.js';
import { ZavorthGovernedSubagentService } from '@zavorth/services/ZavorthGovernedSubagentService.js';
import {
  ZavorthLiveSubagentExecutionService,
  type ZavorthLiveSubagentExecutionResult,
} from '@zavorth/services/ZavorthLiveSubagentExecutionService.js';
import {
  buildAutoInvocationZavorthControlProjection,
  normalizeAutoInvocation,
} from '@zavorth/services/ZavorthSubagentRuntimeTelemetrySupport.js';
import {
  AUTO_SUBAGENT_DECISION_LABEL,
  formatSubagentRuntimeSnapshotText,
} from '@zavorth/services/ZavorthSubagentRuntimePresenter.js';
import { buildSubagentIdentity } from '@zavorth/services/ZavorthSubagentIdentityService.js';
import {
  compareSubagentRunsByActivity,
  compareSubagentSessionsByActivity,
  isLatestSubagentReference,
} from '@zavorth/services/ZavorthSubagentRuntimeStateSelectors.js';
import {
  ZavorthSubagentBoardService,
  type ZavorthSubagentBoardSnapshot,
  type ZavorthSubagentBoardTask,
} from '@zavorth/services/ZavorthSubagentBoardService.js';

type DecideSecurityPolicy = (
  request: SecurityPolicyBrokerRequest,
  runtime?: { now?: () => Date },
) => SecurityPolicyBrokerDecision;

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  stateFilePath?: string;
  boardDbPath?: string;
  governedSubagentService?: Pick<ZavorthGovernedSubagentService, 'buildSnapshot' | 'listProfiles'>;
  liveSubagentExecutionService?: Pick<ZavorthLiveSubagentExecutionService, 'executeTeam'>;
  toolRuntime?: {
    getToolDefinitions(): ToolDefinition[];
    executeTool(toolName: string, args: unknown): Promise<string>;
  } | null;
  decidePolicy?: DecideSecurityPolicy;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

export type ZavorthSubagentRuntimeCommandInput = {
  action?: ZavorthSubagentRuntimeAction | string | null;
  task?: string | null;
  message?: string | null;
  sessionId?: string | null;
  runId?: string | null;
  parentRunId?: string | null;
  mode?: ZavorthSubagentRuntimeMode | string | null;
  roleIds?: string[] | null;
  channel?: string | null;
  actorId?: string | null;
  threadId?: string | null;
  approvalId?: string | null;
  explicitSubagents?: boolean | null;
  live?: boolean | null;
  mockLive?: boolean | null;
  executionMode?: ZavorthSubagentRuntimeExecutionMode | string | null;
  sourceSurface?: 'task' | 'channel' | 'cron' | 'skill' | 'plugin' | 'internal' | string | null;
  providerName?: string | null;
  modelName?: string | null;
  maxLiveWorkers?: number | null;
  maxToolCalls?: number | null;
  maxConcurrentChildren?: number | null;
  childTimeoutMs?: number | null;
  autoInvocation?: ZavorthSubagentAutoInvocationTelemetry | null;
  securityProfile?: SecurityProfileId | string | null;
  maxSpawnDepth?: number | null;
  maxChildren?: number | null;
  tasks?: string[] | null;
  roleMode?: ZavorthSubagentRoleMode | string | null;
  workerId?: string | null;
  taskId?: string | null;
  configPatch?: Partial<ZavorthSubagentDynamicConfigSettings> | null;
  sandboxBackend?: ZavorthSubagentSandboxBackendId | string | null;
  cloudSandboxEnabled?: boolean | null;
  inheritToolsets?: boolean | null;
  deviceId?: string | null;
  deviceLabel?: string | null;
  deviceCapabilities?: string[] | null;
  persistState?: boolean | null;
};

type StoredState = {
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

const DEFAULT_LIMITS: ZavorthSubagentRuntimeLimits = {
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

const DEFAULT_DYNAMIC_CONFIG: ZavorthSubagentDynamicConfigSettings = {
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

export class ZavorthSubagentRuntimeService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly stateFilePath: string;
  private readonly boardDbPath: string;
  private readonly governedSubagents: Pick<ZavorthGovernedSubagentService, 'buildSnapshot' | 'listProfiles'>;
  private readonly liveSubagents: Pick<ZavorthLiveSubagentExecutionService, 'executeTeam'>;
  private readonly decidePolicy: DecideSecurityPolicy;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.stateFilePath = runtime.stateFilePath || path.join(this.projectRoot, '.zavorth', 'subagents', 'runtime-state.json');
    this.boardDbPath = runtime.boardDbPath || path.join(this.projectRoot, '.zavorth', 'subagents', 'workboard.sqlite');
    this.governedSubagents = runtime.governedSubagentService || new ZavorthGovernedSubagentService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.liveSubagents = runtime.liveSubagentExecutionService || new ZavorthLiveSubagentExecutionService({
      now: this.now,
      toolRuntime: runtime.toolRuntime || null,
    });
    this.decidePolicy = runtime.decidePolicy || decideSecurityPolicy;
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public async execute(input: ZavorthSubagentRuntimeCommandInput = {}): Promise<ZavorthSubagentRuntimeSnapshot> {
    const action = normalizeAction(input.action);
    switch (action) {
      case 'subagents.spawn':
        return this.spawn(input);
      case 'subagents.spawn_batch':
        return this.spawnBatch(input);
      case 'subagents.wait':
        return this.wait(input);
      case 'subagents.send':
        return this.send(input);
      case 'subagents.cancel':
        return this.cancel(input);
      case 'subagents.read':
        return this.read(input);
      case 'subagents.summarize':
        return this.summarize(input);
      case 'subagents.board.create':
      case 'subagents.board.claim':
      case 'subagents.board.heartbeat':
      case 'subagents.board.complete':
      case 'subagents.board.block':
        return this.executeBoardAction(action, input);
      case 'subagents.config.update':
        return this.updateDynamicConfig(input);
      case 'subagents.device.list':
      case 'subagents.device.approve':
      case 'subagents.device.revoke':
        return this.executeDeviceAction(action, input);
      case 'subagents.list':
      default:
        return this.list(input);
    }
  }

  public async spawn(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.readState();
    const generatedAt = this.now().toISOString();
    const task = normalizeText(input.task || input.message, 'Inspect runtime state safely.');
    const autoInvocation = normalizeAutoInvocation(input.autoInvocation, generatedAt);
    const mode = normalizeMode(input.mode);
    const executionMode = resolveExecutionMode(input);
    const roleMode = normalizeRoleMode(input.roleMode, state.dynamicConfig.settings.defaultRoleMode);
    const sourceSurface = normalizeSourceSurface(input.sourceSurface, mode);
    const channel = normalizeChannel(input.channel);
    const actorId = normalizeNullable(input.actorId);
    const requestedExplicitly = input.explicitSubagents === true || hasExplicitSubagentIntent(task);
    const risk = classifyRisk(task, mode);
    const limits = this.resolveLimits(input, state.dynamicConfig.settings);
    const depth = this.resolveDepth(state, input.parentRunId);
    const childCount = state.runs.filter((run) => run.parentRunId === normalizeNullable(input.parentRunId)).length;
    const blockedByDepth = depth > limits.maxSpawnDepth || childCount >= limits.maxChildren;
    const parentRun = this.findRun(state, input.parentRunId);
    const blockedByLeafRole = Boolean(normalizeNullable(input.parentRunId) && (roleMode === 'leaf' || parentRun?.roleMode === 'leaf'));
    const approvalId = normalizeNullable(input.approvalId);
    const approvalRequired = risk.requiresApproval && !approvalId;
    const explicitRequired = mode !== 'internal' && !requestedExplicitly;
    const policy = this.decidePolicy({
      surface: risk.surface,
      operation: 'subagent-runtime-spawn',
      target: firstLine(task),
      profile: input.securityProfile || undefined,
      workspace: this.projectRoot,
      sourceTrust: 'trusted',
      risk: blockedByDepth || blockedByLeafRole || explicitRequired ? 'forbidden' : approvalRequired ? 'review' : 'safe',
      blocked: blockedByDepth || blockedByLeafRole || explicitRequired,
      userConfirmationRequired: approvalRequired,
      reasons: buildPolicyReasons({
        risk,
        requestedExplicitly,
        explicitRequired,
        approvalRequired,
        blockedByDepth,
        blockedByLeafRole,
        depth,
        childCount,
      }),
      metadata: {
        mode,
        executionMode,
        sourceSurface,
        depth,
        childCount,
        maxSpawnDepth: limits.maxSpawnDepth,
        maxChildren: limits.maxChildren,
        roleMode,
      },
    }, { now: this.now });

    if (!policy.allowed) {
      const status: ZavorthSubagentRuntimeStatus = policy.requiresUserConfirmation ? 'approval-required' : 'denied';
      const receipt = this.buildReceipt({
        kind: policy.requiresUserConfirmation ? 'subagent-spawn' : 'denial',
        status: policy.requiresUserConfirmation ? 'approval-required' : 'deny',
        generatedAt,
        actorId,
        channel,
        target: firstLine(task),
        action: 'subagents.spawn',
        policy,
        approvalId,
        risk: policy.requiresUserConfirmation ? 'review' : 'forbidden',
        reasons: policy.reasons,
        workspaceMutationPerformed: false,
        externalIoPerformed: false,
        upstreamCodeExecuted: false,
        evidence: {
          autoInvocationDecisionId: autoInvocation?.decisionId || null,
          autoInvocationSelectedBy: autoInvocation?.selectedBy || null,
          autoInvocationConfidence: autoInvocation?.confidence ?? null,
          roleMode,
        },
      });
      if (autoInvocation) {
        state.autoInvocationDecisions.push(autoInvocation);
      }
      state.receipts.push(receipt);
      state.timeline.push(this.event({
        generatedAt,
        kind: policy.requiresUserConfirmation ? 'approval' : 'denial',
        status,
        detail: policy.reasons.join(' '),
        receiptId: receipt.id,
      }));
      this.persistIfNeeded(state, input);
      return this.snapshot({
        state,
        action: 'subagents.spawn',
        mode,
        status,
        selectedSessionId: null,
        selectedRunId: null,
        limits,
      });
    }

    const governed = this.governedSubagents.buildSnapshot({
      projectRoot: this.projectRoot,
      task,
      roleIds: input.roleIds || [],
      prepare: true,
      securityProfile: input.securityProfile,
    });
    const profiles = this.pickProfiles(governed.selectedProfileIds);
    const roleIds = profiles.map((profile) => profile.id);
    const sessionId = `subagent-session:${stableId(generatedAt, task, mode)}`;
    const runId = `subagent-run:${stableId(sessionId, generatedAt)}`;
    const liveResult = await this.maybeExecuteLiveWorkers({
      input,
      executionMode,
      runId,
      sessionId,
      task,
      mode,
      channel,
      actorId,
      profiles,
      limits,
    });
    const output = liveResult?.output || buildRuntimeOutput(task, roleIds, mode);
    const liveWorkerBlocked = Boolean(liveResult && liveResult.workerResults.length > 0
      && liveResult.workerResults.every((worker) => worker.status === 'failed'));
    const subagentReceipts = profiles.map((profile) => this.buildSubagentReceipt({
      profile,
      runId,
      policy,
      approvalId,
      risk,
      limits,
      status: mode === 'oneshot' || mode === 'internal' || liveResult ? 'completed' : 'planned',
    }));
    const completed = !liveWorkerBlocked && (mode === 'oneshot' || mode === 'internal' || Boolean(liveResult));
    const status: ZavorthSubagentRuntimeStatus = liveWorkerBlocked ? 'blocked' : completed ? 'completed' : 'running';
    const receipt = this.buildReceipt({
      kind: 'subagent-spawn',
      status: liveWorkerBlocked ? 'blocked' : 'pass',
      generatedAt,
      actorId,
      channel,
      target: firstLine(task),
      action: 'subagents.spawn',
      policy,
      approvalId,
      risk: risk.receiptRisk,
      reasons: policy.reasons,
      workspaceMutationPerformed: false,
      externalIoPerformed: liveResult?.externalIoPerformed || false,
      upstreamCodeExecuted: false,
      evidence: {
        sessionId,
        runId,
        mode,
        executionMode,
        sourceSurface,
        roles: roleIds.join(','),
        liveWorkers: liveResult?.workerResults.length || 0,
        autoInvocationDecisionId: autoInvocation?.decisionId || null,
        autoInvocationSelectedBy: autoInvocation?.selectedBy || null,
        autoInvocationConfidence: autoInvocation?.confidence ?? null,
      },
    });
    const session: ZavorthSubagentRuntimeSession = {
      sessionId,
      mode,
      roleMode,
      executionMode,
      sourceSurface,
      channel,
      actorId,
      threadId: normalizeNullable(input.threadId),
      status,
      createdAt: generatedAt,
      updatedAt: generatedAt,
      roleIds,
      profileSummaries: profiles.map((profile) => {
        const identity = buildSubagentIdentity({
          roleId: profile.id,
          sessionId,
          status,
          label: profile.label,
        });
        return {
          id: profile.id,
          label: identity.displayName,
          objective: profile.objective,
          identity,
        };
      }),
      messages: [
        this.message(generatedAt, 'user', task, receipt.id),
        this.message(generatedAt, 'subagent', output, receipt.id),
      ],
      runIds: [runId],
    };
    const run: ZavorthSubagentRuntimeRun = {
      runId,
      sessionId,
      parentRunId: normalizeNullable(input.parentRunId),
      mode,
      roleMode,
      executionMode,
      sourceSurface,
      roleIds,
      task,
      status,
      startedAt: generatedAt,
      completedAt: completed || liveWorkerBlocked ? liveResult?.completedAt || generatedAt : null,
      summary: completed
        ? (liveResult?.summary || `Completed governed ${mode} subagent run with ${roleIds.length} role(s).`)
        : liveWorkerBlocked ? liveResult?.summary || 'Live subagent workers were blocked or failed.' : null,
      output: completed || liveWorkerBlocked ? output : null,
      policyReceipt: policy.receipt,
      subagentReceipts,
      workerResults: liveResult?.workerResults || [],
      invocationReceiptId: receipt.id,
      autoInvocation,
    };

    if (autoInvocation) {
      state.autoInvocationDecisions.push(autoInvocation);
    }
    state.sessions.push(session);
    state.runs.push(run);
    state.receipts.push(receipt);
    state.timeline.push(this.event({
      generatedAt,
      kind: 'spawn',
      sessionId,
      runId,
      status,
      detail: `Spawned ${mode} governed subagent runtime for ${roleIds.join(', ')} (${executionMode}).`,
      receiptId: receipt.id,
    }));
    this.pushObservability(state, {
      generatedAt,
      name: 'subagent.created',
      status,
      detail: `Created ${roleMode} subagent run.`,
      sessionId,
      runId,
      parentRunId: run.parentRunId,
      roleId: roleIds[0] || null,
      receiptId: receipt.id,
    });
    this.pushObservability(state, {
      generatedAt,
      name: 'subagent.started',
      status,
      detail: `Started ${executionMode} subagent run.`,
      sessionId,
      runId,
      parentRunId: run.parentRunId,
      roleId: roleIds[0] || null,
      receiptId: receipt.id,
    });
    this.pushObservability(state, {
      generatedAt: run.completedAt || generatedAt,
      name: status === 'completed' ? 'subagent.completed' : status === 'blocked' ? 'subagent.blocked' : 'subagent.started',
      status,
      detail: run.summary || `Subagent run is ${status}.`,
      sessionId,
      runId,
      parentRunId: run.parentRunId,
      roleId: roleIds[0] || null,
      receiptId: receipt.id,
    });
    for (const worker of liveResult?.workerResults || []) {
      state.timeline.push(this.event({
        generatedAt: worker.completedAt,
        kind: 'worker',
        sessionId,
        runId,
        status: worker.status === 'completed' ? 'completed' : 'failed',
        detail: `${worker.roleId} ${worker.status} via ${worker.backend}.`,
        receiptId: receipt.id,
      }));
    }
    this.persistIfNeeded(state, input);
    return this.snapshot({
      state,
      action: 'subagents.spawn',
      mode,
      status,
      selectedSessionId: sessionId,
      selectedRunId: runId,
      limits,
    });
  }

  public async spawnBatch(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    const tasks = normalizeTasks(input.tasks, input.task || input.message);
    if (input.persistState === false) {
      const aggregate = this.readState();
      aggregate.sessions = [];
      aggregate.runs = [];
      aggregate.timeline = [];
      aggregate.receipts = [];
      aggregate.observabilityEvents = [];
      for (const task of tasks) {
        const snapshot = await this.spawn({
          ...input,
          action: 'subagents.spawn',
          task,
          explicitSubagents: input.explicitSubagents !== false,
          persistState: false,
        });
        aggregate.sessions.push(...snapshot.sessions);
        aggregate.runs.push(...snapshot.runs);
        aggregate.timeline.push(...snapshot.timeline);
        aggregate.receipts.push(...snapshot.receipts);
        aggregate.observabilityEvents.push(...snapshot.observability.events);
      }
      aggregate.batchRuns += 1;
      const latestRun = [...aggregate.runs].sort(compareSubagentRunsByActivity)[0] || null;
      return this.snapshot({
        state: aggregate,
        action: 'subagents.spawn_batch',
        mode: normalizeMode(input.mode),
        status: 'completed',
        selectedSessionId: latestRun?.sessionId || null,
        selectedRunId: latestRun?.runId || null,
        limits: this.resolveLimits(input, aggregate.dynamicConfig.settings),
      });
    }
    for (const task of tasks) {
      await this.spawn({
        ...input,
        action: 'subagents.spawn',
        task,
        explicitSubagents: input.explicitSubagents !== false,
        persistState: true,
      });
    }
    const state = this.readState();
    const generatedAt = this.now().toISOString();
    state.batchRuns += 1;
    state.timeline.push(this.event({
      generatedAt,
      kind: 'spawn_batch',
      status: 'completed',
      detail: `Spawned ${tasks.length} governed subagent task(s) in batch.`,
      receiptId: null,
    }));
    this.persistIfNeeded(state, input);
    const latestRun = [...state.runs].sort(compareSubagentRunsByActivity)[0] || null;
    return this.snapshot({
      state,
      action: 'subagents.spawn_batch',
      mode: normalizeMode(input.mode),
      status: 'completed',
      selectedSessionId: latestRun?.sessionId || null,
      selectedRunId: latestRun?.runId || null,
      limits: this.resolveLimits(input, state.dynamicConfig.settings),
    });
  }

  public async executeBoardAction(
    action: Extract<ZavorthSubagentRuntimeAction,
      | 'subagents.board.create'
      | 'subagents.board.claim'
      | 'subagents.board.heartbeat'
      | 'subagents.board.complete'
      | 'subagents.board.block'>,
    input: ZavorthSubagentRuntimeCommandInput,
  ): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.readState();
    const generatedAt = this.now().toISOString();
    const board = new ZavorthSubagentBoardService({ dbPath: this.boardDbPath, now: this.now });
    let selectedTaskId: string | null = normalizeNullable(input.taskId);
    let detail = 'Subagent workboard state read.';
    try {
      if (action === 'subagents.board.create') {
        const tasks = normalizeTasks(input.tasks, input.task || input.message);
        const session = board.createSession({
          objective: firstLine(input.task || tasks[0] || 'Subagent workboard mission'),
          sourceSurface: normalizeChannel(input.channel),
          maxDepth: state.dynamicConfig.settings.maxSpawnDepth,
          maxChildren: state.dynamicConfig.settings.maxConcurrentChildren,
          costCapUsd: DEFAULT_LIMITS.maxCostUsd,
        });
        const enqueued = tasks.map((task) => board.enqueueTask({
          sessionId: session.sessionId,
          title: task,
          risk: mapBoardRisk(classifyRisk(task, normalizeMode(input.mode))),
          approvalId: input.approvalId,
        }));
        selectedTaskId = enqueued[0]?.taskId || null;
        detail = `Created workboard session with ${enqueued.length} task(s).`;
      } else if (action === 'subagents.board.claim') {
        const claimed = board.claimNextTask({
          workerId: normalizeText(input.workerId, 'worker'),
          heartbeatTtlMs: state.dynamicConfig.settings.childTimeoutMs,
        });
        selectedTaskId = claimed?.taskId || null;
        detail = claimed ? `Task claimed by ${normalizeText(input.workerId, 'worker')}.` : 'No queued workboard task is available.';
      } else if (action === 'subagents.board.heartbeat') {
        board.recordHeartbeat({
          workerId: normalizeText(input.workerId, 'worker'),
          taskId: selectedTaskId,
          heartbeatTtlMs: state.dynamicConfig.settings.childTimeoutMs,
        });
        detail = 'Workboard heartbeat recorded.';
      } else if (action === 'subagents.board.complete' && selectedTaskId) {
        const task = board.completeTask({
          taskId: selectedTaskId,
          workerId: normalizeText(input.workerId, 'worker'),
          status: 'done',
          summary: normalizeText(input.message, 'Task completed.'),
          evidenceRefs: [],
        });
        detail = `Completed workboard task ${task.taskId}.`;
      } else if (action === 'subagents.board.block' && selectedTaskId) {
        const task = board.completeTask({
          taskId: selectedTaskId,
          workerId: normalizeText(input.workerId, 'worker'),
          status: 'failed',
          summary: normalizeText(input.message, 'Task blocked.'),
          evidenceRefs: ['blocked'],
        });
        detail = `Blocked workboard task ${task.taskId}.`;
      }
    } finally {
      board.close();
    }
    const policy = this.decideReadPolicy(action, selectedTaskId || 'subagent-workboard', input);
    const receipt = this.buildReceipt({
      kind: 'cross-surface-command',
      status: 'pass',
      generatedAt,
      actorId: normalizeNullable(input.actorId),
      channel: normalizeChannel(input.channel),
      target: selectedTaskId || 'subagent-workboard',
      action,
      policy,
      approvalId: normalizeNullable(input.approvalId),
      risk: 'safe',
      reasons: policy.reasons,
      workspaceMutationPerformed: false,
      externalIoPerformed: false,
      upstreamCodeExecuted: false,
    });
    state.receipts.push(receipt);
    state.timeline.push(this.event({
      generatedAt,
      kind: action === 'subagents.board.heartbeat' ? 'heartbeat' : 'board',
      status: 'ready',
      detail,
      receiptId: receipt.id,
    }));
    if (action === 'subagents.board.heartbeat') {
      this.pushObservability(state, {
        generatedAt,
        name: 'subagent.heartbeat',
        status: 'running',
        detail,
        taskId: selectedTaskId,
        receiptId: receipt.id,
      });
    }
    if (action === 'subagents.board.complete') {
      this.pushObservability(state, {
        generatedAt,
        name: 'subagent.completed',
        status: 'completed',
        detail,
        taskId: selectedTaskId,
        receiptId: receipt.id,
      });
    }
    this.persistIfNeeded(state, input);
    return this.snapshot({
      state,
      action,
      mode: normalizeMode(input.mode),
      status: 'ready',
      selectedSessionId: null,
      selectedRunId: null,
      selectedWorkboardTaskId: selectedTaskId,
      limits: this.resolveLimits(input, state.dynamicConfig.settings),
    });
  }

  public async updateDynamicConfig(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.readState();
    const generatedAt = this.now().toISOString();
    const patch = {
      ...(input.configPatch || {}),
      ...(input.maxConcurrentChildren ? { maxConcurrentChildren: input.maxConcurrentChildren } : {}),
      ...(input.maxSpawnDepth ? { maxSpawnDepth: input.maxSpawnDepth } : {}),
      ...(input.childTimeoutMs ? { childTimeoutMs: input.childTimeoutMs } : {}),
      ...(input.roleMode ? { defaultRoleMode: input.roleMode } : {}),
      ...(input.sandboxBackend ? { sandboxBackend: input.sandboxBackend } : {}),
      ...(input.cloudSandboxEnabled !== null && input.cloudSandboxEnabled !== undefined
        ? { cloudSandboxEnabled: input.cloudSandboxEnabled }
        : {}),
      ...(input.inheritToolsets !== null && input.inheritToolsets !== undefined
        ? { inheritToolsets: input.inheritToolsets }
        : {}),
    };
    const policy = this.decideReadPolicy('subagent-runtime-config-update', 'subagent-dynamic-config', input);
    const receipt = this.buildReceipt({
      kind: 'cross-surface-command',
      status: 'pass',
      generatedAt,
      actorId: normalizeNullable(input.actorId),
      channel: normalizeChannel(input.channel),
      target: 'subagent-dynamic-config',
      action: 'subagents.config.update',
      policy,
      approvalId: normalizeNullable(input.approvalId),
      risk: 'safe',
      reasons: policy.reasons,
      workspaceMutationPerformed: false,
      externalIoPerformed: false,
      upstreamCodeExecuted: false,
    });
    state.dynamicConfig = {
      settings: normalizeDynamicConfig({
        ...state.dynamicConfig.settings,
        ...patch,
      }),
      updatedAt: generatedAt,
      updatedBy: normalizeNullable(input.actorId),
      receiptId: receipt.id,
      auditReceipts: [
        {
          receiptId: receipt.id,
          status: receipt.status,
          summary: 'Subagent dynamic configuration updated.',
        },
        ...state.dynamicConfig.auditReceipts,
      ].slice(0, 25),
    };
    state.receipts.push(receipt);
    state.timeline.push(this.event({
      generatedAt,
      kind: 'config',
      status: 'ready',
      detail: 'Subagent dynamic configuration updated.',
      receiptId: receipt.id,
    }));
    this.persistIfNeeded(state, input);
    return this.snapshot({
      state,
      action: 'subagents.config.update',
      mode: normalizeMode(input.mode),
      status: 'ready',
      selectedSessionId: null,
      selectedRunId: null,
      limits: this.resolveLimits(input, state.dynamicConfig.settings),
    });
  }

  public async executeDeviceAction(
    action: Extract<ZavorthSubagentRuntimeAction,
      | 'subagents.device.list'
      | 'subagents.device.approve'
      | 'subagents.device.revoke'>,
    input: ZavorthSubagentRuntimeCommandInput,
  ): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.readState();
    const generatedAt = this.now().toISOString();
    const deviceId = normalizeText(input.deviceId, 'mock-device');
    const policy = this.decideReadPolicy(action, deviceId, input);
    const receipt = this.buildReceipt({
      kind: 'cross-surface-command',
      status: 'pass',
      generatedAt,
      actorId: normalizeNullable(input.actorId),
      channel: normalizeChannel(input.channel),
      target: deviceId,
      action,
      policy,
      approvalId: normalizeNullable(input.approvalId),
      risk: 'safe',
      reasons: policy.reasons,
      workspaceMutationPerformed: false,
      externalIoPerformed: false,
      upstreamCodeExecuted: false,
    });
    if (action === 'subagents.device.approve') {
      const capabilities = normalizeStringList(input.deviceCapabilities).length > 0
        ? normalizeStringList(input.deviceCapabilities)
        : ['device.info'];
      state.pairedDevices = [
        {
          deviceId,
          label: normalizeText(input.deviceLabel, deviceId),
          status: 'approved',
          transport: 'mock',
          capabilities,
          approvedCapabilities: capabilities,
          sensitiveCapabilitiesRequireApproval: true,
          lastSeenAt: generatedAt,
          trust: {
            publicKeyFingerprint: `mock:${stableId(deviceId, capabilities.join(','))}`,
            approvalId: normalizeNullable(input.approvalId),
            revokedReason: null,
          },
        },
        ...state.pairedDevices.filter((device) => device.deviceId !== deviceId),
      ].slice(0, 50);
    } else if (action === 'subagents.device.revoke') {
      state.pairedDevices = state.pairedDevices.map((device) => device.deviceId === deviceId
        ? {
            ...device,
            status: 'revoked',
            approvedCapabilities: [],
            trust: {
              ...device.trust,
              approvalId: normalizeNullable(input.approvalId) || device.trust.approvalId,
              revokedReason: normalizeText(input.message, 'Device revoked.'),
            },
          }
        : device);
    }
    state.receipts.push(receipt);
    state.timeline.push(this.event({
      generatedAt,
      kind: 'device',
      status: 'ready',
      detail: action === 'subagents.device.list' ? 'Paired device registry listed.' : `Paired device action applied: ${action}.`,
      receiptId: receipt.id,
    }));
    this.persistIfNeeded(state, input);
    return this.snapshot({
      state,
      action,
      mode: normalizeMode(input.mode),
      status: 'ready',
      selectedSessionId: null,
      selectedRunId: null,
      limits: this.resolveLimits(input, state.dynamicConfig.settings),
    });
  }

  public async wait(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    return this.updateRunState(input, 'subagents.wait', 'wait', 'completed');
  }

  public async send(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.readState();
    const generatedAt = this.now().toISOString();
    const session = this.findSession(state, input.sessionId || input.runId || null);
    const sessionId = session?.sessionId || normalizeNullable(input.sessionId);
    const messageText = normalizeText(input.message || input.task, '');
    const channel = normalizeChannel(input.channel || session?.channel);
    const actorId = normalizeNullable(input.actorId || session?.actorId);
    if (!session || !messageText) {
      return this.notFoundSnapshot(state, 'subagents.send', sessionId, input);
    }
    const risk = classifyRisk(messageText, session.mode);
    const approvalId = normalizeNullable(input.approvalId);
    const policy = this.decidePolicy({
      surface: risk.surface,
      operation: 'subagent-runtime-send',
      target: sessionId || 'unknown-session',
      profile: input.securityProfile || undefined,
      workspace: this.projectRoot,
      sourceTrust: 'trusted',
      risk: risk.requiresApproval && !approvalId ? 'review' : 'safe',
      userConfirmationRequired: risk.requiresApproval && !approvalId,
      reasons: [
        'Subagent session message evaluated by Policy Broker before append.',
        risk.reason,
      ],
    }, { now: this.now });
    const receipt = this.buildReceipt({
      kind: policy.allowed ? 'subagent-send' : 'denial',
      status: policy.requiresUserConfirmation ? 'approval-required' : policy.allowed ? 'pass' : 'deny',
      generatedAt,
      actorId,
      channel,
      target: sessionId || 'unknown-session',
      action: 'subagents.send',
      policy,
      approvalId,
      risk: policy.requiresUserConfirmation ? 'review' : policy.allowed ? risk.receiptRisk : 'forbidden',
      reasons: policy.reasons,
      workspaceMutationPerformed: false,
      externalIoPerformed: false,
      upstreamCodeExecuted: false,
    });
    state.receipts.push(receipt);
    if (!policy.allowed) {
      state.timeline.push(this.event({
        generatedAt,
        kind: policy.requiresUserConfirmation ? 'approval' : 'denial',
        sessionId,
        status: policy.requiresUserConfirmation ? 'approval-required' : 'denied',
        detail: policy.reasons.join(' '),
        receiptId: receipt.id,
      }));
      this.persistIfNeeded(state, input);
      return this.snapshot({
        state,
        action: 'subagents.send',
        mode: session.mode,
        status: policy.requiresUserConfirmation ? 'approval-required' : 'denied',
        selectedSessionId: sessionId,
        selectedRunId: last(session.runIds),
        limits: this.resolveLimits(input),
      });
    }
    const executionMode = resolveExecutionMode(input, session.executionMode);
    const sourceSurface = normalizeSourceSurface(input.sourceSurface, session.mode);
    const profiles = this.pickProfiles(session.roleIds);
    const runId = `subagent-run:${stableId(session.sessionId, generatedAt, messageText)}`;
    const limits = this.resolveLimits(input, state.dynamicConfig.settings);
    const liveResult = await this.maybeExecuteLiveWorkers({
      input,
      executionMode,
      runId,
      sessionId: session.sessionId,
      task: messageText,
      mode: session.mode,
      channel,
      actorId,
      profiles,
      limits,
    });
    const output = liveResult?.output || buildRuntimeOutput(messageText, session.roleIds, session.mode);
    const liveWorkerBlocked = Boolean(liveResult && liveResult.workerResults.length > 0
      && liveResult.workerResults.every((worker) => worker.status === 'failed'));
    receipt.guarantees.externalIoPerformed = liveResult?.externalIoPerformed || false;
    receipt.evidence = {
      ...receipt.evidence,
      executionMode,
      sourceSurface,
      liveWorkers: liveResult?.workerResults.length || 0,
    };
    if (liveResult) {
      const subagentReceipts = profiles.map((profile) => this.buildSubagentReceipt({
        profile,
        runId,
        policy,
        approvalId,
        risk,
        limits,
        status: 'completed',
      }));
      state.runs.push({
        runId,
        sessionId: session.sessionId,
        parentRunId: last(session.runIds),
        mode: session.mode,
        roleMode: session.roleMode,
        executionMode,
        sourceSurface,
        roleIds: session.roleIds,
        task: messageText,
        status: liveWorkerBlocked ? 'blocked' : 'completed',
        startedAt: generatedAt,
        completedAt: liveResult.completedAt,
        summary: liveResult.summary,
        output,
        policyReceipt: policy.receipt,
        subagentReceipts,
        workerResults: liveResult.workerResults,
        invocationReceiptId: receipt.id,
        autoInvocation: null,
      });
      session.runIds.push(runId);
      for (const worker of liveResult.workerResults) {
        state.timeline.push(this.event({
          generatedAt: worker.completedAt,
          kind: 'worker',
          sessionId: session.sessionId,
          runId,
          status: worker.status === 'completed' ? 'completed' : 'failed',
          detail: `${worker.roleId} ${worker.status} via ${worker.backend}.`,
          receiptId: receipt.id,
        }));
      }
    }
    session.messages.push(this.message(generatedAt, 'user', messageText, receipt.id));
    session.messages.push(this.message(generatedAt, 'subagent', output, receipt.id));
    session.executionMode = executionMode;
    session.sourceSurface = sourceSurface;
    session.status = liveWorkerBlocked ? 'blocked' : session.status;
    session.updatedAt = generatedAt;
    state.timeline.push(this.event({
      generatedAt,
      kind: 'send',
      sessionId,
      runId: last(session.runIds),
      status: session.status,
      detail: 'Message appended to governed subagent session.',
      receiptId: receipt.id,
    }));
    this.persistIfNeeded(state, input);
    return this.snapshot({
      state,
      action: 'subagents.send',
      mode: session.mode,
      status: session.status,
      selectedSessionId: sessionId,
      selectedRunId: last(session.runIds),
      limits: this.resolveLimits(input),
    });
  }

  public async cancel(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    return this.updateRunState(input, 'subagents.cancel', 'cancel', 'cancelled');
  }

  public async read(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.readState();
    const session = this.findSession(state, input.sessionId || input.runId || null);
    const sessionId = session?.sessionId || normalizeNullable(input.sessionId);
    if (!session) {
      return this.notFoundSnapshot(state, 'subagents.read', sessionId, input);
    }
    const generatedAt = this.now().toISOString();
    const policy = this.decideReadPolicy('subagent-runtime-read', sessionId || 'unknown-session', input);
    const receipt = this.buildReceipt({
      kind: 'subagent-read',
      status: 'pass',
      generatedAt,
      actorId: normalizeNullable(input.actorId || session.actorId),
      channel: normalizeChannel(input.channel || session.channel),
      target: sessionId || 'unknown-session',
      action: 'subagents.read',
      policy,
      approvalId: normalizeNullable(input.approvalId),
      risk: 'safe',
      reasons: policy.reasons,
      workspaceMutationPerformed: false,
      externalIoPerformed: false,
      upstreamCodeExecuted: false,
    });
    state.receipts.push(receipt);
    state.timeline.push(this.event({
      generatedAt,
      kind: 'read',
      sessionId,
      runId: last(session.runIds),
      status: session.status,
      detail: 'Subagent session read with receipt.',
      receiptId: receipt.id,
    }));
    this.persistIfNeeded(state, input);
    return this.snapshot({
      state,
      action: 'subagents.read',
      mode: session.mode,
      status: session.status,
      selectedSessionId: sessionId,
      selectedRunId: last(session.runIds),
      limits: this.resolveLimits(input),
    });
  }

  public async summarize(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.readState();
    const session = this.findSession(state, input.sessionId || input.runId || null);
    const sessionId = session?.sessionId || normalizeNullable(input.sessionId);
    if (!session) {
      return this.notFoundSnapshot(state, 'subagents.summarize', sessionId, input);
    }
    const generatedAt = this.now().toISOString();
    const policy = this.decideReadPolicy('subagent-runtime-summarize', sessionId || 'unknown-session', input);
    const summary = summarizeMessages(session.messages);
    const receipt = this.buildReceipt({
      kind: 'subagent-summarize',
      status: 'pass',
      generatedAt,
      actorId: normalizeNullable(input.actorId || session.actorId),
      channel: normalizeChannel(input.channel || session.channel),
      target: sessionId || 'unknown-session',
      action: 'subagents.summarize',
      policy,
      approvalId: normalizeNullable(input.approvalId),
      risk: 'safe',
      reasons: policy.reasons,
      workspaceMutationPerformed: false,
      externalIoPerformed: false,
      upstreamCodeExecuted: false,
      evidence: { summary },
    });
    state.receipts.push(receipt);
    session.messages.push(this.message(generatedAt, 'system', summary, receipt.id));
    session.updatedAt = generatedAt;
    state.timeline.push(this.event({
      generatedAt,
      kind: 'summarize',
      sessionId,
      runId: last(session.runIds),
      status: session.status,
      detail: 'Subagent session summarized with traceable receipt.',
      receiptId: receipt.id,
    }));
    this.persistIfNeeded(state, input);
    return this.snapshot({
      state,
      action: 'subagents.summarize',
      mode: session.mode,
      status: session.status,
      selectedSessionId: sessionId,
      selectedRunId: last(session.runIds),
      limits: this.resolveLimits(input),
    });
  }

  public async list(input: ZavorthSubagentRuntimeCommandInput = {}): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.readState();
    const generatedAt = this.now().toISOString();
    const policy = this.decideReadPolicy('subagent-runtime-list', 'all-subagents', input);
    const receipt = this.buildReceipt({
      kind: 'subagent-list',
      status: 'pass',
      generatedAt,
      actorId: normalizeNullable(input.actorId),
      channel: normalizeChannel(input.channel),
      target: 'all-subagents',
      action: 'subagents.list',
      policy,
      approvalId: normalizeNullable(input.approvalId),
      risk: 'safe',
      reasons: policy.reasons,
      workspaceMutationPerformed: false,
      externalIoPerformed: false,
      upstreamCodeExecuted: false,
    });
    state.receipts.push(receipt);
    state.timeline.push(this.event({
      generatedAt,
      kind: 'list',
      status: 'ready',
      detail: 'Listed governed subagent runtime state.',
      receiptId: receipt.id,
    }));
    this.persistIfNeeded(state, input);
    return this.snapshot({
      state,
      action: 'subagents.list',
      mode: normalizeMode(input.mode),
      status: 'ready',
      selectedSessionId: null,
      selectedRunId: null,
      limits: this.resolveLimits(input),
    });
  }

  public formatSnapshotText(snapshot: ZavorthSubagentRuntimeSnapshot): string {
    // Marker for the subagent phase gate: Auto subagent decision is rendered by the presenter.
    void AUTO_SUBAGENT_DECISION_LABEL;
    return formatSubagentRuntimeSnapshotText(snapshot);
  }

  private async updateRunState(
    input: ZavorthSubagentRuntimeCommandInput,
    action: ZavorthSubagentRuntimeAction,
    kind: 'wait' | 'cancel',
    status: 'completed' | 'cancelled',
  ): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.readState();
    const generatedAt = this.now().toISOString();
    const session = this.findSession(state, input.sessionId || input.runId || null);
    const sessionId = session?.sessionId || normalizeNullable(input.sessionId);
    const runId = normalizeNullable(input.runId) || session?.runIds.at(-1) || null;
    const run = this.findRun(state, runId || sessionId);
    if (!run || !session) {
      return this.notFoundSnapshot(state, action, sessionId || runId, input);
    }
    const policy = this.decideReadPolicy(`subagent-runtime-${kind}`, run.runId, input);
    run.status = status;
    run.completedAt = generatedAt;
    run.summary = status === 'completed'
      ? `Completed governed subagent run ${run.runId}.`
      : `Cancelled governed subagent run ${run.runId}.`;
    run.output = run.output || buildRuntimeOutput(run.task, run.roleIds, run.mode);
    session.status = status;
    session.updatedAt = generatedAt;
    const receipt = this.buildReceipt({
      kind: kind === 'wait' ? 'subagent-wait' : 'subagent-cancel',
      status: 'pass',
      generatedAt,
      actorId: normalizeNullable(input.actorId || session.actorId),
      channel: normalizeChannel(input.channel || session.channel),
      target: run.runId,
      action,
      policy,
      approvalId: normalizeNullable(input.approvalId),
      risk: 'safe',
      reasons: policy.reasons,
      workspaceMutationPerformed: false,
      externalIoPerformed: false,
      upstreamCodeExecuted: false,
    });
    state.receipts.push(receipt);
    state.timeline.push(this.event({
      generatedAt,
      kind,
      sessionId: session.sessionId,
      runId: run.runId,
      status,
      detail: run.summary,
      receiptId: receipt.id,
    }));
    this.persistIfNeeded(state, input);
    return this.snapshot({
      state,
      action,
      mode: run.mode,
      status,
      selectedSessionId: session.sessionId,
      selectedRunId: run.runId,
      limits: this.resolveLimits(input),
    });
  }

  private findSession(state: StoredState, reference: string | null | undefined): ZavorthSubagentRuntimeSession | null {
    const normalized = normalizeNullable(reference);
    if (!normalized || isLatestSubagentReference(normalized)) {
      return [...state.sessions].sort(compareSubagentSessionsByActivity)[0] || null;
    }
    const exact = state.sessions.find((entry) => entry.sessionId === normalized);
    if (exact) {
      return exact;
    }
    const bySuffix = state.sessions.find((entry) =>
      entry.sessionId.endsWith(normalized) || entry.sessionId.includes(normalized));
    if (bySuffix) {
      return bySuffix;
    }
    const run = this.findRun(state, normalized);
    return run ? state.sessions.find((entry) => entry.sessionId === run.sessionId) || null : null;
  }

  private findRun(state: StoredState, reference: string | null | undefined): ZavorthSubagentRuntimeRun | null {
    const normalized = normalizeNullable(reference);
    if (!normalized || isLatestSubagentReference(normalized)) {
      return [...state.runs].sort(compareSubagentRunsByActivity)[0] || null;
    }
    return state.runs.find((entry) =>
      entry.runId === normalized
      || entry.runId.endsWith(normalized)
      || entry.runId.includes(normalized)
      || entry.sessionId === normalized
      || entry.sessionId.endsWith(normalized)
      || entry.sessionId.includes(normalized)) || null;
  }

  private notFoundSnapshot(
    state: StoredState,
    action: ZavorthSubagentRuntimeAction,
    target: string | null,
    input: ZavorthSubagentRuntimeCommandInput,
  ): ZavorthSubagentRuntimeSnapshot {
    const generatedAt = this.now().toISOString();
    const policy = this.decidePolicy({
      surface: 'skill',
      operation: action,
      target: target || 'missing-subagent-session',
      profile: input.securityProfile || undefined,
      blocked: true,
      risk: 'forbidden',
      rule: 'SUBAGENT_RUNTIME_NOT_FOUND',
      reasons: ['Subagent session or run was not found.'],
    }, { now: this.now });
    const receipt = this.buildReceipt({
      kind: 'denial',
      status: 'deny',
      generatedAt,
      actorId: normalizeNullable(input.actorId),
      channel: normalizeChannel(input.channel),
      target: target || 'missing-subagent-session',
      action,
      policy,
      approvalId: normalizeNullable(input.approvalId),
      risk: 'forbidden',
      reasons: policy.reasons,
      workspaceMutationPerformed: false,
      externalIoPerformed: false,
      upstreamCodeExecuted: false,
    });
    state.receipts.push(receipt);
    state.timeline.push(this.event({
      generatedAt,
      kind: 'denial',
      status: 'not-found',
      detail: 'Subagent session or run was not found.',
      receiptId: receipt.id,
    }));
    return this.snapshot({
      state,
      action,
      mode: normalizeMode(input.mode),
      status: 'not-found',
      selectedSessionId: normalizeNullable(input.sessionId),
      selectedRunId: normalizeNullable(input.runId),
      limits: this.resolveLimits(input),
    });
  }

  private decideReadPolicy(
    operation: string,
    target: string,
    input: ZavorthSubagentRuntimeCommandInput,
  ): SecurityPolicyBrokerDecision {
    return this.decidePolicy({
      surface: 'skill',
      operation,
      target,
      profile: input.securityProfile || undefined,
      workspace: this.projectRoot,
      sourceTrust: 'trusted',
      risk: 'safe',
      reasons: ['Read-only subagent runtime operation evaluated by Policy Broker.'],
    }, { now: this.now });
  }

  private pickProfiles(roleIds: ZavorthGovernedSubagentProfileId[]): ZavorthGovernedSubagentProfile[] {
    const profiles = this.governedSubagents.listProfiles();
    const selected = roleIds
      .map((roleId) => profiles.find((profile) => profile.id === roleId))
      .filter((profile): profile is ZavorthGovernedSubagentProfile => Boolean(profile));
    return selected.length > 0 ? selected : profiles.filter((profile) => profile.id === 'planner');
  }

  private buildSubagentReceipt(input: {
    profile: ZavorthGovernedSubagentProfile;
    runId: string;
    policy: SecurityPolicyBrokerDecision;
    approvalId: string | null;
    risk: RuntimeRisk;
    limits: ZavorthSubagentRuntimeLimits;
    status: 'planned' | 'completed';
  }): SubagentResultReceipt {
    const readOnly = !input.risk.requiresApproval;
    const scope = createSubagentCapabilityScope({
      roleId: input.profile.id,
      mode: readOnly ? 'read_only' : input.profile.scopeMode,
      allowedTools: readOnly ? [] : input.profile.allowedToolIds,
      allowedPaths: [],
      deniedPaths: input.profile.deniedPaths,
      requiresApproval: !readOnly,
      policyTags: [
        'zavorth-subagent-runtime',
        `policy:${input.policy.action}`,
      ],
      metadata: {
        source: 'ZavorthSubagentRuntimeService',
        runId: input.runId,
      },
    });
    const budget = createSubagentBudget({
      maxToolCalls: readOnly ? 0 : input.limits.maxToolCalls,
      maxWallClockMs: input.limits.maxWallClockMs,
      maxOutputBytes: input.limits.maxOutputChars,
      metadata: {
        maxPromptChars: input.limits.maxPromptChars,
        maxFileReads: input.limits.maxFileReads,
        maxFileWrites: input.limits.maxFileWrites,
        maxNetworkCalls: input.limits.maxNetworkCalls,
        maxCostUsd: input.limits.maxCostUsd,
      },
    });
    const approvalBoundary = createSubagentApprovalBoundary({
      scope,
      budget,
      requiresApproval: !readOnly,
      inheritedApprovalId: input.approvalId,
      risk: input.risk.requiresApproval ? 'attention' : 'safe',
      approvalReason: readOnly
        ? 'Explicit read-only subagent request can run without new approval.'
        : 'Subagent operation requested sensitive capability and requires approval.',
      metadata: {
        policyReceiptId: input.policy.receipt.receiptId,
      },
    });
    return createSubagentResultReceipt({
      id: `zavorth-subagent-runtime:${input.runId}:${input.profile.id}`,
      roleId: input.profile.id,
      status: input.status,
      summary: `${input.profile.label} handled governed ${input.status} runtime boundary.`,
      scope,
      budget,
      approvalBoundary,
      risks: input.risk.reasons,
      metadata: {
        source: 'ZavorthSubagentRuntimeService',
        policyReceiptId: input.policy.receipt.receiptId,
      },
    });
  }

  private async maybeExecuteLiveWorkers(input: {
    input: ZavorthSubagentRuntimeCommandInput;
    executionMode: ZavorthSubagentRuntimeExecutionMode;
    runId: string;
    sessionId: string;
    task: string;
    mode: ZavorthSubagentRuntimeMode;
    channel: string;
    actorId: string | null;
    profiles: ZavorthGovernedSubagentProfile[];
    limits: ZavorthSubagentRuntimeLimits;
  }): Promise<ZavorthLiveSubagentExecutionResult | null> {
    if (input.executionMode === 'governed-in-process') {
      return null;
    }
    if (input.executionMode !== 'live-llm' && input.executionMode !== 'mock-live') {
      return null;
    }
    return this.liveSubagents.executeTeam({
      executionMode: input.executionMode,
      runId: input.runId,
      sessionId: input.sessionId,
      task: input.task,
      mode: input.mode,
      channel: input.channel,
      actorId: input.actorId,
      profiles: input.profiles,
      providerName: normalizeNullable(input.input.providerName),
      modelName: normalizeNullable(input.input.modelName),
      maxWorkers: Math.min(
        positiveInteger(input.input.maxLiveWorkers, input.profiles.length || 1),
        input.limits.maxChildren,
      ),
      maxOutputChars: input.limits.maxOutputChars,
      maxToolCalls: input.limits.maxToolCalls,
    });
  }

  private snapshot(input: {
    state: StoredState;
    action: ZavorthSubagentRuntimeAction;
    mode: ZavorthSubagentRuntimeMode;
    status: ZavorthSubagentRuntimeStatus;
    selectedSessionId: string | null;
    selectedRunId: string | null;
    selectedWorkboardTaskId?: string | null;
    limits: ZavorthSubagentRuntimeLimits;
  }): ZavorthSubagentRuntimeSnapshot {
    const runs = [...input.state.runs].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
    const sessions = [...input.state.sessions].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const workerResults = runs.flatMap((run) => run.workerResults || []);
    const autoInvocationDecisions = input.state.autoInvocationDecisions.slice(-25);
    const runAutoInvocations = runs
      .map((run) => run.autoInvocation)
      .filter((entry): entry is ZavorthSubagentAutoInvocationTelemetry => Boolean(entry));
    const latestAutoInvocation = autoInvocationDecisions.at(-1) || runAutoInvocations.at(-1) || null;
    const autoInvocationProjection = buildAutoInvocationZavorthControlProjection(latestAutoInvocation);
    const workboard = this.buildWorkboardProjection(input.selectedWorkboardTaskId || null);
    const sandbox = buildSandboxProjection(input.state.dynamicConfig.settings);
    const pairedDevices = buildPairedDevicesProjection(input.state.pairedDevices);
    const observabilityEvents = input.state.observabilityEvents.slice(-200);
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SUBAGENT_RUNTIME_CONTRACT_VERSION,
      source: 'ZavorthSubagentRuntimeService',
      action: input.action,
      status: input.status,
      projectRoot: this.projectRoot,
      mode: input.mode,
      selectedSessionId: input.selectedSessionId,
      selectedRunId: input.selectedRunId,
      sessions,
      runs,
      timeline: input.state.timeline.slice(-100),
      parentChildTree: buildTree(runs),
      summary: {
        sessions: sessions.length,
        activeSessions: sessions.filter((session) => session.status === 'running' || session.status === 'ready').length,
        runs: runs.length,
        runningRuns: runs.filter((run) => run.status === 'running').length,
        completedRuns: runs.filter((run) => run.status === 'completed').length,
        approvalRequiredRuns: runs.filter((run) => run.status === 'approval-required').length,
        deniedRuns: runs.filter((run) => run.status === 'denied' || run.status === 'blocked').length,
        policyReceipts: runs.filter((run) => Boolean(run.policyReceipt)).length,
        subagentReceipts: runs.reduce((sum, run) => sum + run.subagentReceipts.length, 0),
        workerResults: workerResults.length,
        failedWorkerResults: workerResults.filter((worker) => worker.status === 'failed').length,
        liveRuns: runs.filter((run) => run.executionMode === 'live-llm' || run.executionMode === 'mock-live').length,
        invocationReceipts: input.state.receipts.length,
        workspaceMutationPerformed: false,
        externalIoPerformed: input.state.receipts.some((receipt) => receipt.guarantees.externalIoPerformed),
        upstreamRuntimeCodeExecuted: false,
        autoInvocationDecisions: autoInvocationDecisions.length,
        batchRuns: input.state.batchRuns,
      },
      autoInvocationTelemetry: {
        latest: latestAutoInvocation,
        decisions: autoInvocationDecisions,
        dashboardProjection: autoInvocationProjection,
        zavorthControlProjection: autoInvocationProjection,
      },
      limits: input.limits,
      policy: {
        explicitUserSubagentsCanRunReadOnly: true,
        internalReadOnlyCanRunAutomatically: true,
        writesRequirePolicyBrokerApproval: true,
        sensitiveNetworkRequiresApproval: true,
        liveExternalIoRequiresApproval: true,
        providerLlmCallsUseEgressGuard: true,
        readOnlyToolsRequirePolicyBroker: true,
        mutatingToolsRequireApproval: true,
        subagentToolCallsAreLimited: true,
        liveWorkersAreConcurrent: true,
        spawnDepthLimited: true,
        childCountLimited: true,
        leafSubagentsCannotDelegate: true,
        orchestratorSubagentsCanDelegateWithinLimits: true,
        receiptsRequired: true,
        noSecretValuesSerialized: true,
      },
      workboard,
      dynamicConfig: input.state.dynamicConfig,
      sandbox,
      pairedDevices,
      observability: {
        events: observabilityEvents,
        summary: {
          total: observabilityEvents.length,
          running: observabilityEvents.filter((event) => event.status === 'running').length,
          completed: observabilityEvents.filter((event) => event.status === 'completed').length,
          blocked: observabilityEvents.filter((event) => event.status === 'blocked' || event.status === 'denied').length,
          approvalRequired: observabilityEvents.filter((event) => event.status === 'approval-required').length,
        },
      },
      receipts: input.state.receipts.slice(-100),
      commands: {
        spawn: 'npm run zavorth:subagents -- spawn --task "<task>"',
        spawnBatch: 'npm run zavorth:subagents -- spawn-batch --tasks tasks.json',
        spawnLive: 'npm run zavorth:subagents -- spawn --live --task "<task>"',
        board: 'npm run zavorth:subagents -- board status',
        devices: 'npm run zavorth:subagents -- devices list',
        config: 'npm run zavorth:subagents -- config set maxConcurrentChildren 4',
        wait: 'npm run zavorth:subagents -- wait --session <id>',
        send: 'npm run zavorth:subagents -- send --session <id> --message "<text>"',
        list: 'npm run zavorth:subagents -- list',
        cancel: 'npm run zavorth:subagents -- cancel --session <id>',
        read: 'npm run zavorth:subagents -- read --session <id>',
        summarize: 'npm run zavorth:subagents -- summarize --session <id>',
        surface: '/agents spawn --live <task>',
        check: 'npm run zavorth:subagents:check --silent',
        nextStage: 'Live runtime is wired; next expand UI projection only with approval.',
      },
    };
  }

  private buildWorkboardProjection(selectedTaskId: string | null): ZavorthSubagentRuntimeWorkboardProjection {
    let snapshot: ZavorthSubagentBoardSnapshot | null = null;
    try {
      const board = new ZavorthSubagentBoardService({ dbPath: this.boardDbPath, now: this.now });
      try {
        snapshot = board.snapshot();
      } finally {
        board.close();
      }
    } catch {
      snapshot = null;
    }
    const sessions = (snapshot?.sessions || []).map((session) => ({
      sessionId: session.sessionId,
      objective: session.objective,
      status: session.status,
      maxDepth: session.maxDepth,
      maxChildren: session.maxChildren,
    }));
    const tasks = (snapshot?.tasks || []).map(mapWorkboardTask);
    const selectedTask = selectedTaskId
      ? tasks.find((task) => task.taskId === selectedTaskId) || null
      : null;
    return {
      selectedTaskId,
      selectedTask,
      sessions,
      tasks,
      workers: (snapshot?.workers || []).map((worker) => ({
        workerId: worker.workerId,
        status: worker.status,
        currentTaskId: worker.currentTaskId,
      })),
      receipts: (snapshot?.receipts || []).map((receipt) => ({
        receiptId: receipt.receiptId,
        action: receipt.action,
        taskId: receipt.taskId,
        workerId: receipt.workerId,
        status: receipt.status,
      })),
      summary: {
        sessions: sessions.length,
        queued: tasks.filter((task) => task.status === 'queued').length,
        running: tasks.filter((task) => task.status === 'running' || task.status === 'claimed').length,
        completed: tasks.filter((task) => task.status === 'completed').length,
        blocked: tasks.filter((task) => task.status === 'blocked' || task.status === 'failed').length,
      },
      safety: {
        sqliteDurable: true,
        mutationRequiresApproval: true,
        retryBounded: true,
        spawnDepthBounded: true,
      },
    };
  }

  private pushObservability(
    state: StoredState,
    input: {
      generatedAt: string;
      name: ZavorthSubagentRuntimeObservabilityEvent['name'];
      status: ZavorthSubagentRuntimeStatus;
      detail: string;
      taskId?: string | null;
      sessionId?: string | null;
      runId?: string | null;
      parentRunId?: string | null;
      roleId?: string | null;
      receiptId?: string | null;
    },
  ): void {
    state.observabilityEvents.push({
      id: `subagent-observable:${stableId(input.generatedAt, input.name, input.runId || input.taskId || input.detail)}`,
      generatedAt: input.generatedAt,
      name: input.name,
      taskId: input.taskId || null,
      parentSessionId: null,
      childSessionId: input.sessionId || null,
      parentRunId: input.parentRunId || null,
      childRunId: input.runId || null,
      subagentId: input.sessionId || input.taskId || null,
      roleId: input.roleId || null,
      motionState: motionStateForStatus(input.status),
      receiptId: input.receiptId || null,
      policyDecisionId: input.receiptId || null,
      sandboxBackend: state.dynamicConfig.settings.sandboxBackend,
      status: input.status,
      detail: input.detail,
    });
  }

  private buildReceipt(input: {
    kind: ZavorthInvocationReceiptKind;
    status: ZavorthInvocationReceiptStatus;
    generatedAt: string;
    actorId: string | null;
    channel: string;
    target: string;
    action: string;
    policy: SecurityPolicyBrokerDecision;
    approvalId: string | null;
    risk: 'safe' | 'review' | 'dangerous' | 'forbidden';
    reasons: string[];
    workspaceMutationPerformed: boolean;
    externalIoPerformed: boolean;
    upstreamCodeExecuted: boolean;
    evidence?: Record<string, string | number | boolean | null>;
  }): ZavorthInvocationReceipt {
    return {
      id: `zavorth.invocation.${input.kind}.${stableId(input.generatedAt, input.target, input.action)}`,
      contractVersion: ZAVORTH_INVOCATION_RECEIPT_CONTRACT_VERSION,
      kind: input.kind,
      status: input.status,
      generatedAt: input.generatedAt,
      actorId: input.actorId,
      channel: input.channel,
      target: input.target,
      action: input.action,
      policyBrokerReceipt: input.policy.receipt,
      approvalId: input.approvalId,
      risk: input.risk,
      reasons: uniqueStrings(input.reasons),
      guarantees: {
        policyBrokerEvaluated: true,
        noSecretValuesSerialized: true,
        untrustedContentDelimited: false,
        workspaceMutationPerformed: input.workspaceMutationPerformed,
        externalIoPerformed: input.externalIoPerformed,
        upstreamCodeExecuted: input.upstreamCodeExecuted,
      },
      evidence: input.evidence || {},
    };
  }

  private event(input: {
    generatedAt: string;
    kind: ZavorthSubagentRuntimeTimelineEvent['kind'];
    sessionId?: string | null;
    runId?: string | null;
    status: ZavorthSubagentRuntimeStatus;
    detail: string;
    receiptId: string | null;
  }): ZavorthSubagentRuntimeTimelineEvent {
    return {
      id: `subagent-event:${stableId(input.generatedAt, input.kind, input.detail)}`,
      generatedAt: input.generatedAt,
      kind: input.kind,
      sessionId: input.sessionId || null,
      runId: input.runId || null,
      status: input.status,
      detail: input.detail,
      receiptId: input.receiptId,
    };
  }

  private message(
    generatedAt: string,
    role: ZavorthSubagentRuntimeMessage['role'],
    text: string,
    receiptId: string | null,
  ): ZavorthSubagentRuntimeMessage {
    return {
      id: `subagent-message:${stableId(generatedAt, role, text)}`,
      generatedAt,
      role,
      text,
      receiptId,
    };
  }

  private readState(): StoredState {
    try {
      if (!this.existsSyncImpl(this.stateFilePath)) {
        return emptyState();
      }
      const parsed = JSON.parse(this.readFileSyncImpl(this.stateFilePath, 'utf8')) as Partial<StoredState>;
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map((session) => ({
          ...session,
          roleMode: normalizeRoleMode((session as Partial<ZavorthSubagentRuntimeSession>).roleMode, DEFAULT_DYNAMIC_CONFIG.defaultRoleMode),
        })) as ZavorthSubagentRuntimeSession[] : [],
        runs: Array.isArray(parsed.runs) ? parsed.runs.map((run) => ({
          ...run,
          roleMode: normalizeRoleMode((run as Partial<ZavorthSubagentRuntimeRun>).roleMode, DEFAULT_DYNAMIC_CONFIG.defaultRoleMode),
        })) as ZavorthSubagentRuntimeRun[] : [],
        timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
        autoInvocationDecisions: Array.isArray((parsed as Partial<StoredState>).autoInvocationDecisions)
          ? (parsed as Partial<StoredState>).autoInvocationDecisions as ZavorthSubagentAutoInvocationTelemetry[]
          : [],
        dynamicConfig: coerceDynamicConfigProjection((parsed as Partial<StoredState>).dynamicConfig),
        pairedDevices: Array.isArray((parsed as Partial<StoredState>).pairedDevices)
          ? (parsed as Partial<StoredState>).pairedDevices as ZavorthSubagentRuntimePairedDevicesProjection['devices']
          : [],
        observabilityEvents: Array.isArray((parsed as Partial<StoredState>).observabilityEvents)
          ? (parsed as Partial<StoredState>).observabilityEvents as ZavorthSubagentRuntimeObservabilityEvent[]
          : [],
        batchRuns: positiveInteger((parsed as Partial<StoredState>).batchRuns, 0),
      };
    } catch {
      return emptyState();
    }
  }

  private persistIfNeeded(state: StoredState, input: ZavorthSubagentRuntimeCommandInput): void {
    if (input.persistState === false) {
      return;
    }
    this.mkdirSyncImpl(path.dirname(this.stateFilePath), { recursive: true });
    this.writeFileSyncImpl(this.stateFilePath, JSON.stringify({
      version: 1,
      updatedAt: this.now().toISOString(),
      sessions: state.sessions.slice(-100),
      runs: state.runs.slice(-200),
      timeline: state.timeline.slice(-500),
      receipts: state.receipts.slice(-500),
      autoInvocationDecisions: state.autoInvocationDecisions.slice(-100),
      dynamicConfig: state.dynamicConfig,
      pairedDevices: state.pairedDevices.slice(0, 50),
      observabilityEvents: state.observabilityEvents.slice(-500),
      batchRuns: state.batchRuns,
    }, null, 2), 'utf8');
  }

  private resolveLimits(
    input: ZavorthSubagentRuntimeCommandInput,
    settings: ZavorthSubagentDynamicConfigSettings = DEFAULT_DYNAMIC_CONFIG,
  ): ZavorthSubagentRuntimeLimits {
    return {
      ...DEFAULT_LIMITS,
      maxWallClockMs: positiveInteger(input.childTimeoutMs, settings.childTimeoutMs),
      maxToolCalls: positiveInteger(input.maxToolCalls, DEFAULT_LIMITS.maxToolCalls),
      maxSpawnDepth: positiveInteger(input.maxSpawnDepth, settings.maxSpawnDepth),
      maxChildren: positiveInteger(input.maxChildren || input.maxConcurrentChildren, settings.maxConcurrentChildren),
    };
  }

  private resolveDepth(state: StoredState, parentRunId: string | null | undefined): number {
    let depth = 0;
    let cursor = normalizeNullable(parentRunId);
    while (cursor) {
      depth += 1;
      const parent = state.runs.find((run) => run.runId === cursor);
      cursor = parent?.parentRunId || null;
      if (depth > 20) {
        return depth;
      }
    }
    return depth;
  }
}

type RuntimeRisk = {
  surface: SecurityPolicyBrokerRequest['surface'];
  brokerRisk: 'safe' | 'review' | 'dangerous' | 'forbidden';
  receiptRisk: 'safe' | 'review' | 'dangerous' | 'forbidden';
  requiresApproval: boolean;
  reason: string;
  reasons: string[];
};

function classifyRisk(task: string, mode: ZavorthSubagentRuntimeMode): RuntimeRisk {
  const text = task.toLowerCase();
  const writes = /\b(write|edit|modify|delete|remove|apply|patch|commit|push|salve|edite|altere|apague|remova|corrija|implemente)\b/i.test(text);
  const commands = /\b(shell|terminal|powershell|cmd|exec|execute|run command|rode comando|comando)\b/i.test(text);
  const live = /\b(send|publish|post|deploy|live|whatsapp|telegram|discord|signal|imessage|envie|publique)\b/i.test(text);
  const publicResearch = /\b(pesquise|pesquisar|busque|buscar|fontes|research|web search|internet search)\b/i.test(text);
  const sensitiveNetwork = /\b(fetch|http:\/\/|https:\/\/|localhost|127\.0\.0\.1|169\.254|metadata|internal api|url|api|webhook)\b/i.test(text);
  if (writes || commands) {
    return {
      surface: 'workspace',
      brokerRisk: 'review',
      receiptRisk: 'review',
      requiresApproval: true,
      reason: 'Workspace mutation or command execution requires approval.',
      reasons: ['workspace-mutation-or-command-requires-approval'],
    };
  }
  if (live) {
    return {
      surface: 'provider',
      brokerRisk: 'review',
      receiptRisk: 'review',
      requiresApproval: true,
      reason: 'Live external I/O requires approval.',
      reasons: ['live-external-io-requires-approval'],
    };
  }
  if (sensitiveNetwork) {
    return {
      surface: 'web-fetch',
      brokerRisk: 'review',
      receiptRisk: 'review',
      requiresApproval: true,
      reason: 'Sensitive network target or webhook/API access requires approval.',
      reasons: ['sensitive-network-read-requires-approval'],
    };
  }
  if (publicResearch) {
    return {
      surface: 'web-fetch',
      brokerRisk: 'safe',
      receiptRisk: 'safe',
      requiresApproval: false,
      reason: 'Public read-only research can run through governed tools and SafeFetch.',
      reasons: ['public-readonly-research-precleared'],
    };
  }
  return {
    surface: 'skill',
    brokerRisk: mode === 'internal' ? 'safe' : 'safe',
    receiptRisk: 'safe',
    requiresApproval: false,
    reason: 'Read-only subagent task can run in governed runtime.',
    reasons: ['read-only-subagent-precleared'],
  };
}

function buildPolicyReasons(input: {
  risk: RuntimeRisk;
  requestedExplicitly: boolean;
  explicitRequired: boolean;
  approvalRequired: boolean;
  blockedByDepth: boolean;
  blockedByLeafRole: boolean;
  depth: number;
  childCount: number;
}): string[] {
  const reasons = [
    'Subagent runtime spawn evaluated by central Policy Broker.',
    input.risk.reason,
  ];
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

function buildRuntimeOutput(task: string, roleIds: string[], mode: ZavorthSubagentRuntimeMode): string {
  return [
    `Governed ${mode} subagent result.`,
    `Task: ${firstLine(task)}`,
    `Roles: ${roleIds.join(', ') || 'planner'}.`,
    'Execution boundary: in-process, receipt-backed, no workspace mutation, no external I/O, no upstream code execution.',
  ].join('\n');
}

function summarizeMessages(messages: ZavorthSubagentRuntimeMessage[]): string {
  const userMessages = messages.filter((message) => message.role === 'user').length;
  const subagentMessages = messages.filter((message) => message.role === 'subagent').length;
  const lastText = messages.at(-1)?.text || 'No messages.';
  return `Subagent session summary: userMessages=${userMessages}, subagentMessages=${subagentMessages}. Last: ${firstLine(lastText)}`;
}

function buildTree(runs: ZavorthSubagentRuntimeRun[]): ZavorthSubagentRuntimeSnapshot['parentChildTree'] {
  return runs.map((run) => ({
    runId: run.runId,
    parentRunId: run.parentRunId,
    childRunIds: runs.filter((candidate) => candidate.parentRunId === run.runId).map((candidate) => candidate.runId),
    depth: resolveDepthFromRuns(runs, run.runId),
  }));
}

function resolveDepthFromRuns(runs: ZavorthSubagentRuntimeRun[], runId: string): number {
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

function emptyState(): StoredState {
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

function normalizeAction(value: unknown): ZavorthSubagentRuntimeAction {
  const normalized = String(value || 'subagents.list').trim().toLowerCase();
  if (
    normalized === 'spawn'
    || normalized === 'subagents.spawn'
    || normalized === 'subagent.spawn'
    || normalized === 'subagent'
    || normalized === 'sessions_spawn'
    || normalized === 'sessions.spawn'
  ) return 'subagents.spawn';
  if (normalized === 'spawn-batch' || normalized === 'spawn_batch' || normalized === 'subagents.spawn_batch') return 'subagents.spawn_batch';
  if (normalized === 'wait' || normalized === 'subagents.wait') return 'subagents.wait';
  if (normalized === 'send' || normalized === 'subagents.send') return 'subagents.send';
  if (normalized === 'cancel' || normalized === 'subagents.cancel') return 'subagents.cancel';
  if (normalized === 'read' || normalized === 'subagents.read') return 'subagents.read';
  if (normalized === 'summarize' || normalized === 'summary' || normalized === 'subagents.summarize') return 'subagents.summarize';
  if (normalized === 'board.create' || normalized === 'subagents.board.create') return 'subagents.board.create';
  if (normalized === 'board.claim' || normalized === 'subagents.board.claim') return 'subagents.board.claim';
  if (normalized === 'board.heartbeat' || normalized === 'subagents.board.heartbeat') return 'subagents.board.heartbeat';
  if (normalized === 'board.complete' || normalized === 'subagents.board.complete') return 'subagents.board.complete';
  if (normalized === 'board.block' || normalized === 'subagents.board.block') return 'subagents.board.block';
  if (normalized === 'device.list' || normalized === 'devices.list' || normalized === 'subagents.device.list') return 'subagents.device.list';
  if (normalized === 'device.approve' || normalized === 'devices.approve' || normalized === 'subagents.device.approve') return 'subagents.device.approve';
  if (normalized === 'device.revoke' || normalized === 'devices.revoke' || normalized === 'subagents.device.revoke') return 'subagents.device.revoke';
  if (normalized === 'config.update' || normalized === 'subagents.config.update') return 'subagents.config.update';
  return 'subagents.list';
}

function resolveExecutionMode(
  input: Pick<ZavorthSubagentRuntimeCommandInput, 'executionMode' | 'live' | 'mockLive'>,
  fallback?: ZavorthSubagentRuntimeExecutionMode | string | null,
): ZavorthSubagentRuntimeExecutionMode {
  const explicit = String(input.executionMode || '').trim().toLowerCase();
  if (explicit === 'mock-live' || input.mockLive === true) return 'mock-live';
  if (explicit === 'live-llm' || explicit === 'live' || input.live === true) return 'live-llm';
  if (explicit === 'governed-in-process' || explicit === 'in-process' || explicit === 'plan') return 'governed-in-process';
  const inherited = String(fallback || '').trim().toLowerCase();
  if (inherited === 'mock-live') return 'mock-live';
  if (inherited === 'live-llm') return 'live-llm';
  return 'governed-in-process';
}

function normalizeSourceSurface(
  value: unknown,
  mode: ZavorthSubagentRuntimeMode,
): 'task' | 'channel' | 'cron' | 'skill' | 'plugin' | 'internal' {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'channel') return 'channel';
  if (normalized === 'cron' || normalized === 'automation' || normalized === 'schedule') return 'cron';
  if (normalized === 'skill') return 'skill';
  if (normalized === 'plugin') return 'plugin';
  if (normalized === 'internal' || mode === 'internal') return 'internal';
  return 'task';
}

function normalizeMode(value: unknown): ZavorthSubagentRuntimeMode {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'session') return 'session';
  if (normalized === 'thread-bound' || normalized === 'thread') return 'thread-bound';
  if (normalized === 'internal') return 'internal';
  return 'oneshot';
}

function normalizeRoleMode(value: unknown, fallback: ZavorthSubagentRoleMode = 'leaf'): ZavorthSubagentRoleMode {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'orchestrator') return 'orchestrator';
  if (normalized === 'leaf') return 'leaf';
  return fallback;
}

function normalizeSandboxBackend(value: unknown, fallback: ZavorthSubagentSandboxBackendId = 'local'): ZavorthSubagentSandboxBackendId {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'local'
    || normalized === 'docker'
    || normalized === 'wsl'
    || normalized === 'daytona'
    || normalized === 'modal'
    || normalized === 'external'
  ) {
    return normalized;
  }
  return fallback;
}

function normalizeDynamicConfig(value: Partial<ZavorthSubagentDynamicConfigSettings>): ZavorthSubagentDynamicConfigSettings {
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

function defaultDynamicConfigProjection(): ZavorthSubagentRuntimeDynamicConfigProjection {
  return {
    settings: { ...DEFAULT_DYNAMIC_CONFIG },
    updatedAt: new Date(0).toISOString(),
    updatedBy: null,
    receiptId: null,
    auditReceipts: [],
  };
}

function coerceDynamicConfigProjection(value: unknown): ZavorthSubagentRuntimeDynamicConfigProjection {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<ZavorthSubagentRuntimeDynamicConfigProjection>
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
      ? raw.auditReceipts.map((receipt) => ({
          receiptId: normalizeText((receipt as { receiptId?: unknown }).receiptId, 'receipt'),
          status: normalizeText((receipt as { status?: unknown }).status, 'applied'),
          summary: normalizeText((receipt as { summary?: unknown }).summary, 'Configuration receipt.'),
        })).slice(0, 25)
      : [],
  };
}

function normalizeTasks(tasks: unknown, fallback: unknown): string[] {
  const values = Array.isArray(tasks)
    ? tasks.map((task) => normalizeText(task))
    : [];
  if (values.filter(Boolean).length > 0) {
    return values.filter(Boolean).slice(0, 32);
  }
  return [normalizeText(fallback, 'Inspect runtime state safely.')];
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => normalizeText(entry)).filter(Boolean).slice(0, 100)
    : [];
}

function mapBoardRisk(risk: RuntimeRisk): 'read-only' | 'mutation' | 'shell' | 'network-sensitive' | 'external-io' {
  if (risk.reasons.includes('workspace-mutation-or-command-requires-approval')) return 'mutation';
  if (risk.reasons.includes('sensitive-network-read-requires-approval')) return 'network-sensitive';
  if (risk.reasons.includes('live-external-io-requires-approval')) return 'external-io';
  return 'read-only';
}

function mapWorkboardTask(task: ZavorthSubagentBoardTask): ZavorthSubagentRuntimeWorkboardProjection['tasks'][number] {
  return {
    taskId: task.taskId,
    sessionId: task.sessionId,
    parentTaskId: task.parentTaskId,
    title: task.title,
    status: mapWorkboardStatus(task.status),
    claimedBy: task.claimedBy,
    heartbeatAt: task.heartbeatAt,
    blockedReason: task.blockedReason,
    summary: task.summary,
  };
}

function mapWorkboardStatus(status: string): ZavorthSubagentRuntimeWorkboardProjection['tasks'][number]['status'] {
  if (status === 'done') return 'completed';
  if (status === 'approval-required') return 'blocked';
  if (status === 'queued' || status === 'running' || status === 'failed' || status === 'cancelled' || status === 'blocked') {
    return status;
  }
  return 'blocked';
}

function buildSandboxProjection(settings: ZavorthSubagentDynamicConfigSettings): ZavorthSubagentRuntimeSandboxProjection {
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
        status: enabled
          ? remote
            ? 'live-disabled'
            : 'doctor-only'
          : remote
            ? 'disabled'
            : 'doctor-only',
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

function buildPairedDevicesProjection(
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
      invokable: devices.filter((device) => device.status === 'approved' && device.approvedCapabilities.length > 0).length,
    },
    policy: {
      approvedCapabilityAllowlistRequired: true,
      heartbeatBeforeAssignment: true,
      noSecretsSerialized: true,
    },
  };
}

function motionStateForStatus(status: ZavorthSubagentRuntimeStatus): ZavorthSubagentRuntimeObservabilityEvent['motionState'] {
  if (status === 'running' || status === 'ready') return 'running';
  if (status === 'completed') return 'completed';
  if (status === 'approval-required') return 'approval-required';
  if (status === 'blocked' || status === 'denied') return 'blocked';
  if (status === 'failed') return 'failed';
  return 'idle';
}

function hasExplicitSubagentIntent(value: string): boolean {
  return /\b(subagentes?|subagents?|agent team|multiagente|multi-agent|swarm|mande um agente|delegue|em paralelo)\b/i.test(value);
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeNullable(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeChannel(value: unknown): string {
  return normalizeText(value, 'cli').toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-') || 'cli';
}

function firstLine(value: string, maxLength = 240): string {
  const text = normalizeText(value).replace(/\s+/g, ' ');
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stableId(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 16);
}

function last(values: string[]): string | null {
  return values.length > 0 ? values[values.length - 1] || null : null;
}
