import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

type TestTask = {
  task_id: string;
  source: string;
  chat_id: string;
  user_id: string;
  workspace: string;
  updated_at: string;
  created_at: string;
  status: string;
  raw_message: string;
  result_summary: string;
  metadata: Record<string, any>;
};

function createGatewayWebRuntime() {
  const tasks: TestTask[] = [
    {
      task_id: 'task-web-seed-1',
      source: 'web',
      chat_id: 'web:session-web-1',
      user_id: 'telegram-admin',
      workspace: 'C:/repo',
      updated_at: '2026-04-05T10:00:00.000Z',
      created_at: '2026-04-05T09:59:00.000Z',
      status: 'completed',
      raw_message: 'continue gateway',
      result_summary: 'Snapshot ready.',
      metadata: {
        runtime_user_id: 'telegram-admin',
        surface_identity: {
          chatId: 'web:session-web-1',
          sessionId: 'session-web-1',
          runtime_user_id: 'telegram-admin',
        },
      },
    },
  ];

  const taskManager = {
    getRecentTasksByChat: jest.fn((chatId: string, limit = 25) =>
      tasks.filter((task) => task.chat_id === chatId).slice(0, limit),
    ),
    getRecentTasksByUsers: jest.fn((userIds: string[], limit = 25) =>
      tasks.filter((task) => userIds.includes(task.user_id)).slice(0, limit),
    ),
    getRecentTasks: jest.fn((limit = 25, userId-: string) =>
      tasks.filter((task) => !userId || task.user_id === userId).slice(0, limit),
    ),
    getTask: jest.fn((taskId: string) => tasks.find((task) => task.task_id === taskId) || null),
  };

  const parser = {
    parse: jest.fn((text: string) => ({
      normalized_message: text,
      command_type: '/task',
    })),
  };

  const taskOrchestrationController = {
    handleTaskMessage: jest.fn(async (_ctx: any, payload: any) => {
      const task: TestTask = {
        task_id: `task-web-${tasks.length + 1}`,
        source: payload.source || 'web',
        chat_id: payload.chatId,
        user_id: payload.userId,
        workspace: payload.surfaceMetadata?.workspace || 'C:/repo',
        updated_at: '2026-04-05T10:05:00.000Z',
        created_at: '2026-04-05T10:05:00.000Z',
        status: 'queued',
        raw_message: payload.text,
        result_summary: 'Dispatch aceito.',
        metadata: {
          runtime_user_id: payload.userId,
          surface_identity: {
            chatId: payload.chatId,
            sessionId: payload.surfaceMetadata?.sessionId || null,
            runtime_user_id: payload.userId,
          },
        },
      };
      tasks.unshift(task);
      return task;
    }),
  };

  const permissionService = {
    listRequests: jest.fn(async () => []),
  };

  const permissionController = {
    formatPermissionCreatedMessage: jest.fn(),
    resolvePermissionReference: jest.fn(),
    handlePermissionCallback: jest.fn(),
    shortPermissionId: jest.fn(() => 'perm-short'),
    handleApproval: jest.fn(),
    handleRejection: jest.fn(),
  };

  return {
    tasks,
    taskManager,
    parser,
    taskOrchestrationController,
    permissionService,
    permissionController,
  };
}

