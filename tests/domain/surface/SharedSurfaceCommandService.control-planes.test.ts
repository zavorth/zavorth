import { SharedSurfaceCommandService } from '../../../src/services/SharedSurfaceCommandService';
import { DiscordSurfacePolicyService } from '../../../src/services/DiscordSurfacePolicyService';
import { config } from '../../../src/config/index';

describe('SharedSurfaceCommandService', () => {
  const originalProvider = config.llmProvider;
  const originalGeminiKeys = [...config.geminiApiKeys];
  const originalOpenAiKey = config.openaiApiKey;
  const originalOpenRouterKey = config.openRouterApiKey;
  const originalTelegramUserRoles = config.telegramUserRoles;
  const originalSelfmodPolicy = config.zavorthSelfmodPolicy;

  afterEach(() => {
    (config as any).llmProvider = originalProvider;
    (config as any).geminiApiKeys = [...originalGeminiKeys];
    (config as any).openaiApiKey = originalOpenAiKey;
    (config as any).openRouterApiKey = originalOpenRouterKey;
    (config as any).telegramUserRoles = originalTelegramUserRoles;
    (config as any).zavorthSelfmodPolicy = originalSelfmodPolicy;
  });

  it('renders the Ecosystem ecosystem control plane through /ecosystem', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/ecosystem openrouter',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const renderReport = jest.fn(() => 'Ecosystem: Ecossistema, SDKs e third-party platform\nPostura: healthy.');
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      ecosystemControlPlaneService: {
        buildSnapshot: jest.fn(() => ({})),
        renderReport,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(renderReport).toHaveBeenCalledWith({
      selectedId: 'openrouter',
      query: 'openrouter',
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Ecosystem: Ecossistema, SDKs e third-party platform'),
    );
  });

  it('renders the Distributed runtime distributed runtime control plane through /fleet', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/fleet signal',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const renderReport = jest.fn(async () => 'Distributed runtime: Runtime distribuido e superficies avancadas\nPostura: attention.');
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      distributedRuntimeControlPlaneService: {
        buildSnapshot: jest.fn(async () => ({})),
        renderReport,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(renderReport).toHaveBeenCalledWith({
      selectedId: 'signal',
      query: 'signal',
    });
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Distributed runtime: Runtime distribuido e superficies avancadas'),
    );
  });

  it('renders runtime stability through /stability', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/stability',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const renderReport = jest.fn(() => 'Fleet e transports supervisionados\nPostura: attention.');
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      runtimeStabilityControlPlaneService: {
        buildSnapshot: jest.fn(() => ({})),
        renderReport,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(renderReport).toHaveBeenCalledWith();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Fleet e transports supervisionados'));
  });

  it('renders rollout readiness through /rolloutqa', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/rolloutqa beta',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const renderReport = jest.fn(async () => 'Rollout e QA persistentes\nPostura: healthy.');
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      rolloutReadinessControlPlaneService: {
        buildSnapshot: jest.fn(async () => ({})),
        renderReport,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(renderReport).toHaveBeenCalledWith(expect.objectContaining({ profile: 'beta' }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Rollout e QA persistentes'));
  });

  it('renders the natural setup control plane through /setupagent', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/setupagent quero conectar ao discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const renderReport = jest.fn(async () => 'Natural setup: Natural Setup Agent\nPostura: attention.');
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      naturalSetupControlPlaneService: {
        buildSnapshot: jest.fn(async () => ({})),
        renderReport,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(renderReport).toHaveBeenCalledWith(expect.objectContaining({ intentText: 'quero conectar ao discord' }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Natural setup: Natural Setup Agent'));
  });

  it('renders the automation control plane through /automations', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/automations',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const renderReport = jest.fn(async () => 'Scheduled runs: Automations e scheduled runs\nPostura: attention.');
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      automationControlPlaneService: {
        buildSnapshot: jest.fn(async () => ({})),
        renderReport,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(renderReport).toHaveBeenCalledWith();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Scheduled runs: Automations e scheduled runs'));
  });

  it('creates automations from natural language through /automations', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/automations todo dia as 9h verifique meus canais no app',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      ok: true,
      actionId: 'create',
      summary: 'Automacao criada com entrega no app.',
      details: ['Rotina diaria registrada.'],
      snapshot: {
        narrative: {
          operatorSummary: 'Uma automacao ativa no runtime atual.',
          nextAction: 'Aguardar a primeira execucao.',
        },
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      automationActionService: {
        execute,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      actionId: 'create',
      intentText: 'todo dia as 9h verifique meus canais no app',
      requestedBy: 'telegram-user',
      sourceSurface: 'telegram',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Automacao criada com entrega no app.'));
  });

  it('routes shared /schedule commands through the governed automation action path', async () => {
    const ctx = {
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:chat-1',
      isGroup: false,
      rawText: '/schedule every 1h /status',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      ok: false,
      actionId: 'create',
      status: 'waiting_approval',
      summary: 'Preview de automacao criado; aplique apos approval.',
      details: ['Plan: plan-schedule-1.'],
      snapshot: {
        narrative: {
          operatorSummary: 'Nenhuma automacao aplicada sem approval.',
          nextAction: 'Aprovar o plano antes de persistir.',
        },
      },
      mutationPlan: {
        id: 'plan-schedule-1',
        status: 'waiting_approval',
        approval: { permissionId: 'perm-schedule-1' },
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      automationActionService: {
        execute,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      actionId: 'create',
      intentText: 'every 1h /status',
      requestedBy: 'discord-user',
      sourceSurface: 'app',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/automations apply plan-schedule-1'));
  });

  it('executes maintenance actions through /automations', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/automations maintenance on',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      ok: true,
      actionId: 'maintenance-on',
      summary: 'Maintenance mode ativado.',
      details: ['Rotinas recorrentes vao respeitar a janela de manutencao.'],
      snapshot: {
        narrative: {
          operatorSummary: 'Maintenance mode ficou ligado.',
          nextAction: 'Acompanhar as execucoes seguintes.',
        },
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      automationActionService: {
        execute,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      actionId: 'maintenance-on',
      requestedBy: 'telegram-user',
      sourceSurface: 'telegram',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Maintenance mode ativado.'));
  });

  it('renders and mutates the watch mode control plane through /watchmode', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/watchmode strict off',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const renderReport = jest.fn(() => 'Watch mode: Watch Mode supervisionado\nPostura: healthy.');
    const setStrictApprovalDefault = jest.fn();
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      watchModeControlPlaneService: {
        buildSnapshot: jest.fn(() => ({})),
        renderReport,
      } as any,
      watchModePolicyFileService: {
        setStrictApprovalDefault,
        allowApp: jest.fn(),
        allowSite: jest.fn(),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(setStrictApprovalDefault).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Watch Mode'));
  });

  it('renders tenant governance through /tenants', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/tenants',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-03T18:10:00.000Z',
          summary: {
            total: 2,
            shared: 1,
            personal: 1,
            pendingOnboarding: 1,
            publicServers: 1,
            readyShared: 0,
            restrictedShared: 0,
            byPlatform: { discord: 1, web: 1 },
          },
          tenants: [
            {
              tenantId: 'discord-public',
              platform: 'discord',
              governanceStatus: 'pending_onboarding',
              scopeLabel: 'guild:1489',
              sessionId: null,
              sourceUserId: '956',
              runtimeUserId: '1',
              operatorSummary: 'Tenant publico de discord ainda aguarda onboarding e allowlist explicita.',
              nextAction: 'Configurar owners e canais permitidos antes de liberar a superficie publica.',
              actions: [
                {
                  id: 'inspect-tenant',
                  label: 'Trazer /tenants',
                  description: 'Carrega o tenant filtrado na surface textual compartilhada.',
                  command: '/tenants discord-public',
                  actionKind: 'guided',
                  emphasis: 'primary',
                },
                {
                  id: 'review-channels',
                  label: 'Revisar /channels',
                  description: 'Confere o channel mesh oficial antes de abrir novas superficies.',
                  command: '/channels',
                  actionKind: 'guided',
                  emphasis: 'primary',
                },
              ],
              recipe: {
                id: 'recipe:discord-public:public-onboarding',
                tenantId: 'discord-public',
                governanceStatus: 'pending_onboarding',
                label: 'Fechar onboarding do tenant publico',
                summary: 'Mantenha o tenant fail-closed ate owners, allowlists e workflows refletirem o runtime oficial.',
                actions: [],
              },
            },
          ],
          pendingOnboarding: [],
          featuredRecipes: [],
          narrative: {
            headline: 'Governanca de tenants com 2 tenant(s) observado(s).',
            operatorSummary: '1 compartilhado | 1 pendente de onboarding',
            nextAction: 'Fechar onboarding antes de abrir novas superficies.',
          },
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Governanca de tenants do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('discord • pending_onboarding'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('guild:1489'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Recipe: Fechar onboarding do tenant publico'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Contexto: source 956 | runtime 1'));
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('[guided] Trazer /tenants: /tenants discord-public | via /tenants run discord-public inspect-tenant'),
    );
  });

  it('executes a guided tenant action through /tenants <tenantId> <actionId>', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/tenants discord-public inspect-tenant',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const tenantSnapshot = {
      generatedAt: '2026-04-04T14:00:00.000Z',
      summary: {
        total: 1,
        shared: 1,
        personal: 0,
        pendingOnboarding: 1,
        publicServers: 1,
        readyShared: 0,
        restrictedShared: 0,
        byPlatform: { discord: 1 },
      },
      tenants: [
        {
          tenantId: 'discord-public',
          platform: 'discord',
          governanceStatus: 'pending_onboarding',
          scopeLabel: 'guild:1489',
          sessionId: null,
          sourceUserId: '956',
          runtimeUserId: '1',
          operatorSummary: 'Tenant publico ainda pede onboarding.',
          nextAction: 'Configurar canais permitidos.',
          actions: [
            {
              id: 'inspect-tenant',
              label: 'Trazer /tenants',
              description: 'Carrega o tenant filtrado na surface textual compartilhada.',
              command: '/tenants discord-public',
              actionKind: 'guided',
              emphasis: 'primary',
            },
          ],
          recipe: null,
        },
      ],
      pendingOnboarding: [],
      featuredRecipes: [],
      narrative: {
        headline: 'Governanca de tenants com 1 tenant(s) observado(s).',
        operatorSummary: '1 pendente de onboarding.',
        nextAction: 'Fechar onboarding antes de abrir novas superficies.',
      },
    };
    const execute = jest.fn(async () => ({
      action: {
        status: 'completed',
        actionId: 'inspect-tenant',
        tenantId: 'discord-public',
        label: 'Trazer /tenants',
        command: '/tenants discord-public',
        note: 'Tenant discord-public carregado na governanca.',
        targetPanel: 'inspector-panel',
        targetWorkspaceView: null,
      },
      tenantGovernance: tenantSnapshot,
      teams: null,
      channels: null,
      memoryPlane: null,
      runtimeModes: null,
      securityMesh: null,
      sessionPlane: null,
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => tenantSnapshot),
      } as any,
      tenantGovernanceActionService: {
        execute,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      tenantId: 'discord-public',
      actionId: 'inspect-tenant',
      workspace: process.cwd(),
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Acao guiada do tenant discord-public: Trazer /tenants.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Governanca de tenants do Zavorth'));
  });

  it('executes a tenant workflow review through /tenants run <tenantId> <actionId>', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/tenants run discord-public start-onboarding-review',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const tenantSnapshot = {
      generatedAt: '2026-04-04T14:05:00.000Z',
      summary: {
        total: 1,
        shared: 1,
        personal: 0,
        pendingOnboarding: 1,
        publicServers: 1,
        readyShared: 0,
        restrictedShared: 0,
        byPlatform: { discord: 1 },
      },
      tenants: [
        {
          tenantId: 'discord-public',
          platform: 'discord',
          governanceStatus: 'pending_onboarding',
          scopeLabel: 'guild:1489',
          sessionId: null,
          sourceUserId: '956',
          runtimeUserId: '1',
          operatorSummary: 'Tenant publico ainda pede onboarding.',
          nextAction: 'Configurar canais permitidos.',
          actions: [
            {
              id: 'start-onboarding-review',
              label: 'Abrir review de onboarding',
              description: 'Dispara um workflow de review para fechar onboarding e policy do tenant.',
              command: '/workflow review Fechar onboarding do tenant discord-public',
              actionKind: 'guided',
              emphasis: 'primary',
            },
          ],
          recipe: null,
        },
      ],
      pendingOnboarding: [],
      featuredRecipes: [],
      narrative: {
        headline: 'Governanca de tenants com 1 tenant(s) observado(s).',
        operatorSummary: '1 pendente de onboarding.',
        nextAction: 'Fechar onboarding antes de abrir novas superficies.',
      },
    };
    const execute = jest.fn(async () => ({
      action: {
        status: 'started',
        actionId: 'start-onboarding-review',
        tenantId: 'discord-public',
        label: 'Abrir review de onboarding',
        command: '/workflow review Fechar onboarding do tenant discord-public',
        note: 'Workflow de onboarding iniciado para o tenant discord-public.',
        targetPanel: 'inspector-panel',
        targetWorkspaceView: null,
        replies: ['workflow:review Fechar onboarding do tenant discord-public'],
      },
      tenantGovernance: tenantSnapshot,
      teams: null,
      channels: null,
      memoryPlane: null,
      runtimeModes: null,
      securityMesh: null,
      sessionPlane: null,
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      tenantGovernanceService: {
        buildSnapshot: jest.fn(() => tenantSnapshot),
      } as any,
      tenantGovernanceActionService: {
        execute,
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      tenantId: 'discord-public',
      actionId: 'start-onboarding-review',
      workspace: process.cwd(),
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Workflow de onboarding iniciado para o tenant discord-public.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Saida do workflow:'));
  });

  it('surfaces official remote access and parity details in /access', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/access',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      runtimeAccessManifestService: {
        buildManifest: jest.fn(async () => ({
          summary: 'Acesso local pronto e remoto em preparacao.',
          local: {
            ready: true,
            appUrl: 'http://127.0.0.1:33333/app',
          },
          remote: {
            ready: false,
            appUrl: null,
            requiresHttps: true,
          },
          auth: {
            required: true,
            source: 'ZAVORTH_WEB_AUTH_TOKEN',
            authorizedHost: true,
          },
          surfaces: [
            {
              label: 'Web app',
              entry: 'http://127.0.0.1:33333/app',
              remoteEntry: 'https://zavorth.example.com/app',
              ready: true,
            },
          ],
          commands: {
            start: 'npm run ops:start',
            bootstrap: 'npm run ops:bootstrap -- --repair',
            manifest: 'npm run ops:access',
            remote: 'npm run ops:local-cloudflare',
            trust: '/hostauth trust',
          },
          nextSteps: [
            {
              id: 'remote',
              title: 'Fechar URL publica',
              description: 'Valide uma URL HTTPS oficial.',
            },
          ],
        })),
      } as any,
      runtimeOfficialRemoteAccessService: {
        inspect: jest.fn(async () => ({
          remote: {
            ready: false,
            baseUrl: 'https://zavorth.example.com',
            appUrl: 'https://zavorth.example.com/app',
          },
          recommendedPathId: 'local-cloudflare',
          recommendedPathReason: 'Cloudflare local e o caminho mais curto neste host.',
          nextSteps: [
            'Aplique a configuracao oficial.',
            'Verifique a URL publica do app.',
          ],
        })),
      } as any,
      sharedSurfaceParityService: {
        buildManifest: jest.fn(() => ({
          summary: 'Web e Telegram compartilham o mesmo nucleo de comandos.',
          recommended: [
            {
              surfaceCommand: '/workflow',
              description: 'Retoma ou inicia workflows compostos.',
            },
          ],
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Caminho remoto oficial: local-cloudflare | pendente'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Paridade web/Telegram: Web e Telegram compartilham o mesmo nucleo de comandos.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/workflow: Retoma ou inicia workflows compostos.'));
  });

  it('surfaces official install journey and parity details in /bootstrap', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/bootstrap',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      runtimeBootstrapService: {
        inspectLive: jest.fn(async () => ({
          summary: 'Bootstrap quase fechado.',
          env: {
            envFilePresent: true,
            llmProvider: 'openrouter',
            llmCredentialReady: true,
          },
          dependencies: {
            installRequired: false,
            buildRequired: false,
          },
          supervisedRuntime: {
            accessReadiness: {
              local: { ready: true },
              remote: { ready: false },
            },
          },
          actions: [
            {
              title: 'Subir host',
              command: 'npm run dev:supervised',
            },
          ],
        })),
      } as any,
      runtimeInstallJourneyService: {
        run: jest.fn(async () => ({
          phases: [
            {
              id: 'launcher',
              title: 'Autostart no sistema',
              status: 'action',
              summary: 'Instale o launcher oficial.',
              command: 'npm run launcher:startup:install',
            },
          ],
        })),
      } as any,
      runtimeOfficialRemoteAccessService: {
        inspect: jest.fn(async () => ({
          remote: { ready: false },
          recommendedPathReason: 'Ainda falta validar a URL publica oficial.',
        })),
      } as any,
      sharedSurfaceParityService: {
        buildManifest: jest.fn(() => ({
          summary: 'Web e Telegram estao alinhados para access, bootstrap e workflow.',
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Acesso remoto oficial: pendente | Ainda falta validar a URL publica oficial.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Paridade entre superficies: Web e Telegram estao alinhados para access, bootstrap e workflow.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Etapas oficiais ainda pendentes:'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Autostart no sistema: npm run launcher:startup:install'));
  });

  it('delegates natural engineering requests to the Engineering Core before falling back to technical parsing', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'crie um servidor Express',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const engineeringCoreService = {
      maybeHandleSurfaceRequest: jest.fn(async () => true),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      engineeringCoreService: engineeringCoreService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(engineeringCoreService.maybeHandleSurfaceRequest).toHaveBeenCalledWith(ctx, null);
  });
});
