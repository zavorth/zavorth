
import fs from 'fs';
import os from 'os';
import path from 'path';
import { WorkspaceFsPolicy } from '../../src/tools/workspace/index.js';

function normalize(target: string): string {
  return path.resolve(target).replace(/\\/g, '/').toLowerCase();
}

describe('WorkspaceFsPolicy', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workspace-fs-'));
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Zavorth', 'utf8');
  });

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('resolves reads inside the workspace root', () => {
    const policy = new WorkspaceFsPolicy({ workspaceRoot: tempDir });
    const resolved = policy.resolveReadPath('README.md');

    expect(resolved.access).toBe('read');
    expect(resolved.scope).toBe('workspace');
    expect(normalize(resolved.absolutePath)).toBe(normalize(path.join(tempDir, 'README.md')));
  });

  it('routes legacy writes through the workspace output scope', () => {
    const policy = new WorkspaceFsPolicy({ workspaceRoot: tempDir });
    const resolved = policy.resolveWritePath('notes/result.md');

    expect(resolved.access).toBe('write');
    expect(resolved.scope).toBe('workspace_output');
    expect(normalize(resolved.root)).toBe(normalize(path.join(tempDir, 'output')));
    expect(normalize(resolved.absolutePath)).toBe(normalize(path.join(tempDir, 'output', 'notes', 'result.md')));
  });

  it('blocks sibling-prefix escapes from the output write scope', () => {
    const policy = new WorkspaceFsPolicy({ workspaceRoot: tempDir });

    expect(() => policy.resolveWritePath('../output-evil/pwned.txt')).toThrow(/Path Traversal/);
  });

  it('blocks direct reads of local secret-bearing files inside the workspace', () => {
    fs.writeFileSync(path.join(tempDir, '.env'), 'OPENAI_API_KEY=secret', 'utf8');
    fs.writeFileSync(path.join(tempDir, '.env.example'), 'OPENAI_API_KEY=placeholder', 'utf8');
    const policy = new WorkspaceFsPolicy({ workspaceRoot: tempDir });

    expect(() => policy.resolveReadPath('.env')).toThrow(/credenciais|sensivel/i);
    expect(() => policy.resolveReadPath('.env.example')).not.toThrow();
  });

  it('blocks listing local secret-bearing directories inside the workspace', () => {
    fs.mkdirSync(path.join(tempDir, '.ssh'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.ssh', 'config'), 'Host *', 'utf8');
    const policy = new WorkspaceFsPolicy({ workspaceRoot: tempDir });

    expect(() => policy.resolveListPath('.ssh')).toThrow(/credenciais|sensivel/i);
  });

  it('blocks read paths whose realpath escapes through a directory symlink', () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-outside-read-'));
    try {
      fs.writeFileSync(path.join(outsideDir, 'notes.txt'), 'outside workspace', 'utf8');
      const linkPath = path.join(tempDir, 'src', 'outside-link');
      try {
        fs.symlinkSync(outsideDir, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
      } catch {
        return;
      }

      const policy = new WorkspaceFsPolicy({ workspaceRoot: tempDir });

      expect(() => policy.resolveReadPath('src/outside-link/notes.txt')).toThrow(/Symlink escape/i);
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('blocks write paths whose existing parent resolves outside the output scope', () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-outside-write-'));
    try {
      const outputDir = path.join(tempDir, 'output');
      fs.mkdirSync(outputDir, { recursive: true });
      const linkPath = path.join(outputDir, 'outside-link');
      try {
        fs.symlinkSync(outsideDir, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
      } catch {
        return;
      }

      const policy = new WorkspaceFsPolicy({ workspaceRoot: tempDir });

      expect(() => policy.resolveWritePath('outside-link/pwned.txt')).toThrow(/Symlink escape/i);
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});
