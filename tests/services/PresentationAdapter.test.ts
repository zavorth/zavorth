import { ZavorthChannelCapabilitiesService } from '../../src/services/ZavorthChannelCapabilitiesService';
import {
  ZavorthPresentationAdapterService,
  type UniversalResponse,
} from '../../src/services/ZavorthPresentationAdapterService';

describe('ZavorthChannelCapabilitiesService', () => {
  let service: ZavorthChannelCapabilitiesService;

  beforeEach(() => {
    service = new ZavorthChannelCapabilitiesService();
  });

  it('should return built-in channel capabilities for telegram', () => {
    const caps = service.get('telegram');
    expect(caps.id).toBe('telegram');
    expect(caps.supportsMarkdown).toBe(true);
    expect(caps.supportsButtons).toBe(true);
    expect(caps.maxMessageLength).toBe(4096);
  });

  it('should return built-in channel capabilities for whatsapp', () => {
    const caps = service.get('whatsapp');
    expect(caps.id).toBe('whatsapp');
    expect(caps.supportsMarkdown).toBe(false);
    expect(caps.supportsButtons).toBe(false);
    expect(caps.supportsImages).toBe(true);
  });

  it('should return fallback capabilities for unknown channel', () => {
    const caps = service.get('my-custom-channel');
    expect(caps.id).toBe('my-custom-channel');
    expect(caps.supportsMarkdown).toBe(false);
    expect(caps.supportsButtons).toBe(false);
    expect(caps.supportsRichEmbeds).toBe(false);
    expect(caps.maxMessageLength).toBe(4096);
  });

  it('should register custom channel capabilities', () => {
    service.register({
      id: 'my-bot',
      label: 'My Custom Bot',
      supportsMarkdown: true,
      supportsButtons: false,
      supportsRichEmbeds: false,
      supportsImages: true,
      supportsAudio: false,
      supportsVideo: false,
      supportsReactions: false,
      supportsHTML: false,
      supportsThreads: false,
      supportsMessageEditing: false,
      supportsPinning: false,
      maxMessageLength: 2000,
      maxButtonsPerMessage: 0,
      maxAttachmentsPerMessage: 5,
      supportsEphemeral: false,
      supportsScheduledMessages: false,
      supportsTypingIndicator: false,
      supportsPresence: false,
    });

    const caps = service.get('my-bot');
    expect(caps.supportsMarkdown).toBe(true);
    expect(caps.maxMessageLength).toBe(2000);
  });

  it('should support method for checking individual capabilities', () => {
    expect(service.supports('telegram', 'supportsButtons')).toBe(true);
    expect(service.supports('whatsapp', 'supportsButtons')).toBe(false);
    expect(service.supports('discord', 'supportsRichEmbeds')).toBe(true);
  });

  it('should list all registered channel IDs', () => {
    const ids = service.listChannelIds();
    expect(ids).toContain('telegram');
    expect(ids).toContain('whatsapp');
    expect(ids).toContain('discord');
    expect(ids).toContain('slack');
    expect(ids).toContain('email');
    expect(ids).toContain('web-dashboard');
    expect(ids).toContain('cli');
  });

  it('should not unregister built-in channels', () => {
    expect(service.unregister('telegram')).toBe(false);
    expect(service.has('telegram')).toBe(true);
  });

  it('should unregister custom channels', () => {
    service.register({ id: 'temp', label: 'Temp', supportsMarkdown: false, supportsButtons: false, supportsRichEmbeds: false, supportsImages: false, supportsAudio: false, supportsVideo: false, supportsReactions: false, supportsHTML: false, supportsThreads: false, supportsMessageEditing: false, supportsPinning: false, maxMessageLength: 1000, maxButtonsPerMessage: 0, maxAttachmentsPerMessage: 0, supportsEphemeral: false, supportsScheduledMessages: false, supportsTypingIndicator: false, supportsPresence: false });
    expect(service.has('temp')).toBe(true);
    expect(service.unregister('temp')).toBe(true);
    expect(service.has('temp')).toBe(false);
  });
});

