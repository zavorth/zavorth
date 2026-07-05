import { ZavorthCommandlessModeService } from '../../src/services/ZavorthCommandlessModeService';
import { ZavorthPresentationAdapterService } from '../../src/services/ZavorthPresentationAdapterService';
import { ZavorthChannelCapabilitiesService } from '../../src/services/ZavorthChannelCapabilitiesService';
import { getLanguagePack, mergeLanguagePacks } from '../../src/services/ZavorthIntentI18n';

describe('Edge Cases Extended', () => {
  const service = new ZavorthCommandlessModeService();
  const adapter = new ZavorthPresentationAdapterService();
  const caps = new ZavorthChannelCapabilitiesService();

  describe('Intent detection edge cases', () => {
    it('should handle extremely long input', () => {
      const longInput = 'read the file '.repeat(500);
      const result = service.detectIntent(longInput);
      expect(result.action).toBe('read_file');
    });

    it('should handle input with only special characters', () => {
      const result = service.detectIntent('!@#$%^&*()');
      expect(result.action).toBe('conversation');
    });

    it('should handle input with mixed languages', () => {
      const result = service.detectIntent('search informação about React');
      expect(result.action).toBeDefined();
    });

    it('should handle input with numbers only', () => {
      const result = service.detectIntent('12345');
      expect(result.action).toBe('conversation');
    });

    it('should handle input with emojis', () => {
      const result = service.detectIntent('📧 send email');
      expect(result.action).toBe('email');
    });

    it('should handle input with newlines', () => {
      const result = service.detectIntent('read\nthe\nfile');
      expect(result.action).toBe('read_file');
    });

    it('should handle input with tabs', () => {
      const result = service.detectIntent('read\tthe\tfile');
      expect(result.action).toBe('read_file');
    });
  });

  describe('PresentationAdapter edge cases', () => {
    it('should handle empty text', () => {
      const result = adapter.format({ type: 'text', text: '' }, 'telegram');
      expect(result.text).toBe('');
    });

    it('should handle null options', () => {
      const result = adapter.format(
        { type: 'choice', text: 'Pick:', options: [] },
        'telegram',
      );
      expect(result.text).toContain('Pick:');
    });

    it('should handle very long text', () => {
      const longText = 'A'.repeat(10000);
      const result = adapter.format({ type: 'text', text: longText }, 'telegram');
      expect(result.text.length).toBeLessThanOrEqual(4096);
    });

    it('should handle code with special characters', () => {
      const result = adapter.format(
        { type: 'code', text: 'Code:', code: 'const x = "hello" + "world";' },
        'telegram',
      );
      expect(result.text).toContain('const x');
    });
  });

  describe('ChannelCapabilities edge cases', () => {
    it('should handle unknown channel gracefully', () => {
      const result = caps.get('nonexistent-channel');
      expect(result.supportsMarkdown).toBe(false);
      expect(result.maxMessageLength).toBe(4096);
    });

    it('should handle empty channel ID', () => {
      const result = caps.get('');
      expect(result.supportsMarkdown).toBe(false);
    });
  });

  describe('Language pack edge cases', () => {
    it('should handle locale with extra dashes', () => {
      const pack = getLanguagePack('pt-BR-extra');
      expect(pack).toBeDefined();
    });

    it('should handle merging same language', () => {
      const merged = mergeLanguagePacks('en', 'en');
      expect(Object.keys(merged.intents).length).toBeGreaterThan(0);
    });

    it('should handle merging unknown language with English', () => {
      const merged = mergeLanguagePacks('xx', 'en');
      expect(Object.keys(merged.intents).length).toBeGreaterThan(0);
    });
  });
});
