import { config } from '../../src/config/index.js';
import { ZavorthControlService } from '../../src/services/ZavorthControlService';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
} from '../helpers/controlWebTestUtils.js';

function createIntegrationHubSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    mcp: {
      generatedAt: new Date().toISOString(),
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
          lastAttemptedAt: new Date().toISOString(),
          lastConnectedAt: new Date().toISOString(),
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
      generatedAt: new Date().toISOString(),
      activeProviderName: 'gemini',
      activeModelName: 'gemini-2.5-flash',
      preferredZavorthBridgeModel: 'omni-route-coder',
      recommendedProfile: {
        id: 'coding',
        label: 'Coding',
        providerName: 'openrouter',
        modelName: 'openrouter/sonnet',
        fallbackOrder: ['openrouter', 'gemini'],
      },
      ready: [
        {
          id: 'gemini',
          label: 'Gemini',
          effectiveProviderName: 'gemini',
          mode: 'cloud',
          readiness: 'ready',
          currentModel: 'gemini-2.5-flash',
          summary: 'Provider cloud padrao do Zavorth.',
          issue: null,
        },
      ],
      needsConfiguration: [
        {
          id: 'openai',
          label: 'OpenAI',
          effectiveProviderName: 'openai',
          mode: 'cloud',
          readiness: 'needs_config',
          currentModel: 'gpt-5.4',
          summary: 'Provider cloud focado em coding e visao.',
          issue: 'Falta OPENAI_API_KEY.',
        },
      ],
      needsProbe: [
        {
          id: 'AIGateway',
          label: 'AIGateway',
          effectiveProviderName: 'AIGateway',
          mode: 'hybrid',
          readiness: 'needs_probe',
          currentModel: 'omni-route-coder',
          summary: 'Rota local/hibrida para coding pesado.',
          issue: 'Precisa de probe local.',
        },
      ],
      profiles: [
        {
          id: 'coding',
          label: 'Coding',
          summary: 'Prioriza coding e review.',
          preferredOrder: ['AIGateway', 'openrouter', 'gemini'],
        },
      ],
      usageTargets: ['gemini', 'openai', 'openrouter', 'AIGateway'],
      recommendations: ['Mantenha Gemini pronto como fallback seguro.'],
    },
    entries: [
      {
        manifest: {
          id: 'openrouter',
          label: 'OpenRouter',
          summary: 'Gateway nativo para varios modelos remotos.',
          category: 'remote',
          binding: {
            kind: 'provider',
            key: 'openrouter',
            status: 'ready',
            summary: 'Provider nativo ja embutido.',
          },
          defaultMode: 'api',
          capabilities: ['chat', 'code', 'vision'],
        },
        installed: {
          id: 'openrouter',
          nickname: 'Pesquisa',
          requestedBy: 'web-app',
          status: 'configured',
          selectedMode: 'api',
          enabledCapabilities: ['chat', 'code'],
          answers: {
            routing_goal: 'research',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          configuredAt: new Date().toISOString(),
          lastHealthCheckAt: null,
          lastHealthStatus: 'warn',
          notes: ['Provider pronto para ativar com chave.'],
        },
        doctor: {
          generatedAt: new Date().toISOString(),
          integrationId: 'openrouter',
          label: 'OpenRouter',
          nickname: 'Pesquisa',
          status: 'warn',
          binding: {
            kind: 'provider',
            key: 'openrouter',
            status: 'partial',
            summary: 'Provider nativo ja embutido.',
          },
          configured: true,
          selectedMode: 'api',
          enabledCapabilities: ['chat', 'code'],
          findings: [],
          playbook: {
            headline: 'Faltam alguns passos para fechar a integracao',
            summary: 'Comece pelo passo marcado como next.',
            steps: [
              {
                id: 'validate',
                label: 'Rodar validacao final',
                detail: 'Confirme se a chave ativa responde de verdade.',
                kind: 'verification',
                status: 'next',
                actionId: 'doctor:next',
                command: 'npm run integrations:doctor -- --id openrouter',
              },
            ],
          },
          nextAction: {
            label: 'Rodar doctor',
            command: 'npm run integrations:doctor -- --id openrouter',
            reason: 'Ainda falta validar a credencial ativa do runtime.',
          },
        },
        actionPlan: {
          generatedAt: new Date().toISOString(),
          integrationId: 'openrouter',
          primaryActionId: 'doctor:next',
          actions: [
            {
              id: 'doctor:next',
              label: 'Rodar doctor',
              description: 'Validar binding.',
              command: 'npm run integrations:doctor -- --id openrouter',
              executable: true,
              manualOnly: false,
              kind: 'doctor',
              severity: 'primary',
              blocking: false,
            },
          ],
        },
        actionMonitor: {
          generatedAt: new Date().toISOString(),
          integrationId: 'openrouter',
          latestAction: {
            executionId: 'test-openrouter-1',
            integrationId: 'openrouter',
            actionId: 'doctor:next',
            label: 'Rodar doctor',
            command: 'npm run integrations:doctor -- --id openrouter',
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            pid: null,
            logFile: '',
            status: 'completed',
            note: 'Doctor finalizado.',
            exitCode: 0,
          },
          recentActions: [],
          logExcerpt: {
            logFile: null,
            lines: ['Doctor finalizado.'],
          },
        },
        readiness: 'needs_configuration',
      },
      {
        manifest: {
          id: 'custom-docker-agent',
          label: 'Conector customizado em Docker',
          summary: 'Template seguro para novos sidecars locais.',
          category: 'template',
          binding: {
            kind: 'planned',
            key: null,
            status: 'planned',
            summary: 'Template aguardando manifesto especifico.',
          },
          defaultMode: 'docker',
          capabilities: ['chat', 'code', 'browser'],
        },
        installed: null,
        doctor: {
          generatedAt: new Date().toISOString(),
          integrationId: 'custom-docker-agent',
          label: 'Conector customizado em Docker',
          nickname: null,
          status: 'warn',
          binding: {
            kind: 'planned',
            key: null,
            status: 'planned',
            summary: 'Template aguardando manifesto especifico.',
          },
          configured: false,
          selectedMode: null,
          enabledCapabilities: ['chat', 'code', 'browser'],
          findings: [],
          nextAction: {
            label: 'Abrir onboarding',
            command: 'npm run integrations:show -- --id custom-docker-agent',
            reason: 'Template pronto para um novo conector guiado.',
          },
        },
        actionPlan: {
          generatedAt: new Date().toISOString(),
          integrationId: 'custom-docker-agent',
          primaryActionId: 'inspect:manifest',
          actions: [
            {
              id: 'inspect:manifest',
              label: 'Inspecionar integracao',
              description: 'Revisar o template antes de transformar em conector real.',
              command: 'npm run integrations:show -- --id custom-docker-agent',
              executable: true,
              manualOnly: false,
              kind: 'inspect',
              severity: 'recommended',
              blocking: false,
            },
          ],
        },
        readiness: 'planned',
      },
    ],
    featuredIds: ['openrouter'],
    templateIds: ['custom-docker-agent'],
    selected: {
      manifest: {
        id: 'openrouter',
        label: 'OpenRouter',
        summary: 'Gateway nativo para varios modelos remotos.',
        category: 'remote',
        binding: {
          kind: 'provider',
          key: 'openrouter',
          status: 'ready',
          summary: 'Provider nativo ja embutido.',
        },
        defaultMode: 'api',
        capabilities: ['chat', 'code', 'vision'],
      },
      installed: {
        id: 'openrouter',
        nickname: 'Pesquisa',
        requestedBy: 'web-app',
        status: 'configured',
        selectedMode: 'api',
        enabledCapabilities: ['chat', 'code'],
        answers: {
          routing_goal: 'research',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        configuredAt: new Date().toISOString(),
        lastHealthCheckAt: null,
        lastHealthStatus: 'warn',
        notes: ['Provider pronto para ativar com chave.'],
      },
      doctor: {
        generatedAt: new Date().toISOString(),
        integrationId: 'openrouter',
        label: 'OpenRouter',
        nickname: 'Pesquisa',
        status: 'warn',
        binding: {
          kind: 'provider',
          key: 'openrouter',
          status: 'partial',
          summary: 'Provider nativo ja embutido.',
        },
        configured: true,
        selectedMode: 'api',
        enabledCapabilities: ['chat', 'code'],
          findings: [],
          playbook: {
            headline: 'Faltam alguns passos para fechar a integracao',
            summary: 'Comece pelo passo marcado como next.',
            steps: [
              {
                id: 'validate',
                label: 'Rodar validacao final',
                detail: 'Confirme se a chave ativa responde de verdade.',
                kind: 'verification',
                status: 'next',
                actionId: 'doctor:next',
                command: 'npm run integrations:doctor -- --id openrouter',
              },
            ],
          },
          nextAction: {
            label: 'Rodar doctor',
            command: 'npm run integrations:doctor -- --id openrouter',
            reason: 'Ainda falta validar a credencial ativa do runtime.',
        },
      },
      actionPlan: {
        generatedAt: new Date().toISOString(),
        integrationId: 'openrouter',
        primaryActionId: 'doctor:next',
        actions: [
          {
            id: 'doctor:next',
            label: 'Rodar doctor',
            description: 'Validar binding.',
            command: 'npm run integrations:doctor -- --id openrouter',
            executable: true,
            manualOnly: false,
            kind: 'doctor',
            severity: 'primary',
            blocking: false,
          },
        ],
      },
      actionMonitor: {
        generatedAt: new Date().toISOString(),
        integrationId: 'openrouter',
        latestAction: {
          executionId: 'test-openrouter-1',
          integrationId: 'openrouter',
          actionId: 'doctor:next',
          label: 'Rodar doctor',
          command: 'npm run integrations:doctor -- --id openrouter',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          pid: null,
          logFile: '',
          status: 'completed',
          note: 'Doctor finalizado.',
          exitCode: 0,
        },
        recentActions: [],
        logExcerpt: {
          logFile: null,
          lines: ['Doctor finalizado.'],
        },
      },
      readiness: 'needs_configuration',
      storedSecretKeys: ['openrouter_api_key'],
    },
  };
}

