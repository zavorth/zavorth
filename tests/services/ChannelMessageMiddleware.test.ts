import { ZavorthChannelMessageMiddleware } from '../../src/services/ZavorthChannelMessageMiddleware';

describe('ZavorthChannelMessageMiddleware', () => {
  let middleware: ZavorthChannelMessageMiddleware;

  beforeEach(() => {
    middleware = new ZavorthChannelMessageMiddleware();
  });

  describe('processIncoming', () => {
    it('agent-first: free text is never claimed by middleware', async () => {
      const result = await middleware.processIncoming({
        text: 'read the file report.md',
        channelId: 'cli',
        userId: 'user123',
        locale: 'en',
      });

      expect(result.handled).toBe(false);
      expect(result.action).toBe('agent_first');
      expect(result.response).toBeNull();
    });

    it('agent-first: greetings pass through to the agent', async () => {
      const result = await middleware.processIncoming({
        text: 'hello!',
        channelId: 'web',
        userId: 'user456',
        locale: 'en',
      });

      expect(result.handled).toBe(false);
      expect(result.action).toBe('agent_first');
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
  });

  describe('getGreeting', () => {
    it('should return English greeting', () => {
      const greeting = middleware.getGreeting('telegram', 'en');
      expect(greeting).toContain('Zavorth');
    });
  });
});
