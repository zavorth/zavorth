import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthPlatformActionService } from '../../src/services/ZavorthPlatformActionService.js';
import { ZavorthPlatformRegistryService } from '../../src/services/ZavorthPlatformRegistryService.js';
import { PluginStateService } from '../../src/services/PluginStateService.js';

describe('ZavorthPlatformActionService', () => {
  it('delegates plugin lifecycle actions to the plugin plane', async () => {
    const execute = jest.fn(async () => ({
      generatedAt: '2026-04-04T12:00:10.000Z',
      pluginId: 'openrouter',
      actionId: 'trust',
      status: 'applied',
      ok: true,
      summary: 'OpenRouter marcado como trusted.',
      details: ['Nenhum segredo foi alterado.'],
      selected: null,
      snapshot: {},
    }));
    const buildSnapshot = jest.fn(({ selectedId }: any = {}) => ({
      generatedAt: '2026-04-04T12:00:00.000Z',
      summary: {
        total: 1,
        plugins: 1,
        skills: 0,
        mcps: 0,
        ready: 1,
        partial: 0,
        planned: 0,
        disabled: 0,
        trusted: selectedId ? 1 : 0,
        enabled: 0,
      },
      entries: [
        {
          id: 'plugin:openrouter',
          label: 'OpenRouter',
          kind: 'plugin',
          source: 'integration-hub',
          readiness: 'ready',
          trust: selectedId ? 'trusted' : 'review',
          installState: 'installed',
          summary: 'Gateway remoto pronto.',
          actionHint: '/integrations openrouter',
          tags: ['remote'],
          capabilities: ['chat'],
          details: ['Trust: trusted'],
          searchText: 'plugin openrouter',
          actions: [
            { id: 'plugin:openrouter:trust', label: 'Marcar trusted', kind: 'trust', command: '/plugins trust openrouter' },
          ],
        },
      ],
      selected: {
        id: 'plugin:openrouter',
        label: 'OpenRouter',
        kind: 'plugin',
        source: 'integration-hub',
        readiness: 'ready',
        trust: selectedId ? 'trusted' : 'review',
        installState: 'installed',
        summary: 'Gateway remoto pronto.',
        actionHint: '/integrations openrouter',
        tags: ['remote'],
        capabilities: ['chat'],
        details: ['Trust: trusted'],
        searchText: 'plugin openrouter',
        actions: [
          { id: 'plugin:openrouter:trust', label: 'Marcar trusted', kind: 'trust', command: '/plugins trust openrouter' },
        ],
      },
      featuredIds: ['plugin:openrouter'],
      query: null,
      narrative: {
        headline: 'Platform plane',
        operatorSummary: 'Resumo',
      },
    }));

    const service = new ZavorthPlatformActionService({
      now: () => new Date('2026-04-04T12:00:20.000Z'),
      platformRegistryService: {
        buildSnapshot,
      } as any,
      pluginActionService: {
        execute,
      } as any,
    });

    const result = await service.execute({
      entryId: 'plugin:openrouter',
      actionId: 'trust',
      requestedBy: 'tester',
      workspace: 'C:/repo',
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'openrouter',
        actionId: 'trust',
        requestedBy: 'tester',
        workspace: 'C:/repo',
      }),
    );
    expect(result.status).toBe('applied');
    expect(result.summary).toContain('trusted');
    expect(result.delegated).toEqual(
      expect.objectContaining({
        pluginId: 'openrouter',
        actionId: 'trust',
      }),
    );
    expect(result.selected).toEqual(
      expect.objectContaining({
        id: 'plugin:openrouter',
      }),
    );
  });

  it('returns a manual open result for skills without delegating to the plugin plane', async () => {
    const execute = jest.fn();
    const service = new ZavorthPlatformActionService({
      now: () => new Date('2026-04-04T12:10:00.000Z'),
      platformRegistryService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-04T12:10:00.000Z',
          summary: {
            total: 1,
            plugins: 0,
            skills: 1,
            mcps: 0,
            ready: 1,
            partial: 0,
            planned: 0,
            disabled: 0,
            trusted: 1,
            enabled: 0,
          },
          entries: [],
          selected: {
            id: 'skill:zavorthBridge',
            label: 'zavorthBridge',
            kind: 'skill',
            source: 'skills',
            readiness: 'ready',
            trust: 'trusted',
            installState: 'installed',
            summary: 'Skill instalada.',
            actionHint: 'skill-library/zavorthBridge/SKILL.md',
            tags: ['skill'],
            capabilities: ['prompt-workflow'],
            details: ['Arquivo principal: skill-library/zavorthBridge/SKILL.md'],
            searchText: 'skill Zavorth Bridge',
            actions: [
              {
                id: 'skill:zavorthBridge:open',
                label: 'Abrir arquivo',
                kind: 'open',
                command: 'skill-library/zavorthBridge/SKILL.md',
              },
            ],
          },
          featuredIds: ['skill:zavorthBridge'],
          query: null,
          narrative: {
            headline: 'Platform plane',
            operatorSummary: 'Resumo',
          },
        })),
      } as any,
      pluginActionService: {
        execute,
      } as any,
    });

    const result = await service.execute({
      entryId: 'skill:zavorthBridge',
      actionId: 'open',
    });

    expect(result.status).toBe('manual');
    expect(result.summary).toContain('proximo passo pronto');
    expect(result.details).toEqual(
      expect.arrayContaining([
        'Atalho recomendado: skill-library/zavorthBridge/SKILL.md',
        'Skill instalada.',
      ]),
    );
    expect(result.delegated).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it('registers discovery-only MCP entries in the local platform lifecycle', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-action-mcp-'));
    const stateFile = path.join(root, 'plugin-state.json');
    const now = () => new Date('2026-04-04T12:15:00.000Z');
    try {
      const pluginState = new PluginStateService({ now, stateFile });
      const registry = new ZavorthPlatformRegistryService({
        now,
        pluginStateService: pluginState,
        pluginRegistryService: {
          buildSnapshot: () => ({
            generatedAt: '2026-04-04T12:15:00.000Z',
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
        } as any,
        skillLoader: {
          loadAll: () => [],
        } as any,
        mcpManifestLoader: {
          load: () => [],
        } as any,
      });
      const service = new ZavorthPlatformActionService({
        now,
        platformRegistryService: registry,
        pluginStateService: pluginState,
        pluginActionService: {
          execute: jest.fn(),
        } as any,
      });

      const result = await service.execute({
        entryId: 'mcp:playwright',
        actionId: 'install',
      });

      expect(result.status).toBe('applied');
      expect(result.summary).toContain('registrado no platform plane');
      expect(result.selected).toEqual(
        expect.objectContaining({
          id: 'mcp:playwright',
          installState: 'installed',
          readiness: 'partial',
          trust: 'review',
          actions: expect.arrayContaining([
            expect.objectContaining({ id: 'mcp:playwright:trust', kind: 'trust' }),
            expect.objectContaining({ id: 'mcp:playwright:remove', kind: 'remove' }),
          ]),
        }),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('persists review overrides for observed skills and can clear them afterwards', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-action-skill-'));
    const stateFile = path.join(root, 'plugin-state.json');
    const now = () => new Date('2026-04-04T12:20:00.000Z');
    try {
      const pluginState = new PluginStateService({ now, stateFile });
      const registry = new ZavorthPlatformRegistryService({
        now,
        pluginStateService: pluginState,
        pluginRegistryService: {
          buildSnapshot: () => ({
            generatedAt: '2026-04-04T12:20:00.000Z',
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
          listEntries: () => [],
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
      const service = new ZavorthPlatformActionService({
        now,
        platformRegistryService: registry,
        pluginStateService: pluginState,
        pluginActionService: {
          execute: jest.fn(),
        } as any,
      });

      const reviewResult = await service.execute({
        entryId: 'skill:zavorthBridge',
        actionId: 'review',
      });

      expect(reviewResult.status).toBe('applied');
      expect(reviewResult.selected).toEqual(
        expect.objectContaining({
          id: 'skill:zavorthBridge',
          trust: 'review',
          actions: expect.arrayContaining([
            expect.objectContaining({ id: 'skill:zavorthBridge:trust', kind: 'trust' }),
            expect.objectContaining({ id: 'skill:zavorthBridge:remove', kind: 'remove' }),
          ]),
        }),
      );

      const removeResult = await service.execute({
        entryId: 'skill:zavorthBridge',
        actionId: 'remove',
      });

      expect(removeResult.status).toBe('applied');
      expect(removeResult.selected).toEqual(
        expect.objectContaining({
          id: 'skill:zavorthBridge',
          trust: 'trusted',
          actions: expect.not.arrayContaining([
            expect.objectContaining({ id: 'skill:zavorthBridge:remove' }),
          ]),
        }),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('adopts curated collections through the platform plane with plugin delegation and local lifecycle updates', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-action-collection-'));
    const stateFile = path.join(root, 'plugin-state.json');
    const now = () => new Date('2026-04-04T12:25:00.000Z');
    try {
      const pluginState = new PluginStateService({ now, stateFile });
      const registry = new ZavorthPlatformRegistryService({
        now,
        pluginStateService: pluginState,
        pluginRegistryService: {
          buildSnapshot: () => ({
            generatedAt: '2026-04-04T12:25:00.000Z',
            summary: {
              total: 1,
              ready: 0,
              configurable: 1,
              templates: 0,
              workspaceExtensions: 0,
              trusted: 0,
              installed: 0,
              catalogBacked: 0,
              featured: 1,
            },
            query: null,
            entries: [
              {
                id: 'external_executor',
                kind: 'integration',
                source: 'integration-hub',
                label: 'ExternalExecutor',
                version: 'native',
                readiness: 'configure',
                trust: 'review',
                summary: 'Gateway remoto em onboarding.',
                actionHint: '/integrations external_executor',
                installState: 'available',
                registrySource: 'registry:local-catalog',
                featured: true,
                tags: ['agents'],
                capabilities: ['code'],
                searchText: 'external_executor agents',
                actions: [
                  {
                    id: 'external_executor:install',
                    label: 'Instalar',
                    command: '/plugins install external_executor',
                    kind: 'install',
                  },
                ],
                details: ['Pack: agent-federation'],
              },
            ],
            selected: null,
            featuredIds: ['external_executor'],
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
              details: ['Pack: agent-federation'],
              featured: false,
              searchText: 'mcp playwright',
            },
          ],
          listCollections: () => [
            {
              id: 'collection:agent-federation',
              label: 'Agent Federation',
              source: 'registry:local-catalog',
              summary: 'Colecao para gateways remotos e browser workers.',
              actionHint: '/platform collection:agent-federation',
              tags: ['agents'],
              capabilities: ['code', 'browser'],
              details: ['Pack: agent-federation'],
              entryIds: ['plugin:external-executor', 'mcp:playwright'],
              featured: true,
              searchText: 'collection agent federation',
            },
          ],
        } as any,
        skillLoader: {
          loadAll: () => [],
        } as any,
        mcpManifestLoader: {
          load: () => [],
        } as any,
      });
      const execute = jest.fn(async () => ({
        generatedAt: '2026-04-04T12:25:10.000Z',
        pluginId: 'external_executor',
        actionId: 'install',
        status: 'applied',
        ok: true,
        summary: 'ExternalExecutor registrado no plugin plane.',
        details: ['Binding local pronto para continuar o onboarding.'],
        selected: null,
        snapshot: {},
      }));
      const service = new ZavorthPlatformActionService({
        now,
        platformRegistryService: registry,
        pluginStateService: pluginState,
        pluginActionService: {
          execute,
        } as any,
      });

      const result = await service.execute({
        entryId: 'collection:agent-federation',
        actionId: 'install',
        requestedBy: 'tester',
        workspace: 'C:/repo',
      });

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'external_executor',
          actionId: 'install',
          requestedBy: 'tester',
          workspace: 'C:/repo',
        }),
      );
      expect(result.status).toBe('applied');
      expect(result.summary).toContain('Agent Federation');
      expect(result.selectedCollection).toEqual(
        expect.objectContaining({
          id: 'collection:agent-federation',
          adoptedCount: 1,
        }),
      );
      expect(result.snapshot.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'mcp:playwright',
            installState: 'installed',
            readiness: 'partial',
          }),
        ]),
      );
      expect(result.details).toEqual(
        expect.arrayContaining([
          expect.stringContaining('ExternalExecutor registrado no plugin plane.'),
          expect.stringContaining('playwright registrado no platform plane.'),
        ]),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('applies recipes through the platform plane by combining collection installs and direct lifecycle actions', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-action-recipe-'));
    const stateFile = path.join(root, 'plugin-state.json');
    const now = () => new Date('2026-04-04T12:30:00.000Z');
    try {
      const pluginState = new PluginStateService({ now, stateFile });
      const registry = new ZavorthPlatformRegistryService({
        now,
        pluginStateService: pluginState,
        pluginRegistryService: {
          buildSnapshot: () => ({
            generatedAt: '2026-04-04T12:30:00.000Z',
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
              featured: true,
              searchText: 'collection ui debug',
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
              steps: ['Adote a colecao UI Debug.'],
              targetIds: ['collection:ui-debug'],
              featured: true,
              searchText: 'recipe ui debug onboarding',
            },
          ],
          readSyncStatus: () => ({
            enabled: true,
            status: 'ready',
            remoteUrl: 'https://registry.example.com/platform.json',
            checkedAt: '2026-04-04T12:30:00.000Z',
            syncedAt: '2026-04-04T12:30:00.000Z',
            stale: false,
            ageMs: 0,
            maxAgeMs: 43200000,
            entryCount: 1,
            collectionCount: 1,
            recipeCount: 1,
            error: null,
            cacheFile: 'C:/tmp/platform-cache.json',
            statusFile: 'C:/tmp/platform-status.json',
            command: 'zavorth platform sync',
            summary: 'Registry remoto pronto.',
          }),
        } as any,
        skillLoader: {
          loadAll: () => [],
        } as any,
        mcpManifestLoader: {
          load: () => [],
        } as any,
      });
      const service = new ZavorthPlatformActionService({
        now,
        platformRegistryService: registry,
        pluginStateService: pluginState,
        pluginActionService: {
          execute: jest.fn(),
        } as any,
      });

      const result = await service.execute({
        entryId: 'recipe:ui-debug-onboarding',
        actionId: 'install',
      });

      expect(result.status).toBe('applied');
      expect(result.summary).toContain('UI Debug Onboarding');
      expect(result.selectedRecipe).toEqual(
        expect.objectContaining({
          id: 'recipe:ui-debug-onboarding',
          adoptedCount: 1,
        }),
      );
      expect(result.snapshot.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'mcp:playwright',
            installState: 'installed',
            readiness: 'partial',
          }),
        ]),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('pins remote catalog lifecycle state to the synced sha256 when adopting discovery items', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-action-remote-pin-'));
    const stateFile = path.join(root, 'plugin-state.json');
    const now = () => new Date('2026-04-04T12:35:00.000Z');
    try {
      const pluginState = new PluginStateService({ now, stateFile });
      const registry = new ZavorthPlatformRegistryService({
        now,
        pluginStateService: pluginState,
        pluginRegistryService: {
          buildSnapshot: () => ({
            generatedAt: '2026-04-04T12:35:00.000Z',
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
              id: 'skill:remote-debug',
              label: 'remote-debug',
              kind: 'skill',
              source: 'registry:remote-catalog',
              readiness: 'planned',
              trust: 'review',
              installState: 'available',
              summary: 'Skill remota descoberta via registry.',
              actionHint: 'Abrir catalogo remoto',
              tags: ['remote'],
              capabilities: ['prompt-workflow'],
              details: ['Pack: remote-debug'],
              featured: false,
              searchText: 'remote debug skill',
            },
          ],
          listCollections: () => [],
          listRecipes: () => [],
          readSyncStatus: () => ({
            enabled: true,
            status: 'ready',
            remoteUrl: 'https://registry.example.com/platform.json',
            sourceTrusted: true,
            contentSha256: 'abc123def456',
            expectedSha256: 'abc123def456',
            checkedAt: '2026-04-04T12:35:00.000Z',
            syncedAt: '2026-04-04T12:35:00.000Z',
            stale: false,
            ageMs: 0,
            maxAgeMs: 43200000,
            entryCount: 1,
            collectionCount: 0,
            recipeCount: 0,
            error: null,
            cacheFile: 'C:/tmp/platform-cache.json',
            statusFile: 'C:/tmp/platform-status.json',
            command: 'zavorth platform sync',
            summary: 'Registry remoto pronto.',
          }),
        } as any,
        skillLoader: {
          loadAll: () => [],
        } as any,
        mcpManifestLoader: {
          load: () => [],
        } as any,
      });
      const service = new ZavorthPlatformActionService({
        now,
        platformRegistryService: registry,
        pluginStateService: pluginState,
        pluginActionService: {
          execute: jest.fn(),
        } as any,
      });

      const result = await service.execute({
        entryId: 'skill:remote-debug',
        actionId: 'install',
      });

      expect(result.status).toBe('applied');
      const persisted = pluginState.getState('skill:remote-debug');
      expect(persisted).toEqual(
        expect.objectContaining({
          installedRevision: 'sha256:abc123def456',
          sourceDigest: 'abc123def456',
          sourceLocator: 'registry:remote-catalog',
          sourceTrusted: true,
        }),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('delegates learned entries to the learning plane through platform actions', async () => {
    const executeLearning = jest.fn(({ candidateId, actionId }: any) => ({
      generatedAt: '2026-04-09T16:20:00.000Z',
      candidateId,
      actionId,
      status: 'applied',
      ok: true,
      summary: 'Candidate promovido para trusted local.',
      details: ['Gate explicito aplicado.'],
      snapshot: {
        generatedAt: '2026-04-09T16:20:00.000Z',
        summary: {
          total: 1,
          pending: 0,
          approved: 1,
          rejected: 0,
          promoted: 1,
          published: 0,
          quarantined: 0,
          highConfidence: 1,
        },
        candidates: [],
        narrative: {
          headline: 'Learning atualizado.',
          operatorSummary: '1 promovido.',
        },
      },
    }));
    const service = new ZavorthPlatformActionService({
      now: () => new Date('2026-04-09T16:20:00.000Z'),
      platformRegistryService: {
        buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
          generatedAt: '2026-04-09T16:20:00.000Z',
          summary: {
            total: 1,
            plugins: 0,
            skills: 1,
            mcps: 0,
            ready: selectedId ? 1 : 0,
            partial: selectedId ? 0 : 1,
            planned: 0,
            disabled: 0,
            trusted: selectedId ? 1 : 0,
            enabled: 0,
          },
          entries: [],
          selected: {
            id: 'skill:learned:ship:workspace-a:wf-1',
            label: 'Ship playbook para workspace-a',
            kind: 'skill',
            source: 'learning-plane',
            readiness: selectedId ? 'ready' : 'planned',
            trust: selectedId ? 'trusted' : 'review',
            installState: selectedId ? 'installed' : 'available',
            summary: 'Playbook aprendido.',
            actionHint: '/learning approve candidate:wf-1',
            tags: ['learned-local'],
            capabilities: ['procedural-memory'],
            details: ['Workflow: ship'],
            searchText: 'learned ship workspace-a',
            actions: [
              { id: 'skill:learned:ship:workspace-a:wf-1:install', label: 'Approve', kind: 'install', command: '/learning approve candidate:wf-1' },
              { id: 'skill:learned:ship:workspace-a:wf-1:trust', label: 'Promote', kind: 'trust', command: '/learning promote candidate:wf-1' },
            ],
          },
          selectedCollection: null,
          selectedRecipe: null,
          featuredIds: [],
          query: null,
          narrative: {
            headline: 'Platform plane',
            operatorSummary: 'Resumo',
          },
        })),
      } as any,
      pluginActionService: {
        execute: jest.fn(),
      } as any,
      learningPlaneService: {
        executeAction: executeLearning,
      } as any,
    });

    const result = await service.execute({
      entryId: 'skill:learned:ship:workspace-a:wf-1',
      actionId: 'trust',
    });

    expect(executeLearning).toHaveBeenCalledWith({
      candidateId: 'candidate:wf-1',
      actionId: 'promote',
    });
    expect(result.status).toBe('applied');
    expect(result.learningDelegated).toEqual(
      expect.objectContaining({
        candidateId: 'candidate:wf-1',
        actionId: 'promote',
      }),
    );
    expect(result.selected).toEqual(
      expect.objectContaining({
        id: 'skill:learned:ship:workspace-a:wf-1',
        source: 'learning-plane',
      }),
    );
  });

  it('maps platform review on learned entries to quarantine in the learning plane', async () => {
    const executeLearning = jest.fn(({ candidateId, actionId }: any) => ({
      generatedAt: '2026-04-09T16:25:00.000Z',
      candidateId,
      actionId,
      status: 'applied',
      ok: true,
      summary: 'Candidate foi colocado em quarentena.',
      details: ['Candidato aprendido voltou para quarantine/review.'],
      snapshot: {
        generatedAt: '2026-04-09T16:25:00.000Z',
        summary: {
          total: 1,
          pending: 0,
          approved: 0,
          rejected: 1,
          promoted: 0,
          published: 0,
          quarantined: 1,
          highConfidence: 1,
        },
        candidates: [],
        narrative: {
          headline: 'Learning atualizado.',
          operatorSummary: '1 em quarentena.',
        },
      },
    }));
    const service = new ZavorthPlatformActionService({
      now: () => new Date('2026-04-09T16:25:00.000Z'),
      platformRegistryService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-09T16:25:00.000Z',
          summary: {
            total: 1,
            plugins: 0,
            skills: 1,
            mcps: 0,
            ready: 1,
            partial: 0,
            planned: 0,
            disabled: 0,
            trusted: 1,
            enabled: 1,
          },
          entries: [],
          selected: {
            id: 'skill:learned:ship:workspace-a:wf-1',
            label: 'Ship playbook para workspace-a',
            kind: 'skill',
            source: 'learning-plane',
            readiness: 'ready',
            trust: 'trusted',
            installState: 'enabled',
            summary: 'Playbook aprendido.',
            actionHint: '/learning candidates',
            tags: ['learned-local'],
            capabilities: ['procedural-memory'],
            details: ['Workflow: ship'],
            searchText: 'learned ship workspace-a',
            actions: [
              { id: 'skill:learned:ship:workspace-a:wf-1:review', label: 'Marcar review', kind: 'review', command: '/platform review skill:learned:ship:workspace-a:wf-1' },
            ],
          },
          selectedCollection: null,
          selectedRecipe: null,
          featuredIds: [],
          query: null,
          narrative: {
            headline: 'Platform plane',
            operatorSummary: 'Resumo',
          },
        })),
      } as any,
      pluginActionService: {
        execute: jest.fn(),
      } as any,
      learningPlaneService: {
        executeAction: executeLearning,
      } as any,
    });

    const result = await service.execute({
      entryId: 'skill:learned:ship:workspace-a:wf-1',
      actionId: 'review',
    });

    expect(executeLearning).toHaveBeenCalledWith({
      candidateId: 'candidate:wf-1',
      actionId: 'reject',
    });
    expect(result.actionId).toBe('review');
    expect(result.status).toBe('applied');
    expect(result.learningDelegated).toEqual(
      expect.objectContaining({
        candidateId: 'candidate:wf-1',
        actionId: 'reject',
      }),
    );
  });
});
