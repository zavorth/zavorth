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
    this.deps.logRepo.log('info', 'BotGateway', 'Iniciando bot do Telegram (long polling)...');
    try {
      await this.deps.menuController.registerTelegramMenu();
      this.deps.logRepo.log('info', 'BotGateway', 'Menu de comandos do Telegram registrado com sucesso.');
    } catch (error: unknown) {
      this.deps.logRepo.log(
        'warn',
        'BotGateway',
        `Falha ao registrar menu de comandos do Telegram: ${error.message}`,
      );
    }

    try {
      await new Promise<void>((resolve, reject) => {
        let startupResolved = false;

        void bot.start({
          onStart: () => {
            logger.info('Zavorth Telegram gateway iniciado com sucesso.');
            startupResolved = true;
            resolve();
          },
        }).catch((error: unknown) => {
          const description = String(error?.description || error?.message || '');
          if (error?.error_code === 409 || description.includes('terminated by other getUpdates request')) {
            const friendlyMessage =
              'Conflito de polling do Telegram detectado. Existe outra instancia do Zavorth usando este bot token. Deixe apenas uma instancia rodando antes de reiniciar.';
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
            `Long polling do Telegram foi interrompido apos o bootstrap: ${description || 'erro desconhecido'}`,
          );
        });
      });
    } catch (error: unknown) {
      throw error;
    }
  }
}
