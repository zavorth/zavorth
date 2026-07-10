import { ZavorthCommandlessModeService } from '../../src/services/ZavorthCommandlessModeService';
import { ZavorthPresentationAdapterService } from '../../src/services/ZavorthPresentationAdapterService';
import { ZavorthChannelCapabilitiesService } from '../../src/services/ZavorthChannelCapabilitiesService';
import { ZavorthChannelMessageMiddleware } from '../../src/services/ZavorthChannelMessageMiddleware';
import { hookMiddleware } from '../../src/services/ZavorthMiddlewareHook';
import { getLanguagePack, mergeLanguagePacks, listAvailableLocales } from '../../src/services/ZavorthIntentI18n';

describe('Edge Cases — CommandlessMode', () => {
  const service = new ZavorthCommandlessModeService();

  describe('Empty and whitespace input', () => {
    it('should handle empty string', () => {
      const result = service.detectIntent('');
      expect(result.action).toBe('conversation');
    });

    it('should handle whitespace-only input', () => {
      const result = service.detectIntent('   ');
      expect(result.action).toBe('conversation');
    });

    it('should handle newlines and tabs', () => {
      const result = service.detectIntent('\n\t  \n');
      expect(result.action).toBe('conversation');
    });
  });

  describe('Mixed language input', () => {
    it('should handle Portuguese input', () => {
      const pack = getLanguagePack('pt');
      const result = service.detectIntent('enviar um email', pack);
      expect(result.action).toBeDefined();
    });

    it('should handle English input', () => {
      const pack = getLanguagePack('en');
      const result = service.detectIntent('send an email', pack);
      expect(result.action).toBeDefined();
    });
  });

  describe('Case sensitivity', () => {
    it('should handle UPPERCASE input', () => {
      const result = service.detectIntent('READ THE FILE');
      expect(result.action).toBe('read_file');
    });

    it('should handle MiXeD CaSe input', () => {
      const result = service.detectIntent('ReAd ThE fIlE');
      expect(result.action).toBe('read_file');
    });
  });

  describe('Special characters', () => {
    it('should handle punctuation', () => {
      const result = service.detectIntent('read the file!');
      expect(result.action).toBe('read_file');
    });

    it('should handle multiple punctuation marks', () => {
      const result = service.detectIntent('hello???');
      expect(result.action).toBe('greeting');
    });

    it('should handle emojis', () => {
      const result = service.detectIntent('👋 hello');
      expect(result.action).toBe('greeting');
    });
  });

  describe('Very long input', () => {
    it('should handle long text without crashing', () => {
      const longText = 'read the file '.repeat(1000);
      const result = service.detectIntent(longText);
      expect(result.action).toBeDefined();
    });
  });

  describe('Concurrent detection', () => {
    it('should handle multiple rapid calls', () => {
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(service.detectIntent('hello'));
      }
      expect(results.every((r) => r.action === 'greeting')).toBe(true);
    });
  });
});

describe('Edge Cases — PresentationAdapter', () => {
  const adapter = new ZavorthPresentationAdapterService();

  describe('Empty responses', () => {
    it('should handle empty text', () => {
      const result = adapter.format({ type: 'text', text: '' }, 'telegram');
      expect(result.text).toBe('');
    });

    it('should handle empty options array', () => {
      const result = adapter.format({ type: 'choice', text: 'Pick:', options: [] }, 'telegram');
      expect(result.text).toContain('Pick:');
    });

    it('should handle empty items array', () => {
      const result = adapter.format({ type: 'list', text: 'Items:', items: [] }, 'telegram');
      expect(result.text).toContain('Items:');
    });
  });

  describe('Very long content', () => {
    it('should truncate text exceeding channel limit', () => {
      const longText = 'A'.repeat(5000);
      const result = adapter.format({ type: 'text', text: longText }, 'telegram');
      expect(result.text.length).toBeLessThanOrEqual(4096);
      expect(result.text).toContain('...');
    });

    it('should not truncate when no limit', () => {
      const longText = 'A'.repeat(10000);
      const result = adapter.format({ type: 'text', text: longText }, 'email');
      expect(result.text.length).toBe(10000);
    });
  });

  describe('Unknown channel', () => {
    it('should fallback to plain text for unknown channel', () => {
      const result = adapter.format({ type: 'text', text: 'Hello' }, 'unknown-channel');
      expect(result.text).toBe('Hello');
    });
  });

  describe('Code block formatting', () => {
    it('should format code with language tag', () => {
      const result = adapter.format(
        { type: 'code', text: 'Code:', code: 'const x = 1;', language: 'typescript' },
        'telegram',
      );
      expect(result.text).toContain('```typescript');
      expect(result.text).toContain('const x = 1;');
    });

    it('should indent code for plain text channels', () => {
      const result = adapter.format(
        { type: 'code', text: 'Code:', code: 'const x = 1;' },
        'whatsapp',
      );
      expect(result.text).toContain('  const x = 1;');
    });
  });

  describe('Error formatting', () => {
    it('should include error emoji for markdown channels', () => {
      const result = adapter.format(
        { type: 'error', text: 'Something failed' },
        'telegram',
      );
      expect(result.text).toContain('\u26A0\uFE0F');
    });

    it('should include ERROR prefix for plain text channels', () => {
      const result = adapter.format(
        { type: 'error', text: 'Something failed' },
        'whatsapp',
      );
      expect(result.text).toContain('[ERROR]');
    });
  });
});

