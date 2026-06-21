import fs from 'fs';
import path from 'path';

export class WorkspacePathGuard {
  private readonly rootPath: string;

  constructor(workspaceRoot: string) {
    if (!workspaceRoot) {
      throw new Error('Workspace root path is required.');
    }

    const resolvedRoot = path.resolve(workspaceRoot);
    if (!fs.existsSync(resolvedRoot)) {
      throw new Error(`Workspace root path does not exist: ${workspaceRoot}`);
    }

    const stat = fs.statSync(resolvedRoot);
    if (!stat.isDirectory()) {
      throw new Error(`Workspace root path is not a directory: ${workspaceRoot}`);
    }

    // Get realpath of root
    this.rootPath = fs.realpathSync(resolvedRoot);

    // Reject dangerous system/filesystem roots
    const normalizedRoot = this.rootPath.replace(/\\/g, '/').toLowerCase();
    
    // Check for Windows system root (e.g. C:/)
    if (/^[a-z]:\/$/i.test(normalizedRoot) || normalizedRoot === '/' || normalizedRoot === 'c:/windows' || normalizedRoot === 'c:/windows/system32') {
      throw new Error(`Workspace root path is a dangerous system directory: ${workspaceRoot}`);
    }
  }

  public getRoot(): string {
    return this.rootPath;
  }

  private validateContainment(targetPath: string): void {
    const resolved = path.resolve(targetPath);
    const relative = path.relative(this.rootPath, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Path traversal detected or path outside workspace');
    }
    if (!resolved.startsWith(this.rootPath + path.sep) && resolved !== this.rootPath) {
      throw new Error('Path traversal detected or path outside workspace');
    }
  }

  private validateBlocklist(targetPath: string): void {
    const relative = path.relative(this.rootPath, targetPath);
    const normalizedRelative = relative.replace(/\\/g, '/').toLowerCase();
    const filename = path.basename(targetPath).toLowerCase();

    // Block secret configuration files and private keys
    if (
      filename === '.env' ||
      filename.includes('.env.') ||
      filename.endsWith('.pem') ||
      filename.endsWith('.key') ||
      filename === 'id_rsa' ||
      filename === 'id_dsa' ||
      filename === 'credentials.json'
    ) {
      throw new Error(`Access to sensitive file "${filename}" is blocked.`);
    }

    // Block .git folder contents for filesystem access
    const parts = normalizedRelative.split('/');
    if (parts.includes('.git')) {
      throw new Error('Access to Git metadata directory is blocked.');
    }
  }

  /**
   * Resolves and validates an existing path inside the workspace root.
   */
  public resolveExisting(inputPath: string): string {
    if (!inputPath) {
      throw new Error('Input path is required.');
    }
    const resolvedPath = path.resolve(this.rootPath, inputPath);
    this.validateContainment(resolvedPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Path does not exist: ${inputPath}`);
    }
    const realPath = fs.realpathSync(resolvedPath);
    this.validateContainment(realPath);
    this.validateBlocklist(resolvedPath);
    this.validateBlocklist(realPath);
    return resolvedPath;
  }

  /**
   * Resolves and validates a path for writing inside the workspace root.
   * Recursively validates parent directories if the path itself does not exist.
   */
  public resolveForWrite(inputPath: string): string {
    if (!inputPath) {
      throw new Error('Input path is required.');
    }
    const resolvedPath = path.resolve(this.rootPath, inputPath);

    // Recursively check first existing parent directory
    let current = resolvedPath;
    let parent = path.dirname(current);
    while (parent !== current && !fs.existsSync(parent)) {
      current = parent;
      parent = path.dirname(current);
    }

    const realParent = fs.realpathSync(parent);
    this.validateContainment(realParent);
    this.validateContainment(resolvedPath);
    this.validateBlocklist(resolvedPath);

    // If target itself exists, validate its resolved realpath too
    if (fs.existsSync(resolvedPath)) {
      const realPath = fs.realpathSync(resolvedPath);
      this.validateContainment(realPath);
      this.validateBlocklist(realPath);
    }

    return resolvedPath;
  }

  /**
   * Resolves and validates input path inside the workspace root.
   * Throws Error if traversal or blocklisted files are accessed.
   */
  public resolve(inputPath: string): string {
    return this.resolveForWrite(inputPath);
  }

  /**
   * Checks if directory or file should be pruned/ignored during listings or searches.
   */
  public shouldPrune(relativePath: string): boolean {
    const parts = relativePath.replace(/\\/g, '/').toLowerCase().split('/');
    const pruneDirs = ['node_modules', 'dist', 'build', '.next', '.cache', 'coverage', '.git'];
    return parts.some(part => pruneDirs.includes(part));
  }
}
