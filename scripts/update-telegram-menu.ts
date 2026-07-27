import { Bot } from 'grammy';
import { config } from '../src/config/index.js';
import { TelegramMenuController } from '../src/telegram/controllers/TelegramMenuController.js';
import dotenv from 'dotenv';
import { asErrorLike } from '../src/utils/errorLike';

dotenv.config();

async function updateMenu() {
  if (!config.telegramBotToken) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN not found in .env');
    process.exit(1);
  }

  console.log('🔄 Updating Telegram command menu...');
  const bot = new Bot(config.telegramBotToken);
  const menuController = new TelegramMenuController(bot);

  try {
    await menuController.registerTelegramMenu();
    console.log('✅ Telegram menu updated successfully!');
    console.log('Note: It may take a few minutes for the Telegram app cache to update on your phone.');
  } catch (error: unknown) {
    const err = asErrorLike(error);

    console.error('❌ Failed to update menu:', error.message);
  }
}

updateMenu();
