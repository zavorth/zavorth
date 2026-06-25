import { ZavorthCapabilityCatalogService } from '../../src/services/ZavorthCapabilityCatalogService';

describe('ZavorthCapabilityCatalogService', () => {
  it('builds a unified snapshot with categories, platforms and integrations', () => {
    const service = new ZavorthCapabilityCatalogService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      capabilityRegistry: {
        getAll: () => ([
          {
            id: 'executor-codex',
            label: 'Codex CLI',
            type: 'executor',
            description: 'Executor de codigo.',
            intent: 'code_execution',
            executor_preference: 'codex',
            dispatch_mode: 'execution',
            command: {
              command: '/codex',
              description: 'Executa tarefa local.',
              section: 'execution',
              usage: '<pedido>',
            },
            matchers: [],
            source: 'builtin',
          },
          {
            id: 'route-external-executor-auto',
            label: 'Investigacao ampla',
            type: 'executor',
            description: 'Rota automatica para investigacao.',
            intent: 'code_execution',
            executor_preference: 'external_executor',
            dispatch_mode: 'execution',
            routing_reason: 'Pedido amplo de investigacao de codigo.',
            routing_confidence: 0.82,
            priority: 82,
            matchers: [{ patterns: ['investigue'] }],
            source: 'builtin',
          },
          {
            id: 'plugin-delivery-pack',
            label: 'Delivery Pack',
            type: 'workflow',
            description: 'Plugin de entrega.',
            intent: 'workflow_execution',
            executor_preference: 'workflow:ship',
            dispatch_mode: 'execution',
            command: {
              command: '/shipplus',
              description: 'Entrega ampliada.',
              section: 'execution',
            },
            matchers: [],
            source: 'plugin',
          },
        ] as any),
        getSummary: () => ({
          total: 3,
          builtin: 2,
          plugin: 1,
          commands: 2,
          implicitRoutes: 1,
        }),
      } as any,
      platformCapabilityService: {
        getCapabilities: () => ([
          {
            platform: 'telegram',
            implementationState: 'full',
            readiness: 'ready',
            configured: true,
            transport: 'native',
            envKeys: [],
            notes: [],
          },
          {
            platform: 'discord',
            implementationState: 'partial',
            readiness: 'partial',
            configured: true,
            transport: 'local',
            envKeys: [],
            notes: [],
          },
          {
            platform: 'whatsapp',
            implementationState: 'stub',
            readiness: 'planned',
            configured: false,
            transport: 'stub',
            envKeys: [],
            notes: [],
          },
        ] as any),
      } as any,
      integrationHubService: {
        buildCatalogSnapshot: () => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          mcp: {
            generatedAt: '2026-04-02T12:00:00.000Z',
            manifestPath: 'config/mcp-servers.json',
            summary: {
              total: 2,
              enabled: 1,
              connected: 1,
              failed: 0,
              disabled: 1,
              stopped: 0,
              toolCount: 2,
              capabilityCount: 2,
            },
            capabilities: ['filesystem', 'reasoning'],
            entries: [
              {
                id: 'filesystem',
                capability: 'filesystem',
                enabled: true,
                status: 'connected',
                toolCount: 2,
                toolNames: ['mcp_filesystem_read', 'mcp_filesystem_write'],
                summary: 'filesystem conectada com 2 tools registradas.',
                issue: null,
                lastAttemptedAt: '2026-04-02T12:00:00.000Z',
                lastConnectedAt: '2026-04-02T12:00:00.000Z',
              },
              {
                id: 'sequential-thinking',
                capability: 'reasoning',
                enabled: false,
                status: 'disabled',
                toolCount: 0,
                toolNames: [],
                summary: 'reasoning mantida desabilitada no manifesto.',
                issue: null,
                lastAttemptedAt: null,
                lastConnectedAt: null,
              },
            ],
            recommendations: ['MCP esta coerente com o manifesto e com o runtime atual.'],
            narrative: {
              headline: 'MCP capability control plane',
              operatorSummary: '1/1 capability MCP conectada com 2 tools registradas.',
            },
          },
          providers: {
            generatedAt: '2026-04-02T12:00:00.000Z',
            activeProviderName: 'gemini',
            activeModelName: 'gemini-2.5-flash',
            preferredZavorthBridgeModel: 'zavorth-control-coder',
            recommendedProfile: {
              id: 'coding',
              label: 'Coding',
              providerName: 'openrouter',
              modelName: 'openrouter/sonnet',
              fallbackOrder: ['openrouter', 'gemini'],
            },
            ready: [],
            needsConfiguration: [],
            needsProbe: [],
            profiles: [],
            usageTargets: ['gemini'],
            recommendations: [],
          },
          featuredIds: ['openrouter', 'AIGateway'],
          templateIds: ['zerocloud'],
          selected: null,
          entries: [
            {
              manifest: {
                id: 'openrouter',
                label: 'OpenRouter',
                summary: 'API remota pronta para chat e code.',
                category: 'provider',
              },
              installed: { status: 'connected' },
              doctor: {},
              readiness: 'ready',
            },
            {
              manifest: {
                id: 'AIGateway',
                label: 'AIGateway',
                summary: 'Sidecar local para ponteamento.',
                category: 'sidecar',
              },
              installed: null,
              doctor: {},
              readiness: 'needs_configuration',
            },
            {
              manifest: {
                id: 'zerocloud',
                label: 'ZeroCloud Template',
                summary: 'Template para novo conector.',
                category: 'template',
              },
              installed: null,
              doctor: {},
              readiness: 'planned',
            },
          ],
        }),
      } as any,
      providerDoctorService: {
        inspect: () => ({
          activeProviderName: 'gemini',
          activeModelName: 'gemini-2.5-flash',
          preferredZavorthBridgeModel: 'zavorth-control-coder',
          providers: [
            {
              id: 'gemini',
              label: 'Gemini',
              readiness: 'ready',
              currentModel: 'gemini-2.5-flash',
              mode: 'cloud',
            },
            {
              id: 'openrouter',
              label: 'OpenRouter',
              readiness: 'needs_config',
              currentModel: 'openrouter/sonnet',
              mode: 'cloud',
            },
          ],
          readyProviders: [
            {
              id: 'gemini',
              label: 'Gemini',
              readiness: 'ready',
              currentModel: 'gemini-2.5-flash',
              mode: 'cloud',
            },
          ],
          pendingConfigProviders: [
            {
              id: 'openrouter',
              label: 'OpenRouter',
              readiness: 'needs_config',
              currentModel: 'openrouter/sonnet',
              mode: 'cloud',
            },
          ],
          probeProviders: [],
          profiles: [
            {
              id: 'coding',
              label: 'Coding',
              summary: 'Prioriza coding.',
              preferredOrder: ['openrouter', 'gemini'],
            },
          ],
          recommendedProfile: {
            profile: {
              id: 'coding',
              label: 'Coding',
              summary: 'Prioriza coding.',
              preferredOrder: ['openrouter', 'gemini'],
            },
            strategy: {
              providerName: 'openrouter',
              modelName: 'openrouter/sonnet',
              fallbackOrder: ['openrouter', 'gemini'],
            },
          },
          recommendations: ['Mantenha Gemini como fallback seguro.'],
        }),
      } as any,
      agentOperatingSystemService: {
        buildSnapshot: () => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          kernel: {
            label: 'Limited Agent OS',
            coordinator: 'workflow-backed',
            stateModel: 'spec-plan-tasks-run-state',
            handoffModel: 'handoff.md + workflow ledger',
          },
          summary: {
            roles: 4,
            loops: 2,
            activeLoops: 1,
            resumableLoops: 1,
            sddLoopReady: true,
          },
          roles: [],
          loops: [
            {
              id: 'sdd',
              label: 'SDD Loop Team',
              status: 'resumable',
              entryCommand: '/workflow sdd <feature-id>',
            },
            {
              id: 'ship',
              label: 'Ship Team',
              status: 'active',
              entryCommand: '/workflow ship <objetivo>',
            },
          ],
          narrative: {
            headline: 'Agent OS limitado',
            operatorSummary: '1 loop ativo e 1 com retomada.',
          },
        }),
      } as any,
      capabilityActionSurfaceService: {
        buildSnapshot: () => ({
          surface: 'capability-action-surface',
          status: 'ready',
          summary: { exposed: 1, blocked: 0, receipts: 1, visibleSurfaces: 3 },
          items: [{ actionId: 'capability.candidate.research-pack', title: 'Research pack', status: 'available' }],
        }),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.generatedAt).toBe('2026-04-02T12:00:00.000Z');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        total: 3,
        commands: 2,
        implicitRoutes: 1,
        plugin: 1,
        readyPlatforms: 1,
        readyIntegrations: 1,
        installedIntegrations: 1,
      }),
    );
    expect(snapshot.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'executor',
          total: 2,
          commands: 1,
          implicitRoutes: 1,
        }),
        expect.objectContaining({
          type: 'workflow',
          plugin: 1,
        }),
      ]),
    );
    expect(snapshot.featuredCommands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: '/codex',
        }),
        expect.objectContaining({
          command: '/shipplus',
          source: 'plugin',
        }),
      ]),
    );
    expect(snapshot.featuredImplicitRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'route-external-executor-auto',
          executorPreference: 'external_executor',
        }),
      ]),
    );
    expect(snapshot.platforms.summary).toEqual({
      ready: 1,
      partial: 1,
      planned: 1,
      disabled: 0,
    });
    expect(snapshot.integrations).toEqual(
      expect.objectContaining({
        total: 3,
        ready: 1,
        needsConfiguration: 1,
        templates: 1,
        installed: 1,
        featured: expect.arrayContaining([
          expect.objectContaining({ id: 'openrouter' }),
          expect.objectContaining({ id: 'AIGateway' }),
        ]),
      }),
    );
    expect(snapshot.providers).toEqual(
      expect.objectContaining({
        total: 2,
        ready: 1,
        needsConfiguration: 1,
        activeProviderName: 'gemini',
        recommendedProfile: 'Coding',
        featured: expect.arrayContaining([
          expect.objectContaining({ id: 'gemini' }),
          expect.objectContaining({ id: 'openrouter' }),
        ]),
      }),
    );
    expect(snapshot.mcp).toEqual(
      expect.objectContaining({
        total: 2,
        enabled: 1,
        connected: 1,
        tools: 2,
        capabilities: expect.arrayContaining(['filesystem']),
        featured: expect.arrayContaining([
          expect.objectContaining({ id: 'filesystem', toolCount: 2 }),
        ]),
      }),
    );
    expect(snapshot.agentOs).toEqual(
      expect.objectContaining({
        roles: 4,
        loops: 2,
        activeLoops: 1,
        resumableLoops: 1,
        sddLoopReady: true,
        featuredLoops: expect.arrayContaining([
          expect.objectContaining({ id: 'sdd', status: 'resumable' }),
        ]),
      }),
    );
    expect(snapshot.capabilityActions).toEqual(
      expect.objectContaining({
        surface: 'capability-action-surface',
        summary: expect.objectContaining({ exposed: 1, receipts: 1 }),
      }),
    );
    expect(snapshot.narrative.headline).toContain('3 capacidades');
    expect(snapshot.narrative.operatorSummary).toContain('2 comandos diretos');
    expect(snapshot.narrative.operatorSummary).toContain('1 provider(s) pronto(s)');
    expect(snapshot.narrative.operatorSummary).toContain('1/1 capability(ies) MCP conectada(s)');
    expect(snapshot.narrative.operatorSummary).toContain('1 loop(s) ativos');
  });
});
