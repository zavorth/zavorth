import { logger } from '../../../../logger.js';
import { Bot } from 'grammy';
import { LogRepository } from '../../../../storage/LogRepository.js';
import { TelegramMenuController } from '../../../../gateways/channels/telegram/controllers/TelegramMenuController.js';

export type TelegramLifecycleControllerDeps = {
  logRepo: LogRepository;
  menuController: TelegramMenuController;
};

export class TelegramLifecycleController {
  constructor(private deps: TelegramLifecycleControllerDeps) {}

  public async start(bot: Bot): Promise<void> {
    this.deps.logRepo.log('info', 'BotGateway', 'Starting Telegram bot (long polling)...');
    try {
      await this.deps.menuController.registerTelegramMenu();
      this.deps.logRepo.log('info', 'BotGateway', 'Telegram command menu registered successfully.');
    } catch (error: any) { const err = error; const e = error;
      const msg = error instanceof Error ? error.message : String(error);
      this.deps.logRepo.log(
        'warn',
        'BotGateway',
        `Failed to register Telegram command menu: ${msg}`,
      );
    }

    try {
      await new Promise<void>((resolve, reject) => {
        let startupResolved = false;

        void bot.start({
          onStart: () => {
            logger.info('Zavorth Telegram gateway started successfully.');
            startupResolved = true;
            resolve();
          },
        }).catch((error: unknown) => {
          const errObj = error as Record<string, unknown>;
          const description = String((errObj?.description || errObj?.message || ''));
          if (errObj?.error_code === 409 || description.includes('terminated by other getUpdates request')) {
            const friendlyMessage =
              'Telegram polling conflict detected. Another Zavorth instance is using this bot token. Keep only one instance running before restarting.';
            this.deps.logRepo.log('error', 'BotGateway', friendlyMessage);
            reject(new Error(friendlyMessage));
            return;
          }

          if (!startupResolved) {
            reject(error);
            return;
          }

          this.deps.logRepo.log(
            'error',
            'BotGateway',
            `Telegram long polling stopped after bootstrap: ${description || 'unknown error'}`,
          );
        });
      });
    } catch (error: any) { const err = error; const e = error;
      throw error;
    }
  }
}
