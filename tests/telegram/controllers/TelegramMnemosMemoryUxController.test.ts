import { TelegramMnemosMemoryUxController } from '../../../src/telegram/controllers/TelegramMnemosMemoryUxController';

describe('TelegramMnemosMemoryUxController', () => {
  it('renders the general Mnemos UX summary', async () => {
    const ctx = { reply: jest.fn().mockResolvedValue(undefined) } as any;
    const controller = new TelegramMnemosMemoryUxController({
      memoryUxService: {
        buildSnapshot: () => ({ status: 'ready' } as any),
        formatTelegram: () => 'Mnemos: ready',
      } as any,
    });

    await controller.handleMnemos(ctx, '', '42');

    expect(ctx.reply).toHaveBeenCalledWith('Mnemos: ready');
  });

  it('routes /mnemos query to the wiki query service', async () => {
    const ctx = { reply: jest.fn().mockResolvedValue(undefined) } as any;
    const controller = new TelegramMnemosMemoryUxController({
      queryService: {
        query: jest.fn().mockReturnValue({
          status: 'ready',
          summary: { hits: 1, pagesScanned: 6 },
          hits: [{ title: 'Memory', path: '.zavorth/wiki/memory.md' }],
        }),
      } as any,
    });

    await controller.handleMnemos(ctx, 'query compaction', '42');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Mnemos query: ready');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('.zavorth/wiki/memory.md');
  });

  it('does not revoke procedural memory directly from Telegram text', async () => {
    const ctx = { reply: jest.fn().mockResolvedValue(undefined) } as any;
    const controller = new TelegramMnemosMemoryUxController();

    await controller.handleMnemos(ctx, 'revoke rule-1', '42');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('requires governed approval');
  });
});
