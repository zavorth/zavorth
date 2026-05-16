import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { ZavorthCli, parseZavorthCliFlags, runZavorthCli } from '../../src/cli/ZavorthCli';
import { config } from '../../src/config/index';
import { ZavorthAgentGateway } from '../../src/runtime/agent';

function createReleasePresenceSnapshot(mode: 'status' | 'diff' | 'rollback-preview' | 'presence' = 'status') {
  return {
    generatedAt: '2026-04-24T17:00:00.000Z',
    phase: '31',
    surface: 'release-presence-control-plane',
    mode,
    status: mode === 'rollback-preview' ? 'ready' : 'degraded',
    release: {
      packageName: 'zavorth',
      version: '1.0.0',
      channel: 'stable',
      latest: {
        id: 'release-b',
        label: 'release-b',
        publishedAt: '2026-04-24T16:30:00.000Z',
        branch: 'main',
        commit: 'bbbbbbbb22222222',
        docsUrl: 'https://docs.example.com',
        remoteConsoleUrl: 'https://console.example.com',
        diffToPrevious: '+1 -0 ~1',
      },
      risk: {
        level: 'medium',
        reasons: ['presenca remota degradada no ambiente de teste'],
      },
      verification: {
        available: true,
        digest: 'sha256:test',
        subject: 'release-b:bbbbbbbb22222222',
        reason: 'Digest local calculado.',
      },
    },
    channels: [
      { id: 'alpha', label: 'Alpha', status: 'candidate', version: '1.0.0', source: 'release:alpha', publishCommand: 'npm run release:alpha' },
      { id: 'beta', label: 'Beta', status: 'candidate', version: '1.0.0', source: 'release:beta', publishCommand: 'npm run release:beta' },
      { id: 'stable', label: 'Stable', status: 'current', version: '1.0.0', source: 'release-b', publishCommand: 'npm run remote:publish' },
    ],
    history: [
      {
        id: 'release-b',
        label: 'release-b',
        publishedAt: '2026-04-24T16:30:00.000Z',
        branch: 'main',
        commit: 'bbbbbbbb22222222',
        docsUrl: 'https://docs.example.com',
        remoteConsoleUrl: 'https://console.example.com',
        diffToPrevious: '+1 -0 ~1',
      },
    ],
    changelog: {
      generatedFrom: 'publish-history+telemetry-ledger',
      entries: ['Ultimo publish: release-b.'],
    },
    diff: {
      requested: { from: 'previous', to: 'latest' },
      available: true,
      report: {
        comparedAt: '2026-04-24T17:00:00.000Z',
        from: { id: 'release-a', label: 'release-a' },
        to: { id: 'release-b', label: 'release-b' },
        commitChanged: true,
        targets: {
          docs: {
            label: 'docs',
            fromPath: 'a/docs',
            toPath: 'b/docs',
            fromFileCount: 1,
            toFileCount: 2,
            added: ['new.html'],
            removed: [],
            changed: ['index.html'],
            unchangedCount: 0,
          },
          remoteConsole: null,
        },
        overall: { added: 1, removed: 0, changed: 1, unchanged: 0 },
        summary: 'release-a -> release-b | +1 -0 ~1',
      },
      summary: 'release-a -> release-b | +1 -0 ~1',
    },
    rollback: {
      targetId: 'release-a',
      targetLabel: 'release-a',
      command: 'node scripts/remote-rollback.mjs --dry-run --id=release-a',
      previewOnly: true,
      confirmationRequired: true,
      executed: false,
      preflight: {
        status: 'pass',
        checks: [
          { id: 'target-resolved', status: 'pass', summary: 'Target resolvido.' },
        ],
      },
      evidence: ['commit=aaaaaaaa11111111'],
      reversalPlan: ['Comparar snapshot.', 'Restaurar somente apos confirmacao.'],
    },
    remotePresence: {
      status: 'degraded',
      transportTotal: 2,
      ready: 1,
      partial: 1,
      dormant: 0,
      pendingWork: 1,
      stateSummary: '1 transporte pronto e 1 parcial.',
      credentials: {
        mode: 'redacted-or-none',
        looseCredentialRequired: false,
        reason: 'Primeira camada nao expoe tokens.',
      },
      entries: [
        { id: 'node-host', label: 'Node host', readiness: 'ready', available: true, summary: 'Node host pronto.' },
      ],
    },
    mirroring: {
      longFlowMirroring: 'authorized-surfaces-only',
      enabled: true,
      authorizedSurfaces: ['cli'],
      reason: 'Somente surfaces autorizadas.',
    },
    costPanel: {
      source: 'telemetry-ledger',
      available: true,
      totalEvents: 2,
      traces: 1,
      failures: 0,
      blocked: 0,
      estimatedAttempts: 2,
      tokenAccounting: {
        available: false,
        totalTokens: 0,
        reason: 'Sem tokens brutos.',
      },
      taskCosts: [
        { taskRef: 'task-1', status: 'completed', attempts: 2, failures: 0, lastEventType: 'task.completed' },
      ],
    },
    contracts: {
      remoteNeverRequiresLooseCredentialFirstLayer: true,
      rollbackHasPreflightAndEvidence: true,
      publishRegistersVersionDiffRiskRollback: true,
      remotePresenceDegradesWhenOffline: true,
      rollbackPreviewDoesNotExecute: true,
      snapshotVerificationWhenApplicable: true,
    },
    commands: {
      status: 'zavorth release status --json',
      diff: 'zavorth release diff previous latest --json',
      rollbackPreview: 'zavorth release rollback --preview --json',
      presence: 'zavorth release presence --json',
    },
    narrative: {
      headline: mode === 'diff'
        ? 'Comparacao de snapshots pronta.'
        : mode === 'rollback-preview'
          ? 'Rollback preview pronto sem executar nada.'
          : mode === 'presence'
            ? 'Remote presence degraded.'
            : 'Release stable em postura degraded.',
      operatorSummary: 'Release Presence stub.',
    },
  };
}

function createGatewayControlCliSnapshot() {
  return {
    ok: true,
    contractVersion: '2026-04-27.p2-006h',
    generatedAt: '2026-04-27T12:00:00.000Z',
    boundary: {
      stableEntry: 'ZavorthGatewayRuntimeService.buildGatewayControlApiSnapshot',
      currentCut: 'P2-006h',
      doNotBypass: ['src/ai-gateway/app/api/* internals', 'provider secrets'],
    },
    health: {
      status: 'ready',
      providerControlPlaneAttached: true,
      AIGateway: {
        enabled: true,
        ready: true,
        running: true,
        pid: 4512,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        checkedAt: '2026-04-27T12:00:00.000Z',
        message: 'Gateway proprio do AIGateway ativo.',
      },
      lastHealthyProvider: 'openai',
      issues: [],
    },
    providers: {
      source: 'provider-control-plane',
      includeAdvanced: false,
      currentProvider: 'openai',
      currentModel: 'gpt-5.2',
      summary: {
        total: 2,
        ready: 1,
        needsConfig: 1,
        needsProbe: 0,
      },
      entries: [
        {
          id: 'openai',
          label: 'OpenAI',
          readiness: 'ready',
          ready: true,
          currentModel: 'gpt-5.2',
          apiKey: '[redacted]',
        },
        {
          id: 'anthropic',
          label: 'Anthropic',
          readiness: 'needs_config',
          ready: false,
          currentModel: 'claude-sonnet',
        },
      ],
    },
    models: {
      source: 'provider-control-plane',
      entries: [
        {
          providerId: 'openai',
          providerLabel: 'OpenAI',
          model: 'gpt-5.2',
          ready: true,
          modality: 'chat',
        },
      ],
    },
    profiles: [],
    combos: {
      status: 'delegated',
      sourceRoutes: ['/api/combos', '/api/combos/test'],
      entries: [
        {
          id: 'default-combo',
          strategy: 'fallback',
          providers: ['openai', 'anthropic'],
        },
      ],
      warnings: [],
    },
    cache: {
      status: 'delegated',
      sourceRoutes: ['/api/cache/stats'],
      semanticStats: {
        entries: 42,
        hitRate: 0.64,
      },
      warnings: ['Cache stats ainda delegado para rota existente.'],
    },
    rateLimits: {
      status: 'delegated',
      sourceRoutes: ['/api/rate-limits'],
      entries: [
        {
          id: 'openai-default',
          providerId: 'openai',
          enabled: true,
          remaining: 120,
          resetAt: '2026-04-27T12:15:00.000Z',
        },
      ],
      warnings: ['Rate limits ainda delegado para rota existente.'],
    },
    operations: [
      {
        id: 'health.read',
        method: 'GET',
        path: '/api/gateway-control/health',
        risk: 'read',
        requiresApproval: false,
        status: 'available',
        source: 'zavorth-runtime',
        summary: 'Le saude do gateway.',
      },
      {
        id: 'cache.stats',
        method: 'GET',
        path: '/api/gateway-control/cache',
        risk: 'read',
        requiresApproval: false,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Le estatisticas de cache.',
      },
      {
        id: 'rate-limits.list',
        method: 'GET',
        path: '/api/gateway-control/rate-limits',
        risk: 'read',
        requiresApproval: false,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Lista rate limits.',
      },
      {
        id: 'combos.list',
        method: 'GET',
        path: '/api/gateway-control/combos',
        risk: 'read',
        requiresApproval: false,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Lista combos.',
      },
      {
        id: 'providers.test',
        method: 'POST',
        path: '/api/gateway-control/providers/test',
        risk: 'sensitive',
        requiresApproval: true,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Teste controlado de provider.',
      },
      {
        id: 'combos.validate',
        method: 'POST',
        path: '/api/gateway-control/combos/validate',
        risk: 'write',
        requiresApproval: true,
        status: 'available',
        source: 'ai-gateway-route',
        summary: 'Teste controlado de combo.',
      },
    ],
    warnings: [],
  };
}

function restoreEnvValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function createStubServices() {
  return {
    gateway: {
      buildSnapshot: jest.fn(() => ({
        summary: {
          channelsReady: 2,
          channelsTotal: 4,
          runtimeModesReady: 3,
          securityPosture: 'zero-trust pronto',
          memoryArtifacts: 2,
          teams: 2,
          sessionTargets: 1,
          toolFamilies: 8,
          plugins: 4,
          nodesPaired: 1,
        },
        narrative: {
          headline: 'Gateway pronto.',
          operatorSummary: 'Snapshot unificado.',
        },
      })),
      buildHydratedSnapshot: jest.fn(async () => ({
        summary: {
          channelsReady: 2,
          channelsTotal: 4,
          runtimeModesReady: 3,
          securityPosture: 'zero-trust pronto',
          memoryArtifacts: 2,
          teams: 2,
          sessionTargets: 1,
          toolFamilies: 8,
          plugins: 4,
          nodesPaired: 1,
        },
        narrative: {
          headline: 'Gateway pronto.',
          operatorSummary: 'Snapshot unificado.',
        },
      })),
      buildDomainSummarySnapshot: jest.fn(() => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        summary: {
          total: 10,
          initialized: 10,
          pending: 0,
        },
        domains: [
          {
            id: 'gateway',
            label: 'Gateway',
            initialized: true,
            initializedAt: '2026-04-04T16:00:00.000Z',
          },
          {
            id: 'sessions',
            label: 'Sessions',
            initialized: true,
            initializedAt: '2026-04-04T16:00:00.000Z',
          },
        ],
      })),
      buildDomainSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        summary: {
          total: 10,
          initialized: 10,
          pending: 0,
        },
        domains: {
          gateway: {
            id: 'gateway',
            label: 'Gateway',
            initialized: true,
            initializedAt: '2026-04-04T16:00:00.000Z',
            summary: 'Gateway consolidado.',
            details: [],
            metrics: {
              channels: 2,
              sessions: 1,
            },
          },
          sessions: {
            id: 'sessions',
            label: 'Sessions',
            initialized: true,
            initializedAt: '2026-04-04T16:00:00.000Z',
            summary: '1 sessao visivel.',
            details: [],
            metrics: {
              sessions: 1,
            },
          },
        },
      })),
    },
    platformRegistry: {
      buildSnapshot: jest.fn(({ selectedId, query }: any = {}) => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        summary: {
          total: 3,
          plugins: 1,
          skills: 1,
          mcps: 1,
          ready: 2,
          partial: 1,
          planned: 0,
          disabled: 0,
          trusted: 2,
          enabled: 1,
          catalogBacked: 2,
          discoveryOnly: 1,
          featured: 1,
          collections: 1,
          featuredCollections: 1,
          recipes: 1,
          featuredRecipes: 1,
        },
        entries: [
          {
            id: 'plugin:openrouter',
            label: 'OpenRouter',
            kind: 'plugin',
            readiness: 'ready',
            trust: 'trusted',
            installState: 'installed',
            summary: 'Gateway remoto pronto.',
            actionHint: '/integrations openrouter',
            details: ['Pack: remote-gateways'],
          },
          {
            id: 'skill:playwright-interactive',
            label: 'playwright-interactive',
            kind: 'skill',
            readiness: 'partial',
            trust: 'review',
            installState: 'installed',
            summary: 'Skill adotada localmente.',
            actionHint: 'Instalar/ativar a skill playwright-interactive',
            details: ['Lifecycle local persistido.'],
          },
          {
            id: 'mcp:filesystem',
            label: 'filesystem',
            kind: 'mcp',
            readiness: 'ready',
            trust: 'trusted',
            installState: 'enabled',
            summary: 'Servidor MCP habilitado.',
            actionHint: 'npx @modelcontextprotocol/server-filesystem',
            details: ['Enabled: sim'],
          },
        ],
        collections: [
          {
            id: 'collection:ui-debug',
            label: 'UI Debug',
            source: 'registry:local-catalog',
            summary: 'Colecao para browser debugging.',
            actionHint: '/platform collection:ui-debug',
            featured: true,
            itemCount: 2,
            readyCount: 1,
            adoptedCount: 2,
            missingCount: 0,
            kinds: ['skill', 'mcp'],
            tags: ['browser'],
            capabilities: ['browser', 'prompt-workflow'],
            details: ['Pack: ui-debug'],
            entryIds: ['skill:playwright-interactive', 'mcp:filesystem'],
            searchText: 'collection ui debug',
            items: [
              {
                id: 'skill:playwright-interactive',
                label: 'playwright-interactive',
                kind: 'skill',
                readiness: 'partial',
                installState: 'installed',
                discoveryOnly: true,
              },
              {
                id: 'mcp:filesystem',
                label: 'filesystem',
                kind: 'mcp',
                readiness: 'ready',
                installState: 'enabled',
                discoveryOnly: false,
              },
            ],
          },
        ],
        recipes: [
          {
            id: 'recipe:ui-debug-onboarding',
            label: 'UI Debug Onboarding',
            summary: 'Recipe para browser debugging.',
            actionHint: '/platform recipe:ui-debug-onboarding',
            itemCount: 1,
            readyCount: 1,
            adoptedCount: 1,
            steps: ['Adote a colecao UI Debug.'],
          },
        ],
        selected: selectedId || query
          ? {
              id: 'skill:playwright-interactive',
              label: 'playwright-interactive',
              kind: 'skill',
              readiness: 'partial',
              trust: 'review',
              installState: 'installed',
              summary: 'Skill adotada localmente.',
              actionHint: 'Instalar/ativar a skill playwright-interactive',
              details: ['Lifecycle local persistido.'],
            }
          : null,
        selectedCollection: selectedId === 'collection:ui-debug' || query === 'collection:ui-debug'
          ? {
              id: 'collection:ui-debug',
              label: 'UI Debug',
              source: 'registry:local-catalog',
              summary: 'Colecao para browser debugging.',
              actionHint: '/platform collection:ui-debug',
              featured: true,
              itemCount: 2,
              readyCount: 1,
              adoptedCount: 2,
              missingCount: 0,
              kinds: ['skill', 'mcp'],
              tags: ['browser'],
              capabilities: ['browser', 'prompt-workflow'],
              details: ['Pack: ui-debug'],
              entryIds: ['skill:playwright-interactive', 'mcp:filesystem'],
              searchText: 'collection ui debug',
              items: [
                {
                  id: 'skill:playwright-interactive',
                  label: 'playwright-interactive',
                  kind: 'skill',
                  readiness: 'partial',
                  installState: 'installed',
                  discoveryOnly: true,
                },
                {
                  id: 'mcp:filesystem',
                  label: 'filesystem',
                  kind: 'mcp',
                  readiness: 'ready',
                  installState: 'enabled',
                  discoveryOnly: false,
                },
              ],
            }
          : null,
        selectedRecipe: selectedId === 'recipe:ui-debug-onboarding' || query === 'recipe:ui-debug-onboarding'
          ? {
              id: 'recipe:ui-debug-onboarding',
              label: 'UI Debug Onboarding',
              summary: 'Recipe para browser debugging.',
              actionHint: '/platform recipe:ui-debug-onboarding',
              itemCount: 1,
              readyCount: 1,
              adoptedCount: 1,
              steps: ['Adote a colecao UI Debug.'],
            }
          : null,
        query: query || null,
        featuredIds: ['plugin:openrouter'],
        featuredCollectionIds: ['collection:ui-debug'],
        featuredRecipeIds: ['recipe:ui-debug-onboarding'],
        catalogSync: {
          summary: 'Registry remoto pronto com 3 item(ns), 1 colecao(oes) e 1 recipe(s).',
        },
        narrative: {
          headline: 'Platform plane unifica plugins, skills e MCPs.',
          operatorSummary: '1 plugin, 1 skill e 1 MCP visiveis.',
        },
      })),
      buildSummarySnapshot: jest.fn(() => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        summary: {
          total: 3,
          plugins: 1,
          skills: 1,
          mcps: 1,
          ready: 2,
          partial: 1,
          planned: 0,
          disabled: 0,
          trusted: 2,
          enabled: 1,
          catalogBacked: 2,
          discoveryOnly: 1,
          featured: 1,
          collections: 1,
          featuredCollections: 1,
          recipes: 1,
          featuredRecipes: 1,
        },
        catalogSync: {
          summary: 'Registry remoto pronto com 3 item(ns), 1 colecao(oes) e 1 recipe(s).',
        },
        narrative: {
          headline: 'Platform plane unifica plugins, skills e MCPs.',
          operatorSummary: '1 plugin, 1 skill e 1 MCP visiveis.',
        },
      })),
      buildStatusSummarySnapshot: jest.fn(() => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        summary: {
          total: 3,
          plugins: 1,
          skills: 1,
          mcps: 1,
          ready: 2,
          partial: 1,
          planned: 0,
          disabled: 0,
          trusted: 2,
          enabled: 1,
          catalogBacked: 2,
          discoveryOnly: 1,
          featured: 1,
          collections: 1,
          featuredCollections: 1,
          recipes: 1,
          featuredRecipes: 1,
        },
        catalogSync: {
          summary: 'Registry remoto pronto com 3 item(ns), 1 colecao(oes) e 1 recipe(s).',
        },
        narrative: {
          headline: 'Platform plane unifica plugins, skills e MCPs.',
          operatorSummary: '1 plugin, 1 skill e 1 MCP visiveis.',
        },
      })),
    },
    platformCatalogSync: {
      sync: jest.fn(async () => ({
        ok: true,
        status: 'ready',
        summary: 'Registry remoto pronto com 3 item(ns), 1 colecao(oes) e 1 recipe(s).',
        entryCount: 3,
        collectionCount: 1,
        recipeCount: 1,
        cacheFile: 'C:/tmp/platform-cache.json',
        error: null,
      })),
    },
    platformAction: {
      execute: jest.fn(async ({ entryId, actionId }: any) => ({
        generatedAt: '2026-04-04T16:10:00.000Z',
        entryId,
        actionId,
        status: 'applied',
        ok: true,
        summary: `Acao ${actionId} aplicada em ${entryId}.`,
        details: ['Lifecycle local persistido.'],
        selected: {
          id: entryId,
          label: entryId,
          kind: 'skill',
        },
        selectedCollection: entryId.startsWith('collection:')
          ? {
              id: entryId,
              label: 'UI Debug',
            }
          : null,
        selectedRecipe: null,
        snapshot: {
          summary: {
            plugins: 1,
            skills: 1,
            mcps: 1,
          },
        },
        delegated: null,
      })),
    },
    platformPublisher: {
      publishDetailed: jest.fn(async () => ({
        ok: true,
        releaseId: '@example/sql-analyzer@1.2.3',
        packageId: '@example/sql-analyzer',
        version: '1.2.3',
        signature: 'sha256:abc123',
        packageSha256: 'abc123',
        fileCount: 2,
        outputFile: 'C:/repo/data/runtime/platform-publish/example.json',
        uploadStatus: 'prepared',
      })),
    },
    capabilityOs: {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-24T12:00:00.000Z',
        phase: '26',
        surface: 'capability-os',
        summary: {
          total: 3,
          builtin: 3,
          plugin: 0,
          commands: 1,
          implicitRoutes: 2,
          byType: {
            executor: 1,
            workflow: 0,
            research: 1,
            automation: 0,
            integration: 1,
          },
          approvalRequired: 2,
          highRisk: 2,
          dormant: 1,
          mcpAllowlisted: 1,
        },
        manifests: [
          {
            id: 'route-codex-auto',
            label: 'Edicao direcionada de codigo',
            type: 'executor',
            source: 'builtin',
            enabled: true,
            intent: 'code_execution',
            dispatchMode: 'execution',
            executorPreference: 'codex',
            command: null,
            aliases: [],
            matcherCount: 1,
            allowedCommandTypes: ['/task'],
            risk: { level: 'high', reason: 'Guardrail inferido.' },
            permissions: {
              requiresApproval: true,
              policySource: 'inferred',
              scopes: ['approval:inferred', 'executor:codex'],
              networkScope: 'local',
              allowedHosts: [],
            },
            artifacts: { kinds: ['patch', 'logs', 'test-report'] },
            lifecycle: null,
            health: { status: 'needs_approval', reason: 'Precisa de aprovacao.' },
            fallback: { chain: ['local_executor', 'conversation'], reason: 'Fallback local.' },
            routing: {
              reason: 'Pedido parece alteracao direcionada de codigo.',
              confidence: 0.82,
              requiresPlanning: false,
              workspaceHint: null,
            },
          },
          {
            id: 'route-web-research',
            label: 'Pesquisa web estruturada',
            type: 'research',
            source: 'builtin',
            enabled: true,
            intent: 'web_research',
            dispatchMode: 'execution',
            executorPreference: 'web_research',
            command: null,
            aliases: [],
            matcherCount: 1,
            allowedCommandTypes: ['/task'],
            risk: { level: 'high', reason: 'Rede externa.' },
            permissions: {
              requiresApproval: true,
              policySource: 'inferred',
              scopes: ['approval:inferred', 'network:external-policy'],
              networkScope: 'external-policy',
              allowedHosts: [],
            },
            artifacts: { kinds: ['briefing', 'sources'] },
            lifecycle: null,
            health: { status: 'needs_approval', reason: 'Precisa de aprovacao.' },
            fallback: { chain: ['research', 'conversation'], reason: 'Fallback research.' },
            routing: {
              reason: 'Pedido tem perfil claro de pesquisa web.',
              confidence: 0.91,
              requiresPlanning: false,
              workspaceHint: 'web',
            },
          },
        ],
        mcpAllowlist: [
          { id: 'command-mcp', label: 'MCP Servers', command: '/mcp', health: 'dormant' },
        ],
        mcpHost: {
          mode: 'local-allowlist',
          folderScope: 'workspace',
          secrets: 'redacted',
          serverAllowlist: ['command-mcp'],
          reason: 'MCP local escopado.',
        },
        fallbackMatrix: {
          codex: ['local_executor', 'conversation'],
          web_research: ['research', 'conversation'],
        },
        examples: [],
        narrative: {
          headline: '3 capabilities registradas; 1 pronta para roteamento.',
          operatorSummary: '1 comando, 2 rotas implicitas, 2 com aprovacao e 1 entrada MCP allowlisted.',
        },
      })),
      explainRoute: jest.fn((input: string) => ({
        phase: '26',
        surface: 'capability-route',
        generatedAt: '2026-04-24T12:01:00.000Z',
        input,
        commandType: '/task',
        selected: {
          id: 'route-web-research',
          label: 'Pesquisa web estruturada',
          type: 'research',
          source: 'builtin',
          enabled: true,
          intent: 'web_research',
          dispatchMode: 'execution',
          executorPreference: 'web_research',
          command: null,
          aliases: [],
          matcherCount: 1,
          allowedCommandTypes: ['/task'],
          risk: { level: 'high', reason: 'Rede externa.' },
          permissions: {
            requiresApproval: true,
            policySource: 'inferred',
            scopes: ['approval:inferred', 'network:external-policy'],
            networkScope: 'external-policy',
            allowedHosts: [],
          },
          artifacts: { kinds: ['briefing', 'sources'] },
          lifecycle: null,
          health: { status: 'needs_approval', reason: 'Precisa de aprovacao.' },
          fallback: { chain: ['research', 'conversation'], reason: 'Fallback research.' },
          routing: {
            reason: 'Pedido tem perfil claro de pesquisa web.',
            confidence: 0.91,
            requiresPlanning: false,
            workspaceHint: 'web',
          },
        },
        fallbackChain: ['research', 'conversation'],
        decision: {
          intent: 'web_research',
          dispatchMode: 'execution',
          executorPreference: 'web_research',
          reason: 'Pedido tem perfil claro de pesquisa web.',
          confidence: 0.91,
          requiresApproval: true,
          riskLevel: 'high',
        },
        ledger: {
          recorded: true,
          entryId: 'capability-route:test',
          status: 'previewed',
          reason: 'Decisao registrada.',
        },
      })),
    },
    taskOperatingSystem: {
      buildSnapshot: jest.fn(async () => ({
        generatedAt: '2026-04-24T13:00:00.000Z',
        phase: '27',
        surface: 'task-os',
        taskLedger: {
          generatedAt: '2026-04-24T13:00:00.000Z',
          phase: '27',
          surface: 'task-ledger',
          summary: {
            total: 1,
            active: 1,
            terminal: 0,
            awaitingPermission: 1,
            awaitingArtifact: 0,
            redeliverableArtifacts: 0,
            retryable: 0,
            resumable: 1,
            byState: {
              queued: 0,
              planning: 0,
              awaiting_permission: 1,
              running: 0,
              awaiting_artifact: 0,
              delivering: 0,
              completed: 0,
              failed: 0,
              cancelled: 0,
              paused: 0,
            },
          },
          tasks: [
            {
              taskId: 'task-phase-27',
              shortId: 'task-pha',
              createdAt: '2026-04-24T12:00:00.000Z',
              updatedAt: '2026-04-24T12:10:00.000Z',
              source: 'web',
              chatId: 'web:session-1',
              userId: 'alice',
              commandType: '/task',
              intent: 'code_execution',
              workspace: 'C:/repo',
              executor: 'codex',
              legacyStatus: 'waiting_approval',
              state: {
                state: 'awaiting_permission',
                legacyStatus: 'waiting_approval',
                phase: 'permission',
                terminal: false,
                active: true,
                resumable: true,
                retryable: false,
                approvalResumesTask: true,
                ambiguous: false,
                allowedActions: ['approve', 'reject', 'resume', 'cancel'],
              },
              approval: {
                required: true,
                status: 'pending',
                pendingPermissionId: 'perm-phase-27',
                resumesTask: true,
              },
              artifacts: {
                total: 0,
                manifest: null,
                kinds: {},
                redeliverable: false,
                command: 'zavorth artifacts task task-phase-27',
              },
              retry: {
                available: false,
                command: 'zavorth tasks retry task-phase-27',
                reason: 'Retry bloqueado ate estado terminal.',
              },
              resume: {
                available: true,
                command: 'zavorth approve task-phase-27',
                reason: 'Aprovacao retoma esta task.',
              },
              relation: {
                conversation: 'web:session-1',
                workspace: 'C:/repo',
                executor: 'codex',
                approvals: ['perm-phase-27'],
                artifacts: [],
              },
              summary: 'Task aguardando permissao.',
            },
          ],
          selected: null,
        },
        permissionLedger: {
          generatedAt: '2026-04-24T13:00:00.000Z',
          phase: '27',
          surface: 'permission-scope-ledger',
          summary: {
            total: 1,
            pending: 1,
            approved: 0,
            rejected: 0,
            expired: 0,
            revokable: 1,
            byScope: {
              once: 0,
              task: 1,
              workspace: 0,
              project: 0,
              timeboxed: 0,
            },
          },
          entries: [
            {
              permissionId: 'perm-phase-27',
              taskId: 'task-phase-27',
              executor: 'codex',
              kind: 'workspace_access',
              status: 'pending',
              legacyScope: 'once',
              scope: 'task',
              workspace: 'C:/repo',
              requestedBy: 'alice',
              decidedBy: null,
              createdAt: '2026-04-24T12:01:00.000Z',
              updatedAt: '2026-04-24T12:02:00.000Z',
              expiresAt: null,
              revokable: true,
              audit: {
                command: 'zavorth permissions revoke perm-phase-27',
                reason: 'Permissao auditavel.',
              },
              resumesTask: {
                taskId: 'task-phase-27',
                command: 'zavorth approve task-phase-27',
                reason: 'Aprovacao retoma a task correta.',
              },
            },
          ],
        },
        summary: {
          tasks: 1,
          active: 1,
          awaitingPermission: 1,
          awaitingArtifact: 0,
          artifacts: 0,
          permissions: 1,
          revokablePermissions: 1,
        },
        contracts: {
          noAmbiguousTaskState: true,
          approvalResumesCorrectTask: true,
          artifactsSurviveRestart: true,
          permissionsRevokableAndAuditable: true,
        },
        commands: {
          listTasks: 'zavorth tasks --json',
          listArtifacts: 'zavorth artifacts task <taskId> --json',
          resume: 'zavorth tasks resume <taskId>',
          retry: 'zavorth tasks retry <taskId>',
        },
        narrative: {
          headline: '1 task no ledger; 1 ativa.',
          operatorSummary: '1 aguardando permissao.',
        },
      })),
      listArtifactsForTask: jest.fn(async (taskId: string) => ({
        generatedAt: '2026-04-24T13:01:00.000Z',
        phase: '27',
        surface: 'task-artifacts',
        task: {
          taskId,
          shortId: taskId.slice(0, 8),
          state: { state: 'completed' },
          summary: 'Task concluida.',
        },
        manifest: {
          total: 1,
          by_kind: { report: 1 },
        },
        artifacts: [
          {
            id: 'artifact-1',
            key: 'artifact://report',
            type: 'file',
            kind: 'report',
            name: 'report.md',
            source: 'codex',
            path: 'C:/repo/report.md',
            url: null,
            mimeType: 'text/markdown',
            summary: 'Relatorio',
            description: null,
            previewText: null,
            sizeBytes: 10,
            exists: true,
            deliveryChannel: 'document',
            createdAt: '2026-04-24T13:01:00.000Z',
          },
        ],
        redelivery: {
          available: true,
          command: `zavorth artifacts task ${taskId}`,
          reason: 'Artefatos persistidos.',
        },
      })),
      buildContinuationPlan: jest.fn(async (taskId: string, action: string) => ({
        generatedAt: '2026-04-24T13:02:00.000Z',
        phase: '27',
        surface: 'task-continuation',
        action,
        task: {
          taskId,
          shortId: taskId.slice(0, 8),
          state: { state: 'awaiting_permission' },
        },
        available: true,
        nextCommand: action === 'resume' ? `zavorth approve ${taskId}` : `zavorth tasks retry ${taskId}`,
        expectedState: action === 'resume' ? 'running' : 'queued',
        reason: 'Plano padronizado.',
        preserves: {
          conversation: true,
          workspace: true,
          executor: true,
          artifacts: true,
          approvals: true,
        },
      })),
    },
    supervisorGraph: {
      buildSnapshot: jest.fn(async () => ({
        generatedAt: '2026-04-24T14:00:00.000Z',
        phase: '28',
        surface: 'supervisor-graph',
        objective: {
          preview: 'corrija um bug e rode os testes',
          digest: 'digest-phase-28',
        },
        mode: 'graph',
        status: 'ready',
        taskBinding: {
          requestedTaskId: null,
          task: null,
          source: 'objective-only',
        },
        route: null,
        complexity: {
          score: 0.78,
          threshold: 0.55,
          reasons: ['tarefa tecnica com possivel mudanca em workspace'],
        },
        budget: {
          maxRetries: 1,
          maxCost: 8,
          estimatedCost: 4.7,
          spentCost: 0,
          remainingCost: 3.3,
          exceeded: false,
          pauseReason: null,
        },
        nodes: [
          {
            id: 'intake',
            label: 'Intake',
            role: 'Normaliza objetivo.',
            status: 'planned',
            mutates: false,
            capability: null,
            requiresApproval: false,
            evidenceRequired: true,
          },
          {
            id: 'planner',
            label: 'Planner',
            role: 'Planeja.',
            status: 'planned',
            mutates: false,
            capability: null,
            requiresApproval: false,
            evidenceRequired: true,
          },
          {
            id: 'coder',
            label: 'Coder',
            role: 'Prepara patch.',
            status: 'planned',
            mutates: true,
            capability: 'codex',
            requiresApproval: true,
            evidenceRequired: true,
          },
          {
            id: 'critic',
            label: 'Critic',
            role: 'Revisa.',
            status: 'planned',
            mutates: false,
            capability: null,
            requiresApproval: false,
            evidenceRequired: true,
          },
          {
            id: 'sandbox_runner',
            label: 'Sandbox runner',
            role: 'Valida testes.',
            status: 'planned',
            mutates: false,
            capability: null,
            requiresApproval: false,
            evidenceRequired: true,
          },
          {
            id: 'delivery',
            label: 'Delivery',
            role: 'Entrega.',
            status: 'planned',
            mutates: false,
            capability: null,
            requiresApproval: false,
            evidenceRequired: true,
          },
        ],
        edges: [
          { from: 'intake', to: 'planner', reason: 'Intake libera planner.', guardrail: 'evidence-required' },
          { from: 'coder', to: 'critic', reason: 'Critica antes de validar.', guardrail: 'evidence-required' },
          { from: 'critic', to: 'sandbox_runner', reason: 'Sandbox valida.', guardrail: 'sandbox-validation' },
          { from: 'sandbox_runner', to: 'delivery', reason: 'Entrega apos testes.', guardrail: 'final-response-contract' },
        ],
        ledger: [
          {
            step: 1,
            from: 'start',
            to: 'intake',
            decision: 'Objetivo normalizado.',
            evidence: {
              kind: 'intake',
              summary: 'Objetivo normalizado.',
              inputDigest: 'digest-phase-28',
              sensitiveData: 'redacted',
            },
          },
        ],
        reflexion: {
          enabled: true,
          maxRetries: 1,
          attemptsUsed: 0,
          correctionLoop: [],
          reason: 'Critico e sandbox revisam antes de delivery.',
        },
        contracts: {
          graphOnlyWhenComplex: true,
          simpleFlowRemainsLinear: true,
          maxRetriesAndCostRequired: true,
          everyTransitionHasEvidence: true,
          supervisorDoesNotMutate: true,
          executorInsideAuthorizedCapability: true,
          criticBeforeDelivery: true,
          sandboxBeforeRiskyDelivery: true,
          sensitiveDataRedacted: true,
        },
        finalResponseContract: {
          includesTests: true,
          includesLimits: true,
          includesPendingItems: true,
          summary: 'Resposta final deve citar testes, limites e pendencias.',
        },
        commands: {
          plan: 'zavorth supervisor plan "corrija um bug" --json',
          simulateFailure: 'zavorth supervisor plan "corrija um bug" --simulate-test-failure --json',
          budgetPreview: 'zavorth supervisor plan "corrija um bug" --max-cost 1 --json',
        },
        narrative: {
          headline: 'DAG supervisionada pronta com 6 nodos ativos.',
          operatorSummary: 'Supervisor registra evidencias e revisa antes de entregar.',
        },
      })),
    },
    AIGatewayGateway: {
      readStatus: jest.fn(() => ({
        enabled: true,
        ready: true,
        running: true,
        pid: 4512,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        checkedAt: '2026-04-04T16:00:00.000Z',
        message: 'Gateway proprio do AIGateway ativo.',
      })),
    },
    gatewayControl: {
      buildGatewayControlApiSnapshot: jest.fn(() => createGatewayControlCliSnapshot()),
    },
    AIGatewayGatewayLauncher: {
      ensureStarted: jest.fn(async () => ({
        enabled: true,
        ready: true,
        running: true,
        pid: 4512,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        checkedAt: '2026-04-04T16:00:30.000Z',
        message: 'Gateway proprio do AIGateway ativo.',
      })),
    },
    AIGatewayCompatibilityDoctor: {
      run: jest.fn(async () => ({
        ok: true,
        status: 'passed',
        checkedAt: '2026-04-04T16:12:00.000Z',
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        summary: 'Gateway proprio do AIGateway respondeu pelo contrato OpenAI-compatible.',
        command: 'AIGateway doctor',
        checkedTarget: 'http://127.0.0.1:21128/v1/models',
        httpStatus: 200,
        error: null,
      })),
      readLastReport: jest.fn(() => ({
        ok: true,
        status: 'passed',
      })),
    },
    AIGatewayUpstreamSync: {
      sync: jest.fn(async () => ({
        ok: true,
        action: 'sync',
        status: 'inspected',
        startedAt: '2026-04-04T16:15:00.000Z',
        finishedAt: '2026-04-04T16:15:01.000Z',
        command: '"node" "vendor-toolkit.mjs" status --target=AIGateway',
        summary: 'Estado do upstream AIGateway sincronizado por inspecao segura.',
        output: 'vendor status ok',
        compat: null,
        rollbackApplied: false,
        statusFile: 'C:/repo/data/runtime/AIGateway-sync.json',
        compatFile: 'C:/repo/data/runtime/AIGateway-compat.json',
        error: null,
      })),
      promote: jest.fn(async ({ autoRollback }: any = {}) => ({
        ok: true,
        action: 'promote',
        status: 'promoted',
        startedAt: '2026-04-04T16:20:00.000Z',
        finishedAt: '2026-04-04T16:20:05.000Z',
        command: '"node" "vendor-toolkit.mjs" update --target=AIGateway',
        summary: `Upstream AIGateway promovido com compatibilidade revalidada.${autoRollback === false ? ' Sem rollback automatico.' : ''}`,
        output: 'vendor update ok',
        compat: {
          status: 'passed',
          summary: 'Gateway proprio do AIGateway respondeu pelo contrato OpenAI-compatible.',
        },
        rollbackApplied: false,
        statusFile: 'C:/repo/data/runtime/AIGateway-sync.json',
        compatFile: 'C:/repo/data/runtime/AIGateway-compat.json',
        error: null,
      })),
      rollback: jest.fn(async () => ({
        ok: true,
        action: 'rollback',
        status: 'rolled_back',
        startedAt: '2026-04-04T16:22:00.000Z',
        finishedAt: '2026-04-04T16:22:04.000Z',
        command: '"node" "vendor-toolkit.mjs" rollback --target=AIGateway',
        summary: 'AIGateway restaurado para o lock anterior e revalidado.',
        output: 'vendor rollback ok',
        compat: {
          status: 'passed',
          summary: 'Gateway proprio do AIGateway respondeu pelo contrato OpenAI-compatible.',
        },
        rollbackApplied: false,
        statusFile: 'C:/repo/data/runtime/AIGateway-sync.json',
        compatFile: 'C:/repo/data/runtime/AIGateway-compat.json',
        error: null,
      })),
      readLastReport: jest.fn(),
    },
    operationsHealth: {
      readSnapshotFast: jest.fn(() => ({
        errors: {
          lastError: null,
        },
      })),
      readSnapshotLive: jest.fn(() => ({
        errors: {
          lastError: null,
        },
      })),
    },
    operationsCockpit: {
      readSnapshotFast: jest.fn(() => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        status: 'attention',
        headline: '2 sinal(is) pedem acompanhamento, mas o host segue operacional.',
        highlights: [
          '1/2 sidecars habilitados estao prontos.',
          'Node Mesh com smoke real vencido.',
        ],
        runtime: {
          uptimeLabel: '2h 5m',
          memoryLabel: '256 MB RSS',
          heapLabel: '96 MB heap',
          platformLabel: 'win32 / x64',
          sampledAt: '2026-04-04T16:00:00.000Z',
        },
        summary: {
          enabledSidecars: 2,
          readySidecars: 1,
          recentErrorCount: 1,
          freeDiskPercent: 62.4,
          publishAgeLabel: '2 h',
        },
        actions: [
          {
            id: 'validate-node-mesh-smoke',
            label: 'Validar Node Mesh',
            command: 'npm run test:nodes:smoke',
            reason: 'Node Mesh com smoke real vencido.',
            priority: 'high',
          },
        ],
        alerts: [],
        operations: {
          generatedAt: '2026-04-04T16:00:00.000Z',
          storage: { freePercent: 62.4 },
          sidecars: {
            AIGateway: { enabled: true, ready: true },
            ZavorthTerminal: { enabled: true, ready: false },
          },
          errors: { recent: [{ message: 'erro' }] },
          nodeMeshSmoke: { status: 'passed', stale: true, available: true },
          publish: { publishedAt: '2026-04-04T14:00:00.000Z' },
          maintenanceAutomation: {
            enabled: true,
            lastTriggerSource: 'priority',
            lastPriorityReason: 'Node Mesh smoke vencido.',
            nextPlannedAt: '2026-04-05T04:30:00.000Z',
            updatedAt: '2026-04-04T16:00:00.000Z',
            updatedBy: 'automation',
            running: false,
            note: null,
            lastActionId: 'validate-node-mesh-smoke',
            lastActionLogFile: 'C:/runtime/actions/node-mesh.log',
            lastReportFinishedAt: '2026-04-04T16:00:00.000Z',
            lastReportStepCount: 1,
            lastTriggeredAt: '2026-04-04T15:59:00.000Z',
          },
        },
      })),
      readSnapshotLive: jest.fn(() => ({
        generatedAt: '2026-04-04T16:30:00.000Z',
        status: 'attention',
        headline: 'Probe ao vivo confirmou 2 sinal(is) relevantes no runtime.',
        highlights: [
          'Live probe do Docker executado.',
          'Node Mesh ainda precisa ser renovado.',
        ],
        runtime: {
          uptimeLabel: '2h 35m',
          memoryLabel: '384 MB RSS',
          heapLabel: '128 MB heap',
          platformLabel: 'win32 / x64',
          sampledAt: '2026-04-04T16:30:00.000Z',
        },
        summary: {
          enabledSidecars: 2,
          readySidecars: 1,
          recentErrorCount: 2,
          freeDiskPercent: 58.2,
          publishAgeLabel: '35 min',
        },
        actions: [
          {
            id: 'validate-node-mesh-smoke',
            label: 'Validar Node Mesh',
            command: 'npm run test:nodes:smoke',
            reason: 'Node Mesh ainda precisa de revalidacao ao vivo.',
            priority: 'high',
          },
        ],
        alerts: [
          {
            level: 'warn',
            source: 'docker',
            title: 'Docker validado ao vivo',
            detail: 'Probe ao vivo executado para runtime de sandbox.',
            timestamp: '2026-04-04T16:30:00.000Z',
          },
        ],
        operations: {
          generatedAt: '2026-04-04T16:30:00.000Z',
          storage: { freePercent: 58.2 },
          sidecars: {
            AIGateway: { enabled: true, ready: true },
            ZavorthTerminal: { enabled: true, ready: false },
          },
          errors: { recent: [{ message: 'erro-live' }] },
          nodeMeshSmoke: { status: 'passed', stale: true, available: true },
          publish: { publishedAt: '2026-04-04T15:55:00.000Z' },
          maintenanceAutomation: {
            enabled: true,
            lastTriggerSource: 'priority',
            lastPriorityReason: 'Node Mesh smoke vencido.',
            nextPlannedAt: '2026-04-05T04:30:00.000Z',
            updatedAt: '2026-04-04T16:30:00.000Z',
            updatedBy: 'automation',
            running: false,
            note: null,
            lastActionId: 'validate-node-mesh-smoke',
            lastActionLogFile: 'C:/runtime/actions/node-mesh.log',
            lastReportFinishedAt: '2026-04-04T16:30:00.000Z',
            lastReportStepCount: 1,
            lastTriggeredAt: '2026-04-04T16:29:00.000Z',
          },
        },
      })),
      readSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        status: 'attention',
        headline: '2 sinal(is) pedem acompanhamento, mas o host segue operacional.',
        highlights: [
          '1/2 sidecars habilitados estao prontos.',
          'Node Mesh com smoke real vencido.',
        ],
        runtime: {
          uptimeLabel: '2h 5m',
          memoryLabel: '256 MB RSS',
          heapLabel: '64 MB heap',
          platformLabel: 'win32 / x64',
          sampledAt: '2026-04-04T15:58:00.000Z',
        },
        summary: {
          enabledSidecars: 2,
          readySidecars: 1,
          recentErrorCount: 1,
          freeDiskPercent: 42,
          publishAgeLabel: 'ha 2 h',
        },
        actions: [
          {
            id: 'validate-node-mesh-smoke',
            label: 'Validar Node Mesh',
            command: 'npm run test:nodes:smoke',
            reason: 'Smoke vencido.',
            priority: 'high',
          },
        ],
        alerts: [
          {
            level: 'warn',
            source: 'node-mesh-smoke',
            title: 'Node Mesh smoke desatualizado',
            detail: 'Renove a validacao.',
            timestamp: '2026-04-04T15:00:00.000Z',
          },
        ],
        operations: {
          generatedAt: '2026-04-04T16:00:00.000Z',
        },
      })),
    },
    operationsHealth: {
      readSnapshotFast: jest.fn(() => ({
        errors: {
          lastError: null,
        },
      })),
      readSnapshotLive: jest.fn(() => ({
        errors: {
          lastError: null,
        },
      })),
    },
    operationsAction: {
      listDefinitions: jest.fn(() => ([
        {
          id: 'validate-node-mesh-smoke',
          label: 'Validar Node Mesh',
          command: 'npm.cmd',
          args: ['run', 'test:nodes:smoke'],
          priority: 'high',
        },
        {
          id: 'maintenance',
          label: 'Rodar manutencao operacional',
          command: 'npm.cmd',
          args: ['run', 'ops:maintain'],
          priority: 'normal',
        },
      ])),
      execute: jest.fn((actionId: string) => ({
        id: actionId,
        label: actionId === 'validate-node-mesh-smoke' ? 'Validar Node Mesh' : 'Acao',
        command: `npm.cmd run ${actionId === 'validate-node-mesh-smoke' ? 'test:nodes:smoke' : 'ops:maintain'}`,
        priority: actionId === 'validate-node-mesh-smoke' ? 'high' : 'normal',
        startedAt: '2026-04-04T16:05:00.000Z',
        pid: 5512,
        logFile: 'C:/tmp/ops-action.log',
        status: 'started',
        note: 'Acao iniciada em background.',
      })),
    },
    supervisedRuntime: {
      inspect: jest.fn(() => ({
        projectRoot: 'C:/repo',
        gitAvailable: true,
        branch: 'main',
        modifiedFiles: [],
        stagedFiles: [],
        untrackedFiles: [],
        recentCommits: [],
        installRequired: false,
        buildRequired: false,
        hostSupervisor: { active: true, pid: 1, owner: 'test', startedAt: null, alive: true },
        telegramWorker: { active: true, pid: 2, owner: 'test', startedAt: null, alive: true },
        accessReadiness: {
          local: { ready: true },
          remote: { ready: false },
        },
        lastReloadReport: null,
      })),
      summarizeRecentChanges: jest.fn(() => 'Mudancas e estado do Zavorth'),
      requestReload: jest.fn(async () => ({
        accepted: true,
        summary: 'Reload aceito.',
        requestId: 'reload-123',
      })),
    },
    runtimeAccessReadiness: {
      inspect: jest.fn(() => ({
        checkedAt: '2026-04-04T16:15:00.000Z',
        runtime: {
          nodeMeshSmoke: {
            available: true,
            status: 'passed',
            checkedAt: '2026-04-04T16:10:00.000Z',
            summary: 'Smoke real do Node Mesh passou.',
            command: 'npm run test:nodes:smoke',
            file: 'C:/repo/data/runtime/node-mesh-smoke-last.json',
            nodeId: 'node-alpha',
            finalNodeStatus: 'online',
            recentCapabilityId: 'files.watch',
            error: null,
            stale: false,
            ageMs: 300000,
            maxAgeMs: 3600000,
          },
          channelProviderDoctor: {
            available: true,
            status: 'passed',
            checkedAt: '2026-04-04T16:11:00.000Z',
            summary: 'Doctor dos canais nativos validou Slack native e WhatsApp Cloud API.',
            command: 'npm run test:channels:smoke',
            file: 'C:/repo/data/runtime/channel-provider-doctor-last.json',
            stale: false,
            ageMs: 240000,
            maxAgeMs: 3600000,
            items: [
              {
                channelId: 'slack',
                mode: 'native',
                status: 'passed',
                configured: true,
                summary: 'Slack native validado.',
                error: null,
              },
              {
                channelId: 'whatsapp',
                mode: 'cloud-api',
                status: 'passed',
                configured: true,
                summary: 'WhatsApp Cloud API validada.',
                error: null,
              },
            ],
          },
          remoteTransportDoctor: {
            available: true,
            status: 'passed',
            checkedAt: '2026-04-04T16:12:00.000Z',
            summary: 'Transportes remotos validaram AIGateway e ZavorthBridge.',
            command: 'npm run test:transports:smoke',
            file: 'C:/repo/data/runtime/remote-transport-doctor-last.json',
            stale: false,
            ageMs: 180000,
            maxAgeMs: 3600000,
            recommendedAction: null,
            items: [
              {
                transportId: 'AIGateway',
                mode: 'local',
                status: 'passed',
                configured: true,
                summary: 'Gateway do AIGateway respondeu localmente.',
                error: null,
              },
              {
                transportId: 'omni-zavorth-bridge-remote',
                mode: 'remote',
                status: 'passed',
                configured: true,
                summary: 'ZavorthBridge remoto pronto para uso publico.',
                error: null,
              },
            ],
          },
        },
        local: {
          baseUrl: 'http://127.0.0.1:33333',
          dashboardUrl: 'http://127.0.0.1:33333/',
          appUrl: 'http://127.0.0.1:33333/app',
          ready: true,
          issues: [],
        },
        remote: {
          baseUrl: 'https://zavorth.example.com',
          appUrl: 'https://zavorth.example.com/app',
          ready: false,
          issues: ['Falta token'],
        },
        recommendations: ['Validar rollout remoto.'],
        nextSteps: [
          {
            id: 'validate-node-mesh-smoke',
            title: 'Revalidar Node Mesh',
            description: 'Rode o smoke real do Node Mesh.',
            blocking: false,
          },
        ],
        summary: 'Zavorth pronto para uso local.',
      })),
      inspectLive: jest.fn(async () => ({
        checkedAt: '2026-04-04T16:18:00.000Z',
        runtime: {
          nodeMeshSmoke: {
            available: true,
            status: 'passed',
            checkedAt: '2026-04-04T16:17:00.000Z',
            summary: 'Live probe confirmou o smoke real do Node Mesh.',
            command: 'npm run test:nodes:smoke',
            file: 'C:/repo/data/runtime/node-mesh-smoke-last.json',
            nodeId: 'node-alpha',
            finalNodeStatus: 'online',
            recentCapabilityId: 'browser.proxy',
            error: null,
            stale: false,
            ageMs: 60000,
            maxAgeMs: 3600000,
          },
          channelProviderDoctor: {
            available: true,
            status: 'passed',
            checkedAt: '2026-04-04T16:17:30.000Z',
            summary: 'Live probe confirmou canais nativos.',
            command: 'npm run test:channels:smoke',
            file: 'C:/repo/data/runtime/channel-provider-doctor-last.json',
            stale: false,
            ageMs: 30000,
            maxAgeMs: 3600000,
            items: [
              {
                channelId: 'slack',
                mode: 'native',
                status: 'passed',
                configured: true,
                summary: 'Slack native validado.',
                error: null,
              },
            ],
          },
          remoteTransportDoctor: {
            available: true,
            status: 'passed',
            checkedAt: '2026-04-04T16:17:40.000Z',
            summary: 'Live probe confirmou transportes remotos.',
            command: 'npm run test:transports:smoke',
            file: 'C:/repo/data/runtime/remote-transport-doctor-last.json',
            stale: false,
            ageMs: 20000,
            maxAgeMs: 3600000,
            recommendedAction: null,
            items: [
              {
                transportId: 'AIGateway',
                mode: 'local',
                status: 'passed',
                configured: true,
                summary: 'AIGateway respondeu.',
                error: null,
              },
            ],
          },
        },
        local: {
          baseUrl: 'http://127.0.0.1:33333',
          dashboardUrl: 'http://127.0.0.1:33333/',
          appUrl: 'http://127.0.0.1:33333/app',
          ready: true,
          issues: [],
        },
        remote: {
          baseUrl: 'https://zavorth.example.com',
          appUrl: 'https://zavorth.example.com/app',
          ready: true,
          issues: [],
        },
        recommendations: ['Live probe confirmou tudo pronto.'],
        nextSteps: [],
        summary: 'Live probe confirmou Zavorth pronto para uso local e remoto.',
      })),
    },
    runtimeBootstrap: {
      inspect: jest.fn(() => ({
        checkedAt: '2026-04-04T16:20:00.000Z',
        projectRoot: 'C:/repo',
        env: {
          envFilePresent: true,
          llmProvider: 'gemini',
          llmCredentialReady: true,
          issues: [],
        },
        dependencies: {
          installRequired: false,
          buildRequired: false,
        },
        platforms: [],
        supervisedRuntime: {
          accessReadiness: {
            local: { ready: true },
          },
        },
        actions: [
          {
            id: 'start-supervised-runtime',
            title: 'Subir o Zavorth supervisionado',
            command: 'npm run dev:supervised',
            reason: 'Runtime local.',
            blocking: true,
          },
        ],
        summary: 'Bootstrap basico fechado: Zavorth pronto para uso local.',
      })),
    },
    runtimeBootstrapRepair: {
      repair: jest.fn(({ dryRun }: any = {}) => ({
        startedAt: '2026-04-04T16:25:00.000Z',
        finishedAt: '2026-04-04T16:25:01.000Z',
        dryRun: dryRun === true,
        initial: { summary: 'Inicial' },
        steps: [
          {
            actionId: 'build-runtime',
            title: 'Gerar build do runtime',
            command: 'npm run build',
            status: dryRun === true ? 'skipped' : 'executed',
            startedAt: '2026-04-04T16:25:00.000Z',
            finishedAt: '2026-04-04T16:25:01.000Z',
            durationMs: 1000,
          },
        ],
        final: { summary: 'Final' },
        summary: dryRun === true
          ? 'Plano de correcao gerado com 1 acao(oes) segura(s).'
          : 'Correcoes seguras aplicadas.',
      })),
    },
    autoRepair: {
      readLastReport: jest.fn(() => ({
        status: 'reloaded',
      })),
      summarizeLastRun: jest.fn(() => 'Autoreparo do Zavorth'),
      run: jest.fn(async ({ dryRun, force, goal }: any) => ({
        success: true,
        status: dryRun === true ? 'dry_run' : 'reloaded',
        summary: `Autorepair ${goal || 'auto'}${force ? ' force' : ''}`,
        report: {
          dryRun: dryRun === true,
        },
      })),
    },
    operatorBrief: {
      readSnapshotFast: jest.fn(() => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        posture: 'watch',
        headline: 'Zavorth operavel, mas com alguns pontos pedindo acompanhamento.',
        highlights: ['Node Mesh com smoke real vencido.'],
        maintenanceAutomation: {
          enabled: true,
          lastTriggerSource: 'priority',
          lastPriorityReason: 'Prioridade operacional: renovar o Node Mesh smoke falho.',
          nextPlannedAt: '2026-04-05T04:30:00.000Z',
          label: 'Automacao prioritaria',
          summary: 'Automacao antecipada para renovar o Node Mesh smoke.',
        },
        channelProviderDoctor: {
          status: 'passed',
          stale: false,
          checkedAt: '2026-04-04T15:50:00.000Z',
          label: 'Doctor validado',
          summary: 'Doctor dos canais nativos validou Slack native.',
          command: 'npm run test:channels:smoke',
        },
        nextAction: {
          label: 'Validar Node Mesh',
          command: 'npm run test:nodes:smoke',
          reason: 'Renovar o smoke do Node Mesh.',
          actionId: 'validate-node-mesh-smoke',
          manualOnly: false,
        },
        zavorthBridge: {
          available: true,
          latestIncident: null,
          latestSeverity: null,
          flappingLikely: false,
          repairedRuns: 1,
          totalRuns: 3,
        },
        text: 'Briefing do operador\n\nHeadline: Zavorth operavel, mas com alguns pontos pedindo acompanhamento.',
      })),
      readSnapshotLive: jest.fn(() => ({
        generatedAt: '2026-04-04T16:30:00.000Z',
        posture: 'action-needed',
        headline: 'Probe ao vivo confirmou que o runtime segue operavel, mas requer acao imediata.',
        highlights: ['Live probe renovou Docker e confirmou Node Mesh vencido.'],
        maintenanceAutomation: {
          enabled: true,
          lastTriggerSource: 'priority',
          lastPriorityReason: 'Prioridade operacional: renovar o Node Mesh smoke falho.',
          nextPlannedAt: '2026-04-05T04:30:00.000Z',
          label: 'Automacao prioritaria',
          summary: 'Automacao antecipada para renovar o Node Mesh smoke.',
        },
        channelProviderDoctor: {
          status: 'passed',
          stale: false,
          checkedAt: '2026-04-04T16:10:00.000Z',
          label: 'Doctor validado',
          summary: 'Doctor dos canais nativos validou Slack native.',
          command: 'npm run test:channels:smoke',
        },
        nextAction: {
          label: 'Validar Node Mesh agora',
          command: 'npm run test:nodes:smoke',
          reason: 'Live probe confirmou a necessidade de revalidacao.',
          actionId: 'validate-node-mesh-smoke',
          manualOnly: false,
        },
        zavorthBridge: {
          available: true,
          latestIncident: null,
          latestSeverity: null,
          flappingLikely: false,
          repairedRuns: 1,
          totalRuns: 3,
        },
        text: 'Briefing do operador\n\nHeadline: Probe ao vivo confirmou que o runtime segue operavel, mas requer acao imediata.',
      })),
      readSnapshotFromCockpit: jest.fn(() => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        posture: 'watch',
        headline: 'Zavorth operavel, mas com alguns pontos pedindo acompanhamento.',
        highlights: ['Node Mesh com smoke real vencido.'],
        maintenanceAutomation: {
          enabled: true,
          lastTriggerSource: 'priority',
          lastPriorityReason: 'Prioridade operacional: renovar o Node Mesh smoke falho.',
          nextPlannedAt: '2026-04-05T04:30:00.000Z',
          label: 'Automacao prioritaria',
          summary: 'Automacao antecipada para renovar o Node Mesh smoke.',
        },
        channelProviderDoctor: {
          status: 'passed',
          stale: false,
          checkedAt: '2026-04-04T15:50:00.000Z',
          label: 'Doctor validado',
          summary: 'Doctor dos canais nativos validou Slack native.',
          command: 'npm run test:channels:smoke',
        },
        nextAction: {
          label: 'Validar Node Mesh',
          command: 'npm run test:nodes:smoke',
          reason: 'Renovar o smoke do Node Mesh.',
          actionId: 'validate-node-mesh-smoke',
          manualOnly: false,
        },
        zavorthBridge: {
          available: true,
          latestIncident: null,
          latestSeverity: null,
          flappingLikely: false,
          repairedRuns: 1,
          totalRuns: 3,
        },
        text: 'Briefing do operador\n\nHeadline: Zavorth operavel, mas com alguns pontos pedindo acompanhamento.',
      })),
      readSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        posture: 'watch',
        headline: 'Zavorth operavel, mas com alguns pontos pedindo acompanhamento.',
        highlights: ['Node Mesh com smoke real vencido.'],
        maintenanceAutomation: {
          enabled: true,
          lastTriggerSource: 'priority',
          lastPriorityReason: 'Node Mesh smoke stale',
          nextPlannedAt: '2026-04-04T18:00:00.000Z',
          label: 'Automacao prioritaria',
          summary: 'Automacao recorrente ativa; proxima janela em 2 h.',
        },
        channelProviderDoctor: {
          status: 'passed',
          stale: false,
          checkedAt: '2026-04-04T15:50:00.000Z',
          label: 'Doctor validado',
          summary: 'Doctor dos canais nativos validou Slack native.',
          command: 'npm run test:channels:smoke',
        },
        nextAction: {
          label: 'Validar Node Mesh',
          command: 'npm run test:nodes:smoke',
          reason: 'Smoke vencido.',
          actionId: 'validate-node-mesh-smoke',
          manualOnly: false,
        },
        zavorthBridge: {
          available: true,
          latestIncident: 'window-session',
          latestSeverity: 'warning',
          flappingLikely: false,
          repairedRuns: 2,
          totalRuns: 3,
        },
        text: 'Briefing do operador\n\nHeadline: Zavorth operavel, mas com alguns pontos pedindo acompanhamento.',
      })),
    },
    hookPlane: {
      buildSnapshot: jest.fn(() => ({
        summary: {
          supportedEvents: 11,
          coveredEvents: 3,
          readyEvents: 2,
          partialEvents: 1,
          plannedEvents: 0,
          customEvents: 0,
          registeredHooks: 3,
          workspaces: 1,
        },
        narrative: {
          headline: 'Hook plane pronto.',
          operatorSummary: '3 hooks registrados.',
        },
        events: [
          {
            id: 'before-task-dispatch',
            label: 'Antes do dispatch',
            status: 'ready',
            registeredHooks: 1,
            description: 'Executa validacoes antes do dispatch.',
          },
        ],
      })),
    },
    toolSurface: {
      buildSnapshot: jest.fn(() => ({
        summary: {
          families: 9,
          explicitTools: 27,
          ready: 6,
          partial: 2,
          planned: 1,
        },
        narrative: {
          headline: 'Tool surface pronto.',
          operatorSummary: '9 familias ativas.',
        },
        families: [
          {
            label: 'Session tools',
            status: 'ready',
            summary: 'Listagem e spawn prontos.',
          },
        ],
      })),
    },
    memoryPlane: {
      buildSnapshot: jest.fn(async () => ({
        summary: {
          persistedMemories: 2,
          relevantMemories: 1,
          replayTasks: 2,
          workflowRuns: 1,
          artifacts: 3,
          workspaceSignals: 2,
        },
        artifacts: {
          recent: [
            {
              label: 'gateway-summary.md',
              summary: 'Resumo consolidado.',
              path: 'artifacts/gateway-summary.md',
            },
          ],
        },
        suggestedActions: [
          {
            label: 'Retomar gateway',
            command: '/sessionhistory session-web-1',
          },
        ],
        narrative: {
          headline: 'Memory, Replay & Artifacts',
          operatorSummary: 'Retomada pronta.',
        },
      })),
    },
    workspaceMemoryOs: {
      buildReview: jest.fn(async () => ({
        generatedAt: '2026-04-24T15:00:00.000Z',
        phase: '29',
        surface: 'workspace-memory-os',
        workspaceProfile: {
          workspace: 'C:/repo',
          slug: 'repo',
          stack: ['typescript', 'jest'],
          buildCommands: ['npm run build'],
          testCommands: ['npm run test'],
          importantDirectories: ['src', 'tests'],
          preferredExecutor: 'codex',
          codeStyle: ['esm', 'typescript-strict'],
          architecturalDecisions: ['Use runtime:check antes de build.'],
          repeatedFailures: [],
        },
        recentTaskResolver: {
          taskId: 'task-phase-29',
          state: 'completed',
          workspace: 'C:/repo',
          executor: 'codex',
          artifacts: ['artifact://report'],
          command: 'zavorth tasks retry task-phase-29',
          reason: 'Follow-up aponta para task recente.',
        },
        conversationSummary: {
          conversation: 'web:session-1',
          sessionId: 'session-1',
          headline: 'Task concluida.',
          recentTopics: ['Task concluida.'],
          recentArtifacts: [
            {
              label: 'report.md',
              kind: 'report',
              command: 'zavorth artifacts task task-phase-29',
            },
          ],
        },
        preferenceLedger: {
          total: 1,
          entries: [
            {
              id: 'memory:idioma_preferido',
              key: 'idioma_preferido',
              label: 'idioma_preferido',
              kind: 'preference',
              layer: 'long',
              category: 'preferencia',
              valuePreview: 'portugues direto',
              source: 'user_memory',
              confidence: 0.86,
              retention: {
                policy: 'preference',
                ttlDays: null,
                reason: 'Preferencia explicita.',
              },
              redaction: {
                applied: false,
                reason: null,
              },
              actions: {
                forget: 'zavorth memory forget idioma_preferido',
                correct: 'zavorth memory correct idioma_preferido <novo valor>',
              },
            },
          ],
          commands: {
            forget: 'zavorth memory forget <key>',
            correct: 'zavorth memory correct <key> <novo valor>',
          },
        },
        review: {
          total: 1,
          entries: [],
        },
        retentionPolicy: {
          preference: { ttlDays: null, defaultRemember: true, reason: 'Preferencias revisaveis.' },
        },
        followUps: {
          examples: [
            {
              input: 'continua',
              resolvesTo: 'task-phase-29',
              command: 'zavorth tasks retry task-phase-29',
            },
          ],
        },
        contracts: {
          reviewShowsLearnedMemory: true,
          userCanForgetOrCorrect: true,
          workspaceCommandsReusable: true,
          followUpsResolveReferences: true,
          secretsRedactedByDefault: true,
          noRawLogDumpByDefault: true,
        },
        commands: {
          review: 'zavorth memory review --json',
          resolve: 'zavorth memory resolve "continua" --json',
          forget: 'zavorth memory forget <key>',
          correct: 'zavorth memory correct <key> <novo valor>',
        },
        narrative: {
          headline: '1 memoria revisavel para repo.',
          operatorSummary: 'Follow-ups podem retomar task-phase-29.',
        },
      })),
      resolveFollowUp: jest.fn(async (input: string) => ({
        generatedAt: '2026-04-24T15:01:00.000Z',
        phase: '29',
        surface: 'workspace-memory-resolution',
        input,
        intent: 'continue_task',
        resolved: true,
        target: {
          taskId: 'task-phase-29',
          workspace: 'C:/repo',
          artifactCommand: null,
          nextCommand: 'zavorth tasks retry task-phase-29',
        },
        evidence: ['task:task-phase-29', 'workspace:repo'],
        reason: 'Resolvido pela task recente.',
      })),
      executeAction: jest.fn(async ({ action, key }: any) => ({
        generatedAt: '2026-04-24T15:02:00.000Z',
        phase: '29',
        surface: 'workspace-memory-action',
        action,
        key,
        ok: true,
        status: 'applied',
        summary: `Memoria ${key} atualizada.`,
        review: {
          phase: '29',
          surface: 'workspace-memory-os',
          review: { total: 1, entries: [] },
          preferenceLedger: { total: 1 },
          workspaceProfile: { slug: 'repo' },
        },
      })),
    },
    selfHealControlPlane: {
      buildPreview: jest.fn(async ({ apply, budget }: any = {}) => ({
        generatedAt: '2026-04-24T16:00:00.000Z',
        phase: '30',
        surface: 'self-heal-control-plane',
        mode: apply ? 'apply' : 'preview',
        status: apply ? 'blocked' : 'ready',
        summary: {
          probes: 8,
          issues: 1,
          actions: 1,
          pendingApproval: apply ? 1 : 0,
          blocked: 0,
          budgetCost: 0.9,
          budgetLimit: budget || 3,
        },
        probes: [
          {
            flowId: 'remote_executor_session_lost',
            label: 'Executor remoto',
            status: 'attention',
            severity: 'medium',
            executor: 'node-mesh',
            evidence: ['Sessao remota perdida.'],
            recommendedAction: 'Recuperacao padronizada do executor',
          },
        ],
        plan: [
          {
            id: 'heal:remote_executor_session_lost',
            flowId: 'remote_executor_session_lost',
            label: 'Recuperacao padronizada do executor',
            command: 'zavorth ops autorepair dryrun --json',
            applyCommand: 'zavorth ops autorepair --json',
            previewOnly: false,
            risk: 'medium',
            requiresApproval: false,
            budgetCost: 0.9,
            status: apply ? 'pending_approval' : 'planned',
            reason: 'Sessao remota perdida.',
          },
        ],
        outbox: apply
          ? [
              {
                id: 'outbox:heal:remote_executor_session_lost',
                actionId: 'heal:remote_executor_session_lost',
                flowId: 'remote_executor_session_lost',
                approvalRequired: true,
                command: 'zavorth ops autorepair --json',
                reason: 'Apply bloqueado por policy no stub.',
                status: 'proposed',
              },
            ]
          : [],
        watchdog: {
          mode: 'lazy',
          enabled: false,
          alwaysOn: false,
          command: 'zavorth heal --preview --json',
          reason: 'Watchdog lazy.',
        },
        automationBudgets: [
          {
            id: 'recovery',
            label: 'Recuperacao supervisionada',
            maxCost: budget || 3,
            estimatedCost: 0.9,
            remainingCost: (budget || 3) - 0.9,
            exceeded: false,
            reset: 'per-run',
          },
        ],
        repetitionGuard: {
          failures: 0,
          threshold: 2,
          paused: false,
          reason: null,
          source: 'stub',
        },
        dailyReport: {
          generatedAt: '2026-04-24T16:00:00.000Z',
          topFailures: ['Executor remoto: Sessao remota perdida.'],
          pendingItems: apply ? ['heal:remote_executor_session_lost: aprovacao pendente'] : ['Nenhuma pendencia bloqueante.'],
          proposedActions: ['Recuperacao padronizada do executor: zavorth ops autorepair dryrun --json'],
          summary: '1 fluxo precisa de atencao.',
        },
        execution: {
          attempted: false,
          status: apply ? 'approval_required' : null,
          summary: apply ? 'Plano contem recuperacao sensivel.' : null,
          result: null,
        },
        contracts: {
          previewDoesNotExecute: true,
          applyRespectsTrustPolicy: true,
          nothingAlwaysOnWithoutExplicitConfig: true,
          everyAutomationHasBudget: true,
          sensitiveRecoveryRequiresApproval: true,
          repeatedFailuresPause: true,
          brokenExecutorAttemptsStandardRecovery: true,
        },
        commands: {
          preview: 'zavorth heal --preview --json',
          apply: 'zavorth heal --apply --json',
          report: 'zavorth heal report --json',
          outbox: 'zavorth heal --preview --json',
        },
        narrative: {
          headline: 'Self-Heal gerou um plano de recuperacao seguro.',
          operatorSummary: '1 acao pronta para apply supervisionado.',
        },
      })),
      buildDailyReport: jest.fn(async () => ({
        generatedAt: '2026-04-24T16:10:00.000Z',
        phase: '30',
        surface: 'self-heal-control-plane',
        mode: 'daily-report',
        status: 'ready',
        summary: {
          probes: 8,
          issues: 1,
          actions: 1,
          pendingApproval: 0,
          blocked: 0,
          budgetCost: 0.9,
          budgetLimit: 3,
        },
        probes: [],
        plan: [],
        outbox: [],
        watchdog: {
          mode: 'lazy',
          enabled: false,
          alwaysOn: false,
          command: 'zavorth heal --preview --json',
          reason: 'Watchdog lazy.',
        },
        automationBudgets: [
          {
            id: 'daily-report',
            label: 'Relatorio diario opcional',
            maxCost: 0.6,
            estimatedCost: 0.2,
            remainingCost: 0.4,
            exceeded: false,
            reset: 'daily',
          },
        ],
        repetitionGuard: {
          failures: 0,
          threshold: 2,
          paused: false,
          reason: null,
          source: 'stub',
        },
        dailyReport: {
          generatedAt: '2026-04-24T16:10:00.000Z',
          topFailures: ['Executor remoto: Sessao remota perdida.'],
          pendingItems: ['Nenhuma pendencia bloqueante.'],
          proposedActions: ['zavorth ops autorepair dryrun --json'],
          summary: 'Relatorio diario pronto.',
        },
        execution: {
          attempted: false,
          status: null,
          summary: null,
          result: null,
        },
        contracts: {
          previewDoesNotExecute: true,
          applyRespectsTrustPolicy: true,
          nothingAlwaysOnWithoutExplicitConfig: true,
          everyAutomationHasBudget: true,
          sensitiveRecoveryRequiresApproval: true,
          repeatedFailuresPause: true,
          brokenExecutorAttemptsStandardRecovery: true,
        },
        commands: {
          preview: 'zavorth heal --preview --json',
          apply: 'zavorth heal --apply --json',
          report: 'zavorth heal report --json',
          outbox: 'zavorth heal --preview --json',
        },
        narrative: {
          headline: 'Relatorio diario de self-heal pronto.',
          operatorSummary: 'Top falhas e acoes propostas visiveis.',
        },
      })),
    },
    releasePresenceControlPlane: {
      buildStatus: jest.fn(async () => createReleasePresenceSnapshot('status')),
      buildDiff: jest.fn(async () => createReleasePresenceSnapshot('diff')),
      buildRollbackPreview: jest.fn(async () => createReleasePresenceSnapshot('rollback-preview')),
      buildRemotePresence: jest.fn(async () => createReleasePresenceSnapshot('presence')),
    },
    layeredMemory: {
      buildStatus: jest.fn(async () => ({
        generatedAt: '2026-04-09T15:00:00.000Z',
        summary: {
          total: 5,
          episodic: 2,
          semantic: 2,
          procedural: 1,
        },
        budgets: {
          perLayer: 12,
          episodicUsage: 0.16,
          semanticUsage: 0.16,
          proceduralUsage: 0.08,
        },
        narrative: {
          headline: 'Layered memory pronta para recall.',
          operatorSummary: '2 episodicos, 2 semanticos e 1 procedimento.',
        },
      })),
      search: jest.fn(async ({ query }: any) => ({
        generatedAt: '2026-04-09T15:00:00.000Z',
        query,
        total: 2,
        data: [
          {
            id: 'timeline-1',
            label: 'Gateway release',
            summary: 'Release final pronta.',
            memoryLayer: 'episodic',
            source: 'workflow',
            confidence: 0.74,
            lastValidatedAt: '2026-04-09T14:59:00.000Z',
          },
          {
            id: 'candidate:wf-1',
            label: 'Ship playbook para workspace-a',
            summary: 'Playbook aprendido.',
            memoryLayer: 'procedural',
            source: 'learning-plane',
            confidence: 0.88,
            lastValidatedAt: '2026-04-09T14:59:00.000Z',
          },
        ],
      })),
      readProcedures: jest.fn(async () => ({
        generatedAt: '2026-04-09T15:00:00.000Z',
        total: 1,
        data: [
          {
            id: 'candidate:wf-1',
            label: 'Ship playbook para workspace-a',
            summary: 'Playbook aprendido.',
            steps: ['Inspect runtime', 'Publish release'],
            memoryLayer: 'procedural',
            source: 'learning-plane',
            confidence: 0.88,
            lastValidatedAt: '2026-04-09T14:59:00.000Z',
          },
        ],
      })),
      readMetrics: jest.fn(async () => ({
        generatedAt: '2026-04-09T15:00:00.000Z',
        summary: {
          totalEntries: 5,
          episodic: 2,
          semantic: 2,
          procedural: 1,
          averageBudgetUsage: 0.133,
          pressure: 'ok',
        },
        budgets: {
          perLayer: 12,
          episodicUsage: 0.16,
          semanticUsage: 0.16,
          proceduralUsage: 0.08,
        },
        procedures: {
          total: 1,
          trustedLocal: 0,
          learnedDraft: 1,
          implicit: 0,
        },
      })),
    },
    learningPlane: {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-09T15:00:00.000Z',
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
            summary: 'Playbook aprendido a partir de uma run completa.',
            score: 0.88,
            reviewState: 'pending',
            lifecycle: 'learned_draft',
            createdAt: '2026-04-09T14:00:00.000Z',
            updatedAt: '2026-04-09T14:59:00.000Z',
            lastValidatedAt: '2026-04-09T14:59:00.000Z',
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
          headline: 'Learning plane com 1 candidato.',
          operatorSummary: '1 candidato pendente de revisao.',
        },
      })),
      executeAction: jest.fn(({ candidateId, actionId }: any) => ({
        generatedAt: '2026-04-09T15:02:00.000Z',
        candidateId,
        actionId,
        status: 'applied',
        ok: true,
        summary: `Candidate ${candidateId} recebeu ${actionId}.`,
        details: ['Gate explicito aplicado.'],
        snapshot: {
          generatedAt: '2026-04-09T15:02:00.000Z',
          summary: {
            total: 1,
            pending: 0,
            approved: actionId === 'reject' ? 0 : 1,
            rejected: actionId === 'reject' ? 1 : 0,
            promoted: actionId === 'promote' ? 1 : 0,
            published: 0,
            quarantined: actionId === 'reject' ? 1 : 0,
            highConfidence: 1,
          },
          candidates: [],
          narrative: {
            headline: 'Learning atualizado.',
            operatorSummary: 'Snapshot revisado.',
          },
        },
      })),
      readMetrics: jest.fn(() => ({
        generatedAt: '2026-04-09T15:00:00.000Z',
        summary: {
          totalCandidates: 1,
          acceptedRate: 0,
          rejectedRate: 0,
          promotedRate: 0,
          averageScore: 0.88,
        },
        counts: {
          pending: 1,
          approved: 0,
          rejected: 0,
          promoted: 0,
          published: 0,
          quarantined: 0,
          highConfidence: 1,
        },
      })),
    },
    sessionPlane: {
      buildSnapshot: jest.fn(async () => ({
        summary: {
          commands: 4,
          tools: 4,
          sessions: 1,
          historyItems: 2,
          pendingPermissions: 0,
          linkedSurfaces: 2,
          sendReady: true,
          spawnReady: true,
        },
      })),
      buildStatusSummary: jest.fn(async () => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        summary: {
          sessions: 1,
          historyItems: 2,
          sendReady: true,
          spawnReady: true,
        },
      })),
      renderOverviewReport: jest.fn(async () => 'Session plane overview'),
      renderHistoryReport: jest.fn(async () => 'Session plane history'),
      sendToSession: jest.fn(async () => ({
        ok: true,
        taskId: 'task-123',
        chatId: 'web:session-1',
        sessionId: 'session-1',
        platform: 'web',
        snapshot: null,
      })),
      spawnSession: jest.fn(async () => ({
        ok: true,
        platform: 'web',
        sessionId: 'session-new',
        chatId: 'web:session-new',
        sourceUserId: 'session-new',
        runtimeUserId: 'alice',
        handoffCommand: '/open-session session-new',
      })),
    },
    nodeMesh: {
      buildSnapshot: jest.fn(({ selectedNodeId }: any = {}) => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        summary: {
          total: 1,
          paired: 1,
          pending: 0,
          online: 1,
          offline: 0,
          invokable: 1,
          capabilities: 3,
          queued: 1,
          completedRecently: 0,
        },
        entries: [
          {
            id: 'node-alpha',
            label: 'Node Alpha',
            profileId: 'headless-worker',
            kind: 'headless',
            transport: 'bridge',
            status: 'online',
            pairingStatus: 'paired',
            paired: true,
            createdAt: '2026-04-04T16:00:00.000Z',
            updatedAt: '2026-04-04T16:00:00.000Z',
            pairedAt: '2026-04-04T16:00:00.000Z',
            lastSeenAt: '2026-04-04T16:00:00.000Z',
            requestedBy: 'alice',
            capabilityIds: ['system.run', 'files.watch', 'browser.proxy'],
            capabilities: [],
            hostHints: { hostname: 'node-alpha', platform: 'linux', workspace: 'C:/repo', surface: 'cli' },
            notes: [],
            operatorSummary: 'Node online.',
            canInvoke: true,
            nextAction: 'Node pronto.',
            trustLabel: 'pareado',
            pendingInvocations: 1,
            claimedInvocations: 0,
            recentInvocation: null,
          },
        ],
        selected: {
          id: selectedNodeId || 'node-alpha',
          label: 'Node Alpha',
          profileId: 'headless-worker',
          kind: 'headless',
          transport: 'bridge',
          status: 'online',
          pairingStatus: 'paired',
          paired: true,
          createdAt: '2026-04-04T16:00:00.000Z',
          updatedAt: '2026-04-04T16:00:00.000Z',
          pairedAt: '2026-04-04T16:00:00.000Z',
          lastSeenAt: '2026-04-04T16:00:00.000Z',
          requestedBy: 'alice',
          capabilityIds: ['system.run', 'files.watch', 'browser.proxy'],
          capabilities: [],
          hostHints: { hostname: 'node-alpha', platform: 'linux', workspace: 'C:/repo', surface: 'cli' },
          notes: [],
          operatorSummary: 'Node online.',
          canInvoke: true,
          nextAction: 'Node pronto.',
          trustLabel: 'pareado',
          pendingInvocations: 1,
          claimedInvocations: 0,
          recentInvocation: null,
        },
        capabilityCatalog: [],
        deviceProfiles: [],
        recommendedProfiles: [],
        suggestedActions: [
          {
            label: 'Rodar invoke',
            reason: 'Node pronto.',
            actionHint: 'nodeinvoke node-alpha system.run run {\"command\":\"echo ok\"}',
          },
        ],
        selectedActivity: {
          nodeId: selectedNodeId || 'node-alpha',
          activeInvocations: [
            {
              id: 'invoke-pending-1',
              nodeId: selectedNodeId || 'node-alpha',
              capabilityId: 'files.watch',
              action: 'watch',
              payload: { path: 'logs/app.log' },
              requestedBy: 'alice',
              transport: 'bridge',
              status: 'pending',
              requestedAt: '2026-04-04T16:00:00.000Z',
              queuedAt: '2026-04-04T16:00:00.000Z',
              claimedAt: null,
              completedAt: null,
              ok: null,
              resultSummary: null,
              output: null,
            },
          ],
          recentInvocations: [
            {
              id: 'invoke-recent-1',
              nodeId: selectedNodeId || 'node-alpha',
              capabilityId: 'browser.proxy',
              action: 'open',
              payload: { url: 'https://example.com' },
              requestedBy: 'alice',
              transport: 'bridge',
              status: 'completed',
              requestedAt: '2026-04-04T15:58:00.000Z',
              queuedAt: '2026-04-04T15:58:00.000Z',
              claimedAt: '2026-04-04T15:58:05.000Z',
              completedAt: '2026-04-04T15:58:06.000Z',
              ok: true,
              resultSummary: 'Endpoint confirmado.',
              output: {
                stdout: 'http://127.0.0.1:9222/devtools/browser/demo',
                stderr: null,
                exitCode: 0,
                data: null,
              },
            },
          ],
          summary: {
            pending: 1,
            claimed: 0,
            completedRecently: 1,
            active: 1,
            recent: 1,
          },
          narrative: {
            headline: 'Node Node Alpha tem fila remota ativa.',
            operatorSummary: 'Ultima activity: browser.proxy em status completed.',
          },
        },
        narrative: {
          headline: 'Node Mesh pronto.',
          operatorSummary: '1 node pareado e online.',
        },
      })),
    },
    nodePairing: {
      createPairingDraft: jest.fn(({ profileId, label, requestedBy }: any) => ({
        generatedAt: '2026-04-04T16:00:00.000Z',
        entry: {
          id: 'node-beta',
          label,
          profileId,
          kind: 'headless',
          transport: 'bridge',
          status: 'pairing',
          pairingStatus: 'pending',
          paired: false,
          createdAt: '2026-04-04T16:00:00.000Z',
          updatedAt: '2026-04-04T16:00:00.000Z',
          pairedAt: null,
          lastSeenAt: null,
          requestedBy,
          capabilityIds: ['system.run', 'files.watch', 'browser.proxy'],
          hostHints: { hostname: null, platform: null, workspace: 'C:/workspace/demo', surface: 'cli' },
          notes: [],
          operatorSummary: 'Pairing pendente.',
        },
        profile: {
          id: profileId,
          label: 'Headless Worker',
          kind: 'headless',
          transport: 'bridge',
          summary: 'Headless',
          operatorSummary: 'Headless pronto.',
          defaultCapabilityIds: ['system.run', 'files.watch', 'browser.proxy'],
          actionHint: 'Suba o host.',
        },
        pairingCode: 'PAIR-123',
        actionHint: 'Use o code.',
        instructions: ['Suba o host.'],
        bootstrap: {
          packageScript: 'nodes:host',
          command: 'npm run nodes:host -- --base-url http://127.0.0.1:33333 --node-id node-beta --pairing-code PAIR-123 --workspace \"C:/workspace/demo\" --capabilities system.run,files.watch,browser.proxy',
          fallbackCommand: null,
          pairingToken: 'node-beta:PAIR-123',
          workspaceHint: 'C:/workspace/demo',
          notes: ['Use este bootstrap headless.'],
        },
      })),
    },
    nodeInvoke: {
      invoke: jest.fn(({ nodeId, capabilityId, action }: any) => ({
        ok: true,
        status: 'queued',
        nodeId,
        capabilityId,
        action,
        reason: 'Invocacao colocada na fila do Node Mesh.',
        transport: 'bridge',
        commandHint: 'Acompanhe o heartbeat.',
        queuedAt: '2026-04-04T16:00:00.000Z',
        invocationId: 'invoke-node-1',
      })),
    },
    nodeDeviceProfiles: {
      resolveProfile: jest.fn((profileId: string) => ({
        id: profileId || 'headless-worker',
        label: 'Headless Worker',
        kind: 'headless',
        transport: 'bridge',
        summary: 'Headless',
        operatorSummary: 'Headless pronto.',
        defaultCapabilityIds: ['system.run', 'files.watch', 'browser.proxy'],
        actionHint: 'Suba o host.',
      })),
      describeProfile: jest.fn(() => ({
        id: 'headless-worker',
        label: 'Headless Worker',
      })),
      listProfiles: jest.fn(() => [
        {
          id: 'headless-worker',
          label: 'Headless Worker',
          kind: 'headless',
          transport: 'bridge',
          summary: 'Headless',
          operatorSummary: 'Headless pronto.',
          defaultCapabilityIds: ['system.run', 'files.watch', 'browser.proxy'],
          actionHint: 'Suba o host.',
        },
      ]),
    },
    nodeCapabilities: {
      listCatalog: jest.fn(() => [
        {
          id: 'files.watch',
          label: 'Files Watch',
          summary: 'Observa mudancas.',
          category: 'files',
          risky: false,
          actionHint: 'Use para checkpoints.',
        },
      ]),
    },
    surfaceTaskDispatcher: {
      dispatchTaskMessage: jest.fn(async (input: any) => {
        await input.ctx.reply(`task dispatched ${input.text}`);
        const commandType = String(input.text || '').trim().startsWith('/task') ? '/task' : '/task';
        return {
          task: {
            task_id: 'task-cli-123',
          },
          parsed: {
            command_type: commandType,
          },
          runtimeUserId: 'alice',
          sourceUserId: input.sourceUserId || 'session-cli-1',
          tenantId: null,
          tenantContext: null,
        };
      }),
    },
  };
}

