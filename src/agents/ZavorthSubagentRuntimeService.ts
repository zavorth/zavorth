import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
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
} from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';
import type { ZavorthSubagentAutoInvocationTelemetry } from '../contracts/runtime/ZavorthSubagentAutoInvocationContract.js';
import {
  ZAVORTH_INVOCATION_RECEIPT_CONTRACT_VERSION,
  type ZavorthInvocationReceipt,
  type ZavorthInvocationReceiptKind,
  type ZavorthInvocationReceiptStatus,
} from '../contracts/runtime/ZavorthInvocationReceiptContract.js';
import type {
  ZavorthGovernedSubagentProfile,
  ZavorthGovernedSubagentProfileId,
} from '../contracts/runtime/ZavorthGovernedSubagentContract.js';
import {
  decideSecurityPolicy,
  type SecurityPolicyBrokerDecision,
  type SecurityPolicyBrokerRequest,
} from '../security/SecurityPolicyBroker.js';
import { ZavorthGovernedSubagentService } from '../services/ZavorthGovernedSubagentService.js';
import {
  buildAutoInvocationZavorthControlProjection,
  normalizeAutoInvocation,
} from '../services/ZavorthSubagentRuntimeTelemetrySupport.js';
import {
  AUTO_SUBAGENT_DECISION_LABEL,
  formatSubagentRuntimeSnapshotText,
} from '../services/ZavorthSubagentRuntimePresenter.js';
import { buildSubagentIdentity } from '../services/ZavorthSubagentIdentityService.js';
import { logger } from '../logger.js';
import { ZavorthSubagentRuntimeSnapshotService } from './ZavorthSubagentRuntimeSnapshotService.js';
import { ZavorthSubagentRuntimeStateService } from './ZavorthSubagentRuntimeStateService.js';
import {
  DEFAULT_DYNAMIC_CONFIG,
  DEFAULT_LIMITS,
  buildPairedDevicesProjection,
  buildPolicyReasons,
  buildRuntimeOutput,
  buildSandboxProjection,
  buildTree,
  clampInt,
  classifyRisk,
  coerceDynamicConfigProjection,
  defaultDynamicConfigProjection,
  emptyState,
  firstLine,
  last,
  mapBoardRisk,
  mapWorkboardStatus,
  mapWorkboardTask,
  motionStateForStatus,
  normalizeAction,
  normalizeChannel,
  normalizeDynamicConfig,
  normalizeMode,
  normalizeNullable,
  normalizeRoleMode,
  normalizeSandboxBackend,
  normalizeSourceSurface,
  normalizeStringList,
  normalizeTasks,
  normalizeText,
  positiveInteger,
  resolveDepthFromRuns,
  resolveExecutionMode,
  stableId,
  summarizeMessages,
  uniqueStrings,
  type RuntimeRisk,
  type StoredState,
} from './ZavorthSubagentRuntimeHelpers.js';

import type { SecurityProfileId } from '../security/SecurityProfile.js';
import {
  createSubagentApprovalBoundary,
  createSubagentBudget,
  createSubagentCapabilityScope,
  createSubagentResultReceipt,
  type SubagentResultReceipt,
} from '../runtime/agent/subagents/index.js';

import {
  ZavorthLiveSubagentExecutionService,
  type ZavorthLiveSubagentExecutionResult,
} from '../services/ZavorthLiveSubagentExecutionService.js';

import {
  compareSubagentRunsByActivity,
  compareSubagentSessionsByActivity,
  isLatestSubagentReference,
} from '../services/ZavorthSubagentRuntimeStateSelectors.js';

