import { hookMiddleware, isCommand, getGreeting } from '../../src/services/ZavorthMiddlewareHook';

describe('ZavorthMiddlewareHook', () => {
  describe('hookMiddleware', () => {
    it('agent-first: free text is not claimed (pairing-only middleware)', async () => {
      const result = await hookMiddleware({
        text: 'read the file report.md',
        cchannelId: 'cli',
        userId: 'user123',
        locale: 'en',
      });

      expect(result.handled).toBe(false);
      expect(result.response == null).toBe(true);
    });

    it('should skip commands', async () => {
      const result = await hookMiddleware({
        text: '/start',
        cchannelId: 'cli',
        userId: 'user101',
      });

      expect(result.handled).toBe(false);
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
  });
});
