import type { ArtifactRecord } from '../../src/contracts/ArtifactContract';
import type { PermissionRequest } from '../../src/contracts/PermissionRequest';
import type { Task } from '../../src/contracts/TaskContract';
import { TaskStateMachine } from '../../src/orchestrator/TaskStateMachine';
import { ZavorthTaskOperatingSystemService } from '../../src/services/ZavorthTaskOperatingSystemService';
import { PermissionScopeLedgerService } from '../../src/services/PermissionScopeLedgerService';
import { TaskLedgerService } from '../../src/services/TaskLedgerService';

const artifact: ArtifactRecord = {
  id: 'artifact-1',
  key: 'artifact://report',
  type: 'file',
  kind: 'report',
  name: 'report.md',
  source: 'codex',
  path: 'C:/repo/report.md',
  url: null,
  mimeType: 'text/markdown',
  summary: 'Report gerado',
  description: null,
  previewText: '# Report',
  sizeBytes: 128,
  exists: true,
  deliveryChannel: 'document',
  createdAt: '2026-04-24T12:05:00.000Z',
};

function createTask(input: Partial<Task>): Task {
  return {
    task_id: input.task_id || 'task-1',
    created_at: input.created_at || '2026-04-24T12:00:00.000Z',
    updated_at: input.updated_at || '2026-04-24T12:10:00.000Z',
    source: input.source || 'web',
    chat_id: input.chat_id || 'web:session-1',
    user_id: input.user_id || 'alice',
    raw_message: input.raw_message || 'corrija o bug',
    normalized_message: input.normalized_message || 'corrija o bug',
    command_type: input.command_type || '/task',
    intent: input.intent || 'code_execution',
    target: input.target ?? null,
    workspace: input.workspace ?? 'C:/repo',
    risk_level: input.risk_level ?? 2,
    status: input.status || 'completed',
    requires_planning: input.requires_planning ?? false,
    requires_approval: input.requires_approval ?? false,
    approval_status: input.approval_status || 'not_required',
    planner_used: input.planner_used ?? null,
    executor_used: input.executor_used ?? 'codex',
    fallback_used: input.fallback_used ?? false,
    parent_task_id: input.parent_task_id ?? null,
    actions_planned: input.actions_planned || [],
    actions_executed: input.actions_executed || [],
    target_files: input.target_files || [],
    artifacts: input.artifacts || [],
    stdout_summary: input.stdout_summary ?? null,
    stderr_summary: input.stderr_summary ?? null,
    diff_summary: input.diff_summary ?? null,
    result_summary: input.result_summary ?? 'Task concluida.',
    error_summary: input.error_summary ?? null,
    rollback_available: input.rollback_available ?? false,
    metadata: input.metadata || {},
  };
}

function createPermission(input: Partial<PermissionRequest>): PermissionRequest {
  return {
    permission_id: input.permission_id || 'perm-1',
    created_at: input.created_at || '2026-04-24T12:01:00.000Z',
    updated_at: input.updated_at || '2026-04-24T12:02:00.000Z',
    task_id: input.task_id ?? 'task-permission',
    executor: input.executor || 'codex',
    kind: input.kind || 'workspace_access',
    status: input.status || 'pending',
    scope: input.scope || 'once',
    workspace: input.workspace ?? 'C:/repo',
    requested_value: input.requested_value ?? 'C:/repo',
    resolved_value: input.resolved_value ?? 'C:/repo',
    reason: input.reason || 'Precisa acessar workspace.',
    requested_by: input.requested_by ?? 'alice',
    decided_by: input.decided_by ?? null,
    decision_note: input.decision_note ?? null,
    metadata: input.metadata || {},
  };
}

