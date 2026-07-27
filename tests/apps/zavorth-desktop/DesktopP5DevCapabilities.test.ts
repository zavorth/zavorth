import fs from 'node:fs';
import path from 'node:path';
import {
  buildGitCommitSuggestions,
  buildGitLiteSnapshot,
  parseGitBranch,
  parseGitStatusPorcelain,
} from '../../../apps/zavorth-desktop/src/dev/gitLite';
import {
  loadShortcutBindings,
  saveShortcutBinding,
  SHORTCUT_STORAGE_KEY,
} from '../../../apps/zavorth-desktop/src/shortcuts/shortcutRegistry';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
}

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) || null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    snapshot: () => Object.fromEntries(data.entries()),
  };
}

describe('Desktop P5 developer capabilities contract', () => {
  it('parses Git Lite read-only status, branch and commit suggestions', () => {
    const status = '## feature/p5...origin/feature/p5\n M src/app.ts\nA  tests/app.test.ts\nR  old.ts -> src/new.ts\nc notes.md\n';
    const files = parseGitStatusPorcelain(status);

    expect(parseGitBranch(status)).toBe('feature/p5');
    expect(files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'src/app.ts', worktreeStatus: 'modified' }),
      expect.objectContaining({ path: 'tests/app.test.ts', indexStatus: 'added' }),
      expect.objectContaining({ path: 'src/new.ts', previousPath: 'old.ts', indexStatus: 'renamed' }),
      expect.objectContaining({ path: 'notes.md', indexStatus: 'untracked' }),
    ]));
    expect(buildGitCommitSuggestions(files, 'diff --git a/src/git.ts b/src/git.ts')).toEqual(expect.arrayContaining([
      expect.stringContaining('Git workflow controls'),
    ]));
    expect(buildGitLiteSnapshot({ statusOutput: status }).readOnly).toBe(true);
  });

  it('keeps Git Pro permission-gated in the desktop rail', () => {
    const railSource = readSource('apps/zavorth-desktop/src/shell/DesktopRightRail.tsx');
    expect(railSource).toContain("path: '/api/web/git/status'");
    expect(railSource).toContain("t('gitPro')");
    expect(railSource).toContain('disabled key={action}');
    expect(railSource).toContain('gitProApprovalRequired');
  });

  it('uses local Mermaid and avoids CDN imports', () => {
    const rendererSource = readSource('apps/zavorth-desktop/src/components/EmbedRenderer.tsx');
    expect(rendererSource).toContain("import('../lib/localMermaid')");
    expect(rendererSource).not.toContain('cdn.jsdelivr.net');
    expect(rendererSource).not.toContain('https://cdn');
  });

  it('adds a local safe editor layer for code and diff rendering', () => {
    const editorSource = readSource('apps/zavorth-desktop/src/components/InlineCodeEditor.tsx');
    const diffSource = readSource('apps/zavorth-desktop/src/components/DiffView.tsx');
    expect(editorSource).toContain('zvd-inline-editor__highlight');
    expect(editorSource).toContain('highlightLine');
    expect(diffSource).toContain("type: 'meta'");
    expect(diffSource).toContain("type: 'hunk'");
  });

  it('persists truly reconfigurable shortcuts', () => {
    const storage = fakeStorage();
    const next = saveShortcutBinding('terminal.toggle', ['Ctrl', 'Shift', 'T'], storage);
    expect(next.find(shortcut => shortcut.actionId === 'terminal.toggle')?.keys).toEqual(['Ctrl', 'Shift', 'T']);
    expect(storage.snapshot()).toHaveProperty(SHORTCUT_STORAGE_KEY);
    expect(loadShortcutBindings(storage).find(shortcut => shortcut.actionId === 'terminal.toggle')?.keys).toEqual(['Ctrl', 'Shift', 'T']);
  });
});
