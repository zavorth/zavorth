import { ZavorthGatewayIntegrationService } from '../../src/services/ZavorthGatewayIntegrationService';
import { ZavorthChannelMessageMiddleware } from '../../src/services/ZavorthChannelMessageMiddleware';
import { hookMiddleware } from '../../src/services/ZavorthMiddlewareHook';

describe('Integration — Commandless Flow', () => {
  let integration: ZavorthGatewayIntegrationService;
  let middleware: ZavorthChannelMessageMiddleware;

  beforeEach(() => {
    integration = new ZavorthGatewayIntegrationService();
    middleware = new ZavorthChannelMessageMiddleware();
  });

  describe('Full flow: message → intent → response', () => {
    it('should process a file request end-to-end', async () => {
      const result = await integration.processMessage({
        text: 'read the file report.md',
        channelId: 'telegram',
        userId: 'user123',
        locale: 'en',
      });

      expect(result.action).toBe('read_file');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
    });

    it('should process a greeting end-to-end', async () => {
      const result = await integration.processMessage({
        text: 'hello!',
        channelId: 'whatsapp',
        userId: 'user456',
        locale: 'en',
      });

      expect(result.action).toBe('greeting');
      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
    });

    it('should process Portuguese input end-to-end', async () => {
      const result = await integration.processMessage({
        text: 'enviar um email para o time',
        channelId: 'telegram',
        userId: 'user789',
        locale: 'pt',
      });

      expect(result.action).toBe('email');
      expect(result.locale).toBe('pt-BR');
    });
  });

  describe('Middleware hook integration', () => {
    it('should handle message through hook', async () => {
      const result = await hookMiddleware({
        text: 'search for information',
        channelId: 'telegram',
        userId: 'user101',
        locale: 'en',
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
    });

    it('should skip commands through hook', async () => {
      const result = await hookMiddleware({
        text: '/start',
        channelId: 'telegram',
      });

      expect(result.handled).toBe(false);
    });

    it('should call reply callback when provided', async () => {
      let replied = false;
      const result = await hookMiddleware({
        text: 'hello!',
        channelId: 'telegram',
        locale: 'en',
        reply: async () => { replied = true; },
      });

      expect(result.handled).toBe(true);
      expect(replied).toBe(true);
    });
  });

  describe('Channel adaptation', () => {
    it('should format response for Telegram with markdown', async () => {
      const result = await integration.processMessage({
        text: 'read the file',
        channelId: 'telegram',
        userId: 'user1',
        locale: 'en',
      });

      expect(result.text).toBeDefined();
    });

    it('should format response for WhatsApp without markdown', async () => {
      const result = await integration.processMessage({
        text: 'read the file',
        channelId: 'whatsapp',
        userId: 'user2',
        locale: 'en',
      });

      expect(result.text).toBeDefined();
    });

    it('should format response for Discord', async () => {
      const result = await integration.processMessage({
        text: 'read the file',
        channelId: 'discord',
        userId: 'user3',
        locale: 'en',
      });

      expect(result.text).toBeDefined();
    });
  });
});
