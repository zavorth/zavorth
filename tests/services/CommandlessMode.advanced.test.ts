import { ZavorthCommandlessModeService } from '../../src/services/ZavorthCommandlessModeService';
import { ZavorthPresentationAdapterService } from '../../src/services/ZavorthPresentationAdapterService';
import { ZavorthChannelCapabilitiesService } from '../../src/services/ZavorthChannelCapabilitiesService';
import { getLanguagePack, mergeLanguagePacks, detectDeviceLocale } from '../../src/services/ZavorthIntentI18n';

describe('Advanced — Intent detection patterns', () => {
  const service = new ZavorthCommandlessModeService();

  describe('File operations', () => {
    const cases: Array<[string, string]> = [
      ['open the document', 'read_file'],
      ['show me the file', 'read_file'],
      ['create a new file', 'create_file'],
      ['write a document', 'create_file'],
      ['list all files', 'list_directory'],
    ];

    test.each(cases)('"%s" → %s', (input, expected) => {
      const result = service.detectIntent(input);
      expect(result.action).toBe(expected);
    });
  });

  describe('Web operations', () => {
    const cases: Array<[string, string]> = [
      ['search for information', 'web_search'],
      ['find data about React', 'web_search'],
      ['open the website', 'web_fetch'],
      ['visit a page', 'web_fetch'],
    ];

    test.each(cases)('"%s" → %s', (input, expected) => {
      const result = service.detectIntent(input);
      expect(result.action).toBe(expected);
    });
  });

  describe('Communication', () => {
    const cases: Array<[string, string]> = [
      ['send an email', 'email'],
      ['write a message', 'email'],
      ['draft a reply', 'email'],
      ['post a message', 'channel_send'],
    ];

    test.each(cases)('"%s" → %s', (input, expected) => {
      const result = service.detectIntent(input);
      expect(result.action).toBe(expected);
    });
  });

  describe('Code operations', () => {
    const cases: Array<[string, string]> = [
      ['run this script', 'run_code'],
      ['execute the program', 'run_code'],
      ['review the pull request', 'code_review'],
      ['explain the function', 'explain_code'],
    ];

    test.each(cases)('"%s" → %s', (input, expected) => {
      const result = service.detectIntent(input);
      expect(result.action).toBe(expected);
    });
  });

  describe('Scheduling', () => {
    const cases: Array<[string, string]> = [
      ['schedule a meeting', 'calendar'],
      ['set a reminder', 'calendar'],
      ['remind me to check deploy', 'calendar'],
    ];

    test.each(cases)('"%s" → %s', (input, expected) => {
      const result = service.detectIntent(input);
      expect(result.action).toBe(expected);
    });
  });

  describe('Data operations', () => {
    const cases: Array<[string, string]> = [
      ['analyze the data', 'data_analysis'],
      ['process the csv file', 'data_analysis'],
      ['create a chart', 'chart'],
    ];

    test.each(cases)('"%s" → %s', (input, expected) => {
      const result = service.detectIntent(input);
      expect(result.action).toBe(expected);
    });
  });

  describe('System operations', () => {
    const cases: Array<[string, string]> = [
      ['install the package', 'system_config'],
      ['update the system', 'system_config'],
      ['check the status', 'diagnostics'],
    ];

    test.each(cases)('"%s" → %s', (input, expected) => {
      const result = service.detectIntent(input);
      expect(result.action).toBe(expected);
    });
  });

  describe('Help and social', () => {
    const cases: Array<[string, string]> = [
      ['what can you do?', 'help'],
      ['hello!', 'greeting'],
      ['good morning', 'greeting'],
      ['thanks a lot', 'acknowledgment'],
    ];

    test.each(cases)('"%s" → %s', (input, expected) => {
      const result = service.detectIntent(input);
      expect(result.action).toBe(expected);
    });
  });
});