describe('TaskStateMachine', () => {
  it('maps legacy states into the formal task operating system states', () => {
    expect(TaskStateMachine.toFormalState(createTask({ status: 'pending' }))).toBe('queued');
    expect(TaskStateMachine.toFormalState(createTask({ status: 'planned' }))).toBe('planning');
    expect(TaskStateMachine.toFormalState(createTask({
      status: 'waiting_approval',
      requires_approval: true,
      approval_status: 'pending',
    }))).toBe('awaiting_permission');
    expect(TaskStateMachine.toFormalState(createTask({ status: 'delivery_pending', artifacts: [artifact] }))).toBe('delivering');
    expect(TaskStateMachine.toFormalState(createTask({ status: 'rollback_pending' }))).toBe('paused');
  });
});

describe('ZavorthTaskOperatingSystemService', () => {
  function createService() {
    const completed = createTask({
      task_id: 'task-completed',
      status: 'completed',
      artifacts: [artifact],
      metadata: {
        artifacts_manifest: {
          total: 1,
          by_kind: { report: 1 },
        },
      },
    });
    const permissionTask = createTask({
      task_id: 'task-permission',
      status: 'waiting_approval',
      requires_approval: true,
      approval_status: 'pending',
      artifacts: [],
      metadata: {
        pendingPermissionId: 'perm-1',
      },
    });
    const tasks = [completed, permissionTask];
    const permissions = [
      createPermission({ permission_id: 'perm-1', task_id: 'task-permission', status: 'pending', scope: 'once' }),
      createPermission({
        permission_id: 'perm-2',
        task_id: null,
        status: 'approved',
        scope: 'persistent',
        metadata: { expires_at: '2026-04-25T12:00:00.000Z' },
      }),
    ];
    const taskRepo = {
      getById: jest.fn((taskId: string) => tasks.find((task) => task.task_id === taskId)),
      getRecentTasks: jest.fn((limit = 20) => tasks.slice(0, limit)),
      getPendingTasks: jest.fn(() => [permissionTask]),
    };
    const permissionService = {
      listRequests: jest.fn(async () => permissions),
    };
    const service = new ZavorthTaskOperatingSystemService({
      now: () => new Date('2026-04-24T12:30:00.000Z'),
      taskLedgerService: new TaskLedgerService(taskRepo),
      permissionScopeLedgerService: new PermissionScopeLedgerService(permissionService),
    });
    return { service, taskRepo, permissionService };
  }

  it('builds the task OS snapshot with task, artifact and permission ledgers', async () => {
    const { service } = createService();

    const snapshot = await service.buildSnapshot({ userId: 'alice' });

    expect(snapshot.phase).toBe('task-operating-system');
    expect(snapshot.surface).toBe('task-os');
    expect(snapshot.taskLedger.summary.byState.awaiting_permission).toBe(1);
    expect(snapshot.summary.artifacts).toBe(1);
    expect(snapshot.permissionLedger.summary.byScope.task).toBe(1);
    expect(snapshot.permissionLedger.summary.byScope.timeboxed).toBe(1);
    expect(snapshot.contracts.noAmbiguousTaskState).toBe(true);
    expect(snapshot.contracts.approvalResumesCorrectTask).toBe(true);
    expect(snapshot.contracts.artifactsSurviveRestart).toBe(true);
    expect(snapshot.contracts.permissionsRevokableAndAuditable).toBe(true);
  });

  it('lists artifacts by task and exposes redelivery', async () => {
    const { service } = createService();

    const snapshot = await service.listArtifactsForTask('task-completed');

    expect(snapshot.phase).toBe('task-operating-system');
    expect(snapshot.surface).toBe('task-artifacts');
    expect(snapshot.task?.taskId).toBe('task-completed');
    expect(snapshot.artifacts).toHaveLength(1);
    expect(snapshot.redelivery.available).toBe(true);
  });

  it('standardizes resume and retry plans', async () => {
    const { service } = createService();

    const resume = await service.buildContinuationPlan('task-permission', 'resume');
    const retry = await service.buildContinuationPlan('task-completed', 'retry');

    expect(resume.available).toBe(true);
    expect(resume.nextCommand).toBe('zavorth approve task-permission');
    expect(resume.preserves.approvals).toBe(true);
    expect(retry.available).toBe(true);
    expect(retry.expectedState).toBe('queued');
    expect(retry.preserves.artifacts).toBe(true);
  });
});
