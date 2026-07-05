import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  ZavorthErrorCategory,
  ZavorthErrorStrategy,
  ZavorthErrorHandlingRule,
} from '../contracts/ErrorHandlingContract.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../logger.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type ErrorHandlingServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

const DEFAULT_STRATEGY: ZavorthErrorStrategy = 'ask-user';

const DEFAULT_ERROR_HANDLING = `# ERROR-HANDLING.md - Error Handling Policies

## Strategies

<!-- Managed by ErrorHandlingService. Each entry: - [category] strategy | maxRetries:N | fallback:strategy -->

`;

export class ErrorHandlingService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: ErrorHandlingServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): { strategyCount: number; defaultStrategy: ZavorthErrorStrategy; filePath: string } {
    const strategies = this.listStrategies();
    return { strategyCount: strategies.length, defaultStrategy: DEFAULT_STRATEGY, filePath: this.resolveFile() };
  }

  public setStrategy(category: ZavorthErrorCategory, strategy: ZavorthErrorStrategy, options?: { maxRetries?: number; fallbackStrategy?: ZavorthErrorStrategy }): ZavorthErrorHandlingRule {
    const rule: ZavorthErrorHandlingRule = {
      category,
      strategy,
      maxRetries: options?.maxRetries,
      fallbackStrategy: options?.fallbackStrategy,
      addedAt: new Date().toISOString(),
    };
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_ERROR_HANDLING);
    const sectionContent = this.readSection(content, 'Strategies');
    const existing = sectionContent.split(/\r?\n/).filter((l) => !l.includes(`[${category}]`));
    existing.push(this.ruleToLine(rule));
    const updated = this.upsertSection(content, 'Strategies', existing.join('\n'));
    this.writeText(filePath, updated);
    return rule;
  }

  public getStrategy(category: ZavorthErrorCategory): ZavorthErrorHandlingRule | null {
    return this.listStrategies().find((r) => r.category === category) || null;
  }

  public listStrategies(): ZavorthErrorHandlingRule[] {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_ERROR_HANDLING);
    const sectionContent = this.readSection(content, 'Strategies');
    const rules: ZavorthErrorHandlingRule[] = [];
    for (const line of sectionContent.split(/\r?\n/)) {
      const rule = this.lineToRule(line);
      if (rule) rules.push(rule);
    }
    return rules;
  }

  public handleError(category: ZavorthErrorCategory, context?: string): { strategy: ZavorthErrorStrategy; maxRetries: number; fallback?: ZavorthErrorStrategy; message: string } {
    const rule = this.getStrategy(category);
    const strategy = rule?.strategy || DEFAULT_STRATEGY;
    const maxRetries = rule?.maxRetries ?? 3;
    const fallback = rule?.fallbackStrategy;
    const messages: Record<ZavorthErrorStrategy, string> = {
      'retry-silent': 'Retrying silently...',
      'retry-explain': `Retrying after error${context ? `: ${context}` : ''}`,
      escalate: `Escalating error${context ? `: ${context}` : ''}`,
      'suggest-alternatives': `Suggesting alternatives for ${category}`,
      'log-continue': `Logged error, continuing${context ? `: ${context}` : ''}`,
      'ask-user': `Need user input for ${category}${context ? `: ${context}` : ''}`,
    };
    return { strategy, maxRetries, fallback, message: messages[strategy] };
  }

  private resolveFile(): string {
    return path.join(this.projectRoot, 'ERROR-HANDLING.md');
  }

  private ruleToLine(rule: ZavorthErrorHandlingRule): string {
    const parts = [`- [${rule.category}] ${rule.strategy}`];
    if (rule.maxRetries !== undefined) parts.push(`maxRetries:${rule.maxRetries}`);
    if (rule.fallbackStrategy) parts.push(`fallback:${rule.fallbackStrategy}`);
    return parts.join(' | ');
  }

  private lineToRule(line: string): ZavorthErrorHandlingRule | null {
    const trimmed = line.trim();
    const match = trimmed.match(/^- \[([^\]]+)\]\s+([\w-]+)(?:\s*\|\s*(.*))?$/);
    if (!match) return null;
    const extras = match[3] || '';
    const retryMatch = extras.match(/maxRetries:(\d+)/);
    const fallbackMatch = extras.match(/fallback:([\w-]+)/);
    return {
      category: match[1] as ZavorthErrorCategory,
      strategy: match[2] as ZavorthErrorStrategy,
      maxRetries: retryMatch ? safeParseInt(retryMatch[1], 3) : undefined,
      fallbackStrategy: fallbackMatch ? (fallbackMatch[1] as ZavorthErrorStrategy) : undefined,
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
    } catch (error) { logger.warn('[Error Handling] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
