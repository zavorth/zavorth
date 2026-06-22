import { SharedSurfaceCommandService } from '../../../src/services/SharedSurfaceCommandService';
import { DiscordSurfacePolicyService } from '../../../src/services/DiscordSurfacePolicyService';
import { ZavorthSmartCommandSurfaceService } from '../../../src/services/ZavorthSmartCommandSurfaceService';
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

  it('routes natural memory search requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'procure na memoria por gateway release',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const layeredMemoryService = {
      buildStatus: jest.fn(),
      search: jest.fn(async () => ({
        generatedAt: '2026-04-09T15:12:00.000Z',
        query: 'gateway release',
        total: 1,
        data: [
          {
            id: 'timeline-1',
            label: 'Gateway release',
            summary: 'Release final pronta.',
            memoryLayer: 'episodic',
            source: 'workflow',
            confidence: 0.74,
            lastValidatedAt: '2026-04-09T15:00:00.000Z',
          },
        ],
      })),
      readProcedures: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      layeredMemoryService: layeredMemoryService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(layeredMemoryService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'gateway release',
        userId: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('procurar "gateway release" na memoria'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Layered memory do Zavorth'));
  });

  it('allows Discord operational commands for configured owners in direct messages', async () => {
    const ctx = {
      platform: 'discord',
      userId: 'discord-owner',
      chatId: 'discord:dm:2',
      isGroup: false,
      rawText: '/reload force',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const supervisedRuntimeService = {
      summarizeRecentChanges: jest.fn(() => 'changes'),
      requestReload: jest.fn(async () => ({ accepted: true, summary: 'reload ok', requestId: '1' })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: supervisedRuntimeService as any,
      autoRepairService: { summarizeLastRun: jest.fn(() => 'status'), run: jest.fn() } as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({
        commandExposure: 'operator',
        publicServerMode: true,
        ownerUserIds: ['discord-owner'],
      }),
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(supervisedRuntimeService.requestReload).toHaveBeenCalledWith(
      expect.objectContaining({
        forceRestart: true,
        requestedBy: 'discord-owner',
      }),
    );
  });

  it('does not advertise operational commands in Discord help for public users', async () => {
    const ctx = {
      platform: 'discord',
      userId: 'discord-user',
      chatId: 'discord:guild:1:channel:2',
      isGroup: true,
      rawText: '/help',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({
        commandExposure: 'minimal',
        operatorUserIds: [],
      }),
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.not.stringContaining('/reload'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Comandos operacionais ficam restritos'));
  });

  it('handles natural-language ZavorthBridge mobile requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'preciso usar o zavorthBridge pelo celular agora',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const zavorthBridgeMobileAccessService = {
      start: jest.fn(async () => ({
        action: 'start',
        ok: true,
        state: 'active',
        mode: 'public',
        readyForRemoteUse: true,
        accessUrl: 'https://ag.example.com',
        publicUrl: 'https://ag.example.com',
        localUrl: 'http://192.168.0.20:4747',
        requiresPassword: true,
        secret: 'mobile-secret',
        lease: { active: true, expiresAt: '2026-04-04T20:00:00.000Z' },
        verification: {
          ok: true,
          summary: 'URL final validada com HTTP 200 na rota principal.',
          targetUrl: 'https://ag.example.com',
          httpStatus: 200,
        },
        summary: 'Acesso movel do ZavorthBridge ativo via URL publica.',
        recommendations: [],
        doctorSummary: 'Doctor concluiu com sucesso.',
        guide: {
          steps: ['Abra o link no celular.'],
          notes: [],
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      zavorthBridgeMobileAccessService: zavorthBridgeMobileAccessService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(false);
    expect(zavorthBridgeMobileAccessService.start).not.toHaveBeenCalled();
  });

  it('handles /skills through the shared surface command plane', async () => {
    const smartSpy = jest.spyOn(ZavorthSmartCommandSurfaceService.prototype, 'canHandle').mockReturnValue(false);
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/skills recipe security-hardening',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const skillInstallPlanPresentationService = {
      renderReport: jest.fn(() => 'skill plan'),
    };
    const skillLibraryPresentationService = {
      renderReport: jest.fn(() => 'skill library'),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      skillLibraryPresentationService: skillLibraryPresentationService as any,
      skillInstallPlanPresentationService: skillInstallPlanPresentationService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(skillInstallPlanPresentationService.renderReport).toHaveBeenCalledWith({
      recipeId: 'security-hardening',
    });
    expect(ctx.reply).toHaveBeenCalledWith('skill plan');
    smartSpy.mockRestore();
  });

  it('handles /agmobile status through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/agmobile status',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const zavorthBridgeMobileAccessService = {
      status: jest.fn(async () => ({
        action: 'status',
        ok: true,
        state: 'ready',
        mode: 'lan',
        readyForRemoteUse: true,
        accessUrl: 'http://192.168.0.20:4747',
        publicUrl: null,
        localUrl: 'http://192.168.0.20:4747',
        requiresPassword: false,
        secret: null,
        lease: { active: false, expiresAt: null },
        verification: null,
        summary: 'Remoto do ZavorthBridge pronto para celular via LAN.',
        recommendations: [],
        doctorSummary: null,
        guide: {
          steps: ['Conecte o celular na mesma rede e abra o link.'],
          notes: [],
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      zavorthBridgeMobileAccessService: zavorthBridgeMobileAccessService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(zavorthBridgeMobileAccessService.status).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('http://192.168.0.20:4747'));
  });

  it('starts the Zavorth-owned AIGateway route through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/AIGateway start',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const AIGatewayGatewayLauncherService = {
      ensureStarted: jest.fn(async () => ({
        enabled: true,
        ready: true,
        running: true,
        pid: 5501,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        checkedAt: '2026-04-05T12:00:00.000Z',
        message: 'Gateway proprio do AIGateway ativo.',
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      AIGatewayGatewayLauncherService: AIGatewayGatewayLauncherService as any,
      AIGatewayGatewayService: {
        readStatus: jest.fn(),
      } as any,
      GatewayCompatibilityDoctorService: {
        run: jest.fn(),
      } as any,
      GatewayUpstreamSyncService: {
        sync: jest.fn(),
        promote: jest.fn(),
        rollback: jest.fn(),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(AIGatewayGatewayLauncherService.ensureStarted).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('http://127.0.0.1:21128/v1'));
  });

  it('advertises operational commands in Discord help for operators', async () => {
    const ctx = {
      platform: 'discord',
      userId: 'discord-owner',
      chatId: 'discord:dm:owner',
      isGroup: false,
      rawText: '/help',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({
        publicServerMode: true,
        commandExposure: 'minimal',
        ownerUserIds: ['discord-owner'],
      }),
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/reload'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/autorepair'));
  });

  it('blocks Discord operational commands for the owner inside public guild channels', async () => {
    const ctx = {
      platform: 'discord',
      userId: 'discord-owner',
      chatId: 'discord:guild:1:channel:2',
      isGroup: true,
      rawText: '/autorepair',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const autoRepairService = { summarizeLastRun: jest.fn(() => 'status'), run: jest.fn() };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: autoRepairService as any,
      discordSurfacePolicyService: new DiscordSurfacePolicyService({
        publicServerMode: true,
        commandExposure: 'minimal',
        ownerUserIds: ['discord-owner'],
      }),
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('DM owner-only'));
    expect(autoRepairService.run).not.toHaveBeenCalled();
  });

  it('handles session plane overview commands when the session plane is attached', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/sessions',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const sessionPlaneService = {
      renderOverviewReport: jest.fn(async () => 'Session plane do Zavorth\n\nResumo'),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      sessionPlaneService: sessionPlaneService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(sessionPlaneService.renderOverviewReport).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'telegram-user',
        platform: 'telegram',
        chatId: 'telegram:chat-1',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Session plane do Zavorth'));
  });

  it('renders the memory plane through the shared command surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/memoryplane',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const memoryPlaneService = {
      buildSnapshot: jest.fn(async () => ({
        summary: {
          persistedMemories: 2,
          replayTasks: 1,
          workflowRuns: 1,
          artifacts: 1,
        },
        memory: {
          relevant: [
            {
              key: 'workspace-focus',
              value: 'Consolidar o briefing final.',
            },
          ],
        },
        artifacts: {
          recent: [
            {
              label: 'briefing-final.md',
              summary: 'Briefing consolidado.',
            },
          ],
        },
        replay: {
          recommendedEntry: {
            reason: 'Existe um melhor ponto de retomada.',
          },
        },
        workspace: null,
        suggestedActions: [
          {
            label: 'Abrir contexto',
            command: '/sessionhistory web:session-1',
          },
        ],
        narrative: {
          headline: 'Retomada e entregas prontas.',
          operatorSummary: 'Snapshot oficial do memory plane.',
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      memoryPlaneService: memoryPlaneService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(memoryPlaneService.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'telegram-user',
        platform: 'telegram',
        chatId: 'telegram:chat-1',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Retomada e entregas do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('briefing-final.md'));
  });

  it('renders the learning plane and applies explicit review actions through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/learning promote candidate:wf-1',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const learningPlaneService = {
      buildSnapshot: jest.fn(() => ({
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
            title: 'Ship playbook',
            kind: 'playbook',
            score: 0.88,
            reviewState: 'pending',
            lifecycle: 'learned_draft',
            summary: 'Playbook aprendido.',
          },
        ],
        narrative: {
          headline: 'Learning com 1 candidato.',
          operatorSummary: '1 pendente.',
        },
      })),
      executeAction: jest.fn(() => ({
        generatedAt: '2026-04-09T15:10:00.000Z',
        candidateId: 'candidate:wf-1',
        actionId: 'promote',
        status: 'applied',
        ok: true,
        summary: 'Ship playbook promovido para trusted local.',
        details: ['Gate explicito aplicado.'],
        snapshot: {
          generatedAt: '2026-04-09T15:10:00.000Z',
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
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      learningPlaneService: learningPlaneService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(learningPlaneService.executeAction).toHaveBeenCalledWith({
      candidateId: 'candidate:wf-1',
      actionId: 'promote',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Learning plane do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('trusted local'));
  });

  it('renders layered memory search through the shared command surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/memory search gateway release',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const layeredMemoryService = {
      buildStatus: jest.fn(),
      search: jest.fn(async () => ({
        generatedAt: '2026-04-09T15:12:00.000Z',
        query: 'gateway release',
        total: 2,
        data: [
          {
            id: 'timeline-1',
            label: 'Gateway release',
            summary: 'Release final pronta.',
            memoryLayer: 'episodic',
            source: 'workflow',
            confidence: 0.74,
            lastValidatedAt: '2026-04-09T15:00:00.000Z',
          },
          {
            id: 'candidate:wf-1',
            label: 'Ship playbook',
            summary: 'Playbook aprendido.',
            memoryLayer: 'procedural',
            source: 'learning-plane',
            confidence: 0.88,
            lastValidatedAt: '2026-04-09T15:00:00.000Z',
          },
        ],
      })),
      readProcedures: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      layeredMemoryService: layeredMemoryService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(layeredMemoryService.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'gateway release',
        userId: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Layered memory do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Gateway release'));
  });

  it('renders the gateway through the shared command surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/gateway',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const gatewayService = {
      buildHydratedSnapshot: jest.fn(async () => ({
        summary: {
          channelsReady: 2,
          channelsTotal: 4,
          runtimeModesReady: 3,
          teams: 3,
          nodesPaired: 1,
          sessionTargets: 2,
          toolFamilies: 8,
          plugins: 4,
          memoryArtifacts: 2,
        },
        narrative: {
          headline: 'Gateway pronto.',
          operatorSummary: 'Snapshot canonico.',
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      gatewayService: gatewayService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(gatewayService.buildHydratedSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
      }),
    );
    expect(ctx.reply.mock.calls[0][0]).toContain('Gateway do Zavorth');
    expect(ctx.reply.mock.calls[0][0]).toContain('Gateway pronto.');
  });

  it('renders the tool surface through the shared command surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/tools',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const toolSurfaceService = {
      buildSnapshot: jest.fn(() => ({
        summary: {
          families: 6,
          ready: 4,
          partial: 1,
          planned: 1,
          explicitTools: 17,
        },
        families: [
          {
            label: 'Session tools',
            summary: 'Listagem, historico, envio e spawn de sessao.',
          },
        ],
        catalog: {
          entries: [
            {
              id: 'read_file',
              label: 'read_file',
              familyLabel: 'Runtime Tools',
              command: null,
            },
          ],
          selected: null,
        },
        narrative: {
          headline: 'Plano oficial de tools.',
          operatorSummary: '4 familias prontas.',
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      toolSurfaceService: toolSurfaceService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(toolSurfaceService.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Tool Surface do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Plano oficial de tools.'));
  });

  it('renders the hook plane through the shared command surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/hooks transport',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const hookPlaneService = {
      buildSnapshot: jest.fn(() => ({
        summary: {
          supportedEvents: 12,
          coveredEvents: 3,
          readyEvents: 4,
          partialEvents: 6,
          plannedEvents: 2,
          customEvents: 0,
          registeredHooks: 3,
          workspaces: 2,
        },
        events: [
          {
            id: 'transport.before_action',
            label: 'Antes do transporte',
            stage: 'transport',
            description: 'Valida o transporte remoto antes da acao.',
            status: 'ready',
            registeredHooks: 2,
            sampleCommand: 'npm run hooks:transport:before',
          },
        ],
        registrations: [
          {
            workspace: 'workspace-alpha',
            workspaceName: 'Workspace Alpha',
            event: 'transport.before_action',
            command: 'npm run hooks:transport:before',
          },
        ],
        narrative: {
          headline: 'Plano oficial de hooks.',
          operatorSummary: '3 hooks registrados.',
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      hookPlaneService: hookPlaneService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(hookPlaneService.buildSnapshot).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Hook Plane do Zavorth'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Filtro atual: transport'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Workspace Alpha: transport.before_action -> npm run hooks:transport:before'));
  });

  it('renders a focused tool inspection when /tools receives a filter', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/tools read_file',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const toolSurfaceService = {
      buildSnapshot: jest.fn(() => ({
        summary: {
          families: 6,
          ready: 4,
          partial: 1,
          planned: 1,
          explicitTools: 17,
        },
        families: [],
        catalog: {
          entries: [
            {
              id: 'read_file',
              label: 'read_file',
              familyLabel: 'Runtime Tools',
              kind: 'runtime-tool',
              readiness: 'ready',
              summary: 'Le um arquivo do workspace.',
              command: null,
              details: ['1 parametro(s).', '1 obrigatorio(s).'],
            },
          ],
          selected: {
            id: 'read_file',
            label: 'read_file',
            familyLabel: 'Runtime Tools',
            kind: 'runtime-tool',
            readiness: 'ready',
            summary: 'Le um arquivo do workspace.',
            command: null,
            details: ['1 parametro(s).', '1 obrigatorio(s).'],
          },
        },
        narrative: {
          headline: 'Tool surface com 1 item visivel.',
          operatorSummary: 'Item em foco.',
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      toolSurfaceService: toolSurfaceService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(toolSurfaceService.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
        query: 'read_file',
        selectedId: 'read_file',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Filtro atual: read_file'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Em foco: read_file'));
  });

  it('dispatches sessionsend through the session plane', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/sessionsend web:session-2 -- continue o plano',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const sessionPlaneService = {
      sendToSession: jest.fn(async () => ({
        ok: true,
        taskId: 'task-2',
        chatId: 'web:session-2',
        sessionId: 'session-2',
        platform: 'web',
        snapshot: {
          replay: { operatorSummary: 'Replay atualizado.' },
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      sessionPlaneService: sessionPlaneService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(sessionPlaneService.sendToSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'telegram-user',
        platform: 'web',
        chatId: 'web:session-2',
        sessionId: 'session-2',
        text: 'continue o plano',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Mensagem despachada para a sessao.'));
  });

  it('creates a device-profile pairing draft through the shared command surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/nodepair desktop Oracle Node',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const nodePairingService = {
      createPairingDraft: jest.fn(() => ({
        pairingCode: 'PAIR-CODE-1',
        bootstrap: {
          packageScript: 'companion:start',
          command: 'npm run companion:start -- --passcode \"oracle-node:PAIR-CODE-1\" --base-url http://127.0.0.1:33333 --node-id oracle-node --workspace \"C:/workspace/demo\" --label \"Oracle Node\" --surface desktop --capabilities screen.capture,notifications.send,clipboard.read',
          fallbackCommand: 'node apps/zavorth-companion/index.js \"oracle-node:PAIR-CODE-1\"',
          pairingToken: 'oracle-node:PAIR-CODE-1',
          workspaceHint: 'C:/workspace/demo',
          notes: ['Companion bootstrap'],
        },
        profile: {
          id: 'desktop-companion',
          label: 'Desktop Companion',
        },
        entry: {
          id: 'oracle-node',
          label: 'Oracle Node',
          transport: 'remote',
          capabilityIds: ['screen.capture', 'notifications.send', 'clipboard.read'],
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      nodePairingService: nodePairingService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(nodePairingService.createPairingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Oracle Node',
        profileId: 'desktop-companion',
        requestedBy: 'telegram-user',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Perfil: Desktop Companion.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Pairing code: PAIR-CODE-1.'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('npm run companion:start --'));
  });

  it('keeps /nodepair, /nodes and /nodeinvoke coherent on the same shared-service runtime', async () => {
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
    });

    const pairCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/nodepair headless Oracle Worker',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    await service.maybeHandle(pairCtx as any);

    const pairReply = String(pairCtx.reply.mock.calls[0]?.[0] || '');
    const nodeId = pairReply.match(/Node ID: ([^.]+)\./)?.[1] || null;
    expect(nodeId).toBeTruthy();

    const snapshotCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: `/nodes ${nodeId}`,
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const invokeCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: `/nodeinvoke ${nodeId} system.run run {"command":"echo ok"}`,
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    await service.maybeHandle(snapshotCtx as any);
    await service.maybeHandle(invokeCtx as any);

    expect(snapshotCtx.reply).toHaveBeenCalledWith(expect.stringContaining(`Node em foco: Oracle Worker.`));
    expect(snapshotCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Fila: 0 pendente(s) / 0 claimed.'));
    expect(invokeCtx.reply).toHaveBeenCalledWith(expect.stringContaining('O node ainda nao concluiu o pareamento'));
    expect(invokeCtx.reply).not.toHaveBeenCalledWith(expect.stringContaining('Node nao encontrado no registry atual.'));
  });

  it('renders node profiles through /nodes profiles on the shared command surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/nodes profiles',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Perfis do Node Mesh'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Headless Worker [headless-worker]'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Desktop Companion [desktop-companion]'));
  });

  it('renders node capabilities through /nodes capabilities on the shared command surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/nodes capabilities',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Capabilities do Node Mesh'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Browser Proxy [browser.proxy]'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Files Watch [files.watch]'));
  });

  it('renders node queue/history views through /nodes subcommands on the shared command surface', async () => {
    const nodeMeshService = {
      buildSnapshot: jest.fn(({ selectedNodeId }: any = {}) => ({
        summary: {
          total: 1,
          paired: 1,
          pending: 0,
          online: 1,
          offline: 0,
          invokable: 1,
          capabilities: 3,
          queued: 1,
          completedRecently: 1,
        },
        entries: [],
        selected: {
          id: selectedNodeId || 'oracle-node',
          label: 'Oracle Node',
        },
        selectedActivity: {
          nodeId: selectedNodeId || 'oracle-node',
          activeInvocations: [
            {
              capabilityId: 'files.watch',
              status: 'pending',
              resultSummary: null,
            },
          ],
          recentInvocations: [
            {
              capabilityId: 'browser.proxy',
              status: 'completed',
              resultSummary: 'Endpoint confirmado.',
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
            headline: 'Node Oracle Node tem fila remota ativa.',
            operatorSummary: 'Ultima activity: browser.proxy em status completed.',
          },
        },
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh pronto.',
          operatorSummary: '1 node pareado.',
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      nodeMeshService: nodeMeshService as any,
    });

    const queueCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/nodes queue oracle-node',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const historyCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/nodes history oracle-node',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    await service.maybeHandle(queueCtx as any);
    await service.maybeHandle(historyCtx as any);

    expect(nodeMeshService.buildSnapshot).toHaveBeenCalledWith({ selectedNodeId: 'oracle-node' });
    expect(queueCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Fila do Node Mesh'));
    expect(queueCtx.reply).toHaveBeenCalledWith(expect.stringContaining('files.watch (pending)'));
    expect(historyCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Historico do Node Mesh'));
    expect(historyCtx.reply).toHaveBeenCalledWith(expect.stringContaining('browser.proxy (completed)'));
  });

  it('renders the plugin plane through the shared command surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/plugins openrouter',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const pluginRegistryService = {
      renderCatalogReport: jest.fn(() => 'Plugin plane do Zavorth\n\nOpenRouter'),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      pluginRegistryService: pluginRegistryService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(pluginRegistryService.renderCatalogReport).toHaveBeenCalledWith({
      selectedId: 'openrouter',
      query: 'openrouter',
    });
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Plugin plane do Zavorth'));
  });

  it('routes natural agent and skill invocation before generic task dispatch', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'mande um agente pesquisar e outro validar canais',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const plan = jest.fn(async (input: any) => ({
      generatedAt: '2026-05-10T14:10:00.000Z',
      contractVersion: '2026-05-10.natural-invocation-checkpoint-5',
      source: 'ZavorthNaturalInvocationRouter',
      status: 'ready',
      channel: input.channel,
      actorId: input.actorId,
      requestText: input.text,
      primaryAction: 'spawn_team',
      actions: ['spawn_team'],
      confidence: 0.94,
      candidates: [],
      selectedSkillName: null,
      selectedSubagentMode: 'session',
      selectedRoleIds: ['planner', 'researcher', 'qa'],
      subagentAutoInvocation: null,
      sourcePath: null,
      approval: { required: false, reason: null, approvalId: null },
      safety: {
        policyBrokerRequired: true,
        skillContentIsUntrustedByDefault: true,
        importedSkillsAreInstructionsOnly: true,
        liveUseRequiresApproval: true,
        workspaceMutationRequiresApproval: true,
        sensitiveNetworkRequiresApproval: true,
      },
      execution: { subagentRuntime: null, skillBridge: null },
      surfaceCommands: [
        { command: '/agents', description: 'Agent status' },
        { command: '/invoke <request>', description: 'Natural invoke' },
      ],
      receipts: [],
      narrative: {
        headline: 'Natural invocation routed',
        summary: 'Router selected spawn_team.',
        nextAction: 'Execute the selected route or answer directly.',
      },
      commands: {
        invoke: 'npm run zavorth:natural-invocation -- --text "<request>"',
        invokeJson: 'npm run zavorth:natural-invocation:json -- --text "<request>"',
        check: 'npm run zavorth:natural-invocation:check --silent',
        nextStage: 'Runtime gateway - Absorption Materialization And Bridge Handoff',
      },
    }));
    const surfaceTaskDispatcher = {
      dispatch: jest.fn(),
      dispatchFromSurface: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      naturalInvocationRouterService: {
        plan,
        renderPlan: jest.fn(),
      } as any,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(plan).toHaveBeenCalledWith(expect.objectContaining({
      text: 'mande um agente pesquisar e outro validar canais',
      autoExecute: true,
      channel: 'telegram',
      actorId: 'telegram-user',
    }));
    expect(surfaceTaskDispatcher.dispatch).not.toHaveBeenCalled();
    expect(surfaceTaskDispatcher.dispatchFromSurface).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Acao: spawn_team'), expect.anything());
  });

});
