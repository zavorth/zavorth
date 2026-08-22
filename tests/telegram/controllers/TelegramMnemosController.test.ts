import { TelegramMnemosController } from '../../../src/telegram/controllers/TelegramMnemosController';

interface MockContext {
  answerCallbackQuery: jest.Mock;
  editMessageText: jest.Mock;
  reply: jest.Mock;
}

interface MockLogRepo {
  log: jest.Mock;
}

interface MockMcpRuntimeService {
  readSnapshot: jest.Mock;
}

interface MockMnemosService {
  processCallback: jest.Mock;
}

function createCtx(): MockContext {
  return {
    answerCallbackQuery: jest.fn().mockResolvedValue(undefined),
    editMessageText: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
  };
}

describe('TelegramMnemosController', () => {
  it('routes Mnemos callbacks through the human-in-the-loop service', async () => {
    const processCallback = jest.fn().mockResolvedValue({
      handled: true,
      responseText: 'indexado',
      action: 'index_confirm',
      error: null,
    });
    const ctx = createCtx();
    const controller = new TelegramMnemosController({
      logRepo: { log: jest.fn() } as unknown as MockLogRepo,
      mcpRuntimeService: { readSnapshot: jest.fn() } as unknown as MockMcpRuntimeService,
      mnemosService: { processCallback } as unknown as MockMnemosService,
    });

    await controller.handleMnemosCallback(ctx as unknown as Parameters<typeof controller.handleMnemosCallback>[0], 'mnemos:index_confirm:path');

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(processCallback).toHaveBeenCalledWith('mnemos:index_confirm:path', expect.any(Object));
    expect(ctx.editMessageText).toHaveBeenCalledWith('indexado');
  });

  it('responds safely when the MCP runtime is unavailable', async () => {
    const ctx = createCtx();
    const controller = new TelegramMnemosController({
      logRepo: { log: jest.fn() } as unknown as MockLogRepo,
      mcpRuntimeService: null,
      mnemosService: { processCallback: jest.fn() } as unknown as MockMnemosService,
    });

    await controller.handleMnemosCallback(ctx as unknown as Parameters<typeof controller.handleMnemosCallback>[0], 'mnemos:vault_status');

    expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining('Mnemos is not connected'));
  });

  it('falls back to reply when editing the callback message fails', async () => {
    const ctx = createCtx();
    ctx.editMessageText.mockRejectedValueOnce(new Error('stale message'));
    const controller = new TelegramMnemosController({
      logRepo: { log: jest.fn() } as unknown as MockLogRepo,
      mcpRuntimeService: { readSnapshot: jest.fn() } as unknown as MockMcpRuntimeService,
      mnemosService: {
        processCallback: jest.fn().mockResolvedValue({
          handled: true,
          responseText: 'status',
          action: 'vault_status',
          error: null,
        }),
      } as unknown as MockMnemosService,
    });

    await controller.handleMnemosCallback(ctx as unknown as Parameters<typeof controller.handleMnemosCallback>[0], 'mnemos:vault_status');

    expect(ctx.reply).toHaveBeenCalledWith('status');
  });
});
