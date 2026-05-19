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

  it('blocks Discord operational commands for non-owner users', async () => {
    const ctx = {
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:guild:1:channel:2',
      isGroup: true,
      rawText: '/reload force',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const supervisedRuntimeService = {
      summarizeRecentChanges: jest.fn(() => 'changes'),
      requestReload: jest.fn(async () => ({ accepted: true, summary: 'ok', requestId: '1' })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: supervisedRuntimeService as any,
      autoRepairService: { summarizeLastRun: jest.fn(() => 'status'), run: jest.fn() } as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({
        commandExposure: 'operator',
        ownerUserIds: ['discord-owner'],
      }),
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('nao esta exposto neste canal do Discord'));
    expect(supervisedRuntimeService.requestReload).not.toHaveBeenCalled();
  });

  it('handles /codexremote help through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/codexremote help',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      codexRemoteControlPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          narrative: {
            headline: 'Codex Remote pronto.',
            operatorSummary: 'Tudo ok.',
            nextAction: 'Abra uma sessao.',
          },
          activeProfile: { id: 'default', label: 'Default Codex' },
          summary: {
            cliReady: true,
            trackedSessions: 1,
            runningSessions: 1,
            readyRemotePaths: 1,
          },
          visibility: {
            mode: 'full-user-visible',
            pendingApprovals: 0,
            note: 'Sem aprovacoes ocultas.',
          },
          remotePaths: [{ id: 'AIGateway' }],
          sessionBroker: {
            telegramSummary: 'Codex Remote no Telegram\n\n/codexremote\n/codexremote sessions',
          },
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/codexremote sessions'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Visibilidade: full-user-visible'));
  });

  it('routes /hub through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/hub openrouter',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const hubControlPlaneService = {
      renderReport: jest.fn(() => 'Zavorth Hub + MCP product plane\n\nPostura: attention.'),
      buildSnapshot: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      hubControlPlaneService: hubControlPlaneService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(hubControlPlaneService.renderReport).toHaveBeenCalledWith({
      selectedId: 'openrouter',
      query: 'openrouter',
      recommendFor: 'openrouter',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth Hub + MCP product plane'));
  });

  it('handles /doctor desktop through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/doctor desktop',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      desktopResourcePlaneService: {
        inspectLive: jest.fn(async () => ({
          generatedAt: '2026-04-14T14:10:00.000Z',
        })),
        readLatest: jest.fn(),
        renderReport: jest.fn(() => 'Desktop Resource Plane\n\nDocker Desktop em destaque.'),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Desktop Resource Plane'));
  });

  it('handles /mode through the shared surface', async () => {
    const statusCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/mode',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const setCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/mode operator',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const setProductMode = jest.fn(() => ({
      id: 'operator',
      label: 'Zavorth Operator',
      summary: 'Modo operator.',
      description: 'Operator',
      defaultRuntimeProfile: 'ops',
      runtimeProfile: 'ops',
      profileAligned: true,
      visibleSurfaces: ['chat', 'mesh'],
      hiddenByDefault: [],
      escalationTargets: [],
      commands: {
        show: '/mode',
        set: '/mode <chat|assistant|builder|operator>',
        cliStatus: 'npm run mode:status',
        cliSet: 'npm run mode:use -- <chat|assistant|builder|operator>',
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      capabilityLifecycleService: {
        buildSnapshot: jest.fn(),
        buildProductModeSnapshot: jest.fn(() => ({
          id: 'builder',
          label: 'Zavorth Builder',
          summary: 'Modo builder.',
          description: 'Builder',
          defaultRuntimeProfile: 'core',
          runtimeProfile: 'core',
          profileAligned: true,
          visibleSurfaces: ['chat', 'tool-cards'],
          hiddenByDefault: ['companions'],
          escalationTargets: ['operator'],
          commands: {
            show: '/mode',
            set: '/mode <chat|assistant|builder|operator>',
            cliStatus: 'npm run mode:status',
            cliSet: 'npm run mode:use -- <chat|assistant|builder|operator>',
          },
        })),
        setProductMode,
      } as any,
    });

    const handledStatus = await service.maybeHandle(statusCtx as any);
    const handledSet = await service.maybeHandle(setCtx as any);

    expect(handledStatus).toBe(true);
    expect(handledSet).toBe(true);
    expect(statusCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth Builder'));
    expect(setProductMode).toHaveBeenCalledWith('operator', 'telegram-user');
    expect(setCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Zavorth Operator'));
  });

  it('handles /mode approve through the shared surface', async () => {
    const approveCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      channelId: 'session-mode-1',
      threadId: 'session-mode-1',
      isGroup: false,
      rawText: '/mode approve mode-escalation-builder-1 session',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      capabilityLifecycleService: {
        buildSnapshot: jest.fn(),
        buildProductModeSnapshot: jest.fn(() => ({
          id: 'chat',
          label: 'Zavorth Chat',
          summary: 'Modo chat.',
          description: 'Chat',
          defaultRuntimeProfile: 'core',
          runtimeProfile: 'core',
          profileAligned: true,
          visibleSurfaces: ['chat'],
          hiddenByDefault: ['diffs'],
          escalationTargets: ['assistant', 'builder', 'operator'],
          commands: {
            show: '/mode',
            set: '/mode <chat|assistant|builder|operator>',
            cliStatus: 'npm run mode:status',
            cliSet: 'npm run mode:use -- <chat|assistant|builder|operator>',
          },
        })),
        setProductMode: jest.fn(),
      } as any,
      modeEscalationService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-14T18:00:00.000Z',
          sessionId: 'session-mode-1',
          baseMode: { id: 'chat' },
          effectiveMode: { id: 'chat' },
          status: 'pending',
          activeGrants: [],
          pendingRequest: { id: 'mode-escalation-builder-1' },
          recentRequests: [],
          commands: {
            show: '/mode',
            approve: '/mode approve <requestId> [once|session|host]',
            reject: '/mode reject <requestId>',
            inspect: '/api/web/runtime/mode-escalation?sessionId=:id',
            resolve: '/api/web/runtime/mode-escalation/resolve',
          },
        })),
        resolveRequest: jest.fn(() => ({
          ok: true,
          decision: 'approve',
          request: { fallback: 'Responder conceitualmente.' },
          grant: { targetMode: 'builder', scope: 'session' },
          snapshot: {
            effectiveMode: { id: 'builder' },
          },
          summary: 'Escalonamento aprovado para builder com escopo session.',
        })),
      } as any,
    });

    const handled = await service.maybeHandle(approveCtx as any);

    expect(handled).toBe(true);
    expect(approveCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Escalonamento aprovado'));
  });

  it('handles /companion list and inspect through the shared surface', async () => {
    const listCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/companion list',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const inspectCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/companion inspect docker-desktop',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const companionControlService = {
      buildSnapshot: jest.fn(async () => ({
        companions: [{ id: 'docker-desktop', status: 'idle' }],
      })),
      inspectCompanion: jest.fn(async () => ({
        id: 'docker-desktop',
        status: 'idle',
      })),
      executeAction: jest.fn(),
      renderSnapshot: jest.fn(() => 'Companion Control Plane\n\nDocker Desktop ativo e ocioso.'),
      renderCompanion: jest.fn(() => 'Docker Desktop\n\nStatus: idle.'),
      renderActionResult: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      companionControlService: companionControlService as any,
    });

    const handledList = await service.maybeHandle(listCtx as any);
    const handledInspect = await service.maybeHandle(inspectCtx as any);

    expect(handledList).toBe(true);
    expect(handledInspect).toBe(true);
    expect(listCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Companion Control Plane'));
    expect(inspectCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Docker Desktop'));
  });

  it('handles /workspace doctor and optimize preview through the shared surface', async () => {
    const doctorCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/workspace doctor',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const optimizeCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/workspace optimize zavorthBridge',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const workspaceOptimizerService = {
      buildLoadProfile: jest.fn(async () => ({
        workspaceName: 'Zavorth',
      })),
      renderLoadProfile: jest.fn(() => 'Workspace Doctor: Zavorth'),
      previewOptimization: jest.fn(async () => ({
        preset: { id: 'zavorthBridge', label: 'ZavorthBridge Lean' },
        mutationPlan: { id: 'plan-workspace-1' },
        changedKeys: ['git.autoRepositoryDetection'],
        waitingApproval: true,
        blocked: false,
      })),
      renderPreview: jest.fn(() => 'Workspace Optimize Preview: Zavorth'),
      applyOptimization: jest.fn(),
      renderApplyResult: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      workspaceOptimizerService: workspaceOptimizerService as any,
    });

    const handledDoctor = await service.maybeHandle(doctorCtx as any);
    const handledOptimize = await service.maybeHandle(optimizeCtx as any);

    expect(handledDoctor).toBe(true);
    expect(handledOptimize).toBe(true);
    expect(doctorCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Workspace Doctor'));
    expect(optimizeCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Workspace Optimize Preview'));
  });

  it('handles /companion optimize through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/companion optimize zavorthBridge',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const workspaceOptimizerService = {
      buildLoadProfile: jest.fn(),
      renderLoadProfile: jest.fn(),
      previewOptimization: jest.fn(async () => ({
        preset: { id: 'zavorthBridge', label: 'ZavorthBridge Lean' },
        mutationPlan: { id: 'plan-workspace-1' },
        changedKeys: ['git.autoRepositoryDetection'],
        waitingApproval: true,
        blocked: false,
      })),
      renderPreview: jest.fn(() => 'Workspace Optimize Preview: Zavorth'),
      applyOptimization: jest.fn(),
      renderApplyResult: jest.fn(),
    };
    const companionControlService = {
      buildSnapshot: jest.fn(),
      inspectCompanion: jest.fn(),
      executeAction: jest.fn(),
      renderSnapshot: jest.fn(),
      renderCompanion: jest.fn(),
      renderActionResult: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      workspaceOptimizerService: workspaceOptimizerService as any,
      companionControlService: companionControlService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(workspaceOptimizerService.previewOptimization).toHaveBeenCalledWith(expect.objectContaining({
      presetId: 'zavorthBridge',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Workspace Optimize Preview'));
  });

  it('handles /enable with a visible resource impact preview', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/enable sandbox once',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      capabilityLifecycleService: {
        getManifest: jest.fn(() => ({
          id: 'sandbox',
          label: 'Sandbox',
          activationMode: 'sidecar',
          approvalRequired: true,
          estimatedFootprint: { ramIdleMb: 192, diskMb: 1536, processCount: 1, notes: 'Docker sandbox.' },
        })),
        registerCapabilityDemand: jest.fn(() => ({
          capability: { capabilityId: 'sandbox', state: 'provisioning' },
          approval: { capabilityId: 'sandbox' },
        })),
        buildApprovalRequest: jest.fn(),
        enableCapability: jest.fn(),
        disableCapability: jest.fn(),
        markCapabilityState: jest.fn(),
        registerCapabilityUsage: jest.fn(),
      } as any,
      taskResourcePlannerService: {
        planCapabilityEnable: jest.fn(async () => ({
          generatedAt: '2026-04-14T16:10:00.000Z',
          taskKind: 'capability',
          intent: 'Habilitar Sandbox',
          heavy: true,
          approvalRequired: true,
          summary: 'Planner detectou sandbox pesada.',
          userFacingSummary: 'Para cumprir isso eu posso precisar de Sandbox.',
          budget: {
            ramMb: 192,
            cpuPercent: 18,
            diskMb: 1536,
            processCount: 1,
            externalExposure: 'local',
            recurring: false,
            companionDependencies: ['wsl', 'docker-desktop'],
            capabilityIds: ['sandbox'],
            fallback: 'Executa no modo local guardado.',
            notes: [],
          },
          capabilityEstimates: [],
          companionEstimates: [],
          warnings: [],
        })),
        renderImpactSummary: jest.fn(() => 'Impacto estimado: Sandbox, WSL e Docker Desktop.'),
        toMutationResourceImpact: jest.fn(() => ({
          ramMb: 192,
          diskMb: 1536,
          processCount: 1,
          externalExposure: 'local',
          recurring: false,
          notes: ['Sandbox pesada.'],
        })),
      } as any,
      permissionService: {
        findApprovedRequest: jest.fn(async () => null),
        createRequest: jest.fn(async () => ({
          permission_id: 'perm-1',
          status: 'pending',
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('aguardando approval'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Impacto estimado: Sandbox, WSL e Docker Desktop.'));
  });

  it('executes Hub actions through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/hub sync',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      actionId: 'platform-sync',
      status: 'completed',
      ok: true,
      summary: 'Registry remoto sincronizado pelo Hub.',
      details: ['Sync ok.'],
      hub: {
        narrative: {
          operatorSummary: 'Hub pronto.',
          nextAction: 'Abrir um conector pronto.',
        },
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      hubControlPlaneService: {
        renderReport: jest.fn(),
        buildSnapshot: jest.fn(),
      } as any,
      hubActionService: { execute } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith({
      actionId: 'platform-sync',
      requestedBy: 'telegram-user',
      workspace: process.cwd(),
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Registry remoto sincronizado pelo Hub.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Proximo passo: Abrir um conector pronto.'));
  });

  it('routes /qa through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/qa beta',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const qaControlPlaneService = {
      renderReport: jest.fn(() => 'QA release: QA, budgets e release gates\n\nRelease beta: pronto.'),
      buildSnapshot: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      qaControlPlaneService: qaControlPlaneService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(qaControlPlaneService.renderReport).toHaveBeenCalledWith({ profile: 'beta' });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('QA release: QA, budgets e release gates'));
  });

  it('starts a Codex Remote session from the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/codexremote start Demo -- continue from phase 2',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      action: { note: 'Sessao iniciada.' },
      session: {
        record: {
          sessionId: 'codex-1',
          title: 'Demo',
          handoffCommand: '/open-session session-web-1',
        },
        operatorSummary: 'Sessao em execucao.',
        tail: { logLines: ['working'] },
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      codexRemoteActionService: { execute } as any,
      codexRemoteControlPlaneService: { buildSnapshot: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'start-session',
      title: 'Demo',
      prompt: 'continue from phase 2',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Sessao iniciada.'));
  });

  it('surfaces Codex Remote approvals with the Telegram permission keyboard', async () => {
    const keyboard = { inline_keyboard: [[{ text: 'Approve', callback_data: 'perm:approve:abcd1234' }]] };
    const permission = {
      permission_id: 'perm-1',
      status: 'pending',
      executor: 'codex_remote',
      kind: 'session_control',
    };
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/codexremote start Demo -- continue from phase 2',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      codexRemoteActionService: {
        execute: jest.fn(async () => ({
          action: {
            status: 'pending-approval',
            note: 'Acao start-session pendente de aprovacao.',
            permissionId: 'perm-1',
          },
          codexRemote: {
            sessionBroker: {
              telegramSummary: 'Codex Remote no Telegram',
            },
          },
          session: null,
          permission,
        })),
      } as any,
      codexRemoteControlPlaneService: { buildSnapshot: jest.fn() } as any,
      formatPermissionCreatedMessage: jest.fn(() => 'Permissao criada para o Codex Remote.'),
      buildPermissionKeyboard: jest.fn(() => keyboard),
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Permissao criada para o Codex Remote.'),
      expect.objectContaining({
        reply_markup: keyboard,
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('full-user-visible'), expect.anything());
  });

  it('routes Codex Remote profile creation payloads through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/codexremote profile create work -- {"label":"Work Codex","codexHome":"C:\\\\Users\\\\ermys\\\\.codex-work"}',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      action: { status: 'pending-approval', note: 'Aguardando aprovacao.' },
      session: null,
      permission: {
        permission_id: 'perm-1',
        status: 'pending',
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      codexRemoteActionService: { execute } as any,
      codexRemoteControlPlaneService: { buildSnapshot: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'create-profile',
      profileId: 'work',
      profileLabel: 'Work Codex',
      codexHome: 'C:\\Users\\ermys\\.codex-work',
    }));
  });

  it('accepts simple natural language for Codex Remote profile switching', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'Codex, troque o perfil para work-a',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      action: { note: 'Perfil trocado.' },
      session: null,
      permission: null,
      codexRemote: {
        activeProfile: { label: 'Work A' },
        sessionBroker: { telegramSummary: 'ok' },
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      codexRemoteActionService: { execute } as any,
      codexRemoteControlPlaneService: { buildSnapshot: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'select-profile',
      profileId: 'work-a',
    }));
  });

  it('accepts simple natural language for Codex Remote approvals', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'Codex Remote, aprove a permissao 1d5bb7f7-99ee-4bdd-ad6b-823d23b2d3c1',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      action: { note: 'Pedido aprovado.' },
      session: null,
      permission: {
        permission_id: '1d5bb7f7-99ee-4bdd-ad6b-823d23b2d3c1',
        status: 'approved',
      },
      codexRemote: {
        activeProfile: { label: 'Default Codex' },
        sessionBroker: { telegramSummary: 'ok' },
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      codexRemoteActionService: { execute } as any,
      codexRemoteControlPlaneService: { buildSnapshot: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'approve-permission',
      permissionId: '1d5bb7f7-99ee-4bdd-ad6b-823d23b2d3c1',
    }));
  });

  it('accepts simple natural language for listing Codex Remote approvals', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'Codex Remote, mostre as aprovacoes pendentes',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const buildSnapshot = jest.fn(async () => ({
      narrative: { headline: 'Codex Remote ativo.', operatorSummary: '1 aprovacao pendente.', nextAction: 'Revisar approvals.' },
      activeProfile: { label: 'Default Codex', id: 'default' },
      summary: { cliReady: true, trackedSessions: 1, runningSessions: 1, readyRemotePaths: 1 },
      visibility: { mode: 'visible', pendingApprovals: 1, note: 'Tudo visivel.' },
      remotePaths: [{ id: 'telegram', label: 'Telegram' }],
      sessionBroker: {
        telegramSummary: 'ok',
        approvals: [
          {
            permissionId: 'perm-123',
            kind: 'shell',
            actionId: 'run-command',
            sessionId: 'codex-demo',
            profileId: 'default',
            reason: 'Executar doctor supervisionado.',
          },
        ],
      },
      profiles: {
        narrative: { headline: '', operatorSummary: '' },
        health: { status: 'healthy', operatorSummary: '' },
        readiness: { status: 'ready', operatorSummary: '' },
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      codexRemoteActionService: { execute: jest.fn() } as any,
      codexRemoteControlPlaneService: { buildSnapshot } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(buildSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      runtimeUserId: 'telegram-user',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Aprovacoes do Codex Remote'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('perm-123'));
  });

  it('routes natural channel onboarding through the canonical setup turn service', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-setup',
      isGroup: false,
      rawText: 'Quero conectar o Zavorth no Slack native. Slack bot token é xoxb-123. Signing secret é shh-456. Aplique e valide.',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const buildTurn = jest.fn(async () => ({
      channelId: 'slack',
      mode: 'native',
      assistant: {
        selected: { channelId: 'slack' },
        channels: null,
      },
      extractedEntries: [],
      remainingEnvKeys: [],
      applyResult: null,
      doctorResult: null,
      sendTest: null,
      promotionReady: true,
      naturalReply: 'Slack pronto para continuar.',
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      naturalChannelSetupTurnService: { buildTurn } as any,
      channelActionService: { execute: jest.fn() } as any,
      integrationHubService: {
        buildIntegrationSnapshot: jest.fn(() => null),
        renderConnectReport: jest.fn(),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(buildTurn).toHaveBeenCalledWith(expect.objectContaining({
      channelId: 'slack',
      autoDoctor: true,
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Slack pronto para continuar.'));
  });

  it('keeps the same channel during a config follow-up in natural language', async () => {
    const buildTurn = jest.fn(async () => ({
      channelId: 'discord',
      mode: 'native',
      assistant: {
        selected: { channelId: 'discord' },
        channels: null,
      },
      extractedEntries: [],
      remainingEnvKeys: [],
      applyResult: null,
      doctorResult: null,
      sendTest: null,
      promotionReady: true,
      naturalReply: 'Discord pronto.',
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      naturalChannelSetupTurnService: { buildTurn } as any,
      channelActionService: { execute: jest.fn() } as any,
      integrationHubService: {
        buildIntegrationSnapshot: jest.fn(() => null),
        renderConnectReport: jest.fn(),
      } as any,
    });
    const firstCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-followup',
      isGroup: false,
      rawText: 'Quero conectar o Zavorth no Discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const secondCtx = {
      ...firstCtx,
      rawText: 'meu token do discord é abc123 guild id é 999, aplique',
      reply: jest.fn(async () => undefined),
    };

    await service.maybeHandle(firstCtx as any);
    await service.maybeHandle(secondCtx as any);

    expect(buildTurn).toHaveBeenLastCalledWith(expect.objectContaining({
      channelId: 'discord',
      autoApply: true,
    }));
    expect(secondCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Discord pronto.'));
  });

  it('routes natural permission list requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'mostre as permissoes pendentes',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const permissionService = {
      listRequests: jest.fn(async () => ([
        {
          permission_id: 'perm-123',
          status: 'pending',
          executor: 'external_executor',
          kind: 'workspace_access',
          reason: 'Acesso supervisionado ao workspace.',
        },
      ])),
      getRequest: jest.fn(),
      approveRequest: jest.fn(),
      rejectRequest: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      permissionService: permissionService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(permissionService.listRequests).toHaveBeenCalledWith('pending', 10);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('permissoes pendentes'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Permissoes do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('perm-123'));
  });

  it('routes natural permission approval requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'aprove a permissao perm-123',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const permission = {
      permission_id: 'perm-123',
      status: 'pending',
      scope: 'once',
      executor: 'external_executor',
      kind: 'workspace_access',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requested_value: 'workspace',
      resolved_value: 'workspace',
      requested_by: 'telegram-user',
      decided_by: null,
      decision_note: null,
      reason: 'Acesso supervisionado ao workspace.',
    };
    const permissionService = {
      listRequests: jest.fn(async () => ([permission])),
      getRequest: jest.fn(async () => permission),
      approveRequest: jest.fn(async () => ({
        ...permission,
        status: 'approved',
        decided_by: 'telegram-user',
      })),
      rejectRequest: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      permissionService: permissionService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(permissionService.approveRequest).toHaveBeenCalledWith(
      'perm-123',
      'telegram-user',
      {},
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('aprovar a permissao perm-123'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Permissao aprovada.'));
  });

  it('routes explicit selfmod preview requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: '42',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'selfmod src/sample.ts -- ajuste o guard',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const selfModificationCommandService = {
      createPreview: jest.fn(async () => ({
        success: true,
        mode: 'file',
        previewId: 'preview-1',
        relativePath: 'src/sample.ts',
        summary: 'Atualiza o guard.',
        diffSummary: '@@ -1 +1 @@',
        validationPlan: ['npm run build'],
      })),
      createGoalPreview: jest.fn(),
      applyPreview: jest.fn(),
      rollbackChangeSet: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      selfModificationCommandService: selfModificationCommandService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(selfModificationCommandService.createPreview).toHaveBeenCalledWith(
      'src/sample.ts',
      'ajuste o guard',
      '42',
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('fluxo guardado de auto-modificacao'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Preview de auto-modificacao pronto.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('selfmod apply preview-1'));
  });

  it('routes explicit /selfmod commands through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: '42',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/selfmod goal -- melhorar o gateway',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const selfModificationCommandService = {
      createPreview: jest.fn(),
      createGoalPreview: jest.fn(async () => ({
        success: true,
        mode: 'goal',
        previewId: 'preview-goal-1',
        summary: 'Plano de mudanca preparado.',
        changeCount: 2,
        validationPlan: ['npm run build'],
        optimizationAnalysis: {
          resourceDelta: {
            ramIdleMb: 96,
            diskMb: 24,
            processCount: 1,
            summary: '96 MB RAM | 24 MB disco | 1 proc',
            notes: ['Changeset mexe na surface web.'],
          },
          runtimeRisk: {
            level: 'high',
            score: 62,
            reasons: ['Mudanca toca runtime supervisionado.'],
            requiresRestart: true,
            requiresSupervisorAttention: true,
            launcherTouch: false,
          },
          companionImpact: {
            level: 'moderate',
            companionIds: ['zavorthBridge'],
            summary: 'Companions a revisar: zavorthBridge.',
            notes: ['Watchers do workspace podem sentir a mudanca.'],
            recommendedActions: ['/workspace optimize zavorthBridge'],
          },
          rollbackConfidence: 0.67,
          rollbackConfidenceLabel: 'medium',
          patternSignals: [
            {
              key: 'surface-web',
              strength: 'medium',
              summary: 'Padrao parecido ja precisou de rollback 1 vez(es).',
            },
          ],
          opportunities: [
            {
              id: 'zavorth-bridge-preset-review',
              category: 'workspace',
              title: 'Reaplicar preset leve para ZavorthBridge',
              summary: 'Revisar preset do workspace apos a mudanca.',
              recommendedCommand: '/workspace optimize zavorthBridge',
              appliesBecause: ['Companion impact cita ZavorthBridge.'],
            },
          ],
        },
      })),
      applyPreview: jest.fn(),
      rollbackChangeSet: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      selfModificationCommandService: selfModificationCommandService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(selfModificationCommandService.createGoalPreview).toHaveBeenCalledWith(
      'melhorar o gateway',
      '42',
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Preview de auto-modificacao pronto.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Risco de runtime: high'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Confianca de rollback: 67%'));
  });

});
