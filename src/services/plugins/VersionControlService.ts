import fs from 'fs';
import path from 'path';

export interface VersionEntry {
  id: string;
  file_path: string;
  content: string;
  hash: string;
  message: string;
  author: string;
  created_at: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface VersionDiff {
  file: string;
  old_version: string;
  new_version: string;
  additions: number;
  deletions: number;
  changes: Array<{ type: 'add' | 'remove' | 'keep'; line: number; content: string }>;
}

export class VersionControlService {
  private readonly storageDir: string;
  private versions: Map<string, VersionEntry[]> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'version-control');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadVersions();
  }

  private loadVersions(): void {
    const p = path.join(this.storageDir, 'versions.json');
    if (!fs.existsSync(p)) return;
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(data)) {
        for (const [filePath, versions] of data) {
          this.versions.set(filePath, versions);
        }
      }
    } catch { /* ignore */ }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        const data = Array.from(this.versions.entries());
        fs.writeFileSync(path.join(this.storageDir, 'versions.json'), JSON.stringify(data, null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public commit(filePath: string, message: string, author: string = 'system'): string {
    if (!fs.existsSync(filePath)) return `Error: "${filePath}" not found.`;

    const content = fs.readFileSync(filePath, 'utf-8');
    const hash = this.generateHash(content);
    const id = `ver_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const entry: VersionEntry = {
      id, file_path: filePath, content, hash, message, author,
      created_at: new Date().toISOString(), tags: [], metadata: {},
    };

    if (!this.versions.has(filePath)) this.versions.set(filePath, []);
    this.versions.get(filePath)!.push(entry);
    this.scheduleFlush();

    return `Committed: ${path.basename(filePath)} (${hash.slice(0, 8)}) - ${message}`;
  }

  public getHistory(filePath: string, limit: number = 10): string {
    const versions = this.versions.get(filePath);
    if (!versions || versions.length === 0) return `No version history for "${filePath}".`;

    const recent = versions.slice(-limit).reverse();
    return [
      `Version History for ${path.basename(filePath)}:`,
      ...recent.map((v) => `  ${v.id}: ${v.hash.slice(0, 8)} - ${v.message} (${v.author}, ${v.created_at.slice(0, 16)})`),
    ].join('\n');
  }

  public getVersion(versionId: string): string | null {
    for (const versions of this.versions.values()) {
      const version = versions.find((v) => v.id === versionId);
      if (version) return version.content;
    }
    return null;
  }

  public revert(filePath: string, versionId: string): string {
    const versions = this.versions.get(filePath);
    if (!versions) return `Error: no versions for "${filePath}".`;

    const version = versions.find((v) => v.id === versionId);
    if (!version) return `Error: version "${versionId}" not found.`;

    fs.writeFileSync(filePath, version.content, 'utf-8');
    return `Reverted ${path.basename(filePath)} to version ${versionId} (${version.hash.slice(0, 8)})`;
  }

  public diff(versionId1: string, versionId2: string): string {
    const content1 = this.getVersion(versionId1);
    const content2 = this.getVersion(versionId2);
    if (!content1) return `Error: version "${versionId1}" not found.`;
    if (!content2) return `Error: version "${versionId2}" not found.`;

    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    const changes: Array<{ type: 'add' | 'remove' | 'keep'; line: number; content: string }> = [];

    let i = 0, j = 0;
    while (i < lines1.length || j < lines2.length) {
      if (i >= lines1.length) {
        changes.push({ type: 'add', line: j + 1, content: lines2[j] });
        j++;
      } else if (j >= lines2.length) {
        changes.push({ type: 'remove', line: i + 1, content: lines1[i] });
        i++;
      } else if (lines1[i] === lines2[j]) {
        changes.push({ type: 'keep', line: i + 1, content: lines1[i] });
        i++;
        j++;
      } else {
        changes.push({ type: 'remove', line: i + 1, content: lines1[i] });
        changes.push({ type: 'add', line: j + 1, content: lines2[j] });
        i++;
        j++;
      }
    }

    const additions = changes.filter((c) => c.type === 'add').length;
    const deletions = changes.filter((c) => c.type === 'remove').length;

    return [
      `Diff: ${versionId1} -> ${versionId2}`,
      `  Additions: ${additions}`,
      `  Deletions: ${deletions}`,
      '  Changes:',
      ...changes.filter((c) => c.type !== 'keep').slice(0, 20).map((c) => {
        const prefix = c.type === 'add' ? '+' : '-';
        return `    ${prefix} ${c.line}: ${c.content.slice(0, 80)}`;
      }),
    ].join('\n');
  }

  public tag(versionId: string, tag: string): string {
    for (const versions of this.versions.values()) {
      const version = versions.find((v) => v.id === versionId);
      if (version) {
        if (!version.tags.includes(tag)) version.tags.push(tag);
        this.scheduleFlush();
        return `Tagged version ${versionId} with "${tag}"`;
      }
    }
    return `Error: version "${versionId}" not found.`;
  }

  public listFiles(): string {
    if (this.versions.size === 0) return 'No files tracked.';
    const lines: string[] = ['Tracked Files:'];
    for (const [filePath, versions] of this.versions) {
      const latest = versions[versions.length - 1];
      lines.push(`  ${path.basename(filePath)}: ${versions.length} versions, latest: ${latest.hash.slice(0, 8)}`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    let totalVersions = 0;
    for (const versions of this.versions.values()) totalVersions += versions.length;
    return [
      'Version Control Stats:',
      `  Tracked files: ${this.versions.size}`,
      `  Total versions: ${totalVersions}`,
    ].join('\n');
  }

  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
