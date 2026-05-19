import { TaskManager } from '../../src/orchestrator/TaskManager';

describe('TaskManager', () => {
  it('exposes saveTask as a public persistence hook', () => {
    const taskRepo = {
      save: jest.fn(),
      getById: jest.fn(),
      getPendingTasks: jest.fn().mockReturnValue([]),
      getRecentTasks: jest.fn().mockReturnValue([]),
      getLatestTaskForUser: jest.fn(),
    } as any;
    const taskManager = new TaskManager(taskRepo, { log: jest.fn() } as any);
    const task = { task_id: 'task-1' } as any;

    taskManager.saveTask(task);

    expect(taskRepo.save).toHaveBeenCalledWith(task);
  });

  it('delegates latest-task lookup to the repository', () => {
    const lastTask = { task_id: 'task-2' } as any;
    const taskRepo = {
      save: jest.fn(),
      getById: jest.fn(),
      getPendingTasks: jest.fn().mockReturnValue([]),
      getRecentTasks: jest.fn().mockReturnValue([]),
      getLatestTaskForUser: jest.fn().mockReturnValue(lastTask),
    } as any;
    const taskManager = new TaskManager(taskRepo, { log: jest.fn() } as any);

    const result = taskManager.getLatestTaskForUser('user-1', 'task-3');

    expect(taskRepo.getLatestTaskForUser).toHaveBeenCalledWith('user-1', 'task-3');
    expect(result).toBe(lastTask);
  });

  it('records lifecycle metadata and state history on transition', () => {
    const taskRepo = {
      save: jest.fn(),
      getById: jest.fn(),
      getPendingTasks: jest.fn().mockReturnValue([]),
      getRecentTasks: jest.fn().mockReturnValue([]),
      getLatestTaskForUser: jest.fn(),
    } as any;
    const taskManager = new TaskManager(taskRepo, { log: jest.fn() } as any);
    const task = taskManager.createPendingTask('chat-1', 'user-1', '/task teste', '/task teste', '/task');

    taskManager.advanceState(task, 'parsed', { reason: 'mensagem normalizada', actor: 'telegram' });

    expect(task.status).toBe('parsed');
    expect(task.metadata.lifecycle).toEqual(
      expect.objectContaining({
        current_status: 'parsed',
        previous_status: 'pending',
        is_active: true,
        is_terminal: false,
      }),
    );
    expect(task.metadata.last_transition).toEqual(
      expect.objectContaining({
        from: 'pending',
        to: 'parsed',
        reason: 'mensagem normalizada',
        actor: 'telegram',
      }),
    );
    expect(task.metadata.state_history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'pending',
          to: 'parsed',
        }),
      ]),
    );
  });

  it('synchronizes approval status when entering and leaving waiting_approval', () => {
    const taskRepo = {
      save: jest.fn(),
      getById: jest.fn(),
      getPendingTasks: jest.fn().mockReturnValue([]),
      getRecentTasks: jest.fn().mockReturnValue([]),
      getLatestTaskForUser: jest.fn(),
    } as any;
    const taskManager = new TaskManager(taskRepo, { log: jest.fn() } as any);
    const task = taskManager.createPendingTask('chat-1', 'user-1', '/run npm test', '/run npm test', '/run');

    task.status = 'parsed';
    task.approval_status = 'not_required';
    task.requires_approval = false;

    taskManager.advanceState(task, 'waiting_approval');
    expect(task.approval_status).toBe('pending');
    expect(task.requires_approval).toBe(true);

    taskManager.advanceState(task, 'approved');
    expect(task.approval_status).toBe('approved');

    taskManager.advanceState(task, 'running');
    expect(task.approval_status).toBe('approved');
  });

  it('persists artifact manifest and richer lifecycle metadata on save', () => {
    const taskRepo = {
      save: jest.fn(),
      getById: jest.fn(),
      getPendingTasks: jest.fn().mockReturnValue([]),
      getRecentTasks: jest.fn().mockReturnValue([]),
      getLatestTaskForUser: jest.fn(),
    } as any;
    const taskManager = new TaskManager(taskRepo, { log: jest.fn() } as any);
    const task = taskManager.createPendingTask('chat-1', 'user-1', '/task gerar briefing', '/task gerar briefing', '/task');

    task.status = 'delivery_pending';
    task.artifacts = [
      {
        key: 'artifact-1',
        name: 'briefing-final.md',
        path: null,
        url: 'https://example.com/briefing-final.md',
        deliveryChannel: 'link',
        kind: 'report',
        type: 'file',
        source: 'test',
        mimeType: 'text/markdown',
        summary: 'Briefing final',
        description: null,
        previewText: '# Briefing',
        sizeBytes: 123,
        exists: false,
        createdAt: '2026-03-31T10:00:00.000Z',
        id: 'artifact-1',
      },
    ] as any;

    taskManager.saveTask(task);

    expect(task.metadata.lifecycle).toEqual(expect.objectContaining({
      current_status: 'delivery_pending',
      stage: 'delivery',
      can_resume: true,
      can_retry: false,
    }));
    expect(task.metadata.artifacts_manifest).toEqual(expect.objectContaining({
      total: 1,
      links: 1,
      primary_artifact_name: 'briefing-final.md',
      package_mode: 'single',
    }));
    expect(task.metadata.artifact_paths).toEqual([]);
    expect(task.metadata.security_posture).toEqual(expect.objectContaining({
      current_status: 'delivery_pending',
      risk_band: 'low',
      approval_status: 'not_required',
      active_controls: [],
    }));
    expect(task.metadata.security_summary).toContain('risco low (0)');
    expect(taskRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      artifacts: [
        expect.objectContaining({
          key: 'artifact-1',
          name: 'briefing-final.md',
        }),
      ],
    }));
  });

  it('normalizes workspace route outcome alongside security posture', () => {
    const taskRepo = {
      save: jest.fn(),
      getById: jest.fn(),
      getPendingTasks: jest.fn().mockReturnValue([]),
      getRecentTasks: jest.fn().mockReturnValue([]),
      getLatestTaskForUser: jest.fn(),
    } as any;
    const taskManager = new TaskManager(taskRepo, { log: jest.fn() } as any);
    const task = taskManager.createPendingTask('chat-1', 'user-1', '/task gere o briefing', '/task gere o briefing', '/task');

    task.status = 'completed';
    task.executor_used = 'codex';
    task.metadata = {
      route_task_kind: 'code',
      route_task_subtype: 'implementation',
      auto_route_executor: 'codex',
      auto_route_source: 'workspace_learning',
      auto_route_strategy: 'subtype_memory',
      workspace_route_outcome: {
        selected_executor: 'codex',
        source_surface: 'telegram',
      },
    };

    taskManager.saveTask(task);

    expect(task.metadata.workspace_route_outcome).toEqual(expect.objectContaining({
      selected_executor: 'codex',
      final_executor: 'codex',
      source: 'workspace_learning',
      strategy: 'subtype_memory',
      task_kind: 'code',
      task_subtype: 'implementation',
      final_status: 'completed',
      artifact_count: 0,
      approval_needed: false,
      permission_needed: false,
    }));
  });
});
