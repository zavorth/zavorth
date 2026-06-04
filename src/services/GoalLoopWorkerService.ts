import path from 'node:path';

import type { TaskPlaneItem, TaskPlaneStatus } from '../contracts/TaskPlaneContract.js';
import type { AgentRunExecutionOptions } from '../runtime/agent/AgentRunService.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRunResult,
} from '../runtime/agent/UniversalAgentRuntimeTypes.js';
import { GoalLoopService, type GoalLoopStepSnapshot } from './GoalLoopService.js';
import type { GoalPlaneService } from './GoalPlaneService.js';
import type { TaskPlaneService } from './TaskPlaneService.js';
import { ZavorthOperationalStateDbService, type ZavorthOperationalReceipt } from './ZavorthOperationalStateDbService.js';

export type GoalLoopAgentRunner = {
  run(input: UniversalAgentRequest, options?: AgentRunExecutionOptions): Promise<UniversalAgentRunResult>;
};

export type GoalLoopWorkerRunSnapshot = {
  contractVersion: 'goal-loop-worker-run/1';
  generatedAt: string;
  workerId: string;
  task: TaskPlaneItem | null;
  agentRun: GoalLoopWorkerAgentRunSummary | null;
  loop: GoalLoopStepSnapshot | null;
  receipt: ZavorthOperationalReceipt | null;
  safety: {
    claimedBeforeExecution: true;
    agentRunPolicyPath: true;
    profileForwarded: boolean;
    budgetForwarded: boolean;
    rejudgedAfterRun: boolean;
  };
};

type GoalLoopWorkerAgentRunSummary = {
  ok: boolean;
  runId: string | null;
  status: string | null;
  summary: string | null;
  replyText: string | null;
  approvalIds: string[];
};

export type GoalLoopWorkerDrainSnapshot = {
  contractVersion: 'goal-loop-worker-drain/1';
  generatedAt: string;
  workerId: string;
  processed: number;
  maxItems: number;
  runs: GoalLoopWorkerRunSnapshot[];
};

type GoalLoopWorkerOptions = {
  goalPlane: GoalPlaneService;
  taskPlane: TaskPlaneService;
  loop: GoalLoopService;
  agentRunner: GoalLoopAgentRunner;
  stateDb?: ZavorthOperationalStateDbService | null;
  stateDbPath?: string | null;
  now?: () => Date;
};

type RunNextInput = {
  taskId?: string | null;
  workerId?: string | null;
  leaseMs?: number | null;
  dryRun?: boolean | null;
  executionOptions?: AgentRunExecutionOptions;
};

type DrainInput = RunNextInput & {
  maxItems?: number | null;
};

export class GoalLoopWorkerService {
  private readonly goalPlane: GoalPlaneService;
  private readonly taskPlane: TaskPlaneService;
  private readonly loop: GoalLoopService;
  private readonly agentRunner: GoalLoopAgentRunner;
  private readonly stateDb: ZavorthOperationalStateDbService | null;
  private readonly stateDbPath: string | null;
  private readonly now: () => Date;

  constructor(options: GoalLoopWorkerOptions) {
    this.goalPlane = options.goalPlane;
    this.taskPlane = options.taskPlane;
    this.loop = options.loop;
    this.agentRunner = options.agentRunner;
    this.stateDb = options.stateDb || null;
    this.stateDbPath = options.stateDbPath ? path.resolve(options.stateDbPath) : null;
    this.now = options.now || (() => new Date());
  }

  public preview(input: { taskId?: string | null; workerId?: string | null } = {}): GoalLoopWorkerRunSnapshot {
    const task = this.findCandidate(input.taskId || null);
    return this.snapshot({
      workerId: normalize(input.workerId, 'goal-loop-worker'),
      task,
      agentRun: null,
      loop: null,
      receipt: null,
    });
  }

  public async drain(input: DrainInput = {}): Promise<GoalLoopWorkerDrainSnapshot> {
    const workerId = normalize(input.workerId, 'goal-loop-worker');
    const maxItems = clampInt(Number(input.maxItems || 1), 1, 25);
    const runs: GoalLoopWorkerRunSnapshot[] = [];
    for (let index = 0; index < maxItems; index += 1) {
      const result = await this.runNext({
        ...input,
        workerId,
        taskId: index === 0 ? input.taskId : null,
      });
      if (!result.task) break;
      runs.push(result);
      if (input.dryRun) break;
      if (!result.loop || result.loop.verdict.status !== 'continue') break;
    }
    return {
      contractVersion: 'goal-loop-worker-drain/1',
      generatedAt: this.timestamp(),
      workerId,
      processed: runs.filter((run) => run.agentRun).length,
      maxItems,
      runs,
    };
  }

