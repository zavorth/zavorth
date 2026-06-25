import { TelegramMnemosController } from '../../../src/telegram/controllers/TelegramMnemosController';

function createCtx() {
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
      logRepo: { log: jest.fn() } as any,
      mcpRuntimeService: { readSnapshot: jest.fn() } as any,
      mnemosService: { processCallback } as any,
    });

    await controller.handleMnemosCallback(ctx as any, 'mnemos:index_confirm:path');

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(processCallback).toHaveBeenCalledWith('mnemos:index_confirm:path', expect.any(Object));
    expect(ctx.editMessageText).toHaveBeenCalledWith('indexado');
  });

  it('responds safely when the MCP runtime is unavailable', async () => {
    const ctx = createCtx();
    const controller = new TelegramMnemosController({
      logRepo: { log: jest.fn() } as any,
      mcpRuntimeService: null,
      mnemosService: { processCallback: jest.fn() } as any,
    });

    await controller.handleMnemosCallback(ctx as any, 'mnemos:vault_status');

    expect(ctx.editMessageText).toHaveBeenCalledWith(expect.stringContaining('Mnemos is not connected'));
  });

  it('falls back to reply when editing the callback message fails', async () => {
    const ctx = createCtx();
    ctx.editMessageText.mockRejectedValueOnce(new Error('stale message'));
    const controller = new TelegramMnemosController({
      logRepo: { log: jest.fn() } as any,
      mcpRuntimeService: { readSnapshot: jest.fn() } as any,
      mnemosService: {
        processCallback: jest.fn().mockResolvedValue({
          handled: true,
          responseText: 'status',
          action: 'vault_status',
          error: null,
        }),
      } as any,
    });

    await controller.handleMnemosCallback(ctx as any, 'mnemos:vault_status');

    expect(ctx.reply).toHaveBeenCalledWith('status');
  });
});