describe('WebApp gateway session routes', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalDashboardRuntimeStateFile = config.dashboardRuntimeStateFile;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.dashboardRuntimeStateFile = originalDashboardRuntimeStateFile;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('serves canonical session list and history through the gateway route', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-gateway-sessions-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');
    const runtime = createGatewayWebRuntime();

    const service = new DashboardService(logRepo, {
      taskManager: runtime.taskManager as any,
      permissionService: runtime.permissionService as any,
      parser: runtime.parser as any,
      taskOrchestrationController: runtime.taskOrchestrationController as any,
      permissionController: runtime.permissionController as any,
      webUserId: 'telegram-admin',
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/gateway/sessions-sessionId=session-web-1',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        session: expect.objectContaining({
          chatId: 'web:session-web-1',
          runtimeUserId: 'telegram-admin',
        }),
        sessions: expect.objectContaining({
          total: 1,
          entries: expect.arrayContaining([
            expect.objectContaining({
              chatId: 'web:session-web-1',
              latestTaskId: 'task-web-seed-1',
            }),
          ]),
        }),
        sessionsSummary: expect.objectContaining({
          total: 1,
        }),
        gatewaySessionTools: expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({ id: 'sessions_list' }),
            expect.objectContaining({ id: 'sessions_history' }),
            expect.objectContaining({ id: 'sessions_send' }),
            expect.objectContaining({ id: 'sessions_spawn' }),
          ]),
        }),
        sessionPlane: expect.objectContaining({
          summary: expect.objectContaining({
            sessions: 1,
          }),
        }),
      }),
    );
  }, 40000);

  it('routes canonical sends through the gateway session endpoint', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-gateway-send-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');
    const runtime = createGatewayWebRuntime();

    const service = new DashboardService(logRepo, {
      taskManager: runtime.taskManager as any,
      permissionService: runtime.permissionService as any,
      parser: runtime.parser as any,
      taskOrchestrationController: runtime.taskOrchestrationController as any,
      permissionController: runtime.permissionController as any,
      webUserId: 'telegram-admin',
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/gateway/sessions/send',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: 'session-web-1',
            message: 'continue project summary',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    const snapshot = payload.snapshot || payload;
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        sessionId: 'session-web-1',
        taskId: null,
        session: expect.objectContaining({
          chatId: 'web:session-web-1',
        }),
        gatewaySessionTools: expect.objectContaining({
          history: expect.objectContaining({
            chatId: 'web:session-web-1',
          }),
        }),
        agentRuntime: expect.any(Object),
      }),
    );
    expect(snapshot.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'continue project summary',
          role: 'user',
        }),
        expect.objectContaining({
          role: 'assistant',
        }),
      ]),
    );
  }, 40000);

  it('spawns canonical sessions through the gateway session endpoint', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-gateway-spawn-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');
    const runtime = createGatewayWebRuntime();

    const service = new DashboardService(logRepo, {
      taskManager: runtime.taskManager as any,
      permissionService: runtime.permissionService as any,
      parser: runtime.parser as any,
      taskOrchestrationController: runtime.taskOrchestrationController as any,
      permissionController: runtime.permissionController as any,
      webUserId: 'telegram-admin',
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/gateway/sessions/spawn',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: 'session-web-1',
            platform: 'web',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        sessionId: expect.any(String),
        spawnedFrom: 'session-web-1',
        spawn: expect.objectContaining({
          ok: true,
          platform: 'web',
          sessionId: expect.any(String),
        }),
        sessionPlane: expect.objectContaining({
          summary: expect.objectContaining({
            spawnReady: true,
          }),
        }),
      }),
    );
  }, 40000);

  it('exposes the gateway domain plane through the web surface', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-gateway-domains-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');
    const runtime = createGatewayWebRuntime();

    const service = new DashboardService(logRepo, {
      taskManager: runtime.taskManager as any,
      permissionService: runtime.permissionService as any,
      parser: runtime.parser as any,
      taskOrchestrationController: runtime.taskOrchestrationController as any,
      permissionController: runtime.permissionController as any,
      webUserId: 'telegram-admin',
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/gateway/domains',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        domains: expect.objectContaining({
          summary: expect.objectContaining({
            total: 12,
            initialized: 12,
            pending: 0,
          }),
          domains: expect.any(Array),
        }),
      }),
    );
    expect(payload.domains.domains).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'gateway',
          initialized: true,
        }),
        expect.objectContaining({
          id: 'sessions',
          initialized: true,
        }),
      ]),
    );
  }, 40000);

});
