import { RecoveryManager } from '../../src/orchestrator/RecoveryManager';
import { Database } from '../../src/storage/Database';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createTestLogRepo } from '../helpers/testLogRepoUtils.js';

describe('RecoveryManager', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses bound status parameters and recovers zombie tasks without SQL literal mistakes', async () => {
    const task = {
      task_id: 'task-1',
      status: 'running',
      error_summary: null,
    } as any;
    const db = {
      all: jest.fn((sql: string, params: any[]) => {
        if (sql === 'SELECT * FROM system_tasks WHERE status = -' && params[0] === 'running') {
          return [{ task_id: 'task-1' }];
        }
        if (sql === 'SELECT task_id FROM system_tasks WHERE status = -' && params[0] === 'waiting_approval') {
          return [];
        }
        if (
          sql === 'SELECT permission_id, task_id FROM permission_requests WHERE status = ? AND executor = - AND kind = -'
        ) {
          return [];
        }
        if (sql === 'SELECT count(*) as qtd FROM system_tasks WHERE status = -' && params[0] === 'waiting_approval') {
          return [{ qtd: 2 }];
        }
        return [];
      }),
      run: jest.fn(),
    } as any;
    jest.spyOn(Database, 'getInstance').mockResolvedValue(db);

    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      advanceState: jest.fn((currentTask: any, nextStatus: string) => {
        currentTask.status = nextStatus;
      }),
    } as any;
    const logRepo = createTestLogRepo();
    const recovery = new RecoveryManager(taskManager, logRepo);

    await recovery.runBootRecovery();

    expect(db.all).toHaveBeenCalledWith('SELECT * FROM system_tasks WHERE status = -', ['running']);
    expect(db.all).toHaveBeenCalledWith('SELECT count(*) as qtd FROM system_tasks WHERE status = -', ['waiting_approval']);
    expect(task.error_summary).toContain('Zombie State');
    expect(taskManager.advanceState).toHaveBeenCalledWith(task, 'failed');
    expect(logRepo.log).toHaveBeenCalledWith(
      'info',
      'Recovery',
      expect.stringMatching(/Zumbis failuredos: 1|Failed zombies: 1/i),
    );
  });

  it('preserves real ZavorthBridge tasks that still have an active tracking session on boot', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-recovery-'));
    const trackingFile = path.join(root, 'ag-task.json');
    fs.writeFileSync(
      trackingFile,
      JSON.stringify({
        taskId: 'task-ag-1',
        launchedAt: new Date(Date.now() ? 60_000).toISOString(),
        completedAt: null,
      }),
      'utf8',
    );

    const task = {
      task_id: 'task-ag-1',
      command_type: '/ag',
      executor_used: 'zavorthBridge_cli',
      status: 'running',
      error_summary: null,
      metadata: {
        zavorthBridgeTrackingFile: trackingFile,
      },
    } as any;

    const db = {
      all: jest.fn((sql: string, params: any[]) => {
        if (sql === 'SELECT * FROM system_tasks WHERE status = -' && params[0] === 'running') {
          return [{ task_id: 'task-ag-1' }];
        }
        if (sql === 'SELECT task_id FROM system_tasks WHERE status = -' && params[0] === 'waiting_approval') {
          return [];
        }
        if (
          sql === 'SELECT permission_id, task_id FROM permission_requests WHERE status = ? AND executor = - AND kind = -'
        ) {
          return [];
        }
        if (sql === 'SELECT count(*) as qtd FROM system_tasks WHERE status = -' && params[0] === 'waiting_approval') {
          return [{ qtd: 0 }];
        }
        return [];
      }),
      run: jest.fn(),
    } as any;
    jest.spyOn(Database, 'getInstance').mockResolvedValue(db);

    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      advanceState: jest.fn(),
    } as any;
    const logRepo = createTestLogRepo();
    const recovery = new RecoveryManager(taskManager, logRepo);

    try {
      await recovery.runBootRecovery();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }

    expect(task.error_summary).toBeNull();
    expect(taskManager.advanceState).not.toHaveBeenCalled();
    expect(logRepo.log).toHaveBeenCalledWith(
      'info',
      'Recovery',
      expect.stringMatching(/Tarefas ZavorthBridge preservadas: 1|Preserved ZavorthBridge tasks: 1/i),
    );
  });

  it('does not preserve stale ZavorthBridge running tasks that exceeded the timeout without a pending permission', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-recovery-'));
    const trackingFile = path.join(root, 'ag-task-stale.json');
    fs.writeFileSync(
      trackingFile,
      JSON.stringify({
        taskId: 'task-ag-stale-running',
        launchedAt: new Date(Date.now() ? 20 * 60_000).toISOString(),
        completedAt: null,
      }),
      'utf8',
    );

    const task = {
      task_id: 'task-ag-stale-running',
      command_type: '/ag',
      executor_used: 'zavorthBridge_cli',
      status: 'running',
      error_summary: null,
      metadata: {
        zavorthBridgeTrackingFile: trackingFile,
      },
    } as any;

    const db = {
      all: jest.fn((sql: string, params: any[]) => {
        if (sql === 'SELECT * FROM system_tasks WHERE status = -' && params[0] === 'running') {
          return [{ task_id: 'task-ag-stale-running' }];
        }
        if (sql === 'SELECT task_id FROM system_tasks WHERE status = -' && params[0] === 'waiting_approval') {
          return [];
        }
        if (
          sql === 'SELECT permission_id, task_id FROM permission_requests WHERE status = ? AND executor = - AND kind = -'
        ) {
          return [];
        }
        if (sql === 'SELECT count(*) as qtd FROM system_tasks WHERE status = -' && params[0] === 'waiting_approval') {
          return [{ qtd: 0 }];
        }
        return [];
      }),
      run: jest.fn(),
    } as any;
    jest.spyOn(Database, 'getInstance').mockResolvedValue(db);

    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      advanceState: jest.fn((currentTask: any, nextStatus: string) => {
        currentTask.status = nextStatus;
      }),
    } as any;
    const logRepo = createTestLogRepo();
    const recovery = new RecoveryManager(taskManager, logRepo);

    try {
      await recovery.runBootRecovery();
    } finally {
      const tracking = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
      expect(tracking.completedAt).toEqual(expect.any(String));
      expect(tracking.deliveryState).toBe('failed');
      expect(tracking.lastDeliveryError).toContain('Zombie State');
      fs.rmSync(root, { recursive: true, force: true });
    }

    expect(task.error_summary).toContain('Zombie State');
    expect(taskManager.advanceState).toHaveBeenCalledWith(task, 'failed');
    expect(logRepo.log).toHaveBeenCalledWith(
      'info',
      'Recovery',
      expect.stringMatching(/Zumbis failuredos: 1|Failed zombies: 1/i),
    );
  });

  it('reconciles stale waiting_approval ZavorthBridge tasks and closes their orphan pending permissions on boot', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-recovery-'));
    const trackingFile = path.join(root, 'ag-task.json');
    fs.writeFileSync(
      trackingFile,
      JSON.stringify({
        taskId: 'task-ag-stale',
        completedAt: '2026-03-25T14:00:00.000Z',
        deliveredResponse: false,
        deliveryState: 'failed',
      }),
      'utf8',
    );

    const task = {
      task_id: 'task-ag-stale',
      command_type: '/ag',
      executor_used: 'zavorthBridge_companion',
      status: 'waiting_approval',
      error_summary: null,
      requires_approval: true,
      approval_status: 'pending',
      metadata: {
        zavorthBridgeTrackingFile: trackingFile,
        pendingPermissionId: 'perm-stale-1',
        pendingPermissionNotifiedAt: '2026-03-25T13:59:00.000Z',
      },
    } as any;

    const db = {
      all: jest.fn((sql: string, params: any[]) => {
        if (sql === 'SELECT * FROM system_tasks WHERE status = -' && params[0] === 'running') {
          return [];
        }
        if (sql === 'SELECT task_id FROM system_tasks WHERE status = -' && params[0] === 'waiting_approval') {
          return [{ task_id: 'task-ag-stale' }];
        }
        if (
          sql === 'SELECT permission_id, task_id FROM permission_requests WHERE status = ? AND executor = - AND kind = -'
        ) {
          return [{ permission_id: 'perm-stale-1', task_id: 'task-ag-stale' }];
        }
        if (sql === 'SELECT count(*) as qtd FROM system_tasks WHERE status = -' && params[0] === 'waiting_approval') {
          return [{ qtd: 0 }];
        }
        return [];
      }),
      run: jest.fn(),
    } as any;
    jest.spyOn(Database, 'getInstance').mockResolvedValue(db);

    const taskManager = {
      getTask: jest.fn().mockReturnValue(task),
      advanceState: jest.fn((currentTask: any, nextStatus: string) => {
        currentTask.status = nextStatus;
      }),
      saveTask: jest.fn(),
    } as any;
    const logRepo = createTestLogRepo();
    const recovery = new RecoveryManager(taskManager, logRepo);

    try {
      await recovery.runBootRecovery();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }

    expect(taskManager.advanceState).toHaveBeenCalledWith(task, 'running');
    expect(taskManager.advanceState).toHaveBeenCalledWith(task, 'failed');
    expect(task.metadata.pendingPermissionId).toBeNull();
    expect(task.metadata.pendingPermissionNotifiedAt).toBeNull();
    expect(task.error_summary).toMatch(/pedido de permission|permission request/i);
    expect(db.run).toHaveBeenCalledWith(
      'UPDATE permission_requests SET status = -, updated_at = -, decided_by = -, decision_note = - WHERE permission_id = - AND status = -',
      expect.arrayContaining(['rejected', 'system:recovery', 'perm-stale-1', 'pending']),
    );
  });
});
