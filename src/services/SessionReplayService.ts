import type {
  SessionContinuitySnapshot,
  SessionContinuityTask,
} from './SessionContinuityService.js';
import type { WorkflowRunSnapshot } from '../runtime/workflows/WorkflowRunService.js';
import type { ExecutionLifecycleRecord } from '../contracts/ExecutionLifecycleContract.js';
import {
  ExecutionLifecycleLinkService,
  type ExecutionLifecycleContextLink,
} from './ExecutionLifecycleLinkService.js';

type ReplayRecord = Record<string, unknown>;
type ReplayTaskInput = SessionContinuityTask | ReplayRecord;
type ReplayPermissionInput = ReplayRecord;
type NormalizedReplayPermission = {
  permissionId: string;
  taskId: string | null;
  executor: string | null;
  kind: string | null;
  status: string | null;
  reason: string | null;
  updatedAt: string | null;
};

export type SessionReplayArtifactSnapshot = {
  id: string;
  label: string;
  kind: string;
  summary: string | null;
  path: string | null;
  createdAt: string | null;
  sourceTaskId: string | null;
};

export type SessionReplayStepSnapshot = {
  id: string;
  kind: 'focus' | 'task' | 'workflow' | 'permission' | 'artifact';
  label: string;
  detail: string;
  status: string | null;
  source: string | null;
  happenedAt: string | null;
  targetId: string | null;
};

export type SessionReplaySnapshot = {
  generatedAt: string;
  headline: string;
  operatorSummary: string;
  focusTask: SessionContinuityTask | null;
  dominantSurface: string | null;
  executionContext: ExecutionLifecycleContextLink | null;
  stats: {
    tasks: number;
    workflowRuns: number;
    pendingPermissions: number;
    artifacts: number;
    linkedSurfaces: number;
  };
  recommendedEntry: {
    kind: 'task' | 'workflow' | 'fresh';
    label: string;
    reason: string;
    targetId: string | null;
  };
  recentArtifacts: SessionReplayArtifactSnapshot[];
  timeline: SessionReplayStepSnapshot[];
  lifecycle: ExecutionLifecycleRecord[];
};

type SessionReplayRuntime = {
  now?: () => Date;
};

export class SessionReplayService {
  private readonly now: () => Date;
  private readonly lifecycleLinks = new ExecutionLifecycleLinkService();

