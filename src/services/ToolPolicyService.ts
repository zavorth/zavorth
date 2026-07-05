import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthToolPolicyAction,
  ZavorthToolPolicyLevel,
  ZavorthToolPolicyEntry,
} from '../contracts/ToolPolicyContract.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type ToolPolicyServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

const DEFAULT_LEVEL: ZavorthToolPolicyLevel = 'ask';

const DEFAULT_TOOL_POLICY = `# TOOL-POLICY.md - Tool Permission Policies

<!-- Managed by ToolPolicyService. Each entry: - [action] level | conditions -->

## Policies

`;

export class ToolPolicyService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: ToolPolicyServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): { policyCount: number; filePath: string; defaultLevel: ZavorthToolPolicyLevel } {
    const entries = this.listPolicies();
    return { policyCount: entries.length, filePath: this.resolveFile(), defaultLevel: DEFAULT_LEVEL };
  }

  public setPolicy(action: ZavorthToolPolicyAction, level: ZavorthToolPolicyLevel, conditions?: string): ZavorthToolPolicyEntry {
    const entry: ZavorthToolPolicyEntry = { action, level, conditions, addedAt: new Date().toISOString() };
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_TOOL_POLICY);
    const line = this.entryToLine(entry);
    const sectionContent = this.readSection(content, 'Policies');
    const existing = sectionContent.split(/\r?\n/).filter((l) => !l.includes(`[${action}]`));
    existing.push(line);
    const updated = this.upsertSection(content, 'Policies', existing.join('\n'));
    this.writeText(filePath, updated);
    return entry;
  }

  public getPolicy(action: ZavorthToolPolicyAction): ZavorthToolPolicyEntry | null {
    return this.listPolicies().find((e) => e.action === action) || null;
  }

  public listPolicies(): ZavorthToolPolicyEntry[] {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_TOOL_POLICY);
    const sectionContent = this.readSection(content, 'Policies');
    const entries: ZavorthToolPolicyEntry[] = [];
    for (const line of sectionContent.split(/\r?\n/)) {
      const entry = this.lineToEntry(line);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  public checkPermission(action: ZavorthToolPolicyAction): { allowed: boolean; level: ZavorthToolPolicyLevel } {
    const policy = this.getPolicy(action);
    const level = policy?.level || DEFAULT_LEVEL;
    return { allowed: level === 'allow', level };
  }

  public syncFromRuntimePermissions(): ZavorthToolPolicyEntry[] {
    const permPath = path.join(this.projectRoot, 'config', 'runtime-permissions.json');
    if (!this.fs.existsSync(permPath)) return [];
    let perms: Record<string, string>;
    try {
      const raw = String(this.fs.readFileSync(permPath, 'utf8') || '{}');
      perms = JSON.parse(raw);
    } catch (error) { logger.warn('[ToolPolicyService] JSON parse failed', error); return []; }
    const entries: ZavorthToolPolicyEntry[] = [];
    for (const [key, value] of Object.entries(perms)) {
      const action = key as ZavorthToolPolicyAction;
      const level = (value as ZavorthToolPolicyLevel) || DEFAULT_LEVEL;
      entries.push(this.setPolicy(action, level));
    }
    return entries;
  }

  private resolveFile(): string {
    return path.join(this.projectRoot, 'TOOL-POLICY.md');
  }

  private entryToLine(entry: ZavorthToolPolicyEntry): string {
    const cond = entry.conditions ? ` | ${entry.conditions}` : '';
    return `- [${entry.action}] ${entry.level}${cond}`;
  }

  private lineToEntry(line: string): ZavorthToolPolicyEntry | null {
    const trimmed = line.trim();
    const match = trimmed.match(/^- \[([^\]]+)\]\s+(allow|ask|deny)(?:\s*\|\s*(.*))?$/);
    if (!match) return null;
    return {
      action: match[1] as ZavorthToolPolicyAction,
      level: match[2] as ZavorthToolPolicyLevel,
      conditions: match[3]?.trim() || undefined,
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
    } catch (error) { logger.warn('[ToolPolicyService] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
