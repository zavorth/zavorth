import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const desktopRoot = join(process.cwd(), 'apps/zavorth-desktop');

function read(relativePath: string): string {
  return readFileSync(join(desktopRoot, relativePath), 'utf8');
}

function cssRule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  return match?.[1] || '';
}

describe('desktop terminal dock contract', () => {
  it('renders the terminal in the chat dock below the composer instead of floating over the user', () => {
    const shell = read('src/shell/DesktopShell.tsx');

    expect(shell).toContain('zvd-chat-dock');
    expect(shell).toContain("bottomPanelOpen ? 'is-terminal-open' : ''");
    expect(shell.indexOf('zvd-composer-dock')).toBeLessThan(shell.indexOf('zvd-terminal-panel'));
    expect(shell).toContain('aria-label="Chat input and terminal dock"');
  });

  it('lays out the dock from the bottom so the composer moves up and remains usable', () => {
    const styles = read('src/styles.css');
    const dockRule = cssRule(styles, '.zvd-chat-dock');
    const terminalRule = cssRule(styles, '.zvd-terminal-panel');
    const composerRule = cssRule(styles, '.zvd-composer-shell');

    expect(dockRule).toContain('position: absolute');
    expect(dockRule).toContain('bottom: 16px');
    expect(dockRule).toContain('flex-direction: column');
    expect(dockRule).toContain('pointer-events: none');
    expect(styles).toContain('.zvd-chat-dock > * {\n  pointer-events: auto;');
    expect(styles).toContain('.zvd-chat-dock.is-terminal-open .zvd-composer-dock');
    expect(styles).toContain('@keyframes zvd-terminal-rise');
    expect(styles).toContain('@keyframes zvd-terminal-collapse');

    expect(composerRule).toContain('position: relative');
    expect(composerRule).not.toContain('bottom: 16px');
    expect(composerRule).not.toContain('transform: translateX(-50%)');

    expect(terminalRule).toContain('position: relative');
    expect(terminalRule).toContain('order: 2');
    expect(terminalRule).toContain('max-height: min(280px, 32vh)');
    expect(terminalRule).not.toContain('bottom: 92px');
    expect(terminalRule).not.toContain('z-index: 10');
  });
});
