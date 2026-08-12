import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthOutputContext,
  ZavorthOutputFormatRule,
} from '../contracts/OutputFormatContract.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type OutputFormatServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

const DEFAULT_OUTPUT_FORMAT = `# OUTPUT-FORMAT.md - Output Format Rules

## Rules

<!-- Managed by OutputFormatService. Each entry: - [context] format | maxLength:N | examples:yes/no | bullets:yes/no | tables:yes/no -->

`;

export class OutputFormatService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: OutputFormatServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): { ruleCount: number; filePath: string } {
    const rules = this.listRules();
    return { ruleCount: rules.length, filePath: this.resolveFile() };
  }

  public setRule(context: ZavorthOutputContext, rule: Omit<ZavorthOutputFormatRule, 'context' | 'addedAt'>): ZavorthOutputFormatRule {
    const full: ZavorthOutputFormatRule = { ...rule, context, addedAt: new Date().toISOString() };
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_OUTPUT_FORMAT);
    const sectionContent = this.readSection(content, 'Rules');
    const existing = sectionContent.split(/\r?\n/).filter((l) => !l.includes(`[${context}]`));
    existing.push(this.ruleToLine(full));
    const updated = this.upsertSection(content, 'Rules', existing.join('\n'));
    this.writeText(filePath, updated);
    return full;
  }

  public getRule(context: ZavorthOutputContext): ZavorthOutputFormatRule | null {
    return this.listRules().find((r) => r.context === context) || null;
  }

  public listRules(): ZavorthOutputFormatRule[] {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_OUTPUT_FORMAT);
    const sectionContent = this.readSection(content, 'Rules');
    const rules: ZavorthOutputFormatRule[] = [];
    for (const line of sectionContent.split(/\r?\n/)) {
      const rule = this.lineToRule(line);
      if (rule) rules.push(rule);
    }
    return rules;
  }

  public getFormatHint(context: ZavorthOutputContext): string {
    const rule = this.getRule(context);
    if (!rule) return '';
    const parts: string[] = [`Format: ${rule.format}`];
    if (rule.maxLength) parts.push(`Max length: ${rule.maxLength}`);
    parts.push(`Examples: ${rule.includeExamples ? 'yes' : 'no'}`);
    parts.push(`Bullets: ${rule.useBulletPoints ? 'yes' : 'no'}`);
    parts.push(`Tables: ${rule.useTables ? 'yes' : 'no'}`);
    return parts.join(' | ');
  }

  private resolveFile(): string {
    return path.join(this.projectRoot, 'OUTPUT-FORMAT.md');
  }

  private ruleToLine(rule: ZavorthOutputFormatRule): string {
    return `- [${rule.context}] ${rule.format} | maxLength:${rule.maxLength || 'none'} | examples:${rule.includeExamples ? 'yes' : 'no'} | bullets:${rule.useBulletPoints ? 'yes' : 'no'} | tables:${rule.useTables ? 'yes' : 'no'}`;
  }

  private lineToRule(line: string): ZavorthOutputFormatRule | null {
    const trimmed = line.trim();
    const match = trimmed.match(/^- \[([^\]]+)\]\s+([^|]+)(?:\s*\|\s*(.*))...$/);
    if (!match) return null;
    const extras = match[3] || '';
    const getMaxLen = (): number | undefined => {
      const m = extras.match(/maxLength:(\d+)/);
      return m ? parseInt(m[1], 10) : undefined;
    };
    const getBool = (key: string): boolean => {
      const m = extras.match(new RegExp(`${key}:(yes|no)`));
      return m ? m[1] === 'yes' : false;
    };
    return {
      context: match[1] as ZavorthOutputContext,
      format: match[2].trim(),
      maxLength: getMaxLen(),
      includeExamples: getBool('examples'),
      useBulletPoints: getBool('bullets'),
      useTables: getBool('tables'),
      addedAt: new Date().toISOString(),
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
    } catch (error: unknown) {logger.warn('[Output Format] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
}
