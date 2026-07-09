import fs from 'fs';
import path from 'path';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';
import { logger } from '../../logger.js';

export type WorkspaceFsAccess = 'read' | 'list' | 'write' | 'edit' | 'apply_patch';
export type WorkspaceFsScope = 'workspace' | 'workspace_output';

export type WorkspaceFsPolicyOptions = {
  workspaceRoot?: string;
  writeRoot?: string;
};

export type WorkspaceFsResolvedPath = {
  access: WorkspaceFsAccess;
  scope: WorkspaceFsScope;
  workspaceRoot: string;
  root: string;
  absolutePath: string;
};

function normalizePath(target: string): string {
  return path.resolve(target).replace(/\\/g, '/');
}

function normalizeForComparison(target: string): string {
  const normalized = path.normalize(path.resolve(target));
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function isPathContained(baseDir: string, targetPath: string): boolean {
  const normalizedBase = normalizeForComparison(baseDir);
  const normalizedTarget = normalizeForComparison(targetPath);
  const relative = path.relative(normalizedBase, normalizedTarget);

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export class WorkspaceFsPolicy {
  constructor(private readonly options: WorkspaceFsPolicyOptions = {}) {}

  public resolveReadPath(filePath: string): WorkspaceFsResolvedPath {
    return this.resolvePath({
      access: 'read',
      scope: 'workspace',
      root: this.getWorkspaceRoot(),
      targetPath: filePath,
    });
  }

  public resolveListPath(dirPath?: string): WorkspaceFsResolvedPath {
    return this.resolvePath({
      access: 'list',
      scope: 'workspace',
      root: this.getWorkspaceRoot(),
      targetPath: dirPath || '.',
    });
  }

  public resolveWritePath(filePath: string): WorkspaceFsResolvedPath {
    return this.resolvePath({
      access: 'write',
      scope: 'workspace_output',
      root: this.getWriteRoot(),
      targetPath: filePath,
    });
  }

  public resolveEditPath(filePath: string): WorkspaceFsResolvedPath {
    return this.resolvePath({
      access: 'edit',
      scope: 'workspace_output',
      root: this.getWriteRoot(),
      targetPath: filePath,
    });
  }

  public resolveApplyPatchPath(filePath: string): WorkspaceFsResolvedPath {
    return this.resolvePath({
      access: 'apply_patch',
      scope: 'workspace_output',
      root: this.getWriteRoot(),
      targetPath: filePath,
    });
  }

  private resolvePath(input: {
    access: WorkspaceFsAccess;
    scope: WorkspaceFsScope;
    root: string;
    targetPath: string;
  }): WorkspaceFsResolvedPath {
    const workspaceRoot = this.getWorkspaceRoot();
    const root = normalizePath(input.root);
    const absolutePath = WorkspaceResolver.ensurePathInsideWorkspace(root, input.targetPath);
    assertNoSymlinkEscape(workspaceRoot, root, absolutePath, input.access);
    if (input.access === 'read' || input.access === 'list') {
      assertReadablePathIsNotSensitive(root, absolutePath);
    }
    return {
      access: input.access,
      scope: input.scope,
      workspaceRoot,
      root,
      absolutePath,
    };
  }

  private getWorkspaceRoot(): string {
    return normalizePath(this.options.workspaceRoot || process.cwd());
  }

  private getWriteRoot(): string {
    return normalizePath(this.options.writeRoot || path.join(this.getWorkspaceRoot(), 'output'));
  }
}

function assertReadablePathIsNotSensitive(root: string, absolutePath: string): void {
  const relative = path.relative(root, absolutePath).replace(/\\/g, '/');
  const basename = path.basename(absolutePath).toLowerCase();
  const relativeLower = relative.toLowerCase();

  if (basename === '.env.example' || basename === '.env.sample' || basename.endsWith('.example')) {
    return;
  }

  if (
    basename === '.env'
    || basename.startsWith('.env.')
    || basename === '.npmrc'
    || basename === '.pypirc'
    || basename === 'credentials'
    || basename === 'credentials.json'
    || basename === 'secrets.json'
    || basename === 'secrets_honey.txt'
    || basename === '.ssh'
    || basename === '.aws'
    || basename === '.azure'
    || basename === '.gcp'
    || relativeLower.includes('/.ssh/')
    || relativeLower.includes('/.aws/')
    || relativeLower.includes('/.azure/')
    || relativeLower.includes('/.gcp/')
    || /\.(pem|key|p12|pfx|kubeconfig)$/i.test(basename)
    || /(^|[-_.])(secret|token|credential|private-key)([-_.]|$)/i.test(basename)
  ) {
    throw new Error('Read blocked: the file appears to contain credentials or sensitive material.');
  }
}

function assertNoSymlinkEscape(
  workspaceRoot: string,
  root: string,
  absolutePath: string,
  access: WorkspaceFsAccess,
): void {
  const realWorkspaceRoot = realpathIfExists(workspaceRoot) || normalizePath(workspaceRoot);
  const realRoot = realpathIfExists(root);
  const existingTarget = realpathIfExists(absolutePath);

  if ((access === 'read' || access === 'list') && existingTarget) {
    const readRoot = realRoot || realWorkspaceRoot;
    assertContainedAfterRealpath(readRoot, existingTarget, access);
    assertContainedAfterRealpath(realWorkspaceRoot, existingTarget, access);
    if (access === 'read' || access === 'list') {
      assertReadablePathIsNotSensitive(readRoot, existingTarget);
    }
    return;
  }

  if (access === 'read' || access === 'list') {
    const existingParent = findNearestExistingAncestor(path.dirname(absolutePath));
    const realParent = realpathIfExists(existingParent);
    if (!realParent) {
      throw new Error('Filesystem policy error: no existing ancestor was found to validate read access.');
    }
    assertContainedAfterRealpath(realRoot || realWorkspaceRoot, realParent, access);
    assertContainedAfterRealpath(realWorkspaceRoot, realParent, access);
    return;
  }

  if (realRoot) {
    assertContainedAfterRealpath(realWorkspaceRoot, realRoot, access);
  }

  if (access === 'write' || access === 'edit' || access === 'apply_patch') {
    const containmentRoot = realRoot || realWorkspaceRoot;
    if (existingTarget) {
      assertContainedAfterRealpath(containmentRoot, existingTarget, access);
      assertContainedAfterRealpath(realWorkspaceRoot, existingTarget, access);
      return;
    }

    const existingParent = findNearestExistingAncestor(path.dirname(absolutePath));
    const realParent = realpathIfExists(existingParent);
    if (!realParent) {
      throw new Error('Filesystem policy error: no existing ancestor was found to validate write access.');
    }
    assertContainedAfterRealpath(containmentRoot, realParent, access);
    assertContainedAfterRealpath(realWorkspaceRoot, realParent, access);
  }
}

function assertContainedAfterRealpath(realRoot: string, realTarget: string, access: WorkspaceFsAccess): void {
  if (!isPathContained(realRoot, realTarget)) {
    throw new Error(
      `[SECURITY] Symlink escape blocked. The real path for ${access} would leave the allowed workspace.`,
    );
  }
}

function realpathIfExists(target: string): string | null {
  try {
    if (!fs.existsSync(target)) {
      return null;
    }
    return normalizePath(fs.realpathSync.native(target));
  } catch (error: any) { logger.warn('[Workspace Fs] filesystem operation failed', error); return null; }
}

function findNearestExistingAncestor(startDir: string): string {
  let current = normalizePath(startDir);

  while (!fs.existsSync(current)) {
    const parent = normalizePath(path.dirname(current));
    if (parent === current) {
      return current;
    }
    current = parent;
  }

  return current;
}
