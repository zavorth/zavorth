import { SharedSurfaceCommandService } from '../../../src/services/SharedSurfaceCommandService';
import { ZavorthSmartCommandSurfaceService } from '../../../src/services/ZavorthSmartCommandSurfaceService';
import { config } from '../../../src/config/index';

describe('SharedSurfaceCommandService', () => {
  const originalProvider = config.llmProvider;
  const originalGeminiKeys = [...config.geminiApiKeys];
  const originalOpenAiKey = config.openaiApiKey;
  const originalOpenRouterKey = config.openRouterApiKey;
  const originalTelegramUserRoles = config.telegramUserRoles;
  const originalSelfmodPolicy = config.zavorthSelfmodPolicy;

  let smartCommandSurfaceSpy: jest.SpyInstance;

  beforeEach(() => {
    smartCommandSurfaceSpy = jest
      .spyOn(ZavorthSmartCommandSurfaceService.prototype, 'canHandle')
      .mockReturnValue(false);
  });

  afterEach(() => {
    smartCommandSurfaceSpy.mockRestore();
    (config as any).llmProvider = originalProvider;
    (config as any).geminiApiKeys = [...originalGeminiKeys];
    (config as any).openaiApiKey = originalOpenAiKey;
    (config as any).openRouterApiKey = originalOpenRouterKey;
    (config as any).telegramUserRoles = originalTelegramUserRoles;
    (config as any).zavorthSelfmodPolicy = originalSelfmodPolicy;
  });

  it('supports /channels doctor actions through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/channels doctor discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      ok: true,
      status: 'applied',
      channelId: 'discord',
      actionId: 'doctor',
      generatedAt: '2026-04-14T12:00:00.000Z',
      summary: 'Doctor de Discord preparado.',
      details: ['Doctor ran cleanly.'],
      selected: null,
      loginQr: null,
      snapshot: {
        selected: null,
        narrative: {
          operatorSummary: 'Discord doctor ready.',
          nextAction: 'Review doctor output.',
        },
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelActionService: { execute } as any,
      channelMeshService: {
        buildSnapshot: jest.fn(),
        renderReport: jest.fn(),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: 'discord',
        actionId: 'doctor',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Doctor de Discord preparado.'));
  });

  it('does not keyword-route free-text channel mesh conversation (agent-first purity)', async () => {
    const phrases = [
      'which channel is best for work',
      'vai com o recomendado',
      'me mostre as opcoes de canal antes de conectar',
      'na verdade o Slack',
      'faz os dois',
    ];
    const buildTurn = jest.fn(async () => ({ naturalReply: 'ok' }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      naturalChannelSetupTurnService: { buildTurn } as any,
      channelActionService: { execute: jest.fn() } as any,
      integrationHubService: {
        buildIntegrationSnapshot: jest.fn(() => null),
      } as any,
    });

    for (const rawText of phrases) {
      const ctx = {
        platform: 'telegram',
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
        isGroup: false,
        rawText,
        reply: jest.fn(async () => undefined),
        editMessage: jest.fn(async () => undefined),
      };
      expect(await service.maybeHandle(ctx as any)).toBe(false);
      expect(ctx.reply).not.toHaveBeenCalled();
    }
    expect(buildTurn).not.toHaveBeenCalled();
  });

  it('does not keyword-route free-text plugin requests (agent-first purity)', async () => {
    const phrases = [
      'instale o plugin openrouter',
      'me mostre as opcoes de plugin antes de instalar',
      'which plugin is best for llm',
      'vai com o recomendado',
      'na verdade o OpenRouter',
      'faz os dois',
    ];
    const pluginActionService = { execute: jest.fn() };
    const pluginRegistryService = {
      renderCatalogReport: jest.fn(() => 'Plugin plane'),
      buildSnapshot: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      pluginActionService: pluginActionService as any,
      pluginRegistryService: pluginRegistryService as any,
    });

    for (const rawText of phrases) {
      const ctx = {
        platform: 'telegram',
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
        isGroup: false,
        rawText,
        reply: jest.fn(async () => undefined),
        editMessage: jest.fn(async () => undefined),
      };
      expect(await service.maybeHandle(ctx as any)).toBe(false);
      expect(ctx.reply).not.toHaveBeenCalled();
    }
    expect(pluginActionService.execute).not.toHaveBeenCalled();
  });

  it('does not keyword-route free-text transport requests (agent-first purity)', async () => {
    const phrases = [
      'repare o transporte do discord',
      'me mostre as opcoes de transporte antes de subir',
      'which transport is best for remote work',
      'vai com o recomendado',
      'na verdade o node host',
      'faz os dois',
    ];
    const remoteTransportActionService = { execute: jest.fn() };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      remoteTransportActionService: remoteTransportActionService as any,
    });

    for (const rawText of phrases) {
      const ctx = {
        platform: 'telegram',
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
        isGroup: false,
        rawText,
        reply: jest.fn(async () => undefined),
        editMessage: jest.fn(async () => undefined),
      };
      expect(await service.maybeHandle(ctx as any)).toBe(false);
      expect(ctx.reply).not.toHaveBeenCalled();
    }
    expect(remoteTransportActionService.execute).not.toHaveBeenCalled();
  });

  it('does not keyword-route free-text node pairing requests (agent-first purity)', async () => {
    const phrases = [
      'quero parear um node desktop',
      'me mostre as opcoes de node antes de parear',
      'which node is best for visual desktop',
      'vai com o recomendado',
      'na verdade o mobile',
      'faz os dois',
    ];
    const sessionNodeService = {
      preparePairing: jest.fn(),
      renderReport: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      sessionNodeService: sessionNodeService as any,
    });

    for (const rawText of phrases) {
      const ctx = {
        platform: 'telegram',
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
        isGroup: false,
        rawText,
        reply: jest.fn(async () => undefined),
        editMessage: jest.fn(async () => undefined),
      };
      expect(await service.maybeHandle(ctx as any)).toBe(false);
      expect(ctx.reply).not.toHaveBeenCalled();
    }
  });

  it('does not keyword-route free-text session and memory plane requests (agent-first purity)', async () => {
    const phrases = [
      'show my sessions',
      'quero ver o replay da session web:session-9',
      'continue the plan for web session web:session-2',
      'mostre a memory plane',
    ];
    const sessionPlaneService = {
      renderReport: jest.fn(),
      buildSnapshot: jest.fn(),
    };
    const layeredMemoryService = {
      buildStatus: jest.fn(),
      search: jest.fn(),
      readProcedures: jest.fn(),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      sessionPlaneService: sessionPlaneService as any,
      layeredMemoryService: layeredMemoryService as any,
    });

    for (const rawText of phrases) {
      const ctx = {
        platform: 'telegram',
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
        isGroup: false,
        rawText,
        reply: jest.fn(async () => undefined),
        editMessage: jest.fn(async () => undefined),
      };
      expect(await service.maybeHandle(ctx as any)).toBe(false);
      expect(ctx.reply).not.toHaveBeenCalled();
    }
    expect(sessionPlaneService.renderReport).not.toHaveBeenCalled();
    expect(layeredMemoryService.buildStatus).not.toHaveBeenCalled();
  });
});
