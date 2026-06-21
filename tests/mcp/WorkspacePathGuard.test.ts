import fs from 'fs';
import os from 'os';
import path from 'path';
import { WorkspacePathGuard } from '../../src/mcp/workspace/WorkspacePathGuard.js';

describe('WorkspacePathGuard', () => {
  let root: string;
  let guard: WorkspacePathGuard;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workspace-guard-test-'));
    guard = new WorkspacePathGuard(root);
  });

  afterEach(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should initialize with a valid directory', () => {
    expect(guard.getRoot()).toBe(fs.realpathSync(root));
  });

  it('should reject non-existent root directory', () => {
    expect(() => {
      new WorkspacePathGuard(path.join(root, 'non-existent-folder-abc'));
    }).toThrow('Workspace root path does not exist');
  });

  it('should reject dangerous filesystem roots', () => {
    expect(() => {
      new WorkspacePathGuard('/');
    }).toThrow('Workspace root path is a dangerous system directory');
  });

  it('should resolve and allow valid path inside root', () => {
    const file = path.join(root, 'src', 'index.ts');
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(file, 'code', 'utf8');

    const resolved = guard.resolve('src/index.ts');
    expect(resolved).toBe(path.resolve(root, 'src/index.ts'));
  });

  it('should reject path traversal attempting to escape root', () => {
    expect(() => {
      guard.resolve('../escaped.txt');
    }).toThrow('Path traversal detected');

    expect(() => {
      guard.resolve('src/../../escaped.txt');
    }).toThrow('Path traversal detected');
  });

  it('should reject absolute paths outside root', () => {
    const outsideAbs = path.resolve(os.tmpdir(), 'outside-file-xyz.txt');
    expect(() => {
      guard.resolve(outsideAbs);
    }).toThrow('Path traversal detected');
  });

  it('should reject symlinks targeting directories outside root', () => {
    const outsideFile = path.join(os.tmpdir(), 'outside-target.txt');
    fs.writeFileSync(outsideFile, 'secret', 'utf8');

    const linkPath = path.join(root, 'symlink-to-outside.txt');
    try {
      fs.symlinkSync(outsideFile, linkPath);
      expect(() => {
        guard.resolve('symlink-to-outside.txt');
      }).toThrow('Dangerous symlink outside workspace detected');
    } catch (e: any) {
      if (e.code === 'EPERM') {
        console.warn('Skipping symlink test due to Windows EPERM (requires admin rights).');
      } else {
        throw e;
      }
    } finally {
      try {
        fs.unlinkSync(outsideFile);
      } catch {}
    }
  });

  it('should reject blocklisted files like .env, keys, and git folders', () => {
    expect(() => {
      guard.resolve('.env');
    }).toThrow('Access to sensitive file ".env" is blocked.');

    expect(() => {
      guard.resolve('src/config/.env.production');
    }).toThrow('Access to sensitive file ".env.production" is blocked.');

    expect(() => {
      guard.resolve('keys/id_rsa');
    }).toThrow('Access to sensitive file "id_rsa" is blocked.');

    expect(() => {
      guard.resolve('certs/cert.key');
    }).toThrow('Access to sensitive file "cert.key" is blocked.');

    expect(() => {
      guard.resolve('.git/config');
    }).toThrow('Access to Git metadata directory is blocked.');

    expect(() => {
      guard.resolve('src/.git/HEAD');
    }).toThrow('Access to Git metadata directory is blocked.');
  });

  it('should identify heavy directories that must be pruned', () => {
    expect(guard.shouldPrune('node_modules/lodash')).toBe(true);
    expect(guard.shouldPrune('dist/bundle.js')).toBe(true);
    expect(guard.shouldPrune('src/components')).toBe(false);
  });

  it('should support resolveExisting for files that must exist', () => {
    const file = path.join(root, 'existing.txt');
    fs.writeFileSync(file, 'hello', 'utf8');

    const resolved = guard.resolveExisting('existing.txt');
    expect(resolved).toBe(file);

    expect(() => {
      guard.resolveExisting('non-existent.txt');
    }).toThrow('Path does not exist');
  });

  it('should support resolveForWrite for files that do not exist yet by checking parent containment', () => {
    // Non-existent target file, but parent exists (root)
    const resolved = guard.resolveForWrite('new-file-xyz.txt');
    expect(resolved).toBe(path.resolve(root, 'new-file-xyz.txt'));

    // Traversal block for non-existent file
    expect(() => {
      guard.resolveForWrite('../outside-new-file.txt');
    }).toThrow('Path traversal detected');

    // Blocklist check for non-existent file
    expect(() => {
      guard.resolveForWrite('.env');
    }).toThrow('Access to sensitive file ".env" is blocked.');
  });

  it('should reject symlink inside root pointing to blocklisted file inside root', () => {
    const envFile = path.join(root, '.env');
    fs.writeFileSync(envFile, 'SECRET_KEY=123', 'utf8');

    const linkPath = path.join(root, 'safe.txt');
    try {
      fs.symlinkSync(envFile, linkPath);
      expect(() => {
        guard.resolveExisting('safe.txt');
      }).toThrow('Access to sensitive file ".env" is blocked.');
    } catch (e: any) {
      if (e.code === 'EPERM') {
        console.warn('Skipping inner symlink to .env test due to Windows EPERM (requires admin rights).');
      } else {
        throw e;
      }
    }
  });
});
