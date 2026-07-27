import { ZavorthPlatformRegistrySnapshotBuilderService } from '../../src/domain/platform-ecosystem/infrastructure/platform-registry/ZavorthPlatformRegistrySnapshotBuilderService.js';

describe('ZavorthPlatformRegistrySnapshotBuilderService', () => {
  it('builds registry snapshots directly from the extracted snapshot builder', () => {
    const service = new ZavorthPlatformRegistrySnapshotBuilderService({
      now: () => new Date('2026-04-16T12:00:00.000Z'),
      pluginRegistryService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-16T12:00:00.000Z',
          summary: {
            total: 1,
            ready: 1,
            configurable: 0,
            templates: 0,
            workspaceExtensions: 0,
            trusted: 1,
            installed: 1,
            catalogBacked: 1,
            featured: 1,
          },
          query: null,
          entries: [
            {
              id: 'openrouter',
              kind: 'integration',
              source: 'integration-hub',
              label: 'OpenRouter',
              version: 'native',
              readiness: 'ready',
              trust: 'trusted',
              summary: 'Gateway remoto ready.',
              actionHint: '/integrations openrouter',
              installState: 'installed',
              registrySource: 'registry:local-catalog',
              featured: true,
              tags: ['remote'],
              capabilities: ['chat'],
              searchText: 'openrouter remote',
              actions: [
                {
                  id: 'openrouter:trust',
                  label: 'Marcar trusted',
                  command: '/plugins trust openrouter',
                  kind: 'trust',
                },
              ],
              details: ['Pack: remote-gateways'],
            },
          ],
          selected: null,
          featuredIds: ['openrouter'],
          narrative: {
            headline: 'Plugin plane',
            operatorSummary: 'Resumo',
          },
        }),
      } as any,
      catalogSourceService: {
        listEntries: () => [
          {
            id: 'plugin:openrouter',
            label: 'OpenRouter',
            kind: 'plugin',
            source: 'registry:local-catalog',
            readiness: 'partial',
            trust: 'review',
            installState: 'available',
            summary: 'Gateway remoto recomendado.',
            actionHint: '/plugins install openrouter',
            tags: ['featured', 'gateway'],
            capabilities: ['chat'],
            details: ['Pack: remote-gateways'],
            featured: true,
            searchText: 'openrouter registry',
          },
          {
            id: 'skill:playwright-interactive',
            label: 'playwright-interactive',
            kind: 'skill',
            source: 'registry:local-catalog',
            readiness: 'planned',
            trust: 'planned',
            installState: 'available',
            summary: 'Skill sugerida para ui debug.',
            actionHint: 'Instalar/ativar a skill playwright-interactive',
            tags: ['browser'],
            capabilities: ['prompt-workflow'],
            details: ['Pack: ui-debug'],
            featured: true,
            searchText: 'playwright skill',
          },
          {
            id: 'mcp:playwright',
            label: 'playwright',
            kind: 'mcp',
            source: 'registry:local-catalog',
            readiness: 'planned',
            trust: 'planned',
            installState: 'available',
            summary: 'MCP sugerido para browser automation.',
            actionHint: 'Revisar manifesto MCP para playwright',
            tags: ['browser'],
            capabilities: ['browser'],
            details: ['Pack: ui-debug'],
            featured: false,
            searchText: 'mcp playwright',
          },
        ],
        listCollections: () => [
          {
            id: 'collection:ui-debug',
            label: 'UI Debug',
            source: 'registry:local-catalog',
            summary: 'Colecao para browser debugging.',
            actionHint: '/platform collection:ui-debug',
            tags: ['browser'],
            capabilities: ['browser', 'prompt-workflow'],
            details: ['Pack: ui-debug'],
            entryIds: ['skill:playwright-interactive', 'mcp:playwright'],
            featured: true,
            searchText: 'collection ui debug browser',
          },
        ],
        listRecipes: () => [
          {
            id: 'recipe:ui-debug-onboarding',
            label: 'UI Debug Onboarding',
            source: 'registry:remote-catalog',
            summary: 'Recipe para browser debugging.',
            actionHint: '/platform recipe:ui-debug-onboarding',
            tags: ['browser'],
            details: ['Pack: ui-debug'],
            steps: ['Adote a collection UI Debug.'],
            targetIds: ['collection:ui-debug', 'mcp:playwright'],
            featured: true,
            searchText: 'recipe ui debug onboarding',
          },
        ],
        readSyncStatus: () => ({
          enabled: true,
          status: 'ready',
          remoteUrl: 'https://registry.example.com/platform.json',
          checkedAt: '2026-04-16T12:00:00.000Z',
          syncedAt: '2026-04-16T12:00:00.000Z',
          stale: false,
          ageMs: 0,
          maxAgeMs: 43200000,
          entryCount: 3,
          collectionCount: 1,
          recipeCount: 1,
          error: null,
          cacheFile: 'C:/tmp/platform-cache.json',
          statusFile: 'C:/tmp/platform-status.json',
          command: 'zavorth platform sync',
          summary: 'Remote registry ready com 3 item(s), 1 collection(s) e 1 recipe(s).',
        }),
      } as any,
      skillLoader: {
        loadAll: () => [
          {
            name: 'zavorthBridge',
            description: 'Skill instalada.',
            dirPath: 'C:/skills/zavorthBridge',
            skillFilePath: 'C:/skills/zavorthBridge/SKILL.md',
            supportFilePaths: [],
          },
        ],
      } as any,
      mcpManifestLoader: {
        load: () => [
          {
            id: 'filesystem',
            command: 'npx',
            args: ['@modelcontextprotocol/server-filesystem'],
            capability: 'filesystem',
            enabled: true,
            env: {},
          },
        ],
      } as any,
    });

    const snapshot = service.buildSnapshot({ selectedId: 'collection:ui-debug' });

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        total: 5,
        plugins: 1,
        skills: 2,
        mcps: 2,
        collections: 1,
        recipes: 1,
      }),
    );
    expect(snapshot.selectedCollection).toEqual(
      expect.objectContaining({
        id: 'collection:ui-debug',
        itemCount: 2,
        actions: expect.arrayContaining([
          expect.objectContaining({ id: 'collection:ui-debug:install', kind: 'install' }),
        ]),
      }),
    );
    expect(snapshot.selectedRecipe).toBeNull();
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plugin:openrouter', discoveryOnly: false }),
        expect.objectContaining({ id: 'skill:playwright-interactive', discoveryOnly: true }),
        expect.objectContaining({ id: 'mcp:playwright', discoveryOnly: true }),
      ]),
    );
  });
});
