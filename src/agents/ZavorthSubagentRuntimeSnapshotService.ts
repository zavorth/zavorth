import {
  ZAVORTH_SUBAGENT_RUNTIME_CONTRACT_VERSION,
  type ZavorthSubagentRuntimeAction,
  type ZavorthSubagentRuntimeLimits,
  type ZavorthSubagentRuntimeMessage,
  type ZavorthSubagentRuntimeMode,
  type ZavorthSubagentRuntimeObservabilityEvent,
  type ZavorthSubagentRuntimeSnapshot,
  type ZavorthSubagentRuntimeStatus,
  type ZavorthSubagentRuntimeTimelineEvent,
  type ZavorthSubagentRuntimeWorkboardProjection,
} from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';
import type { ZavorthSubagentAutoInvocationTelemetry } from '../contracts/runtime/ZavorthSubagentAutoInvocationContract.js';
import { ZAVORTH_INVOCATION_RECEIPT_CONTRACT_VERSION, type ZavorthInvocationReceipt, type ZavorthInvocationReceiptKind, type ZavorthInvocationReceiptStatus } from '../contracts/runtime/ZavorthInvocationReceiptContract.js';
import type { SecurityPolicyBrokerDecision } from '../security/SecurityPolicyBroker.js';
import { buildAutoInvocationZavorthControlProjection } from '../services/ZavorthSubagentRuntimeTelemetrySupport.js';
import { buildSubagentIdentity } from '../services/ZavorthSubagentIdentityService.js';
import { ZavorthSubagentBoardService, type ZavorthSubagentBoardSnapshot } from '../services/ZavorthSubagentBoardService.js';
import { logger } from '../logger.js';
import { buildPairedDevicesProjection, buildSandboxProjection, buildTree, mapWorkboardTask, motionStateForStatus, stableId, uniqueStrings, type StoredState } from './ZavorthSubagentRuntimeHelpers.js';

export class ZavorthSubagentRuntimeSnapshotService {
  public constructor(
    private readonly now: () => Date,
    private readonly projectRoot: string,
    private readonly boardDbPath: string,
  ) {}

  public snapshot(input: {
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
    const runAutoInvocations = runs.map((run) => run.autoInvocation).filter((entry): entry is ZavorthSubagentAutoInvocationTelemetry => Boolean(entry));
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
        liveRuns: runs.filter((run) => run.executionMode === 'live-llm' || run.executionMode === 'dry-live').length,
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
        nextAction: 'Live runtime is wired; next expand UI projection only with approval.',
      },
    };
  }

  public buildWorkboardProjection(selectedTaskId: string | null): ZavorthSubagentRuntimeWorkboardProjection {
    let snapshot: ZavorthSubagentBoardSnapshot | null = null;
    try {
      const board = new ZavorthSubagentBoardService({ dbPath: this.boardDbPath, now: this.now });
      try {
        snapshot = board.snapshot();
      } finally {
        board.close();
      }
    } catch (error: unknown) {
      logger.warn('[Zavorth Subagent Runtime] resource cleanup failed', error);
      snapshot = null;
    }
    const sessions = (snapshot?.sessions || []).map((session) => ({
      sessionId: session.sessionId,
      objective: session.objective,
      status: session.status,
      maxDepth: session.maxDepth,
      maxChildren: session.maxChildren,
    }));
    const receipts = snapshot?.receipts || [];
    const tasks = (snapshot?.tasks || []).map((task) => mapWorkboardTask(task, receipts));
    const selectedTask = selectedTaskId ? tasks.find((task) => task.taskId === selectedTaskId) || null : null;
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
      receipts: receipts.map((receipt) => ({
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

  public pushObservability(
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
    const identity = input.roleId
      ? buildSubagentIdentity({
          roleId: input.roleId,
          sessionId: input.sessionId || input.taskId || 'subagent-observability',
          status: input.status,
        })
      : null;

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
      identity,
      receiptId: input.receiptId || null,
      policyDecisionId: input.receiptId || null,
      sandboxBackend: state.dynamicConfig.settings.sandboxBackend,
      status: input.status,
      detail: input.detail,
    });
  }

  public buildReceipt(input: {
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

  public event(input: {
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

  public message(generatedAt: string, role: ZavorthSubagentRuntimeMessage['role'], text: string, receiptId: string | null): ZavorthSubagentRuntimeMessage {
    return {
      id: `subagent-message:${stableId(generatedAt, role, text)}`,
      generatedAt,
      role,
      text,
      receiptId,
    };
  }
}