  constructor(runtime: SessionReplayRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: {
    continuity?: SessionContinuitySnapshot | null;
    tasks?: ReplayTaskInput[] | null;
    permissions?: ReplayPermissionInput[] | null;
    workflowRuns?: WorkflowRunSnapshot[] | null;
  }): SessionReplaySnapshot {
    const continuity = input.continuity || null;
    const tasks = (Array.isArray(input.tasks) ? input.tasks : [])
      .map((task) => this.normalizeTask(task))
      .filter((task): task is SessionContinuityTask => Boolean(task))
      .sort((left, right) => this.getTimestamp(right.updatedAt) - this.getTimestamp(left.updatedAt));
    const permissions = (Array.isArray(input.permissions) ? input.permissions : [])
      .map((permission) => this.normalizePermission(permission))
      .filter((permission): permission is NormalizedReplayPermission => Boolean(permission))
      .sort((left, right) => this.getTimestamp(right.updatedAt) - this.getTimestamp(left.updatedAt));
    const workflowRuns = (Array.isArray(input.workflowRuns) ? input.workflowRuns : [])
      .filter((run): run is WorkflowRunSnapshot => Boolean(run))
      .sort((left, right) => this.getTimestamp(right.updated_at) - this.getTimestamp(left.updated_at));
    const focusTask = continuity?.focusTask || continuity?.activeTask || tasks[0] || null;
    const recentArtifacts = this.collectArtifacts(input.tasks || []).slice(0, 4);
    const dominantSurface = this.resolveDominantSurface(continuity, tasks);
    const recommendedEntry = this.buildRecommendedEntry({
      continuity,
      focusTask,
      tasks,
      workflowRuns,
    });
    const executionContext = this.resolveExecutionContext({
      continuity,
      focusTask,
      tasks,
      workflowRuns,
      recommendedEntry,
      dominantSurface,
    });
    const timeline = this.buildTimeline({
      continuity,
      focusTask,
      tasks,
      permissions,
      workflowRuns,
      artifacts: recentArtifacts,
    });
    const lifecycle = this.lifecycleLinks.buildReplayLifecycle(timeline, {
      traceId: executionContext?.traceId || `replay:${continuity?.sessionId || focusTask?.taskId || recommendedEntry.targetId || 'fresh'}`,
      runId: executionContext?.runId || `replay:${continuity?.sessionId || focusTask?.taskId || recommendedEntry.targetId || 'fresh'}`,
      sessionId: executionContext?.sessionId || continuity?.sessionId || continuity?.chatId || null,
      approvalId: executionContext?.approvalId || null,
      artifactId: executionContext?.artifactId || null,
      parentId: recommendedEntry.targetId || executionContext?.parentId || null,
      surface: executionContext?.surface || dominantSurface,
      source: 'session-replay',
    });

    return {
      generatedAt: this.now().toISOString(),
      headline: this.buildHeadline({
        focusTask,
        recommendedEntry,
        workflowRuns,
        tasks,
      }),
      operatorSummary: this.buildOperatorSummary({
        dominantSurface,
        tasks,
        workflowRuns,
        permissions,
        recentArtifacts,
      }),
      focusTask,
      dominantSurface,
      executionContext,
      stats: {
        tasks: tasks.length,
        workflowRuns: workflowRuns.length,
        pendingPermissions: permissions.filter((permission) => permission.status === 'pending').length,
        artifacts: recentArtifacts.length,
        linkedSurfaces: Array.isArray(continuity?.linkedSurfaces) ? continuity!.linkedSurfaces.length : 0,
      },
      recommendedEntry,
      recentArtifacts,
      timeline,
      lifecycle,
    };
  }

  private buildHeadline(input: {
    focusTask: SessionContinuityTask | null;
    recommendedEntry: SessionReplaySnapshot['recommendedEntry'];
    workflowRuns: WorkflowRunSnapshot[];
    tasks: SessionContinuityTask[];
  }): string {
    if (input.focusTask && input.recommendedEntry.kind !== 'fresh') {
      return `Replay pronto para retomar ${input.focusTask.shortId} em ${String(input.focusTask.source || 'runtime').trim()}.`;
    }

    const resumableWorkflow = input.workflowRuns.find((run) => Boolean(run.resume_stage));
    if (resumableWorkflow) {
      return `Replay pronto para reabrir o workflow ${String(resumableWorkflow.workflow_name || 'composto').trim()}.`;
    }

    if (input.tasks.length) {
      return `Replay pronto com ${input.tasks.length} tarefa(s) recente(s).`;
    }

    return 'Nenhum replay relevante registrado ainda.';
  }

  private buildOperatorSummary(input: {
    dominantSurface: string | null;
    tasks: SessionContinuityTask[];
    workflowRuns: WorkflowRunSnapshot[];
    permissions: NormalizedReplayPermission[];
    recentArtifacts: SessionReplayArtifactSnapshot[];
  }): string {
    const parts = [
      input.tasks.length
        ? `${input.tasks.length} tarefa(s) recentes`
        : 'no recent tasks',
      input.workflowRuns.length
        ? `${input.workflowRuns.length} workflow(s) composto(s)`
        : 'sem workflows compostos',
      input.permissions.filter((permission) => permission.status === 'pending').length
        ? `${input.permissions.filter((permission) => permission.status === 'pending').length} confirmacao(oes) pendente(s)`
        : 'sem confirmacoes pendentes',
    ];

    if (input.recentArtifacts.length) {
      parts.push(`${input.recentArtifacts.length} entrega(s) prontas`);
    }
    if (input.dominantSurface) {
      parts.push(`origem dominante em ${input.dominantSurface}`);
    }

    return parts.join(' | ');
  }

