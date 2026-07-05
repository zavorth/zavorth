import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface BackupEntry {
  id: string;
  name: string;
  path: string;
  size_bytes: number;
  created_at: string;
  type: 'full' | 'incremental' | 'config';
  status: 'completed' | 'failed' | 'in_progress';
  files_count: number;
}

export class BackupService {
  private readonly storageDir: string;
  private backups: BackupEntry[] = [];
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'backups');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadBackups();
  }

  private loadBackups(): void {
    const p = path.join(this.storageDir, 'backups.json');
    if (!fs.existsSync(p)) return;
    try {
      this.backups = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (error) { /* ignore */ logger.warn('[Backup] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'backups.json'), JSON.stringify(this.backups, null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public createBackup(name: string, sourcePath: string, type: BackupEntry['type'] = 'full'): string {
    const id = `backup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const backupDir = path.join(this.storageDir, id);
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    try {
      let totalSize = 0;
      let filesCount = 0;

      if (fs.existsSync(sourcePath)) {
        const stat = fs.statSync(sourcePath);
        if (stat.isDirectory()) {
          const files = this.listFiles(sourcePath);
          for (const file of files) {
            const relPath = path.relative(sourcePath, file);
            const destPath = path.join(backupDir, relPath);
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            fs.copyFileSync(file, destPath);
            totalSize += fs.statSync(file).size;
            filesCount++;
          }
        } else {
          fs.copyFileSync(sourcePath, path.join(backupDir, path.basename(sourcePath)));
          totalSize = stat.size;
          filesCount = 1;
        }
      }

      const entry: BackupEntry = {
        id, name, path: backupDir, size_bytes: totalSize,
        created_at: new Date().toISOString(), type, status: 'completed', files_count: filesCount,
      };
      this.backups.push(entry);
      this.scheduleFlush();

      return `Backup "${name}" created: ${filesCount} files, ${(totalSize / 1024).toFixed(1)}KB`;
    } catch (error: unknown) {
      const entry: BackupEntry = {
        id, name, path: backupDir, size_bytes: 0,
        created_at: new Date().toISOString(), type, status: 'failed', files_count: 0,
      };
      this.backups.push(entry);
      this.scheduleFlush();
      return `Backup failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  public restoreBackup(backupId: string, targetPath: string): string {
    const backup = this.backups.find((b) => b.id === backupId);
    if (!backup) return `Error: backup "${backupId}" not found.`;
    if (backup.status !== 'completed') return `Error: backup "${backupId}" is not completed.`;
    if (!fs.existsSync(backup.path)) return `Error: backup files not found at "${backup.path}".`;

    try {
      const files = this.listFiles(backup.path);
      for (const file of files) {
        const relPath = path.relative(backup.path, file);
        const destPath = path.join(targetPath, relPath);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(file, destPath);
      }
      return `Backup "${backup.name}" restored to "${targetPath}" (${files.length} files)`;
    } catch (error) { logger.warn('[Backup] filesystem operation failed', error); return ''; }
  }

  public deleteBackup(backupId: string): string {
    const index = this.backups.findIndex((b) => b.id === backupId);
    if (index === -1) return `Error: backup "${backupId}" not found.`;
    const backup = this.backups[index];
    try {
      if (fs.existsSync(backup.path)) fs.rmSync(backup.path, { recursive: true, force: true });
    } catch (error) { /* ignore */ logger.warn('[Backup] filesystem operation failed', error); }
    this.backups.splice(index, 1);
    this.scheduleFlush();
    return `Backup "${backup.name}" deleted.`;
  }

  public listBackups(): string {
    if (this.backups.length === 0) return 'No backups.';
    const lines: string[] = ['Backups:'];
    for (const b of this.backups) {
      const icon = { completed: '✅', failed: '❌', in_progress: '🔄' }[b.status];
      lines.push(`  ${icon} ${b.id}: ${b.name} [${b.type}] ${(b.size_bytes / 1024).toFixed(1)}KB (${b.files_count} files)`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    const totalSize = this.backups.reduce((s, b) => s + b.size_bytes, 0);
    const completed = this.backups.filter((b) => b.status === 'completed').length;
    return [
      'Backup Stats:',
      `  Total backups: ${this.backups.length}`,
      `  Completed: ${completed}`,
      `  Total size: ${(totalSize / 1024).toFixed(1)}KB`,
    ].join('\n');
  }

  private listFiles(dir: string): string[] {
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...this.listFiles(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) { /* ignore */ logger.warn('[Backup] filesystem operation failed', error); }
    return files;
  }
}
