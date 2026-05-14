import fs from 'fs';
import path from 'path';
import { config } from '../../src/config/index.js';
import type { BackupSnapshotManifest } from './DatabaseBackupJob.js';

type RestoreRuntime = {
  sourceRoot?: string;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  cpSync?: typeof fs.cpSync;
  readFileSync?: typeof fs.readFileSync;
};

function isSubPath(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export class DatabaseRestoreJob {
  private readonly sourceRoot: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly cpSync: typeof fs.cpSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: RestoreRuntime = {}) {
    this.sourceRoot = runtime.sourceRoot || config.projectRoot;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.cpSync = runtime.cpSync || fs.cpSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public readManifest(manifestPath: string): BackupSnapshotManifest {
    const parsed = JSON.parse(String(this.readFileSync(manifestPath, 'utf8') || '{}')) as Partial<BackupSnapshotManifest>;
    if (!Array.isArray(parsed.targets) || !parsed.snapshotDir) {
      throw new Error('Manifesto de restore invalido ou legado. Use um manifest.json gerado por `npm run ops:backup`.');
    }
    return parsed as BackupSnapshotManifest;
  }

  public restoreSnapshot(manifestPath: string, options: { dryRun?: boolean } = {}): BackupSnapshotManifest {
    const manifest = this.readManifest(manifestPath);
    for (const target of manifest.targets) {
      const sourcePath = path.resolve(manifest.snapshotDir, target.relativePath);
      if (!isSubPath(manifest.snapshotDir, sourcePath)) {
        throw new Error(`Target de restore invalido fora do snapshot: ${target.relativePath}`);
      }
      const destination = path.resolve(this.sourceRoot, target.relativePath);
      if (!isSubPath(this.sourceRoot, destination)) {
        throw new Error(`Target de restore invalido fora do workspace: ${target.relativePath}`);
      }
      if (!target.exists || !this.existsSync(sourcePath)) {
        continue;
      }
      if (!options.dryRun) {
        this.mkdirSync(path.dirname(destination), { recursive: true });
        this.cpSync(sourcePath, destination, { recursive: true });
      }
    }
    return manifest;
  }
}
