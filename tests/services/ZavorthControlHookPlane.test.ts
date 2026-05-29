import { ZavorthControlService } from '../../src/services/ZavorthControlService.js';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
} from '../helpers/controlWebTestUtils.js';

describe('ZavorthControl hook plane endpoint', () => {
  const logRepo = createTestLogRepo();

  it('serves the hook plane through the operations api', async () => {
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
            id: 'session.before_send',
            label: 'Antes do envio',
            stage: 'session',
            description: 'Executa gates antes do envio de sessao.',
            status: 'ready',
            registeredHooks: 1,
            sampleCommand: 'npm run hooks:session:before-send',
          },
        ],
        registrations: [
          {
            workspace: 'workspace-alpha',
            workspaceName: 'Workspace Alpha',
            event: 'session.before_send',
            command: 'npm run hooks:session:before-send',
          },
        ],
        narrative: {
          headline: 'Plano oficial de hooks.',
          operatorSummary: '3 hooks registrados.',
        },
      })),
    };
    const service = new ZavorthControlService(logRepo, {
      hookPlaneService: hookPlaneService as any,
    });

    await service.start();
    const { status, payload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/hooks',
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(hookPlaneService.buildSnapshot).toHaveBeenCalled();
    expect(payload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          supportedEvents: 12,
          coveredEvents: 3,
          registeredHooks: 3,
        }),
        narrative: expect.objectContaining({
          operatorSummary: '3 hooks registrados.',
        }),
      }),
    );
  }, 15000);

  it('runs the hook plane through the operations api', async () => {
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
    const service = new ZavorthControlService(logRepo, {
      hookPlaneService: hookPlaneService as any,
      hookPipelineService: hookPipelineService as any,
    });

    await service.start();
    const { status, payload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/hooks/run',
      {
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
