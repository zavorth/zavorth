import { ZavorthPluginActionService } from '../../src/services/ZavorthPluginActionService.js';

describe('ZavorthPluginActionService', () => {
  it('marks a plugin as trusted through the persisted plugin plane state', async () => {
    const upsertState = jest.fn();
    const run = jest.fn(async () => ({
      ok: true,
      event: 'plugin.before_action',
      workspace: process.cwd(),
      listenerCount: 0,
      workspaceHookCount: 0,
    }));
    const service = new ZavorthPluginActionService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      pluginRegistryService: {
        buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          summary: {
            total: 1,
            ready: 1,
            configurable: 0,
            templates: 0,
            workspaceExtensions: 0,
            trusted: selectedId ? 1 : 0,
            installed: 1,
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
              trust: selectedId ? 'trusted' : 'review',
              summary: 'Gateway remoto.',
              actionHint: '/integrations openrouter',
              installState: 'installed',
              tags: ['remote'],
              capabilities: ['chat'],
              searchText: 'openrouter',
              actions: [],
              details: [],
            },
          ],
          selected: {
            id: 'openrouter',
            kind: 'integration',
            source: 'integration-hub',
            label: 'OpenRouter',
            version: 'native',
            readiness: 'ready',
            trust: selectedId ? 'trusted' : 'review',
            summary: 'Gateway remoto.',
            actionHint: '/integrations openrouter',
            installState: 'installed',
            tags: ['remote'],
            capabilities: ['chat'],
            searchText: 'openrouter',
            actions: [],
            details: [],
          },
          featuredIds: ['openrouter'],
          narrative: {
            headline: 'Plugin plane',
            operatorSummary: 'Resumo',
          },
        })),
      } as any,
      pluginStateService: {
        upsertState,
        clearState: jest.fn(),
      } as any,
      integrationHubService: {
        buildDraft: jest.fn(),
      } as any,
      integrationInstallerService: {
        removeInstalled: jest.fn(),
      } as any,
      hookPipelineService: {
        run,
      } as any,
    });

    const result = await service.execute({
      pluginId: 'openrouter',
      actionId: 'trust',
      requestedBy: 'tester',
    });

    expect(upsertState).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'openrouter',
        trust: 'trusted',
        installed: true,
      }),
    );
    expect(result.status).toBe('applied');
    expect(result.summary).toContain('trusted');
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'plugin.before_action',
        context: expect.objectContaining({
          pluginId: 'openrouter',
          actionId: 'trust',
        }),
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'plugin.after_action',
        context: expect.objectContaining({
          pluginId: 'openrouter',
          actionId: 'trust',
          status: 'applied',
          ok: true,
        }),
      }),
    );
  });

  it('registers an integration install through the Integration Hub draft flow', async () => {
    const buildDraft = jest.fn(() => ({}));
    const service = new ZavorthPluginActionService({
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          summary: {
            total: 1,
            ready: 0,
            configurable: 1,
            templates: 0,
            workspaceExtensions: 0,
            trusted: 0,
            installed: 0,
          },
          query: null,
          entries: [],
          selected: {
            id: 'external_executor',
            kind: 'integration',
            source: 'integration-hub',
            label: 'ExternalExecutor',
            version: 'recipe',
            readiness: 'configure',
            trust: 'review',
            summary: 'Conector remoto.',
            actionHint: '/connect external_executor',
            installState: 'available',
            tags: ['remote'],
            capabilities: ['code'],
            searchText: 'external_executor',
            actions: [],
            details: [],
          },
          featuredIds: ['external_executor'],
          narrative: {
            headline: 'Plugin plane',
            operatorSummary: 'Resumo',
          },
        })),
      } as any,
      pluginStateService: {
        upsertState: jest.fn(),
        clearState: jest.fn(),
      } as any,
      integrationHubService: {
        buildDraft,
      } as any,
      integrationInstallerService: {
        removeInstalled: jest.fn(),
      } as any,
    });

    const result = await service.execute({
      pluginId: 'external_executor',
      actionId: 'install',
      requestedBy: 'tester',
    });

    expect(buildDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedId: 'external_executor',
        requestedBy: 'tester',
        persist: true,
      }),
    );
    expect(result.status).toBe('applied');
  });

  it('renders a doctor report for a plugin without mutating local plugin state', async () => {
    const upsertState = jest.fn();
    const clearState = jest.fn();
    const run = jest.fn(async ({ event }: any) => ({
      ok: true,
      event,
      workspace: process.cwd(),
      listenerCount: 0,
      workspaceHookCount: 0,
    }));
    const service = new ZavorthPluginActionService({
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          summary: {
            total: 1,
            ready: 1,
            configurable: 0,
            templates: 0,
            workspaceExtensions: 0,
            trusted: 1,
            installed: 1,
          },
          query: null,
          entries: [],
          selected: {
            id: 'openrouter',
            kind: 'integration',
            source: 'integration-hub',
            label: 'OpenRouter',
            version: 'native',
            readiness: 'ready',
            trust: 'trusted',
            summary: 'Gateway remoto.',
            actionHint: '/integrations openrouter',
            installState: 'installed',
            tags: ['remote'],
            capabilities: ['chat'],
            searchText: 'openrouter',
            actions: [],
            details: ['Trust: trusted', 'Next passo: Validar agora'],
          },
          featuredIds: ['openrouter'],
          narrative: {
            headline: 'Plugin plane',
            operatorSummary: 'Resumo',
          },
        })),
      } as any,
      pluginStateService: {
        upsertState,
        clearState,
      } as any,
      integrationHubService: {
        buildDraft: jest.fn(),
      } as any,
      integrationInstallerService: {
        removeInstalled: jest.fn(),
      } as any,
      hookPipelineService: {
        run,
      } as any,
    });

    const result = await service.execute({
      pluginId: 'openrouter',
      actionId: 'doctor',
      requestedBy: 'tester',
    });

    expect(result.status).toBe('manual');
    expect(result.summary).toContain('Doctor de OpenRouter ready.');
    expect(result.details).toEqual(
      expect.arrayContaining([
        'Readiness: ready',
        'Trust: trusted',
        'Install: installed',
        'Next passo: /integrations openrouter',
      ]),
    );
    expect(upsertState).not.toHaveBeenCalled();
    expect(clearState).not.toHaveBeenCalled();
    expect(run).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: 'plugin.before_action',
        context: expect.objectContaining({
          actionId: 'doctor',
        }),
      }),
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'plugin.after_action',
        context: expect.objectContaining({
          actionId: 'doctor',
          status: 'manual',
          ok: true,
        }),
      }),
    );
  });

  it('accepts next as an alias for open and returns the next-step report', async () => {
    const service = new ZavorthPluginActionService({
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          summary: {
            total: 1,
            ready: 1,
            configurable: 0,
            templates: 0,
            workspaceExtensions: 0,
            trusted: 1,
            installed: 1,
          },
          query: null,
          entries: [],
          selected: {
            id: 'openrouter',
            kind: 'integration',
            source: 'integration-hub',
            label: 'OpenRouter',
            version: 'native',
            readiness: 'ready',
            trust: 'trusted',
            summary: 'Gateway remoto.',
            actionHint: '/integrations openrouter',
            installState: 'installed',
            tags: ['remote'],
            capabilities: ['chat'],
            searchText: 'openrouter',
            actions: [],
            details: ['Binding: Provider nactive'],
          },
          featuredIds: ['openrouter'],
          narrative: {
            headline: 'Plugin plane',
            operatorSummary: 'Resumo',
          },
        })),
      } as any,
      pluginStateService: {
        upsertState: jest.fn(),
        clearState: jest.fn(),
      } as any,
      integrationHubService: {
        buildDraft: jest.fn(),
      } as any,
      integrationInstallerService: {
        removeInstalled: jest.fn(),
      } as any,
      hookPipelineService: {
        run: jest.fn(async ({ event }: any) => ({
          ok: true,
          event,
          workspace: process.cwd(),
          listenerCount: 0,
          workspaceHookCount: 0,
        })),
      } as any,
    });

    const result = await service.execute({
      pluginId: 'openrouter',
      actionId: 'next',
      requestedBy: 'tester',
    });

    expect(result.actionId).toBe('open');
    expect(result.status).toBe('manual');
    expect(result.summary).toContain('next step ready');
    expect(result.details).toEqual(
      expect.arrayContaining([
        'Atalho recomendado: /integrations openrouter',
        'Gateway remoto.',
      ]),
    );
  });

  it('returns a blocked result when a plugin before hook vetoes the action', async () => {
    const upsertState = jest.fn();
    const run = jest.fn(async ({ event }: any) => ({
      ok: event !== 'plugin.before_action' ? true : false,
      event,
      workspace: process.cwd(),
      listenerCount: 0,
      workspaceHookCount: event === 'plugin.before_action' ? 1 : 0,
    }));
    const service = new ZavorthPluginActionService({
      pluginRegistryService: {
        buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          summary: {
            total: 1,
            ready: 1,
            configurable: 0,
            templates: 0,
            workspaceExtensions: 0,
            trusted: 0,
            installed: 1,
          },
          query: null,
          entries: [],
          selected: {
            id: 'openrouter',
            kind: 'integration',
            source: 'integration-hub',
            label: 'OpenRouter',
            version: 'native',
            readiness: 'ready',
            trust: 'review',
            summary: 'Gateway remoto.',
            actionHint: '/integrations openrouter',
            installState: 'installed',
            tags: ['remote'],
            capabilities: ['chat'],
            searchText: 'openrouter',
            actions: [],
            details: [],
          },
          featuredIds: ['openrouter'],
          narrative: {
            headline: 'Plugin plane',
            operatorSummary: 'Resumo',
          },
        })),
      } as any,
      pluginStateService: {
        upsertState,
        clearState: jest.fn(),
      } as any,
      integrationHubService: {
        buildDraft: jest.fn(),
      } as any,
      integrationInstallerService: {
        removeInstalled: jest.fn(),
      } as any,
      hookPipelineService: {
        run,
      } as any,
    });

    const result = await service.execute({
      pluginId: 'openrouter',
      actionId: 'trust',
      requestedBy: 'tester',
    });

    expect(result.status).toBe('blocked');
    expect(result.ok).toBe(false);
    expect(upsertState).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
