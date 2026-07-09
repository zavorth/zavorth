import path from 'node:path';

import type { ChatMessage, ToolDefinition } from '../providers/ILlmProvider.js';
import type { TaskPlaneItem } from '../contracts/TaskPlaneContract.js';
import { GoalPlaneService, type GoalPlaneItem } from './GoalPlaneService.js';
import { TaskPlaneService } from './TaskPlaneService.js';
import { ZavorthOperationalStateDbService, type ZavorthOperationalReceipt } from './ZavorthOperationalStateDbService.js';
import { logger } from '../logger.js';

export type GoalLoopVerdictStatus = 'continue' | 'done' | 'pause' | 'blocked';

export type GoalLoopJudgeKind = 'llm' | 'heuristic';

export type GoalLoopVerdict = {
  contractVersion: 'goal-loop-verdict/1';
  status: GoalLoopVerdictStatus;
  confidence: number;
  reason: string;
  nextPrompt: string | null;
  evidence: string[];
  judge: GoalLoopJudgeKind;
  providerName: string | null;
  modelName: string | null;
  raw: Record<string, unknown> | null;
};

export type GoalLoopStepSnapshot = {
  contractVersion: 'goal-loop-step/1';
  generatedAt: string;
  goal: GoalPlaneItem | null;
  verdict: GoalLoopVerdict;
  continuationTask: TaskPlaneItem | null;
  receipt: ZavorthOperationalReceipt | null;
  safety: {
    noSilentExecution: true;
    continuationQueuedNotExecuted: true;
    stateDbBacked: boolean;
    llmJudgeOptional: true;
  };
};

export type GoalLoopEvaluateInput = {
  goalId: string;
  turnSummary?: string | null;
  lastAssistantText?: string | null;
  actor?: string | null;
  sourceSurface?: string | null;
  userIntervened?: boolean | null;
  force?: boolean | null;
};

export type GoalLoopLlmRuntime = {
  chatDetailed(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: Record<string, unknown>,
  ): Promise<{
    response: {
      content: string | null;
      metadata?: Record<string, unknown>;
    };
    providerName?: string | null;
    modelName?: string | null;
  }>;
  getPreferredProviderName?: () => string;
};

type GoalLoopServiceOptions = {
  goalPlane: GoalPlaneService;
  taskPlane: TaskPlaneService;
  stateDb?: ZavorthOperationalStateDbService | null;
  stateDbPath?: string | null;
  llmRuntime?: GoalLoopLlmRuntime | null;
  now?: () => Date;
};

export class GoalLoopService {
  private readonly goalPlane: GoalPlaneService;
  private readonly taskPlane: TaskPlaneService;
  private readonly stateDb: ZavorthOperationalStateDbService | null;
  private readonly stateDbPath: string | null;
  private readonly llmRuntime: GoalLoopLlmRuntime | null;
  private readonly now: () => Date;

  constructor(options: GoalLoopServiceOptions) {
    this.goalPlane = options.goalPlane;
    this.taskPlane = options.taskPlane;
    this.stateDb = options.stateDb || null;
    this.stateDbPath = options.stateDbPath ? path.resolve(options.stateDbPath) : null;
    this.llmRuntime = options.llmRuntime || null;
    this.now = options.now || (() => new Date());
  }

