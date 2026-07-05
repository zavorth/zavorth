import { ZavorthChannelMessageMiddleware } from '../../src/services/ZavorthChannelMessageMiddleware';

describe('ZavorthChannelMessageMiddleware', () => {
  let middleware: ZavorthChannelMessageMiddleware;

  beforeEach(() => {
    middleware = new ZavorthChannelMessageMiddleware();
  });

  describe('processIncoming', () => {
    it('should handle a file read request', async () => {
      const result = await middleware.processIncoming({
        text: 'read the file report.md',
        channelId: 'telegram',
        userId: 'user123',
        locale: 'en',
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('read_file');
      expect(result.response).not.toBeNull();
      expect(result.response!.text).toBeDefined();
    });

    it('should handle a greeting', async () => {
      const result = await middleware.processIncoming({
        text: 'hello!',
        channelId: 'whatsapp',
        userId: 'user456',
        locale: 'en',
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('greeting');
    });

    it('should handle Portuguese input', async () => {
      const result = await middleware.processIncoming({
        text: 'enviar um email para o time',
        channelId: 'telegram',
        userId: 'user789',
        locale: 'pt',
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('email');
      expect(result.locale).toBe('pt-BR');
    });

    it('should handle unknown input gracefully', async () => {
      const result = await middleware.processIncoming({
        text: 'xyzzy plugh random123',
        channelId: 'telegram',
        userId: 'user101',
        locale: 'en',
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('conversation');
    });

    it('should return error result on failure', async () => {
      const failingMiddleware = new ZavorthChannelMessageMiddleware({
        commandless: {
          process: async () => { throw new Error('Test error'); },
        } as any,
      });

      const result = await failingMiddleware.processIncoming({
        text: 'test',
        channelId: 'telegram',
      });

      expect(result.handled).toBe(false);
      expect(result.error).toContain('Test error');
    });
  });

  describe('isCommand', () => {
    it('should detect slash commands', () => {
      expect(middleware.isCommand('/start')).toBe(true);
      expect(middleware.isCommand('/help')).toBe(true);
      expect(middleware.isCommand('hello')).toBe(false);
      expect(middleware.isCommand('read file')).toBe(false);
    });
  });

  describe('formatForChannel', () => {
    it('should format a card for Telegram', () => {
      const result = middleware.formatForChannel(
        { type: 'card', title: 'Test', text: 'Content' },
        'telegram',
      );
      expect(result.text).toContain('**Test**');
    });

    it('should format a choice with buttons for Telegram', () => {
      const result = middleware.formatForChannel(
        { type: 'choice', text: 'Pick:', options: ['A', 'B'] },
        'telegram',
      );
      expect(result.buttons).toHaveLength(2);
    });

    it('should format a choice as list for WhatsApp', () => {
      const result = middleware.formatForChannel(
        { type: 'choice', text: 'Pick:', options: ['A', 'B'] },
        'whatsapp',
      );
      expect(result.buttons).toBeUndefined();
      expect(result.text).toContain('1\uFE0F\u20E3');
    });
  });

  describe('getGreeting', () => {
    it('should return English greeting', () => {
      const greeting = middleware.getGreeting('telegram', 'en');
      expect(greeting).toContain('Zavorth');
    });

    it('should return Portuguese greeting', () => {
      const greeting = middleware.getGreeting('telegram', 'pt');
      expect(greeting).toContain('Zavorth');
    });
  });
});