import {
  ZavorthSubagentBoardService,
  type ZavorthSubagentBoardSnapshot,
  type ZavorthSubagentBoardTask,
} from '../services/ZavorthSubagentBoardService.js';
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
  /** Structured risk signals — free-text task never keyword-routes risk. */
  riskHints?: Partial<RuntimeRisk> | null;
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
  private readonly snapshotSupport: ZavorthSubagentRuntimeSnapshotService;
  private readonly stateSupport: ZavorthSubagentRuntimeStateService;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.stateFilePath =
      runtime.stateFilePath || path.join(this.projectRoot, '.zavorth', 'subagents', 'runtime-state.json');
    this.boardDbPath = runtime.boardDbPath || path.join(this.projectRoot, '.zavorth', 'subagents', 'workboard.sqlite');
    this.governedSubagents =
      runtime.governedSubagentService ||
      new ZavorthGovernedSubagentService({
        now: this.now,
        projectRoot: this.projectRoot,
      });
    this.liveSubagents =
      runtime.liveSubagentExecutionService ||
      new ZavorthLiveSubagentExecutionService({
        now: this.now,
        toolRuntime: runtime.toolRuntime || null,
      });
    this.decidePolicy = runtime.decidePolicy || decideSecurityPolicy;
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.snapshotSupport = new ZavorthSubagentRuntimeSnapshotService(this.now, this.projectRoot, this.boardDbPath);
    this.stateSupport = new ZavorthSubagentRuntimeStateService(
      this.now,
      this.stateFilePath,
      this.existsSyncImpl,
      this.mkdirSyncImpl,
      this.readFileSyncImpl,
      this.writeFileSyncImpl,
    );
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
    const state = this.stateSupport.readState();
    const generatedAt = this.now().toISOString();
    const task = normalizeText(input.task || input.message, 'Inspect runtime state safely.');
    const autoInvocation = normalizeAutoInvocation(input.autoInvocation, generatedAt);
    const mode = normalizeMode(input.mode);
    const executionMode = resolveExecutionMode(input);
    const roleMode = normalizeRoleMode(input.roleMode, state.dynamicConfig.settings.defaultRoleMode);
    const sourceSurface = normalizeSourceSurface(input.sourceSurface, mode);
    const channel = normalizeChannel(input.channel);
    const actorId = normalizeNullable(input.actorId);
    // Structured flag only — free-text keywords never unlock spawn (LLM/tools decide).
    const requestedExplicitly = input.explicitSubagents === true;
    const risk = classifyRisk(task, mode, { riskHints: input.riskHints || null });
    const limits = this.stateSupport.resolveLimits(input, state.dynamicConfig.settings);
    const depth = this.stateSupport.resolveDepth(state, input.parentRunId);
    const childCount = state.runs.filter((run) => run.parentRunId === normalizeNullable(input.parentRunId)).length;
    const blockedByDepth = depth > limits.maxSpawnDepth || childCount >= limits.maxChildren;
    const parentRun = this.stateSupport.findRun(state, input.parentRunId);
    const blockedByLeafRole = Boolean(
      normalizeNullable(input.parentRunId) && (roleMode === 'leaf' || parentRun?.roleMode === 'leaf'),
    );
    const approvalId = normalizeNullable(input.approvalId);
    const approvalRequired = risk.requiresApproval && !approvalId;
    const explicitRequired = mode !== 'internal' && !requestedExplicitly;
    const policy = this.decidePolicy(
      {
        surface: risk.surface,
        operation: 'subagent-runtime-spawn',
        target: firstLine(task),
        profile: input.securityProfile || undefined,
        workspace: this.projectRoot,
        sourceTrust: 'trusted',
        risk:
          blockedByDepth || blockedByLeafRole || explicitRequired ? 'forbidden' : approvalRequired ? 'review' : 'safe',
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
      },
      { now: this.now },
    );

    if (!policy.allowed) {
      const status: ZavorthSubagentRuntimeStatus = policy.requiresUserConfirmation ? 'approval-required' : 'denied';
      const receipt = this.snapshotSupport.buildReceipt({
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
      state.timeline.push(
        this.snapshotSupport.event({
          generatedAt,
          kind: policy.requiresUserConfirmation ? 'approval' : 'denial',
          status,
          detail: policy.reasons.join(' '),
          receiptId: receipt.id,
        }),
      );
      this.stateSupport.persistIfNeeded(state, input);
      return this.snapshotSupport.snapshot({
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
    const liveWorkerBlocked = Boolean(
      liveResult &&
        liveResult.workerResults.length > 0 &&
        liveResult.workerResults.every((worker) => worker.status === 'failed'),
    );
    const subagentReceipts = profiles.map((profile) =>
      this.buildSubagentReceipt({
        profile,
        runId,
        policy,
        approvalId,
        risk,
        limits,
        status: mode === 'oneshot' || mode === 'internal' || liveResult ? 'completed' : 'planned',
      }),
    );
    const completed = !liveWorkerBlocked && (mode === 'oneshot' || mode === 'internal' || Boolean(liveResult));
    const status: ZavorthSubagentRuntimeStatus = liveWorkerBlocked ? 'blocked' : completed ? 'completed' : 'running';
    const receipt = this.snapshotSupport.buildReceipt({
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
        this.snapshotSupport.message(generatedAt, 'user', task, receipt.id),
        this.snapshotSupport.message(generatedAt, 'subagent', output, receipt.id),
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
        ? liveResult?.summary || `Completed governed ${mode} subagent run with ${roleIds.length} role(s).`
        : liveWorkerBlocked
          ? liveResult?.summary || 'Live subagent workers were blocked or failed.'
          : null,
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
    state.timeline.push(
      this.snapshotSupport.event({
        generatedAt,
        kind: 'spawn',
        sessionId,
        runId,
        status,
        detail: `Spawned ${mode} governed subagent runtime for ${roleIds.join(', ')} (${executionMode}).`,
        receiptId: receipt.id,
      }),
    );
    this.snapshotSupport.pushObservability(state, {
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
    this.snapshotSupport.pushObservability(state, {
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
    this.snapshotSupport.pushObservability(state, {
      generatedAt: run.completedAt || generatedAt,
      name:
        status === 'completed' ? 'subagent.completed' : status === 'blocked' ? 'subagent.blocked' : 'subagent.started',
      status,
      detail: run.summary || `Subagent run is ${status}.`,
      sessionId,
      runId,
      parentRunId: run.parentRunId,
      roleId: roleIds[0] || null,
      receiptId: receipt.id,
    });
    for (const worker of liveResult?.workerResults || []) {
      state.timeline.push(
        this.snapshotSupport.event({
          generatedAt: worker.completedAt,
          kind: 'worker',
          sessionId,
          runId,
          status: worker.status === 'completed' ? 'completed' : 'failed',
          detail: `${worker.roleId} ${worker.status} via ${worker.backend}.`,
          receiptId: receipt.id,
        }),
      );
    }
    this.stateSupport.persistIfNeeded(state, input);
    return this.snapshotSupport.snapshot({
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
      const aggregate = this.stateSupport.readState();
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
      return this.snapshotSupport.snapshot({
        state: aggregate,
        action: 'subagents.spawn_batch',
        mode: normalizeMode(input.mode),
        status: 'completed',
        selectedSessionId: latestRun?.sessionId || null,
        selectedRunId: latestRun?.runId || null,
        limits: this.stateSupport.resolveLimits(input, aggregate.dynamicConfig.settings),
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
    const state = this.stateSupport.readState();
    const generatedAt = this.now().toISOString();
    state.batchRuns += 1;
    state.timeline.push(
      this.snapshotSupport.event({
        generatedAt,
        kind: 'spawn_batch',
        status: 'completed',
        detail: `Spawned ${tasks.length} governed subagent task(s) in batch.`,
        receiptId: null,
      }),
    );
    this.stateSupport.persistIfNeeded(state, input);
    const latestRun = [...state.runs].sort(compareSubagentRunsByActivity)[0] || null;
    return this.snapshotSupport.snapshot({
      state,
      action: 'subagents.spawn_batch',
      mode: normalizeMode(input.mode),
      status: 'completed',
      selectedSessionId: latestRun?.sessionId || null,
      selectedRunId: latestRun?.runId || null,
      limits: this.stateSupport.resolveLimits(input, state.dynamicConfig.settings),
    });
  }

  public async executeBoardAction(
    action: Extract<
      ZavorthSubagentRuntimeAction,
      | 'subagents.board.create'
      | 'subagents.board.claim'
      | 'subagents.board.heartbeat'
      | 'subagents.board.complete'
      | 'subagents.board.block'
    >,
    input: ZavorthSubagentRuntimeCommandInput,
  ): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.stateSupport.readState();
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
        const enqueued = tasks.map((task) =>
          board.enqueueTask({
            sessionId: session.sessionId,
            title: task,
            risk: mapBoardRisk(classifyRisk(task, normalizeMode(input.mode), { riskHints: input.riskHints || null })),
            approvalId: input.approvalId,
          }),
        );
        selectedTaskId = enqueued[0]?.taskId || null;
        detail = `Created workboard session with ${enqueued.length} task(s).`;
      } else if (action === 'subagents.board.claim') {
        const claimed = board.claimNextTask({
          workerId: normalizeText(input.workerId, 'worker'),
          heartbeatTtlMs: state.dynamicConfig.settings.childTimeoutMs,
        });
        selectedTaskId = claimed?.taskId || null;
        detail = claimed
          ? `Task claimed by ${normalizeText(input.workerId, 'worker')}.`
          : 'No queued workboard task is available.';
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
          status: 'completed',
          summary: normalizeText(input.message, 'Task completed.'),
          comment: normalizeText(input.message, 'Task completed.'),
          evidenceRefs: [],
          artifactRefs: [],
        });
        detail = `Completed workboard task ${task.taskId}.`;
      } else if (action === 'subagents.board.block' && selectedTaskId) {
        const task = board.completeTask({
          taskId: selectedTaskId,
          workerId: normalizeText(input.workerId, 'worker'),
          status: 'blocked',
          summary: normalizeText(input.message, 'Task blocked.'),
          comment: normalizeText(input.message, 'Task blocked.'),
          evidenceRefs: ['blocked'],
          artifactRefs: ['blocked'],
        });
        detail = `Blocked workboard task ${task.taskId}.`;
      }
    } finally {
      board.close();
    }
    const policy = this.decideReadPolicy(action, selectedTaskId || 'subagent-workboard', input);
    const receipt = this.snapshotSupport.buildReceipt({
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
    state.timeline.push(
      this.snapshotSupport.event({
        generatedAt,
        kind: action === 'subagents.board.heartbeat' ? 'heartbeat' : 'board',
        status: 'ready',
        detail,
        receiptId: receipt.id,
      }),
    );
    if (action === 'subagents.board.heartbeat') {
      this.snapshotSupport.pushObservability(state, {
        generatedAt,
        name: 'subagent.heartbeat',
        status: 'running',
        detail,
        taskId: selectedTaskId,
        receiptId: receipt.id,
      });
    }
    if (action === 'subagents.board.complete') {
      this.snapshotSupport.pushObservability(state, {
        generatedAt,
        name: 'subagent.completed',
        status: 'completed',
        detail,
        taskId: selectedTaskId,
        receiptId: receipt.id,
      });
    }
    this.stateSupport.persistIfNeeded(state, input);
    return this.snapshotSupport.snapshot({
      state,
      action,
      mode: normalizeMode(input.mode),
      status: 'ready',
      selectedSessionId: null,
      selectedRunId: null,
      selectedWorkboardTaskId: selectedTaskId,
      limits: this.stateSupport.resolveLimits(input, state.dynamicConfig.settings),
    });
  }

  public async updateDynamicConfig(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.stateSupport.readState();
    const generatedAt = this.now().toISOString();
    const patch: Partial<ZavorthSubagentDynamicConfigSettings> = {
      ...(input.configPatch || {}),
      ...(input.maxConcurrentChildren ? { maxConcurrentChildren: input.maxConcurrentChildren } : {}),
      ...(input.maxSpawnDepth ? { maxSpawnDepth: input.maxSpawnDepth } : {}),
      ...(input.childTimeoutMs ? { childTimeoutMs: input.childTimeoutMs } : {}),
      ...(input.roleMode
        ? { defaultRoleMode: normalizeRoleMode(input.roleMode, state.dynamicConfig.settings.defaultRoleMode) }
        : {}),
      ...(input.sandboxBackend
        ? { sandboxBackend: normalizeSandboxBackend(input.sandboxBackend, state.dynamicConfig.settings.sandboxBackend) }
        : {}),
      ...(input.cloudSandboxEnabled !== null && input.cloudSandboxEnabled !== undefined
        ? { cloudSandboxEnabled: input.cloudSandboxEnabled }
        : {}),
      ...(input.inheritToolsets !== null && input.inheritToolsets !== undefined
        ? { inheritToolsets: input.inheritToolsets }
        : {}),
    };
    const policy = this.decideReadPolicy('subagent-runtime-config-update', 'subagent-dynamic-config', input);
    const receipt = this.snapshotSupport.buildReceipt({
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
    state.timeline.push(
      this.snapshotSupport.event({
        generatedAt,
        kind: 'config',
        status: 'ready',
        detail: 'Subagent dynamic configuration updated.',
        receiptId: receipt.id,
      }),
    );
    this.stateSupport.persistIfNeeded(state, input);
    return this.snapshotSupport.snapshot({
      state,
      action: 'subagents.config.update',
      mode: normalizeMode(input.mode),
      status: 'ready',
      selectedSessionId: null,
      selectedRunId: null,
      limits: this.stateSupport.resolveLimits(input, state.dynamicConfig.settings),
    });
  }

  public async executeDeviceAction(
    action: Extract<
      ZavorthSubagentRuntimeAction,
      'subagents.device.list' | 'subagents.device.approve' | 'subagents.device.revoke'
    >,
    input: ZavorthSubagentRuntimeCommandInput,
  ): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.stateSupport.readState();
    const generatedAt = this.now().toISOString();
    const deviceId = normalizeText(input.deviceId, 'mock-device');
    const policy = this.decideReadPolicy(action, deviceId, input);
    const receipt = this.snapshotSupport.buildReceipt({
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
      const capabilities =
        normalizeStringList(input.deviceCapabilities).length > 0
          ? normalizeStringList(input.deviceCapabilities)
          : ['device.info'];
      const approvedDevice: ZavorthSubagentRuntimePairedDevicesProjection['devices'][number] = {
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
      };
      state.pairedDevices = [
        approvedDevice,
        ...state.pairedDevices.filter((device) => device.deviceId !== deviceId),
      ].slice(0, 50);
    } else if (action === 'subagents.device.revoke') {
      state.pairedDevices = state.pairedDevices.map(
        (device): ZavorthSubagentRuntimePairedDevicesProjection['devices'][number] =>
          device.deviceId === deviceId
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
            : device,
      );
    }
    state.receipts.push(receipt);
    state.timeline.push(
      this.snapshotSupport.event({
        generatedAt,
        kind: 'device',
        status: 'ready',
        detail:
          action === 'subagents.device.list'
            ? 'Paired device registry listed.'
            : `Paired device action applied: ${action}.`,
        receiptId: receipt.id,
      }),
    );
    this.stateSupport.persistIfNeeded(state, input);
    return this.snapshotSupport.snapshot({
      state,
      action,
      mode: normalizeMode(input.mode),
      status: 'ready',
      selectedSessionId: null,
      selectedRunId: null,
      limits: this.stateSupport.resolveLimits(input, state.dynamicConfig.settings),
    });
  }

  public async wait(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    return this.updateRunState(input, 'subagents.wait', 'wait', 'completed');
  }

  public async send(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.stateSupport.readState();
    const generatedAt = this.now().toISOString();
    const session = this.stateSupport.findSession(state, input.sessionId || input.runId || null);
    const sessionId = session?.sessionId || normalizeNullable(input.sessionId);
    const messageText = normalizeText(input.message || input.task, '');
    const channel = normalizeChannel(input.channel || session?.channel);
    const actorId = normalizeNullable(input.actorId || session?.actorId);
    if (!session || !messageText) {
      return this.notFoundSnapshot(state, 'subagents.send', sessionId, input);
    }
    const risk = classifyRisk(messageText, session.mode, { riskHints: input.riskHints || null });
    const approvalId = normalizeNullable(input.approvalId);
    const policy = this.decidePolicy(
      {
        surface: risk.surface,
        operation: 'subagent-runtime-send',
        target: sessionId || 'unknown-session',
        profile: input.securityProfile || undefined,
        workspace: this.projectRoot,
        sourceTrust: 'trusted',
        risk: risk.requiresApproval && !approvalId ? 'review' : 'safe',
        userConfirmationRequired: risk.requiresApproval && !approvalId,
        reasons: ['Subagent session message evaluated by Policy Broker before append.', risk.reason],
      },
      { now: this.now },
    );
    const receipt = this.snapshotSupport.buildReceipt({
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
      state.timeline.push(
        this.snapshotSupport.event({
          generatedAt,
          kind: policy.requiresUserConfirmation ? 'approval' : 'denial',
          sessionId,
          status: policy.requiresUserConfirmation ? 'approval-required' : 'denied',
          detail: policy.reasons.join(' '),
          receiptId: receipt.id,
        }),
      );
      this.stateSupport.persistIfNeeded(state, input);
      return this.snapshotSupport.snapshot({
        state,
        action: 'subagents.send',
        mode: session.mode,
        status: policy.requiresUserConfirmation ? 'approval-required' : 'denied',
        selectedSessionId: sessionId,
        selectedRunId: last(session.runIds),
        limits: this.stateSupport.resolveLimits(input),
      });
    }
    const executionMode = resolveExecutionMode(input, session.executionMode);
    const sourceSurface = normalizeSourceSurface(input.sourceSurface, session.mode);
    const profiles = this.pickProfiles(session.roleIds);
    const runId = `subagent-run:${stableId(session.sessionId, generatedAt, messageText)}`;
    const limits = this.stateSupport.resolveLimits(input, state.dynamicConfig.settings);
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
    const liveWorkerBlocked = Boolean(
      liveResult &&
        liveResult.workerResults.length > 0 &&
        liveResult.workerResults.every((worker) => worker.status === 'failed'),
    );
    receipt.guarantees.externalIoPerformed = liveResult?.externalIoPerformed || false;
    receipt.evidence = {
      ...receipt.evidence,
      executionMode,
      sourceSurface,
      liveWorkers: liveResult?.workerResults.length || 0,
    };
    if (liveResult) {
      const subagentReceipts = profiles.map((profile) =>
        this.buildSubagentReceipt({
          profile,
          runId,
          policy,
          approvalId,
          risk,
          limits,
          status: 'completed',
        }),
      );
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
        state.timeline.push(
          this.snapshotSupport.event({
            generatedAt: worker.completedAt,
            kind: 'worker',
            sessionId: session.sessionId,
            runId,
            status: worker.status === 'completed' ? 'completed' : 'failed',
            detail: `${worker.roleId} ${worker.status} via ${worker.backend}.`,
            receiptId: receipt.id,
          }),
        );
      }
    }
    session.messages.push(this.snapshotSupport.message(generatedAt, 'user', messageText, receipt.id));
    session.messages.push(this.snapshotSupport.message(generatedAt, 'subagent', output, receipt.id));
    session.executionMode = executionMode;
    session.sourceSurface = sourceSurface;
    session.status = liveWorkerBlocked ? 'blocked' : session.status;
    session.updatedAt = generatedAt;
    state.timeline.push(
      this.snapshotSupport.event({
        generatedAt,
        kind: 'send',
        sessionId,
        runId: last(session.runIds),
        status: session.status,
        detail: 'Message appended to governed subagent session.',
        receiptId: receipt.id,
      }),
    );
    this.stateSupport.persistIfNeeded(state, input);
    return this.snapshotSupport.snapshot({
      state,
      action: 'subagents.send',
      mode: session.mode,
      status: session.status,
      selectedSessionId: sessionId,
      selectedRunId: last(session.runIds),
      limits: this.stateSupport.resolveLimits(input),
    });
  }

  public async cancel(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    return this.updateRunState(input, 'subagents.cancel', 'cancel', 'cancelled');
  }

  public async read(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.stateSupport.readState();
    const session = this.stateSupport.findSession(state, input.sessionId || input.runId || null);
    const sessionId = session?.sessionId || normalizeNullable(input.sessionId);
    if (!session) {
      return this.notFoundSnapshot(state, 'subagents.read', sessionId, input);
    }
    const generatedAt = this.now().toISOString();
    const policy = this.decideReadPolicy('subagent-runtime-read', sessionId || 'unknown-session', input);
    const receipt = this.snapshotSupport.buildReceipt({
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
    state.timeline.push(
      this.snapshotSupport.event({
        generatedAt,
        kind: 'read',
        sessionId,
        runId: last(session.runIds),
        status: session.status,
        detail: 'Subagent session read with receipt.',
        receiptId: receipt.id,
      }),
    );
    this.stateSupport.persistIfNeeded(state, input);
    return this.snapshotSupport.snapshot({
      state,
      action: 'subagents.read',
      mode: session.mode,
      status: session.status,
      selectedSessionId: sessionId,
      selectedRunId: last(session.runIds),
      limits: this.stateSupport.resolveLimits(input),
    });
  }

  public async summarize(input: ZavorthSubagentRuntimeCommandInput): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.stateSupport.readState();
    const session = this.stateSupport.findSession(state, input.sessionId || input.runId || null);
    const sessionId = session?.sessionId || normalizeNullable(input.sessionId);
    if (!session) {
      return this.notFoundSnapshot(state, 'subagents.summarize', sessionId, input);
    }
    const generatedAt = this.now().toISOString();
    const policy = this.decideReadPolicy('subagent-runtime-summarize', sessionId || 'unknown-session', input);
    const summary = summarizeMessages(session.messages);
    const receipt = this.snapshotSupport.buildReceipt({
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
    session.messages.push(this.snapshotSupport.message(generatedAt, 'system', summary, receipt.id));
    session.updatedAt = generatedAt;
    state.timeline.push(
      this.snapshotSupport.event({
        generatedAt,
        kind: 'summarize',
        sessionId,
        runId: last(session.runIds),
        status: session.status,
        detail: 'Subagent session summarized with traceable receipt.',
        receiptId: receipt.id,
      }),
    );
    this.stateSupport.persistIfNeeded(state, input);
    return this.snapshotSupport.snapshot({
      state,
      action: 'subagents.summarize',
      mode: session.mode,
      status: session.status,
      selectedSessionId: sessionId,
      selectedRunId: last(session.runIds),
      limits: this.stateSupport.resolveLimits(input),
    });
  }

  public async list(input: ZavorthSubagentRuntimeCommandInput = {}): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.stateSupport.readState();
    const generatedAt = this.now().toISOString();
    const policy = this.decideReadPolicy('subagent-runtime-list', 'all-subagents', input);
    const receipt = this.snapshotSupport.buildReceipt({
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
    state.timeline.push(
      this.snapshotSupport.event({
        generatedAt,
        kind: 'list',
        status: 'ready',
        detail: 'Listed governed subagent runtime state.',
        receiptId: receipt.id,
      }),
    );
    this.stateSupport.persistIfNeeded(state, input);
    return this.snapshotSupport.snapshot({
      state,
      action: 'subagents.list',
      mode: normalizeMode(input.mode),
      status: 'ready',
      selectedSessionId: null,
      selectedRunId: null,
      limits: this.stateSupport.resolveLimits(input),
    });
  }

  public formatSnapshotText(snapshot: ZavorthSubagentRuntimeSnapshot): string {
    // Marker for the subagent decision gate: Auto subagent decision is rendered by the presenter.
    void AUTO_SUBAGENT_DECISION_LABEL;
    return formatSubagentRuntimeSnapshotText(snapshot);
  }

  private async updateRunState(
    input: ZavorthSubagentRuntimeCommandInput,
    action: ZavorthSubagentRuntimeAction,
    kind: 'wait' | 'cancel',
    status: 'completed' | 'cancelled',
  ): Promise<ZavorthSubagentRuntimeSnapshot> {
    const state = this.stateSupport.readState();
    const generatedAt = this.now().toISOString();
    const session = this.stateSupport.findSession(state, input.sessionId || input.runId || null);
    const sessionId = session?.sessionId || normalizeNullable(input.sessionId);
    const runId = normalizeNullable(input.runId) || session?.runIds.at(-1) || null;
    const run = this.stateSupport.findRun(state, runId || sessionId);
    if (!run || !session) {
      return this.notFoundSnapshot(state, action, sessionId || runId, input);
    }
    const policy = this.decideReadPolicy(`subagent-runtime-${kind}`, run.runId, input);
    run.status = status;
    run.completedAt = generatedAt;
    run.summary =
      status === 'completed'
        ? `Completed governed subagent run ${run.runId}.`
        : `Cancelled governed subagent run ${run.runId}.`;
    run.output = run.output || buildRuntimeOutput(run.task, run.roleIds, run.mode);
    session.status = status;
    session.updatedAt = generatedAt;
    const receipt = this.snapshotSupport.buildReceipt({
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
    state.timeline.push(
      this.snapshotSupport.event({
        generatedAt,
        kind,
        sessionId: session.sessionId,
        runId: run.runId,
        status,
        detail: run.summary,
        receiptId: receipt.id,
      }),
    );
    this.stateSupport.persistIfNeeded(state, input);
    return this.snapshotSupport.snapshot({
      state,
      action,
      mode: run.mode,
      status,
      selectedSessionId: session.sessionId,
      selectedRunId: run.runId,
      limits: this.stateSupport.resolveLimits(input),
    });
  }

  private notFoundSnapshot(
    state: StoredState,
    action: ZavorthSubagentRuntimeAction,
    target: string | null,
    input: ZavorthSubagentRuntimeCommandInput,
  ): ZavorthSubagentRuntimeSnapshot {
    const generatedAt = this.now().toISOString();
    const policy = this.decidePolicy(
      {
        surface: 'skill',
        operation: action,
        target: target || 'missing-subagent-session',
        profile: input.securityProfile || undefined,
        blocked: true,
        risk: 'forbidden',
        rule: 'SUBAGENT_RUNTIME_NOT_FOUND',
        reasons: ['Subagent session or run was not found.'],
      },
      { now: this.now },
    );
    const receipt = this.snapshotSupport.buildReceipt({
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
    state.timeline.push(
      this.snapshotSupport.event({
        generatedAt,
        kind: 'denial',
        status: 'not-found',
        detail: 'Subagent session or run was not found.',
        receiptId: receipt.id,
      }),
    );
    return this.snapshotSupport.snapshot({
      state,
      action,
      mode: normalizeMode(input.mode),
      status: 'not-found',
      selectedSessionId: normalizeNullable(input.sessionId),
      selectedRunId: normalizeNullable(input.runId),
      limits: this.stateSupport.resolveLimits(input),
    });
  }

  private decideReadPolicy(
    operation: string,
    target: string,
    input: ZavorthSubagentRuntimeCommandInput,
  ): SecurityPolicyBrokerDecision {
    return this.decidePolicy(
      {
        surface: 'skill',
        operation,
        target,
        profile: input.securityProfile || undefined,
        workspace: this.projectRoot,
        sourceTrust: 'trusted',
        risk: 'safe',
        reasons: ['Read-only subagent runtime operation evaluated by Policy Broker.'],
      },
      { now: this.now },
    );
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
      policyTags: ['zavorth-subagent-runtime', `policy:${input.policy.action}`],
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
      maxWallClockMs: input.limits.maxWallClockMs,
      maxOutputBytes: input.limits.maxOutputChars,
    });
  }
}
