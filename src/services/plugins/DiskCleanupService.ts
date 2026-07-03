import fs from 'fs';
import path from 'path';

export interface CleanupRule {
  id: string;
  name: string;
  pattern: string;
  max_age_days: number;
  max_size_mb: number;
  directories: string[];
  dry_run: boolean;
  enabled: boolean;
}

export interface CleanupResult {
  files_removed: number;
  bytes_freed: number;
  errors: string[];
  details: Array<{ path: string; size: number; reason: string }>;
}

export class DiskCleanupService {
  private readonly storageDir: string;
  private rules: CleanupRule[] = [];

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'disk-cleanup');
    this.ensureStorageDir();
    this.initDefaultRules();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private initDefaultRules(): void {
    this.rules = [
      { id: 'temp_files', name: 'Temporary files', pattern: '*.tmp,*.temp,*.bak', max_age_days: 7, max_size_mb: 100, directories: [path.join(process.cwd(), 'data', 'runtime', 'temp'), require('os').tmpdir()], dry_run: false, enabled: true },
      { id: 'screenshots', name: 'Old screenshots', pattern: 'screenshot_*.png', max_age_days: 30, max_size_mb: 500, directories: [path.join(process.cwd(), 'data', 'runtime', 'playwright'), path.join(process.cwd(), 'data', 'runtime', 'computer-use')], dry_run: false, enabled: true },
      { id: 'logs_old', name: 'Old logs', pattern: '*.log', max_age_days: 14, max_size_mb: 200, directories: [path.join(process.cwd(), 'data', 'runtime', 'logs')], dry_run: false, enabled: true },
      { id: 'cache', name: 'Search cache', pattern: 'search_*.json,contents_*.json', max_age_days: 3, max_size_mb: 100, directories: [path.join(process.cwd(), 'data', 'runtime', 'exa-cache'), path.join(process.cwd(), 'data', 'runtime', 'search-cache')], dry_run: false, enabled: true },
      { id: 'otel_exports', name: 'OTEL exports', pattern: 'export_*.json', max_age_days: 7, max_size_mb: 200, directories: [path.join(process.cwd(), 'data', 'runtime', 'otel')], dry_run: false, enabled: true },
      { id: 'ocr_temp', name: 'OCR temp', pattern: 'page-*.png,*.png', max_age_days: 1, max_size_mb: 100, directories: [path.join(process.cwd(), 'data', 'runtime', 'ocr_temp')], dry_run: false, enabled: true },
      { id: 'node_modules_cache', name: 'npm/yarn cache', pattern: '_cacache,*.tgz', max_age_days: 30, max_size_mb: 500, directories: [path.join(process.cwd(), 'node_modules', '.cache')], dry_run: false, enabled: true },
    ];
  }

  public scan(ruleId?: string): string {
    const rules = ruleId ? this.rules.filter((r) => r.id === ruleId) : this.rules.filter((r) => r.enabled);
    if (rules.length === 0) return 'No rules found.';

    let totalSize = 0;
    let totalFiles = 0;
    const lines: string[] = ['Cleanup scan:', ''];

    for (const rule of rules) {
      const icon = rule.dry_run ? '🔍' : '🧹';
      let ruleSize = 0;
      let ruleFiles = 0;

      for (const dir of rule.directories) {
        if (!fs.existsSync(dir)) continue;

        const files = this.listFiles(dir);
        const patterns = rule.pattern.split(',').map((p) => p.trim());
        const maxAge = rule.max_age_days * 86400000;

        for (const file of files) {
          try {
            const stat = fs.statSync(file);
            const age = Date.now() - stat.mtimeMs;
            const matchesPattern = patterns.some((p) => this.matchGlob(path.basename(file), p));

            if (matchesPattern && age > maxAge) {
              ruleSize += stat.size;
              ruleFiles++;
            }
          } catch { /* ignore */ }
        }
      }

      const sizeMb = ruleSize / 1024 / 1024;
      const withinLimit = sizeMb <= rule.max_size_mb;
      lines.push(`${icon} ${rule.name}: ${ruleFiles} files, ${sizeMb.toFixed(1)}MB${withinLimit ? '' : ' ⚠️ above limit'}`);
      totalSize += ruleSize;
      totalFiles += ruleFiles;
    }

    lines.push('', `Total: ${totalFiles} files, ${(totalSize / 1024 / 1024).toFixed(1)}MB potentially removable.`);
    return lines.join('\n');
  }

  public clean(ruleId?: string): CleanupResult {
    const rules = ruleId ? this.rules.filter((r) => r.id === ruleId) : this.rules.filter((r) => r.enabled && !r.dry_run);
    const result: CleanupResult = { files_removed: 0, bytes_freed: 0, errors: [], details: [] };

    for (const rule of rules) {
      for (const dir of rule.directories) {
        if (!fs.existsSync(dir)) continue;

        const files = this.listFiles(dir);
        const patterns = rule.pattern.split(',').map((p) => p.trim());
        const maxAge = rule.max_age_days * 86400000;

        for (const file of files) {
          try {
            const stat = fs.statSync(file);
            const age = Date.now() - stat.mtimeMs;
            const matchesPattern = patterns.some((p) => this.matchGlob(path.basename(file), p));

            if (matchesPattern && age > maxAge) {
              fs.unlinkSync(file);
              result.files_removed++;
              result.bytes_freed += stat.size;
              result.details.push({ path: file, size: stat.size, reason: `${rule.name}: ${Math.floor(age / 86400000)} days` });
            }
          } catch (error: unknown) {
            result.errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }

    return result;
  }

  public addRule(rule: Omit<CleanupRule, 'id'>): string {
    const id = `rule_${Date.now()}`;
    this.rules.push({ ...rule, id });
    return `Rule "${rule.name}" added. ID: ${id}`;
  }

  public toggleRule(ruleId: string, enabled: boolean): string {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) return `Rule "${ruleId}" not found.`;
    rule.enabled = enabled;
    return `Rule "${rule.name}" ${enabled ? 'enabled' : 'disabled'}.`;
  }

  public listRules(): string {
    const lines: string[] = ['Cleanup rules:'];
    for (const rule of this.rules) {
      const status = rule.enabled ? '✅' : '⏸️';
      const dry = rule.dry_run ? ' [DRY RUN]' : '';
      lines.push(`  ${status} ${rule.id}: ${rule.name}${dry} — ${rule.pattern} (>${rule.max_age_days}d)`);
    }
    return lines.join('\n');
  }

  public getUsage(): string {
    const dataDir = path.join(process.cwd(), 'data', 'runtime');
    if (!fs.existsSync(dataDir)) return 'Directory data/runtime not found.';

    const dirs = fs.readdirSync(dataDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    const lines: string[] = ['Disk usage (data/runtime):'];

    let totalSize = 0;
    for (const dir of dirs) {
      const dirPath = path.join(dataDir, dir.name);
      const size = this.getDirSize(dirPath);
      totalSize += size;
      const sizeMb = size / 1024 / 1024;
      if (sizeMb > 0.1) {
        lines.push(`  ${dir.name}: ${sizeMb.toFixed(1)}MB`);
      }
    }

    lines.push('', `Total: ${(totalSize / 1024 / 1024).toFixed(1)}MB`);
    return lines.join('\n');
  }

  public getStats(): string {
    const enabled = this.rules.filter((rule) => rule.enabled).length;
    const dryRun = this.rules.filter((rule) => rule.dry_run).length;
    return [
      'Disk cleanup statistics:',
      `  Rules: ${this.rules.length}`,
      `  Enabled: ${enabled}`,
      `  Dry run: ${dryRun}`,
      '',
      this.getUsage(),
    ].join('\n');
  }

  private listFiles(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile()) results.push(fullPath);
        else if (entry.isDirectory() && !entry.name.startsWith('.')) results.push(...this.listFiles(fullPath));
      }
    } catch { /* ignore */ }
    return results;
  }

  private getDirSize(dir: string): number {
    let size = 0;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile()) size += fs.statSync(fullPath).size;
        else if (entry.isDirectory()) size += this.getDirSize(fullPath);
      }
    } catch { /* ignore */ }
    return size;
  }

  private matchGlob(filename: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return regex.test(filename);
  }
}
