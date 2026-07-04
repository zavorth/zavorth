import {
  PREMIUM_THEME_STORAGE_KEY,
  importPremiumTheme,
  loadPremiumThemeState,
  premiumThemeMarketplace,
  resolvePremiumThemeForProfile,
  selectPremiumThemeForProfile,
} from '../../../apps/zavorth-desktop/src/theme/premiumThemes';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('Desktop P2 premium themes', () => {
  it('ships a marketplace with translucent premium presets', () => {
    expect(premiumThemeMarketplace.length).toBeGreaterThanOrEqual(3);
    expect(premiumThemeMarketplace.map(theme => theme.id)).toEqual(
      expect.arrayContaining(['zavorth-atelier', 'graphite-glass', 'daylight-focus']),
    );
    expect(premiumThemeMarketplace.some(theme => theme.translucency === 'glass')).toBe(true);
    expect(premiumThemeMarketplace[0].cssVars).toHaveProperty('--zvd-glass-opacity');
  });

  it('persists selected themes per profile and keeps each profile independent', () => {
    const storage = new MemoryStorage();

    selectPremiumThemeForProfile('developer', 'graphite-glass', storage);
    selectPremiumThemeForProfile('creator', 'daylight-focus', storage);

    const state = loadPremiumThemeState(storage);
    expect(JSON.parse(storage.getItem(PREMIUM_THEME_STORAGE_KEY) || '{}')).toMatchObject({
      selectedByProfile: {
        developer: 'graphite-glass',
        creator: 'daylight-focus',
      },
    });
    expect(resolvePremiumThemeForProfile('developer', state).id).toBe('graphite-glass');
    expect(resolvePremiumThemeForProfile('creator', state).id).toBe('daylight-focus');
  });

  it('imports custom themes with sanitized CSS variables and makes them selectable', () => {
    const storage = new MemoryStorage();

    const imported = importPremiumTheme(JSON.stringify({
      name: 'Studio Calm',
      description: 'A quiet imported workspace theme.',
      translucency: 'glass',
      cssVars: {
        '--zvd-seed-accent': '#4f8dff',
        '--zvd-seed-bg': '#101114',
        '--zvd-glass-opacity': '0.78',
        color: 'red',
        backgroundImage: 'url(http://unsafe.example)',
      },
    }), storage);

    expect(imported.id).toBe('custom-studio-calm');
    expect(imported.cssVars).toMatchObject({
      '--zvd-seed-accent': '#4f8dff',
      '--zvd-seed-bg': '#101114',
      '--zvd-glass-opacity': '0.78',
    });
    expect(imported.cssVars).not.toHaveProperty('color');
    expect(imported.cssVars).not.toHaveProperty('backgroundImage');

    selectPremiumThemeForProfile('power', imported.id, storage);
    expect(resolvePremiumThemeForProfile('power', loadPremiumThemeState(storage)).id).toBe(imported.id);
  });
});
