import { readFileSync } from 'node:fs';
import { join , resolve} from 'node:path';


const desktopRoot = resolve(__dirname, '../../../apps/zavorth-desktop');

function read(relativePath: string): string {
  return readFileSync(join(desktopRoot, relativePath), 'utf8');
}

function readShellSurface(): string {
  return `${read('src/shell/DesktopShell.tsx')}\n${read('src/hub-skin/HubNativeShell.tsx')}`;
}

describe('Zavorth desktop new chat and conversation surface', () => {
  it('creates an isolated desktop session when starting a new chat', () => {
    const app = read('src/App.tsx');
    const runtimeState = read('src/appRuntimeState.ts');

    expect(app).toContain('sessionId');
    expect(app).toContain('setMessages([]);');
    expect(runtimeState).toContain('export function normalizeMessages');
  });

  it('removes fake static chat/project threads from the sidebar', () => {
    const sidebar = read('src/navigation/DesktopSidebar.tsx');

    expect(sidebar).toContain("t('nav.conversations')");
    expect(sidebar).toContain("t('nav.projects')");
    expect(sidebar).toContain("t('nav.noConversations')");
    expect(sidebar).toContain("t('nav.newChat')");
  });

  it('renders chat messages as centered agent output with rounded user prompt blocks', () => {
    const thread = read('src/thread/ThreadView.tsx');
    const styles = read('src/styles.css');

    expect(thread).toContain('zvd-message');
    expect(thread).toContain('message.role');
    expect(thread).toContain('message.content');
    expect(styles).toContain('.zvd-message--user');
    expect(styles).toContain('align-self: flex-end');
  });

  it('keeps the preview rail contextual and compact instead of landing-page cards', () => {
    const preview = read('src/shell/DesktopPreviewRail.tsx');
    const styles = read('src/styles.css');
    const shell = readShellSurface();

    expect(preview).not.toContain('Artifact preview');
    expect(preview).toContain('Andamento');
    expect(preview).toContain('Saidas');
    expect(styles).toContain('.zvd-preview-rail.is-quiet');
    expect(styles).toContain('.zvd-preview-rail.is-compact');
    expect(shell).toContain('hasPreviewActivity');
    expect(shell).toContain('previewOpen && hasPreviewActivity');
    expect(shell).toContain('zvd-preview-popover');
    expect(shell).not.toContain('id="preview"');
  });
});
