import { SharedSurfaceCommandService } from '../../../src/services/SharedSurfaceCommandService';

describe('SharedSurfaceCommandService smart commands', () => {
  function buildService(): SharedSurfaceCommandService {
    return new SharedSurfaceCommandService({
      runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
      supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
      autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
    });
  }

  function buildContext(rawText: string) {
    return {
      platform: 'telegram',
      userId: 'telegram-user',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText,
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };
  }

  it('handles shared slash model commands without leaving the messaging surface', async () => {
    const service = buildService();
    const ctx = buildContext('/model gemini:gemini-2.5-pro');

    await expect(service.maybeHandle(ctx as any)).resolves.toBe(true);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Command: /model'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Status: preview'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Channel: telegram'));
  });

  it('keeps shared state-changing slash commands approval gated', async () => {
    const service = buildService();
    const ctx = buildContext('/sethome C:/Users/ermys/Documents --apply');

    await expect(service.maybeHandle(ctx as any)).resolves.toBe(true);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Status: approval-required'));
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Persistent writes require approval'));
  });
});
