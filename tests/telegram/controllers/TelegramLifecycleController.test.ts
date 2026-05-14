import { TelegramLifecycleController } from '../../../src/telegram/controllers/TelegramLifecycleController';

describe('TelegramLifecycleController', () => {
  it('registers the menu before polling', async () => {
    const logRepo = {
      log: jest.fn(),
    } as any;
    const menuController = {
      registerTelegramMenu: jest.fn().mockResolvedValue(undefined),
    } as any;
    const bot = {
      start: jest.fn().mockImplementation(async ({ onStart }: { onStart?: () => void }) => {
        onStart?.();
      }),
    } as any;

    const controller = new TelegramLifecycleController({
      logRepo,
      menuController,
    });

    await controller.start(bot);

    expect(menuController.registerTelegramMenu).toHaveBeenCalled();
    expect(bot.start).toHaveBeenCalled();
  });

  it('resolves startup as soon as long polling fires onStart', async () => {
    const logRepo = {
      log: jest.fn(),
    } as any;
    const menuController = {
      registerTelegramMenu: jest.fn().mockResolvedValue(undefined),
    } as any;

    let capturedOnStart: (() => void) | null = null;
    const bot = {
      start: jest.fn().mockImplementation(async ({ onStart }: { onStart?: () => void }) => {
        capturedOnStart = onStart || null;
        await new Promise(() => undefined);
      }),
    } as any;

    const controller = new TelegramLifecycleController({
      logRepo,
      menuController,
    });

    const startPromise = controller.start(bot);

    await new Promise((resolve) => setImmediate(resolve));
    expect(capturedOnStart).toBeInstanceOf(Function);

    capturedOnStart?.();

    await expect(startPromise).resolves.toBeUndefined();
  });
});
