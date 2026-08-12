import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthBehavioralRule,
  ZavorthRuleSeverity,
  ZavorthRuleContext,
} from '../contracts/BehavioralRulesContract.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type BehavioralRulesServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

const CONTEXT_SECTIONS: Record<string, string> = {
  code: 'When writing code',
  review: 'When reviewing code',
  uncertainty: 'When uncertain',
  explanation: 'When explaining',
  error: 'When handling errors',
  external: 'When doing external actions',
  always: 'General rules',
  creative: 'When doing creative work',
  custom: 'Custom rules',
};

const DEFAULT_RULES = `# RULES.md - Behavioral Rules

## When writing code

## When reviewing code

## When uncertain

## When explaining

## When handling errors

## When doing external actions

## General rules

## When doing creative work

## Custom rules
`;

export class BehavioralRulesService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: BehavioralRulesServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): { ruleCount: number; categories: Record<string, number>; filePath: string } {
    const filePath = this.resolveFile();
    const rules = this.listRules();
    const categories: Record<string, number> = {};
    for (const rule of rules) {
      categories[rule.context] = (categories[rule.context] || 0) + 1;
    }
    return { ruleCount: rules.length, categories, filePath };
  }

  public addRule(rule: Omit<ZavorthBehavioralRule, 'addedAt'>): ZavorthBehavioralRule {
    const full: ZavorthBehavioralRule = { ...rule, addedAt: new Date().toISOString() };
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_RULES);
    const section = CONTEXT_SECTIONS[full.context] || CONTEXT_SECTIONS.custom;
    const line = this.ruleToLine(full);
    const sectionContent = this.readSection(content, section);
    const updated = this.upsertSection(content, section, this.appendToSection(sectionContent, line));
    this.writeText(filePath, updated);
    return full;
  }

  public removeRule(id: string): boolean {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_RULES);
    const rules = this.listRules();
    const target = rules.find((r) => r.id === id);
    if (!target) return false;
    const section = CONTEXT_SECTIONS[target.context] || CONTEXT_SECTIONS.custom;
    const sectionContent = this.readSection(content, section);
    const lines = sectionContent.split(/\r?\n/).filter((l) => !l.includes(`id:${id}`));
    const updated = this.upsertSection(content, section, lines.join('\n'));
    this.writeText(filePath, updated);
    return true;
  }

  public listRules(context?: ZavorthRuleContext): ZavorthBehavioralRule[] {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_RULES);
    const rules: ZavorthBehavioralRule[] = [];
    for (const [ctx, sectionTitle] of Object.entries(CONTEXT_SECTIONS)) {
      if (context && ctx !== context) continue;
      const sectionContent = this.readSection(content, sectionTitle);
      for (const line of sectionContent.split(/\r?\n/)) {
        const rule = this.lineToRule(line, ctx as ZavorthRuleContext);
        if (rule) rules.push(rule);
      }
    }
    return rules;
  }

  public getRulesForContext(context: ZavorthRuleContext): ZavorthBehavioralRule[] {
    return this.listRules(context);
  }

  public renderSystemPrompt(): string {
    const rules = this.listRules();
    if (rules.length === 0) return '';
    const groups: Record<string, string[]> = {};
    for (const rule of rules) {
      const section = CONTEXT_SECTIONS[rule.context] || 'Other';
      if (!groups[section]) groups[section] = [];
      const prefix = rule.severity === 'strict' ? '[STRICT]' : rule.severity === 'prefer' ? '[PREFER]' : '[SUGGEST]';
      groups[section].push(`${prefix} ${rule.directive}`);
    }
    const parts: string[] = ['## Behavioral Rules\n'];
    for (const [section, directives] of Object.entries(groups)) {
      parts.push(`### ${section}`);
      for (const d of directives) parts.push(`- ${d}`);
      parts.push('');
    }
    return parts.join('\n').trim();
  }

  private resolveFile(): string {
    return path.join(this.projectRoot, 'RULES.md');
  }

  private ruleToLine(rule: ZavorthBehavioralRule): string {
    return `- id:${rule.id} | sev:${rule.severity} | ${rule.directive}`;
  }

  private lineToRule(line: string, context: ZavorthRuleContext): ZavorthBehavioralRule | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) return null;
    const idMatch = trimmed.match(/id:([^|]+)/);
    const sevMatch = trimmed.match(/sev:([^|]+)/);
    if (!idMatch) return null;
    const directive = trimmed.replace(/- id:[^|]*\|[^|]*\|\s*/, '').trim();
    if (!directive) return null;
    return {
      id: idMatch[1].trim(),
      context,
      directive,
      severity: (sevMatch?.[1]?.trim() as ZavorthRuleSeverity) || 'suggest',
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
    } catch (error: unknown) {logger.warn('[Behavioral Rules] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
}
