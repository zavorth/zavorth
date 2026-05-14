import path from 'path';
import { WorkspaceResolver } from '../../security/WorkspaceResolver.js';

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
    const root = normalizePath(input.root);
    const absolutePath = WorkspaceResolver.ensurePathInsideWorkspace(root, input.targetPath);
    if (input.access === 'read') {
      assertReadablePathIsNotSensitive(root, absolutePath);
    }
    return {
      access: input.access,
      scope: input.scope,
      workspaceRoot: this.getWorkspaceRoot(),
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
    || relativeLower.includes('/.ssh/')
    || relativeLower.includes('/.aws/')
    || relativeLower.includes('/.azure/')
    || relativeLower.includes('/.gcp/')
    || /\.(pem|key|p12|pfx|kubeconfig)$/i.test(basename)
    || /(^|[-_.])(secret|token|credential|private-key)([-_.]|$)/i.test(basename)
  ) {
    throw new Error('Leitura bloqueada: o arquivo parece conter credenciais ou material sensivel.');
  }
}
