import { TelegramOpsInsightService } from '../../../src/telegram/controllers/TelegramOpsInsightService';

describe('TelegramOpsInsightService', () => {
  function createService() {
    const capabilityLifecycleService = {
      enableCapability: jest.fn().mockReturnValue({
        capabilityId: 'media',
        state: 'ready',
        activationMode: 'lazy',
        approvalRequired: true,
        approvalScope: 'once',
        estimatedFootprint: { ramIdleMb: 96, diskMb: 512, processCount: 0 },
        fallbackBehavior: 'fallback',
      }),
      buildApprovalRequest: jest.fn().mockReturnValue({
        capabilityId: 'media',
        capabilityLabel: 'Media tooling',
        requestedBy: '42',
        requestedAt: new Date().toISOString(),
        reason: 'manual enable',
        defaultScope: 'once',
        availableScopes: ['once', 'session', 'host'],
        estimatedFootprint: { ramIdleMb: 96, diskMb: 512, processCount: 0 },
      }),
      buildSnapshot: jest.fn().mockReturnValue({
        profile: 'core',
        summary: { total: 1, active: 1, dormant: 0 },
        capabilities: [],
      }),
    } as any;

    const service = new TelegramOpsInsightService({
      zavorthBridgePreferenceStore: { getPreferredModel: jest.fn().mockResolvedValue('gemini-2.5-pro') } as any,
      demoModeService: { isEnabled: () => false } as any,
      integrationHubService: {} as any,
      operatorModeService: { isEnabled: () => false } as any,
      presentationModeService: { isEnabled: () => false } as any,
      productObservabilityService: { buildSnapshot: jest.fn().mockResolvedValue(null) } as any,
      runtimeDiagnostics: {
        writeSnapshot: jest.fn().mockReturnValue({
          process: {
            uptimeSeconds: 1800,
            rssMb: 96,
            heapMb: 48,
            platform: 'win32',
            cpuArch: 'x64',
          },
          runtime: {
            hostSupervisor: { pid: 123, alive: true },
            telegramWorker: { pid: 456, alive: true },
          },
          tasks: {
            activeCount: 1,
            staleCount: 0,
            byStatus: { running: 1 },
            recentFailures: [],
          },
        }),
      } as any,
      capabilityLifecycleService,
    });

    return { service, capabilityLifecycleService };
  }

  it('defaults /enable to once scope when none is provided', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const { service, capabilityLifecycleService } = createService();

    await service.handleEnable(ctx, 'media');

    expect(capabilityLifecycleService.enableCapability).toHaveBeenCalledWith('media', '42', 'once');
  });

  it('preserves an explicit scope when one is provided', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const { service, capabilityLifecycleService } = createService();

    await service.handleEnable(ctx, 'media host');

    expect(capabilityLifecycleService.enableCapability).toHaveBeenCalledWith('media', '42', 'host');
  });

  it('renders /models through the Surface Response Telegram renderer', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const { service } = createService();

    await service.handleModels(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Modelos e providers do Zavorth'),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.any(Array),
        }),
      }),
    );
    const options = ctx.reply.mock.calls[0][1];
    const buttons = options.reply_markup.inline_keyboard.flat();
    expect(buttons).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Gemini', callback_data: '/model gemini' }),
      expect.objectContaining({ text: 'Gemma', callback_data: '/model gemma-2-27b-it' }),
      expect.objectContaining({ text: 'OpenAI', callback_data: '/model openai' }),
    ]));
  });

  it('renders /status through the Surface Response Telegram renderer', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const { service } = createService();

    await service.handleStatus(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Panorama do Zavorth'),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.any(Array),
        }),
      }),
    );
    const text = ctx.reply.mock.calls[0][0];
    const buttons = ctx.reply.mock.calls[0][1].reply_markup.inline_keyboard.flat();
    expect(text).toContain('Runtime, sidecars, tarefas e superficies');
    expect(text).toContain('Processos ativos');
    expect(buttons).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Hub', callback_data: 'hub:page:overview' }),
      expect.objectContaining({ text: 'Dashboard', callback_data: '/dashboard' }),
      expect.objectContaining({ text: 'Permissoes', callback_data: '/perm list' }),
    ]));
  });
});