  public async evaluate(input: GoalLoopEvaluateInput): Promise<GoalLoopStepSnapshot> {
    const goalId = normalize(input.goalId);
    const actor = normalize(input.actor, 'goal-loop');
    const sourceSurface = normalize(input.sourceSurface, 'goal-loop');
    const current = this.goalPlane.snapshot().goals.find((goal) => goal.id === goalId) || null;
    if (!current) {
      return this.snapshot(null, this.blockedVerdict('Goal was not found.', 'goal-not-found'), null, null);
    }

    if (input.userIntervened) {
      const paused = this.goalPlane.transition(current.id, 'paused', actor, 'user-intervened') || current;
      const verdict = this.verdict({
        status: 'pause',
        confidence: 0.92,
        reason: 'User intervention paused the auto-continuation loop.',
        nextPrompt: null,
        evidence: ['user-intervened'],
        judge: 'heuristic',
      });
      const receipt = this.recordOutcome(paused, verdict, null, sourceSurface);
      return this.snapshot(paused, verdict, null, receipt);
    }

    if (current.status !== 'active') {
      const verdict = this.blockedVerdict(`Goal is ${current.status}, so the loop will not continue it.`, `goal-${current.status}`);
      const receipt = this.recordOutcome(current, verdict, null, sourceSurface);
      return this.snapshot(current, verdict, null, receipt);
    }

    if (!input.force && current.turnsUsed >= current.maxTurns) {
      const paused = this.goalPlane.transition(current.id, 'paused', actor, 'max-turns-reached') || current;
      const verdict = this.verdict({
        status: 'pause',
        confidence: 0.98,
        reason: 'The goal reached its max turn budget.',
        nextPrompt: null,
        evidence: ['max-turns-reached'],
        judge: 'heuristic',
      });
      const receipt = this.recordOutcome(paused, verdict, null, sourceSurface);
      return this.snapshot(paused, verdict, null, receipt);
    }

    const verdict = await this.judge(current, input);
    if (verdict.status === 'done') {
      const done = this.goalPlane.transition(current.id, 'done', actor, verdict.reason) || current;
      const receipt = this.recordOutcome(done, verdict, null, sourceSurface);
      return this.snapshot(done, verdict, null, receipt);
    }

    if (verdict.status === 'pause' || verdict.status === 'blocked') {
      const paused = this.goalPlane.transition(current.id, 'paused', actor, verdict.reason) || current;
      const receipt = this.recordOutcome(paused, verdict, null, sourceSurface);
      return this.snapshot(paused, verdict, null, receipt);
    }

    const progressed = this.goalPlane.recordTurn(current.id, actor, verdict.reason) || current;
    if (progressed.status !== 'active') {
      const pausedVerdict = this.verdict({
        status: 'pause',
        confidence: 0.99,
        reason: 'The goal loop reached the max turn budget while recording this step.',
        nextPrompt: null,
        evidence: ['max-turns-reached'],
        judge: verdict.judge,
        providerName: verdict.providerName,
        modelName: verdict.modelName,
        raw: verdict.raw,
      });
      const receipt = this.recordOutcome(progressed, pausedVerdict, null, sourceSurface);
      return this.snapshot(progressed, pausedVerdict, null, receipt);
    }

    const continuationTask = this.taskPlane.createTask({
      title: `Continue goal: ${title(progressed.objective)}`,
      source: 'goal-loop',
      payload: {
        kind: 'goal-loop-continuation',
        goalId: progressed.id,
        objective: progressed.objective,
        nextPrompt: verdict.nextPrompt || defaultNextPrompt(progressed),
        judge: verdict.judge,
        confidence: verdict.confidence,
        reason: verdict.reason,
        profileId: progressed.profileId,
        sessionId: progressed.sessionId,
        turn: progressed.turnsUsed,
        maxTurns: progressed.maxTurns,
        noSilentExecution: true,
      },
    });
    const receipt = this.recordOutcome(progressed, verdict, continuationTask, sourceSurface);
    return this.snapshot(progressed, verdict, continuationTask, receipt);
  }

  private async judge(goal: GoalPlaneItem, input: GoalLoopEvaluateInput): Promise<GoalLoopVerdict> {
    if (this.llmRuntime) {
      try {
        const result = await this.llmRuntime.chatDetailed(this.judgeMessages(goal, input), [], {
          purpose: 'goal-loop-judge',
          temperature: 0,
          responseFormat: 'json',
        });
        const parsed = parseJsonObject(result.response.content || '');
        if (parsed) {
          return this.verdict({
            status: normalizeVerdictStatus(parsed.status),
            confidence: clamp(Number(parsed.confidence ?? 0.72), 0, 1),
            reason: normalize(parsed.reason, 'LLM judge evaluated the goal.'),
            nextPrompt: normalize(parsed.nextPrompt || parsed.next_prompt) || null,
            evidence: normalizeList(parsed.evidence),
            judge: 'llm',
            providerName: normalize(result.providerName || this.llmRuntime.getPreferredProviderName?.()) || null,
            modelName: normalize(result.modelName || result.response.metadata?.model) || null,
            raw: parsed,
          });
        }
        this.recordParseFailure(goal, result.response.content || '');
      } catch (error: any) {
        this.recordParseFailure(goal, error instanceof Error ? error.message : String(error));
      }
    }
    return this.heuristicJudge(goal, input);
  }

