import { describe, it, expect } from '@jest/globals';
import { LocaleTranslationTool } from '../../src/tools/LocaleTranslationTool.js';

describe('LocaleTranslationTool', () => {
  const tool = new LocaleTranslationTool();

  it('has valid tool metadata and parameters schema', () => {
    const def = tool.getDefinition();
    expect(def.name).toBe('locale_manage');
    expect(def.description).toContain('Inspect supported languages');
    expect(def.parameters.properties).toHaveProperty('action');
  });

  it('lists supported locales with metadata and current active locale', async () => {
    const resultJson = await tool.execute({ action: 'list' });
    const result = JSON.parse(resultJson);
    expect(result.ok).toBe(true);
    expect(result.supportedCount).toBeGreaterThanOrEqual(17);
    expect(Array.isArray(result.locales)).toBe(true);
    const arabic = result.locales.find((l: { code: string; isRtl?: boolean }) => l.code === 'ar');
    expect(arabic.isRtl).toBe(true);
  });

  it('retrieves active locale details via get action', async () => {
    const resultJson = await tool.execute({ action: 'get' });
    const result = JSON.parse(resultJson);
    expect(result.ok).toBe(true);
    expect(result.activeLocale).toBeDefined();
    expect(result.endonym).toBeDefined();
  });

  it('switches active locale via set action', async () => {
    const resultJson = await tool.execute({ action: 'set', targetLocale: 'es' });
    const result = JSON.parse(resultJson);
    expect(result.ok).toBe(true);
    expect(result.activeLocale).toBe('es');
  });
});