  public async runNext(input: RunNextInput = {}): Promise<GoalLoopWorkerRunSnapshot> {
    const workerId = normalize(input.workerId, 'goal-loop-worker');
    const candidate = this.findCandidate(input.taskId || null);
    if (!candidate) {
      return this.snapshot({
        workerId,
        task: null,
        agentRun: null,
        loop: null,
        receipt: this.recordReceipt(workerId, null, null, null, 'blocked', 'No queued Goal Loop continuation task was available.'),
      });
    }

    if (input.dryRun) {
      return this.snapshot({
        workerId,
        task: candidate,
        agentRun: null,
        loop: null,
        receipt: null,
      });
    }

    const claimed = this.taskPlane.claimTask(candidate.id, workerId, input.leaseMs || 5 * 60 * 1000);
    if (!claimed) {
      return this.snapshot({
        workerId,
        task: candidate,
        agentRun: null,
        loop: null,
        receipt: this.recordReceipt(workerId, candidate, null, null, 'blocked', `Task ${candidate.id} could not be claimed.`),
      });
    }

    const running = this.taskPlane.updateStatus(claimed.id, 'running', workerId, 'goal-loop-worker-started') || claimed;
    this.recordEvent('goal.loop.worker.started', payloadForTask(running, { workerId }));

    try {
      const request = this.buildAgentRequest(running);
      const result = await this.agentRunner.run(request, input.executionOptions || {});
      const agentRun = summarizeAgentRun(result);
      const taskStatus = resolveTaskStatus(result);
      const completedTask = this.taskPlane.updateStatus(
        running.id,
        taskStatus,
        workerId,
        `agent-run:${agentRun.runId || 'unknown'}:${agentRun.status || 'unknown'}`,
      ) || running;
      const loop = await this.loop.evaluate({
        goalId: normalize(running.payload.goalId),
        turnSummary: buildTurnSummary(agentRun, completedTask),
        lastAssistantText: agentRun.replyText,
        actor: workerId,
        sourceSurface: 'goal-loop-worker',
      });
      this.recordEvent('goal.loop.worker.completed', payloadForTask(completedTask, {
        workerId,
        agentRun,
        rejudgedVerdict: loop.verdict.status,
        nextTaskId: loop.continuationTask?.id || null,
      }));
      const receipt = this.recordReceipt(
        workerId,
        completedTask,
        agentRun,
        loop,
        taskStatus === 'done' ? 'completed' : taskStatus,
        `Goal Loop worker processed ${completedTask.id}.`,
      );
      return this.snapshot({
        workerId,
        task: completedTask,
        agentRun,
        loop,
        receipt,
      });
    } catch (error) {
      const failedTask = this.taskPlane.updateStatus(
        running.id,
        'failed',
        workerId,
        error instanceof Error ? error.message : String(error),
      ) || running;
      const agentRun = {
        ok: false,
        runId: null,
        status: 'failed',
        summary: error instanceof Error ? error.message : String(error),
        replyText: null,
        approvalIds: [],
      };
      const loop = await this.loop.evaluate({
        goalId: normalize(running.payload.goalId),
        turnSummary: `Goal Loop worker failed: ${agentRun.summary}`,
        actor: workerId,
        sourceSurface: 'goal-loop-worker',
      });
      this.recordEvent('goal.loop.worker.failed', payloadForTask(failedTask, {
        workerId,
        error: agentRun.summary,
        rejudgedVerdict: loop.verdict.status,
      }));
      const receipt = this.recordReceipt(
        workerId,
        failedTask,
        agentRun,
        loop,
        'failed',
        `Goal Loop worker failed ${failedTask.id}.`,
      );
      return this.snapshot({
        workerId,
        task: failedTask,
        agentRun,
        loop,
        receipt,
      });
    }
  }

