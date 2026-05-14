import type { Task } from '../../src/contracts/TaskContract';
import { mergeTaskForPersistence, TaskRepository } from '../../src/storage/TaskRepository';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'task-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: 'telegram',
    chat_id: 'chat-1',
    user_id: 'user-1',
    raw_message: '/ag teste',
    normalized_message: '/ag teste',
    command_type: '/ag',
    intent: 'zavorthBridge_task',
    target: null,
    workspace: 'C:/workspace/zavorth',
    risk_level: 1,
    status: 'running',
    requires_planning: false,
    requires_approval: false,
    approval_status: 'not_required',
    planner_used: null,
    executor_used: 'zavorthBridge_cli',
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
    metadata: {},
    ...overrides,
  };
}

describe('mergeTaskForPersistence', () => {
  it('preserves a newer completed task state against a stale running overwrite', () => {
    const existing = createTask({
      status: 'completed',
      result_summary: 'CRIADO tmp/ag-e2e-create.md',
      metadata: {
        zavorthBridgeDeliveryState: 'delivered',
        zavorthBridgeDeliveredAt: '2026-03-25T19:24:41.476Z',
      },
    });

    const incoming = createTask({
      status: 'running',
      metadata: {
        zavorthBridgeDeliveryMode: 'companion-reuse',
      },
    });

    const merged = mergeTaskForPersistence(existing, incoming);
    expect(merged.status).toBe('completed');
    expect(merged.result_summary).toBe('CRIADO tmp/ag-e2e-create.md');
    expect(merged.metadata.zavorthBridgeDeliveryState).toBe('delivered');
  });

  it('accepts forward progress when the incoming task is newer', () => {
    const existing = createTask({ status: 'running' });
    const incoming = createTask({
      status: 'delivery_pending',
      metadata: {
        zavorthBridgeDeliveryState: 'pending',
      },
    });

    const merged = mergeTaskForPersistence(existing, incoming);
    expect(merged.status).toBe('delivery_pending');
    expect(merged.metadata.zavorthBridgeDeliveryState).toBe('pending');
  });

  it('preserves valid running -> waiting_approval transitions', () => {
    const existing = createTask({ status: 'running' });
    const incoming = createTask({
      status: 'waiting_approval',
      requires_approval: true,
      approval_status: 'pending',
      metadata: {
        pendingPermissionId: 'perm-1234',
      },
    });

    const merged = mergeTaskForPersistence(existing, incoming);
    expect(merged.status).toBe('waiting_approval');
    expect(merged.requires_approval).toBe(true);
    expect(merged.approval_status).toBe('pending');
    expect(merged.metadata.pendingPermissionId).toBe('perm-1234');
  });
});

describe('TaskRepository multichannel lookups', () => {
  it('finds recent tasks by runtime user id persisted inside surface metadata', () => {
    const repository = new TaskRepository();
    (repository as any).db = {
      all: jest.fn(() => [
        {
          ...createTask({
            task_id: 'task-surface-1',
            user_id: 'discord-session-1',
            source: 'discord',
            metadata: {
              runtime_user_id: 'telegram-admin',
              surface_identity: {
                runtime_user_id: 'telegram-admin',
              },
            },
          }),
          actions_planned: '[]',
          actions_executed: '[]',
          target_files: '[]',
          artifacts: '[]',
          metadata: JSON.stringify({
            runtime_user_id: 'telegram-admin',
            surface_identity: {
              runtime_user_id: 'telegram-admin',
            },
          }),
        },
      ]),
    };

    const tasks = repository.getRecentTasksByUsers(['telegram-admin'], 5);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toEqual(
      expect.objectContaining({
        task_id: 'task-surface-1',
        source: 'discord',
      }),
    );
    expect((repository as any).db.all).toHaveBeenCalledWith(
      expect.stringContaining("json_extract(metadata, '$.surface_identity.runtime_user_id')"),
      ['telegram-admin', 'telegram-admin', 'telegram-admin', 5],
    );
  });

  it('finds the latest task by runtime user id persisted inside surface metadata', () => {
    const repository = new TaskRepository();
    (repository as any).db = {
      get: jest.fn(() => ({
        ...createTask({
          task_id: 'task-surface-latest',
          user_id: 'web-session-1',
          source: 'web',
          metadata: {
            surface_identity: {
              runtime_user_id: 'telegram-admin',
            },
          },
        }),
        actions_planned: '[]',
        actions_executed: '[]',
        target_files: '[]',
        artifacts: '[]',
        metadata: JSON.stringify({
          surface_identity: {
            runtime_user_id: 'telegram-admin',
          },
        }),
      })),
    };

    const task = repository.getLatestTaskForUsers(['telegram-admin']);

    expect(task).toEqual(
      expect.objectContaining({
        task_id: 'task-surface-latest',
        source: 'web',
      }),
    );
    expect((repository as any).db.get).toHaveBeenCalledWith(
      expect.stringContaining("json_extract(metadata, '$.surface_identity.runtime_user_id')"),
      ['telegram-admin', 'telegram-admin', 'telegram-admin'],
    );
  });

  it('finds recent tasks by runtime user id and tenant id together', () => {
    const repository = new TaskRepository();
    (repository as any).db = {
      all: jest.fn(() => [
        {
          ...createTask({
            task_id: 'task-tenant-1',
            user_id: 'discord-user-1',
            source: 'discord',
            metadata: {
              surface_identity: {
                runtime_user_id: 'telegram-admin',
              },
              tenant_id: 'discord:guild:guild-1',
            },
          }),
          actions_planned: '[]',
          actions_executed: '[]',
          target_files: '[]',
          artifacts: '[]',
          metadata: JSON.stringify({
            surface_identity: {
              runtime_user_id: 'telegram-admin',
            },
            tenant_id: 'discord:guild:guild-1',
          }),
        },
      ]),
    };

    const tasks = repository.getRecentTasksByUsersAndTenant(['telegram-admin'], 'discord:guild:guild-1', 5);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].task_id).toBe('task-tenant-1');
    expect((repository as any).db.all).toHaveBeenCalledWith(
      expect.stringContaining("json_extract(metadata, '$.tenant_id')"),
      ['telegram-admin', 'telegram-admin', 'telegram-admin', 'discord:guild:guild-1', 'discord:guild:guild-1', 5],
    );
  });
});
