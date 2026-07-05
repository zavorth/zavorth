import { hookMiddleware, isCommand, getGreeting } from '../../src/services/ZavorthMiddlewareHook';

describe('ZavorthMiddlewareHook', () => {
  describe('hookMiddleware', () => {
    it('should handle a file read request', async () => {
      const result = await hookMiddleware({
        text: 'read the file report.md',
        channelId: 'telegram',
        userId: 'user123',
        locale: 'en',
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response!.length).toBeGreaterThan(0);
    });

    it('should handle a greeting', async () => {
      const result = await hookMiddleware({
        text: 'hello!',
        channelId: 'whatsapp',
        userId: 'user456',
        locale: 'en',
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
    });

    it('should handle Portuguese input', async () => {
      const result = await hookMiddleware({
        text: 'enviar um email para o time',
        channelId: 'telegram',
        userId: 'user789',
        locale: 'pt',
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
    });

    it('should skip commands', async () => {
      const result = await hookMiddleware({
        text: '/start',
        channelId: 'telegram',
        userId: 'user101',
      });

      expect(result.handled).toBe(false);
    });

    it('should handle unknown input gracefully', async () => {
      const result = await hookMiddleware({
        text: 'xyzzy plugh random123',
        channelId: 'telegram',
        userId: 'user202',
        locale: 'en',
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
    });
  });

  describe('isCommand', () => {
    it('should detect slash commands', () => {
      expect(isCommand('/start')).toBe(true);
      expect(isCommand('/help')).toBe(true);
      expect(isCommand('hello')).toBe(false);
    });
  });

  describe('getGreeting', () => {
    it('should return English greeting', () => {
      const greeting = getGreeting('telegram', 'en');
      expect(greeting).toContain('Zavorth');
    });

    it('should return Portuguese greeting', () => {
      const greeting = getGreeting('telegram', 'pt');
      expect(greeting).toContain('Zavorth');
    });
  });
});
