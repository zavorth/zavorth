import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

describe('WebApp memory plane endpoints', () => {
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

  it('serves the official memory plane through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-memory-plane-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const memoryPlaneService = {
      buildSnapshot: jest.fn(async () => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          persistedMemories: 2,
          relevantMemories: 1,
          replayTasks: 3,
          workflowRuns: 1,
          artifacts: 2,
          workspaceSignals: 4,
          timelineEvents: 3,
          historicalEvents: 1,
          changedFacts: 1,
        },
        memory: {
          recent: [],
          relevant: [],
          categories: ['workflow'],
          vectorRecall: true,
        },
        timeline: {
          recent: [],
          conflicts: [],
          latestHistoricalAt: null,
        },
        replay: {
          headline: 'Replay pronto.',
        },
        artifacts: {
          recent: [],
          kinds: ['doc'],
          latestLabel: 'briefing-final.md',
          reusableCount: 2,
        },
        workspace: {
          workspace: 'C:/repo',
          summary: 'Workspace pronto para entrega.',
          recentArtifacts: [],
          continuityRecommendations: [],
          workflowRecommendations: [],
        },
        suggestedActions: [],
        narrative: {
          headline: 'Retomada e entregas prontas.',
          operatorSummary: 'Snapshot oficial do memory plane via web.',
        },
      })),
    };
    const taskManager = {
      getRecentTasksByChat: jest.fn(() => []),
      getRecentTasksByUsers: jest.fn(() => []),
      getRecentTasks: jest.fn(() => []),
      getTask: jest.fn(() => null),
    };
    const permissionService = {
      listRequests: jest.fn(async () => []),
    };
    const parser = {
      parse: jest.fn((text: string) => ({
        normalized_message: text,
        command_type: '/task',
      })),
    };
    const taskOrchestrationController = {
      handleTaskMessage: jest.fn(async () => null),
    };
    const permissionController = {
      formatPermissionCreatedMessage: jest.fn(),
      resolvePermissionReference: jest.fn(),
      handlePermissionCallback: jest.fn(),
      shortPermissionId: jest.fn(),
      handleApproval: jest.fn(),
      handleRejection: jest.fn(),
    };

    const service = new DashboardService(logRepo, {
      memoryPlaneService: memoryPlaneService as any,
      taskManager: taskManager as any,
      permissionService: permissionService as any,
      parser: parser as any,
      taskOrchestrationController: taskOrchestrationController as any,
      permissionController: permissionController as any,
      webUserId: 'telegram-admin',
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/memory-plane?sessionId=session-web-1',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        memoryPlane: expect.objectContaining({
          narrative: expect.objectContaining({
            headline: 'Retomada e entregas prontas.',
            operatorSummary: 'Snapshot oficial do memory plane via web.',
          }),
          summary: expect.objectContaining({
            artifacts: 2,
            persistedMemories: 2,
          }),
        }),
      }),
    );
  });
});
