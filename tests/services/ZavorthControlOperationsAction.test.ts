import { config } from '../../src/config/index.js';
import { ZavorthControlService } from '../../src/services/ZavorthControlService.js';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
} from '../helpers/zavorthControlWebTestUtils.js';

describe('ZavorthControlService operations actions', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('starts an operational action for local requests', async () => {
    const actionService = {
      execute: jest.fn(() => ({
        id: 'maintenance',
        label: 'Rodar manutencao operacional',
        command: 'npm run ops:maintain',
        priority: 'normal',
        startedAt: new Date().toISOString(),
        pid: 4123,
        logFile: 'C:/runtime/actions/maintenance.log',
        status: 'started',
        note: 'ok',
      })),
    };

    const service = new ZavorthControlService(logRepo, {
      operationsActionService: actionService as any,
      operationsHealthService: {
        readSnapshot: jest.fn(() => ({
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
            freeBytes: 900,
            usedBytes: 100,
            freePercent: 90,
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
        })),
      } as any,
      operationsCockpitService: {
        readSnapshot: jest.fn(() => ({
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
            freeDiskPercent: 90,
            publishAgeLabel: 'agora',
          },
          actions: [
            {
              id: 'maintenance',
              label: 'Rodar manutencao operacional',
              command: 'npm run ops:maintain',
              reason: 'Fluxo padrao.',
              priority: 'normal',
            },
          ],
          alerts: [],
          operations: {},
        })),
      } as any,
    });

    await service.start();
    const result = await fetchZavorthControlJson(service.getUrl(), '/api/operations/actions', {
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ actionId: 'maintenance' }),
      },
    });
    await service.stopAsync();

    expect(result.status).toBe(202);
    expect(actionService.execute).toHaveBeenCalledWith('maintenance');
    expect(result.payload).toEqual(
      expect.objectContaining({
        ok: true,
        accepted: true,
      }),
    );
  });

  it('rejects remote operational action requests without a valid token', async () => {
    config.zavorthWebAuthToken = 'secret-token';

    const actionService = {
      execute: jest.fn(),
    };

    const service = new ZavorthControlService(logRepo, {
      operationsActionService: actionService as any,
    });

    const statusBag = { code: 0, payload: null as any };
    const req: any = {
      method: 'POST',
      headers: {},
      socket: {
        remoteAddress: '10.0.0.55',
      },
      on(event: string, callback: (...args: any[]) => void) {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify({ actionId: 'maintenance' })));
        }
        if (event === 'end') {
          callback();
        }
        return this;
      },
    };
    const res: any = {
      setHeader: jest.fn(),
      writeHead: jest.fn((code: number) => {
        statusBag.code = code;
      }),
      end: jest.fn((body?: string) => {
        statusBag.payload = body ? JSON.parse(body) : null;
      }),
    };

    await (service as any).handleOperationsActionRequest(req, res);

    expect(statusBag.code).toBe(403);
    expect(statusBag.payload).toEqual(
      expect.objectContaining({
        ok: false,
      }),
    );
    expect(actionService.execute).not.toHaveBeenCalled();
  });
});
