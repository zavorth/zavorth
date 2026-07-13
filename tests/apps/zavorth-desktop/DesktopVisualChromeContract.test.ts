import fs from 'node:fs';
import path from 'node:path';

describe('Zavorth desktop visual chrome contract', () => {
  const read = (relativePath: string) =>
    fs.readFileSync(path.resolve(relativePath), 'utf8');

  it('keeps composer text focus neutral instead of showing the global accent ring', () => {
    const styles = read('apps/zavorth-desktop/src/styles.css');

    expect(styles).toContain('.zvd-composer-shell textarea:focus');
    expect(styles).toContain('.zvd-composer-shell textarea:focus-visible');
    expect(styles).toContain('box-shadow: none !important;');
    expect(styles).toContain('border-color: transparent !important;');
  });

  it('keeps the sidebar brand text-only and the search action aligned', () => {
    const sidebar = read('apps/zavorth-desktop/src/navigation/DesktopSidebar.tsx');
    const styles = read('apps/zavorth-desktop/src/styles.css');

    expect(sidebar).toContain('<div className="zvd-brand" aria-label="Zavorth">');
    expect(sidebar).toContain('<strong>Zavorth</strong>');
    expect(sidebar).not.toContain('logo-clean.png');
    expect(sidebar).toContain('className="zvd-sidebar-collapsed-top"');

    expect(styles).toContain('.zvd-search-session {');
    expect(styles).toContain('justify-content: flex-start;');
    expect(styles).toContain('width: calc(100% - 20px);');
  });

  it('hides the Windows native titlebar icon while preserving the taskbar icon', () => {
    const main = read('apps/zavorth-desktop/electron/main.cjs');
    const shell = read('apps/zavorth-desktop/src/shell/DesktopShell.tsx');
    const styles = read('apps/zavorth-desktop/src/styles.css');

    expect(main).toContain('function resolveAppIcon');
    expect(main).toContain('icon: resolveAppIcon()');
    expect(main).toContain("titleBarStyle: 'hidden'");
    expect(main).toContain('titleBarOverlay');
    expect(shell).toContain("navigator.userAgent.includes('Windows')");
    expect(styles).toContain('.zvd-app.is-windows .zvd-topbar');
    expect(styles).toContain('padding-right: 154px;');
  });

  it('styles the topbar workspace label as a compact grouped control', () => {
    const styles = read('apps/zavorth-desktop/src/styles.css');

    expect(styles).toContain('.zvd-topbar-title {');
    expect(styles).toContain('display: inline-flex;');
    expect(styles).toContain('gap: 3px;');
    expect(styles).toContain('max-width: min(360px, 42vw);');
  });
});
