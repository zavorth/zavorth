import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthProactivityRule,
  ZavorthProactivityChannel,
  ZavorthProactivitySeverity,
} from '../contracts/ProactivityPolicyContract.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type ProactivityPolicyServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

const DEFAULT_PROACTIVITY = `# PROACTIVITY.md - Proactivity Policies

## Rules

## Configuration

- **Quiet hours start:**
- **Quiet hours end:**
- **Default channel:** cli
`;

export class ProactivityPolicyService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: ProactivityPolicyServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): { ruleCount: number; quietHours: { start: string; end: string } | null; defaultChannel: ZavorthProactivityChannel; filePath: string } {
    const content = this.readText(this.resolveFile(), DEFAULT_PROACTIVITY);
    const rules = this.listRules();
    const start = this.readMarkdownField(content, 'Quiet hours start');
    const end = this.readMarkdownField(content, 'Quiet hours end');
    const channel = this.readMarkdownField(content, 'Default channel') as ZavorthProactivityChannel;
    return {
      ruleCount: rules.length,
      quietHours: start && end ? { start, end } : null,
      defaultChannel: channel || 'cli',
      filePath: this.resolveFile(),
    };
  }

  public addRule(rule: Omit<ZavorthProactivityRule, 'addedAt'>): ZavorthProactivityRule {
    const full: ZavorthProactivityRule = { ...rule, addedAt: new Date().toISOString() };
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_PROACTIVITY);
    const sectionContent = this.readSection(content, 'Rules');
    const line = this.ruleToLine(full);
    const updated = this.upsertSection(content, 'Rules', this.appendToSection(sectionContent, line));
    this.writeText(filePath, updated);
    return full;
  }

  public removeRule(id: string): boolean {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_PROACTIVITY);
    const rules = this.listRules();
    if (!rules.find((r) => r.id === id)) return false;
    const sectionContent = this.readSection(content, 'Rules');
    const lines = sectionContent.split(/\r?\n/).filter((l) => !l.includes(`id:${id}`));
    const updated = this.upsertSection(content, 'Rules', lines.join('\n'));
    this.writeText(filePath, updated);
    return true;
  }

  public setQuietHours(start: string, end: string): void {
    const filePath = this.resolveFile();
    let content = this.readText(filePath, DEFAULT_PROACTIVITY);
    content = this.upsertMarkdownField(content, 'Quiet hours start', start);
    content = this.upsertMarkdownField(content, 'Quiet hours end', end);
    this.writeText(filePath, content);
  }

  public setDefaultChannel(channel: ZavorthProactivityChannel): void {
    const filePath = this.resolveFile();
    let content = this.readText(filePath, DEFAULT_PROACTIVITY);
    content = this.upsertMarkdownField(content, 'Default channel', channel);
    this.writeText(filePath, content);
  }

  public shouldNotify(trigger: string, currentTime?: string): { notify: boolean; channel: ZavorthProactivityChannel; rule?: ZavorthProactivityRule } {
    const status = this.getStatus();
    const now = currentTime || new Date().toTimeString().slice(0, 5);
    if (status.quietHours && this.isInWindow(now, status.quietHours.start, status.quietHours.end)) {
      const criticalRule = this.listRules().find((r) => trigger.toLowerCase().includes(r.trigger.toLowerCase()) && r.severity === 'critical');
      if (criticalRule) return { notify: true, channel: criticalRule.channel, rule: criticalRule };
      return { notify: false, channel: status.defaultChannel };
    }
    const rules = this.listRules();
    const matching = rules.find((r) => trigger.toLowerCase().includes(r.trigger.toLowerCase()));
    if (matching) return { notify: true, channel: matching.channel, rule: matching };
    return { notify: false, channel: status.defaultChannel };
  }

  public listRules(): ZavorthProactivityRule[] {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_PROACTIVITY);
    const sectionContent = this.readSection(content, 'Rules');
    const rules: ZavorthProactivityRule[] = [];
    for (const line of sectionContent.split(/\r?\n/)) {
      const rule = this.lineToRule(line);
      if (rule) rules.push(rule);
    }
    return rules;
  }

  private resolveFile(): string {
    return path.join(this.projectRoot, 'PROACTIVITY.md');
  }

  private ruleToLine(rule: ZavorthProactivityRule): string {
    const tw = rule.timeWindow ? ` | window:${rule.timeWindow.start}-${rule.timeWindow.end}` : '';
    return `- id:${rule.id} | trigger:${rule.trigger} | channel:${rule.channel} | sev:${rule.severity} | action:${rule.action}${tw}`;
  }

  private lineToRule(line: string): ZavorthProactivityRule | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- id:')) return null;
    const get = (key: string): string => {
      const m = trimmed.match(new RegExp(`${key}:([^|]+)`));
      return m ? m[1].trim() : '';
    };
    const id = get('id');
    if (!id) return null;
    const windowMatch = trimmed.match(/window:(\d{2}:\d{2})-(\d{2}:\d{2})/);
    return {
      id,
      trigger: get('trigger'),
      channel: (get('channel') as ZavorthProactivityChannel) || 'cli',
      severity: (get('sev') as ZavorthProactivitySeverity) || 'low',
      action: (get('action') as ZavorthProactivityRule['action']) || 'notify',
      timeWindow: windowMatch ? { start: windowMatch[1], end: windowMatch[2] } : undefined,
      addedAt: new Date().toISOString(),
    };
  }

  private isInWindow(time: string, start: string, end: string): boolean {
    if (start <= end) return time >= start && time <= end;
    return time >= start || time <= end;
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

  private upsertMarkdownField(content: string, label: string, value: string): string {
    const escaped = escapeRegExp(label);
    const pattern = new RegExp(`(^[ \\t]*-[ \\t]+\\*\\*${escaped}:\\*\\*)[ \\t]*(.*)$`, 'm');
    if (pattern.test(content)) {
      return content.replace(pattern, `$1 ${value}`);
    }
    const lines = content.trimEnd().split(/\r?\n/);
    lines.push(`- **${label}:** ${value}`);
    return lines.join('\n');
  }

  private readMarkdownField(content: string, label: string): string {
    const escaped = escapeRegExp(label);
    const match = content.match(new RegExp(`^[ \\t]*-[ \\t]+\\*\\*${escaped}:\\*\\*[ \\t]*(.*)$`, 'm'));
    const value = String(match?.[1] || '').trim();
    if (!value || value.toLowerCase() === 'optional') return '';
    return value;
  }

  private readText(filePath: string, fallback: string): string {
    try {
      if (!this.fs.existsSync(filePath)) return fallback;
      return String(this.fs.readFileSync(filePath, 'utf8') || '');
    } catch (error: unknown) {logger.warn('[Proactivity] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
