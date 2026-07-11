import type { ArtifactRecord } from '../contracts/ArtifactContract.js';
import { ArtifactPipelineService, type ArtifactManifest } from './ArtifactPipelineService.js';
import { TaskStateMachine } from '../orchestrator/TaskStateMachine.js';
import { TaskLedgerService, type TaskLedgerSnapshot, type TaskLedgerTaskSnapshot } from './TaskLedgerService.js';
import {
  PermissionScopeLedgerService,
  type PermissionScopeLedgerSnapshot,
} from './PermissionScopeLedgerService.js';

export type ZavorthTaskOsSnapshot = {
  generatedAt: string;
  gate: 'task-operating-system';
  surface: 'task-os';
  taskLedger: TaskLedgerSnapshot;
  permissionLedger: PermissionScopeLedgerSnapshot;
  summary: {
    tasks: number;
    active: number;
    awaitingPermission: number;
    awaitingArtifact: number;
    artifacts: number;
    permissions: number;
    revokablePermissions: number;
  };
  contracts: {
    noAmbiguousTaskState: true;
    approvalResumesCorrectTask: boolean;
    artifactsSurviveRestart: boolean;
    permissionsRevokableAndAuditable: boolean;
  };
  commands: {
    listTasks: string;
    listArtifacts: string;
    resume: string;
    retry: string;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ZavorthTaskArtifactsSnapshot = {
  generatedAt: string;
  gate: 'task-operating-system';
  surface: 'task-artifacts';
  task: TaskLedgerTaskSnapshot | null;
  manifest: ArtifactManifest | null;
  artifacts: ArtifactRecord[];
  redelivery: {
    available: boolean;
    command: string | null;
    reason: string;
  };
};

export type ZavorthTaskContinuationAction = 'resume' | 'retry';

export type ZavorthTaskContinuationPlan = {
  generatedAt: string;
  gate: 'task-operating-system';
  surface: 'task-continuation';
  action: ZavorthTaskContinuationAction;
  task: TaskLedgerTaskSnapshot | null;
  available: boolean;
  nextCommand: string | null;
  expectedState: string | null;
  reason: string;
  preserves: {
    conversation: boolean;
    workspace: boolean;
    executor: boolean;
    artifacts: boolean;
    approvals: boolean;
  };
};

type ZavorthTaskOperatingSystemRuntime = {
  now?: () => Date;
  taskLedgerService: TaskLedgerService;
  permissionScopeLedgerService: PermissionScopeLedgerService;
  artifactPipelineService?: ArtifactPipelineService;
};

export class ZavorthTaskOperatingSystemService {
  private readonly now: () => Date;
  private readonly artifactPipeline: ArtifactPipelineService;

  constructor(private readonly runtime: ZavorthTaskOperatingSystemRuntime) {
    this.now = runtime.now || (() => new Date());
    this.artifactPipeline = runtime.artifactPipelineService || new ArtifactPipelineService();
  }

  public async buildSnapshot(input: {
    taskId?: string | null;
    userId?: string | null;
    limit?: number;
  } = {}): Promise<ZavorthTaskOsSnapshot> {
    const generatedAt = this.now().toISOString();
    const taskLedger = this.runtime.taskLedgerService.buildSnapshot({
      generatedAt,
      taskId: input.taskId || null,
      userId: input.userId || null,
      limit: input.limit || 20,
    });
    const permissionLedger = await this.runtime.permissionScopeLedgerService.buildSnapshot({
      generatedAt,
      limit: Math.max(input.limit || 50, 50),
    });
    const artifactTotal = taskLedger.tasks.reduce((total, task) => total + task.artifacts.total, 0);
    const approvalsLinked = permissionLedger.entries
      .filter((entry) => entry.status === 'pending' && entry.taskId)
      .every((entry) => taskLedger.tasks.some((task) => task.taskId === entry.taskId));

    return {
      generatedAt,
      gate: 'task-operating-system',
      surface: 'task-os',
      taskLedger,
      permissionLedger,
      summary: {
        tasks: taskLedger.summary.total,
        active: taskLedger.summary.active,
        awaitingPermission: taskLedger.summary.awaitingPermission,
        awaitingArtifact: taskLedger.summary.awaitingArtifact,
        artifacts: artifactTotal,
        permissions: permissionLedger.summary.total,
        revokablePermissions: permissionLedger.summary.revokable,
      },
      contracts: {
        noAmbiguousTaskState: true,
        approvalResumesCorrectTask: approvalsLinked,
        artifactsSurviveRestart: taskLedger.tasks.every((task) => Boolean(task.artifacts.manifest) || task.artifacts.total === 0),
        permissionsRevokableAndAuditable: permissionLedger.entries.every((entry) => Boolean(entry.audit.command)),
      },
      commands: {
        listTasks: 'zavorth tasks --json',
        listArtifacts: 'zavorth artifacts task <taskId> --json',
        resume: 'zavorth tasks resume <taskId>',
        retry: 'zavorth tasks retry <taskId>',
      },
      narrative: this.buildNarrative(taskLedger, permissionLedger, artifactTotal),
    };
  }

  public async listArtifactsForTask(taskId: string): Promise<ZavorthTaskArtifactsSnapshot> {
    const generatedAt = this.now().toISOString();
    const task = this.runtime.taskLedgerService.resolveTask(taskId);
    if (!task) {
      return {
        generatedAt,
        gate: 'task-operating-system',
        surface: 'task-artifacts',
        task: null,
        manifest: null,
        artifacts: [],
        redelivery: {
          available: false,
          command: null,
          reason: 'No task found to list artifacts.',
        },
      };
    }
    const taskSnapshot = this.runtime.taskLedgerService.toSnapshot(task);
    const artifacts = Array.isArray(task.artifacts) ? task.artifacts : [];
    const manifest = this.resolveArtifactManifest(taskSnapshot, artifacts);
    return {
      generatedAt,
      gate: 'task-operating-system',
      surface: 'task-artifacts',
      task: taskSnapshot,
      manifest,
      artifacts,
      redelivery: {
        available: artifacts.length > 0,
        command: artifacts.length > 0 ? `zavorth artifacts task ${task.task_id}` : null,
        reason: artifacts.length > 0
          ? 'Artifacts persisted in the task ledger and ready for redelivery.'
          : 'Task does not have structured artifacts yet.',
      },
    };
  }

  public async buildContinuationPlan(
    taskId: string,
    action: ZavorthTaskContinuationAction,
  ): Promise<ZavorthTaskContinuationPlan> {
    const generatedAt = this.now().toISOString();
    const task = this.runtime.taskLedgerService.resolveTask(taskId);
    if (!task) {
      return {
        generatedAt,
        gate: 'task-operating-system',
        surface: 'task-continuation',
        action,
        task: null,
        available: false,
        nextCommand: null,
        expectedState: null,
        reason: 'No task found to resume or repeat.',
        preserves: this.emptyPreservation(),
      };
    }

    const taskSnapshot = this.runtime.taskLedgerService.toSnapshot(task);
    const available = action === 'resume'
      ? taskSnapshot.resume.available
      : taskSnapshot.retry.available;
    const nextCommand = action === 'resume'
      ? taskSnapshot.resume.command
      : taskSnapshot.retry.command;
    const expectedState = action === 'resume'
      ? 'running'
      : 'queued';

    return {
      generatedAt,
      gate: 'task-operating-system',
      surface: 'task-continuation',
      action,
      task: taskSnapshot,
      available,
      nextCommand: available ? nextCommand : null,
      expectedState: available ? expectedState : null,
      reason: available
        ? this.buildContinuationReason(taskSnapshot, action)
        : `Action ${action} is unavailable for state ${taskSnapshot.state.state}.`,
      preserves: {
        conversation: Boolean(taskSnapshot.relation.conversation),
        workspace: Boolean(taskSnapshot.relation.workspace),
        executor: Boolean(taskSnapshot.relation.executor),
        artifacts: taskSnapshot.artifacts.total > 0,
        approvals: taskSnapshot.relation.approvals.length > 0 || taskSnapshot.approval.required,
      },
    };
  }

  private resolveArtifactManifest(
    task: TaskLedgerTaskSnapshot,
    artifacts: ArtifactRecord[],
  ): ArtifactManifest | null {
    if (task.artifacts.manifest && typeof task.artifacts.manifest === 'object') {
      return task.artifacts.manifest as ArtifactManifest;
    }
    if (artifacts.length === 0) {
      return null;
    }
    return this.artifactPipeline.buildManifest(artifacts, {
      taskId: task.taskId,
      sessionId: task.relation.conversation,
      surface: task.source,
      source: task.executor || 'task-os',
    });
  }

  private buildNarrative(
    taskLedger: TaskLedgerSnapshot,
    permissionLedger: PermissionScopeLedgerSnapshot,
    artifactTotal: number,
  ): ZavorthTaskOsSnapshot['narrative'] {
    return {
      headline: `${taskLedger.summary.total} tasks no ledger; ${taskLedger.summary.active} ativas e ${artifactTotal} artefatos rastreados.`,
      operatorSummary: `${taskLedger.summary.awaitingPermission} aguardando permissao, ${taskLedger.summary.awaitingArtifact} aguardando artefato e ${permissionLedger.summary.revokable} permissoes revogaveis.`,
    };
  }

  private buildContinuationReason(
    task: TaskLedgerTaskSnapshot,
    action: ZavorthTaskContinuationAction,
  ): string {
    if (action === 'resume' && task.approval.resumesTask) {
      return 'The approval is linked to this task and resumes persisted conversation, workspace, and executor.';
    }
    if (action === 'resume') {
      return 'Resume preserves conversation, workspace, executor, and known artifacts.';
    }
    return 'Retry cria uma repeticao padronizada a partir da task terminal e preserva os artefatos anteriores para comparacao.';
  }

  private emptyPreservation(): ZavorthTaskContinuationPlan['preserves'] {
    return {
      conversation: false,
      workspace: false,
      executor: false,
      artifacts: false,
      approvals: false,
    };
  }
}

export { TaskStateMachine, TaskLedgerService, PermissionScopeLedgerService };
