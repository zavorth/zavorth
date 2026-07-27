import {
  listAllQuickStartChannels,
  listPopularQuickStartChannels,
  listPopularQuickStartProviders,
  listQuickStartProviders,
  resolveQuickStartChannel,
  resolveQuickStartProvider,
} from './stubs/QuickStartCatalog.js';

describe('QuickStartCatalog', () => {
  test('lists popular providers and a full catalog (not detect-only)', () => {
    const popular = listPopularQuickStartProviders();
    const all = listQuickStartProviders();
    expect(popular.length).toBeGreaterThanOrEqual(5);
    expect(all.length).toBeGreaterThanOrEqual(popular.length);
    expect(popular.map((p) => p.id)).toEqual(
      expect.arrayContaining(['openai', 'anthropic', 'local']),
    );
    expect(all.every((p) => p.id !== 'deferred')).toBe(true);
    expect(resolveQuickStartProvider('openai')?.label).toMatch(/OpenAI/i);
    expect(resolveQuickStartProvider('skip')).toBeNull();
  });

  test('lists channels with connectable secrets and skip-friendly catalog', () => {
    const popular = listPopularQuickStartChannels();
    const all = listAllQuickStartChannels();
    expect(popular.map((c) => c.id)).toEqual(
      expect.arrayContaining(['telegram', 'discord', 'slack']),
    );
    expect(all.length).toBeGreaterThanOrEqual(popular.length);
    expect(resolveQuickStartChannel('telegram')?.connectable).toBe(true);
    expect(resolveQuickStartChannel('nope')).toBeNull();
  });
});