  private heuristicJudge(goal: GoalPlaneItem, input: GoalLoopEvaluateInput): GoalLoopVerdict {
    const text = normalize([
      input.turnSummary,
      input.lastAssistantText,
    ].filter(Boolean).join('\n'));
    const normalized = fold(text);
    if (/\b(done|completed|complete|finished|passou|concluido|concluida|finalizado|finalizada|resolvido|resolvida|qa passou|tests passed)\b/u.test(normalized)) {
      return this.verdict({
        status: 'done',
        confidence: 0.82,
        reason: 'The latest summary indicates the goal is complete.',
        nextPrompt: null,
        evidence: ['completion-language'],
        judge: 'heuristic',
      });
    }
    if (/\b(blocked|bloqueado|bloqueada|falhou|failed|erro|error|approval|aprovacao|aguardando|waiting)\b/u.test(normalized)) {
      return this.verdict({
        status: 'pause',
        confidence: 0.78,
        reason: 'The latest summary indicates the goal needs operator attention before continuing.',
        nextPrompt: null,
        evidence: ['attention-language'],
        judge: 'heuristic',
      });
    }
    return this.verdict({
      status: 'continue',
      confidence: text ? 0.72 : 0.64,
      reason: text
        ? 'The goal still appears active and has room for another continuation step.'
        : 'No completion or blocking signal was provided; queueing a safe continuation task.',
      nextPrompt: defaultNextPrompt(goal, text),
      evidence: text ? ['active-summary'] : ['no-summary'],
      judge: 'heuristic',
    });
  }

