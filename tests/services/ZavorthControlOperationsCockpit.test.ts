import { ZavorthControlService } from '../../src/services/ZavorthControlService';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
  fetchNoKeepAlive,
} from '../helpers/zavorthControlWebTestUtils.js';

describe('ZavorthControlService operations cockpit', () => {
  const logRepo = createTestLogRepo();

  it('serves the cockpit snapshot endpoint and references it from the zavorthControl html', async () => {
    const operationsSnapshot = {
      generatedAt: new Date().toISOString(),
      sidecars: {},
      docker: {
        enabled: true,
        required: false,
        available: true,
        canRun: true,
        detail: 'ok',
        languages: {
          javascript: { canRun: true, detail: 'ok', image: 'node:22-bullseye' },
          python: { canRun: true, detail: 'ok', image: 'python:3.12-slim' },
          shell: { canRun: true, detail: 'ok', image: 'bash:5.2' },
        },
      },
      publish: {
        available: true,
        publishedAt: new Date().toISOString(),
        branch: 'codex/initial-publish',
        commit: 'abc12345',
        sourceArchiveId: null,
        docsUrl: 'https://docs.example.com',
        remoteConsoleUrl: 'https://console.example.com',
        gitPush: 'completed',
        smokeTest: 'passed',
        history: [],
      },
      maintenance: {
        available: true,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        stepCount: 4,
        completedSteps: 4,
        dryRun: false,
        withSoak: true,
        withPublish: false,
      },
      maintenanceAutomation: {
        enabled: true,
        running: false,
        lastTriggeredAt: new Date().toISOString(),
        nextPlannedAt: new Date(Date.now() + 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        note: 'ok',
        lastActionId: 'scheduled-maintenance',
        lastActionLogFile: '/runtime/actions/scheduled.log',
        lastReportFinishedAt: new Date().toISOString(),
        lastReportStepCount: 5,
      },
      storage: {
        rootPath: 'C:/workspace/zavorth/data',
        totalBytes: 1000,
        freeBytes: 800,
        usedBytes: 200,
        freePercent: 80,
        hotspots: [],
      },
      security: {
        zavorthControlAuth: {
          enabled: true,
          source: 'env',
          tokenFile: '/runtime/web-api-token.txt',
          tokenFileExists: true,
          note: 'ok',
        },
        mailboxSecret: {
          source: 'runtime-file',
          filePath: '/runtime/mailbox-secret.key',
          fileExists: true,
        },
        dbEncryption: {
          enabled: true,
          source: 'runtime-file',
          filePath: '/runtime/db-field.key',
          fileExists: true,
        },
        hostIdentity: {
          filePath: '/runtime/authorized-host.json',
          exists: true,
        },
        lastAudit: {
          available: true,
          generatedAt: new Date().toISOString(),
          ok: true,
          summary: 'ok',
        },
        lastPreflight: {
          available: true,
          generatedAt: new Date().toISOString(),
          ok: true,
          summary: 'ok',
        },
        needsAttention: false,
      },
      errors: {
        lastError: null,
        recent: [],
      },
    };

    const cockpitSnapshot = {
      generatedAt: new Date().toISOString(),
      status: 'healthy',
      headline: 'Runtime estavel.',
      highlights: ['All good.'],
      runtime: {
        uptimeLabel: '2h 0m',
        memoryLabel: '256 MB RSS',
        heapLabel: '128 MB heap',
        platformLabel: 'win32 / x64',
        sampledAt: new Date().toISOString(),
      },
      summary: {
        enabledSidecars: 1,
        readySidecars: 1,
        recentErrorCount: 0,
        freeDiskPercent: 80,
        publishAgeLabel: 'agora',
      },
      actions: [
        {
          id: 'maintenance-keepalive',
          label: 'Manter o host saudavel',
          command: 'npm run ops:maintain',
          reason: 'Fluxo padrao.',
          priority: 'normal',
        },
      ],
      alerts: [],
      operations: operationsSnapshot,
    };

    const service = new ZavorthControlService(logRepo, {
      operationsHealthService: {
        readSnapshot: jest.fn(() => operationsSnapshot),
      } as any,
      operationsCockpitService: {
        readSnapshot: jest.fn(() => cockpitSnapshot),
      } as any,
    });

    await service.start();
    const baseUrl = service.getUrl();
    const [pageResponse, { status: cockpitStatus, payload: cockpit }] = await Promise.all([
      fetchNoKeepAlive(`${baseUrl}/classic`),
      fetchZavorthControlJson(baseUrl, '/api/operations/cockpit'),
    ]);
    const html = await pageResponse.text();
    await service.stopAsync();

    expect(pageResponse.status).toBe(410);
    expect(cockpitStatus).toBe(200);
    expect(html).toContain('/zavorthControl');
    expect(cockpit).toEqual(
      expect.objectContaining({
        status: 'healthy',
        headline: 'Runtime estavel.',
      }),
    );
  });
});
