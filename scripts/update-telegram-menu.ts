import { Bot } from 'grammy';
import { config } from '../src/config/index.js';
import { TelegramMenuController } from '../src/telegram/controllers/TelegramMenuController.js';
import dotenv from 'dotenv';
import { asErrorLike } from '../src/utils/errorLike';

dotenv.config();

async function updateMenu() {
  if (!config.telegramBotToken) {
    console.error('❌ Erro: TELEGRAM_BOT_TOKEN não encontrado no .env');
    process.exit(1);
  }

  console.log('🔄 Iniciando atualização do menu de comandos do Telegram...');
  const bot = new Bot(config.telegramBotToken);
  const menuController = new TelegramMenuController(bot);

  try {
    await menuController.registerTelegramMenu();
    console.log('✅ Menu do Telegram atualizado com sucesso!');
    console.log('Nota: Pode levar alguns minutos para o cache do app do Telegram atualizar no seu celular.');
  } catch (error: unknown) {
    const err = asErrorLike(error);

    console.error('❌ Falha ao atualizar o menu:', error.message);
  }
}

updateMenu();
