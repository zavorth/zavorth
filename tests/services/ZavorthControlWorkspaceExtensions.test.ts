import { ZavorthControlService } from '../../src/services/ZavorthControlService';
import { createTestLogRepo, fetchZavorthControlJson } from '../helpers/zavorthControlWebTestUtils.js';

describe('ZavorthControl workspace extension plane endpoint', () => {
  const logRepo = createTestLogRepo();

  it('serves workspace extensions through the operations api', async () => {
    const workspaceExtensionRegistryService = {
      buildSnapshot: jest.fn(({ selectedId, query }: any = {}) => ({
        generatedAt: '2026-04-05T10:00:00.000Z',
        summary: {
          workspaces: 1,
          commands: 3,
          hooks: 2,
          withInstructions: 1,
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
        ],
        selected: selectedId === 'repo-alpha'
          ? {
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
            }
          : null,
        narrative: {
          headline: 'Workspace plane com 1 workspace(s) perfilado(s).',
          operatorSummary: '3 comando(s), 2 hook(s) e 1 workspace(s) com instrucoes visiveis.',
        },
      })),
    };
    const service = new ZavorthControlService(logRepo, {
      workspaceExtensionRegistryService: workspaceExtensionRegistryService as any,
    });

    await service.start();
    const { status, payload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/workspace/extensions?selectedId=repo-alpha',
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(workspaceExtensionRegistryService.buildSnapshot).toHaveBeenCalledWith({
      selectedId: 'repo-alpha',
      query: null,
    });
    expect(payload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          workspaces: 1,
          commands: 3,
          hooks: 2,
        }),
        selected: expect.objectContaining({
          slug: 'repo-alpha',
        }),
      }),
    );
  }, 15000);
});
