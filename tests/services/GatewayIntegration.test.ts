import { ZavorthGatewayIntegrationService } from '../../src/services/ZavorthGatewayIntegrationService';

describe('ZavorthGatewayIntegrationService — End-to-end flow', () => {
  let service: ZavorthGatewayIntegrationService;

  beforeEach(() => {
    service = new ZavorthGatewayIntegrationService();
  });

  describe('processMessage — full pipeline', () => {
    it('should process a simple file request for Telegram', async () => {
      const result = await service.processMessage({
        text: 'read the file report.md',
        channelId: 'telegram',
        userId: 'user123',
        locale: 'en',
      });

      expect(result.action).toBe('read_file');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.text).toBeDefined();
      expect(result.locale).toBe('en');
    });

    it('should process a greeting for WhatsApp', async () => {
      const result = await service.processMessage({
        text: 'hello!',
        channelId: 'whatsapp',
        userId: 'user456',
        locale: 'en',
      });

      expect(result.action).toBe('greeting');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.text.length).toBeGreaterThan(10);
    });

    it('should process a Portuguese message', async () => {
      const result = await service.processMessage({
        text: 'buscar informações sobre React',
        channelId: 'telegram',
        userId: 'user789',
        locale: 'pt',
      });

      expect(result.action).toBe('web_search');
      expect(result.locale).toBe('pt-BR');
    });

    it('should process a Spanish email request', async () => {
      const result = await service.processMessage({
        text: 'enviar un correo al equipo',
        channelId: 'discord',
        userId: 'user101',
        locale: 'es',
      });

      expect(result.action).toBe('email');
      expect(result.locale).toBe('es-ES');
    });

    it('should process a Japanese greeting', async () => {
      const result = await service.processMessage({
        text: 'こんにちは',
        channelId: 'telegram',
        userId: 'user202',
        locale: 'ja',
      });

      expect(result.action).toBe('greeting');
      expect(result.locale).toBe('ja-JP');
    });

    it('should fallback to conversation for unknown input', async () => {
      const result = await service.processMessage({
        text: 'xyzzy plugh random123',
        channelId: 'telegram',
        userId: 'user303',
      });

      expect(result.action).toBe('conversation');
    });
  });

  describe('formatResponse — standalone formatting', () => {
    it('should format a card response for Telegram', () => {
      const result = service.formatResponse(
        {
          type: 'card',
          title: 'Test Card',
          text: 'Card content',
        },
        'telegram',
      );

      expect(result.text).toContain('**Test Card**');
    });

    it('should format a choice with buttons for Telegram', () => {
      const result = service.formatResponse(
        {
          type: 'choice',
          text: 'Pick one:',
          options: ['A', 'B', 'C'],
        },
        'telegram',
      );

      expect(result.buttons).toHaveLength(3);
    });

    it('should format a choice as numbered list for WhatsApp', () => {
      const result = service.formatResponse(
        {
          type: 'choice',
          text: 'Pick one:',
          options: ['A', 'B'],
        },
        'whatsapp',
      );

      expect(result.buttons).toBeUndefined();
      expect(result.text).toContain('1\uFE0F\u20E3');
    });
  });

  describe('getGreeting — localized greetings', () => {
    it('should return English greeting by default', () => {
      const greeting = service.getGreeting();
      expect(greeting).toContain('Zavorth');
    });

    it('should return Portuguese greeting', () => {
      const greeting = service.getGreeting('pt');
      expect(greeting).toContain('Zavorth');
      expect(greeting).toContain('Oi');
    });

    it('should return Japanese greeting', () => {
      const greeting = service.getGreeting('ja');
      expect(greeting).toContain('Zavorth');
      expect(greeting).toContain('こんにちは');
    });

    it('should return Chinese greeting', () => {
      const greeting = service.getGreeting('zh');
      expect(greeting).toContain('Zavorth');
      expect(greeting).toContain('你好');
    });
  });

  describe('getChannelCapabilities', () => {
    it('should return Telegram capabilities', () => {
      const caps = service.getChannelCapabilities('telegram');
      expect(caps.supportsMarkdown).toBe(true);
      expect(caps.supportsButtons).toBe(true);
      expect(caps.maxMessageLength).toBe(4096);
    });

    it('should return WhatsApp capabilities', () => {
      const caps = service.getChannelCapabilities('whatsapp');
      expect(caps.supportsMarkdown).toBe(false);
      expect(caps.supportsButtons).toBe(false);
    });
  });

  describe('First interaction flow', () => {
    it('should return welcome message for first-time user', async () => {
      const result = await service.processMessage({
        text: 'anything',
        channelId: 'telegram',
        userId: 'newuser',
        isFirstInteraction: true,
      });

      expect(result.action).toBe('greeting');
      expect(result.text).toContain('Zavorth');
    });

    it('should return localized welcome for Portuguese user', async () => {
      const result = await service.processMessage({
        text: 'anything',
        channelId: 'telegram',
        userId: 'newuser',
        isFirstInteraction: true,
        locale: 'pt',
      });

      expect(result.action).toBe('greeting');
      expect(result.locale).toBe('pt');
    });
  });
});