describe('ZavorthControlService integration hub', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('serves the classic zavorthControl integrations block and endpoint', async () => {
    const hubSnapshot = createIntegrationHubSnapshot();
    const integrationHubService = {
      buildCatalogSnapshot: jest.fn(() => hubSnapshot),
    } as any;
    const service = new ZavorthControlService(logRepo, {
      integrationHubService,
    });

    await service.start();
    const [pageResponse, hubResponse] = await Promise.all([
      fetch(`${service.getUrl()}/classic`),
      fetch(`${service.getUrl()}/api/operations/integrations`),
    ]);
    const html = await pageResponse.text();
    const hub = await hubResponse.json();
    await service.stopAsync();

    expect(pageResponse.status).toBe(200);
    expect(hubResponse.status).toBe(200);
    expect(html).toContain('/api/operations/integrations');
    expect(html).toContain('Carregando Integration Hub');
    expect(html).toContain('Roteiro seguro');
    expect(hub).toEqual(
      expect.objectContaining({
        mcp: expect.objectContaining({
          summary: expect.objectContaining({
            connected: 1,
            toolCount: 2,
          }),
        }),
        providers: expect.objectContaining({
          activeProviderName: 'gemini',
          ready: expect.arrayContaining([
            expect.objectContaining({ id: 'gemini' }),
          ]),
        }),
        selected: expect.objectContaining({
          manifest: expect.objectContaining({
            id: 'openrouter',
          }),
        }),
      }),
    );
  });

  it('exposes authenticated integration hub endpoints for the web app', async () => {
    config.zavorthWebAuthToken = 'test-web-token';
    const hubSnapshot = createIntegrationHubSnapshot();
    const integrationHubService = {
      buildCatalogSnapshot: jest.fn(() => hubSnapshot),
      getStoredSecretKeys: jest.fn(() => ['openrouter_api_key']),
      buildDraft: jest.fn(() => ({
        resolution: {
          requestedId: 'openrouter',
          manifest: hubSnapshot.selected.manifest,
          matchedBy: 'id',
          suggestion: hubSnapshot.selected.manifest,
          note: 'Integração encontrada diretamente.',
        },
        manifest: hubSnapshot.selected.manifest,
        installed: {
          ...hubSnapshot.selected.installed,
          answers: {
            routing_goal: 'research',
          },
        },
        selectedMode: 'api',
        enabledCapabilities: ['chat', 'code'],
        missingRequirements: [],
        unansweredQuestions: [],
        nextAction: {
          label: 'Rodar doctor',
          command: 'npm run integrations:doctor -- --id openrouter',
          reason: 'Validar binding.',
        },
      })),
      executeGuidedAction: jest.fn(() => ({
        integrationId: 'openrouter',
        actionId: 'doctor:next',
        label: 'Rodar doctor',
        command: 'npm.cmd run integrations:doctor -- --id openrouter',
        startedAt: new Date().toISOString(),
        pid: 4242,
        logFile: 'data/runtime/integration-actions/test.log',
        status: 'started',
        note: 'Acao iniciada em background.',
      })),
    } as any;
    const service = new ZavorthControlService(logRepo, {
      integrationHubService,
    });

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const [
      { status: listStatus, payload: listPayload },
      { status: connectStatus, payload: connectPayload },
      { status: actionStatus, payload: actionPayload },
      { status: classicActionStatus, payload: classicActionPayload },
    ] = await Promise.all([
      fetchZavorthControlJson(baseUrl, '/api/web/integrations', { token }),
      fetchZavorthControlJson(baseUrl, '/api/web/integrations/connect', {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestedId: 'openrouter',
            selectedMode: 'api',
            enabledCapabilities: ['chat', 'code'],
            answers: {
              openrouter_api_key: 'sk-live-hidden',
              routing_goal: 'research',
            },
          }),
        },
      }),
      fetchZavorthControlJson(baseUrl, '/api/web/integrations/actions', {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            integrationId: 'openrouter',
            actionId: 'doctor:next',
          }),
        },
      }),
      fetchZavorthControlJson(baseUrl, '/api/operations/integrations/actions', {
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            integrationId: 'openrouter',
            actionId: 'doctor:next',
          }),
        },
      }),
    ]);
    await service.stopAsync();

    expect(listStatus).toBe(200);
    expect(connectStatus).toBe(200);
    expect(actionStatus).toBe(202);
    expect(classicActionStatus).toBe(202);
    expect(listPayload.hub).toEqual(
      expect.objectContaining({
        providers: expect.objectContaining({
          recommendedProfile: expect.objectContaining({
            id: 'coding',
          }),
        }),
        mcp: expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({
              id: 'filesystem',
            }),
          ]),
        }),
        selected: expect.objectContaining({
          storedSecretKeys: expect.arrayContaining(['openrouter_api_key']),
          actionPlan: expect.objectContaining({
            primaryActionId: 'doctor:next',
          }),
        }),
      }),
    );
    expect(connectPayload).toEqual(
      expect.objectContaining({
        ok: true,
        storedSecretKeys: expect.arrayContaining(['openrouter_api_key']),
        draft: expect.objectContaining({
          installed: expect.objectContaining({
            answers: expect.not.objectContaining({
              openrouter_api_key: expect.anything(),
            }),
          }),
        }),
      }),
    );
    expect(actionPayload).toEqual(
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          actionId: 'doctor:next',
          integrationId: 'openrouter',
        }),
      }),
    );
    expect(classicActionPayload).toEqual(
      expect.objectContaining({
        ok: true,
        accepted: true,
        action: expect.objectContaining({
          actionId: 'doctor:next',
          integrationId: 'openrouter',
        }),
      }),
    );
  });
});