  private findCandidate(taskId: string | null): TaskPlaneItem | null {
    const tasks = this.taskPlane.listTasks()
      .filter((task) => task.source === 'goal-loop')
      .filter((task) => normalize(task.payload.kind) === 'goal-loop-continuation')
      .filter((task) => task.status === 'queued' || (task.status === 'claimed' && claimExpired(task, this.now())))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'queued' ? -1 : 1;
        return Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id);
      });
    if (taskId) {
      return tasks.find((task) => task.id === taskId) || null;
    }
    return tasks[0] || null;
  }

  private buildAgentRequest(task: TaskPlaneItem): UniversalAgentRequest {
    const goalId = normalize(task.payload.goalId);
    const profileId = normalize(task.payload.profileId || task.payload.profile, 'personal');
    const sessionId = normalize(task.payload.sessionId, `goal-loop:${goalId || task.id}`);
    const prompt = normalize(task.payload.nextPrompt || task.payload.prompt || task.payload.objective, 'Continue this goal with one focused step.');
    const allowedTools = Array.isArray(task.payload.allowedTools)
      ? task.payload.allowedTools.map((tool) => normalize(tool)).filter(Boolean)
      : [];
    return {
      requestId: `goal-loop:${task.id}:${task.attempts + 1}`,
      traceId: `goal-loop:${sessionId}:${task.id}`,
      userId: normalize(task.payload.userId, 'goal-loop-worker'),
      channel: 'cli',
      sessionId,
      text: prompt,
      workspace: normalize(task.payload.workspace) || null,
      requestedTools: allowedTools.length ? allowedTools : undefined,
      replyPort: {
        id: `goal-loop-port:${task.id}`,
        label: 'Goal Loop worker',
        kind: 'cli',
        status: 'available',
        primary: true,
      },
      metadata: {
        profileId,
        profile: profileId,
        mode: 'goal-loop-continuation',
        goalLoop: {
          goalId,
          taskId: task.id,
          turn: task.payload.turn ?? null,
          maxTurns: task.payload.maxTurns ?? null,
        },
        goalLoopBudget: {
          maxToolRounds: clampInt(Number(task.payload.maxToolRounds || 4), 1, 20),
          maxContinuationTasks: clampInt(Number(task.payload.maxContinuationTasks || 1), 1, 10),
        },
        capabilityNegotiationApproved: true,
        profileCapabilities: true,
        autoLiveSubagents: false,
      },
    };
  }

  private snapshot(input: {
    workerId: string;
    task: TaskPlaneItem | null;
    agentRun: GoalLoopWorkerRunSnapshot['agentRun'];
    loop: GoalLoopStepSnapshot | null;
    receipt: ZavorthOperationalReceipt | null;
  }): GoalLoopWorkerRunSnapshot {
    const profileForwarded = Boolean(normalize(input.task?.payload.profileId || input.task?.payload.profile));
    return {
      contractVersion: 'goal-loop-worker-run/1',
      generatedAt: this.timestamp(),
      workerId: input.workerId,
      task: input.task,
      agentRun: input.agentRun,
      loop: input.loop,
      receipt: input.receipt,
      safety: {
        claimedBeforeExecution: true,
        agentRunPolicyPath: true,
        profileForwarded,
        budgetForwarded: Boolean(input.task),
        rejudgedAfterRun: Boolean(input.loop),
      },
    };
  }

  private recordReceipt(
    workerId: string,
    task: TaskPlaneItem | null,
    agentRun: GoalLoopWorkerRunSnapshot['agentRun'],
    loop: GoalLoopStepSnapshot | null,
    status: string,
    summary: string,
  ): ZavorthOperationalReceipt | null {
    return this.withStateDb((stateDb) => stateDb.recordReceipt({
      actionId: 'goals.loop.worker',
      status,
      sourceSurface: 'goal-loop-worker',
      summary,
      data: {
        workerId,
        taskId: task?.id || null,
        goalId: normalize(task?.payload.goalId) || null,
        agentRun,
        loopVerdict: loop?.verdict.status || null,
        continuationTaskId: loop?.continuationTask?.id || null,
      },
    }), null);
  }

  private recordEvent(type: string, payload: Record<string, unknown>): void {
    this.withStateDb((stateDb) => {
      stateDb.recordEvent('goal-loop', type, normalize(payload.goalId) || null, payload);
      return null;
    }, null);
  }

  private withStateDb<T>(fn: (stateDb: ZavorthOperationalStateDbService) => T, fallback: T): T {
    if (this.stateDb) return fn(this.stateDb);
    if (!this.stateDbPath) return fallback;
    const stateDb = new ZavorthOperationalStateDbService({ dbPath: this.stateDbPath, now: this.now });
    try {
      return fn(stateDb);
    } finally {
      stateDb.close();
    }
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function summarizeAgentRun(result: UniversalAgentRunResult): GoalLoopWorkerAgentRunSummary {
  const replyText = result.replies[0]?.text || result.run.summary || null;
  return {
    ok: result.ok,
    runId: result.run.id,
    status: result.run.status,
    summary: result.run.summary || null,
    replyText,
    approvalIds: result.run.approvals.map((approval: { id: string }) => approval.id),
  };
}

function resolveTaskStatus(result: UniversalAgentRunResult): TaskPlaneStatus {
  if (result.run.status === 'waiting_approval') return 'waiting_approval';
  if (result.run.status === 'failed') return 'failed';
  if (result.run.status === 'cancelled') return 'cancelled';
  return result.ok ? 'done' : 'failed';
}

function buildTurnSummary(agentRun: GoalLoopWorkerAgentRunSummary | null, task: TaskPlaneItem): string {
  if (!agentRun) return `Task ${task.id} finished without agent run output.`;
  const neutralStatus = agentRun.status === 'completed' ? 'ok' : agentRun.status || 'unknown';
  const approval = agentRun.approvalIds.length ? ` Approval required: ${agentRun.approvalIds.join(', ')}.` : '';
  return [
    `Worker task ${task.id} returned AgentRun status ${neutralStatus}.`,
    agentRun.summary ? `Summary: ${agentRun.summary}` : '',
    agentRun.replyText ? `Reply: ${agentRun.replyText}` : '',
    approval,
  ].filter(Boolean).join(' ');
}

function payloadForTask(task: TaskPlaneItem, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    taskId: task.id,
    goalId: normalize(task.payload.goalId) || null,
    taskStatus: task.status,
    ...extra,
  };
}

function normalize(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function claimExpired(task: TaskPlaneItem, now: Date): boolean {
  if (!task.claim?.leaseUntil) return false;
  const leaseUntil = Date.parse(task.claim.leaseUntil);
  return Number.isFinite(leaseUntil) && leaseUntil <= now.getTime();
}
