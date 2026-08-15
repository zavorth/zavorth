import { readFileSync } from 'node:fs';
import { join , resolve} from 'node:path';


const desktopRoot = resolve(__dirname, '../../../apps/zavorth-desktop');

function read(relativePath: string): string {
  return readFileSync(join(desktopRoot, relativePath), 'utf8');
}

function readShellSurface(): string {
  return `${read('src/shell/DesktopShell.tsx')}\n${read('src/hub-skin/HubNativeShell.tsx')}`;
}

describe('Zavorth desktop chat reference and contextual preview', () => {
  it('renders user messages as right-side prompts and assistant messages as plain agent transcript', () => {
    const thread = read('src/thread/ThreadView.tsx');
    const styles = read('src/styles.css');

    expect(thread).toContain('zvd-message');
    expect(thread).toContain('message.role');
    expect(styles).toContain('.zvd-message--user');
    expect(styles).toContain('align-self: flex-end');
    expect(styles).toContain('.zvd-message');
  });

  it('uses a calmer dark workspace palette with the sidebar darker than the chat surface', () => {
    const styles = read('src/styles.css');

    expect(styles).toContain('--zvd-surface');
    expect(styles).toContain('--zvd-sidebar');
    expect(styles).toContain('.theme-dark .zvd-sidebar');
    expect(styles).toContain('background: #202020');
    expect(styles).toContain('.theme-dark .zvd-content-stage');
    expect(styles).toContain('#151515');
    expect(styles).toContain('.theme-dark .zvd-message--user');
    expect(styles).toContain('background: #2b2b2b');
  });

  it('keeps approval activity as a themed runtime card instead of a white inline pill', () => {
    const strip = read('src/thread/InlineActivityStrip.tsx');
    const card = read('src/thread/InThreadApprovalCard.tsx');
    const styles = read('src/styles.css');

    expect(strip).toContain('zvd-activity-strip');
    expect(strip).toContain('zvd-running-dot');
    expect(strip).toContain('surfaceProjection');
    expect(strip).toContain('Run once');
    expect(strip).toContain('Deny');
    expect(card).toContain('Run once');
    expect(card).toContain('Session');
    expect(card).toContain('Always');
    expect(card).toContain('Deny');
    expect(styles).toContain('position: sticky');
    expect(styles).toContain('bottom: 6px');
    expect(styles).toContain('align-self: center');
  });

  it('keeps the composer slimmer and responsive in non-maximized windows', () => {
    const styles = read('src/styles.css');

    expect(styles).toContain('.zvd-composer-shell');
    expect(read('src/composer/DesktopCommandBar.tsx')).toContain('rows={2}');
    expect(styles).toContain('@media (max-width: 980px)');
    expect(styles).toContain('width: calc(100% - 28px)');
  });

  it('reserves native window-control space in the topbar chrome', () => {
    const styles = read('src/styles.css');

    expect(styles).toContain('.zvd-topbar');
    expect(styles).toContain('text-overflow: ellipsis');
  });

  it('keeps the activity preview behind an explicit compact popover instead of a fixed right rail', () => {
    const shell = readShellSurface();
    const preview = read('src/shell/DesktopPreviewRail.tsx');

    expect(shell).toContain('hasPreviewActivity');
    expect(shell).toContain('previewOpen && hasPreviewActivity');
    expect(shell).toContain('previewMode');
    expect(shell).toContain('zvd-preview-popover');
    expect(shell).not.toContain('id="preview"');
    expect(shell).toContain('previewOpen');
    expect(preview).toContain("mode: 'compact' | 'expanded'");
    expect(preview).toContain('Andamento');
    expect(preview).toContain('Saidas');
    expect(preview).toContain('Fontes');
  });

  it('does not use landing-page preview labels or large always-on artifact cards', () => {
    const preview = read('src/shell/DesktopPreviewRail.tsx');
    const styles = read('src/styles.css');

    expect(preview).not.toContain('Workspace Preview');
    expect(preview).not.toContain('Artifact preview');
    expect(styles).toContain('.zvd-preview-popover');
    expect(styles).toContain('.zavorth-preview-rail.zvd-preview-rail.is-compact');
  });

  it('keeps the terminal as a bottom split below chat, with fullscreen only in focus mode', () => {
    const shell = readShellSurface();
    const styles = read('src/styles.css');

    expect(shell).toContain('has-terminal-panel');
    expect(styles).toContain('.zvd-workspace.has-terminal-panel');
    expect(styles).toContain('grid-template-rows: 42px minmax(0, 1fr) 24px;');
    expect(styles).toContain('.zavorth-pane-shell .zvd-terminal-panel {\n  position: relative');
    expect(styles).toContain('.zavorth-pane-shell .zvd-terminal-panel.is-takeover {\n  position: fixed');
  });
});