  private judgeMessages(goal: GoalPlaneItem, input: GoalLoopEvaluateInput): ChatMessage[] {
    const recentEvents = this.withStateDb((stateDb) => stateDb.listEvents({ stream: 'goal-loop', limit: 12 }), []);
    return [
      {
        role: 'system',
        content: [
          'You are Zavorth Goal Loop Judge.',
          'Return JSON only. Never request direct execution.',
          'Decide whether this persistent goal should continue, be marked done, or pause for operator attention.',
          'Allowed status values: continue, done, pause, blocked.',
          'If continuing, write a concise nextPrompt for a separated worker task.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          goal: {
            id: goal.id,
            objective: goal.objective,
            status: goal.status,
            turnsUsed: goal.turnsUsed,
            maxTurns: goal.maxTurns,
            sessionId: goal.sessionId,
            profileId: goal.profileId,
          },
          turnSummary: input.turnSummary || null,
          lastAssistantText: input.lastAssistantText || null,
          recentGoalLoopEvents: recentEvents.map((event) => ({
            type: event.type,
            subjectId: event.subjectId,
            payload: event.payload,
          })),
          requiredShape: {
            status: 'continue|done|pause|blocked',
            confidence: '0..1',
            reason: 'short reason',
            nextPrompt: 'required only when status is continue',
            evidence: ['short signals'],
          },
        }),
      },
    ];
  }

  private recordOutcome(
    goal: GoalPlaneItem,
    verdict: GoalLoopVerdict,
    continuationTask: TaskPlaneItem | null,
    sourceSurface: string,
  ): ZavorthOperationalReceipt | null {
    return this.withStateDb((stateDb) => {
      stateDb.recordEvent('goal-loop', 'goal.loop.evaluated', goal.id, {
        verdict: {
          status: verdict.status,
          confidence: verdict.confidence,
          reason: verdict.reason,
          judge: verdict.judge,
        },
        continuationTaskId: continuationTask?.id || null,
      });
      if (continuationTask) {
        stateDb.recordEvent('goal-loop', 'goal.loop.continuation.queued', goal.id, {
          taskId: continuationTask.id,
          turn: goal.turnsUsed,
          noSilentExecution: true,
        });
      }
      return stateDb.recordReceipt({
        actionId: 'goals.loop.step',
        status: verdict.status === 'continue' ? 'queued' : verdict.status,
        sourceSurface,
        summary: `Goal loop ${verdict.status}: ${goal.objective}`,
        data: {
          goalId: goal.id,
          verdict,
          continuationTaskId: continuationTask?.id || null,
        },
      });
    }, null);
  }

  private recordParseFailure(goal: GoalPlaneItem, detail: string): void {
    this.withStateDb((stateDb) => {
      stateDb.recordEvent('goal-loop', 'goal.loop.judge.parse_failed', goal.id, {
        detail: detail.slice(0, 800),
      });
      return null;
    }, null);
  }

  private snapshot(
    goal: GoalPlaneItem | null,
    verdict: GoalLoopVerdict,
    continuationTask: TaskPlaneItem | null,
    receipt: ZavorthOperationalReceipt | null,
  ): GoalLoopStepSnapshot {
    return {
      contractVersion: 'goal-loop-step/1',
      generatedAt: this.now().toISOString(),
      goal,
      verdict,
      continuationTask,
      receipt,
      safety: {
        noSilentExecution: true,
        continuationQueuedNotExecuted: true,
        stateDbBacked: Boolean(this.stateDb || this.stateDbPath),
        llmJudgeOptional: true,
      },
    };
  }

  private blockedVerdict(reason: string, evidence: string): GoalLoopVerdict {
    return this.verdict({
      status: 'blocked',
      confidence: 1,
      reason,
      nextPrompt: null,
      evidence: [evidence],
      judge: 'heuristic',
    });
  }

  private verdict(input: {
    status: GoalLoopVerdictStatus;
    confidence: number;
    reason: string;
    nextPrompt?: string | null;
    evidence: string[];
    judge: GoalLoopJudgeKind;
    providerName?: string | null;
    modelName?: string | null;
    raw?: Record<string, unknown> | null;
  }): GoalLoopVerdict {
    return {
      contractVersion: 'goal-loop-verdict/1',
      status: input.status,
      confidence: clamp(input.confidence, 0, 1),
      reason: normalize(input.reason, 'Goal loop evaluated the goal.'),
      nextPrompt: normalize(input.nextPrompt) || null,
      evidence: input.evidence.map((entry) => normalize(entry)).filter(Boolean),
      judge: input.judge,
      providerName: normalize(input.providerName) || null,
      modelName: normalize(input.modelName) || null,
      raw: input.raw || null,
    };
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
}

function defaultNextPrompt(goal: GoalPlaneItem, context?: string): string {
  const suffix = context ? `\n\nLatest context:\n${context.slice(0, 1200)}` : '';
  return `Continue the active goal with one focused, auditable next step.\n\nGoal: ${goal.objective}${suffix}`;
}

function normalize(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function title(value: string): string {
  const text = value.replace(/\s+/gu, ' ').trim();
  return text.length <= 72 ? text : `${text.slice(0, 69)}...`;
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase();
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeVerdictStatus(value: unknown): GoalLoopVerdictStatus {
  const text = fold(normalize(value));
  if (text === 'done' || text === 'complete' || text === 'completed') return 'done';
  if (text === 'pause' || text === 'paused' || text === 'wait' || text === 'waiting') return 'pause';
  if (text === 'blocked' || text === 'block') return 'blocked';
  return 'continue';
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => normalize(entry)).filter(Boolean).slice(0, 12);
  }
  const text = normalize(value);
  return text ? [text] : [];
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  const text = normalize(value);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch (error: any) {
    const match = text.match(/\{[\s\S]*\}/u);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch (error: any) { logger.warn('[Goal Loop] JSON parse failed', error); return null; }
  }
}
