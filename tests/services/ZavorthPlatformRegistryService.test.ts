import { ZavorthPlatformRegistryService } from '../../src/services/ZavorthPlatformRegistryService.js';

describe('ZavorthPlatformRegistryService', () => {
  it('merges registry metadata into observed entries and exposes discovery-only skills and MCPs', () => {
    const service = new ZavorthPlatformRegistryService({
      now: () => new Date('2026-04-04T14:00:00.000Z'),
      pluginRegistryService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-04T14:00:00.000Z',
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
          checkedAt: '2026-04-04T14:00:00.000Z',
          syncedAt: '2026-04-04T14:00:00.000Z',
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

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        total: 5,
        plugins: 1,
        skills: 2,
        mcps: 2,
        catalogBacked: 3,
        discoveryOnly: 2,
        featured: 2,
        collections: 1,
        featuredCollections: 1,
        recipes: 1,
        featuredRecipes: 1,
      }),
    );
    expect(snapshot.catalogSync).toEqual(
      expect.objectContaining({
        status: 'ready',
        entryCount: 3,
      }),
    );
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'plugin:openrouter',
          registrySource: 'registry:local-catalog',
          origin: 'trusted-third-party',
          trustState: 'trusted',
          signatureState: 'catalog-verified',
          featured: true,
          discoveryOnly: false,
          details: expect.arrayContaining(['Pack: remote-gateways']),
        }),
        expect.objectContaining({
          id: 'skill:playwright-interactive',
          kind: 'skill',
          origin: 'trusted-third-party',
          reviewState: 'pending',
          discoveryOnly: true,
          readiness: 'planned',
          installState: 'available',
        }),
        expect.objectContaining({
          id: 'mcp:playwright',
          kind: 'mcp',
          origin: 'trusted-third-party',
          signatureState: 'catalog-verified',
          discoveryOnly: true,
          readiness: 'planned',
        }),
      ]),
    );
    expect(snapshot.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'collection:ui-debug',
          itemCount: 2,
          readyCount: 0,
          adoptedCount: 0,
          featured: true,
          actions: expect.arrayContaining([
            expect.objectContaining({ id: 'collection:ui-debug:install', kind: 'install' }),
          ]),
        }),
      ]),
    );
    expect(snapshot.recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'recipe:ui-debug-onboarding',
          itemCount: 2,
          actions: expect.arrayContaining([
            expect.objectContaining({ id: 'recipe:ui-debug-onboarding:install', kind: 'install' }),
          ]),
        }),
      ]),
    );
    expect(snapshot.featuredRecipeIds).toEqual(
      expect.arrayContaining(['recipe:ui-debug-onboarding']),
    );
    expect(snapshot.featuredIds.slice(0, 2)).toEqual(
      expect.arrayContaining(['plugin:openrouter', 'skill:playwright-interactive']),
    );
    expect(snapshot.featuredCollectionIds).toEqual(
      expect.arrayContaining(['collection:ui-debug']),
    );
  });

  it('builds a shallow status summary snapshot without materializing entry lists', () => {
    const buildPluginStatusSummary = jest.fn(() => ({
      generatedAt: '2026-04-04T14:00:00.000Z',
      summary: {
        total: 1,
      },
    }));
    const loadSkills = jest.fn(() => [
      {
        name: 'zavorthBridge',
        description: 'Skill instalada.',
        dirPath: 'C:/skills/zavorthBridge',
        skillFilePath: 'C:/skills/zavorthBridge/SKILL.md',
        supportFilePaths: [],
      },
    ]);

    const service = new ZavorthPlatformRegistryService({
      now: () => new Date('2026-04-04T14:00:00.000Z'),
      pluginRegistryService: {
        buildStatusSummary: buildPluginStatusSummary,
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
          checkedAt: '2026-04-04T14:00:00.000Z',
          syncedAt: '2026-04-04T14:00:00.000Z',
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
        loadAll: loadSkills,
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

    const snapshot = service.buildStatusSummarySnapshot();

    expect(buildPluginStatusSummary).toHaveBeenCalled();
    expect(loadSkills).toHaveBeenCalledWith({ includeSupportFiles: false, quiet: true });
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
    expect(snapshot.catalogSync).toEqual(
      expect.objectContaining({
        status: 'ready',
        entryCount: 3,
      }),
    );
    expect(snapshot.narrative.headline).toContain('fast path da CLI');
    expect(snapshot.narrative.operatorSummary).toContain('2 skill(s)');
    expect((snapshot as any).entries).toBeUndefined();
  });

  it('reflects local lifecycle overrides for observed skills and discovery-only MCPs', () => {
    const getState = jest.fn((entryId: string) => {
      if (entryId === 'skill:zavorthBridge') {
        return {
          pluginId: entryId,
          installed: true,
          trust: 'review',
          installedRevision: 'C:/skills/zavorthBridge/SKILL.md',
          updatedAt: '2026-04-04T15:00:00.000Z',
        };
      }
      if (entryId === 'mcp:playwright') {
        return {
          pluginId: entryId,
          installed: true,
          trust: 'trusted',
          installedRevision: 'registry:local-catalog',
          updatedAt: '2026-04-04T15:00:00.000Z',
        };
      }
      return null;
    });
    const resolveState = jest.fn((entryId: string, defaults: any) => {
      const stored = getState(entryId);
      return stored || {
        pluginId: entryId,
        installed: defaults.installed,
        trust: defaults.trust,
        installedRevision: defaults.installedRevision || null,
        updatedAt: '2026-04-04T15:00:00.000Z',
      };
    });

    const service = new ZavorthPlatformRegistryService({
      now: () => new Date('2026-04-04T15:00:00.000Z'),
      pluginStateService: {
        getState,
        resolveState,
      } as any,
      pluginRegistryService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-04T15:00:00.000Z',
          summary: {
            total: 0,
            ready: 0,
            configurable: 0,
            templates: 0,
            workspaceExtensions: 0,
            trusted: 0,
            installed: 0,
            catalogBacked: 0,
            featured: 0,
          },
          query: null,
          entries: [],
          selected: null,
          featuredIds: [],
          narrative: {
            headline: 'Plugin plane',
            operatorSummary: 'Resumo',
          },
        }),
      } as any,
      catalogSourceService: {
        listEntries: () => [
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
            summary: 'Colecao para browser automation.',
            actionHint: '/platform collection:ui-debug',
            tags: ['browser'],
            capabilities: ['browser'],
            details: ['Pack: ui-debug'],
            entryIds: ['mcp:playwright'],
            featured: false,
            searchText: 'collection ui debug',
          },
        ],
        listRecipes: () => [
          {
            id: 'recipe:ui-debug-onboarding',
            label: 'UI Debug Onboarding',
            source: 'registry:remote-catalog',
            summary: 'Recipe para browser automation.',
            actionHint: '/platform recipe:ui-debug-onboarding',
            tags: ['browser'],
            details: ['Pack: ui-debug'],
            steps: ['Adote a collection UI Debug.'],
            targetIds: ['collection:ui-debug'],
            featured: false,
            searchText: 'recipe ui debug',
          },
        ],
        readSyncStatus: () => ({
          enabled: true,
          status: 'stale',
          remoteUrl: 'https://registry.example.com/platform.json',
          checkedAt: '2026-04-04T14:00:00.000Z',
          syncedAt: '2026-04-04T10:00:00.000Z',
          stale: true,
          ageMs: 18000000,
          maxAgeMs: 43200000,
          entryCount: 1,
          collectionCount: 1,
          recipeCount: 1,
          error: null,
          cacheFile: 'C:/tmp/platform-cache.json',
          statusFile: 'C:/tmp/platform-status.json',
          command: 'zavorth platform sync',
          summary: 'Remote registry sincronizado, mas cache venceu.',
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
        load: () => [],
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'skill:zavorthBridge',
          trust: 'review',
          installState: 'installed',
          actions: expect.arrayContaining([
            expect.objectContaining({ id: 'skill:zavorthBridge:trust', kind: 'trust' }),
            expect.objectContaining({ id: 'skill:zavorthBridge:remove', kind: 'remove' }),
          ]),
        }),
        expect.objectContaining({
          id: 'mcp:playwright',
          discoveryOnly: true,
          trust: 'trusted',
          installState: 'installed',
          readiness: 'partial',
          actions: expect.arrayContaining([
            expect.objectContaining({ id: 'mcp:playwright:review', kind: 'review' }),
            expect.objectContaining({ id: 'mcp:playwright:remove', kind: 'remove' }),
          ]),
        }),
      ]),
    );
    expect(snapshot.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'collection:ui-debug',
          adoptedCount: 1,
          readyCount: 0,
          actions: expect.arrayContaining([
            expect.objectContaining({ id: 'collection:ui-debug:install', kind: 'install' }),
          ]),
          items: expect.arrayContaining([
            expect.objectContaining({
              id: 'mcp:playwright',
              installState: 'installed',
            }),
          ]),
        }),
      ]),
    );
    expect(snapshot.recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'recipe:ui-debug-onboarding',
          adoptedCount: 1,
        }),
      ]),
    );
    expect(snapshot.catalogSync.status).toBe('stale');
  });

  it('surfaces disabled MCP manifest entries as local review candidates instead of discovery-only plans', () => {
    const service = new ZavorthPlatformRegistryService({
      now: () => new Date('2026-04-10T10:00:00.000Z'),
      pluginRegistryService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-10T10:00:00.000Z',
          summary: {
            total: 0,
            ready: 0,
            configurable: 0,
            templates: 0,
            workspaceExtensions: 0,
            trusted: 0,
            installed: 0,
            catalogBacked: 0,
            featured: 0,
          },
          query: null,
          entries: [],
          selected: null,
          featuredIds: [],
          narrative: {
            headline: 'Plugin plane',
            operatorSummary: 'Resumo',
          },
        }),
      } as any,
      catalogSourceService: {
        listEntries: () => [
          {
            id: 'mcp:playwright',
            label: 'playwright',
            kind: 'mcp',
            source: 'registry:local-catalog',
            readiness: 'partial',
            trust: 'review',
            installState: 'available',
            summary: 'MCP de browser automation cadastrado para review local.',
            actionHint: 'Revisar manifesto MCP para playwright',
            tags: ['browser'],
            capabilities: ['browser'],
            details: ['Pack: ui-debug'],
            featured: false,
            searchText: 'mcp playwright',
          },
        ],
        listCollections: () => [],
        listRecipes: () => [],
        readSyncStatus: () => ({
          enabled: false,
          status: 'disabled',
          remoteUrl: null,
          sourceTrusted: false,
          contentSthere is256: null,
          expectedSthere is256: null,
          checkedAt: null,
          syncedAt: null,
          stale: false,
          ageMs: null,
          maxAgeMs: 0,
          entryCount: 1,
          collectionCount: 0,
          recipeCount: 0,
          error: null,
          cacheFile: '',
          statusFile: '',
          command: 'zavorth platform sync',
          summary: 'Remote registry desabilitado.',
        }),
      } as any,
      skillLoader: {
        loadAll: () => [],
      } as any,
      mcpManifestLoader: {
        load: () => [
          {
            id: 'playwright',
            command: 'npx',
            args: ['-y', '@playwright/mcp'],
            capability: 'browser',
            enabled: false,
            env: {},
            allowedEnv: ['PATH'],
          },
        ],
      } as any,
    });

    const snapshot = service.buildSnapshot({ selectedId: 'mcp:playwright' });

    expect(snapshot.selected).toEqual(
      expect.objectContaining({
        id: 'mcp:playwright',
        source: 'mcp-manifest',
        discoveryOnly: false,
        readiness: 'partial',
        trust: 'review',
        trustState: 'review',
        reviewState: 'pending',
        installState: 'installed',
        runtimePermissionProfile: 'mcp-exec',
      }),
    );
    expect(snapshot.selected?.details).toEqual(
      expect.arrayContaining([
        'Enabled: not',
        'Manifesto MCP cadastrado localmente; falta enable execution after review.',
      ]),
    );
  });

  it('surfaces learned candidates inside the platform plane with review-first lifecycle', () => {
    const service = new ZavorthPlatformRegistryService({
      now: () => new Date('2026-04-09T16:00:00.000Z'),
      pluginRegistryService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-09T16:00:00.000Z',
          summary: {
            total: 0,
            ready: 0,
            configurable: 0,
            templates: 0,
            workspaceExtensions: 0,
            trusted: 0,
            installed: 0,
            catalogBacked: 0,
            featured: 0,
          },
          query: null,
          entries: [],
          selected: null,
          featuredIds: [],
          narrative: {
            headline: 'Plugin plane',
            operatorSummary: 'Resumo',
          },
        }),
      } as any,
      skillLoader: {
        loadAll: () => [],
      } as any,
      mcpManifestLoader: {
        load: () => [],
      } as any,
      learningPlaneService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-09T16:00:00.000Z',
          summary: {
            total: 1,
            pending: 1,
            approved: 0,
            rejected: 0,
            promoted: 0,
            published: 0,
            quarantined: 0,
            highConfidence: 1,
          },
          candidates: [
            {
              id: 'candidate:wf-1',
              platformEntryId: 'skill:learned:ship:workspace-a:wf-1',
              title: 'Ship playbook para workspace-a',
              kind: 'playbook',
              summary: 'Playbook aprendido.',
              score: 0.88,
              reviewState: 'pending',
              lifecycle: 'learned_draft',
              createdAt: '2026-04-09T15:00:00.000Z',
              updatedAt: '2026-04-09T15:59:00.000Z',
              lastValidatedAt: '2026-04-09T15:59:00.000Z',
              source: {
                workflowRunId: 'wf-1',
                workflow: 'ship',
                workspace: 'workspace-a',
                objective: 'Publicar o gateway.',
                artifactCount: 1,
                completedStages: 2,
                totalStages: 2,
                originTaskId: 'task-1',
                sourceSurface: 'web',
              },
              steps: ['Inspect runtime', 'Publish release'],
              details: ['Workflow: ship'],
            },
          ],
          narrative: {
            headline: 'Learning ready.',
            operatorSummary: '1 candidato pendente.',
          },
        }),
      } as any,
    });

    const snapshot = service.buildSnapshot({
      selectedId: 'skill:learned:ship:workspace-a:wf-1',
    });

    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'skill:learned:ship:workspace-a:wf-1',
          source: 'learning-plane',
          origin: 'learned-local',
          trust: 'review',
          trustState: 'review',
          reviewState: 'pending',
          signatureState: 'unsigned',
          runtimePermissionProfile: 'learned-review',
          installState: 'available',
          actionHint: '/learning promote candidate:wf-1',
          tags: expect.arrayContaining(['learned-local']),
        }),
      ]),
    );
    expect(snapshot.selected).toEqual(
      expect.objectContaining({
        id: 'skill:learned:ship:workspace-a:wf-1',
        source: 'learning-plane',
        origin: 'learned-local',
      }),
    );
  });
});
