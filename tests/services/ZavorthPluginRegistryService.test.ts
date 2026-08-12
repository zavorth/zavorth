import { ZavorthPluginRegistryService } from '../../src/services/ZavorthPluginRegistryService.js';

describe('ZavorthPluginRegistryService', () => {
  it('summarizes integration/plugin entries plus workspace packs', () => {
    const service = new ZavorthPluginRegistryService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      integrationHubService: {
        buildCatalogSnapshot: () => ({
          entries: [
            {
              manifest: {
                id: 'openrouter',
                label: 'OpenRouter',
                summary: 'Gateway remoto',
                description: 'Executa chat e code via gateway remoto.',
                category: 'remote',
                supportLevel: 'native',
                tags: ['gateway', 'remote'],
                capabilities: ['chat', 'code'],
                binding: {
                  summary: 'Provider remoto',
                },
              },
              installed: {
                updatedAt: '2026-04-02T11:00:00.000Z',
              },
              doctor: {
                nextAction: {
                  reason: 'Ja esta pronto para uso.',
                },
              },
              readiness: 'ready',
            },
            {
              manifest: {
                id: 'zerocloud',
                label: 'ZeroCloud',
                summary: 'Template externo',
                description: 'Template para novo conector.',
                category: 'template',
                supportLevel: 'template',
                tags: ['template'],
                capabilities: ['chat'],
                binding: {
                  summary: 'Template manual',
                },
              },
              installed: null,
              doctor: {
                nextAction: {
                  reason: 'Feche o onboarding primeiro.',
                },
              },
              readiness: 'needs_configuration',
            },
          ],
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
            summary: 'Gateway remoto recomendado pelo registry local.',
            actionHint: '/plugins install openrouter',
            tags: ['featured', 'registry'],
            capabilities: ['chat'],
            details: ['Pack: remote-gateways'],
            featured: true,
            searchText: 'openrouter remote gateways',
          },
        ],
      } as any,
      workspaceExtensions: {
        listEntries: () => [
          {
            slug: 'repo',
            workspace: 'C:/repo',
            workspaceName: 'repo',
            instructionFile: 'C:/repo/ZAVORTH.md',
            instructionSummary: 'Workspace com ZAVORTH.md',
            commandCount: 1,
            hookCount: 1,
            commands: [
              {
                label: 'Build local',
                command: 'npm run build',
              },
            ],
            hooks: [
              {
                event: 'before_run',
                description: 'Valida estado antes do run.',
              },
            ],
          },
        ],
      } as any,
      pluginStateService: {
        resolveState: jest.fn((pluginId: string, defaults: any) => ({
          pluginId,
          installed: defaults.installed,
          trust: defaults.trust,
          installedRevision: defaults.installedRevision || null,
          updatedAt: '2026-04-02T12:00:00.000Z',
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        total: 5,
        ready: 4,
        templates: 1,
        workspaceExtensions: 1,
        installed: 4,
        trusted: 4,
        catalogBacked: 1,
        featured: 1,
      }),
    );
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'openrouter',
          kind: 'integration',
          readiness: 'ready',
          registrySource: 'registry:local-catalog',
          featured: true,
          details: expect.arrayContaining(['Pack: remote-gateways']),
          actions: expect.arrayContaining([
            expect.objectContaining({
              command: '/plugins open openrouter',
            }),
            expect.objectContaining({
              command: '/plugins doctor openrouter',
            }),
            expect.objectContaining({
              command: '/plugins update openrouter',
            }),
          ]),
        }),
        expect.objectContaining({
          id: 'zerocloud',
          kind: 'template',
          readiness: 'template',
        }),
        expect.objectContaining({
          id: 'workspace:repo',
          kind: 'workspace-extension',
          readiness: 'workspace',
        }),
        expect.objectContaining({
          id: 'workspace-command:repo',
          kind: 'workspace-command-pack',
          actions: expect.arrayContaining([
            expect.objectContaining({
              command: '/plugins review workspace-command:repo',
            }),
          ]),
        }),
        expect.objectContaining({
          id: 'workspace-hook:repo',
          kind: 'workspace-hook-pack',
        }),
      ]),
    );
    expect(snapshot.selected).toEqual(
      expect.objectContaining({
        id: 'openrouter',
      }),
    );
  });

  it('supports selectedId and query filtering', () => {
    const service = new ZavorthPluginRegistryService({
      integrationHubService: {
        buildCatalogSnapshot: () => ({
          entries: [
            {
              manifest: {
                id: 'openrouter',
                label: 'OpenRouter',
                summary: 'Gateway remoto',
                description: 'Remote gateway',
                category: 'remote',
                supportLevel: 'native',
                tags: ['gateway'],
                capabilities: ['chat'],
                binding: {
                  summary: 'Provider remoto',
                },
              },
              installed: null,
              doctor: {
                nextAction: {
                  reason: 'Configurar.',
                },
              },
              readiness: 'needs_configuration',
            },
          ],
        }),
      } as any,
      workspaceExtensions: {
        listEntries: () => [
          {
            slug: 'repo',
            workspace: 'C:/repo',
            workspaceName: 'Repo Alpha',
            instructionFile: 'C:/repo/ZAVORTH.md',
            instructionSummary: 'Workspace alpha',
            commandCount: 0,
            hookCount: 0,
            commands: [],
            hooks: [],
          },
        ],
      } as any,
      pluginStateService: {
        resolveState: jest.fn((pluginId: string, defaults: any) => ({
          pluginId,
          installed: defaults.installed,
          trust: defaults.trust,
          installedRevision: defaults.installedRevision || null,
          updatedAt: '2026-04-02T12:00:00.000Z',
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot({ query: 'alpha', selectedId: 'workspace:repo' });

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.selected).toEqual(
      expect.objectContaining({
        id: 'workspace:repo',
      }),
    );
  });

  it('builds a shallow status summary without catalog hydration', () => {
    const listCatalogEntries = jest.fn(() => [
      {
        manifest: {
          id: 'openrouter',
          label: 'OpenRouter',
          summary: 'Gateway remoto',
          description: 'Executa chat e code via gateway remoto.',
          category: 'remote',
          supportLevel: 'native',
          tags: ['gateway', 'remote'],
          capabilities: ['chat', 'code'],
          binding: {
            summary: 'Provider remoto',
          },
        },
        installed: {
          updatedAt: '2026-04-02T11:00:00.000Z',
        },
        doctor: {
          nextAction: {
            reason: 'Ja esta pronto para uso.',
          },
        },
        readiness: 'ready',
      },
    ]);
    const buildCatalogSnapshot = jest.fn();
    const buildCatalogStatusSummary = jest.fn(() => ({
      total: 1,
    }));

    const service = new ZavorthPluginRegistryService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      integrationHubService: {
        listCatalogEntries,
        buildCatalogSnapshot,
        buildCatalogStatusSummary,
      } as any,
      workspaceExtensions: {
        listEntries: () => [
          {
            slug: 'repo',
            workspace: 'C:/repo',
            workspaceName: 'repo',
            instructionFile: 'C:/repo/ZAVORTH.md',
            instructionSummary: 'Workspace com ZAVORTH.md',
            commandCount: 1,
            hookCount: 1,
            commands: [{ label: 'Build local', command: 'npm run build' }],
            hooks: [{ event: 'before_run', description: 'Valida estado antes do run.' }],
          },
        ],
      } as any,
      pluginStateService: {
        resolveState: jest.fn((pluginId: string, defaults: any) => ({
          pluginId,
          installed: defaults.installed,
          trust: defaults.trust,
          installedRevision: defaults.installedRevision || null,
          updatedAt: '2026-04-02T12:00:00.000Z',
        })),
      } as any,
    });

    const snapshot = service.buildStatusSummary();

    expect(snapshot.summary.total).toBe(4);
    expect(buildCatalogStatusSummary).toHaveBeenCalled();
    expect(listCatalogEntries).not.toHaveBeenCalled();
    expect(buildCatalogSnapshot).not.toHaveBeenCalled();
  });
});
