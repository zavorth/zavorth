import fs from 'fs';
import os from 'os';
import path from 'path';
import { RuntimeDiagnosticsService } from '../../src/services/RuntimeDiagnosticsService';

describe('RuntimeDiagnosticsService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    jest.restoreAllMocks();
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('builds a consolidated snapshot with runtime locks, task state and recent failures', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-diagnostics-'));
    tempDirs.push(root);
    const hostLockFile = path.join(root, 'host.lock.json');
    const workerLockFile = path.join(root, 'worker.lock.json');
    const discordBridgeStatusFile = path.join(root, 'discord-bridge-status.json');
    const tenantRegistryFile = path.join(root, 'tenant-registry.json');
    const diagnosticsFile = path.join(root, 'runtime-diagnostics.json');

    fs.writeFileSync(
      hostLockFile,
      JSON.stringify({ pid: 7001, owner: 'host-supervisor', startedAt: '2026-03-26T00:00:00.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      workerLockFile,
      JSON.stringify({ pid: 7002, owner: 'telegram-long-polling', startedAt: '2026-03-26T00:00:02.000Z' }),
      'utf8',
    );
    fs.writeFileSync(
      discordBridgeStatusFile,
      JSON.stringify({
        mode: 'native',
        enabled: true,
        started: true,
        pendingInbox: 1,
        pendingOutbox: 2,
        lastError: null,
        updatedAt: '2026-03-26T01:02:00.000Z',
      }),
      'utf8',
    );
    fs.writeFileSync(
      tenantRegistryFile,
      JSON.stringify({
        tenants: {
          'discord:guild:guild-1': {
            tenantId: 'discord:guild:guild-1',
            tenantType: 'discord_guild',
            boundary: 'shared',
            isolationMode: 'tenant',
            onboardingStatus: 'pending_onboarding',
            platform: 'discord',
            policyProfile: 'discord-public-guild',
            publicServerMode: true,
            channelId: 'channel-9',
            ownerUserIds: ['owner-1'],
            allowedGuildIds: ['guild-1'],
            allowedChannelIds: [],
            firstSeenAt: '2026-03-26T00:30:00.000Z',
            lastSeenAt: '2026-03-26T01:10:00.000Z',
          },
        },
      }),
      'utf8',
    );

    const taskManager = {
      getPendingTasks: jest.fn().mockReturnValue([
        { status: 'running' },
        { status: 'waiting_approval' },
        { status: 'approved' },
        { status: 'planned' },
      ]),
      getRecentTasks: jest.fn().mockReturnValue([
        {
          task_id: 'task-failed-1234',
          source: 'telegram',
          status: 'failed',
          command_type: 'external_executor',
          executor_used: 'external_executor',
          updated_at: '2026-03-26T01:00:00.000Z',
          error_summary: 'gateway timeout',
          result_summary: null,
        },
        {
          task_id: 'task-ok-5678',
          source: 'web',
          status: 'completed',
          command_type: 'gemini',
          executor_used: 'gemini_cli',
          updated_at: '2026-03-26T01:01:00.000Z',
          error_summary: null,
          result_summary: 'ok',
        },
      ]),
    } as any;

    const logRepo = {
      getRecentLogs: jest.fn().mockReturnValue([
        {
          timestamp: '2026-03-26T01:05:00.000Z',
          level: 'error',
          category: 'ExternalExecutor',
          message: 'Gateway timeout while probing availability',
        },
      ]),
    } as any;

    const service = new RuntimeDiagnosticsService(taskManager, logRepo, diagnosticsFile, {
      hostLockFilePath: hostLockFile,
      workerLockFilePath: workerLockFile,
      discordBridgeStatusFilePath: discordBridgeStatusFile,
      tenantRegistryFilePath: tenantRegistryFile,
      now: () => new Date('2026-03-26T01:15:00.000Z'),
      kill: (pid: number) => {
        if (pid !== 7001 && pid !== 7002) {
          const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
          throw error;
        }
      },
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.runtime.hostSupervisor.pid).toBe(7001);
    expect(snapshot.runtime.hostSupervisor.alive).toBe(true);
    expect(snapshot.runtime.telegramWorker.pid).toBe(7002);
    expect(snapshot.runtime.discordBridge).toEqual(
      expect.objectContaining({
        mode: 'native',
        enabled: true,
        started: true,
        pendingInbox: 1,
        pendingOutbox: 2,
      }),
    );
    expect(snapshot.tenants).toEqual(
      expect.objectContaining({
        totalCount: 1,
        pendingOnboardingCount: 1,
        publicServerCount: 1,
        file: tenantRegistryFile,
      }),
    );
    expect(snapshot.tasks.activeCount).toBe(4);
    expect(snapshot.tasks.byStatus).toEqual({ running: 1, waiting_approval: 1, approved: 1, planned: 1 });
    expect(snapshot.tasks.latestBySource.telegram.taskId).toBe('task-failed-1234');
    expect(snapshot.tasks.recentFailures[0]).toEqual(
      expect.objectContaining({
        taskId: 'task-failed-1234',
        executor: 'external_executor',
        errorSummary: 'gateway timeout',
      }),
    );
    expect(snapshot.logs.lastError).toEqual(
      expect.objectContaining({
        category: 'ExternalExecutor',
        message: 'Gateway timeout while probing availability',
      }),
    );
  });

  it('writes the consolidated snapshot to disk', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-diagnostics-'));
    tempDirs.push(root);
    const diagnosticsFile = path.join(root, 'nested', 'runtime-diagnostics.json');
    const tenantRegistryFile = path.join(root, 'nested', 'tenant-registry.json');
    const service = new RuntimeDiagnosticsService(
      {
        getPendingTasks: jest.fn().mockReturnValue([]),
        getRecentTasks: jest.fn().mockReturnValue([]),
      } as any,
      {
        getRecentLogs: jest.fn().mockReturnValue([]),
      } as any,
      diagnosticsFile,
      {
        tenantRegistryFilePath: tenantRegistryFile,
      },
    );

    const snapshot = service.writeSnapshot();
    const persisted = JSON.parse(fs.readFileSync(diagnosticsFile, 'utf8'));

    expect(persisted.generatedAt).toBe(snapshot.generatedAt);
    expect(persisted.tenants.totalCount).toBe(0);
    expect(persisted.tasks.activeCount).toBe(0);
  });
});
