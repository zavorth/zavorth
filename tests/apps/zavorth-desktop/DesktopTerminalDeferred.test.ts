import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';

describe('Fase 15 — Terminal and HubNativeShell Defer/Hard-Disable', () => {
  let versionedFiles: string[] = [];

  beforeAll(() => {
    try {
      const output = child_process.execSync('git ls-files', { encoding: 'utf8' });
      versionedFiles = output
        .split('\n')
        .map(f => f.trim())
        .filter(Boolean)
        .map(f => path.resolve(f));
    } catch (error: unknown) {
      console.warn('git ls-files failed, falling back to basic resolution', error);
      versionedFiles = [];
    }
  });

  it('ensures no versioned desktop file imports InteractiveTerminal or HubNativeShell', () => {
    expect(versionedFiles.length).toBeGreaterThan(0);

    const desktopSrcFiles = versionedFiles.filter(file =>
      file.includes(path.normalize('apps/zavorth-desktop/src/'))
    );

    expect(desktopSrcFiles.length).toBeGreaterThan(0);

    for (const file of desktopSrcFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check imports
      expect(content).not.toContain('InteractiveTerminal');
      expect(content).not.toContain('HubNativeShell');
    }
  });

  it('ensures no versioned desktop file contains writePty or openPty', () => {
    const desktopSrcFiles = versionedFiles.filter(file =>
      file.includes(path.normalize('apps/zavorth-desktop/src/'))
    );

    for (const file of desktopSrcFiles) {
      const content = fs.readFileSync(file, 'utf8');

      expect(content).not.toContain('writePty');
      expect(content).not.toContain('openPty');
    }
  });

  it('ensures no versioned shell file contains PTY or terminal execution wiring', () => {
    const shellFiles = versionedFiles.filter(file =>
      file.includes(path.normalize('apps/zavorth-desktop/src/shell/'))
    );

    for (const file of shellFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check for raw terminal/PTY connections or commands execution
      expect(content).not.toContain('node-pty');
      expect(content).not.toContain('pty.js');
      expect(content).not.toContain('child_process');
      expect(content).not.toContain('spawn(');
      expect(content).not.toContain('exec(');
    }
  });

  it('verifies WorkspaceWriteApprovalModal continues as overlay top-level in App.tsx', () => {
    const appPath = path.resolve('apps/zavorth-desktop/src/App.tsx');
    expect(fs.existsSync(appPath)).toBe(true);

    const content = fs.readFileSync(appPath, 'utf8');

    // 1. Should import the modal
    expect(content).toContain('WorkspaceWriteApprovalModal');
    expect(content).toContain("import { WorkspaceWriteApprovalModal } from './components/WorkspaceWriteApprovalModal';");

    // 2. Should render the modal in the return block
    expect(content).toContain('<WorkspaceWriteApprovalModal');
    expect(content).toContain('approvals={workspaceWriteApprovals}');
  });
});
