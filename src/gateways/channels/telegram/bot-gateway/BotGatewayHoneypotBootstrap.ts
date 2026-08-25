import type { Bot } from 'grammy';
import { logger } from '../../../../logger.js';
import { HoneypotMonitor } from "../../../../monitoring/HoneypotMonitor.js";
import type { SecurityLockService } from '../../../../services/SecurityLockService.js';

type TelegramHoneypotGateway = {
  securityLock: SecurityLockService;
  bot: Pick<Bot, 'api'>;
};

export function createTelegramHoneypotMonitor(gateway: TelegramHoneypotGateway): HoneypotMonitor {
  return new HoneypotMonitor(gateway.securityLock, async (msg) => {
    const adminIds = process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",") || [];
    for (const adminId of adminIds) {
      const trimmed = adminId.trim();
      if (trimmed) {
        try {
          await gateway.bot.api.sendMessage(trimmed, msg, {
            parse_mode: "Markdown",
          });
        } catch (error: unknown) {logger.error(
            `Failed to alert admin ${trimmed} about honeypot:`,
            error,
          );
        }
      }
    }
  });
}
