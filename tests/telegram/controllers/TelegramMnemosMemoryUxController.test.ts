import { TelegramMnemosMemoryUxController } from '../../../src/telegram/controllers/TelegramMnemosMemoryUxController';

interface MockContext {
  reply: jest.Mock;
}

interface MockMemoryUxService {
  buildSnapshot: () => { status: string };
  formatTelegram: () => string;
}

interface MockQueryService {
  query: jest.Mock;
}

describe('TelegramMnemosMemoryUxController', () => {
  it('renders the general Mnemos UX summary', async () => {
    const ctx: MockContext = { reply: jest.fn().mockResolvedValue(undefined) };
    const controller = new TelegramMnemosMemoryUxController({
      memoryUxService: {
        buildSnapshot: () => ({ status: 'ready' }),
        formatTelegram: () => 'Mnemos: ready',
      } as unknown as MockMemoryUxService,
    });

    await controller.handleMnemos(ctx as unknown as Parameters<typeof controller.handleMnemos>[0], '', '42');

    expect(ctx.reply).toHaveBeenCalledWith('Mnemos: ready');
  });

  it('routes /mnemos query to the wiki query service', async () => {
    const ctx: MockContext = { reply: jest.fn().mockResolvedValue(undefined) };
    const controller = new TelegramMnemosMemoryUxController({
      queryService: {
        query: jest.fn().mockReturnValue({
          status: 'ready',
          summary: { hits: 1, pagesScanned: 6 },
          hits: [{ title: 'Memory', path: '.zavorth/wiki/memory.md' }],
        }),
      } as unknown as MockQueryService,
    });

    await controller.handleMnemos(ctx as unknown as Parameters<typeof controller.handleMnemos>[0], 'query compaction', '42');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Mnemos query: ready');
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('.zavorth/wiki/memory.md');
  });

  it('does not revoke procedural memory directly from Telegram text', async () => {
    const ctx: MockContext = { reply: jest.fn().mockResolvedValue(undefined) };
    const controller = new TelegramMnemosMemoryUxController();

    await controller.handleMnemos(ctx as unknown as Parameters<typeof controller.handleMnemos>[0], 'revoke rule-1', '42');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('requires governed approval');
  });
});