describe('Edge Cases — ChannelCapabilities', () => {
  const caps = new ZavorthChannelCapabilitiesService();

  it('should return fallback for unknown channel', () => {
    const result = caps.get('nonexistent');
    expect(result.id).toBe('nonexistent');
    expect(result.supportsMarkdown).toBe(false);
  });

  it('should register custom channel', () => {
    caps.register({
      id: 'custom-bot',
      label: 'Custom Bot',
      supportsMarkdown: true,
      supportsButtons: false,
      supportsRichEmbeds: false,
      supportsImages: false,
      supportsAudio: false,
      supportsVideo: false,
      supportsReactions: false,
      supportsHTML: false,
      supportsThreads: false,
      supportsMessageEditing: false,
      supportsPinning: false,
      maxMessageLength: 500,
      maxButtonsPerMessage: 0,
      maxAttachmentsPerMessage: 0,
      supportsEphemeral: false,
      supportsScheduledMessages: false,
      supportsTypingIndicator: false,
      supportsPresence: false,
    });

    const result = caps.get('custom-bot');
    expect(result.maxMessageLength).toBe(500);
  });

  it('should not unregister built-in channels', () => {
    expect(caps.unregister('telegram')).toBe(false);
    expect(caps.has('telegram')).toBe(true);
  });

  it('should unregister custom channels', () => {
    caps.register({ id: 'temp', label: 'Temp', supportsMarkdown: false, supportsButtons: false, supportsRichEmbeds: false, supportsImages: false, supportsAudio: false, supportsVideo: false, supportsReactions: false, supportsHTML: false, supportsThreads: false, supportsMessageEditing: false, supportsPinning: false, maxMessageLength: 100, maxButtonsPerMessage: 0, maxAttachmentsPerMessage: 0, supportsEphemeral: false, supportsScheduledMessages: false, supportsTypingIndicator: false, supportsPresence: false });
    expect(caps.has('temp')).toBe(true);
    expect(caps.unregister('temp')).toBe(true);
    expect(caps.has('temp')).toBe(false);
  });
});

describe('Edge Cases — MiddlewareHook', () => {
  describe('Error handling', () => {
    it('should handle empty string gracefully', async () => {
      const result = await hookMiddleware({
        text: '',
        channelId: 'telegram',
      });
      expect(result.handled).toBeDefined();
    });

    it('should handle undefined locale', async () => {
      const result = await hookMiddleware({
        text: 'hello',
        channelId: 'telegram',
        locale: undefined,
      });
      expect(result.handled).toBe(true);
    });
  });

  describe('Command detection', () => {
    it('should skip /start', async () => {
      const result = await hookMiddleware({ text: '/start', channelId: 'telegram' });
      expect(result.handled).toBe(false);
    });

    it('should skip /help', async () => {
      const result = await hookMiddleware({ text: '/help', channelId: 'telegram' });
      expect(result.handled).toBe(false);
    });

    it('should skip /model', async () => {
      const result = await hookMiddleware({ text: '/model gpt-4', channelId: 'telegram' });
      expect(result.handled).toBe(false);
    });

    it('should not skip text that starts with slash in middle', async () => {
      const result = await hookMiddleware({ text: 'use /start command', channelId: 'telegram' });
      expect(result.handled).toBe(true);
    });
  });

  describe('Reply callback', () => {
    it('should call reply callback when provided', async () => {
      let repliedText = '';
      const result = await hookMiddleware({
        text: 'hello!',
        channelId: 'telegram',
        locale: 'en',
        reply: async (text) => { repliedText = text; },
      });
      expect(result.handled).toBe(true);
      expect(repliedText.length).toBeGreaterThan(0);
    });

    it('should not call reply callback when not provided', async () => {
      const result = await hookMiddleware({
        text: 'hello!',
        channelId: 'telegram',
        locale: 'en',
      });
      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
    });
  });
});

describe('Edge Cases — IntentI18n', () => {
  describe('Locale handling', () => {
    it('should handle uppercase locale codes', () => {
      const pack = getLanguagePack('PT');
      expect(Object.keys(pack.intents).length).toBeGreaterThan(0);
    });

    it('should handle locale with region', () => {
      const pack = getLanguagePack('pt-BR');
      expect(pack.code.toLowerCase()).toBe('en-us');
    });

    it('should handle locale with underscore', () => {
      const pack = getLanguagePack('pt_BR');
      // Should find the pt-BR pack or fallback to en-US
      expect(pack.code).toBeDefined();
      expect(Object.keys(pack.intents).length).toBeGreaterThan(0);
    });

    it('should list all available locales', () => {
      const locales = listAvailableLocales();
      expect(locales.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Merge packs', () => {
    it('should merge PT + EN correctly', () => {
      const merged = mergeLanguagePacks('pt', 'en');
      expect(merged.intents.read_file.verbs).toContain('ler');
      expect(merged.intents.read_file.verbs).toContain('read');
    });

    it('should merge with same language', () => {
      const merged = mergeLanguagePacks('en', 'en');
      expect(Object.keys(merged.intents).length).toBeGreaterThan(0);
    });
  });
});
