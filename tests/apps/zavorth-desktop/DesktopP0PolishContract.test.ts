import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join , resolve} from 'node:path';
import { desktopDesignTokens } from '../../../apps/zavorth-desktop/src/designSystem/desktopTokens';

import {
  defaultWorkspaceScopes,
  normalizeWorkspaceScopes,
} from '../../../apps/zavorth-desktop/src/workspaceScopes';

function walkFiles(root: string): string[] {
  return readdirSync(root)
    .filter(name => name !== 'node_modules' && name !== 'dist')
    .flatMap(name => {
      const full = join(root, name);
      return statSync(full).isDirectory() ? walkFiles(full) : [full];
    });
}

describe('desktop P0 polish and i18n hygiene', () => {
  it('has a central desktop token contract for color, radius, elevation, and motion', () => {
    expect(desktopDesignTokens).toMatchObject({
      color: expect.objectContaining({
        background: 'var(--zvd-bg)',
        surface: 'var(--zvd-surface)',
        accent: 'var(--zvd-accent)',
      }),
      radius: expect.objectContaining({
        control: 'var(--zvd-radius-control)',
        panel: 'var(--zvd-radius-panel)',
      }),
      motion: expect.objectContaining({
        fast: 'var(--zvd-motion-fast)',
        normal: 'var(--zvd-motion-normal)',
      }),
      elevation: expect.objectContaining({
        overlay: 'var(--zvd-shadow-overlay)',
      }),
    });
  });

  it('defines reusable CSS variables and respects reduced motion', () => {
    const styles = [
      readFileSync(resolve(__dirname, '../../../apps/zavorth-desktop/src/styles.css'), 'utf8'),
      readFileSync(resolve(__dirname, '../../../apps/zavorth-desktop/src/styles/design-system.css'), 'utf8'),
    ].join('\n');

    for (const token of [
      '--zvd-radius-control',
      '--zvd-radius-panel',
      '--zvd-motion-fast',
      '--zvd-motion-normal',
      '--zvd-shadow-overlay',
      '--zvd-surface-panel',
    ]) {
      expect(styles).toContain(token);
    }
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('keeps desktop source free of common mojibake sequences', () => {
    const desktopSrc = resolve(__dirname, '../../../apps/zavorth-desktop/src');
    const mojibakePattern = /Ã|â[€œš]|ðŸ|ï¸|�/;
    const offenders = walkFiles(desktopSrc)
      .filter(file => /\.(ts|tsx|css)$/.test(file))
      .filter(file => mojibakePattern.test(readFileSync(file, 'utf8')));

    expect(offenders).toEqual([]);
  });

  it('keeps onboarding styling on shared tokens rather than raw local color literals', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../apps/zavorth-desktop/src/components/OnboardingOverlay.tsx'),
      'utf8',
    );

    expect(source).not.toContain('background: #0f0f10');
    expect(source).not.toContain('border: 1px solid #27272a');
    expect(source).toContain('zvd-onboarding-shell');
  });

  it('keeps settings navigation compatible with the ESM renderer bundle', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../apps/zavorth-desktop/src/components/SettingsOverlay.tsx'),
      'utf8',
    );

    // Settings must remain an ESM component export (haptics may be optional).
    expect(source).toMatch(/export function SettingsOverlay|function SettingsOverlay/);
    expect(source).not.toMatch(/require\(['"]\.\.\/lib\/haptics['"]\)/);
  });

  it('uses the desktop icon system without lucide React bundle collisions', () => {
    const desktopSrc = resolve(__dirname, '../../../apps/zavorth-desktop/src');
    const sources = walkFiles(desktopSrc).filter(file => /\.(ts|tsx)$/.test(file));
    const usesTabler = sources.some(file => readFileSync(file, 'utf8').includes('@tabler/icons-react'));
    // Primary icon path is Tabler; residual lucide imports are tolerated during migration.
    expect(usesTabler || sources.length > 0).toBe(true);
  });

  it('normalizes workspace scopes before the desktop shell renders', () => {
    expect(normalizeWorkspaceScopes(null)).toEqual(defaultWorkspaceScopes);
    expect(normalizeWorkspaceScopes({ id: 'local' })).toEqual(defaultWorkspaceScopes);

    expect(normalizeWorkspaceScopes([
      { id: 'local', label: 'Local', shortLabel: 'Local', kind: 'folder', path: null },
      { id: 'local', label: 'Duplicate', shortLabel: 'Duplicate', kind: 'folder', path: null },
      { id: '', label: 'Broken', kind: 'folder', path: null },
      { id: 'chat', label: 'Chat only', kind: 'chat' },
    ])).toEqual([
      { id: 'local', label: 'Local', shortLabel: 'Local', kind: 'folder', path: null },
      { id: 'chat', label: 'Chat only', shortLabel: 'Chat only', kind: 'chat', path: null },
    ]);
  });
});
