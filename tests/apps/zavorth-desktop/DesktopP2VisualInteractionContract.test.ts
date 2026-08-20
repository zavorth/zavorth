import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

describe('Desktop P2 visual and interaction contract', () => {
  it('wires premium themes through settings, app state and the desktop shell', () => {
    const app = read('apps/zavorth-desktop/src/App.tsx');
    const state = read('apps/zavorth-desktop/src/useDesktopAppState.ts');
    const settings = read('apps/zavorth-desktop/src/components/SettingsOverlay.tsx');
    const shell = read('apps/zavorth-desktop/src/shell/DesktopShell.tsx');

    expect(settings).toContain('ThemeStudioPanel');
    expect(settings).toContain('onPremiumThemePreview');
    expect(settings).toContain('onPremiumThemeImport');
    expect(app).toContain('premiumThemePreviewId');
    expect(state).toContain('selectPremiumThemeForProfile');
    expect(shell).toContain('premium-theme-');
    expect(shell).toContain('data-premium-theme');
    expect(shell).toContain('--zvd-glass-opacity');
  });

  it('adds premium state, loader, error and recovery surfaces without loud legacy styling', () => {
    const polish = read('apps/zavorth-desktop/src/components/ProductPolishComponents.tsx');
    const styles = read('apps/zavorth-desktop/src/styles.css');
    const stateStyles = read('apps/zavorth-desktop/src/styles/state-surfaces.css');

    expect(polish).toContain('RecoveryOverlay');
    expect(polish).toContain('InfinityStateLoader');
    expect(polish).toContain('zvd-premium-empty-state');
    expect(polish).toContain('zvd-premium-alert');
    expect(stateStyles).toContain('.zvd-state-card');
    expect(stateStyles).toContain('.zvd-recovery-overlay');
    expect(styles).toContain('.zvd-theme-studio');
    expect(styles).not.toContain('ðŸ“');
    expect(styles).not.toContain('âš');
  });

  it('extends the electron smoke checks across first use, settings, composer, mascot and window sizes', () => {
    const smoke = read('apps/zavorth-desktop/scripts/desktop-electron-smoke.mjs');

    expect(smoke).toContain('userDataDir');
    expect(smoke).toContain('clickDetailAction');
    expect(smoke).toContain('runtimeStateSnapshot');
    expect(smoke).toContain('Smoke Marketplace Skill');
  });
});
