import { ZavorthToolCatalogService } from '../../src/services/ZavorthToolCatalogService.js';

describe('ZavorthToolCatalogService', () => {
  it('builds explicit tool families from commands, sessions, teams and integrations', () => {
    const service = new ZavorthToolCatalogService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      capabilityRegistry: {
        getAll: () => [
          {
            id: 'command-review',
            label: 'Review',
            source: 'builtin',
            command: {
              command: '/review',
              description: 'Review',
              section: 'execution',
            },
          },
          {
            id: 'route-research',
            label: 'Research Route',
            source: 'plugin',
            matchers: [{ keywords: ['pesquise'] }],
            routing_reason: 'Research request',
            type: 'research',
          },
        ],
      } as any,
      integrationHubService: {
        buildCatalogSnapshot: () => ({
          entries: [
            {
              manifest: {
                id: 'openrouter',
                label: 'OpenRouter',
                category: 'remote',
                summary: 'Gateway remoto',
                connectCommand: '/connect openrouter',
              },
              readiness: 'ready',
            },
          ],
        }),
      } as any,
      teamCatalogService: {
        buildSnapshot: () => ({
          summary: { total: 2 },
          teams: [
            { id: 'ship', label: 'Ship Team', entryCommand: '/workflow ship <objetivo>' },
          ],
        }),
      } as any,
      gatewaySessionToolsService: {
        buildDescriptors: () => [
          { id: 'sessions_list', label: 'sessions_list', readiness: 'ready' },
          { id: 'sessions_send', label: 'sessions_send', readiness: 'partial' },
        ],
      } as any,
      runtimeToolCatalogService: {
        listTools: () => [
          {
            id: 'web_search',
            label: 'web_search',
            description: 'Pesquisa na web.',
            parameterCount: 2,
            requiredCount: 1,
            source: 'registry',
          },
        ],
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.totalFamilies).toBeGreaterThanOrEqual(5);
    expect(snapshot.summary.totalTools).toBeGreaterThanOrEqual(5);
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'command-review', familyId: 'execution' }),
        expect.objectContaining({ id: 'sessions_send', familyId: 'session' }),
        expect.objectContaining({ id: 'openrouter', familyId: 'integration' }),
        expect.objectContaining({ id: 'web_search', familyId: 'search', kind: 'runtime-tool' }),
      ]),
    );
    expect(snapshot.families).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'execution', readiness: 'ready' }),
        expect.objectContaining({ id: 'session', total: 2 }),
        expect.objectContaining({ id: 'team', total: 1 }),
        expect.objectContaining({ id: 'integration', total: 1 }),
      ]),
    );
  });

  it('filters and selects explicit tools by query', () => {
    const service = new ZavorthToolCatalogService({
      capabilityRegistry: {
        getAll: () => [
          {
            id: 'command-review',
            label: 'Review',
            source: 'builtin',
            command: {
              command: '/review',
              description: 'Review',
              section: 'execution',
            },
          },
        ],
      } as any,
      runtimeToolCatalogService: {
        listTools: () => [
          {
            id: 'read_file',
            label: 'read_file',
            description: 'Le um file.',
            parameterCount: 1,
            requiredCount: 1,
            source: 'registry',
          },
        ],
      } as any,
    });

    const snapshot = service.buildSnapshot({ query: 'read_file', selectedId: 'read_file' });

    expect(snapshot.query).toBe('read_file');
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.selected).toEqual(
      expect.objectContaining({
        id: 'read_file',
        kind: 'runtime-tool',
        familyId: 'runtime',
      }),
    );
    expect(snapshot.narrative.headline).toContain('read_file');
  });
});
