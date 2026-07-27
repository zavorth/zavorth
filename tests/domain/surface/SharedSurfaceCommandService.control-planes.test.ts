jest.mock('../../../src/storage/Database', () => {
  const mockStatement = { get: jest.fn(() => undefined), run: jest.fn(() => ({ changes: 0 })), all: jest.fn(() => []) };
  const mockInstance = {
    prepare: jest.fn(() => mockStatement),
    pragma: jest.fn(),
    close: jest.fn(),
    all: jest.fn(() => []),
    get: jest.fn(() => undefined),
    run: jest.fn(() => ({ changes: 0 })),
    exec: jest.fn(),
  };
  return { Database: { getInstance: jest.fn(async () => mockInstance), resetInstance: jest.fn(), instance: null } };
});

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
    const renderReport = jest.fn(() => 'Ecosystem: Ecosystem, SDKs and third-party platform\nPosture: healthy.');
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
      expect.stringContaining('Ecosystem: Ecosystem, SDKs and third-party platform'),
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
    const renderReport = jest.fn(
      async () => 'Distributed runtime: Distributed runtime and advanced surfaces\nPosture: attention.',
    );
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
      expect.stringContaining('Distributed runtime: Distributed runtime and advanced surfaces'),
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
      rawText: '/automations check my channels in the app at the requested cadence',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      ok: true,
      actionId: 'create',
      summary: 'Automation created with in-app delivery.',
      details: ['Daily routine registered.'],
      snapshot: {
        narrative: {
          operatorSummary: 'Uma automaction ativa no runtime atual.',
          nextAction: 'Wait for the first run.',
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
      intentText: 'check my channels in the app at the requested cadence',
      requestedBy: 'telegram-user',
      sourceSurface: 'telegram',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Automation created with in-app delivery.'));
  });

  it('routes shared /schedule commands through the governed automation action path', async () => {
    const ctx = {
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:chat-1',
      isGroup: false,
      rawText: '/schedule {"kind":"interval","intervalMs":3600000} /status',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      ok: false,
      actionId: 'create',
      status: 'waiting_approval',
      summary: 'Preview de automaction criado; aplique after approval.',
      details: ['Plan: plan-schedule-1.'],
      snapshot: {
        narrative: {
          operatorSummary: 'Noa automaction aplicada sem approval.',
          nextAction: 'Approve the plan before persisting.',
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
      intentText: '{"kind":"interval","intervalMs":3600000} /status',
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
      summary: 'Maintenance mode enabled.',
      details: ['Recurring routines will respect the maintenance window.'],
      snapshot: {
        narrative: {
          operatorSummary: 'Maintenance mode is enabled.',
          nextAction: 'Track as executions seguintes.',
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
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Maintenance mode enabled.'));
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
              operatorSummary: 'Public Discord tenant still awaits onboarding and explicit allowlist.',
              nextAction: 'Configure owners and allowed channels before releasing the public surface.',
              actions: [
                {
                  id: 'inspect-tenant',
                  label: 'Trazer /tenants',
                  description: 'Loads the filtered tenant on the shared textual surface.',
                  command: '/tenants discord-public',
                  actionKind: 'guided',
                  emphasis: 'primary',
                },
                {
                  id: 'review-channels',
                  label: 'Revisar /channels',
                  description: 'Confere o channel mesh oficial antes de abrir novas surfaces.',
                  command: '/channels',
                  actionKind: 'guided',
                  emphasis: 'primary',
                },
              ],
              recipe: {
                id: 'recipe:discord-public:public-onboarding',
                tenantId: 'discord-public',
                governanceStatus: 'pending_onboarding',
                label: 'Close public tenant onboarding',
                summary:
                  'Mantenthere is o tenant fail-closed ate owners, allowlists e workflows refletirem o runtime oficial.',
                actions: [],
              },
            },
          ],
          pendingOnboarding: [],
          featuredRecipes: [],
          narrative: {
            headline: 'Tenant governance with 2 tenant(s) observado(s).',
            operatorSummary: '1 shared | 1 pending onboarding',
            nextAction: 'Close onboarding antes de abrir novas surfaces.',
          },
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth tenant governance'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('discord - pending_onboarding'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('guild:1489'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Recipe: Close public tenant onboarding'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Context: source 956 | runtime 1'));
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining(
        '[guided] Trazer /tenants: /tenants discord-public | via /tenants run discord-public inspect-tenant',
      ),
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
          operatorSummary: 'Public tenant still needs onboarding.',
          nextAction: 'Configure allowed channels.',
          actions: [
            {
              id: 'inspect-tenant',
              label: 'Trazer /tenants',
              description: 'Loads the filtered tenant on the shared textual surface.',
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
        headline: 'Tenant governance with 1 tenant(s) observado(s).',
        operatorSummary: '1 pending onboarding.',
        nextAction: 'Close onboarding antes de abrir novas surfaces.',
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
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Guided tenant action discord-public: Trazer /tenants.'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth tenant governance'));
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
          operatorSummary: 'Public tenant still needs onboarding.',
          nextAction: 'Configure allowed channels.',
          actions: [
            {
              id: 'start-onboarding-review',
              label: 'Abrir review de onboarding',
              description: 'Starts a review workflow to close tenant onboarding and policy.',
              command: '/workflow review Close onboarding do tenant discord-public',
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
        headline: 'Tenant governance with 1 tenant(s) observado(s).',
        operatorSummary: '1 pending onboarding.',
        nextAction: 'Close onboarding antes de abrir novas surfaces.',
      },
    };
    const execute = jest.fn(async () => ({
      action: {
        status: 'started',
        actionId: 'start-onboarding-review',
        tenantId: 'discord-public',
        label: 'Abrir review de onboarding',
        command: '/workflow review Close onboarding do tenant discord-public',
        note: 'Onboarding workflow started for tenant discord-public.',
        targetPanel: 'inspector-panel',
        targetWorkspaceView: null,
        replies: ['workflow:review Close onboarding do tenant discord-public'],
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
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Onboarding workflow started for tenant discord-public.'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Workflow output:'));
  });

  it('surfaces official remote access and consistency details in /access', async () => {
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
          summary: 'Local access ready and remote access preparing.',
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
              title: 'Close URL public',
              description: 'Validate an official HTTPS URL.',
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
          nextSteps: ['Aplique a configuraction oficial.', 'Verifique a URL public do app.'],
        })),
      } as any,
      sharedSurfaceConsistencyService: {
        buildManifest: jest.fn(() => ({
          summary: 'Web and Telegram share the same command core.',
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
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Official remote path: local-cloudflare | pending'));
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Web/Telegram parity: Web and Telegram share the same command core.'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/workflow: Retoma ou inicia workflows compostos.'));
  });

  it('surfaces official install journey and consistency details in /bootstrap', async () => {
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
          summary: 'Bootstrap quase closed.',
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
          recommendedPathReason: 'Ainda falta validar a URL public oficial.',
        })),
      } as any,
      sharedSurfaceConsistencyService: {
        buildManifest: jest.fn(() => ({
          summary: 'Web and Telegram are aligned for access, bootstrap, and workflow.',
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Official remote access: pending | Ainda falta validar a URL public oficial.'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Surface parity: Web and Telegram are aligned for access, bootstrap, and workflow.'),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Official steps still pending:'));
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Autostart no sistema: npm run launcher:startup:install'),
    );
  });

  it('does not keyword-route free-text engineering requests (agent-first purity)', async () => {
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

    expect(handled).toBe(false);
    expect(engineeringCoreService.maybeHandleSurfaceRequest).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
