import { InternalSurfaceApiService } from '../../src/api/internal/InternalSurfaceApiService';

describe('InternalSurfaceApiService', () => {
  it('returns a canonical command result and captures replies', async () => {
    const delegate = {
      maybeHandle: jest.fn(async (ctx: any) => {
        await ctx.reply('Shared surface handled.');
        return true;
      }),
    };
    const service = new InternalSurfaceApiService({
      commandService: delegate as any,
    });
    const ctx = {
      platform: 'telegram',
      userId: 'user-1',
      chatId: 'telegram:chat-1',
      isGroup: false,
      rawText: '/hub',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const result = await service.handleCommand({
      context: ctx as any,
      parsedCommand: {
        command_type: '/hub',
        command_args: '',
        normalized_message: '/hub',
        explicit_executor: null,
        references_last_task: false,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.handled).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.messages).toEqual(['Shared surface handled.']);
    expect(result.metadata.commandType).toBe('/hub');
    expect(ctx.reply).toHaveBeenCalledWith('Shared surface handled.', undefined);
    expect(delegate.maybeHandle).toHaveBeenCalled();
  });

  it('maps execution errors into the canonical taxonomy without throwing from handleCommand', async () => {
    const service = new InternalSurfaceApiService({
      commandService: {
        maybeHandle: jest.fn(async () => {
          throw new Error('Approval required before mutating runtime.');
        }),
      } as any,
    });
    const ctx = {
      platform: 'web',
      userId: 'user-2',
      chatId: 'web:chat-1',
      isGroup: false,
      rawText: '/mode operator',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    const result = await service.handleCommand({
      context: ctx as any,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('blocked');
    expect(result.error?.code).toBe('approval_required');
    expect(result.summary).toContain('Approval required');
  });

  it('preserves legacy maybeHandle behavior by rethrowing delegate failures', async () => {
    const service = new InternalSurfaceApiService({
      commandService: {
        maybeHandle: jest.fn(async () => {
          throw new Error('runtime bootstrap unhealthy');
        }),
      } as any,
    });
    const ctx = {
      platform: 'discord',
      userId: 'user-3',
      chatId: 'discord:chat-1',
      isGroup: true,
      rawText: '/status',
      reply: jest.fn(async () => undefined),
      editMessage: jest.fn(async () => undefined),
    };

    await expect(service.maybeHandle(ctx as any)).rejects.toThrow('runtime bootstrap unhealthy');
  });
});