function runZavorthLauncherHelp(args: string[]): string {
  return execFileSync(
    process.execPath,
    [
      path.resolve(config.projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      path.resolve(config.projectRoot, 'src', 'zavorth-cli.ts'),
      ...args,
    ],
    {
      cwd: config.projectRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
      maxBuffer: 1024 * 1024,
    },
  );
}

async function captureConsoleChatter(fn: () => Promise<void>): Promise<string[]> {
  const chatter: string[] = [];
  const methods = ['log', 'info', 'warn', 'debug'] as const;
  const originals = new Map<(typeof methods)[number], (...args: any[]) => void>();

  for (const method of methods) {
    originals.set(method, console[method]);
    console[method] = (...args: unknown[]) => {
      chatter.push(args.map((entry) => String(entry ?? '')).join(' '));
    };
  }

  try {
    await fn();
  } finally {
    originals.forEach((original, method) => {
      console[method] = original;
    });
  }

  return chatter;
}

describe('ZavorthCli', () => {
  it('parses aliases and context flags', () => {
    const parsed = parseZavorthCliFlags([
      '/memoryplane',
      '--json',
      '--user',
      'alice',
      '--chat',
      'web:session-1',
      '--session',
      'session-1',
    ]);

    expect(parsed).toEqual(
      expect.objectContaining({
        commandText: '/memoryplane',
        json: true,
        userId: 'alice',
        chatId: 'web:session-1',
        sessionId: 'session-1',
      }),
    );
  });

  it('parses the live flag for operational snapshots', () => {
    const parsed = parseZavorthCliFlags(['status', '--live']);

    expect(parsed).toEqual(
      expect.objectContaining({
        commandText: 'status',
        live: true,
      }),
    );
  });

  it('parses chat as the official terminal entrypoint', () => {
    const parsed = parseZavorthCliFlags(['chat']);

    expect(parsed).toEqual(
      expect.objectContaining({
        repl: true,
        command: null,
        commandText: null,
      }),
    );
  });

  it('shows the human help entry when called with no arguments outside a TTY', async () => {
    const writes: string[] = [];
    const errors: string[] = [];
    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: (text: string) => errors.push(text),
      },
    });

    const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      configurable: true,
    });

    try {
      const exitCode = await cli.run([]);

      expect(exitCode).toBe(0);
      expect(writes[0]).toContain('Zavorth');
      expect(writes[0]).toContain('A local-first assistant for daily work');
      expect(writes[0]).toContain('Start');
      expect(writes[0]).toContain('Work');
      expect(writes[0]).toContain('Inspect');
      expect(writes[0]).toContain('zavorth setup');
      expect(writes[0]).toContain('zavorth chat');
      expect(writes[0]).toContain('zavorth help <command>');
      expect(writes[0]).toContain('New here? Run: zavorth setup');
      expect(errors).toEqual([]);
      expect(writes[0]).not.toContain('Nenhum comando informado');
    } finally {
      if (descriptor) {
        Object.defineProperty(process.stdin, 'isTTY', descriptor);
      } else {
        delete (process.stdin as any).isTTY;
      }
    }
  });

  it('normalizes product aliases for run and history', () => {
    const runParsed = parseZavorthCliFlags(['run', 'continuar', 'a', 'analise']);
    const historyParsed = parseZavorthCliFlags(['history', 'session-web-1']);

    expect(runParsed).toEqual(
      expect.objectContaining({
        command: 'task',
        commandText: 'task continuar a analise',
      }),
    );
    expect(historyParsed).toEqual(
      expect.objectContaining({
        command: 'sessionhistory',
        commandText: 'sessionhistory session-web-1',
      }),
    );
  });

  it('normalizes natural aliases for approvals and workflow continuity', () => {
    const continueParsed = parseZavorthCliFlags(['continue']);
    const approveParsed = parseZavorthCliFlags(['approve', 'task-123', 'pin=123456']);
    const resumeParsed = parseZavorthCliFlags(['resume', 'wf-ship-abc123', 'review']);
    const restartParsed = parseZavorthCliFlags(['restart-stage', 'wf-ship-abc123', 'draft']);

    expect(continueParsed).toEqual(
      expect.objectContaining({
        command: 'task',
        commandText: 'task continue',
      }),
    );
    expect(approveParsed).toEqual(
      expect.objectContaining({
        command: 'approve',
        commandText: '/approve task-123 pin=123456',
      }),
    );
    expect(resumeParsed).toEqual(
      expect.objectContaining({
        command: 'workflow',
        commandText: '/workflow resume wf-ship-abc123 review',
      }),
    );
    expect(restartParsed).toEqual(
      expect.objectContaining({
        command: 'workflow',
        commandText: '/workflow restart-stage wf-ship-abc123 draft',
      }),
    );
  });

  it('normalizes tenants as a shared slash command in the CLI', async () => {
    const writes: string[] = [];
    const commandService = {
      maybeHandle: jest.fn(async (ctx: any) => {
        await ctx.reply(`handled ${ctx.rawText}`);
        return true;
      }),
    };

    const exitCode = await runZavorthCli(
      ['tenants', 'discord-public', 'review-runtime'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
        toolSurface: false as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(commandService.maybeHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        rawText: '/tenants discord-public review-runtime',
      }),
    );
    expect(writes).toEqual(expect.arrayContaining([expect.stringContaining('handled /tenants discord-public review-runtime')]));
  });

  it('routes shared slash commands through the canonical Surface API when available', async () => {
    const writes: string[] = [];
    const surfaceApi = {
      handleCommand: jest.fn(async (input: any) => {
        await input.context.reply(`Boundary ${input.request.surface}: ${input.context.rawText}`);
        return {
          ok: true,
          handled: true,
          status: 'ok',
          summary: 'Handled by canonical CLI boundary.',
          messages: [`Boundary ${input.request.surface}: ${input.context.rawText}`],
          correlation: {
            traceId: 'trace-cli',
            runId: 'run-cli',
            sessionId: input.request.threadId,
            approvalId: null,
            artifactId: null,
          },
          error: null,
          metadata: {},
        };
      }),
    };

    const exitCode = await runZavorthCli(
      ['hooks', 'transport'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: surfaceApi as any,
        hookPlane: false as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(surfaceApi.handleCommand).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        platform: 'web',
        rawText: '/hooks transport',
      }),
      request: expect.objectContaining({
        surface: 'web',
        requestedBy: expect.any(String),
        chatId: expect.stringContaining('cli:'),
      }),
    }));
    expect(writes[0]).toContain('Boundary web: /hooks transport');
  });

  it('normalizes the command catalog into the shared slash-command surface', async () => {
    const writes: string[] = [];
    const surfaceApi = {
      handleCommand: jest.fn(async (input: any) => {
        await input.context.reply(`Boundary ${input.request.surface}: ${input.context.rawText}`);
        return {
          ok: true,
          handled: true,
          status: 'ok',
          summary: 'Handled by canonical CLI boundary.',
          messages: [`Boundary ${input.request.surface}: ${input.context.rawText}`],
          correlation: {
            traceId: 'trace-cli',
            runId: 'run-cli',
            sessionId: input.request.threadId,
            approvalId: null,
            artifactId: null,
          },
          error: null,
          metadata: {},
        };
      }),
    };

    const exitCode = await runZavorthCli(
      ['commands', 'channel'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: surfaceApi as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(surfaceApi.handleCommand).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        platform: 'web',
        rawText: '/commands channel',
      }),
    }));
    expect(writes[0]).toContain('Boundary web: /commands channel');
  });

  it('renders a CLI help overview natively', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(
      ['help'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Zavorth');
    expect(writes[0]).toContain('A local-first assistant for daily work');
    expect(writes[0]).toContain('Start');
    expect(writes[0]).toContain('Work');
    expect(writes[0]).toContain('Inspect');
    expect(writes[0]).toContain('Safety');
    expect(writes[0]).toContain('zavorth setup');
    expect(writes[0]).toContain('zavorth go');
    expect(writes[0]).toContain('zavorth chat');
    expect(writes[0]).toContain('zavorth run "<request>"');
    expect(writes[0]).toContain('zavorth doctor');
    expect(writes[0]).toContain('zavorth help <command>');
    expect(writes[0]).toContain('New here? Run: zavorth setup');
    expect(writes[0]).not.toContain('ops run <actionId>');
    expect(writes[0]).not.toContain('nodes invoke');
    expect(writes[0]).not.toContain('Tab + historico');
  });

  it('renders product help for zavorth go without exposing ops internals as the main path', () => {
    const output = runZavorthLauncherHelp(['help', 'go']);

    expect(output).toContain('zavorth go');
    expect(output).toContain('Abre o Zavorth Home em /dashboard ou explica exatamente o bloqueio.');
    expect(output).toContain('Use quando');
    expect(output).toContain('You want the simple Home: Inbox, Tasks, Approvals, Receipts and Connectors.');
    expect(output).toContain('Modo seguro');
    expect(output).toContain('zavorth go --dry-run');
    expect(output).toContain('Saida esperada');
    expect(output).toContain('zavorth doctor');
    expect(output).not.toContain('npm run ops:');
    expect(output).not.toContain('npm run cli --');
    expect(output).not.toContain('Suba o runtime oficial');
    expect(output).not.toContain('Feche o remoto oficial');
  });

  it('renders product help for zavorth setup and points to the canonical next commands', () => {
    const output = runZavorthLauncherHelp(['help', 'onboard']);

    expect(output).toContain('zavorth setup');
    expect(output).toContain('Prepara o primeiro uso com profile canonico, workspace, tom, memoria e seguranca.');
    expect(output).toContain('Primeiro uso');
    expect(output).toContain('provider/modelo');
    expect(output).toContain('placeholder seguro');
    expect(output).toContain('zavorth setup --dry-run');
    expect(output).toContain('zavorth setup --json --dry-run');
    expect(output).toContain('Depois');
    expect(output).toContain('Seguro');
    expect(output).toContain('zavorth go --dry-run');
    expect(output).toContain('zavorth doctor');
    expect(output).not.toContain('npm run ops:');
    expect(output).not.toContain('npm run cli --');
  });

  it('renders product help for zavorth chat with natural examples for common users', () => {
    const output = runZavorthLauncherHelp(['help', 'chat']);

    expect(output).toContain('zavorth chat');
    expect(output).toContain('Abre a conversa principal do Zavorth no terminal.');
    expect(output).toContain('Use quando');
    expect(output).toContain('Exemplos');
    expect(output).toContain('revisar este modulo');
    expect(output).toContain('retome o que estavamos fazendo');
    expect(output).toContain('compare o que mudou nesta pasta');
    expect(output).toContain('Atalhos uteis');
    expect(output).toContain('quit');
    expect(output).not.toContain('ops run <actionId>');
    expect(output).not.toContain('nodes invoke');
  });

  it('renders an advanced help overview without polluting the root help', () => {
    const output = runZavorthLauncherHelp(['help', 'advanced']);

    expect(output).toContain('Ajuda avancada do Zavorth');
    expect(output).toContain('Operacao do runtime');
    expect(output).toContain('zavorth help ops');
    expect(output).toContain('zavorth help sessions');
    expect(output).toContain('zavorth help nodes');
    expect(output).toContain('zavorth memory status');
    expect(output).not.toContain('Comece por aqui');
  });

  it('renders advanced ops help through command --help', () => {
    const output = runZavorthLauncherHelp(['ops', '--help']);

    expect(output).toContain('Ajuda avancada: operacao do runtime');
    expect(output).toContain('Leituras rapidas');
    expect(output).toContain('zavorth ops run <actionId>');
    expect(output).toContain('zavorth ops autorepair status|dryrun|improve|force [--json]');
    expect(output).not.toContain('npm run ops:');
  });

  it('renders advanced nodes help with pairing and invoke guidance', () => {
    const output = runZavorthLauncherHelp(['help', 'nodes']);

    expect(output).toContain('Ajuda avancada: nodes e devices');
    expect(output).toContain('Visao geral');
    expect(output).toContain('zavorth nodes list [--json]');
    expect(output).toContain('zavorth nodes pair [headless|desktop|mobile|browser] [label] [--json]');
    expect(output).toContain('zavorth nodes invoke <nodeId> <capabilityId> [action] [payload-json] [--json]');
    expect(output).not.toContain('Comece por aqui');
  });

  it('renders a complete reference page only when explicitly requested', () => {
    const output = runZavorthLauncherHelp(['help', 'reference']);

    expect(output).toContain('Referencia completa da CLI do Zavorth');
    expect(output).toContain('Trilha principal');
    expect(output).toContain('Operacao do runtime');
    expect(output).toContain('Sessoes e workflows');
    expect(output).toContain('Nodes e devices');
    expect(output).toContain('Memoria, learning e catalogos');
    expect(output).toContain('Compatibilidade e legado');
    expect(output).toContain('zavorth plugins <acao> <id>');
    expect(output).toContain('zavorth AIGateway [status|route|start|doctor|sync|promote|rollback] [--json]');
    expect(output).toContain('zavorth help all');
    expect(output).not.toContain('Comece por aqui');
  });

  it('renders product help for zavorth status through command --help', () => {
    const output = runZavorthLauncherHelp(['status', '--help']);

    expect(output).toContain('zavorth status');
    expect(output).toContain('Mostra um retrato curto do runtime local antes de voce agir.');
    expect(output).toContain('O que checa');
    expect(output).toContain('Comandos relacionados');
    expect(output).toContain('zavorth doctor');
    expect(output).toContain('Use --json quando outra ferramenta precisar ler a resposta.');
    expect(output).not.toContain('plugins sync');
  });

  it('renders a native doctor help page when the registry receives help doctor', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(
      ['help', 'doctor'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('zavorth doctor');
    expect(writes[0]).toContain('Diagnostica o ambiente local e transforma bloqueios em proximos passos.');
    expect(writes[0]).toContain('Use quando');
    expect(writes[0]).toContain('O que checa');
    expect(writes[0]).toContain('Node/npm/build/env, provider/modelo, SecretRefs');
    expect(writes[0]).toContain('zavorth status');
    expect(writes[0]).not.toContain('ops doctor');
  });

  it('renders advanced sessions help as structured json when requested', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(
      ['help', 'sessions', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    const payload = JSON.parse(writes[0]);
    expect(payload.topic).toBe('sessions');
    expect(payload.title).toBe('Ajuda avancada: sessoes e retomadas');
    expect(payload.sections.some((section: any) => section.title === 'Workflows e aprovacoes')).toBe(true);
    expect(JSON.stringify(payload)).toContain('zavorth sessions send <id> -- <mensagem>');
    expect(JSON.stringify(payload)).toContain('zavorth resume <runId> [stage]');
  });

  it('treats help all as an alias for the complete reference page', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(
      ['help', 'all', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    const payload = JSON.parse(writes[0]);
    expect(payload.topic).toBe('reference');
    expect(payload.title).toBe('Referencia completa da CLI do Zavorth');
    expect(JSON.stringify(payload)).toContain('zavorth help reference');
    expect(JSON.stringify(payload)).toContain('sessionhistory|sessionsend|sessionspawn|nodepair|nodeinvoke|platform');
  });

  it('renders the current CLI context without loading runtime services', async () => {
    const writes: string[] = [];
    const commandService = {
      maybeHandle: jest.fn(async () => false),
    };

    const exitCode = await runZavorthCli(
      ['ctx', '--user', 'alice', '--platform', 'discord', '--chat', 'discord:ops-room', '--session', 'session-42', '--workspace', 'C:/workspace/demo'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
        toolSurface: false as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(commandService.maybeHandle).not.toHaveBeenCalled();
    expect(writes[0]).toContain('Contexto do terminal Zavorth');
    expect(writes[0]).toContain('Agora');
    expect(writes[0]).toContain('Arquivos uteis');
    expect(writes[0]).toContain('Notas');
    expect(writes[0]).toContain('usuario: alice');
    expect(writes[0]).toContain('plataforma: discord');
    expect(writes[0]).toContain('chat: discord:ops-room');
    expect(writes[0]).toContain('sessao: session-42');
    expect(writes[0]).toContain('workspace: C:/workspace/demo');
  });

  it('renders a native aggregated status command for the CLI harness', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['status'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gateway: services.gateway as any,
        operatorBrief: services.operatorBrief as any,
        operationsCockpit: services.operationsCockpit as any,
        platformRegistry: services.platformRegistry as any,
        sessionPlane: services.sessionPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Status do Zavorth');
    expect(writes[0]).toContain('Zavorth operavel, mas com alguns pontos pedindo acompanhamento.');
    expect(writes[0]).toContain('Em resumo');
    expect(writes[0]).toContain('O Zavorth esta parcialmente pronto para uso.');
    expect(writes[0]).toContain('A conversa esta pronta para continuar.');
    expect(writes[0]).toContain('Nenhum bloqueio imediato apareceu neste retrato.');
    expect(writes[0]).toContain('Faca agora');
    expect(writes[0]).toContain('Abrir o diagnostico principal');
    expect(writes[0]).toContain('zavorth doctor');
    expect(writes[0]).not.toContain('zavorth ops run validate-node-mesh-smoke');
    expect(writes[0]).toContain('se quiser detalhes: zavorth doctor');
    expect(writes[0]).not.toContain('skills 1');
    expect(writes[0]).not.toContain('mcps 1');
    expect(services.operationsCockpit.readSnapshotFast).toHaveBeenCalled();
    expect(services.operationsCockpit.readSnapshot).not.toHaveBeenCalled();
    expect(services.operatorBrief.readSnapshotFromCockpit).toHaveBeenCalled();
    expect(services.operatorBrief.readSnapshotFast).not.toHaveBeenCalled();
    expect(services.operatorBrief.readSnapshot).not.toHaveBeenCalled();
    expect(services.gateway.buildSnapshot).toHaveBeenCalled();
    expect(services.gateway.buildHydratedSnapshot).not.toHaveBeenCalled();
    expect(services.platformRegistry.buildStatusSummarySnapshot).toHaveBeenCalled();
    expect(services.platformRegistry.buildSummarySnapshot).not.toHaveBeenCalled();
    expect(services.platformRegistry.buildSnapshot).not.toHaveBeenCalled();
    expect(services.sessionPlane.buildStatusSummary).toHaveBeenCalled();
    expect(services.sessionPlane.buildSnapshot).not.toHaveBeenCalled();
  });

  it('keeps the human status output free from startup chatter', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const originalBuildSnapshot = services.gateway.buildSnapshot.getMockImplementation()!;
    services.gateway.buildSnapshot.mockImplementation(() => {
      console.log('ðŸ’¾ [V3] Database SQLite inicializado com better-sqlite3...');
      console.warn('ðŸ”§ Tool registrada: demo.noise');
      return originalBuildSnapshot();
    });

    const chatter = await captureConsoleChatter(async () => {
      const exitCode = await runZavorthCli(
        ['status'],
        {
          write: (value) => writes.push(value),
          error: () => undefined,
        },
        {
          gateway: services.gateway as any,
          operatorBrief: services.operatorBrief as any,
          operationsCockpit: services.operationsCockpit as any,
          platformRegistry: services.platformRegistry as any,
          sessionPlane: services.sessionPlane as any,
          commandService: { maybeHandle: jest.fn(async () => false) } as any,
        },
      );

      expect(exitCode).toBe(0);
    });

    expect(writes[0]).toMatch(/^Status do Zavorth/);
    expect(chatter.join('\n')).not.toContain('Database SQLite');
    expect(chatter.join('\n')).not.toContain('Tool registrada');
  });

  it('supports live operational probes in the aggregated status command', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['status', '--live'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gateway: services.gateway as any,
        operatorBrief: services.operatorBrief as any,
        operationsCockpit: services.operationsCockpit as any,
        platformRegistry: services.platformRegistry as any,
        sessionPlane: services.sessionPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.operationsCockpit.readSnapshotLive).toHaveBeenCalled();
    expect(services.operationsCockpit.readSnapshotFast).not.toHaveBeenCalled();
    expect(services.operatorBrief.readSnapshotFromCockpit).toHaveBeenCalled();
    expect(services.operatorBrief.readSnapshotLive).not.toHaveBeenCalled();
    expect(services.platformRegistry.buildStatusSummarySnapshot).toHaveBeenCalled();
    expect(services.sessionPlane.buildStatusSummary).toHaveBeenCalled();
    expect(writes[0]).toContain('Status do Zavorth');
    expect(writes[0]).toContain('Em resumo');
    expect(writes[0]).toContain('Faca agora');
  });

  it('renders the domain plane directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['domains'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gateway: services.gateway as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.gateway.buildDomainSummarySnapshot).toHaveBeenCalled();
    expect(writes[0]).toContain('Dominios do Zavorth');
    expect(writes[0]).toContain('Todos os dominios principais estao inicializados.');
    expect(writes[0]).toContain('Agora');
    expect(writes[0]).toContain('Mapa');
    expect(writes[0]).toContain('- Gateway: pronto');
  });

  it('keeps gateway and domains human output free from startup chatter', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const originalDomainSummary = services.gateway.buildDomainSummarySnapshot.getMockImplementation()!;
    services.gateway.buildDomainSummarySnapshot.mockImplementation(() => {
      console.log('ðŸ’¾ [V3] Database SQLite inicializado com better-sqlite3...');
      console.warn('ðŸ”§ Tool registrada: demo.noise');
      return originalDomainSummary();
    });

    const chatter = await captureConsoleChatter(async () => {
      const exitCode = await runZavorthCli(
        ['domains'],
        {
          write: (value) => writes.push(value),
          error: () => undefined,
        },
        {
          gateway: services.gateway as any,
          commandService: { maybeHandle: jest.fn(async () => false) } as any,
        },
      );

      expect(exitCode).toBe(0);
    });

    expect(writes[0]).toMatch(/^Dominios do Zavorth/);
    expect(chatter.join('\n')).not.toContain('Database SQLite');
    expect(chatter.join('\n')).not.toContain('Tool registrada');
  });

  it('renders the domain plane as json in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['domains', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gateway: services.gateway as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.gateway.buildDomainSummarySnapshot).toHaveBeenCalled();
    expect(services.gateway.buildDomainSnapshot).not.toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 10,
          initialized: 10,
          pending: 0,
        }),
        domains: expect.arrayContaining([
          expect.objectContaining({
            id: 'gateway',
          }),
        ]),
      }),
    );
  });

  it('renders the full domain plane in the CLI when requested explicitly', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['domains', 'full', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gateway: services.gateway as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.gateway.buildDomainSnapshot).toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        domains: expect.arrayContaining([
          expect.objectContaining({
            id: 'gateway',
            summary: 'Gateway consolidado.',
          }),
        ]),
      }),
    );
  });

  it('renders a native node mesh snapshot in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['nodes'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodeMesh: services.nodeMesh as any,
        nodeDeviceProfiles: services.nodeDeviceProfiles as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Node Mesh do Zavorth');
    expect(writes[0]).toContain('Agora');
    expect(writes[0]).toContain('Node em foco');
    expect(writes[0]).toContain('Faca agora');
    expect(writes[0]).toContain('Node Alpha');
    expect(services.nodeMesh.buildSnapshot).toHaveBeenCalled();
  });

  it('keeps the node overview compact when the mesh has many entries', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const originalBuildSnapshot = services.nodeMesh.buildSnapshot.getMockImplementation()!;

    services.nodeMesh.buildSnapshot.mockImplementation(({ selectedNodeId }: any = {}) => {
      const snapshot = originalBuildSnapshot({ selectedNodeId });
      const baseEntry = snapshot.entries[0];
      const entries = [
        {
          ...baseEntry,
          id: 'node-alpha',
          label: 'Node Alpha',
          kind: 'headless',
          status: 'online',
          trustLabel: 'pareado',
          pendingInvocations: 1,
          claimedInvocations: 0,
          nextAction: 'Node pronto.',
          capabilityIds: ['system.run', 'files.watch'],
        },
        {
          ...baseEntry,
          id: 'node-beta',
          label: 'Node Beta',
          kind: 'desktop',
          status: 'idle',
          trustLabel: 'aguardando pairing',
          pendingInvocations: 0,
          claimedInvocations: 0,
          nextAction: 'Consumir pairing code.',
          capabilityIds: ['browser.proxy'],
        },
        {
          ...baseEntry,
          id: 'node-gamma',
          label: 'Node Gamma',
          kind: 'browser',
          status: 'online',
          trustLabel: 'pareado restrito',
          pendingInvocations: 2,
          claimedInvocations: 1,
          nextAction: 'Revisar allowlist.',
          capabilityIds: ['browser.proxy', 'files.watch'],
        },
        {
          ...baseEntry,
          id: 'node-delta',
          label: 'Node Delta',
          kind: 'mobile',
          status: 'offline',
          trustLabel: 'pareado',
          pendingInvocations: 0,
          claimedInvocations: 0,
          nextAction: 'Religar heartbeat.',
          capabilityIds: ['system.run'],
        },
      ];
      return {
        ...snapshot,
        summary: {
          ...snapshot.summary,
          total: entries.length,
          paired: 3,
          online: 2,
          queued: 4,
          completedRecently: 1,
        },
        entries,
        selected: entries.find((entry) => entry.id === selectedNodeId) || entries[0],
      };
    });

    const exitCode = await runZavorthCli(
      ['nodes'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodeMesh: services.nodeMesh as any,
        nodeDeviceProfiles: services.nodeDeviceProfiles as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Node Mesh do Zavorth');
    expect(writes[0]).toContain('Nodes em foco');
    expect(writes[0]).not.toContain('Node em foco');
    expect(writes[0]).toContain('Node Alpha [sem tela] online / pareado');
    expect(writes[0]).toContain('Node Gamma [navegador] online / pareado restrito');
    expect(writes[0]).toContain('+1 outro node na malha');
  });

  it('creates a native node pairing draft in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['nodepair', 'browser', 'My', 'Browser', 'Node'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodePairing: services.nodePairing as any,
        nodeDeviceProfiles: services.nodeDeviceProfiles as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Node pronto para pareamento');
    expect(writes[0]).toContain('No companion');
    expect(services.nodePairing.createPairingDraft).toHaveBeenCalled();
    expect(services.nodeDeviceProfiles.resolveProfile).toHaveBeenCalled();
  });

  it('invokes node capabilities natively in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['nodeinvoke', 'node-alpha', 'files.watch', 'watch', 'path=logs/app.log'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodeInvoke: services.nodeInvoke as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Invocacao enviada ao Node Mesh');
    expect(writes[0]).toContain('Faca agora');
    expect(services.nodeInvoke.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'node-alpha',
        capabilityId: 'files.watch',
        action: 'watch',
        payload: {
          path: 'logs/app.log',
        },
      }),
    );
  });

  it('renders a hydrated gateway snapshot as json', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['gateway'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gateway: services.gateway as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Gateway do Zavorth');
    expect(writes[0]).toContain('Agora');
    expect(writes[0]).toContain('Capacidade');
    expect(writes[0]).toContain('Malha');
    expect(writes[0]).toContain('Gateway pronto.');
    expect(writes[0]).toContain('- canais prontos: 2/4');
  });

  it('renders a hydrated gateway snapshot as json', async () => {
    const writes: string[] = [];
    const errors: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['gateway', '--json'],
      {
        write: (value) => writes.push(value),
        error: (value) => errors.push(value),
      },
      {
        gateway: services.gateway as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(errors).toEqual([]);
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        narrative: expect.objectContaining({
          headline: 'Gateway pronto.',
        }),
      }),
    );
  });

  it('supports slash aliases and renders the memory plane report', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['/memoryplane', '--user', 'telegram-admin', '--chat', 'cli:telegram-admin', '--session', 'cli-session-1'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gateway: services.gateway as any,
        memoryPlane: services.memoryPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Retomada e entregas do Zavorth');
    expect(writes[0]).toContain('gateway-summary.md');
  });

  it('renders the learning plane directly in the CLI and supports review actions', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const statusExitCode = await runZavorthCli(
      ['learning', 'candidates'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        learningPlane: services.learningPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    const promoteExitCode = await runZavorthCli(
      ['learning', 'promote', 'candidate:wf-1', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        learningPlane: services.learningPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(statusExitCode).toBe(0);
    expect(promoteExitCode).toBe(0);
    expect(services.learningPlane.buildSnapshot).toHaveBeenCalled();
    expect(services.learningPlane.executeAction).toHaveBeenCalledWith({
      candidateId: 'candidate:wf-1',
      actionId: 'promote',
    });
    expect(writes[0]).toContain('Learning do Zavorth');
    expect(writes[0]).toContain('Faca agora');
    expect(writes[0]).toContain('Ship playbook para workspace-a');
    expect(JSON.parse(writes[1] || '{}')).toEqual(
      expect.objectContaining({
        candidateId: 'candidate:wf-1',
        actionId: 'promote',
        ok: true,
      }),
    );
  });

  it('renders learning and memory metrics directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const learningExitCode = await runZavorthCli(
      ['learning', 'metrics'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        learningPlane: services.learningPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    const memoryExitCode = await runZavorthCli(
      ['memory', 'metrics', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        layeredMemory: services.layeredMemory as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(learningExitCode).toBe(0);
    expect(memoryExitCode).toBe(0);
    expect(services.learningPlane.readMetrics).toHaveBeenCalled();
    expect(services.layeredMemory.readMetrics).toHaveBeenCalled();
    expect(writes[0]).toContain('Metricas do learning');
    expect(writes[0]).toContain('Qualidade');
    expect(writes[0]).toContain('score medio: 0.88');
    expect(JSON.parse(writes[1] || '{}')).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalEntries: 5,
          pressure: 'ok',
        }),
        procedures: expect.objectContaining({
          learnedDraft: 1,
        }),
      }),
    );
  });

  it('renders layered memory status, search and procedures directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const statusExitCode = await runZavorthCli(
      ['memory', 'status'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        layeredMemory: services.layeredMemory as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );
    const searchExitCode = await runZavorthCli(
      ['memory', 'search', 'gateway release', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        layeredMemory: services.layeredMemory as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );
    const proceduresExitCode = await runZavorthCli(
      ['memory', 'procedures'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        layeredMemory: services.layeredMemory as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(statusExitCode).toBe(0);
    expect(searchExitCode).toBe(0);
    expect(proceduresExitCode).toBe(0);
    expect(services.layeredMemory.buildStatus).toHaveBeenCalled();
    expect(services.layeredMemory.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'gateway release',
      }),
    );
    expect(services.layeredMemory.readProcedures).toHaveBeenCalled();
    expect(writes[0]).toContain('Memoria do Zavorth');
    expect(writes[0]).toContain('Uso');
    expect(JSON.parse(writes[1] || '{}')).toEqual(
      expect.objectContaining({
        query: 'gateway release',
        total: 2,
      }),
    );
    expect(writes[2]).toContain('Procedimentos do Zavorth');
    expect(writes[2]).toContain('Inspect runtime');
  });

  it('renders phase 29 workspace memory review and follow-up resolution', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const reviewExitCode = await runZavorthCli(
      ['memory', 'review', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        workspaceMemoryOs: services.workspaceMemoryOs as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );
    const resolveExitCode = await runZavorthCli(
      ['memory', 'resolve', 'continua', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        workspaceMemoryOs: services.workspaceMemoryOs as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(reviewExitCode).toBe(0);
    expect(resolveExitCode).toBe(0);
    expect(services.workspaceMemoryOs.buildReview).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.any(String),
      }),
    );
    expect(services.workspaceMemoryOs.resolveFollowUp).toHaveBeenCalledWith(
      'continua',
      expect.objectContaining({
        userId: expect.any(String),
      }),
    );
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        phase: '29',
        surface: 'workspace-memory-os',
      }),
    );
    expect(JSON.parse(writes[1] || '{}')).toEqual(
      expect.objectContaining({
        phase: '29',
        surface: 'workspace-memory-resolution',
        intent: 'continue_task',
      }),
    );
  });

  it('supports phase 29 memory forget and correct actions', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const forgetExitCode = await runZavorthCli(
      ['memory', 'forget', 'idioma_preferido', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        workspaceMemoryOs: services.workspaceMemoryOs as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );
    const correctExitCode = await runZavorthCli(
      ['memory', 'correct', 'idioma_preferido', 'portugues', 'direto', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        workspaceMemoryOs: services.workspaceMemoryOs as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(forgetExitCode).toBe(0);
    expect(correctExitCode).toBe(0);
    expect(services.workspaceMemoryOs.executeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'forget',
        key: 'idioma_preferido',
      }),
    );
    expect(services.workspaceMemoryOs.executeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'correct',
        key: 'idioma_preferido',
        value: 'portugues direto',
      }),
    );
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        phase: '29',
        surface: 'workspace-memory-action',
        action: 'forget',
      }),
    );
    expect(JSON.parse(writes[1] || '{}')).toEqual(
      expect.objectContaining({
        phase: '29',
        surface: 'workspace-memory-action',
        action: 'correct',
      }),
    );
  });

  it('supports phase 30 self-heal preview, apply and daily report', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const previewExitCode = await runZavorthCli(
      ['heal', '--preview', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        selfHealControlPlane: services.selfHealControlPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );
    const applyExitCode = await runZavorthCli(
      ['heal', '--apply', '--budget', '5', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        selfHealControlPlane: services.selfHealControlPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );
    const reportExitCode = await runZavorthCli(
      ['heal', 'report', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        selfHealControlPlane: services.selfHealControlPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(previewExitCode).toBe(0);
    expect(applyExitCode).toBe(0);
    expect(reportExitCode).toBe(0);
    expect(services.selfHealControlPlane.buildPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        apply: false,
        requestedBy: expect.any(String),
      }),
    );
    expect(services.selfHealControlPlane.buildPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        apply: true,
        budget: 5,
        requestedBy: expect.any(String),
      }),
    );
    expect(services.selfHealControlPlane.buildDailyReport).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedBy: expect.any(String),
      }),
    );
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        phase: '30',
        surface: 'self-heal-control-plane',
        mode: 'preview',
      }),
    );
    expect(JSON.parse(writes[1] || '{}')).toEqual(
      expect.objectContaining({
        phase: '30',
        surface: 'self-heal-control-plane',
        mode: 'apply',
        status: 'blocked',
      }),
    );
    expect(JSON.parse(writes[2] || '{}')).toEqual(
      expect.objectContaining({
        phase: '30',
        surface: 'self-heal-control-plane',
        mode: 'daily-report',
      }),
    );
  });

  it('supports phase 31 release status, diff, rollback preview and presence', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const overrides = {
      releasePresenceControlPlane: services.releasePresenceControlPlane as any,
      commandService: { maybeHandle: jest.fn(async () => false) } as any,
    };

    const statusExitCode = await runZavorthCli(
      ['release', 'status', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      overrides,
    );
    const diffExitCode = await runZavorthCli(
      ['release', 'diff', 'previous', 'latest', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      overrides,
    );
    const rollbackExitCode = await runZavorthCli(
      ['release', 'rollback', '--preview', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      overrides,
    );
    const presenceExitCode = await runZavorthCli(
      ['release', 'presence', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      overrides,
    );

    expect(statusExitCode).toBe(0);
    expect(diffExitCode).toBe(0);
    expect(rollbackExitCode).toBe(0);
    expect(presenceExitCode).toBe(0);
    expect(services.releasePresenceControlPlane.buildStatus).toHaveBeenCalledWith(
      expect.objectContaining({ live: false }),
    );
    expect(services.releasePresenceControlPlane.buildDiff).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'previous', to: 'latest', live: false }),
    );
    expect(services.releasePresenceControlPlane.buildRollbackPreview).toHaveBeenCalledWith(
      expect.objectContaining({ preview: true, live: false }),
    );
    expect(services.releasePresenceControlPlane.buildRemotePresence).toHaveBeenCalledWith(
      expect.objectContaining({ live: false }),
    );
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        phase: '31',
        surface: 'release-presence-control-plane',
        mode: 'status',
      }),
    );
    expect(JSON.parse(writes[1] || '{}')).toEqual(
      expect.objectContaining({
        phase: '31',
        surface: 'release-presence-control-plane',
        mode: 'diff',
      }),
    );
    expect(JSON.parse(writes[2] || '{}')).toEqual(
      expect.objectContaining({
        phase: '31',
        surface: 'release-presence-control-plane',
        mode: 'rollback-preview',
      }),
    );
    expect(JSON.parse(writes[3] || '{}')).toEqual(
      expect.objectContaining({
        phase: '31',
        surface: 'release-presence-control-plane',
        mode: 'presence',
      }),
    );
  });

  it('renders the operator brief directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['brief'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        operatorBrief: services.operatorBrief as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.operatorBrief.readSnapshotFast).toHaveBeenCalled();
    expect(services.operatorBrief.readSnapshot).not.toHaveBeenCalled();
    expect(writes[0]).toContain('Briefing do operador');
    expect(writes[0]).toContain('Zavorth operavel');
  });

  it('supports live operator briefs directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['brief', '--live'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        operatorBrief: services.operatorBrief as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.operatorBrief.readSnapshotLive).toHaveBeenCalled();
    expect(services.operatorBrief.readSnapshotFast).not.toHaveBeenCalled();
    expect(writes[0]).toContain('Probe ao vivo confirmou');
  });

  it('supports ops as a native cockpit alias with json output', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        operationsCockpit: services.operationsCockpit as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.operationsCockpit.readSnapshotFast).toHaveBeenCalled();
    expect(services.operationsCockpit.readSnapshot).not.toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        status: 'attention',
        actions: expect.arrayContaining([
          expect.objectContaining({
            id: 'validate-node-mesh-smoke',
          }),
        ]),
      }),
    );
  });

  it('supports the phase 25 unified cockpit with status, doctor, brief, ops and delivery signals', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['cockpit', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gateway: services.gateway as any,
        memoryPlane: services.memoryPlane as any,
        nodeMesh: services.nodeMesh as any,
        operationsAction: services.operationsAction as any,
        operationsCockpit: services.operationsCockpit as any,
        operatorBrief: services.operatorBrief as any,
        platformRegistry: services.platformRegistry as any,
        runtimeAccessReadiness: services.runtimeAccessReadiness as any,
        sessionPlane: services.sessionPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    const parsed = JSON.parse(writes[0] || '{}');
    const humanActions = JSON.stringify(parsed.unified?.nextActions || []);

    expect(exitCode).toBe(0);
    expect(parsed).toEqual(
      expect.objectContaining({
        phase: '25',
        surface: 'zavorth-cockpit',
        status: 'attention',
        statusSnapshot: expect.any(Object),
        briefSnapshot: expect.any(Object),
        doctorSnapshot: expect.any(Object),
        unified: expect.objectContaining({
          posture: 'attention',
          memory: expect.objectContaining({
            artifacts: 3,
            replayTasks: 2,
            recentArtifact: 'gateway-summary.md',
          }),
          cards: expect.arrayContaining([
            expect.objectContaining({ id: 'state' }),
            expect.objectContaining({ id: 'operations' }),
            expect.objectContaining({ id: 'work' }),
            expect.objectContaining({ id: 'trust' }),
          ]),
        }),
      }),
    );
    expect(parsed.unified.nextActions.length).toBeGreaterThan(0);
    expect(humanActions).not.toMatch(/npm run/i);
    expect(services.operationsCockpit.readSnapshotFast).toHaveBeenCalled();
    expect(services.operatorBrief.readSnapshotFromCockpit).toHaveBeenCalled();
    expect(services.runtimeAccessReadiness.inspect).toHaveBeenCalled();
    expect(services.memoryPlane.buildSnapshot).toHaveBeenCalled();
    expect(services.operationsAction.listDefinitions).toHaveBeenCalled();
  });

  it('supports live cockpit probes from ops --live', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', '--live', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        operationsCockpit: services.operationsCockpit as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.operationsCockpit.readSnapshotLive).toHaveBeenCalled();
    expect(services.operationsCockpit.readSnapshotFast).not.toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        headline: 'Probe ao vivo confirmou 2 sinal(is) relevantes no runtime.',
      }),
    );
  });

  it('accepts --json and --live inline in REPL-style input', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: () => undefined,
      },
      runtime: {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
        gatewayService: services.gateway as any,
        operationsCockpitService: services.operationsCockpit as any,
        operatorBriefService: services.operatorBrief as any,
        platformRegistryService: services.platformRegistry as any,
        sessionPlaneService: services.sessionPlane as any,
      } as any,
    });

    const result = await cli.runOnce('status --json --live', {
      command: 'status',
      repl: true,
      json: false,
      live: false,
      userId: 'alice',
      platform: 'web',
      chatId: 'web:alice',
      sessionId: 'session-1',
      workspaceHint: null,
      commandText: 'status --json --live',
    });

    expect(result.ok).toBe(true);
    expect(services.operationsCockpit.readSnapshotLive).toHaveBeenCalled();
    expect(services.operatorBrief.readSnapshotFromCockpit).toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        headline: 'Zavorth operavel, mas com alguns pontos pedindo acompanhamento.',
        cockpit: expect.objectContaining({
          headline: 'Probe ao vivo confirmou 2 sinal(is) relevantes no runtime.',
        }),
      }),
    );
  });

  it('lists native operational actions from the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', 'actions'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        operationsCockpit: services.operationsCockpit as any,
        operationsAction: services.operationsAction as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.operationsAction.listDefinitions).toHaveBeenCalled();
    expect(writes[0]).toContain('Acoes operacionais do Zavorth');
    expect(writes[0]).toContain('validate-node-mesh-smoke');
  });

  it('runs native operational actions from the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', 'run', 'validate-node-mesh-smoke'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        operationsCockpit: services.operationsCockpit as any,
        operationsAction: services.operationsAction as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.operationsAction.execute).toHaveBeenCalledWith('validate-node-mesh-smoke');
    expect(writes[0]).toContain('Acao operacional do Zavorth');
    expect(writes[0]).toContain('test:nodes:smoke');
  });

  it('renders access readiness directly from ops access', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', 'access'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        runtimeAccessReadiness: services.runtimeAccessReadiness as any,
        learningPlane: services.learningPlane as any,
        layeredMemory: services.layeredMemory as any,
        platformRegistry: services.platformRegistry as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.runtimeAccessReadiness.inspect).toHaveBeenCalledWith(
      expect.objectContaining({
        learning: expect.objectContaining({
          summary: expect.objectContaining({
            pending: 1,
          }),
        }),
        layeredMemory: expect.objectContaining({
          summary: expect.objectContaining({
            procedural: 1,
          }),
        }),
        platform: expect.objectContaining({
          summary: expect.objectContaining({
            total: 3,
          }),
        }),
      }),
    );
    expect(writes[0]).toContain('Access readiness do Zavorth');
    expect(writes[0]).toContain('Zavorth pronto para uso local.');
  });

  it('renders access readiness as json from ops access --json', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', 'access', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        runtimeAccessReadiness: services.runtimeAccessReadiness as any,
        learningPlane: services.learningPlane as any,
        layeredMemory: services.layeredMemory as any,
        platformRegistry: services.platformRegistry as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.runtimeAccessReadiness.inspect).toHaveBeenCalledWith(expect.any(Object));
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        local: expect.objectContaining({
          ready: true,
        }),
        summary: expect.any(String),
      }),
    );
  });

  it('supports live access readiness probes from ops access --live', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', 'access', '--live'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        runtimeAccessReadiness: services.runtimeAccessReadiness as any,
        learningPlane: services.learningPlane as any,
        layeredMemory: services.layeredMemory as any,
        platformRegistry: services.platformRegistry as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.runtimeAccessReadiness.inspectLive).toHaveBeenCalledWith(expect.any(Object));
    expect(writes[0]).toContain('Live probe confirmou Zavorth pronto para uso local e remoto.');
  });

  it('renders the aggregated doctor directly from doctor', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const originalInspect = services.runtimeAccessReadiness.inspect.getMockImplementation()!;
    services.runtimeAccessReadiness.inspect.mockImplementation(() => {
      const report = originalInspect();
      return {
        ...report,
        summary: 'Zavorth ainda nao esta pronto para uso consistente.',
        local: {
          ...report.local,
          ready: false,
          appUrl: 'http://127.0.0.1:33333/control',
          issues: ['O host supervisor nao esta ativo.'],
        },
        remote: {
          ...report.remote,
          ready: false,
          appUrl: 'https://zavorth.example.com/control',
          issues: ['O host atual ainda nao foi autorizado para execucoes mutaveis.'],
        },
        nextSteps: [
          {
            id: 'start-supervised-host',
            title: 'Subir o host supervisionado',
            description: 'Suba o runtime supervisionado.',
            blocking: true,
          },
          {
            id: 'trust-host',
            title: 'Autorizar este host',
            description: 'Confie no host atual antes de mutacoes.',
            blocking: true,
          },
        ],
      };
    });

    const exitCode = await runZavorthCli(
      ['doctor'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        runtimeAccessReadiness: services.runtimeAccessReadiness as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.runtimeAccessReadiness.inspect).toHaveBeenCalled();
    expect(writes[0]).toContain('Diagnostico do Zavorth');
    expect(writes[0]).toContain('Agora');
    expect(writes[0]).toContain('Bloqueando agora');
    expect(writes[0]).toContain('Faca agora');
    expect(writes[0]).toContain('- A entrada local ainda nao esta pronta.');
    expect(writes[0]).toContain('- O acesso remoto esta parcialmente preparado.');
    expect(writes[0]).toContain('- O servico principal do Zavorth ainda nao subiu.');
    expect(writes[0]).toContain('- Este computador ainda nao foi liberado para o Zavorth fazer mudancas locais.');
    expect(writes[0]).toContain('- zavorth go');
    expect(writes[0]).toContain('- libere este computador para o Zavorth continuar.');
    expect(writes[0]).toContain('- Os canais de conversa principais ja estao prontos.');
    expect(writes[0]).toContain('- As conexoes remotas principais ja estao prontas.');
    expect(writes[0]).not.toContain('sessions:');
    expect(writes[0]).not.toContain('approvals:');
    expect(writes[0]).not.toContain('issue local:');
    expect(writes[0]).not.toContain('issue remota:');
    expect(writes[0]).not.toContain('/hostauth trust');
  });

  it('renders the operational security doctor directly from doctor security', async () => {
    const writes: string[] = [];
    const originalKey = process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY;
    const originalProfile = process.env.ZAVORTH_SECURITY_PROFILE;
    const originalPrivateEgress = process.env.ALLOW_PRIVATE_EGRESS_TARGETS;
    try {
      process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY = 'z'.repeat(64);
      process.env.ZAVORTH_SECURITY_PROFILE = 'professional';
      delete process.env.ALLOW_PRIVATE_EGRESS_TARGETS;

      const exitCode = await runZavorthCli(
        ['doctor', 'security'],
        {
          write: (value) => writes.push(value),
          error: () => undefined,
        },
        {
          commandService: { maybeHandle: jest.fn(async () => false) } as any,
        },
      );

      expect(exitCode).toBe(0);
      expect(writes[0]).toContain('[zavorth-security] security doctor');
      expect(writes[0]).toContain('perfil: Uso profissional');
      expect(writes[0]).toContain('dangerous-env-overrides');
    } finally {
      restoreEnvValue('ZAVORTH_TOOL_APPROVAL_SIGNING_KEY', originalKey);
      restoreEnvValue('ZAVORTH_SECURITY_PROFILE', originalProfile);
      restoreEnvValue('ALLOW_PRIVATE_EGRESS_TARGETS', originalPrivateEgress);
    }
  });

  it('renders the continuous security monitor directly from security continuous', async () => {
    const writes: string[] = [];
    const originalKey = process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY;
    const originalProfile = process.env.ZAVORTH_SECURITY_PROFILE;
    try {
      process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY = 'z'.repeat(64);
      process.env.ZAVORTH_SECURITY_PROFILE = 'professional';

      const exitCode = await runZavorthCli(
        ['security', 'continuous'],
        {
          write: (value) => writes.push(value),
          error: () => undefined,
        },
        {
          commandService: { maybeHandle: jest.fn(async () => false) } as any,
        },
      );

      expect(exitCode).toBe(0);
      expect(writes[0]).toContain('[zavorth-security] continuous security monitor');
      expect(writes[0]).toContain('security-baseline');
      expect(writes[0]).toContain('security-command-catalog');
    } finally {
      restoreEnvValue('ZAVORTH_TOOL_APPROVAL_SIGNING_KEY', originalKey);
      restoreEnvValue('ZAVORTH_SECURITY_PROFILE', originalProfile);
    }
  });

  it('renders operational security presets directly from security presets', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(
      ['security', 'presets'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('[zavorth-security] presets operacionais');
    expect(writes[0]).toContain('personal:');
    expect(writes[0]).toContain('professional:');
    expect(writes[0]).toContain('enterprise:');
  });

  it('previews an operational security preset without applying files', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(
      ['security', 'preset', 'enterprise'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('[zavorth-security] preset preview');
    expect(writes[0]).toContain('enterprise:');
    expect(writes[0]).toContain('Aplicar: zavorth security preset enterprise --apply');
  });

  it('renders the operator brief directly from brief', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['brief'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        operatorBrief: services.operatorBrief as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.operatorBrief.readSnapshotFast).toHaveBeenCalled();
    expect(writes[0]).toContain('Briefing do operador');
    expect(writes[0]).toContain('Zavorth operavel, mas com alguns pontos pedindo acompanhamento.');
  });

  it('keeps the human doctor output free from startup chatter', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const originalInspect = services.runtimeAccessReadiness.inspect.getMockImplementation()!;
    services.runtimeAccessReadiness.inspect.mockImplementation((input: any) => {
      console.info('[INFO] [ContextEngine] inicializando runtime...');
      console.debug('[BOOT] context-engine-ready');
      return originalInspect(input);
    });

    const chatter = await captureConsoleChatter(async () => {
      const exitCode = await runZavorthCli(
        ['doctor'],
        {
          write: (value) => writes.push(value),
          error: () => undefined,
        },
        {
          runtimeAccessReadiness: services.runtimeAccessReadiness as any,
          commandService: { maybeHandle: jest.fn(async () => false) } as any,
        },
      );

      expect(exitCode).toBe(0);
    });

    expect(writes[0]).toMatch(/^Diagnostico do Zavorth/);
    expect(chatter.join('\n')).not.toContain('[INFO] [ContextEngine]');
    expect(chatter.join('\n')).not.toContain('[BOOT] context-engine-ready');
  });

  it('maps token and configuration gaps to zavorth setup in the doctor action block', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const originalInspect = services.runtimeAccessReadiness.inspect.getMockImplementation()!;
    services.runtimeAccessReadiness.inspect.mockImplementation(() => {
      const report = originalInspect();
      return {
        ...report,
        remote: {
          ...report.remote,
          ready: false,
          issues: ['Falta token web para liberar o shell remoto.'],
        },
        nextSteps: [],
      };
    });

    const exitCode = await runZavorthCli(
      ['doctor'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        runtimeAccessReadiness: services.runtimeAccessReadiness as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Faca agora');
    expect(writes[0]).toContain('- zavorth setup');
  });

  it('renders the aggregated doctor as json from ops doctor --json', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', 'doctor', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        runtimeAccessReadiness: services.runtimeAccessReadiness as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.runtimeAccessReadiness.inspect).toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        local: expect.objectContaining({
          ready: true,
        }),
        channelProviders: expect.objectContaining({
          status: 'passed',
          validated: 2,
          total: 2,
        }),
        remoteTransports: expect.objectContaining({
          status: 'passed',
          healthy: 2,
          total: 2,
        }),
      }),
    );
  });

  it('renders ops quality directly in the CLI and exposes budgets/gates as json', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', 'quality', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        operationsHealth: services.operationsHealth as any,
        learningPlane: services.learningPlane as any,
        layeredMemory: services.layeredMemory as any,
        platformRegistry: services.platformRegistry as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.operationsHealth.readSnapshotFast).toHaveBeenCalled();
    expect(services.learningPlane.readMetrics).toHaveBeenCalled();
    expect(services.layeredMemory.readMetrics).toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        score: expect.any(Number),
        healthy: true,
        gate: expect.objectContaining({
          state: 'warn',
          allowsPromotion: true,
          allowsPublishing: false,
          warnings: expect.arrayContaining([
            expect.stringContaining('candidatos aprendidos pendentes'),
          ]),
        }),
        summary: expect.objectContaining({
          recoveryState: 'ready',
          learningPending: 1,
          memoryPressure: 'ok',
        }),
        learning: expect.objectContaining({
          totalCandidates: 1,
          averageScore: 0.88,
        }),
        memory: expect.objectContaining({
          totalEntries: 5,
          pressure: 'ok',
        }),
        platform: expect.objectContaining({
          total: 3,
          trusted: 2,
        }),
      }),
    );
  });

  it('renders bootstrap readiness directly from ops bootstrap', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', 'bootstrap'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        runtimeBootstrap: services.runtimeBootstrap as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.runtimeBootstrap.inspect).toHaveBeenCalled();
    expect(writes[0]).toContain('Bootstrap do Zavorth');
  });

  it('supports bootstrap repair dry-run directly from the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', 'bootstrap', 'repair', 'dryrun'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        runtimeBootstrapRepair: services.runtimeBootstrapRepair as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.runtimeBootstrapRepair.repair).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
      }),
    );
    expect(writes[0]).toContain('Bootstrap repair do Zavorth');
    expect(writes[0]).toContain('dry-run: sim');
  });

  it('renders supervised runtime changes directly from ops changes', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', 'changes'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        supervisedRuntime: services.supervisedRuntime as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.supervisedRuntime.summarizeRecentChanges).toHaveBeenCalled();
    expect(writes[0]).toContain('Mudancas e estado do Zavorth');
  });

  it('requests supervised reload directly from ops reload force', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['ops', 'reload', 'force'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        supervisedRuntime: services.supervisedRuntime as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.supervisedRuntime.requestReload).toHaveBeenCalledWith(
      expect.objectContaining({
        forceRestart: true,
      }),
    );
    expect(writes[0]).toContain('Reload supervisionado do Zavorth');
    expect(writes[0]).toContain('aceito');
  });

  it('supports native autorepair status and dry-run from ops autorepair', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const statusExitCode = await runZavorthCli(
      ['ops', 'autorepair', 'status'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        autoRepair: services.autoRepair as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    const dryRunExitCode = await runZavorthCli(
      ['ops', 'autorepair', 'dryrun'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        autoRepair: services.autoRepair as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(statusExitCode).toBe(0);
    expect(dryRunExitCode).toBe(0);
    expect(services.autoRepair.summarizeLastRun).toHaveBeenCalled();
    expect(services.autoRepair.run).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
      }),
    );
    expect(writes).toEqual(expect.arrayContaining([
      expect.stringContaining('Autoreparo do Zavorth'),
      expect.stringContaining('Autorepair auto'),
    ]));
  });

  it('supports sessionplane as a native alias for the session overview', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['sessionplane'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        sessionPlane: services.sessionPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.sessionPlane.renderOverviewReport).toHaveBeenCalled();
    expect(writes[0]).toContain('Conversas do Zavorth');
    expect(writes[0]).toContain('conversa atual: cli-session-');
    expect(writes[0]).toContain('abrir replay: history cli-session-');
    expect(writes[0]).toContain('proximo passo: use history <sessionId> para abrir uma conversa especifica.');
    expect(writes[0]).toContain('trocar no chat: use cli-session-');
    expect(writes[0]).toContain('Session plane overview');
  });

  it('sends to another session directly from the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['sessionsend', 'session-1', '--', 'ola'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        sessionPlane: services.sessionPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.sessionPlane.sendToSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        chatId: 'web:session-1',
        text: 'ola',
      }),
    );
    expect(writes[0]).toContain('Mensagem enviada para outra sessao');
    expect(writes[0]).toContain('task-123');
  });

  it('spawns derived sessions directly from the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['sessionspawn', 'web'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        sessionPlane: services.sessionPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.sessionPlane.spawnSession).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'web',
      }),
    );
    expect(writes[0]).toContain('Nova sessao pronta');
    expect(writes[0]).toContain('/open-session session-new');
  });

  it('renders the node mesh snapshot directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['nodes', 'node-alpha'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodeMesh: services.nodeMesh as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.nodeMesh.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedNodeId: 'node-alpha',
      }),
    );
    expect(writes[0]).toContain('Node Mesh do Zavorth');
    expect(writes[0]).toContain('Node em foco');
    expect(writes[0]).toContain('Node Alpha');
    expect(writes[0]).toContain('files.watch');
  });

  it('renders the node mesh queue directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['nodes', 'queue', 'node-alpha'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodeMesh: services.nodeMesh as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.nodeMesh.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedNodeId: 'node-alpha',
      }),
    );
    expect(writes[0]).toContain('Fila do Node Mesh');
    expect(writes[0]).toContain('Agora');
    expect(writes[0]).toContain('Invocacoes em foco');
    expect(writes[0]).toContain('files.watch');
    expect(writes[0]).toContain('fila: 1 pendente');
  });

  it('renders the node mesh history directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['nodes', 'history', 'node-alpha'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodeMesh: services.nodeMesh as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.nodeMesh.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedNodeId: 'node-alpha',
      }),
    );
    expect(writes[0]).toContain('Historico do Node Mesh');
    expect(writes[0]).toContain('Invocacoes em foco');
    expect(writes[0]).toContain('browser.proxy');
    expect(writes[0]).toContain('Endpoint confirmado.');
  });

  it('lists node profiles directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['nodes', 'profiles'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodeMesh: services.nodeMesh as any,
        nodeDeviceProfiles: services.nodeDeviceProfiles as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.nodeDeviceProfiles.listProfiles).toHaveBeenCalled();
    expect(writes[0]).toContain('Perfis do Node Mesh');
    expect(writes[0]).toContain('Headless Worker');
    expect(writes[0]).toContain('zavorth nodes pair headless');
  });

  it('lists node capabilities directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['nodes', 'capabilities'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodeMesh: services.nodeMesh as any,
        nodeCapabilities: services.nodeCapabilities as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.nodeCapabilities.listCatalog).toHaveBeenCalled();
    expect(writes[0]).toContain('Capabilities do Node Mesh');
    expect(writes[0]).toContain('Files Watch');
    expect(writes[0]).toContain('proximo passo');
  });

  it('renders the node mesh doctor directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['nodes', 'doctor'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodeMesh: services.nodeMesh as any,
        runtimeAccessReadiness: services.runtimeAccessReadiness as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.runtimeAccessReadiness.inspect).toHaveBeenCalled();
    expect(writes[0]).toContain('Doctor do Node Mesh');
    expect(writes[0]).toContain('status: passed');
    expect(writes[0]).toContain('Revalidar Node Mesh');
  });

  it('keeps node json output machine-readable even if runtime code tries to log to stdout', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    services.nodeMesh.buildSnapshot.mockImplementation(() => {
      console.log('NOISE SHOULD NOT LEAK');
      return {
        generatedAt: '2026-04-04T16:00:00.000Z',
        summary: {
          total: 1,
          paired: 1,
          pending: 0,
          online: 1,
          offline: 0,
          invokable: 1,
          capabilities: 2,
          queued: 0,
          completedRecently: 1,
        },
        entries: [],
        selected: null,
        capabilityCatalog: [],
        deviceProfiles: [],
        recommendedProfiles: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh pronto.',
          operatorSummary: 'Snapshot limpo.',
        },
      };
    });

    try {
      const exitCode = await runZavorthCli(
        ['nodes', '--json'],
        {
          write: (value) => writes.push(value),
          error: () => undefined,
        },
        {
          nodeMesh: services.nodeMesh as any,
          commandService: { maybeHandle: jest.fn(async () => false) } as any,
        },
      );

      expect(exitCode).toBe(0);
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(JSON.parse(writes[0] || '{}')).toEqual(
        expect.objectContaining({
          summary: expect.objectContaining({
            total: 1,
            online: 1,
          }),
        }),
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('creates node pairing drafts directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['nodepair', 'browser', 'Node', 'Browser'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodePairing: services.nodePairing as any,
        nodeDeviceProfiles: services.nodeDeviceProfiles as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.nodeDeviceProfiles.resolveProfile).toHaveBeenCalledWith('browser-companion', 'browser');
    expect(services.nodePairing.createPairingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'browser-companion',
        label: 'Node Browser',
      }),
    );
    expect(writes[0]).toContain('Node pronto para pareamento');
    expect(writes[0]).toContain('Node Browser');
    expect(writes[0]).toContain('PAIR-123');
    expect(writes[0]).toContain('npm run nodes:host -- --base-url http://127.0.0.1:33333');
  });

  it('queues node invocations directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['nodeinvoke', 'node-alpha', 'browser.proxy', 'open', '{"url":"https://example.com"}'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodeInvoke: services.nodeInvoke as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.nodeInvoke.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'node-alpha',
        capabilityId: 'browser.proxy',
        action: 'open',
        payload: {
          url: 'https://example.com',
        },
      }),
    );
    expect(writes[0]).toContain('Invocacao enviada ao Node Mesh');
    expect(writes[0]).toContain('invoke-node-1');
  });

  it('renders the tool surface directly in the CLI for humans', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['tools'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        toolSurface: services.toolSurface as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Ferramentas do Zavorth');
    expect(writes[0]).toContain('Agora');
    expect(writes[0]).toContain('Familias em foco');
    expect(writes[0]).toContain('Faca agora');
  });

  it('keeps the polished human surfaces free from internal visual noise', async () => {
    const cases: Array<{
      args: string[];
      runtime: Record<string, unknown>;
    }> = [
      {
        args: ['brief'],
        runtime: {
          operatorBrief: createStubServices().operatorBrief as any,
          commandService: { maybeHandle: jest.fn(async () => false) } as any,
        },
      },
      {
        args: ['ops'],
        runtime: {
          operationsCockpit: createStubServices().operationsCockpit as any,
          commandService: { maybeHandle: jest.fn(async () => false) } as any,
        },
      },
      {
        args: ['nodes'],
        runtime: {
          nodeMesh: createStubServices().nodeMesh as any,
          commandService: { maybeHandle: jest.fn(async () => false) } as any,
        },
      },
      {
        args: ['tools'],
        runtime: {
          toolSurface: createStubServices().toolSurface as any,
          commandService: { maybeHandle: jest.fn(async () => false) } as any,
        },
      },
    ];

    const outputs: string[] = [];
    for (const entry of cases) {
      const writes: string[] = [];
      const exitCode = await runZavorthCli(
        entry.args,
        {
          write: (value) => writes.push(value),
          error: () => undefined,
        },
        entry.runtime as any,
      );
      expect(exitCode).toBe(0);
      outputs.push(writes.join('\n'));
    }

    const combined = outputs.join('\n\n---\n\n');
    expect(combined).not.toMatch(/\bsidecars?\b/i);
    expect(combined).not.toMatch(/\bCockpit\b/i);
    expect(combined).not.toMatch(/\bcontrol plane\b/i);
    expect(combined).not.toMatch(/familias de tools/i);
    expect(combined).not.toMatch(/\bzavorth ops run\b/i);
    expect(combined).not.toMatch(/\bnpm run ops:/i);
    expect(combined).not.toMatch(/item\(ns\)|pendente\(s\)|n\/d|claimed/i);
  });

  it('renders the tool surface directly in the CLI with json support', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['tools', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        toolSurface: services.toolSurface as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.toolSurface.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.any(String),
      }),
    );
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          families: 9,
          explicitTools: 27,
        }),
      }),
    );
  });

  it('renders the hook plane directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['hookplane'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        hookPlane: services.hookPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.hookPlane.buildSnapshot).toHaveBeenCalled();
    expect(writes[0]).toContain('Hooks do Zavorth');
    expect(writes[0]).toContain('Eventos em foco');
    expect(writes[0]).toContain('3 hooks registrados');
  });

  it('renders the Zavorth-owned AIGateway route directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['AIGateway', 'route'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        AIGatewayGateway: services.AIGatewayGateway as any,
        AIGatewayGatewayLauncher: services.AIGatewayGatewayLauncher as any,
        AIGatewayCompatibilityDoctor: services.AIGatewayCompatibilityDoctor as any,
        AIGatewayUpstreamSync: services.AIGatewayUpstreamSync as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.AIGatewayGateway.readStatus).toHaveBeenCalled();
    expect(writes[0]).toContain('Rota do AIGateway');
    expect(writes[0]).toContain('Malha');
    expect(writes[0]).toContain('http://127.0.0.1:21128/v1');
  });

  it('runs the AIGateway compatibility doctor directly in the CLI with json output', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['AIGateway', 'doctor', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        AIGatewayGateway: services.AIGatewayGateway as any,
        AIGatewayGatewayLauncher: services.AIGatewayGatewayLauncher as any,
        AIGatewayCompatibilityDoctor: services.AIGatewayCompatibilityDoctor as any,
        AIGatewayUpstreamSync: services.AIGatewayUpstreamSync as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.AIGatewayCompatibilityDoctor.run).toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        status: 'passed',
        checkedTarget: 'http://127.0.0.1:21128/v1/models',
      }),
    );
  });

  it('supports promote on the AIGateway upstream sync directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['AIGateway', 'promote', '--no-rollback'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        AIGatewayGateway: services.AIGatewayGateway as any,
        AIGatewayGatewayLauncher: services.AIGatewayGatewayLauncher as any,
        AIGatewayCompatibilityDoctor: services.AIGatewayCompatibilityDoctor as any,
        AIGatewayUpstreamSync: services.AIGatewayUpstreamSync as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.AIGatewayUpstreamSync.promote).toHaveBeenCalledWith({
      autoRollback: false,
    });
    expect(writes[0]).toContain('Sync do AIGateway');
    expect(writes[0]).toContain('acao: promote');
  });

  it('starts the Zavorth-owned AIGateway route directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['AIGateway', 'start', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        AIGatewayGateway: services.AIGatewayGateway as any,
        AIGatewayGatewayLauncher: services.AIGatewayGatewayLauncher as any,
        AIGatewayCompatibilityDoctor: services.AIGatewayCompatibilityDoctor as any,
        AIGatewayUpstreamSync: services.AIGatewayUpstreamSync as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.AIGatewayGatewayLauncher.ensureStarted).toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        ready: true,
        baseUrl: 'http://127.0.0.1:21128/v1',
      }),
    );
  });

  it('renders the platform plane directly in the CLI with json support', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['platform', 'skill:playwright-interactive', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        platformRegistry: services.platformRegistry as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.platformRegistry.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'skill:playwright-interactive',
        query: 'skill:playwright-interactive',
      }),
    );
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        selected: expect.objectContaining({
          id: 'skill:playwright-interactive',
          trust: 'review',
        }),
        collections: expect.arrayContaining([
          expect.objectContaining({
            id: 'collection:ui-debug',
          }),
        ]),
      }),
    );
  });

  it('supports selecting curated platform collections directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['platform', 'collection:ui-debug'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        platformRegistry: services.platformRegistry as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Platform do Zavorth');
    expect(writes[0]).toContain('Colecao em foco');
    expect(writes[0]).toContain('UI Debug');
    expect(writes[0]).toContain('2 adotados');
  });

  it('supports platform sync directly in the CLI with json output', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['platform', 'sync', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        platformRegistry: services.platformRegistry as any,
        platformCatalogSync: services.platformCatalogSync as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.platformCatalogSync.sync).toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        status: 'ready',
        recipeCount: 1,
      }),
    );
  });

  it('executes native platform lifecycle actions from the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['platform', 'install', 'collection:ui-debug'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        platformRegistry: services.platformRegistry as any,
        platformAction: services.platformAction as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.platformAction.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        entryId: 'collection:ui-debug',
        actionId: 'install',
      }),
    );
    expect(writes[0]).toContain('Acao de platform aplicada');
    expect(writes[0]).toContain('UI Debug');
  });

  it('supports platform publish directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['platform', 'publish', 'C:/tmp/sql-analyzer'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        platformRegistry: services.platformRegistry as any,
        platformPublisher: services.platformPublisher as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.platformPublisher.publishDetailed).toHaveBeenCalledWith(
      expect.objectContaining({
        packagePath: 'C:/tmp/sql-analyzer',
        signLocal: true,
      }),
    );
    expect(writes[0]).toContain('Publish do platform pronto');
    expect(writes[0]).toContain('@example/sql-analyzer@1.2.3');
  });

  it('dispatches free-text input through the shared task dispatcher when no native command handles it', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const commandService = {
      maybeHandle: jest.fn(async () => false),
    };

    const exitCode = await runZavorthCli(
      ['faÃ§a uma revisÃ£o deste mÃ³dulo'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
        surfaceTaskDispatcher: services.surfaceTaskDispatcher as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(commandService.maybeHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        rawText: 'faÃ§a uma revisÃ£o deste mÃ³dulo',
      }),
    );
    expect(services.surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'faÃ§a uma revisÃ£o deste mÃ³dulo',
        sessionId: expect.any(String),
      }),
    );
    const dispatchInput = (services.surfaceTaskDispatcher.dispatchTaskMessage as jest.Mock).mock.calls[0][0];
    expect(writes[0]).toContain('Pedido: faÃ§a uma revisÃ£o deste mÃ³dulo');
    expect(writes[0]).toContain('Zavorth: Recebi esse pedido e ja comecei a trabalhar.');
    expect(writes[0]).toContain('task: task-cli-123');
    expect(writes[0]).toContain(`sessao: ${dispatchInput.sessionId}`);
  });

  it('routes natural CLI conversations through the unified gateway before the legacy dispatcher', async () => {
    const writes: string[] = [];
    const dispatcher = {
      dispatchTaskMessage: jest.fn(),
    };
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async (event: any) => {
        await event.reply('Resposta pelo gateway unificado na CLI.');
        return {
          responseText: 'Resposta pelo gateway unificado na CLI.',
          surface: event.surface,
          intentCategory: 'delegated',
          firewallStats: 'delegated',
          fastModelSuggested: false,
        };
      }),
    };

    const exitCode = await runZavorthCli(
      ['review', 'this', 'module'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
        legacyUnifiedGateway: legacyUnifiedGateway as any,
        surfaceTaskDispatcher: dispatcher as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(legacyUnifiedGateway.handleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: 'web',
        text: 'review this module',
        metadata: expect.objectContaining({
          channel: 'cli',
          phase: 'legacy-unified-cli-v1',
          cli: true,
        }),
      }),
    );
    expect(dispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(writes[0]).toContain('Pedido: review this module');
    expect(writes[0]).toContain('Zavorth: Resposta pelo gateway unificado na CLI.');
  });

  it('routes task aliases through the unified gateway when the CLI ingress is available', async () => {
    const writes: string[] = [];
    const dispatcher = {
      dispatchTaskMessage: jest.fn(),
    };
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async (event: any) => {
        await event.reply('Vou retomar isso pelo gateway unificado.');
        return {
          responseText: 'Vou retomar isso pelo gateway unificado.',
          surface: event.surface,
          intentCategory: 'delegated',
          firewallStats: 'delegated',
          fastModelSuggested: false,
        };
      }),
    };

    const exitCode = await runZavorthCli(
      ['continue'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
        legacyUnifiedGateway: legacyUnifiedGateway as any,
        surfaceTaskDispatcher: dispatcher as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(legacyUnifiedGateway.handleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '/task continue',
      }),
    );
    expect(dispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
    expect(writes[0]).toContain('Pedido: continue');
    expect(writes[0]).toContain('Zavorth: Vou retomar isso pelo gateway unificado.');
  });

  it('normalizes task-prefixed input into slash task dispatch for the CLI harness', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['task', 'continuar a anÃ¡lise do gateway'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
        surfaceTaskDispatcher: services.surfaceTaskDispatcher as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '/task continuar a anÃ¡lise do gateway',
      }),
    );
    const dispatchInput = (services.surfaceTaskDispatcher.dispatchTaskMessage as jest.Mock).mock.calls[0][0];
    expect(writes[0]).toContain('Pedido: continuar a anÃ¡lise do gateway');
    expect(writes[0]).toContain('Zavorth: Vou retomar isso agora.');
    expect(writes[0]).toContain('comando: /task');
    expect(writes[0]).toContain(`sessao: ${dispatchInput.sessionId}`);
  });

  it('dispatches run alias through the shared task dispatcher', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const commandService = {
      maybeHandle: jest.fn(async () => false),
    };

    const exitCode = await runZavorthCli(
      ['run', 'fechar', 'o', 'briefing'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
        surfaceTaskDispatcher: services.surfaceTaskDispatcher as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '/task fechar o briefing',
      }),
    );
    const dispatchInput = (services.surfaceTaskDispatcher.dispatchTaskMessage as jest.Mock).mock.calls[0][0];
    expect(writes[0]).toContain('Pedido: fechar o briefing');
    expect(writes[0]).toContain('Zavorth: Recebi esse pedido e ja comecei a trabalhar.');
    expect(writes[0]).toContain('task: task-cli-123');
    expect(writes[0]).toContain(`sessao: ${dispatchInput.sessionId}`);
  });

  it('dispatches continue alias through the shared task dispatcher', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const commandService = {
      maybeHandle: jest.fn(async () => false),
    };

    const exitCode = await runZavorthCli(
      ['continue'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
        surfaceTaskDispatcher: services.surfaceTaskDispatcher as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.surfaceTaskDispatcher.dispatchTaskMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '/task continue',
      }),
    );
    const dispatchInput = (services.surfaceTaskDispatcher.dispatchTaskMessage as jest.Mock).mock.calls[0][0];
    expect(writes[0]).toContain('Pedido: continue');
    expect(writes[0]).toContain('Zavorth: Vou retomar isso agora.');
    expect(writes[0]).toContain('status: Zavorth ja comecou a retomar esse trabalho.');
    expect(writes[0]).toContain(`continue daqui: zavorth --session ${dispatchInput.sessionId} continue`);
  });

  it('keeps the continuation hint even when the runtime already replies immediately', async () => {
    const writes: string[] = [];
    const dispatcher = {
      dispatchTaskMessage: jest.fn(async (input: any) => {
        await input.ctx.reply('Ja recuperei o contexto desta conversa.');
        return {
          task: { task_id: 'task-cli-immediate' },
          parsed: { command_type: '/task' },
          runtimeUserId: 'alice',
          sourceUserId: input.sourceUserId || 'session-2',
          tenantId: null,
          tenantContext: null,
        };
      }),
    };

    const exitCode = await runZavorthCli(
      ['run', 'retomar', 'o', 'briefing'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
        surfaceTaskDispatcher: dispatcher as any,
      },
    );

    expect(exitCode).toBe(0);
    const dispatchInput = (dispatcher.dispatchTaskMessage as jest.Mock).mock.calls[0][0];
    expect(writes[0]).toContain('Resposta imediata do runtime:');
    expect(writes[0]).toContain('Ja recuperei o contexto desta conversa.');
    expect(writes[0]).toContain(`continue daqui: zavorth --session ${dispatchInput.sessionId} continue`);
  });

  it('routes approve alias through the shared slash-command surface', async () => {
    const writes: string[] = [];
    const commandService = {
      maybeHandle: jest.fn(async (ctx: any) => {
        await ctx.reply(`handled ${ctx.rawText}`);
        return true;
      }),
    };

    const exitCode = await runZavorthCli(
      ['approve', 'task-123', 'pin=123456'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
        hookPlane: false as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(commandService.maybeHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        rawText: '/approve task-123 pin=123456',
      }),
    );
    expect(writes[0]).toContain('Pedido: approve task-123 pin=123456');
    expect(writes[0]).toContain('Zavorth: Aprovacao enviada ao Zavorth');
    expect(writes[0]).toContain('comando: /approve task-123 pin=123456');
  });

  it('routes workflow continuity aliases through the shared slash-command surface', async () => {
    const writes: string[] = [];
    const commandService = {
      maybeHandle: jest.fn(async (ctx: any) => {
        await ctx.reply(`handled ${ctx.rawText}`);
        return true;
      }),
    };

    const exitCode = await runZavorthCli(
      ['resume', 'wf-ship-abc123', 'review'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
        hookPlane: false as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(commandService.maybeHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        rawText: '/workflow resume wf-ship-abc123 review',
      }),
    );
    expect(writes[0]).toContain('Pedido: workflow resume wf-ship-abc123 review');
    expect(writes[0]).toContain('Zavorth: Retomada de workflow enviada');
    expect(writes[0]).toContain('comando: /workflow resume wf-ship-abc123 review');
  });

  it('still reports unsupported commands when neither native handlers nor task dispatcher are available', async () => {
    const writes: string[] = [];
    const errors: string[] = [];

    const exitCode = await runZavorthCli(
      ['foo', 'bar'],
      {
        write: (value) => writes.push(value),
        error: (value) => errors.push(value),
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(1);
    expect(writes).toEqual([]);
    expect(errors[0]).toContain('Comando nao suportado neste CLI');
  });

  it('prefers the native tools surface when it is available in the CLI runtime', async () => {
    const writes: string[] = [];
    const commandService = {
      maybeHandle: jest.fn(async (ctx: any) => {
        await ctx.reply(`handled ${ctx.rawText}`);
        return true;
      }),
    };

    const exitCode = await runZavorthCli(
      ['tools', 'read_file'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(commandService.maybeHandle).not.toHaveBeenCalled();
    expect(writes[0]).toContain('Ferramentas do Zavorth');
    expect(writes[0]).toContain('Faca agora');
  });

  it('normalizes transports commands into slash commands for the shared surface', async () => {
    const writes: string[] = [];
    const commandService = {
      maybeHandle: jest.fn(async (ctx: any) => {
        await ctx.reply(`handled ${ctx.rawText}`);
        return true;
      }),
    };

    const exitCode = await runZavorthCli(
      ['transports', 'node-host'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(commandService.maybeHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        rawText: '/transports node-host',
      }),
    );
    expect(writes[0]).toContain('handled /transports node-host');
  });

  it('normalizes channel parity commands into slash commands for the shared surface', async () => {
    const writes: string[] = [];
    const commandService = {
      maybeHandle: jest.fn(async (ctx: any) => {
        await ctx.reply(`handled ${ctx.rawText}`);
        return true;
      }),
    };

    const exitCode = await runZavorthCli(
      ['channels', 'parity', 'whatsapp'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(commandService.maybeHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        rawText: '/channels parity whatsapp',
      }),
    );
    expect(writes[0]).toContain('handled /channels parity whatsapp');
  });

  it('normalizes agmobile commands into slash commands for the shared surface', async () => {
    const writes: string[] = [];
    const commandService = {
      maybeHandle: jest.fn(async (ctx: any) => {
        await ctx.reply(`handled ${ctx.rawText}`);
        return true;
      }),
    };

    const exitCode = await runZavorthCli(
      ['agmobile', 'status'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(commandService.maybeHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        rawText: '/agmobile status',
      }),
    );
    expect(writes[0]).toContain('handled /agmobile status');
  });

  it('prefers the native hooks surface when it is available in the CLI runtime', async () => {
    const writes: string[] = [];
    const commandService = {
      maybeHandle: jest.fn(async (ctx: any) => {
        await ctx.reply(`handled ${ctx.rawText}`);
        return true;
      }),
    };

    const exitCode = await runZavorthCli(
      ['hooks', 'transport'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: commandService as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(commandService.maybeHandle).not.toHaveBeenCalled();
    expect(writes[0]).toContain('Hooks do Zavorth');
    expect(writes[0]).toContain('Eventos em foco');
  });

  it('routes gateway status through the public Gateway Control snapshot', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['gateway', 'status', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gatewayControl: services.gatewayControl as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.gatewayControl.buildGatewayControlApiSnapshot).toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        mode: 'gateway_control_status',
        contractVersion: '2026-04-27.p2-006h',
        providers: expect.objectContaining({
          summary: expect.objectContaining({
            ready: 1,
            total: 2,
          }),
        }),
      }),
    );
  });

  it('lists Gateway Control providers without exposing secrets', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['gateway', 'providers', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gatewayControl: services.gatewayControl as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      mode: 'gateway_control_providers',
      providers: expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({
            id: 'openai',
            apiKey: '[redacted]',
          }),
        ]),
      }),
    }));
    expect(writes[0]).not.toContain('sk-');
  });

  it('renders Gateway Control models in human output', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['gateway', 'models'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gatewayControl: services.gatewayControl as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Gateway Control');
    expect(writes[0]).toContain('Models');
    expect(writes[0]).toContain('gpt-5.2');
    expect(writes[0]).toContain('provider=openai');
  });

  it('reads Gateway Control combos through the public snapshot', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['gateway', 'combos', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gatewayControl: services.gatewayControl as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.gatewayControl.buildGatewayControlApiSnapshot).toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(expect.objectContaining({
      mode: 'gateway_control_combos',
      resource: 'combos',
      combos: expect.objectContaining({
        status: 'delegated',
        sourceRoutes: expect.arrayContaining(['/api/combos/test']),
        entries: expect.arrayContaining([
          expect.objectContaining({ id: 'default-combo' }),
        ]),
      }),
      operations: expect.arrayContaining([
        expect.objectContaining({
          id: 'combos.list',
          requiresApproval: false,
        }),
        expect.objectContaining({
          id: 'combos.validate',
          requiresApproval: true,
        }),
      ]),
    }));
  });

  it('prepares Gateway Control combo tests without bypassing approval', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['gateway', 'combo', 'test', 'default-combo', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gatewayControl: services.gatewayControl as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      mode: 'gateway_control_combo_test',
      resource: 'combos.validate',
      status: 'approval_required',
      comboName: 'default-combo',
      request: {
        comboName: 'default-combo',
      },
      operation: expect.objectContaining({
        id: 'combos.validate',
        path: '/api/gateway-control/combos/validate',
        requiresApproval: true,
      }),
      approval: expect.objectContaining({
        required: true,
        satisfied: false,
      }),
      equivalentRoutes: expect.arrayContaining(['/api/combos/test']),
    }));
    expect(writes[0]).not.toContain('secret');
  });

  it('returns a structured Gateway Control combo test usage error when the id is missing', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['gateway', 'combo', 'test', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gatewayControl: services.gatewayControl as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(writes[0] || '{}')).toEqual(expect.objectContaining({
      mode: 'gateway_control_combo_test',
      resource: 'combos.validate',
      status: 'invalid',
      comboName: null,
      errors: expect.arrayContaining(['Uso: zavorth gateway combo test <id>.']),
    }));
  });

  it('reads Gateway Control cache stats through the public snapshot', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['gateway', 'cache', 'stats', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gatewayControl: services.gatewayControl as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.gatewayControl.buildGatewayControlApiSnapshot).toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(expect.objectContaining({
      mode: 'gateway_control_cache_stats',
      resource: 'cache.stats',
      cache: expect.objectContaining({
        status: 'delegated',
        sourceRoutes: expect.arrayContaining(['/api/cache/stats']),
      }),
      operations: expect.arrayContaining([
        expect.objectContaining({
          id: 'cache.stats',
          requiresApproval: false,
        }),
      ]),
    }));
  });

  it('renders Gateway Control rate limits in human output', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['gateway', 'rate-limits'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gatewayControl: services.gatewayControl as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Gateway Control');
    expect(writes[0]).toContain('Rate limits');
    expect(writes[0]).toContain('/api/rate-limits');
    expect(writes[0]).toContain('rate-limits.list');
  });

  it('exposes Gateway Control doctor as a read-only health summary', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['gateway', 'doctor', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        gatewayControl: services.gatewayControl as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      mode: 'gateway_control_doctor',
      health: expect.objectContaining({
        status: 'ready',
      }),
      cache: expect.objectContaining({
        status: 'delegated',
      }),
      rateLimits: expect.objectContaining({
        status: 'delegated',
      }),
      operations: expect.arrayContaining([
        expect.objectContaining({ id: 'health.read' }),
        expect.objectContaining({ id: 'cache.stats' }),
        expect.objectContaining({ id: 'rate-limits.list' }),
      ]),
    }));
    expect(writes[0]).not.toContain('secret');
  });

  it('supports grouped session aliases directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const historyExitCode = await runZavorthCli(
      ['sessions', 'history', 'session-web-1'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        sessionPlane: services.sessionPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    const sendExitCode = await runZavorthCli(
      ['sessions', 'send', 'session-1', '--', 'ola'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        sessionPlane: services.sessionPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    const spawnExitCode = await runZavorthCli(
      ['sessions', 'spawn', 'web'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        sessionPlane: services.sessionPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(historyExitCode).toBe(0);
    expect(sendExitCode).toBe(0);
    expect(spawnExitCode).toBe(0);
    expect(services.sessionPlane.renderHistoryReport).toHaveBeenCalled();
    expect(writes[0]).toContain('Historico da conversa');
    expect(writes[0]).toContain('proximo passo: zavorth --session session-web-1 continue');
    expect(writes[0]).toContain('replay: history session-web-1');
    expect(services.sessionPlane.sendToSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        chatId: 'web:session-1',
        text: 'ola',
      }),
    );
    expect(services.sessionPlane.spawnSession).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'web',
      }),
    );
  });

  it('supports grouped node aliases directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const listExitCode = await runZavorthCli(
      ['nodes', 'list', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodeMesh: services.nodeMesh as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    const pairExitCode = await runZavorthCli(
      ['nodes', 'pair', 'browser', 'Node', 'Browser'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        nodePairing: services.nodePairing as any,
        nodeDeviceProfiles: services.nodeDeviceProfiles as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(listExitCode).toBe(0);
    expect(pairExitCode).toBe(0);
    expect(services.nodeMesh.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedNodeId: null,
      }),
    );
    expect(services.nodeDeviceProfiles.resolveProfile).toHaveBeenCalledWith('browser-companion', 'browser');
    expect(services.nodePairing.createPairingDraft).toHaveBeenCalled();
  });

  it('supports grouped plugin aliases directly in the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const listExitCode = await runZavorthCli(
      ['plugins', 'list', 'skill:playwright-interactive', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        platformRegistry: services.platformRegistry as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    const doctorExitCode = await runZavorthCli(
      ['plugins', 'doctor', 'collection:ui-debug'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        platformRegistry: services.platformRegistry as any,
        platformAction: services.platformAction as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(listExitCode).toBe(0);
    expect(doctorExitCode).toBe(0);
    expect(services.platformRegistry.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'skill:playwright-interactive',
        query: 'skill:playwright-interactive',
      }),
    );
    expect(services.platformAction.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        entryId: 'collection:ui-debug',
        actionId: 'doctor',
      }),
    );
  });

  it('renders the plugin catalog directly in the CLI for humans', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['plugins', 'list', 'collection:ui-debug'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        platformRegistry: services.platformRegistry as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Platform do Zavorth');
    expect(writes[0]).toContain('Colecao em foco');
    expect(writes[0]).toContain('UI Debug');
    expect(writes[0]).toContain('zavorth platform collection:ui-debug');
  });

  it('keeps plugins list in overview mode compact even if the registry preselects an item', async () => {
    const writes: string[] = [];
    const services = createStubServices();
    const originalBuildSnapshot = services.platformRegistry.buildSnapshot.getMockImplementation()!;

    services.platformRegistry.buildSnapshot.mockImplementation(({ selectedId, query }: any = {}) => {
      const snapshot = originalBuildSnapshot({ selectedId, query });
      return {
        ...snapshot,
        summary: {
          ...snapshot.summary,
          total: 4,
          collections: 3,
          recipes: 3,
        },
        entries: [
          ...snapshot.entries,
          {
            id: 'skill:slack-outgoing-message',
            label: 'slack-outgoing-message',
            kind: 'skill',
            readiness: 'ready',
            trust: 'trusted',
            installState: 'installed',
            summary: 'Skill para saida Slack.',
            actionHint: 'Ativar skill slack-outgoing-message',
            details: ['Canal de mensagens pronto.'],
          },
        ],
        collections: [
          ...snapshot.collections,
          {
            id: 'collection:runtime-ops',
            label: 'Runtime Ops',
            source: 'registry:local-catalog',
            summary: 'Colecao para operacao do runtime.',
            actionHint: '/platform collection:runtime-ops',
            featured: true,
            itemCount: 3,
            readyCount: 2,
            adoptedCount: 1,
            missingCount: 1,
            kinds: ['plugin', 'skill'],
            tags: ['ops'],
            capabilities: ['runtime'],
            details: ['Pack: runtime-ops'],
            entryIds: ['plugin:openrouter'],
            searchText: 'collection runtime ops',
            items: [],
          },
          {
            id: 'collection:identity',
            label: 'Identity',
            source: 'registry:local-catalog',
            summary: 'Colecao para identidade.',
            actionHint: '/platform collection:identity',
            featured: false,
            itemCount: 2,
            readyCount: 1,
            adoptedCount: 1,
            missingCount: 0,
            kinds: ['skill'],
            tags: ['identity'],
            capabilities: ['identity'],
            details: ['Pack: identity'],
            entryIds: ['skill:slack-outgoing-message'],
            searchText: 'collection identity',
            items: [],
          },
        ],
        recipes: [
          ...snapshot.recipes,
          {
            id: 'recipe:runtime-ops-bootstrap',
            label: 'Runtime Ops Bootstrap',
            summary: 'Recipe para subir a operacao.',
            actionHint: '/platform recipe:runtime-ops-bootstrap',
            itemCount: 2,
            readyCount: 1,
            adoptedCount: 1,
            steps: ['Ative Runtime Ops.'],
          },
          {
            id: 'recipe:identity-bootstrap',
            label: 'Identity Bootstrap',
            summary: 'Recipe para identidade.',
            actionHint: '/platform recipe:identity-bootstrap',
            itemCount: 1,
            readyCount: 1,
            adoptedCount: 0,
            steps: ['Ative Identity.'],
          },
        ],
        selected: {
          id: 'plugin:openrouter',
          label: 'OpenRouter',
          kind: 'plugin',
          readiness: 'ready',
          trust: 'trusted',
          installState: 'installed',
          summary: 'Gateway remoto pronto.',
          actionHint: '/integrations openrouter',
          details: ['Pack: remote-gateways'],
        },
      };
    });

    const exitCode = await runZavorthCli(
      ['plugins', 'list'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        platformRegistry: services.platformRegistry as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Platform do Zavorth');
    expect(writes[0]).not.toContain('Item em foco');
    expect(writes[0]).toContain('Colecoes em foco');
    expect(writes[0]).toContain('Recipes em foco');
    expect(writes[0]).toContain('Itens em foco');
    expect(writes[0]).toContain('OpenRouter [plugin] ready/installed | trust trusted');
    expect(writes[0]).toContain('+1 outra colecao no catalogo');
    expect(writes[0]).toContain('+1 outra recipe no catalogo');
    expect(writes[0]).toContain('+1 outro item no catalogo');
  });

  it('runs the REPL banner and exits cleanly on quit while persisting history', async () => {
    const writes: string[] = [];
    const question = jest.fn(async () => 'quit');
    const close = jest.fn();
    const historyFile = path.resolve(config.projectRoot, 'data', 'runtime', 'zavorth-cli-history.txt');
    const historyExists = fs.existsSync(historyFile);
    const previousHistory = historyExists ? fs.readFileSync(historyFile, 'utf8') : null;

    try {
      const cli = new ZavorthCli({
        writer: {
          line: (text: string) => writes.push(text),
          error: () => undefined,
        },
        readlineFactory: () =>
          ({
            history: [],
            question,
            close,
          }) as any,
      });

      const exitCode = await cli.runRepl({
        command: null,
        repl: true,
        json: false,
        live: false,
        userId: 'alice',
        platform: 'web',
        chatId: 'web:alice',
        sessionId: 'session-1',
        workspaceHint: null,
        commandText: null,
      });

      expect(exitCode).toBe(0);
      expect(question).toHaveBeenCalledWith('> ');
      expect(close).toHaveBeenCalled();
      expect(fs.readFileSync(historyFile, 'utf8')).toContain('quit');
      expect(writes.join('\n')).toContain('Zavorth');
      expect(writes.join('\n')).toContain('gemini-2.5-flash - conversa natural');
      expect(writes.join('\n')).not.toContain('v1.0.0');
      expect(writes.join('\n')).not.toContain('Gemini - conversa natural');
      expect(writes.join('\n')).toContain('Oi. Eu estou pronto para ajudar. Escreva um pedido simples, do seu jeito.');
      expect(writes.join('\n')).toContain('Sugestoes');
      expect(writes.join('\n')).toContain('revisar este modulo');
      expect(writes.join('\n')).toContain('retome o que estavamos fazendo');
      expect(writes.join('\n')).toContain('? atalhos: status | doctor | history | new | quit');
      expect(writes.join('\n')).toContain('status');
      expect(writes.join('\n')).toContain('doctor');
      expect(writes.join('\n')).toContain('quit');
      expect(writes.join('\n')).toContain('Dica');
      expect(writes.join('\n')).toContain('Nao precisa decorar comando. Texto livre vira pedido automaticamente.');
      expect(writes.join('\n')).not.toContain('nodes invoke');
    } finally {
      if (previousHistory !== null) {
        fs.writeFileSync(historyFile, previousHistory, 'utf8');
      } else if (fs.existsSync(historyFile)) {
        fs.unlinkSync(historyFile);
      }
    }
  });

  it('renders short chat help inside the REPL without dispatching a task', async () => {
    const writes: string[] = [];
    const question = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('?')
      .mockResolvedValueOnce('help')
      .mockResolvedValueOnce('/help')
      .mockResolvedValueOnce('quit');
    const close = jest.fn();
    const commandService = { maybeHandle: jest.fn(async () => false) };

    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: () => undefined,
      },
      runtime: {
        commandService: commandService as any,
        gatewayService: createStubServices().gateway as any,
      } as any,
      readlineFactory: () =>
        ({
          history: [],
          question,
          close,
        }) as any,
    });

    const exitCode = await cli.runRepl({
      command: null,
      repl: true,
      json: false,
      live: false,
      userId: 'alice',
      platform: 'web',
      chatId: 'web:alice',
      sessionId: 'session-1',
      workspaceHint: null,
      commandText: null,
    });

    const output = writes.join('\n');
    expect(exitCode).toBe(0);
    expect(question).toHaveBeenNthCalledWith(1, '> ');
    expect(question).toHaveBeenNthCalledWith(4, '> ');
    expect(output.match(/\? Atalhos do chat/g)?.length).toBe(3);
    expect(output).toContain('status   ver se esta tudo certo');
    expect(output).toContain('doctor   corrigir algo que travou');
    expect(output).toContain('history  ver conversas recentes');
    expect(output).toContain('new      comecar conversa nova');
    expect(output).toContain('quit     sair');
    expect(output).toContain('Dica: voce tambem pode escrever qualquer pedido em texto livre.');
    expect(output).not.toContain('Referencia completa da CLI do Zavorth');
    expect(output).not.toContain('Comando nao suportado neste CLI');
    expect(commandService.maybeHandle).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('opens a new conversation inside the REPL without leaving the terminal shell', async () => {
    const writes: string[] = [];
    const question = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('new')
      .mockResolvedValueOnce('context')
      .mockResolvedValueOnce('quit');
    const close = jest.fn();

    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: () => undefined,
      },
      readlineFactory: () =>
        ({
          history: [],
          question,
          close,
        }) as any,
    });

    const exitCode = await cli.runRepl({
      command: null,
      repl: true,
      json: false,
      live: false,
      userId: 'alice',
      platform: 'web',
      chatId: 'web:alice',
      sessionId: 'session-1',
      workspaceHint: null,
      commandText: null,
    });

    expect(exitCode).toBe(0);
    expect(question).toHaveBeenNthCalledWith(1, '> ');
    expect(question).toHaveBeenNthCalledWith(2, '> ');
    expect(question).toHaveBeenNthCalledWith(3, '> ');
    expect(close).toHaveBeenCalled();
    expect(writes.join('\n')).toContain('Nova conversa pronta');
    expect(writes.join('\n')).toContain('Voce continua no mesmo terminal.');
    expect(writes.join('\n')).toContain('Escreva seu pedido quando quiser.');
    expect(writes.join('\n')).toContain('Para revisar depois:');
    expect(writes.join('\n')).toContain('history cli-session-');
    expect(writes.join('\n')).toContain('Contexto do terminal Zavorth');
  });

  it('switches to an existing conversation inside the REPL without leaving the terminal shell', async () => {
    const writes: string[] = [];
    const question = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('switch session-web-77')
      .mockResolvedValueOnce('context')
      .mockResolvedValueOnce('quit');
    const close = jest.fn();

    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: () => undefined,
      },
      readlineFactory: () =>
        ({
          history: [],
          question,
          close,
        }) as any,
    });

    const exitCode = await cli.runRepl({
      command: null,
      repl: true,
      json: false,
      live: false,
      userId: 'alice',
      platform: 'web',
      chatId: 'web:session-1',
      sessionId: 'session-1',
      workspaceHint: null,
      commandText: null,
    });

    expect(exitCode).toBe(0);
    expect(question).toHaveBeenNthCalledWith(1, '> ');
    expect(question).toHaveBeenNthCalledWith(2, '> ');
    expect(question).toHaveBeenNthCalledWith(3, '> ');
    expect(close).toHaveBeenCalled();
    expect(writes.join('\n')).toContain('Conversa retomada');
    expect(writes.join('\n')).toContain('Voce continua no mesmo terminal.');
    expect(writes.join('\n')).toContain('Escreva continue ou mande um novo pedido.');
    expect(writes.join('\n')).toContain('Para revisar depois:');
    expect(writes.join('\n')).toContain('history session-web-77');
    expect(writes.join('\n')).toContain('Contexto do terminal Zavorth');
  });

  it('opens an existing conversation inside the REPL with a natural open alias', async () => {
    const writes: string[] = [];
    const question = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('open session-web-88')
      .mockResolvedValueOnce('context')
      .mockResolvedValueOnce('quit');
    const close = jest.fn();

    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: () => undefined,
      },
      readlineFactory: () =>
        ({
          history: [],
          question,
          close,
        }) as any,
    });

    const exitCode = await cli.runRepl({
      command: null,
      repl: true,
      json: false,
      live: false,
      userId: 'alice',
      platform: 'web',
      chatId: 'web:session-1',
      sessionId: 'session-1',
      workspaceHint: null,
      commandText: null,
    });

    expect(exitCode).toBe(0);
    expect(question).toHaveBeenNthCalledWith(1, '> ');
    expect(question).toHaveBeenNthCalledWith(2, '> ');
    expect(question).toHaveBeenNthCalledWith(3, '> ');
    expect(close).toHaveBeenCalled();
    expect(writes.join('\n')).toContain('Conversa retomada');
    expect(writes.join('\n')).toContain('Para revisar depois:');
    expect(writes.join('\n')).toContain('history session-web-88');
  });

  it('keeps chat flows free from runtime chatter inside the REPL shell', async () => {
    const writes: string[] = [];
    const question = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('continue')
      .mockResolvedValueOnce('quit');
    const close = jest.fn();
    const runtime = {
      commandService: { maybeHandle: jest.fn(async () => false) } as any,
      gatewayService: createStubServices().gateway as any,
      surfaceTaskDispatcher: {
        dispatchTaskMessage: jest.fn(async (input: any) => {
          console.log('ðŸ’¾ [V3] Database SQLite inicializado com better-sqlite3...');
          console.info('[BOOT] tools-ready');
          await input.ctx.reply(`task dispatched ${input.text}`);
          return {
            task: { task_id: 'task-repl-noise-free' },
            parsed: { command_type: '/task' },
            runtimeUserId: 'alice',
            sourceUserId: input.sourceUserId || input.sessionId || 'session-1',
            tenantId: null,
            tenantContext: null,
          };
        }),
      } as any,
    };

    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: () => undefined,
      },
      runtime: runtime as any,
      readlineFactory: () =>
        ({
          history: [],
          question,
          close,
        }) as any,
    });

    const chatter = await captureConsoleChatter(async () => {
      const exitCode = await cli.runRepl({
        command: null,
        repl: true,
        json: false,
        live: false,
        userId: 'alice',
        platform: 'web',
        chatId: 'web:session-1',
        sessionId: 'session-1',
        workspaceHint: null,
        commandText: null,
      });

      expect(exitCode).toBe(0);
    });

    expect(writes.join('\n')).toContain('Zavorth');
    expect(writes.join('\n')).toContain('* Pronto');
    expect(writes.join('\n')).toContain('Vou retomar isso agora.');
    expect(chatter.join('\n')).not.toContain('Database SQLite');
    expect(chatter.join('\n')).not.toContain('[BOOT] tools-ready');
  });

  it('keeps REPL replies chat-first without re-echoing the user line in output', async () => {
    const writes: string[] = [];
    const question = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('continue')
      .mockResolvedValueOnce('quit');
    const close = jest.fn();
    const runtime = {
      commandService: { maybeHandle: jest.fn(async () => false) } as any,
      gatewayService: createStubServices().gateway as any,
      surfaceTaskDispatcher: {
        dispatchTaskMessage: jest.fn(async (input: any) => {
          await input.ctx.reply(`task dispatched ${input.text}`);
          return {
            task: { task_id: 'task-repl-1' },
            parsed: { command_type: '/task' },
            runtimeUserId: 'alice',
            sourceUserId: input.sourceUserId || input.sessionId || 'session-1',
            tenantId: null,
            tenantContext: null,
          };
        }),
      } as any,
    };

    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: () => undefined,
      },
      runtime: runtime as any,
      readlineFactory: () =>
        ({
          history: [],
          question,
          close,
        }) as any,
    });

    const exitCode = await cli.runRepl({
      command: null,
      repl: true,
      json: false,
      live: false,
      userId: 'alice',
      platform: 'web',
      chatId: 'web:session-1',
      sessionId: 'session-1',
      workspaceHint: null,
      commandText: null,
    });

    expect(exitCode).toBe(0);
    expect(writes.join('\n')).toContain('* Pronto');
    expect(writes.join('\n')).toContain('Vou retomar isso agora.');
    expect(writes.join('\n')).toContain('Para revisar depois:');
    expect(writes.join('\n')).toContain('history session-1');
    expect(writes.join('\n')).not.toContain('Pedido: continue');
    expect(writes.join('\n')).not.toContain('Zavorth: Vou retomar isso agora.');
    expect(writes.join('\n')).not.toContain('- task:');
    expect(writes.join('\n')).not.toContain('- comando: /task');
    expect(writes.join('\n')).not.toContain('Resposta imediata do runtime:');
  });

  it('keeps shared slash-command replies compact inside the REPL shell', async () => {
    const writes: string[] = [];
    const question = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('approve task-123')
      .mockResolvedValueOnce('quit');
    const close = jest.fn();
    const runtime = {
      commandService: {
        maybeHandle: jest.fn(async (ctx: any) => {
          await ctx.reply(`handled ${ctx.rawText}`);
          return true;
        }),
      } as any,
      gatewayService: createStubServices().gateway as any,
    };

    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: () => undefined,
      },
      runtime: runtime as any,
      readlineFactory: () =>
        ({
          history: [],
          question,
          close,
        }) as any,
    });

    const exitCode = await cli.runRepl({
      command: null,
      repl: true,
      json: false,
      live: false,
      userId: 'alice',
      platform: 'web',
      chatId: 'web:session-1',
      sessionId: 'session-1',
      workspaceHint: null,
      commandText: null,
    });

    expect(exitCode).toBe(0);
    expect(writes.join('\n')).toContain('* Pronto');
    expect(writes.join('\n')).toContain('Aprovacao enviada ao Zavorth');
    expect(writes.join('\n')).not.toContain('Pedido: approve task-123');
    expect(writes.join('\n')).not.toContain('Zavorth: Aprovacao enviada ao Zavorth');
    expect(writes.join('\n')).not.toContain('- comando: /approve task-123');
    expect(writes.join('\n')).not.toContain('Resposta imediata do runtime:');
  });

  it('renders approval requests as warning cards inside the REPL shell', async () => {
    const writes: string[] = [];
    const question = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('precisa aprovar')
      .mockResolvedValueOnce('quit');
    const close = jest.fn();
    const runtime = {
      commandService: {
        maybeHandle: jest.fn(async (ctx: any) => {
          await ctx.reply('Aprovacao necessaria para editar arquivos. Use approve task-123 pin=654321.');
          return true;
        }),
      } as any,
      gatewayService: createStubServices().gateway as any,
    };

    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: () => undefined,
      },
      runtime: runtime as any,
      readlineFactory: () =>
        ({
          history: [],
          question,
          close,
        }) as any,
    });

    const exitCode = await cli.runRepl({
      command: null,
      repl: true,
      json: false,
      live: false,
      userId: 'alice',
      platform: 'web',
      chatId: 'web:session-1',
      sessionId: 'session-1',
      workspaceHint: null,
      commandText: null,
    });

    expect(exitCode).toBe(0);
    expect(writes.join('\n')).toContain('! Preciso da sua aprovacao');
    expect(writes.join('\n')).toContain('Aprovar:');
    expect(writes.join('\n')).toContain('approve task-123 pin=654321');
    expect(writes.join('\n')).not.toContain('Zavorth: ');
  });

  it('renders recoverable REPL failures as action cards', async () => {
    const writes: string[] = [];
    const question = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce('revisar este modulo')
      .mockResolvedValueOnce('quit');
    const close = jest.fn();
    const runtime = {
      commandService: { maybeHandle: jest.fn(async () => false) } as any,
      gatewayService: createStubServices().gateway as any,
      surfaceTaskDispatcher: {
        dispatchTaskMessage: jest.fn(async () => {
          throw new Error('runtime indisponivel');
        }),
      } as any,
    };

    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: () => undefined,
      },
      runtime: runtime as any,
      readlineFactory: () =>
        ({
          history: [],
          question,
          close,
        }) as any,
    });

    const exitCode = await cli.runRepl({
      command: null,
      repl: true,
      json: false,
      live: false,
      userId: 'alice',
      platform: 'web',
      chatId: 'web:session-1',
      sessionId: 'session-1',
      workspaceHint: null,
      commandText: null,
    });

    expect(exitCode).toBe(0);
    expect(writes.join('\n')).toContain('! Algo travou');
    expect(writes.join('\n')).toContain('runtime indisponivel');
    expect(writes.join('\n')).toContain('Tente isto:');
    expect(writes.join('\n')).toContain('doctor');
  });

  it('routes history alias to session history rendering', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['history', 'session-web-1'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        sessionPlane: services.sessionPlane as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.sessionPlane.renderHistoryReport).toHaveBeenCalled();
    expect(writes[0]).toContain('Historico da conversa');
    expect(writes[0]).toContain('proximo passo: zavorth --session session-web-1 continue');
    expect(writes[0]).toContain('replay: history session-web-1');
    expect(writes[0]).toContain('Session plane history');
  });

  it('supports capabilities list as the phase 26 registry surface', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['capabilities', 'list', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        capabilityOs: services.capabilityOs as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.capabilityOs.buildSnapshot).toHaveBeenCalled();
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        phase: '26',
        surface: 'capability-os',
      }),
    );
  });

  it('supports capabilities route with explainable fallback', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['capabilities', 'route', 'pesquise', 'noticias', 'de', 'IA', 'na', 'web', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        capabilityOs: services.capabilityOs as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.capabilityOs.explainRoute).toHaveBeenCalledWith(
      'pesquise noticias de IA na web',
      expect.objectContaining({
        commandType: '/task',
        sourceSurface: 'cli',
        writeLedger: true,
      }),
    );
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        phase: '26',
        surface: 'capability-route',
        fallbackChain: ['research', 'conversation'],
      }),
    );
  });

  it('supports tasks list as the phase 27 task operating system surface', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['tasks', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        taskOperatingSystem: services.taskOperatingSystem as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.taskOperatingSystem.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.any(String),
      }),
    );
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        phase: '27',
        surface: 'task-os',
      }),
    );
  });

  it('supports artifacts by task through the phase 27 artifact surface', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['artifacts', 'task', 'task-phase-27', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        taskOperatingSystem: services.taskOperatingSystem as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.taskOperatingSystem.listArtifactsForTask).toHaveBeenCalledWith('task-phase-27');
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        phase: '27',
        surface: 'task-artifacts',
      }),
    );
  });

  it('supports standardized task resume plans from the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['tasks', 'resume', 'task-phase-27', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        taskOperatingSystem: services.taskOperatingSystem as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.taskOperatingSystem.buildContinuationPlan).toHaveBeenCalledWith('task-phase-27', 'resume');
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        phase: '27',
        surface: 'task-continuation',
        expectedState: 'running',
      }),
    );
  });

  it('supports supervisor graph planning as the phase 28 surface', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['supervisor', 'plan', 'corrija', 'um', 'bug', 'e', 'rode', 'os', 'testes', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        supervisorGraph: services.supervisorGraph as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.supervisorGraph.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        objective: 'corrija um bug e rode os testes',
        userId: expect.any(String),
      }),
    );
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        phase: '28',
        surface: 'supervisor-graph',
        mode: 'graph',
      }),
    );
  });

  it('passes supervisor graph budget and failure simulation flags through the CLI', async () => {
    const writes: string[] = [];
    const services = createStubServices();

    const exitCode = await runZavorthCli(
      ['graph', 'plan', 'corrija', 'testes', '--simulate-test-failure', '--max-cost', '1', '--max-retries=1', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        supervisorGraph: services.supervisorGraph as any,
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(services.supervisorGraph.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        objective: 'corrija testes',
        simulateTestFailure: true,
        maxCost: 1,
        maxRetries: 1,
      }),
    );
    expect(JSON.parse(writes[0] || '{}')).toEqual(
      expect.objectContaining({
        phase: '28',
        surface: 'supervisor-graph',
      }),
    );
  });

  it('dispatches CLI task flows without attaching a Telegram chat context', async () => {
    const writes: string[] = [];
    const dispatcher = {
      dispatchTaskMessage: jest.fn(async (input: any) => {
        await input.ctx.reply(`task dispatched ${input.text}`);
        return {
          task: { task_id: 'task-cli-chatless' },
          parsed: { command_type: '/task' },
          runtimeUserId: 'alice',
          sourceUserId: input.sourceUserId || 'cli-session',
          tenantId: null,
          tenantContext: null,
        };
      }),
    };

    const exitCode = await runZavorthCli(
      ['review', 'this', 'module'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
        surfaceTaskDispatcher: dispatcher as any,
      },
    );

    expect(exitCode).toBe(0);
    const dispatchInput = (dispatcher.dispatchTaskMessage as jest.Mock).mock.calls[0][0];
    expect(dispatchInput.ctx.chat).toBeUndefined();
    expect(writes[0]).toContain('Pedido: review this module');
    expect(writes[0]).toContain('Zavorth: Recebi esse pedido e ja comecei a trabalhar.');
    expect(writes[0]).toContain('task: task-cli-chatless');
    expect(writes[0]).toContain(`sessao: ${dispatchInput.sessionId}`);
  });

  it('routes natural CLI chat through the universal agent gateway before the legacy gateway', async () => {
    const writes: string[] = [];
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T10:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-cli-universal`,
    });
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async (input: any) => {
        await input.reply('Analise iniciada pelo gateway universal.');
        return {
          responseText: 'Analise iniciada pelo gateway universal.',
          surface: input.surface,
          intentCategory: 'analysis',
        };
      }),
    };
    const dispatcher = {
      dispatchTaskMessage: jest.fn(async (input: any) => {
        await input.ctx.reply('Analise iniciada pelo AgentGateway canonico.');
        return {
          task: { task_id: 'task-cli-universal' },
          parsed: { command_type: '/task' },
          runtimeUserId: 'cli-user',
          sourceUserId: input.sourceUserId || 'cli-operator',
          tenantId: null,
          tenantContext: null,
        };
      }),
    };

    const exitCode = await runZavorthCli(
      ['review', 'this', 'module', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
        agentGateway,
        legacyUnifiedGateway,
        surfaceTaskDispatcher: dispatcher as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(dispatcher.dispatchTaskMessage).toHaveBeenCalledWith(expect.objectContaining({
      text: 'review this module',
    }));
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      mode: 'universal_agent_runtime',
      status: 'completed',
      summary: 'Pedido encaminhado pelo runtime universal para execucao supervisionada.',
      metadata: expect.objectContaining({
        delegatedTo: 'surface_task_dispatcher',
        taskId: 'task-cli-universal',
      }),
    }));
    expect(payload.metadata).toEqual(expect.objectContaining({
      legacyUnifiedGatewayAvailable: true,
      legacyUnifiedGatewayBypassed: true,
    }));
    expect(payload.toolExposure.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'read_file',
          requiresApproval: false,
        }),
      ]),
    );
  });

  it('holds risky CLI tool requests at the universal approval gate', async () => {
    const writes: string[] = [];
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T10:05:00.000Z'),
      idFactory: (prefix) => `${prefix}-cli-approval`,
    });
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async () => ({
        responseText: 'nao deveria executar',
        surface: 'web',
        intentCategory: 'execution',
      })),
    };

    const exitCode = await runZavorthCli(
      ['corrija', 'o', 'arquivo', 'e', 'rode', 'os', 'testes', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
        agentGateway,
        legacyUnifiedGateway,
      },
    );

    expect(exitCode).toBe(0);
    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      mode: 'universal_agent_runtime',
      status: 'waiting_approval',
    }));
    expect(payload.approvals).toEqual([
      expect.objectContaining({
        status: 'pending',
        risk: 'danger',
      }),
    ]);
    expect(payload.toolExposure.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'write_file', requiresApproval: true }),
        expect.objectContaining({ id: 'shell.exec', requiresApproval: true }),
      ]),
    );
  });

  it('approves a pending universal CLI run and resumes it through the gateway', async () => {
    const writes: string[] = [];
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T10:10:00.000Z'),
      idFactory: (prefix) => `${prefix}-cli-resume`,
    });
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async (input: any) => {
        await input.reply('Continuei depois da aprovacao universal.');
        return {
          responseText: 'Continuei depois da aprovacao universal.',
          surface: input.surface,
          intentCategory: 'execution',
        };
      }),
    };
    const dispatcher = {
      dispatchTaskMessage: jest.fn(async (input: any) => {
        await input.ctx.reply('Continuei depois da aprovacao pelo dispatcher canonico.');
        return {
          task: { task_id: 'task-cli-resume' },
          parsed: { command_type: '/task' },
          runtimeUserId: 'cli-user',
          sourceUserId: input.sourceUserId || 'cli-operator',
          tenantId: null,
          tenantContext: null,
        };
      }),
    };
    const services = {
      commandService: { maybeHandle: jest.fn(async () => false) } as any,
      agentGateway,
      legacyUnifiedGateway,
      surfaceTaskDispatcher: dispatcher as any,
    };

    const firstExitCode = await runZavorthCli(
      ['corrija', 'o', 'arquivo', 'e', 'rode', 'os', 'testes', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      services,
    );
    const pending = JSON.parse(writes.shift() || '{}');
    const approvalId = pending.approvals[0].id;

    const approveExitCode = await runZavorthCli(
      ['approve', approvalId, '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      services,
    );

    expect(firstExitCode).toBe(0);
    expect(approveExitCode).toBe(0);
    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(dispatcher.dispatchTaskMessage).toHaveBeenCalledTimes(1);
    const approved = JSON.parse(writes[0] || '{}');
    expect(approved).toEqual(expect.objectContaining({
      ok: true,
      mode: 'universal_agent_runtime_approval',
      decision: 'approved',
      resumed: true,
      status: 'completed',
    }));
    expect(approved.replies[0]).toEqual(expect.objectContaining({
      text: 'Continuei depois da aprovacao pelo dispatcher canonico.',
    }));
  });

  it('shows the durable universal workflow queue status from the CLI', async () => {
    const writes: string[] = [];
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T10:15:00.000Z'),
      idFactory: (prefix) => `${prefix}-cli-workflow-status`,
    });

    const pending = await agentGateway.handle({
      userId: 'cli-operator',
      channel: 'cli',
      sessionId: 'cli-session-workflow-status',
      text: 'corrija o arquivo e rode os testes',
      requestedTools: ['write_file', 'shell.exec'],
      metadata: {
        originalInput: 'corrija o arquivo e rode os testes',
      },
    });
    await agentGateway.approve(pending.run.approvals[0].id);

    const exitCode = await runZavorthCli(
      ['workflows', 'status', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
        agentGateway,
      },
    );

    expect(exitCode).toBe(0);
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      mode: 'workflow_queue_status',
      counts: expect.objectContaining({
        queued: 1,
      }),
      queue: expect.objectContaining({
        version: 'agent-workflow-queue-store/v1',
      }),
    }));
    expect(payload.jobs).toEqual([
      expect.objectContaining({
        status: 'queued',
        runId: pending.run.id,
      }),
    ]);
  });

  it('processes queued universal workflows from the CLI worker surface', async () => {
    const writes: string[] = [];
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T10:20:00.000Z'),
      idFactory: (prefix) => `${prefix}-cli-workflow-process`,
    });
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async (input: any) => {
        await input.reply('Workflow retomado pelo worker da CLI.');
        return {
          responseText: 'Workflow retomado pelo worker da CLI.',
          surface: input.surface,
          intentCategory: 'execution',
        };
      }),
    };
    const dispatcher = {
      dispatchTaskMessage: jest.fn(async (input: any) => {
        await input.ctx.reply('Workflow retomado pelo dispatcher canonico.');
        return {
          task: { task_id: 'task-cli-workflow-process' },
          parsed: { command_type: '/task' },
          runtimeUserId: 'cli-user',
          sourceUserId: input.sourceUserId || 'cli-operator',
          tenantId: null,
          tenantContext: null,
        };
      }),
    };

    const pending = await agentGateway.handle({
      userId: 'cli-operator',
      channel: 'cli',
      sessionId: 'cli-session-workflow-process',
      text: 'corrija o arquivo e rode os testes',
      requestedTools: ['write_file', 'shell.exec'],
      metadata: {
        originalInput: 'corrija o arquivo e rode os testes',
      },
    });
    await agentGateway.approve(pending.run.approvals[0].id);

    const exitCode = await runZavorthCli(
      ['workflows', 'process', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
        agentGateway,
        legacyUnifiedGateway,
        surfaceTaskDispatcher: dispatcher as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(dispatcher.dispatchTaskMessage).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      mode: 'workflow_queue_process',
      processed: 1,
      failed: 0,
      remaining: 0,
    }));
    expect(payload.results).toEqual([
      expect.objectContaining({
        status: 'completed',
        summary: 'Pedido encaminhado pelo runtime universal para execucao supervisionada.',
      }),
    ]);
  });
});
