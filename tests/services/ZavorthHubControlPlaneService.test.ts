import { ZavorthHubControlPlaneService } from '../../src/services/ZavorthHubControlPlaneService.js';

describe('ZavorthHubControlPlaneService', () => {
  it('consolidates integrations, platform, skills and MCP into one product plane', () => {
    const service = new ZavorthHubControlPlaneService({
      now: () => new Date('2026-04-12T18:00:00.000Z'),
      integrationHubService: {
        buildCatalogSnapshot: jest.fn(() => ({
          entries: [
            { manifest: { id: 'openrouter', label: 'OpenRouter', summary: 'Router multi-provider.' }, readiness: 'configure' },
            { manifest: { id: 'discord', label: 'Discord', summary: 'Canal Discord.' }, readiness: 'ready' },
          ],
          featuredIds: ['openrouter'],
          selected: null,
          providers: {
            ready: [{ id: 'openai' }],
            needsConfiguration: [{ id: 'openrouter' }],
            needsProbe: [],
            recommendations: ['OpenRouter ainda pede configuracao real antes de ficar pronto.'],
          },
          narrative: {
            operatorSummary: 'Hub pronto com um provider pendente.',
          },
        })),
      } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 3,
            installed: 2,
            trusted: 1,
            configurable: 1,
          },
          selected: null,
          narrative: {
            operatorSummary: 'Plugin plane com um item em review.',
          },
          entries: [
            {
              id: 'openrouter',
              label: 'OpenRouter plugin',
              trust: 'review',
              installState: 'installed',
              summary: 'Plugin do roteador.',
              actionHint: '/plugins openrouter',
            },
          ],
        })),
      } as any,
      platformRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 8,
            collections: 2,
            recipes: 3,
            reviewPending: 1,
          },
          catalogSync: {
            status: 'stale',
            summary: 'Registry remoto sincronizado, mas o cache venceu.',
            command: '/platform sync',
            sourceTrusted: true,
            stale: true,
            entryCount: 8,
            collectionCount: 2,
            recipeCount: 3,
          },
          narrative: {
            operatorSummary: 'Platform plane com sync stale.',
          },
        })),
      } as any,
      skillLibraryPresentationService: {
        buildSnapshot: jest.fn(() => ({
          catalog: {
            summary: {
              visible: 5,
              readyRecipes: 2,
              recipes: 4,
              blocked: 0,
              review: 1,
            },
            selected: { id: 'playwright-interactive', name: 'playwright-interactive', description: 'Browser skill.' },
            entries: [{ id: 'playwright-interactive', name: 'playwright-interactive', description: 'Browser skill.' }],
          },
          mcp: {
            summary: {
              resources: 6,
            },
          },
          actions: [
            {
              id: 'skills-library',
              label: 'Abrir biblioteca de skills',
              command: '/skills library',
              rationale: 'A biblioteca ja indica o proximo passo.',
            },
          ],
          narrative: {
            operatorSummary: 'Skill plane com recipes prontas.',
            nextAction: 'Abrir a biblioteca de skills para revisar recipes.',
          },
        })),
      } as any,
      skillInstallPlanPresentationService: {
        buildSnapshot: jest.fn(() => ({
          focus: { id: 'playwright-interactive' },
          narrative: { headline: 'Plano da skill', operatorSummary: 'Plano pronto.' },
        })),
      } as any,
      mcpCapabilityControlPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 3,
            enabled: 2,
            connected: 1,
            failed: 0,
            toolCount: 12,
          },
          entries: [
            { id: 'skills', status: 'connected', summary: 'Skill sidecar ok.' },
            { id: 'browser', status: 'manifest_only', summary: 'Browser MCP pendente.' },
          ],
          recommendations: ['Existe capability MCP pendente no runtime.'],
          narrative: {
            operatorSummary: 'MCP com uma capability pendente.',
          },
        })),
      } as any,
      mcpRuntimeService: {
        readSnapshot: jest.fn(() => ({
          summary: {
            enabled: 2,
            connected: 1,
          },
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot({ query: 'openrouter' });

    expect(snapshot.summary.posture).toBe('attention');
    expect(snapshot.summary.integrations).toBe(2);
    expect(snapshot.summary.plugins).toBe(3);
    expect(snapshot.summary.skillsVisible).toBe(5);
    expect(snapshot.summary.mcpServers).toBe(3);
    expect(snapshot.sync.status).toBe('stale');
    expect(snapshot.surfaces.some((entry) => entry.id === 'mcp')).toBe(true);
    expect(snapshot.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'platform-sync',
        command: '/hub run platform-sync',
      }),
      expect.objectContaining({
        id: 'mcp-browser-doctor',
        command: '/hub run mcp-browser-doctor',
      }),
    ]));
    expect(snapshot.featured).toEqual(expect.arrayContaining([
      expect.objectContaining({
        surface: 'integrations',
        label: 'OpenRouter',
      }),
      expect.objectContaining({
        surface: 'skills',
        label: 'playwright-interactive',
      }),
    ]));
    expect(snapshot.narrative.nextAction).toContain('Sincronizar');
  });

  it('keeps posture healthy when only optional backlog is pending and MCP disabled entries stay out of the incident path', () => {
    const service = new ZavorthHubControlPlaneService({
      now: () => new Date('2026-04-12T19:00:00.000Z'),
      integrationHubService: {
        buildCatalogSnapshot: jest.fn(() => ({
          entries: [
            { manifest: { id: 'openai', label: 'OpenAI', summary: 'Provider principal.' }, readiness: 'ready' },
            { manifest: { id: 'minimax', label: 'MiniMax', summary: 'Provider opcional.' }, readiness: 'configure' },
          ],
          featuredIds: ['openai'],
          selected: null,
          providers: {
            ready: [{ id: 'openai' }],
            needsConfiguration: [{ id: 'minimax' }],
            needsProbe: [],
            recommendations: ['MiniMax ainda pode ser configurado depois sem bloquear o host atual.'],
          },
          narrative: {
            operatorSummary: 'Ha provider pronto e backlog opcional separado.',
          },
        })),
      } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 4,
            installed: 4,
            trusted: 3,
            configurable: 1,
          },
          selected: null,
          narrative: {
            operatorSummary: 'Plugin plane ativo com um item aguardando review opcional.',
          },
          entries: [
            {
              id: 'AIGateway',
              label: 'AIGateway',
              trust: 'review',
              installState: 'installed',
              summary: 'Plugin adicional sob review.',
            },
          ],
        })),
      } as any,
      platformRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 8,
            collections: 2,
            recipes: 3,
            reviewPending: 2,
          },
          catalogSync: {
            status: 'disabled',
            summary: 'Registry remoto bloqueado por policy de origem ou transporte inseguro.',
            command: '/platform sync',
            sourceTrusted: false,
            stale: false,
            entryCount: 8,
            collectionCount: 2,
            recipeCount: 3,
          },
          narrative: {
            operatorSummary: 'Platform plane local pronto sem depender do registry remoto.',
          },
        })),
      } as any,
      skillLibraryPresentationService: {
        buildSnapshot: jest.fn(() => ({
          catalog: {
            summary: {
              visible: 6,
              readyRecipes: 4,
              recipes: 4,
              blocked: 0,
              review: 3,
            },
            selected: { id: 'filesystem', name: 'filesystem', description: 'Skill local.' },
            entries: [{ id: 'filesystem', name: 'filesystem', description: 'Skill local.' }],
          },
          mcp: {
            summary: {
              resources: 4,
            },
          },
          actions: [
            {
              id: 'skills-library',
              label: 'Abrir biblioteca',
              command: '/skills library',
              rationale: 'Biblioteca operacional pronta.',
            },
          ],
          narrative: {
            operatorSummary: 'Skill plane pronto.',
            nextAction: 'Abrir biblioteca.',
          },
        })),
      } as any,
      skillInstallPlanPresentationService: {
        buildSnapshot: jest.fn(() => ({
          focus: { id: 'filesystem' },
          narrative: { headline: 'Plano pronto', operatorSummary: 'Sem bloqueios.' },
        })),
      } as any,
      mcpCapabilityControlPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 3,
            enabled: 1,
            connected: 1,
            failed: 0,
            toolCount: 12,
          },
          entries: [
            { id: 'filesystem', enabled: true, status: 'connected', summary: 'Filesystem MCP ativo.' },
            { id: 'sequential-thinking', enabled: false, status: 'disabled', summary: 'Disabled by policy.' },
            { id: 'stitch', enabled: false, status: 'disabled', summary: 'Disabled by policy.' },
          ],
          recommendations: ['Runtime MCP coerente com o manifesto habilitado.'],
          narrative: {
            operatorSummary: 'Somente o MCP habilitado esta conectado; o resto ficou desligado por policy.',
          },
        })),
      } as any,
      mcpRuntimeService: {
        readSnapshot: jest.fn(() => ({
          summary: {
            enabled: 1,
            connected: 1,
          },
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.posture).toBe('healthy');
    expect(snapshot.summary.mcpEnabled).toBe(1);
    expect(snapshot.surfaces.find((entry) => entry.id === 'integrations')?.posture).toBe('healthy');
    expect(snapshot.surfaces.find((entry) => entry.id === 'plugins')?.posture).toBe('healthy');
    expect(snapshot.surfaces.find((entry) => entry.id === 'platform')?.posture).toBe('healthy');
    expect(snapshot.surfaces.find((entry) => entry.id === 'skills')?.posture).toBe('healthy');
    expect(snapshot.surfaces.find((entry) => entry.id === 'mcp')?.posture).toBe('healthy');
    expect(service.renderReport()).toContain('MCP: 1/1 habilitado(s) | total manifesto: 3');
  });
});
