import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

export type MnemosMemoryLifecycleEntry = {
  file: string;
  ageDays: number;
  tier: 'hot' | 'warm' | 'cold' | 'archive';
  action: 'keep-full' | 'weekly-summary' | 'monthly-summary' | 'archive-index';
  summaryPath: string | null;
};

export type MnemosMemoryLifecycleSnapshot = {
  generatedAt: string;
  memoryRoot: string;
  entries: MnemosMemoryLifecycleEntry[];
  summary: Record<MnemosMemoryLifecycleEntry['tier'], number>;
  retention: {
    hotDays: 7;
    warmDays: 30;
    coldDays: 90;
  };
};

type Runtime = {
  projectRoot?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

export class MnemosMemoryLifecycleService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;

  constructor(runtime: Runtime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || config.projectRoot);
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public buildSnapshot(input: { apply?: boolean } = {}): MnemosMemoryLifecycleSnapshot {
    const memoryRoot = path.join(this.projectRoot, 'memory');
    const generatedAt = this.now().toISOString();
    const entries = this.listMarkdownFiles(memoryRoot).map((file) => this.classify(file, memoryRoot));
    if (input.apply) {
      for (const entry of entries) {
        this.applyEntry(entry);
      }
    }
    return {
      generatedAt,
      memoryRoot,
      entries,
      summary: entries.reduce<Record<MnemosMemoryLifecycleEntry['tier'], number>>((acc, entry) => {
        acc[entry.tier] += 1;
        return acc;
      }, { hot: 0, warm: 0, cold: 0, archive: 0 }),
      retention: {
        hotDays: 7,
        warmDays: 30,
        coldDays: 90,
      },
    };
  }

  private classify(file: string, memoryRoot: string): MnemosMemoryLifecycleEntry {
    const ageDays = Math.max(0, Math.floor((this.now().getTime() - this.fileDate(file).getTime()) / 86_400_000));
    const relative = path.relative(memoryRoot, file).replace(/\\/g, '/');
    if (ageDays <= 7) {
      return { file, ageDays, tier: 'hot', action: 'keep-full', summaryPath: null };
    }
    if (ageDays <= 30) {
      return {
        file,
        ageDays,
        tier: 'warm',
        action: 'weekly-summary',
        summaryPath: path.join(memoryRoot, 'summaries', 'weekly', `${weekKey(this.fileDate(file))}.md`),
      };
    }
    if (ageDays <= 90) {
      return {
        file,
        ageDays,
        tier: 'cold',
        action: 'monthly-summary',
        summaryPath: path.join(memoryRoot, 'summaries', 'monthly', `${monthKey(this.fileDate(file))}.md`),
      };
    }
    return {
      file,
      ageDays,
      tier: 'archive',
      action: 'archive-index',
      summaryPath: path.join(memoryRoot, 'archive', 'INDEX.md'),
    };
  }

  private applyEntry(entry: MnemosMemoryLifecycleEntry): void {
    if (!entry.summaryPath || !this.existsSync(entry.file)) {
      return;
    }
    this.mkdirSync(path.dirname(entry.summaryPath), { recursive: true });
    const source = this.safeRead(entry.file);
    const summary = summarizeMarkdown(source, path.basename(entry.file));
    const existing = this.existsSync(entry.summaryPath) ? this.safeRead(entry.summaryPath) : '';
    if (existing.includes(`source: ${entry.file}`)) {
      return;
    }
    const block = [
      `\n## ${path.basename(entry.file)}`,
      '',
      `- source: ${entry.file}`,
      `- tier: ${entry.tier}`,
      `- ageDays: ${entry.ageDays}`,
      `- summary: ${summary}`,
      '',
    ].join('\n');
    this.writeFileSync(entry.summaryPath, `${existing.trimEnd()}${block}`, 'utf8');
  }

  private listMarkdownFiles(root: string): string[] {
    if (!this.existsSync(root)) {
      return [];
    }
    const result: string[] = [];
    const visit = (dir: string) => {
      for (const entry of this.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !['summaries', 'archive'].includes(entry.name)) {
          visit(full);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          result.push(full);
        }
      }
    };
    visit(root);
    return result;
  }

  private fileDate(file: string): Date {
    const match = path.basename(file).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
    }
    return this.now();
  }

  private safeRead(file: string): string {
    try {
      return String(this.readFileSync(file, 'utf8') || '');
    } catch {
      return '';
    }
  }
}

function summarizeMarkdown(content: string, fallback: string): string {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .filter((line) => line && !line.startsWith('```'));
  return (lines.slice(0, 4).join(' | ') || fallback).slice(0, 500);
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function weekKey(date: Date): string {
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const day = Math.floor((date.getTime() - first.getTime()) / 86_400_000);
  const week = Math.ceil((day + first.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
