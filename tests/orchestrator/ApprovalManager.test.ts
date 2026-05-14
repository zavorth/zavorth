import { ApprovalManager } from '../../src/orchestrator/ApprovalManager';
import type { Task } from '../../src/contracts/TaskContract';

function buildWaitingTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-approval-1',
    created_at: '2026-04-16T10:00:00.000Z',
    updated_at: '2026-04-16T10:00:00.000Z',
    source: 'telegram',
    chat_id: 'chat-1',
    user_id: 'user-1',
    raw_message: 'aprovar entrega',
    normalized_message: 'aprovar entrega',
    command_type: '/task',
    intent: 'approval',
    target: null,
    workspace: 'C:/repo',
    risk_level: 2,
    status: 'waiting_approval',
    requires_planning: false,
    requires_approval: true,
    approval_status: 'pending',
    planner_used: null,
    executor_used: null,
    fallback_used: false,
    parent_task_id: null,
    actions_planned: [],
    actions_executed: [],
    target_files: [],
    artifacts: [],
    stdout_summary: null,
    stderr_summary: null,
    diff_summary: null,
    result_summary: null,
    error_summary: null,
    rollback_available: false,
    metadata: {
      traceId: 'trace-approval',
      runId: 'run-approval',
      sessionId: 'session-approval',
      pendingPermissionId: 'permission-approval-1',
      execution_lifecycle: [
        {
          kind: 'run',
          id: 'run-approval',
          traceId: 'trace-approval',
          runId: 'run-approval',
          sessionId: 'session-approval',
          approvalId: null,
          artifactId: null,
          status: 'running',
          summary: 'Run already tracked.',
          source: 'test',
          surface: 'telegram',
          parentId: null,
          createdAt: '2026-04-16T10:00:00.000Z',
          updatedAt: '2026-04-16T10:00:00.000Z',
          metadata: {},
        },
      ],
    },
    ...overrides,
  };
}

describe('ApprovalManager', () => {
  it('adds canonical approval lifecycle metadata while preserving state transition behavior', () => {
    const task = buildWaitingTask();
    const taskManager = {
      getTask: jest.fn(() => task),
      advanceState: jest.fn((target: Task, nextStatus: Task['status'], options: any) => {
        target.status = nextStatus;
        target.metadata = {
          ...(target.metadata || {}),
          ...(options?.metadataPatch || {}),
        };
      }),
    };

    const manager = new ApprovalManager(taskManager as any);
    const updated = manager.processApproval('task-approval-1', 'approve');

    expect(updated.status).toBe('approved');
    expect(taskManager.advanceState).toHaveBeenCalledWith(task, 'approved', expect.objectContaining({
      actor: 'approval-manager',
      metadataPatch: expect.objectContaining({
        execution_lifecycle: expect.arrayContaining([
          expect.objectContaining({
            kind: 'approval',
            id: 'permission-approval-1',
            approvalId: 'permission-approval-1',
            traceId: 'trace-approval',
            runId: 'run-approval',
            sessionId: 'session-approval',
            status: 'approved',
            source: 'approval-manager',
            surface: 'telegram',
            parentId: 'task-approval-1',
          }),
        ]),
      }),
    }));
    expect(updated.metadata.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'run', id: 'run-approval' }),
      expect.objectContaining({ kind: 'approval', id: 'permission-approval-1' }),
    ]));
  });
});
