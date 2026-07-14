import { TelegramPriorityCommandService } from '../../src/telegram/TelegramPriorityCommandService';

describe('TelegramPriorityCommandService (agent-first slash only)', () => {
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

  it('ignores free text entirely (no NLU steal)', async () => {
    const { deps, service } = createService();
    const handled = await service.handle({ reply: jest.fn() } as any, 'activate remote mode please');
    expect(handled).toBe(false);
    expect(deps.opsController.parseRemoteModeCommand).not.toHaveBeenCalled();
  });

  it('blocks priority slash commands while the security lock is active', async () => {
    const { deps, service } = createService();
    deps.securityLock.isLocked.mockReturnValue(true);
    deps.opsController.parseRemoteModeCommand.mockReturnValue('activate');
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const handled = await service.handle(ctx, '/remote on');

    expect(handled).toBe(true);
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Zavorth locked');
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

  it('does not redirect raw free-text model phrases', async () => {
    const { deps, service } = createService();
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    const handled = await service.handle(ctx, 'use o modelo gemini 3 flash');

    expect(handled).toBe(false);
    expect(deps.zavorthBridgeController.handleModelCommand).not.toHaveBeenCalled();
  });
});
