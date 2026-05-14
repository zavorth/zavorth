import { TelegramPriorityCommandService } from '../../src/telegram/TelegramPriorityCommandService';

describe('TelegramPriorityCommandService', () => {
  function createService() {
    const deps = {
      opsController: {
        parseRemoteModeCommand: jest.fn().mockReturnValue(null),
        parseRuntimeMaintenanceCommand: jest.fn().mockReturnValue(null),
        handleRemoteMode: jest.fn().mockResolvedValue(undefined),
        handleChanges: jest.fn().mockResolvedValue(undefined),
        handleAutoRepair: jest.fn().mockResolvedValue(undefined),
        handleSelfUpdate: jest.fn().mockResolvedValue(undefined),
      },
      zavorthBridgeController: {
        parsePromptCommand: jest.fn().mockReturnValue(null),
        parseControlCommand: jest.fn().mockReturnValue(null),
        handlePrompt: jest.fn().mockResolvedValue(undefined),
        handleControl: jest.fn().mockResolvedValue(undefined),
        handleModelCommand: jest.fn().mockResolvedValue(undefined),
      },
      securityLock: {
        isLocked: jest.fn().mockReturnValue(false),
      },
    };

    return {
      deps,
      service: new TelegramPriorityCommandService(deps as any),
    };
  }

  it('blocks priority commands while the security lock is active', async () => {
    const { deps, service } = createService();
    deps.securityLock.isLocked.mockReturnValue(true);
    deps.opsController.parseRemoteModeCommand.mockReturnValue('activate');
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const handled = await service.handle(ctx, '/mode remote on');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Zavorth trancado'),
    );
    expect(deps.opsController.handleRemoteMode).not.toHaveBeenCalled();
  });

  it('maps autorepair maintenance flags to the legacy handler args', async () => {
    const { deps, service } = createService();
    deps.opsController.parseRuntimeMaintenanceCommand.mockReturnValue({
      action: 'autorepair',
      improve: true,
    });

    const handled = await service.handle({ reply: jest.fn() } as any, '/autorepair improve');

    expect(handled).toBe(true);
    expect(deps.opsController.handleAutoRepair).toHaveBeenCalledWith(
      expect.anything(),
      'improve',
    );
  });

  it('keeps the priority command contract deterministic when parsers overlap', async () => {
    const { deps, service } = createService();
    deps.opsController.parseRemoteModeCommand.mockReturnValue('activate');
    deps.opsController.parseRuntimeMaintenanceCommand.mockReturnValue({
      action: 'autorepair',
      force: true,
    });

    const handled = await service.handle({ reply: jest.fn() } as any, '/remote on');

    expect(handled).toBe(true);
    expect(deps.opsController.handleRemoteMode).toHaveBeenCalledWith(
      expect.anything(),
      'activate',
    );
    expect(deps.opsController.handleAutoRepair).not.toHaveBeenCalled();
  });

  it('redirects raw model messages to the explicit agmodel flow', async () => {
    const { deps, service } = createService();
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const handled = await service.handle(ctx, 'use o modelo gemini 3 flash');

    expect(handled).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('/agmodel Gemini 3 Flash'),
    );
    expect(deps.zavorthBridgeController.handleModelCommand).toHaveBeenCalledWith(
      ctx,
      'Gemini 3 Flash',
    );
  });
});
