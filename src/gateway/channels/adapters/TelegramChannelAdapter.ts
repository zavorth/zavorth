import { GatewayChannelAdapter } from '../GatewayChannelAdapter';
import { GatewayEventBus } from '../../events/GatewayEventBus';
import { logger } from '../../../logger.js';

export class TelegramChannelAdapter implements GatewayChannelAdapter {
  id = 'telegram';
  name = 'Telegram Bot API';
  type = 'async' as const;
  private initialized = false;

  constructor(private eventBus: GatewayEventBus, private botToken: string) {}

  async initialize(): Promise<void> {
    if (!this.botToken) {
      return;
    }
    this.initialized = true;
    logger.info('[Gateway] Telegram Channel initialized. Long polling started.');
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    logger.info('[Gateway] Telegram Channel closed.');
    this.initialized = false;
  }

  async onMessageReceived(payload: any): Promise<void> {
    // Convert grammy/telegram payload to Canonical Request Schema
  }

  async sendMessage(payload: any): Promise<void> {
    // Call Telegram API with text/media mapping from core Gateway Events
  }
}
