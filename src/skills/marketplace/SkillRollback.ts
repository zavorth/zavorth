import fs from 'node:fs';
import path from 'node:path';

type RollbackEntry = {
  skillId: string;
  version: string;
  backedUpAt: string;
  backupPath: string;
};

export class SkillRollback {
  private readonly rollbackDir: string;

  constructor(options?: { dataDir?: string }) {
    this.rollbackDir = path.join(options?.dataDir || path.join(process.cwd(), 'data'), 'skill-marketplace', 'rollbacks');
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.rollbackDir)) fs.mkdirSync(this.rollbackDir, { recursive: true });
  }

  private getRollbackFile(): string {
    return path.join(this.rollbackDir, 'index.json');
  }

  private loadIndex(): RollbackEntry[] {
    try {
      const file = this.getRollbackFile();
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch { /* ignore */ }
    return [];
  }

  private saveIndex(entries: RollbackEntry[]): void {
    this.ensureDir();
    fs.writeFileSync(this.getRollbackFile(), JSON.stringify(entries, null, 2), 'utf-8');
  }

  createBackup(skillDir: string, skillId: string, version: string): string {
    this.ensureDir();
    const backupName = `${skillId}-${version}-${Date.now()}`;
    const backupPath = path.join(this.rollbackDir, backupName);
    fs.cpSync(skillDir, backupPath, { recursive: true });

    const index = this.loadIndex();
    index.push({ skillId, version, backedUpAt: new Date().toISOString(), backupPath });

    const maxBackups = 20;
    if (index.length > maxBackups) {
      const removed = index.splice(0, index.length - maxBackups);
      for (const entry of removed) {
        try { fs.rmSync(entry.backupPath, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    }

    this.saveIndex(index);
    return backupPath;
  }

  getBackupsForSkill(skillId: string): RollbackEntry[] {
    const index = this.loadIndex();
    return index.filter((e) => e.skillId === skillId).sort((a, b) => new Date(b.backedUpAt).getTime() - new Date(a.backedUpAt).getTime());
  }

  rollbackToVersion(skillId: string, version: string): { success: boolean; message: string } {
    const index = this.loadIndex();
    const entry = index.find((e) => e.skillId === skillId && e.version === version);
    if (!entry) {
      return { success: false, message: `No backup found for "${skillId}" version ${version}` };
    }

    if (!fs.existsSync(entry.backupPath)) {
      return { success: false, message: `Backup files missing for "${skillId}" v${version}` };
    }

    const skillsDir = path.join(process.cwd(), 'skills', skillId);
    if (fs.existsSync(skillsDir)) {
      fs.rmSync(skillsDir, { recursive: true, force: true });
    }
    fs.cpSync(entry.backupPath, skillsDir, { recursive: true });

    const idx = index.indexOf(entry);
    if (idx >= 0) index.splice(idx, 1);
    this.saveIndex(index);

    return { success: true, message: `Rolled back "${skillId}" to version ${version} from ${entry.backedUpAt}` };
  }

  rollback(skillId: string): { success: boolean; message: string } {
    const backups = this.getBackupsForSkill(skillId);
    if (backups.length === 0) {
      return { success: false, message: `No backups found for "${skillId}"` };
    }
    if (backups.length === 1) {
      return this.rollbackToVersion(skillId, backups[0].version);
    }
    const latest = backups[0];
    return this.rollbackToVersion(skillId, latest.version);
  }

  findSkillByName(partialName: string): string | null {
    const index = this.loadIndex();
    const lower = partialName.toLowerCase();
    const matches = index.filter((e) => e.skillId.toLowerCase().includes(lower));
    if (matches.length === 1) return matches[0].skillId;
    if (matches.length > 1) return matches[matches.length - 1].skillId;
    return null;
  }

  listBackups(): RollbackEntry[] {
    return this.loadIndex().slice(-10);
  }
}