  private buildRecommendedEntry(input: {
    continuity: SessionContinuitySnapshot | null;
    focusTask: SessionContinuityTask | null;
    tasks: SessionContinuityTask[];
    workflowRuns: WorkflowRunSnapshot[];
  }): SessionReplaySnapshot['recommendedEntry'] {
    if (input.continuity?.suggestedAction?.kind === 'fresh-session') {
      return {
        kind: 'fresh',
        label: input.continuity.suggestedAction.label || 'Iniciar nova sessao',
        reason: input.continuity.suggestedAction.reason || 'Nao ha continuidade suficiente para retomada.',
        targetId: null,
      };
    }

    if (input.focusTask) {
      return {
        kind: 'task',
        label: input.continuity?.suggestedAction?.label || `Retomar ${input.focusTask.shortId}`,
        reason:
          input.continuity?.suggestedAction?.reason
          || `A tarefa ${input.focusTask.shortId} ainda e o melhor ponto de entrada.`,
        targetId: input.focusTask.taskId,
      };
    }

    const resumableWorkflow = input.workflowRuns.find((run) => Boolean(run.resume_stage));
    if (resumableWorkflow) {
      return {
        kind: 'workflow',
        label: `Retomar ${String(resumableWorkflow.workflow_name || 'workflow').trim()}`,
        reason: resumableWorkflow.resume_stage?.reason || 'Existe um workflow composto esperando retomada.',
        targetId: resumableWorkflow.workflow_run_id,
      };
    }

    const latestTask = input.tasks[0] || null;
    if (latestTask) {
      return {
        kind: 'task',
        label: `Abrir ${latestTask.shortId}`,
        reason: `A ultima tarefa registrada veio de ${String(latestTask.source || 'runtime').trim()}.`,
        targetId: latestTask.taskId,
      };
    }

    return {
      kind: 'fresh',
      label: 'Iniciar nova sessao',
      reason: 'Ainda nao existe historico suficiente para replay guiado.',
      targetId: null,
    };
  }

  private buildTimeline(input: {
    continuity: SessionContinuitySnapshot | null;
    focusTask: SessionContinuityTask | null;
    tasks: SessionContinuityTask[];
    permissions: NormalizedReplayPermission[];
    workflowRuns: WorkflowRunSnapshot[];
    artifacts: SessionReplayArtifactSnapshot[];
  }): SessionReplayStepSnapshot[] {
    const steps: SessionReplayStepSnapshot[] = [];
    const seen = new Set<string>();
    const addStep = (step: SessionReplayStepSnapshot | null) => {
      if (!step || seen.has(step.id)) {
        return;
      }
      seen.add(step.id);
      steps.push(step);
    };

    addStep(this.buildFocusStep(input.focusTask, input.continuity));
    for (const permission of input.permissions.slice(0, 2)) {
      addStep({
        id: `permission:${permission.permissionId}`,
        kind: 'permission',
        label: `${permission.executor || 'runtime'} precisa de confirmacao`,
        detail: permission.reason || `Permissao ${permission.kind || 'operacional'} em aberto.`,
        status: permission.status,
        source: 'web',
        happenedAt: permission.updatedAt,
        targetId: permission.permissionId,
      });
    }
    for (const run of input.workflowRuns.slice(0, 2)) {
      addStep({
        id: `workflow:${run.workflow_run_id}`,
        kind: 'workflow',
        label: `${String(run.workflow_name || 'workflow').trim()} em ${String(run.status || 'n/d').trim()}`,
        detail: run.resume_stage?.reason || run.objective || 'Workflow composto recente.',
        status: run.status,
        source: null,
        happenedAt: run.updated_at || run.created_at || null,
        targetId: run.workflow_run_id,
      });
    }
    for (const task of input.tasks.slice(0, 4)) {
      addStep({
        id: `task:${task.taskId}`,
        kind: 'task',
        label: `${task.shortId} | ${task.commandType || '/task'} | ${task.status || 'n/d'}`,
        detail: task.summary || `Tarefa recente vinda de ${String(task.source || 'runtime').trim()}.`,
        status: task.status,
        source: task.source,
        happenedAt: task.updatedAt,
        targetId: task.taskId,
      });
    }
    for (const artifact of input.artifacts.slice(0, 2)) {
      addStep({
        id: `artifact:${artifact.id}`,
        kind: 'artifact',
        label: artifact.label,
        detail: artifact.summary || artifact.path || 'Entrega recente pronta para reuso.',
        status: 'available',
        source: null,
        happenedAt: artifact.createdAt,
        targetId: artifact.sourceTaskId,
      });
    }

    const focusStep = steps.find((step) => step.kind === 'focus') || null;
    const remaining = steps
      .filter((step) => step !== focusStep)
      .sort((left, right) => this.getTimestamp(right.happenedAt) - this.getTimestamp(left.happenedAt));

    return [...(focusStep ? [focusStep] : []), ...remaining].slice(0, 6);
  }

