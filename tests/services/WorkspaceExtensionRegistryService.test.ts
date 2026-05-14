import { WorkspaceExtensionRegistryService } from '../../src/services/WorkspaceExtensionRegistryService';

describe('WorkspaceExtensionRegistryService', () => {
  it('builds a searchable snapshot with selected entry and summary', () => {
    const service = new WorkspaceExtensionRegistryService({
      now: () => new Date('2026-04-05T12:00:00.000Z'),
      profilesDir: 'C:/profiles',
      existsSync: () => true,
      readdirSync: () => ['repo-alpha.json', 'repo-beta.json'] as any,
      readFileSync: ((filePath: string) => {
        if (String(filePath).includes('repo-alpha.json')) {
          return JSON.stringify({
            workspace: 'C:/repo-alpha',
            workspace_name: 'Repo Alpha',
            slug: 'repo-alpha',
            instruction_file: 'C:/repo-alpha/ZAVORTH.md',
            instruction_summary: 'Workspace principal',
            workspace_commands: [
              { name: 'doctor', template: 'npm run doctor' },
            ],
            workspace_hooks: [
              { event: 'before-runtime-exec', command: 'npm run hooks:before-runtime' },
            ],
            last_refreshed: '2026-04-05T11:00:00.000Z',
          });
        }
        return JSON.stringify({
          workspace: 'C:/repo-beta',
          workspace_name: 'Repo Beta',
          slug: 'repo-beta',
          instruction_file: null,
          instruction_summary: 'Workspace auxiliar',
          workspace_commands: [
            { name: 'smoke', template: 'npm run smoke' },
            { name: 'sync', template: 'npm run sync' },
          ],
          workspace_hooks: [],
          last_refreshed: '2026-04-05T11:30:00.000Z',
        });
      }) as any,
    });

    const snapshot = service.buildSnapshot({
      selectedId: 'repo-beta',
      query: 'beta',
    });

    expect(snapshot.generatedAt).toBe('2026-04-05T12:00:00.000Z');
    expect(snapshot.summary).toEqual({
      workspaces: 1,
      commands: 2,
      hooks: 0,
      withInstructions: 0,
    });
    expect(snapshot.selected).toEqual(
      expect.objectContaining({
        slug: 'repo-beta',
        workspaceName: 'Repo Beta',
      }),
    );
    expect(snapshot.narrative.headline).toContain('1 workspace(s)');
  });
});
