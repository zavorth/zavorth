import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { WorkspaceResolver } from '../../src/security/WorkspaceResolver.js';

function normalize(target: string): string {
  const normalized = path.resolve(target).replace(/\\/g, '/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

describe('Workspace security', () => {
  const originalConfig = {
    workspaceRoot: config.workspaceRoot,
    defaultWorkspace: config.defaultWorkspace,
  };

  let tempDir = '';
  let tempWorkspaceRoot = '';
  let tempDefaultWorkspace = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workspace-'));
    tempWorkspaceRoot = path.join(tempDir, 'workspace-root');
    tempDefaultWorkspace = path.join(tempWorkspaceRoot, 'Zavorth');

    fs.mkdirSync(tempDefaultWorkspace, { recursive: true });

    config.workspaceRoot = tempWorkspaceRoot;
    config.defaultWorkspace = tempDefaultWorkspace;
  });

  afterEach(() => {
    config.workspaceRoot = originalConfig.workspaceRoot;
    config.defaultWorkspace = originalConfig.defaultWorkspace;

    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('allows a relative path inside the workspace', () => {
    const safePath = WorkspaceResolver.ensurePathInsideWorkspace(tempDefaultWorkspace, 'src/index.ts');
    expect(normalize(safePath)).toBe(normalize(path.join(tempDefaultWorkspace, 'src/index.ts')));
  });

  it('allows an absolute path inside the workspace', () => {
    const absoluteTarget = path.join(tempDefaultWorkspace, 'README.md');
    const safePath = WorkspaceResolver.ensurePathInsideWorkspace(tempDefaultWorkspace, absoluteTarget);
    expect(normalize(safePath)).toBe(normalize(absoluteTarget));
  });

  it('blocks traversal with dot-dot escapes', () => {
    expect(() => WorkspaceResolver.ensurePathInsideWorkspace(tempDefaultWorkspace, '../escape.txt')).toThrow(/Path Traversal/);
  });

  it('blocks sibling paths with the same textual prefix across all layers', () => {
    const siblingWorkspace = path.join(tempDir, 'workspace-root-evil');
    fs.mkdirSync(siblingWorkspace, { recursive: true });
    const siblingFile = path.join(siblingWorkspace, 'stolen.txt');

    expect(() => WorkspaceResolver.validate(siblingWorkspace)).toThrow(/Workspace nao autorizado/);
    expect(() => WorkspaceResolver.ensurePathInsideWorkspace(tempWorkspaceRoot, siblingFile)).toThrow(/Path Traversal/);
  });

  it('handles mixed slash styles consistently', () => {
    const base = normalize(tempDefaultWorkspace);
    const mixedTarget = `${base.replace(/\//g, '\\')}\\nested/file.txt`;
    const safePath = WorkspaceResolver.ensurePathInsideWorkspace(base, mixedTarget);
    expect(normalize(safePath)).toBe(normalize(path.join(tempDefaultWorkspace, 'nested', 'file.txt')));
  });

  it('resolves built-in aliases from a single source of truth', () => {
    expect(normalize(WorkspaceResolver.resolve('zavorth'))).toBe(normalize(tempDefaultWorkspace));
    expect(normalize(WorkspaceResolver.resolve('current_workspace'))).toBe(normalize(tempDefaultWorkspace));
    expect(normalize(WorkspaceResolver.resolve('default'))).toBe(normalize(tempDefaultWorkspace));
    expect(normalize(WorkspaceResolver.resolve('root'))).toBe(normalize(tempWorkspaceRoot));
    expect(fs.existsSync(WorkspaceResolver.validate('core'))).toBe(true);
    // Alias path may preserve original casing (MeuProjeto) depending on host FS.
    expect(normalize(WorkspaceResolver.resolve('meuprojeto')).toLowerCase()).toContain('/meuprojeto');
  });

  it('treats empty hints and AUTO as the default workspace', () => {
    expect(normalize(WorkspaceResolver.resolve(''))).toBe(normalize(tempDefaultWorkspace));
    expect(normalize(WorkspaceResolver.resolve('AUTO'))).toBe(normalize(tempDefaultWorkspace));
    expect(normalize(WorkspaceResolver.resolve(undefined))).toBe(normalize(tempDefaultWorkspace));
  });

  it('requires the workspace to exist on disk to be considered allowed', () => {
    const missingWorkspace = path.join(tempDefaultWorkspace, 'missing');

    expect(WorkspaceResolver.isWorkspaceAllowed(missingWorkspace)).toBe(false);
    expect(() => WorkspaceResolver.validate(missingWorkspace)).toThrow(/Workspace nao encontrado/);
  });

  it('honors allowed roots loaded from security-policy.json', () => {
    const allowedRoots = WorkspaceResolver.getAllowedRoots().map((entry) => normalize(entry));
    expect(allowedRoots).toContain(normalize('C:/workspace/zavorth-release'));
  });

  it('keeps guard and resolver decisions aligned', () => {
    expect(WorkspaceResolver.isWorkspaceAllowed(tempDefaultWorkspace)).toBe(true);
    expect(WorkspaceResolver.resolveAlias('zavorth')).toBe(WorkspaceResolver.resolve('zavorth'));
    expect(() => WorkspaceResolver.validate(tempDefaultWorkspace)).not.toThrow();
  });

  if (process.platform === 'win32') {
    it('treats Windows paths case-insensitively', () => {
      const lowerBase = tempDefaultWorkspace.toLowerCase();
      const upperTarget = path.join(tempDefaultWorkspace.toUpperCase(), 'src', 'index.ts');
      const safePath = WorkspaceResolver.ensurePathInsideWorkspace(lowerBase, upperTarget);
      expect(normalize(safePath)).toBe(normalize(path.join(tempDefaultWorkspace, 'src', 'index.ts')));
    });
  }
});