describe('Advanced — PresentationAdapter formatting', () => {
  const adapter = new ZavorthPresentationAdapterService();

  describe('Card with title and content', () => {
    it('should format card with markdown for Telegram', () => {
      const result = adapter.format(
        { type: 'card', title: 'Alert', text: 'Important notice here' },
        'telegram',
      );
      expect(result.text).toContain('**Alert**');
      expect(result.text).toContain('Important notice here');
    });

    it('should format card without title', () => {
      const result = adapter.format(
        { type: 'card', text: 'Just content' },
        'telegram',
      );
      expect(result.text).toContain('Just content');
    });
  });

  describe('Choice with many options', () => {
    it('should handle 5 options for Telegram', () => {
      const result = adapter.format(
        { type: 'choice', text: 'Pick:', options: ['A', 'B', 'C', 'D', 'E'] },
        'telegram',
      );
      expect(result.buttons).toHaveLength(5);
    });
  });

  describe('List with title', () => {
    it('should format list with title for markdown channel', () => {
      const result = adapter.format(
        { type: 'list', title: 'Results', items: ['Item 1', 'Item 2', 'Item 3'] },
        'telegram',
      );
      expect(result.text).toContain('**Results**');
      expect(result.text).toContain('- Item 1');
    });

    it('should format list without title', () => {
      const result = adapter.format(
        { type: 'list', items: ['A', 'B'] },
        'whatsapp',
      );
      expect(result.text).toContain('\u2022 A');
    });
  });

  describe('Status messages', () => {
    it('should show success emoji', () => {
      const result = adapter.format(
        { type: 'status', text: 'Done', severity: 'success' },
        'telegram',
      );
      expect(result.text).toContain('\u2705');
    });

    it('should show warning emoji', () => {
      const result = adapter.format(
        { type: 'status', text: 'Caution', severity: 'warning' },
        'telegram',
      );
      expect(result.text).toContain('\u26A0\uFE0F');
    });

    it('should show error emoji', () => {
      const result = adapter.format(
        { type: 'status', text: 'Failed', severity: 'error' },
        'telegram',
      );
      expect(result.text).toContain('\u274C');
    });
  });

  describe('Message splitting', () => {
    it('should handle single short message', () => {
      const chunks = adapter.splitMessage('Hello world', 'telegram');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Hello world');
    });

    it('should split long message', () => {
      const text = 'A'.repeat(5000);
      const chunks = adapter.splitMessage(text, 'telegram');
      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('Advanced — ChannelCapabilities registry', () => {
  const caps = new ZavorthChannelCapabilitiesService();

  describe('Capability checks', () => {
    it('should report markdown support per channel', () => {
      expect(caps.supports('telegram', 'supportsMarkdown')).toBe(true);
      expect(caps.supports('whatsapp', 'supportsMarkdown')).toBe(false);
    });

    it('should report button support per channel', () => {
      expect(caps.supports('telegram', 'supportsButtons')).toBe(true);
      expect(caps.supports('whatsapp', 'supportsButtons')).toBe(false);
    });
  });

  describe('Message length limits', () => {
    it('should have correct limits per channel', () => {
      expect(caps.getMaxMessageLength('telegram')).toBe(4096);
      expect(caps.getMaxMessageLength('discord')).toBe(2000);
      expect(caps.getMaxMessageLength('slack')).toBe(40000);
      expect(caps.getMaxMessageLength('email')).toBe(0);
    });
  });

  describe('Channel listing', () => {
    it('should list all registered channels', () => {
      const channels = caps.listChannelIds();
      expect(channels).toContain('telegram');
      expect(channels).toContain('whatsapp');
      expect(channels).toContain('discord');
      expect(channels).toContain('slack');
      expect(channels).toContain('email');
      expect(channels).toContain('cli');
    });
  });
});

describe('Advanced — Multi-language edge cases', () => {
  describe('Locale detection', () => {
    it('should detect locale from environment', () => {
      const locale = detectDeviceLocale();
      expect(typeof locale).toBe('string');
      expect(locale.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Language pack loading', () => {
    it('should load EN pack', () => {
      const pack = getLanguagePack('en');
      expect(pack.code).toBe('en-US');
      expect(pack.intents.read_file).toBeDefined();
    });

    it('should load PT pack', () => {
      const pack = getLanguagePack('pt');
      expect(pack.code).toBe('pt-BR');
      expect(pack.intents.read_file.verbs).toContain('ler');
    });

    it('should load JA pack', () => {
      const pack = getLanguagePack('ja');
      expect(pack.code).toBe('ja-JP');
      expect(pack.intents.greeting.phrases).toContain('こんにちは');
    });

    it('should load ZH pack', () => {
      const pack = getLanguagePack('zh');
      expect(pack.code).toBe('zh-CN');
      expect(pack.intents.greeting.phrases).toContain('你好');
    });

    it('should fallback to EN for unknown locale', () => {
      const pack = getLanguagePack('xx');
      expect(Object.keys(pack.intents).length).toBeGreaterThan(0);
    });
  });

  describe('Merged packs', () => {
    it('should merge PT + EN with correct verbs', () => {
      const merged = mergeLanguagePacks('pt', 'en');
      expect(merged.intents.read_file.verbs).toContain('ler');
      expect(merged.intents.read_file.verbs).toContain('read');
    });

    it('should merge JA + EN with correct phrases', () => {
      const merged = mergeLanguagePacks('ja', 'en');
      expect(merged.intents.greeting.phrases).toContain('こんにちは');
      expect(merged.intents.greeting.phrases).toContain('hello');
    });
  });
});
