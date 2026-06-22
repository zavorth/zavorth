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

  let smartCommandSurfaceSpy: jest.SpyInstance;

  beforeEach(() => {
    smartCommandSurfaceSpy = jest.spyOn(ZavorthSmartCommandSurfaceService.prototype, 'canHandle').mockReturnValue(false);
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

  it('uses short channel conversation memory to prepare the recommended channel', async () => {
    const buildTurn = jest.fn(async ({ channelId }: any) => ({
      channelId,
      mode: 'stub',
      assistant: { selected: { channelId }, channels: null },
      extractedEntries: [],
      remainingEnvKeys: [],
      applyResult: null,
      doctorResult: null,
      sendTest: null,
      promotionReady: true,
      naturalReply: `${String(channelId || '').trim()} preparado para o proximo passo do Channel Mesh.`,
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      naturalChannelSetupTurnService: { buildTurn } as any,
      integrationHubService: {
        buildIntegrationSnapshot: jest.fn(() => null),
      } as any,
    });

    const recommendCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual canal fica melhor para trabalho',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...recommendCtx,
      rawText: 'vai com o recomendado',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(recommendCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(buildTurn).toHaveBeenCalledWith(expect.objectContaining({
      channelId: 'slack',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('slack preparado para o proximo passo do Channel Mesh.'));
  });

  it('uses short channel conversation memory to switch to a named channel', async () => {
    const buildTurn = jest.fn(async ({ channelId }: any) => ({
      channelId,
      mode: 'stub',
      assistant: { selected: { channelId }, channels: null },
      extractedEntries: [],
      remainingEnvKeys: [],
      applyResult: null,
      doctorResult: null,
      sendTest: null,
      promotionReady: true,
      naturalReply: `${String(channelId || '').trim()} preparado para o proximo passo do Channel Mesh.`,
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      naturalChannelSetupTurnService: { buildTurn } as any,
      integrationHubService: {
        buildIntegrationSnapshot: jest.fn(() => null),
      } as any,
    });

    const previewCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes de canal antes de conectar',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...previewCtx,
      rawText: 'na verdade o Slack',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(previewCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(buildTurn).toHaveBeenCalledWith(expect.objectContaining({
      channelId: 'slack',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('slack preparado para o proximo passo do Channel Mesh.'));
  });

  it('uses short channel conversation memory to prepare the two strongest channels', async () => {
    const execute = jest.fn(async ({ channelId }: any) => ({
      summary: `${String(channelId || '').trim()} preparado para o proximo passo do Channel Mesh.`,
      details: ['Fluxo guiado pronto.'],
      selected: {
        label: String(channelId || '').trim(),
        actionHint: 'Siga o onboarding oficial.',
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelActionService: { execute } as any,
    });

    const recommendCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual canal fica melhor para trabalho',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...recommendCtx,
      rawText: 'faz os dois',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(recommendCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      channelId: 'slack',
      actionId: 'prepare',
      requestedBy: 'telegram-user',
    }));
    expect(execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      channelId: 'imessage',
      actionId: 'prepare',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Preparei mais de um canal com base na conversa recente.'));
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
      summary: 'Doctor de Discord preparado.',
      details: ['npm run test:channels:smoke', 'Ultima leitura de saude: healthy.'],
      snapshot: {
        narrative: {
          operatorSummary: '1 pronto, 0 parcial.',
        },
      },
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      channelActionService: { execute } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      channelId: 'discord',
      actionId: 'doctor',
      requestedBy: 'telegram-user',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Doctor de Discord preparado.'));
  });

  it('routes natural plugin requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'instale o plugin openrouter',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      summary: 'OpenRouter registrado no plugin plane.',
      details: ['O Integration Hub abriu ou atualizou o draft desta integracao.'],
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      pluginActionService: { execute } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            { id: 'openrouter', label: 'OpenRouter', tags: ['llm', 'router'] },
          ],
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'openrouter',
      actionId: 'install',
      requestedBy: 'telegram-user',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('instalar ou registrar o plugin openrouter'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/plugins doctor openrouter'));
  });

  it('previews plugin options before installing when requested', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes de plugin antes de instalar',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({ summary: 'n/d', details: [] }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      pluginActionService: { execute } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            { id: 'openrouter', label: 'OpenRouter', tags: ['llm', 'router'] },
            { id: 'zavorthBridge', label: 'Zavorth Bridge', tags: ['mobile', 'bridge'] },
            { id: 'ops-telemetry', label: 'Ops Telemetry', tags: ['observability', 'logs'] },
          ],
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ainda nao instalei nenhum plugin novo. Aqui estao as opcoes mais naturais agora:'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('1. OpenRouter'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('2. Ops Telemetry'));
  });

  it('recommends a plugin before installing when asked', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual plugin fica melhor para llm',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({ summary: 'n/d', details: [] }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      pluginActionService: { execute } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            { id: 'openrouter', label: 'OpenRouter', tags: ['llm', 'router'] },
            { id: 'zavorthBridge', label: 'Zavorth Bridge', tags: ['mobile', 'bridge'] },
            { id: 'ops-telemetry', label: 'Ops Telemetry', tags: ['observability', 'logs'] },
          ],
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Melhor opcao: OpenRouter'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('para modelo, roteamento e multiplos providers'));
  });

  it('uses short plugin conversation memory to install the recommended plugin', async () => {
    const execute = jest.fn(async ({ pluginId }: any) => ({
      summary: `${String(pluginId || '').trim()} registrado no plugin plane.`,
      details: ['Fluxo guiado pronto.'],
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      pluginActionService: { execute } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            { id: 'openrouter', label: 'OpenRouter', tags: ['llm', 'router'] },
            { id: 'zavorthBridge', label: 'Zavorth Bridge', tags: ['mobile', 'bridge'] },
            { id: 'ops-telemetry', label: 'Ops Telemetry', tags: ['observability', 'logs'] },
          ],
        })),
      } as any,
    });

    const recommendCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual plugin fica melhor para llm',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...recommendCtx,
      rawText: 'vai com o recomendado',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(recommendCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'openrouter',
      actionId: 'install',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('openrouter registrado no plugin plane.'));
  });

  it('uses short plugin conversation memory to switch to a named plugin', async () => {
    const execute = jest.fn(async ({ pluginId }: any) => ({
      summary: `${String(pluginId || '').trim()} registrado no plugin plane.`,
      details: ['Fluxo guiado pronto.'],
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      pluginActionService: { execute } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            { id: 'openrouter', label: 'OpenRouter', tags: ['llm', 'router'] },
            { id: 'zavorthBridge', label: 'Zavorth Bridge', tags: ['mobile', 'bridge'] },
            { id: 'ops-telemetry', label: 'Ops Telemetry', tags: ['observability', 'logs'] },
          ],
        })),
      } as any,
    });

    const previewCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes de plugin antes de instalar',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...previewCtx,
      rawText: 'na verdade o OpenRouter',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(previewCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'openrouter',
      actionId: 'install',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('openrouter registrado no plugin plane.'));
  });

  it('uses short plugin conversation memory to install the two strongest plugins', async () => {
    const execute = jest.fn(async ({ pluginId }: any) => ({
      summary: `${String(pluginId || '').trim()} registrado no plugin plane.`,
      details: ['Fluxo guiado pronto.'],
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      pluginActionService: { execute } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            { id: 'openrouter', label: 'OpenRouter', tags: ['llm', 'router'] },
            { id: 'zavorthBridge', label: 'Zavorth Bridge', tags: ['mobile', 'bridge'] },
            { id: 'ops-telemetry', label: 'Ops Telemetry', tags: ['observability', 'logs'] },
          ],
        })),
      } as any,
    });

    const recommendCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual plugin fica melhor para llm',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...recommendCtx,
      rawText: 'faz os dois',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(recommendCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      pluginId: 'openrouter',
      actionId: 'install',
      requestedBy: 'telegram-user',
    }));
    expect(execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      pluginId: 'ops-telemetry',
      actionId: 'install',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Abri mais de um fluxo de plugin com base na conversa recente.'));
  });

  it('routes natural transport requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'repare o transporte do discord',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({
      summary: 'Discord transport recebeu um roteiro de repair.',
      details: ['Bridge reconciliado com sucesso.'],
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      remoteTransportActionService: { execute } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            { id: 'discord-transport', label: 'Discord transport', transport: 'discord-native-gateway' },
          ],
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      transportId: 'discord-transport',
      actionId: 'repair',
      requestedBy: 'telegram-user',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('reparar o transporte Discord transport'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/transports repair discord-transport'));
  });

  it('previews transport options before preparing when requested', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes de transporte antes de subir',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({ summary: 'n/d', details: [] }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      remoteTransportActionService: { execute } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            { id: 'AIGateway', label: 'AIGateway', transport: 'http-sidecar', kind: 'sidecar', direction: 'bidirectional', operatorSummary: 'Gateway proprio.', details: [] },
            { id: 'ZavorthTerminal', label: 'Zavorth Terminal', transport: 'http-sidecar', kind: 'sidecar', direction: 'bidirectional', operatorSummary: 'PTY remoto.', details: [] },
            { id: 'discord-transport', label: 'Discord transport', transport: 'discord-native-gateway', kind: 'bridge', direction: 'bidirectional', operatorSummary: 'Bridge do Discord.', details: [] },
            { id: 'node-host', label: 'Node host transport', transport: 'node-mesh-heartbeat', kind: 'node-host', direction: 'bidirectional', operatorSummary: 'Heartbeat do node.', details: [] },
          ],
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ainda nao subi nenhum transporte novo. Aqui estao as opcoes mais naturais agora:'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('1. AIGateway'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('2. Discord transport'));
  });

  it('recommends a transport before preparing when asked', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual transporte fica melhor para remoto',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const execute = jest.fn(async () => ({ summary: 'n/d', details: [] }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      remoteTransportActionService: { execute } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            { id: 'AIGateway', label: 'AIGateway', transport: 'http-sidecar', kind: 'sidecar', direction: 'bidirectional', operatorSummary: 'Gateway proprio.', details: [] },
            { id: 'discord-transport', label: 'Discord transport', transport: 'discord-native-gateway', kind: 'bridge', direction: 'bidirectional', operatorSummary: 'Bridge do Discord.', details: [] },
            { id: 'node-host', label: 'Node host transport', transport: 'node-mesh-heartbeat', kind: 'node-host', direction: 'bidirectional', operatorSummary: 'Heartbeat do node.', details: [] },
          ],
        })),
      } as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Melhor opcao: Node host transport'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('fila e heartbeat supervisionado'));
  });

  it('uses short transport conversation memory to prepare the recommended transport', async () => {
    const execute = jest.fn(async ({ transportId }: any) => ({
      summary: `${String(transportId || '').trim()} preparado no remote transport plane.`,
      details: ['Fluxo guiado pronto.'],
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      remoteTransportActionService: { execute } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
          entries: [
            { id: 'AIGateway', label: 'AIGateway', transport: 'http-sidecar', kind: 'sidecar', direction: 'bidirectional', operatorSummary: 'Gateway proprio.', details: [] },
            { id: 'discord-transport', label: 'Discord transport', transport: 'discord-native-gateway', kind: 'bridge', direction: 'bidirectional', operatorSummary: 'Bridge do Discord.', details: [] },
            { id: 'node-host', label: 'Node host transport', transport: 'node-mesh-heartbeat', kind: 'node-host', direction: 'bidirectional', operatorSummary: 'Heartbeat do node.', details: [] },
          ],
          selected: selectedId
            ? { id: selectedId, label: selectedId === 'node-host' ? 'Node host transport' : selectedId }
            : null,
        })),
      } as any,
    });

    const recommendCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual transporte fica melhor para remoto',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...recommendCtx,
      rawText: 'vai com o recomendado',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(recommendCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      transportId: 'node-host',
      actionId: 'prepare',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('node-host preparado no remote transport plane.'));
  });

  it('uses short transport conversation memory to switch to a named transport', async () => {
    const execute = jest.fn(async ({ transportId }: any) => ({
      summary: `${String(transportId || '').trim()} preparado no remote transport plane.`,
      details: ['Fluxo guiado pronto.'],
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      remoteTransportActionService: { execute } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
          entries: [
            { id: 'AIGateway', label: 'AIGateway', transport: 'http-sidecar', kind: 'sidecar', direction: 'bidirectional', operatorSummary: 'Gateway proprio.', details: [] },
            { id: 'ZavorthTerminal', label: 'Zavorth Terminal', transport: 'http-sidecar', kind: 'sidecar', direction: 'bidirectional', operatorSummary: 'PTY remoto.', details: [] },
            { id: 'node-host', label: 'Node host transport', transport: 'node-mesh-heartbeat', kind: 'node-host', direction: 'bidirectional', operatorSummary: 'Heartbeat do node.', details: [] },
          ],
          selected: selectedId
            ? { id: selectedId, label: selectedId === 'node-host' ? 'Node host transport' : selectedId }
            : null,
        })),
      } as any,
    });

    const previewCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes de transporte antes de subir',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...previewCtx,
      rawText: 'na verdade o node host',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(previewCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      transportId: 'node-host',
      actionId: 'prepare',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('node-host preparado no remote transport plane.'));
  });

  it('uses short transport conversation memory to prepare the two strongest transports', async () => {
    const execute = jest.fn(async ({ transportId }: any) => ({
      summary: `${String(transportId || '').trim()} preparado no remote transport plane.`,
      details: ['Fluxo guiado pronto.'],
    }));
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      remoteTransportActionService: { execute } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(({ selectedId }: any = {}) => ({
          entries: [
            { id: 'AIGateway', label: 'AIGateway', transport: 'http-sidecar', kind: 'sidecar', direction: 'bidirectional', operatorSummary: 'Gateway proprio.', details: [] },
            { id: 'discord-transport', label: 'Discord transport', transport: 'discord-native-gateway', kind: 'bridge', direction: 'bidirectional', operatorSummary: 'Bridge do Discord.', details: [] },
            { id: 'node-host', label: 'Node host transport', transport: 'node-mesh-heartbeat', kind: 'node-host', direction: 'bidirectional', operatorSummary: 'Heartbeat do node.', details: [] },
          ],
          selected: selectedId
            ? { id: selectedId, label: selectedId === 'node-host' ? 'Node host transport' : selectedId }
            : null,
        })),
      } as any,
    });

    const previewCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes de transporte antes de subir pra remoto',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...previewCtx,
      rawText: 'faz os dois',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(previewCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      transportId: 'node-host',
      actionId: 'prepare',
      requestedBy: 'telegram-user',
    }));
    expect(execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
      transportId: 'AIGateway',
      actionId: 'prepare',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Preparei mais de um transporte com base na conversa recente.'));
  });

  it('routes natural node pairing requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'quero parear um node desktop',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const nodePairingService = {
      createPairingDraft: jest.fn(() => ({
        pairingCode: 'PAIR-DESKTOP-1',
        bootstrap: {
          command: 'npm run companion:start -- --pairing-code PAIR-DESKTOP-1',
        },
        profile: { label: 'Desktop Companion' },
        entry: {
          id: 'desktop-node-1',
          label: 'Desktop Companion',
          transport: 'remote',
          capabilityIds: ['screen.capture', 'files.read'],
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
    expect(nodePairingService.createPairingDraft).toHaveBeenCalledWith(expect.objectContaining({
      profileId: 'desktop-companion',
      requestedBy: 'telegram-user',
    }));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('preparar um Desktop Companion no Node Mesh'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Pairing code: PAIR-DESKTOP-1.'));
  });

  it('previews node options before pairing when requested', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes de node antes de parear',
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
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Antes de parear um novo node, estas sao as opcoes mais naturais agora:'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('1. Headless Worker'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('2. Desktop Companion'));
  });

  it('recommends a node profile before pairing when asked', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual node fica melhor para desktop visual',
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
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Melhor opcao: Desktop Companion'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('contexto visual'));
  });

  it('uses short node conversation memory to pair the recommended profile', async () => {
    const nodePairingService = {
      createPairingDraft: jest.fn(({ profileId }: any) => ({
        pairingCode: `PAIR-${String(profileId || '').toUpperCase()}`,
        bootstrap: {
          command: `npm run companion:start -- --pairing-code ${String(profileId || '').toUpperCase()}`,
        },
        profile: { label: profileId === 'desktop-companion' ? 'Desktop Companion' : 'Headless Worker' },
        entry: {
          id: `${profileId}-node-1`,
          label: profileId === 'desktop-companion' ? 'Desktop Companion' : 'Headless Worker',
          transport: 'remote',
          capabilityIds: ['screen.capture', 'files.read'],
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      nodePairingService: nodePairingService as any,
    });

    const recommendCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'qual node fica melhor para desktop visual',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...recommendCtx,
      rawText: 'vai com o recomendado',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(recommendCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(nodePairingService.createPairingDraft).toHaveBeenCalledWith(expect.objectContaining({
      profileId: 'desktop-companion',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Pairing code: PAIR-DESKTOP-COMPANION.'));
  });

  it('uses short node conversation memory to switch to a named profile', async () => {
    const nodePairingService = {
      createPairingDraft: jest.fn(({ profileId }: any) => ({
        pairingCode: `PAIR-${String(profileId || '').toUpperCase()}`,
        bootstrap: {
          command: `npm run companion:start -- --pairing-code ${String(profileId || '').toUpperCase()}`,
        },
        profile: { label: profileId === 'mobile-companion' ? 'Mobile Companion' : 'Headless Worker' },
        entry: {
          id: `${profileId}-node-1`,
          label: profileId === 'mobile-companion' ? 'Mobile Companion' : 'Headless Worker',
          transport: 'remote',
          capabilityIds: ['camera.capture', 'location.read'],
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      nodePairingService: nodePairingService as any,
    });

    const previewCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes de node antes de parear',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...previewCtx,
      rawText: 'na verdade o mobile',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(previewCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(nodePairingService.createPairingDraft).toHaveBeenCalledWith(expect.objectContaining({
      profileId: 'mobile-companion',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Pairing code: PAIR-MOBILE-COMPANION.'));
  });

  it('uses short node conversation memory to pair the two strongest profiles', async () => {
    const nodePairingService = {
      createPairingDraft: jest.fn(({ profileId }: any) => ({
        pairingCode: `PAIR-${String(profileId || '').toUpperCase()}`,
        bootstrap: {
          command: `npm run companion:start -- --pairing-code ${String(profileId || '').toUpperCase()}`,
        },
        profile: { label: profileId === 'desktop-companion' ? 'Desktop Companion' : 'Headless Worker' },
        entry: {
          id: `${profileId}-node-1`,
          label: profileId === 'desktop-companion' ? 'Desktop Companion' : 'Headless Worker',
          transport: 'remote',
          capabilityIds: ['screen.capture', 'files.read'],
        },
      })),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      nodePairingService: nodePairingService as any,
    });

    const previewCtx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'me mostre as opcoes de node antes de parear pra desktop visual',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const followupCtx = {
      ...previewCtx,
      rawText: 'faz os dois',
      reply: jest.fn(async () => undefined),
    };

    expect(await service.maybeHandle(previewCtx as any)).toBe(true);
    expect(await service.maybeHandle(followupCtx as any)).toBe(true);

    expect(nodePairingService.createPairingDraft).toHaveBeenNthCalledWith(1, expect.objectContaining({
      profileId: 'desktop-companion',
      requestedBy: 'telegram-user',
    }));
    expect(nodePairingService.createPairingDraft).toHaveBeenNthCalledWith(2, expect.objectContaining({
      profileId: 'headless-worker',
      requestedBy: 'telegram-user',
    }));
    expect(followupCtx.reply).toHaveBeenCalledWith(expect.stringContaining('Preparei mais de um perfil de node com base na conversa recente.'));
  });

  it('routes natural session overview requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'mostre minhas sessoes',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const sessionPlaneService = {
      renderOverviewReport: jest.fn(async () => 'Session plane do Zavorth\n\nResumo operacional'),
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

  it('routes natural session replay requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'quero ver o replay da sessao web:session-9',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
    const sessionPlaneService = {
      renderHistoryReport: jest.fn(async () => 'Replay da sessao\n\nhandoff pronto'),
    };
    const service = new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
      sessionPlaneService: sessionPlaneService as any,
    });

    const handled = await service.maybeHandle(ctx as any);

    expect(handled).toBe(true);
    expect(sessionPlaneService.renderHistoryReport).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'telegram-user',
        platform: 'web',
        chatId: 'web:session-9',
        sessionId: 'session-9',
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('abrir o replay da sessao web:session-9'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Replay da sessao'));
  });

  it('routes natural session send requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'mande continue o plano para a sessao web:session-2',
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
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('enviar uma mensagem para a sessao web:session-2'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Mensagem despachada para a sessao.'));
  });

  it('routes natural memory plane requests through the shared surface', async () => {
    const ctx = {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: 'mostre a memory plane',
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
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('memory plane com retomada'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Retomada e entregas do Zavorth'));
  });

});