  private buildFocusStep(
    focusTask: SessionContinuityTask | null,
    continuity: SessionContinuitySnapshot | null,
  ): SessionReplayStepSnapshot | null {
    if (!focusTask) {
      return null;
    }

    return {
      id: `focus:${focusTask.taskId}`,
      kind: 'focus',
      label: continuity?.suggestedAction?.label || `Retomar ${focusTask.shortId}`,
      detail:
        continuity?.suggestedAction?.reason
        || focusTask.summary
        || `Contexto ativo vindo de ${String(focusTask.source || 'runtime').trim()}.`,
      status: focusTask.status,
      source: focusTask.source,
      happenedAt: focusTask.updatedAt,
      targetId: focusTask.taskId,
    };
  }

  private collectArtifacts(tasks: ReplayTaskInput[]): SessionReplayArtifactSnapshot[] {
    const normalized: SessionReplayArtifactSnapshot[] = [];
    const seen = new Set<string>();

    for (const task of tasks) {
      const normalizedTask = this.normalizeTask(task);
      const taskRecord = asReplayRecord(task);
      const artifacts = Array.isArray(taskRecord?.artifacts)
        ? taskRecord.artifacts.map((artifact) => asReplayRecord(artifact)).filter((artifact): artifact is ReplayRecord => Boolean(artifact))
        : [];
      for (const artifact of artifacts) {
        const id = String(
          artifact?.id
          || artifact?.key
          || artifact?.path
          || artifact?.name
          || `${normalizedTask?.taskId || 'task'}-artifact`,
        ).trim();
        if (!id || seen.has(id)) {
          continue;
        }
        seen.add(id);
        normalized.push({
          id,
          label: String(artifact?.name || artifact?.key || artifact?.path || 'Entrega').trim(),
          kind: String(artifact?.kind || artifact?.type || 'artifact').trim() || 'artifact',
          summary: this.pickSummary([
            artifact?.summary,
            artifact?.description,
            artifact?.path,
          ]),
          path: String(artifact?.path || '').trim() || null,
          createdAt: String(artifact?.createdAt || artifact?.created_at || normalizedTask?.updatedAt || '').trim() || null,
          sourceTaskId: normalizedTask?.taskId || null,
        });
      }
    }

    return normalized.sort((left, right) => this.getTimestamp(right.createdAt) - this.getTimestamp(left.createdAt));
  }

