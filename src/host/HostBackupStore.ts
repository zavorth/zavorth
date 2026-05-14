import fs from 'fs';
import path from 'path';

export interface BackupManifest {
  files: Array<{ originalPath: string; backupPath: string; timestamp: string }>;
  lastStableTimestamp: string;
}

export type HostBackupStoreOptions = {
  backupsDir: string;
  manifestPath: string;
  maxBackupsPerFile: number;
  now: () => number;
  log: (message: string) => void;
};

export class HostBackupStore {
  private isRollingBack = false;

  constructor(private readonly options: HostBackupStoreOptions) {
    fs.mkdirSync(this.options.backupsDir, { recursive: true });
  }

  public handlePreModify(files: string[]): void {
    this.options.log(`Pre-modify backup requested for ${files.length} file(s).`);
    const manifest = this.loadManifest();

    for (const filePath of files) {
      try {
        if (!fs.existsSync(filePath)) {
          continue;
        }

        const basename = path.basename(filePath);
        const backupName = `${basename}.${this.options.now()}.bak`;
        const backupPath = path.join(this.options.backupsDir, backupName);
        fs.copyFileSync(filePath, backupPath);

        manifest.files.push({
          originalPath: filePath,
          backupPath,
          timestamp: new Date(this.options.now()).toISOString(),
        });
        this.pruneRelatedBackups(manifest, filePath);
        this.options.log(`  Backed up: ${basename} -> ${backupName}`);
      } catch (err: any) {
        this.options.log(`  Failed to backup ${filePath}: ${err.message}`);
      }
    }

    this.saveManifest(manifest);
  }

  public markCurrentAsStable(): void {
    const manifest = this.loadManifest();
    manifest.lastStableTimestamp = new Date(this.options.now()).toISOString();
    this.saveManifest(manifest);
  }

  public rollback(): void {
    if (this.isRollingBack) {
      return;
    }
    this.isRollingBack = true;

    const manifest = this.loadManifest();
    if (manifest.files.length === 0) {
      this.options.log('No backups available for rollback.');
      this.isRollingBack = false;
      return;
    }

    this.options.log('Rolling back to the last backed-up state...');

    const latestByFile = new Map<string, BackupManifest['files'][0]>();
    for (const entry of manifest.files) {
      const existing = latestByFile.get(entry.originalPath);
      if (!existing || new Date(entry.timestamp) > new Date(existing.timestamp)) {
        latestByFile.set(entry.originalPath, entry);
      }
    }

    for (const [originalPath, entry] of latestByFile) {
      try {
        if (!fs.existsSync(entry.backupPath)) {
          this.options.log(`  Backup file missing: ${entry.backupPath}`);
          continue;
        }
        fs.copyFileSync(entry.backupPath, originalPath);
        this.options.log(`  Restored: ${path.basename(originalPath)}`);
      } catch (err: any) {
        this.options.log(`  Failed to restore ${originalPath}: ${err.message}`);
      }
    }

    this.isRollingBack = false;
  }

  private pruneRelatedBackups(manifest: BackupManifest, filePath: string): void {
    const related = manifest.files
      .filter((entry) => entry.originalPath === filePath)
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
    const keep = related.slice(0, this.options.maxBackupsPerFile);
    const drop = related.slice(this.options.maxBackupsPerFile);

    for (const entry of drop) {
      if (fs.existsSync(entry.backupPath)) {
        try {
          fs.unlinkSync(entry.backupPath);
        } catch {
          // Ignore cleanup failure for old backups.
        }
      }
    }

    manifest.files = manifest.files.filter((entry) => entry.originalPath !== filePath);
    manifest.files.push(...keep);
  }

  private loadManifest(): BackupManifest {
    try {
      if (fs.existsSync(this.options.manifestPath)) {
        return JSON.parse(fs.readFileSync(this.options.manifestPath, 'utf-8'));
      }
    } catch {
      // Ignore malformed manifest and rebuild it on the next save.
    }

    return { files: [], lastStableTimestamp: '' };
  }

  private saveManifest(manifest: BackupManifest): void {
    fs.writeFileSync(this.options.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }
}