describe('ZavorthPresentationAdapterService', () => {
  let caps: ZavorthChannelCapabilitiesService;
  let adapter: ZavorthPresentationAdapterService;

  beforeEach(() => {
    caps = new ZavorthChannelCapabilitiesService();
    adapter = new ZavorthPresentationAdapterService(caps);
  });

  it('should format plain text for telegram with markdown', () => {
    const response: UniversalResponse = {
      type: 'text',
      text: 'Hello world',
    };
    const result = adapter.format(response, 'telegram');
    expect(result.text).toBe('Hello world');
    expect(result.originalType).toBe('text');
    expect(result.appliedCapabilities).toContain('markdown');
  });

  it('should strip markdown for whatsapp', () => {
    const response: UniversalResponse = {
      type: 'text',
      text: '**Bold** and *italic* text',
    };
    const result = adapter.format(response, 'whatsapp');
    expect(result.text).toBe('Bold and italic text');
    expect(result.appliedCapabilities).toContain('plain-text');
  });

  it('should use inline buttons for telegram choices', () => {
    const response: UniversalResponse = {
      type: 'choice',
      text: 'Pick one:',
      options: ['Option A', 'Option B', 'Option C'],
    };
    const result = adapter.format(response, 'telegram');
    expect(result.buttons).toHaveLength(3);
    expect(result.buttons![0].label).toBe('Option A');
    expect(result.appliedCapabilities).toContain('inline-buttons');
  });

  it('should use numbered list for whatsapp choices', () => {
    const response: UniversalResponse = {
      type: 'choice',
      text: 'Pick one:',
      options: ['Option A', 'Option B'],
    };
    const result = adapter.format(response, 'whatsapp');
    expect(result.buttons).toBeUndefined();
    expect(result.text).toContain('1\uFE0F\u20E3 Option A');
    expect(result.text).toContain('2\uFE0F\u20E3 Option B');
    expect(result.appliedCapabilities).toContain('numbered-list');
  });

  it('should format code blocks for markdown channels', () => {
    const response: UniversalResponse = {
      type: 'code',
      text: 'Here is the code:',
      code: 'const x = 1;',
      language: 'typescript',
    };
    const result = adapter.format(response, 'telegram');
    expect(result.text).toContain('```typescript');
    expect(result.text).toContain('const x = 1;');
    expect(result.appliedCapabilities).toContain('code-block');
  });

  it('should indent code for non-markdown channels', () => {
    const response: UniversalResponse = {
      type: 'code',
      text: 'Here is the code:',
      code: 'const x = 1;',
    };
    const result = adapter.format(response, 'whatsapp');
    expect(result.text).toContain('  const x = 1;');
    expect(result.appliedCapabilities).toContain('indented-code');
  });

  it('should format error with emoji for markdown channels', () => {
    const response: UniversalResponse = {
      type: 'error',
      text: 'Something went wrong',
    };
    const result = adapter.format(response, 'discord');
    expect(result.text).toContain('\u26A0\uFE0F');
    expect(result.text).toContain('**Error**');
  });

  it('should format error with prefix for plain text channels', () => {
    const response: UniversalResponse = {
      type: 'error',
      text: 'Something went wrong',
    };
    const result = adapter.format(response, 'whatsapp');
    expect(result.text).toContain('[ERROR]');
  });

  it('should truncate messages exceeding channel limit', () => {
    const response: UniversalResponse = {
      type: 'text',
      text: 'A'.repeat(5000),
    };
    const result = adapter.format(response, 'telegram');
    expect(result.text.length).toBeLessThanOrEqual(4096);
    expect(result.text).toContain('...');
  });

  it('should not truncate when maxMessageLength is 0 (no limit)', () => {
    const response: UniversalResponse = {
      type: 'text',
      text: 'A'.repeat(50000),
    };
    const result = adapter.format(response, 'email');
    expect(result.text.length).toBe(50000);
  });

  it('should split long messages into chunks', () => {
    const text = 'Line 1\n'.repeat(600);
    const chunks = adapter.splitMessage(text, 'telegram');
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4096);
    }
  });

  it('should not split when maxMessageLength is 0', () => {
    const text = 'A'.repeat(50000);
    const chunks = adapter.splitMessage(text, 'email');
    expect(chunks).toHaveLength(1);
  });

  it('should handle unknown channel with fallback', () => {
    const response: UniversalResponse = {
      type: 'choice',
      text: 'Pick:',
      options: ['A', 'B'],
    };
    const result = adapter.format(response, 'unknown-channel');
    expect(result.text).toContain('Pick:');
    expect(result.text).toContain('A');
    expect(result.text).toContain('B');
  });

  it('should format card with rich embed for discord', () => {
    const response: UniversalResponse = {
      type: 'card',
      title: 'My Card',
      text: 'Card content here',
    };
    const result = adapter.format(response, 'discord');
    expect(result.text).toContain('**My Card**');
    expect(result.appliedCapabilities).toContain('rich-embed');
  });

  it('should format card with markdown fallback for telegram', () => {
    const response: UniversalResponse = {
      type: 'card',
      title: 'My Card',
      text: 'Card content here',
    };
    const result = adapter.format(response, 'telegram');
    expect(result.text).toContain('**My Card**');
    expect(result.appliedCapabilities).toContain('markdown-card');
  });

  it('should format list with bullets', () => {
    const response: UniversalResponse = {
      type: 'list',
      title: 'Items',
      items: ['Item 1', 'Item 2', 'Item 3'],
    };
    const result = adapter.format(response, 'telegram');
    expect(result.text).toContain('- Item 1');
    expect(result.text).toContain('- Item 2');
    expect(result.text).toContain('- Item 3');
    expect(result.appliedCapabilities).toContain('bullet-list');
  });

  it('should format confirmation with buttons when supported', () => {
    const response: UniversalResponse = {
      type: 'confirmation',
      text: 'Are you sure-',
    };
    const result = adapter.format(response, 'telegram');
    expect(result.buttons).toHaveLength(2);
    expect(result.buttons![0].label).toBe('Confirm');
    expect(result.buttons![1].label).toBe('Cancel');
    expect(result.appliedCapabilities).toContain('confirm-buttons');
  });

  it('should format confirmation with text fallback when buttons not supported', () => {
    const response: UniversalResponse = {
      type: 'confirmation',
      text: 'Are you sure-',
    };
    const result = adapter.format(response, 'whatsapp');
    expect(result.buttons).toBeUndefined();
    expect(result.text).toContain('yes');
    expect(result.text).toContain('no');
    expect(result.appliedCapabilities).toContain('text-confirmation');
  });
});