  private resolveDominantSurface(
    continuity: SessionContinuitySnapshot | null,
    tasks: SessionContinuityTask[],
  ): string | null {
    const breakdown = continuity?.surfaceBreakdown || {};
    const entries = Object.entries(breakdown).sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0));
    if (entries.length && entries[0][0]) {
      return entries[0][0];
    }

    return String(tasks[0]?.source || '').trim() || null;
  }

  private resolveExecutionContext(input: {
    continuity: SessionContinuitySnapshot | null;
    focusTask: SessionContinuityTask | null;
    tasks: SessionContinuityTask[];
    workflowRuns: WorkflowRunSnapshot[];
    recommendedEntry: SessionReplaySnapshot['recommendedEntry'];
    dominantSurface: string | null;
  }): ExecutionLifecycleContextLink | null {
    const taskContext =
      input.focusTask?.execution
      || input.tasks.find((task) => Boolean(task.execution?.traceId || task.execution?.runId))?.execution
      || null;
    if (taskContext) {
      return {
        ...taskContext,
        sessionId: taskContext.sessionId || input.continuity?.sessionId || input.continuity?.chatId || null,
        surface: taskContext.surface || input.dominantSurface,
        parentId: taskContext.parentId || input.recommendedEntry.targetId || null,
      };
    }

    const workflowContext = input.workflowRuns
      .map((run) => this.lifecycleLinks.buildWorkflowContextLink(run as Record<string, unknown>))
      .find((entry) => Boolean(entry?.traceId || entry?.runId))
      || null;
    if (!workflowContext) {
      return null;
    }

    return {
      ...workflowContext,
      sessionId: workflowContext.sessionId || input.continuity?.sessionId || input.continuity?.chatId || null,
      surface: workflowContext.surface || input.dominantSurface,
      parentId: workflowContext.parentId || input.recommendedEntry.targetId || null,
    };
  }

  private normalizeTask(task: ReplayTaskInput | null | undefined): SessionContinuityTask | null {
    if (!task || typeof task !== 'object') {
      return null;
    }

    const taskRecord = asReplayRecord(task);
    const taskId = String(taskRecord?.taskId || taskRecord?.task_id || '').trim();
    if (!taskId) {
      return null;
    }

    return {
      taskId,
      shortId:
        String(taskRecord?.shortId || taskRecord?.short_id || '').trim()
        || taskId.substring(0, 8),
      source: String(taskRecord?.source || '').trim() || 'unknown',
      commandType: String(taskRecord?.commandType || taskRecord?.command_type || '').trim(),
      status: String(taskRecord?.status || '').trim(),
      workspace: String(taskRecord?.workspace || '').trim() || null,
      updatedAt:
        String(taskRecord?.updatedAt || taskRecord?.updated_at || taskRecord?.created_at || '').trim(),
      summary: this.pickSummary([
        taskRecord?.summary,
        taskRecord?.result_summary,
        taskRecord?.error_summary,
        taskRecord?.raw_message,
      ]),
      execution:
        (taskRecord?.execution as ExecutionLifecycleContextLink | null)
        || this.lifecycleLinks.buildTaskContextLink(task as Record<string, unknown>),
    };
  }

  private normalizePermission(permission: ReplayPermissionInput | null | undefined): NormalizedReplayPermission | null {
    if (!permission || typeof permission !== 'object') {
      return null;
    }

    const permissionId = String(permission.permission_id || permission.permissionId || '').trim();
    if (!permissionId) {
      return null;
    }

    return {
      permissionId,
      taskId: String(permission.task_id || permission.taskId || '').trim() || null,
      executor: String(permission.executor || '').trim() || null,
      kind: String(permission.kind || '').trim() || null,
      status: String(permission.status || '').trim() || null,
      reason: this.pickSummary([permission.reason, permission.requested_value, permission.scope]),
      updatedAt: String(permission.updated_at || permission.created_at || '').trim() || null,
    };
  }

  private pickSummary(values: unknown[]): string | null {
    for (const value of values) {
      const normalized = String(value || '').trim();
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  private getTimestamp(value: string | null | undefined): number {
    const parsed = Date.parse(String(value || '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

function asReplayRecord(value: unknown): ReplayRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ReplayRecord : null;
}
