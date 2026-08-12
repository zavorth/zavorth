import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import {
  createTestLogRepo,
  fetchDashboardJson,
} from '../helpers/dashboardWebTestUtils.js';

describe('WebApp hook plane endpoint', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('serves the hook plane through the protected web api', async () => {
    config.zavorthWebAuthToken = 'hooks-secret';
    const hookPlaneService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          supportedEvents: 12,
          coveredEvents: 3,
          readyEvents: 4,
          partialEvents: 6,
          plannedEvents: 2,
          customEvents: 0,
          registeredHooks: 3,
          workspaces: 2,
        },
        events: [
          {
            id: 'transport.before_action',
            label: 'Antes do transporte',
            stage: 'transport',
            description: 'Valida o transporte remoto antes da acao.',
            status: 'ready',
            registeredHooks: 2,
            sampleCommand: 'npm run hooks:transport:before',
          },
        ],
        registrations: [
          {
            workspace: 'workspace-alpha',
            workspaceName: 'Workspace Alpha',
            event: 'transport.before_action',
            command: 'npm run hooks:transport:before',
          },
        ],
        narrative: {
          headline: 'Plano oficial de hooks.',
          operatorSummary: '3 hooks registrados.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      hookPlaneService: hookPlaneService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/hooks',
      { token: 'hooks-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(hookPlaneService.buildSnapshot).toHaveBeenCalled();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        hooks: expect.objectContaining({
          summary: expect.objectContaining({
            supportedEvents: 12,
            registeredHooks: 3,
          }),
          narrative: expect.objectContaining({
            headline: 'Plano oficial de hooks.',
          }),
        }),
      }),
    );
  }, 15000);

  it('runs the hook plane through the protected web api', async () => {
    config.zavorthWebAuthToken = 'hooks-secret';
    const hookPlaneService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        summary: {
          supportedEvents: 12,
          coveredEvents: 3,
          readyEvents: 4,
          partialEvents: 6,
          plannedEvents: 2,
          customEvents: 0,
          registeredHooks: 3,
          workspaces: 2,
        },
        events: [],
        registrations: [],
        narrative: {
          headline: 'Plano oficial de hooks.',
          operatorSummary: '3 hooks registrados.',
        },
      })),
    };
    const hookPipelineService = {
      buildSnapshot: jest.fn(async (workspace: string) => ({
        generatedAt: '2026-04-02T12:00:00.000Z',
        workspace,
        summary: {
          totalRegistered: 1,
          coveredEvents: 1,
          customEvents: 0,
        },
        events: [],
        registered: [],
        narrative: {
          headline: 'Pipeline ativo.',
          operatorSummary: '1 hook visivel.',
        },
      })),
      buildExecutionPlan: jest.fn(async ({ workspace, event }: any) => [
        {
          event,
          origin: 'workspace',
          hook: {
            event,
            command: 'npm run hooks:test',
          },
          workspace,
        },
      ]),
      runEvent: jest.fn(async ({ workspace, event, dryRun }: any) => ({
        event,
        workspace,
        dryRun,
        ok: true,
        executions: [
          {
            event,
            workspace,
            dryRun,
            ok: true,
            hooks: [
              {
                event,
                command: 'npm run hooks:test',
              },
            ],
            results: [
              {
                command: 'npm run hooks:test',
                status: dryRun ? 'dry_run' : 'completed',
                exitCode: null,
                error: null,
              },
            ],
          },
        ],
      })),
    };
    const service = new DashboardService(logRepo, {
      hookPlaneService: hookPlaneService as any,
      hookPipelineService: hookPipelineService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/hooks/run',
      {
        token: 'hooks-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'before-runtime-exec',
            workspace: 'C:/repo',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(hookPipelineService.buildExecutionPlan).toHaveBeenCalledWith({
      workspace: 'C:/repo',
      event: 'before-runtime-exec',
    });
    expect(hookPipelineService.runEvent).toHaveBeenCalledWith({
      workspace: 'C:/repo',
      event: 'before-runtime-exec',
      dryRun: true,
    });
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        event: 'before-runtime-exec',
        workspace: 'C:/repo',
        dryRun: true,
        plan: expect.any(Array),
        run: expect.objectContaining({
          ok: true,
        }),
        pipeline: expect.objectContaining({
          workspace: 'C:/repo',
        }),
        hooks: expect.objectContaining({
          narrative: expect.objectContaining({
            headline: 'Plano oficial de hooks.',
          }),
        }),
      }),
    );
  }, 15000);
});
