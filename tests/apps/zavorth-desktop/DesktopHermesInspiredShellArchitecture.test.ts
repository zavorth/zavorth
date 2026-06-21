import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const desktopRoot = join(process.cwd(), 'apps/zavorth-desktop');

function read(relativePath: string): string {
  return readFileSync(join(desktopRoot, relativePath), 'utf8');
}

function readShellSurface(): string {
  return `${read('src/shell/DesktopShell.tsx')}\n${read('src/hub-skin/HubNativeShell.tsx')}`;
}

describe('Zavorth desktop Hermes-inspired shell architecture', () => {
  it('uses a first-class pane shell for sidebar, main workspace and inspector', () => {
    const shellPath = join(desktopRoot, 'src/shell/ZavorthPaneShell.tsx');
    const desktopShell = readShellSurface();

    expect(existsSync(shellPath)).toBe(true);
    expect(read('src/shell/ZavorthPaneShell.tsx')).toContain('export function ZavorthPaneShell');
    expect(read('src/shell/ZavorthPaneShell.tsx')).toContain('export function ZavorthPane');
    expect(read('src/shell/ZavorthPaneShell.tsx')).toContain('export function ZavorthPaneMain');
    expect(desktopShell).toContain('<ZavorthPaneShell');
    expect(desktopShell).toContain('id="sidebar"');
    expect(desktopShell).toContain('id="inspector"');
    expect(desktopShell).toContain('<ZavorthPaneMain');
  });

  it('adds an operational preview popover without enabling unsafe webviews', () => {
    const previewPath = join(desktopRoot, 'src/shell/DesktopPreviewRail.tsx');
    const desktopShell = readShellSurface();
    const main = read('electron/main.cjs');

    expect(existsSync(previewPath)).toBe(true);
    expect(read('src/shell/DesktopPreviewRail.tsx')).toContain('export function DesktopPreviewRail');
    expect(read('src/shell/DesktopPreviewRail.tsx')).toContain('Andamento');
    expect(read('src/shell/DesktopPreviewRail.tsx')).toContain('Saidas');
    expect(desktopShell).toContain('<DesktopPreviewRail');
    expect(desktopShell).toContain('previewOpen && hasPreviewActivity');
    expect(desktopShell).not.toContain('id="preview"');
    expect(main).toContain('webviewTag: false');
  });

  it('uses theme seeds and color-mix instead of hard-coded accent families', () => {
    const themesPath = join(desktopRoot, 'src/themePresets.ts');
    const styles = read('src/styles.css');
    const desktopShell = readShellSurface();

    expect(existsSync(themesPath)).toBe(true);
    expect(read('src/themePresets.ts')).toContain('zavorthThemePresets');
    expect(read('src/themePresets.ts')).toContain('orange');
    expect(read('src/themePresets.ts')).toContain('purple');
    expect(read('src/themePresets.ts')).toContain('navy');
    expect(styles).toContain('--zvd-bg: color-mix');
    expect(styles).toContain('--zvd-accent: var(--zvd-seed-accent)');
    expect(desktopShell).toContain('zavorthThemePresets');
    expect(desktopShell).toContain('--zvd-seed-accent');
  });

  it('keeps the integrated terminal persistent and supports a trusted-workspace takeover mode', () => {
    const desktopShell = readShellSurface();
    const terminal = read('src/shell/InteractiveTerminal.tsx');
    const main = read('electron/main.cjs');

    expect(desktopShell).toContain('terminalTakeover');
    expect(desktopShell).toContain('zvd-terminal-takeover');
    expect(desktopShell).toContain('Terminal focus');
    expect(desktopShell).toContain('has-terminal-panel');
    expect(desktopShell).toContain("props.activePanel !== 'chat' && !terminalTakeover");
    expect(desktopShell).toContain('setBottomPanelOpen(false)');
    expect(terminal).toContain('preserveSession');
    expect(main).toContain('Selecionar pasta de trabalho do Zavorth');
  });

  it('uses Electron hidden titlebar overlay instead of a fully custom unsafe frame', () => {
    const main = read('electron/main.cjs');
    const topbar = read('src/navigation/DesktopTopbar.tsx');
    const styles = read('src/styles.css');

    expect(main).toContain("title: 'Zavorth'");
    expect(main).toContain('contextIsolation: true');
    expect(topbar).toContain('zvd-topbar');
    expect(readShellSurface()).toContain("useState(resolvedTheme === 'dark' ? 324 : 260)");
    expect(readShellSurface()).toContain("minWidth={resolvedTheme === 'dark' ? 260 : 200}");
    expect(styles).toContain('-webkit-app-region: drag');
    expect(styles).toContain('-webkit-app-region: no-drag');
  });
});
