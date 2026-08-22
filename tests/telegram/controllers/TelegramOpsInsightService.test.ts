import { TelegramOpsInsightService } from '../../../src/telegram/controllers/TelegramOpsInsightService';

interface MockCapabilityLifecycleService {
  enableCapability: jest.Mock;
  buildApprovalRequest: jest.Mock;
  buildSnapshot: jest.Mock;
}

interface MockZavorthBridgePreferenceStore {
  getPreferredModel: jest.Mock;
}

interface MockDemoModeService {
  isEnabled: jest.Mock;
}

interface MockIntegrationHubService {
  [key: string]: unknown;
}

interface MockOperatorModeService {
  isEnabled: jest.Mock;
}

interface MockPresentationModeService {
  isEnabled: jest.Mock;
}

interface MockProductObservabilityService {
  buildSnapshot: jest.Mock;
}

interface MockRuntimeDiagnostics {
  writeSnapshot: jest.Mock;
}

interface MockControllerDeps {
  capabilityLifecycleService?: MockCapabilityLifecycleService;
  zavorthBridgePreferenceStore?: MockZavorthBridgePreferenceStore;
  demoModeService?: MockDemoModeService;
  integrationHubService?: MockIntegrationHubService;
  operatorModeService?: MockOperatorModeService;
  presentationModeService?: MockPresentationModeService;
  productObservabilityService?: MockProductObservabilityService;
  runtimeDiagnostics?: MockRuntimeDiagnostics;
}

describe('TelegramOpsInsightService', () => {
  function createService() {
    const capabilityLifecycleService: MockCapabilityLifecycleService = {
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
    };

    const service = new TelegramOpsInsightService({
      zavorthBridgePreferenceStore: { getPreferredModel: jest.fn().mockResolvedValue('gemini-2.5-pro') },
      demoModeService: { isEnabled: () => false },
      integrationHubService: {},
      operatorModeService: { isEnabled: () => false },
      presentationModeService: { isEnabled: () => false },
      productObservabilityService: { buildSnapshot: jest.fn().mockResolvedValue(null) },
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
      },
      capabilityLifecycleService,
    });

    return { service, capabilityLifecycleService };
  }

  it('defaults /enable to once scope when none is provided', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as { from: { id: number }; reply: jest.Mock };
    const { service, capabilityLifecycleService } = createService();

    await service.handleEnable(ctx as Parameters<typeof service.handleEnable>[0], 'media');

    expect(capabilityLifecycleService.enableCapability).toHaveBeenCalledWith('media', '42', 'once');
  });

  it('preserves an explicit scope when one is provided', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as { from: { id: number }; reply: jest.Mock };
    const { service, capabilityLifecycleService } = createService();

    await service.handleEnable(ctx as Parameters<typeof service.handleEnable>[0], 'media host');

    expect(capabilityLifecycleService.enableCapability).toHaveBeenCalledWith('media', '42', 'host');
  });

  it('renders /models through the Surface Response Telegram renderer', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as { reply: jest.Mock };
    const { service } = createService();

    await service.handleModels(ctx as Parameters<typeof service.handleModels>[0]);

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Zavorth Models And Providers');
    expect(ctx.reply.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.any(Array),
        }),
      }),
    );
    const options = ctx.reply.mock.calls[0][1];
    const buttons = options.reply_markup.inline_keyboard.flat();
    expect(buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Gemini', callback_data: '/model gemini' }),
        expect.objectContaining({ text: 'Gemma', callback_data: '/model gemma-2-27b-it' }),
        expect.objectContaining({ text: 'OpenAI', callback_data: '/model openai' }),
      ]),
    );
  });

  it('renders /status through the Surface Response Telegram renderer', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as { reply: jest.Mock };
    const { service } = createService();

    await service.handleStatus(ctx as Parameters<typeof service.handleStatus>[0]);

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Zavorth overview');
    expect(ctx.reply.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.any(Array),
        }),
      }),
    );
    const text = ctx.reply.mock.calls[0][0];
    const buttons = ctx.reply.mock.calls[0][1].reply_markup.inline_keyboard.flat();
    expect(text).toContain('Runtime, sidecars, tasks, and surfaces');
    expect(text).toContain('Active processes');
    expect(buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Hub', callback_data: 'hub:page:overview' }),
        expect.objectContaining({ text: 'ZavorthControl', callback_data: '/zavorthControl' }),
        expect.objectContaining({ text: 'Permissions', callback_data: '/perm list' }),
      ]),
    );
  });
});
