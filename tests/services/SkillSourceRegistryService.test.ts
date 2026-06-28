import { SkillSourceRegistryService } from '../../src/services/SkillSourceRegistryService.js';

describe('SkillSourceRegistryService', () => {
  it('resolves enabled sources with absolute paths', () => {
    const service = new SkillSourceRegistryService({
      projectRoot: 'C:/workspace/zavorth',
      configFile: 'C:/workspace/zavorth/config/skill-sources.json',
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() =>
        JSON.stringify({
          version: 1,
          sources: [
            {
              id: 'workspace-agents',
              label: 'Workspace .agents skills',
              kind: 'workspace',
              trust: 'trusted',
              enabled: true,
              ingestionMode: 'local-scan',
              path: '.agents/skills',
              createIfMissing: true,
            },
            {
              id: 'disabled-source',
              label: 'Disabled',
              enabled: false,
              ingestionMode: 'local-scan',
              path: 'tmp/disabled',
            },
          ],
        }),
      ) as any,
    });

    const entries = service.listSources();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: 'workspace-agents',
        absolutePath: 'C:\\workspace\\zavorth\\.agents\\skills',
        absoluteAllowedExternalSupportPaths: [],
        createIfMissing: true,
      }),
    );
    expect(service.getSource('disabled-source')).toBeNull();
    expect(service.getSource('disabled-source', { includeDisabled: true })).toEqual(
      expect.objectContaining({
        id: 'disabled-source',
        enabled: false,
      }),
    );
  });

  it('falls back to the workspace defaults when the config file is missing', () => {
    const service = new SkillSourceRegistryService({
      projectRoot: 'C:/workspace/zavorth',
      configFile: 'C:/workspace/zavorth/config/skill-sources.json',
      existsSync: jest.fn(() => false),
    });

    const searchSources = service.listSearchSources();

    expect(searchSources.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['workspace-agents', 'workspace-library']),
    );
  });

  it('resolves profile-scoped sources under an isolated skill profile root', () => {
    const service = new SkillSourceRegistryService({
      projectRoot: 'C:/workspace/zavorth',
      profileRoot: 'C:/Users/example/.zavorth/profiles/work',
      configFile: 'C:/workspace/zavorth/config/skill-sources.json',
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() =>
        JSON.stringify({
          version: 1,
          sources: [
            {
              id: 'profile-skills',
              label: 'Profile skills',
              kind: 'workspace',
              trust: 'trusted',
              enabled: true,
              ingestionMode: 'local-scan',
              path: 'skills',
              createIfMissing: true,
              profileScoped: true,
              allowedExternalSupportPaths: ['support'],
            },
          ],
        }),
      ) as any,
    });

    expect(service.listSources()[0]).toEqual(
      expect.objectContaining({
        id: 'profile-skills',
        profileScoped: true,
        absolutePath: 'C:\\Users\\example\\.zavorth\\profiles\\work\\skills',
        absoluteAllowedExternalSupportPaths: ['C:\\Users\\example\\.zavorth\\profiles\\work\\support'],
      }),
    );
  });
});
