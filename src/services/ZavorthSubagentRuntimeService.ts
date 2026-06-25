import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import {
  ZAVORTH_SUBAGENT_RUNTIME_CONTRACT_VERSION,
  type ZavorthSubagentRuntimeAction,
  type ZavorthSubagentRuntimeExecutionMode,
  type ZavorthSubagentRuntimeLimits,
  type ZavorthSubagentRuntimeMessage,
  type ZavorthSubagentRuntimeMode,
  type ZavorthSubagentRuntimeRun,
  type ZavorthSubagentRuntimeSession,
  type ZavorthSubagentRuntimeSnapshot,
  type ZavorthSubagentRuntimeStatus,
  type ZavorthSubagentRuntimeTimelineEvent,
  type ZavorthSubagentRuntimeWorkerResult,
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
import type { SecurityProfileId } from '../security/SecurityProfile.js';
import {
  createSubagentApprovalBoundary,
  createSubagentBudget,
  createSubagentCapabilityScope,
  createSubagentResultReceipt,
  type SubagentResultReceipt,
} from '../runtime/agent/subagents/index.js';
import { ZavorthGovernedSubagentService } from './ZavorthGovernedSubagentService.js';
import {
  ZavorthLiveSubagentExecutionService,
  type ZavorthLiveSubagentExecutionResult,
} from './ZavorthLiveSubagentExecutionService.js';
import {
  buildAutoInvocationDashboardProjection,
  normalizeAutoInvocation,
} from './ZavorthSubagentRuntimeTelemetrySupport.js';
import {
  AUTO_SUBAGENT_DECISION_LABEL,
  formatSubagentRuntimeSnapshotText,
} from './ZavorthSubagentRuntimePresenter.js';
import {
  compareSubagentRunsByActivity,
  compareSubagentSessionsByActivity,
  isLatestSubagentReference,
} from './ZavorthSubagentRuntimeStateSelectors.js';

type DecideSecurityPolicy = (
  request: SecurityPolicyBrokerRequest,
  runtime?: { now?: () => Date },
) => SecurityPolicyBrokerDecision;

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  stateFilePath?: string;
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
  autoInvocation?: ZavorthSubagentAutoInvocationTelemetry | null;
  securityProfile?: SecurityProfileId | string | null;
  maxSpawnDepth?: number | null;
  maxChildren?: number | null;
  persistState?: boolean | null;
};

type StoredState = {
  sessions: ZavorthSubagentRuntimeSession[];
  runs: ZavorthSubagentRuntimeRun[];
  timeline: ZavorthSubagentRuntimeTimelineEvent[];
  receipts: ZavorthInvocationReceipt[];
  autoInvocationDecisions: ZavorthSubagentAutoInvocationTelemetry[];
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

export class ZavorthSubagentRuntimeService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly stateFilePath: string;
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
    const sourceSurface = normalizeSourceSurface(input.sourceSurface, mode);
    const channel = normalizeChannel(input.channel);
    const actorId = normalizeNullable(input.actorId);
    const requestedExplicitly = input.explicitSubagents === true || hasExplicitSubagentIntent(task);
    const risk = classifyRisk(task, mode);
    const limits = this.resolveLimits(input);
    const depth = this.resolveDepth(state, input.parentRunId);
    const childCount = state.runs.filter((run) => run.parentRunId === normalizeNullable(input.parentRunId)).length;
    const blockedByDepth = depth > limits.maxSpawnDepth || childCount >= limits.maxChildren;
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
      risk: blockedByDepth || explicitRequired ? 'forbidden' : approvalRequired ? 'review' : 'safe',
      blocked: blockedByDepth || explicitRequired,
      userConfirmationRequired: approvalRequired,
      reasons: buildPolicyReasons({
        risk,
        requestedExplicitly,
        explicitRequired,
        approvalRequired,
        blockedByDepth,
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
      executionMode,
      sourceSurface,
      channel,
      actorId,
      threadId: normalizeNullable(input.threadId),
      status,
      createdAt: generatedAt,
      updatedAt: generatedAt,
      roleIds,
      profileSummaries: profiles.map((profile) => ({
        id: profile.id,
        label: profile.label,
        objective: profile.objective,
      })),
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
    const limits = this.resolveLimits(input);
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
      },
      autoInvocationTelemetry: {
        latest: latestAutoInvocation,
        decisions: autoInvocationDecisions,
        dashboardProjection: buildAutoInvocationDashboardProjection(latestAutoInvocation),
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
        receiptsRequired: true,
        noSecretValuesSerialized: true,
      },
      receipts: input.state.receipts.slice(-100),
      commands: {
        spawn: 'npm run zavorth:subagents -- spawn --task "<task>"',
        spawnLive: 'npm run zavorth:subagents -- spawn --live --task "<task>"',
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
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        runs: Array.isArray(parsed.runs) ? parsed.runs : [],
        timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
        autoInvocationDecisions: Array.isArray((parsed as Partial<StoredState>).autoInvocationDecisions)
          ? (parsed as Partial<StoredState>).autoInvocationDecisions as ZavorthSubagentAutoInvocationTelemetry[]
          : [],
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
    }, null, 2), 'utf8');
  }

  private resolveLimits(input: ZavorthSubagentRuntimeCommandInput): ZavorthSubagentRuntimeLimits {
    return {
      ...DEFAULT_LIMITS,
      maxToolCalls: positiveInteger(input.maxToolCalls, DEFAULT_LIMITS.maxToolCalls),
      maxSpawnDepth: positiveInteger(input.maxSpawnDepth, DEFAULT_LIMITS.maxSpawnDepth),
      maxChildren: positiveInteger(input.maxChildren, DEFAULT_LIMITS.maxChildren),
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
  if (normalized === 'wait' || normalized === 'subagents.wait') return 'subagents.wait';
  if (normalized === 'send' || normalized === 'subagents.send') return 'subagents.send';
  if (normalized === 'cancel' || normalized === 'subagents.cancel') return 'subagents.cancel';
  if (normalized === 'read' || normalized === 'subagents.read') return 'subagents.read';
  if (normalized === 'summarize' || normalized === 'summary' || normalized === 'subagents.summarize') return 'subagents.summarize';
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stableId(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 16);
}

function last(values: string[]): string | null {
  return values.length > 0 ? values[values.length - 1] || null : null;
}
