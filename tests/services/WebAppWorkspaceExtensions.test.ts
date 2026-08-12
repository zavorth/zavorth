import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

describe('WebApp workspace extension plane endpoint', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('serves workspace extensions through the protected web api', async () => {
    config.zavorthWebAuthToken = 'workspace-secret';
    const workspaceExtensionRegistryService = {
      buildSnapshot: jest.fn(({ selectedId, query }: any = {}) => ({
        generatedAt: '2026-04-05T10:00:00.000Z',
        summary: {
          workspaces: 2,
          commands: 5,
          hooks: 3,
          withInstructions: 2,
        },
        query: query || null,
        entries: [
          {
            workspace: 'C:/repo-alpha',
            workspaceName: 'Repo Alpha',
            slug: 'repo-alpha',
            instructionFile: 'C:/repo-alpha/ZAVORTH.md',
            instructionSummary: 'Workspace principal.',
            commandCount: 3,
            hookCount: 2,
            commands: [],
            hooks: [],
            lastRefreshed: '2026-04-05T09:00:00.000Z',
          },
          {
            workspace: 'C:/repo-beta',
            workspaceName: 'Repo Beta',
            slug: 'repo-beta',
            instructionFile: null,
            instructionSummary: 'Workspace auxiliar.',
            commandCount: 2,
            hookCount: 1,
            commands: [],
            hooks: [],
            lastRefreshed: '2026-04-05T09:30:00.000Z',
          },
        ],
        selected: selectedId === 'repo-beta'
          ? {
              workspace: 'C:/repo-beta',
              workspaceName: 'Repo Beta',
              slug: 'repo-beta',
              instructionFile: null,
              instructionSummary: 'Workspace auxiliar.',
              commandCount: 2,
              hookCount: 1,
              commands: [],
              hooks: [],
              lastRefreshed: '2026-04-05T09:30:00.000Z',
            }
          : null,
        narrative: {
          headline: 'Workspace plane com 2 workspace(s) perfilado(s).',
          operatorSummary: '5 comando(s), 3 hook(s) e 2 workspace(s) com instrucoes visiveis.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      workspaceExtensionRegistryService: workspaceExtensionRegistryService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/workspace/extensions?selectedId=repo-beta',
      { token: 'workspace-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(workspaceExtensionRegistryService.buildSnapshot).toHaveBeenCalledWith({
      selectedId: 'repo-beta',
      query: null,
    });
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        workspaceExtensions: expect.objectContaining({
          summary: expect.objectContaining({
            workspaces: 2,
            commands: 5,
            hooks: 3,
          }),
          selected: expect.objectContaining({
            slug: 'repo-beta',
          }),
        }),
      }),
    );
  }, 15000);
});
