import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthKnowledgeEntry,
  ZavorthKnowledgeSourceType,
  ZavorthKnowledgeCategory,
  ZavorthKnowledgeIndex,
} from '../contracts/KnowledgeInjectionContract.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type KnowledgeInjectionServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

const SECTIONS = ['Always Available', 'Domain-Specific', 'Project-Specific', 'Reference Materials'] as const;

export class KnowledgeInjectionService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: KnowledgeInjectionServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): { totalEntries: number; sections: Record<string, number>; filePath: string } {
    const filePath = this.resolveFile();
    const entries = this.listEntries();
    const sections: Record<string, number> = {};
    for (const section of SECTIONS) {
      sections[section] = entries.filter((e) => e.category === this.sectionToCategory(section)).length;
    }
    return { totalEntries: entries.length, sections, filePath };
  }

  public addEntry(entry: Omit<ZavorthKnowledgeEntry, 'addedAt' | 'lastVerifiedAt'>): ZavorthKnowledgeEntry {
    const full: ZavorthKnowledgeEntry = {
      ...entry,
      addedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    };
    const filePath = this.resolveFile();
    const content = this.readText(filePath, '');
    const section = this.categoryToSection(full.category);
    const line = this.entryToLine(full);
    const updated = this.upsertSection(content, section, this.appendToSection(this.readSection(content, section), line));
    this.writeText(filePath, updated);
    return full;
  }

  public removeEntry(id: string): boolean {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, '');
    const entries = this.listEntries();
    const target = entries.find((e) => e.id === id);
    if (!target) return false;
    const section = this.categoryToSection(target.category);
    const sectionContent = this.readSection(content, section);
    const lines = sectionContent.split(/\r?\n/).filter((l) => !l.includes(`id:${id}`));
    const updated = this.upsertSection(content, section, lines.join('\n'));
    this.writeText(filePath, updated);
    return true;
  }

  public listEntries(): ZavorthKnowledgeEntry[] {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, '');
    const entries: ZavorthKnowledgeEntry[] = [];
    for (const section of SECTIONS) {
      const sectionContent = this.readSection(content, section);
      const category = this.sectionToCategory(section);
      for (const line of sectionContent.split(/\r?\n/)) {
        const entry = this.lineToEntry(line, category);
        if (entry) entries.push(entry);
      }
    }
    return entries;
  }

  public loadContext(taskType?: string): string {
    const entries = this.listEntries();
    const relevant = taskType
      ? entries.filter((e) => e.category === taskType || e.tags.includes(taskType))
      : entries.filter((e) => e.category === 'reference' || e.category === 'documentation');
    const parts: string[] = [];
    for (const entry of relevant) {
      if (entry.sourceType === 'file' && entry.path) {
        const absPath = path.resolve(this.projectRoot, entry.path);
        const text = this.readText(absPath, '');
        if (text) parts.push(`### ${entry.label}\n${text}`);
      } else if (entry.sourceType === 'inline' && entry.content) {
        parts.push(`### ${entry.label}\n${entry.content}`);
      } else if (entry.sourceType === 'url' && entry.url) {
        parts.push(`### ${entry.label}\nSource: ${entry.url}\n${entry.description}`);
      }
    }
    return parts.join('\n\n');
  }

  public validateSources(): { valid: string[]; invalid: string[] } {
    const entries = this.listEntries();
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const entry of entries) {
      if (entry.sourceType === 'file' && entry.path) {
        const absPath = path.resolve(this.projectRoot, entry.path);
        (this.fs.existsSync(absPath) ? valid : invalid).push(entry.id);
      } else if (entry.sourceType === 'directory' && entry.path) {
        const absPath = path.resolve(this.projectRoot, entry.path);
        (this.fs.existsSync(absPath) ? valid : invalid).push(entry.id);
      } else {
        valid.push(entry.id);
      }
    }
    return { valid, invalid };
  }

  private resolveFile(): string {
    return path.join(this.projectRoot, 'KNOWLEDGE.md');
  }

  private sectionToCategory(section: string): ZavorthKnowledgeCategory {
    const map: Record<string, ZavorthKnowledgeCategory> = {
      'Always Available': 'reference',
      'Domain-Specific': 'domain',
      'Project-Specific': 'project',
      'Reference Materials': 'documentation',
    };
    return map[section] || 'custom';
  }

  private categoryToSection(category: ZavorthKnowledgeCategory): string {
    const map: Record<string, string> = {
      reference: 'Always Available',
      documentation: 'Reference Materials',
      'style-guide': 'Always Available',
      domain: 'Domain-Specific',
      project: 'Project-Specific',
      custom: 'Reference Materials',
    };
    return map[category] || 'Reference Materials';
  }

  private entryToLine(entry: ZavorthKnowledgeEntry): string {
    const parts = [
      `- [${entry.label}]`,
      `id:${entry.id}`,
      `type:${entry.sourceType}`,
      `cat:${entry.category}`,
      entry.path ? `path:${entry.path}` : '',
      entry.url ? `url:${entry.url}` : '',
      `desc:${entry.description}`,
      `tags:${entry.tags.join(',')}`,
    ].filter(Boolean);
    return parts.join(' | ');
  }

  private lineToEntry(line: string, fallbackCategory: ZavorthKnowledgeCategory): ZavorthKnowledgeEntry | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- [')) return null;
    const labelMatch = trimmed.match(/^- \[([^\]]+)\]/);
    if (!labelMatch) return null;
    const getField = (key: string): string => {
      const m = trimmed.match(new RegExp(`${key}:([^|]+)`));
      return m ? m[1].trim() : '';
    };
    const id = getField('id');
    if (!id) return null;
    return {
      id,
      label: labelMatch[1],
      sourceType: (getField('type') as ZavorthKnowledgeSourceType) || 'file',
      category: (getField('cat') as ZavorthKnowledgeCategory) || fallbackCategory,
      path: getField('path') || undefined,
      url: getField('url') || undefined,
      description: getField('desc'),
      addedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      tags: getField('tags') ? getField('tags').split(',').map((t) => t.trim()) : [],
    };
  }

  private readSection(content: string, title: string): string {
    const escaped = escapeRegExp(title);
    const headerPattern = new RegExp(`^## ${escaped}\\s*$`, 'm');
    const headerMatch = content.match(headerPattern);
    if (!headerMatch) return '';
    const startIdx = headerMatch.index! + headerMatch[0].length;
    const rest = content.slice(startIdx);
    const nextSection = rest.search(/^## /m);
    if (nextSection === -1) return rest.trim();
    return rest.slice(0, nextSection).trim();
  }

  private appendToSection(sectionContent: string, line: string): string {
    const trimmed = sectionContent.trimEnd();
    return trimmed ? `${trimmed}\n${line}` : line;
  }

  private upsertSection(content: string, title: string, section: string): string {
    const escaped = escapeRegExp(title);
    const headerPattern = new RegExp(`^## ${escaped}\\s*$`, 'm');
    const headerMatch = content.match(headerPattern);
    const full = `## ${title}\n\n${section}`;
    if (headerMatch) {
      const startIdx = headerMatch.index! + headerMatch[0].length;
      const rest = content.slice(startIdx);
      const nextSection = rest.search(/^## /m);
      if (nextSection === -1) {
        return content.slice(0, headerMatch.index) + full + '\n';
      }
      return content.slice(0, headerMatch.index) + full + '\n' + rest.slice(nextSection);
    }
    return `${content.trimEnd()}\n\n${full}\n`;
  }

  private readText(filePath: string, fallback: string): string {
    try {
      if (!this.fs.existsSync(filePath)) return fallback;
      return String(this.fs.readFileSync(filePath, 'utf8') || '');
    } catch (error) { logger.warn('[Knowledge Injection] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
