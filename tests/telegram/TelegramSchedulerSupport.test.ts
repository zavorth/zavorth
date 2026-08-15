import { TelegramSchedulerBootstrap } from '../../src/telegram/TelegramSchedulerSupport';
import { SmartOutputService } from '../../src/services/SmartOutputService';

describe('TelegramSchedulerBootstrap', () => {
  it('initializes the scheduler and routes scheduled replies back to Telegram', async () => {
    let dispatcher: ((command: string, userId: string) => Promise<void>) | null = null;
    const schedulerService = {
      start: jest.fn((callback) => {
        dispatcher = callback;
      }),
    } as any;
    const botApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };
    const processTextMessage = jest.fn(async (ctx: any, text: string) => {
      expect(text).toBe('/wsl status');
      await ctx.reply('ok');
    });
    const onReady = jest.fn();
    const bootstrap = new TelegramSchedulerBootstrap({
      botApi,
      processTextMessage,
      onReady,
      allowedUserIds: ['99'],
      dbFactory: async () => ({}) as any,
      createRepository: () => ({}) as any,
      createSchedulerService: () => schedulerService,
      logger: { error: jest.fn() },
    });

    await bootstrap.init();
    expect(onReady).toHaveBeenCalledWith(schedulerService);
    expect(dispatcher).not.toBeNull();

    await dispatcher!('/wsl status', '42');

    expect(processTextMessage).toHaveBeenCalled();
    expect(botApi.sendMessage).toHaveBeenCalledWith('99', '[SCHEDULED]\nok', {
      parse_mode: 'Markdown',
    });
  });

  it('supports long scheduled replies through document fallback', async () => {
    let dispatcher: ((command: string, userId: string) => Promise<void>) | null = null;
    const schedulerService = {
      start: jest.fn((callback) => {
        dispatcher = callback;
      }),
    } as any;
    const botApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      sendDocument: jest.fn().mockResolvedValue(undefined),
    };
    const processTextMessage = jest.fn(async (ctx: any) => {
      await SmartOutputService.reply(ctx, 'B'.repeat(6000), { includeDeleteAction: false });
    });
    const bootstrap = new TelegramSchedulerBootstrap({
      botApi,
      processTextMessage,
      onReady: jest.fn(),
      allowedUserIds: ['99'],
      dbFactory: async () => ({}) as any,
      createRepository: () => ({}) as any,
      createSchedulerService: () => schedulerService,
      logger: { error: jest.fn() },
    });

    await bootstrap.init();
    await dispatcher!('/task teste', '42');

    expect(botApi.sendDocument).toHaveBeenCalled();
  }, 15000);
});
