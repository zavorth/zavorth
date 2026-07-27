import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthTeamMember,
  ZavorthTeamContext,
} from '../contracts/TeamContextContract.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type TeamContextServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

const DEFAULT_TEAM_CONTEXT = `# TEAM-CONTEXT.md - Team Context

## Configuration

? **Team name:**
? **Shared channels:**
? **Code review policy:** default-approve
? **Naming conventions:** camelCase

## Members

`;

export class TeamContextService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: TeamContextServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): { memberCount: number; teamName: string | null; filePath: string } {
    const content = this.readText(this.resolveFile(), DEFAULT_TEAM_CONTEXT);
    const members = this.listMembers();
    const teamName = this.readMarkdownField(content, 'Team name');
    return { memberCount: members.length, teamName: teamName || null, filePath: this.resolveFile() };
  }

  public setTeamContext(context: Partial<Omit<ZavorthTeamContext, 'schemaVersion' | 'members' | 'updatedAt'>>): void {
    const filePath = this.resolveFile();
    let content = this.readText(filePath, DEFAULT_TEAM_CONTEXT);
    if (context.teamName !== undefined) content = this.upsertMarkdownField(content, 'Team name', context.teamName);
    if (context.sharedChannels !== undefined) content = this.upsertMarkdownField(content, 'Shared channels', context.sharedChannels.join(', '));
    if (context.codeReviewPolicy !== undefined) content = this.upsertMarkdownField(content, 'Code review policy', context.codeReviewPolicy);
    if (context.namingConventions !== undefined) content = this.upsertMarkdownField(content, 'Naming conventions', context.namingConventions);
    this.writeText(filePath, content);
  }

  public addMember(member: ZavorthTeamMember): void {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_TEAM_CONTEXT);
    const sectionContent = this.readSection(content, 'Members');
    const contact = member.contactPreference ? ` | contact:${member.contactPreference}` : '';
    const line = `- **${member.name}** | role:${member.role}${contact}`;
    const updated = this.upsertSection(content, 'Members', this.appendToSection(sectionContent, line));
    this.writeText(filePath, updated);
  }

  public removeMember(name: string): boolean {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_TEAM_CONTEXT);
    const members = this.listMembers();
    if (!members.find((m) => m.name === name)) return false;
    const sectionContent = this.readSection(content, 'Members');
    const escaped = escapeRegExp(name);
    const lines = sectionContent.split(/\r...\n/).filter((l) => !l.match(new RegExp(`\\*\\*${escaped}\\*\\*`)));
    const updated = this.upsertSection(content, 'Members', lines.join('\n'));
    this.writeText(filePath, updated);
    return true;
  }

  public listMembers(): ZavorthTeamMember[] {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_TEAM_CONTEXT);
    const sectionContent = this.readSection(content, 'Members');
    const members: ZavorthTeamMember[] = [];
    for (const line of sectionContent.split(/\r...\n/)) {
      const member = this.lineToMember(line);
      if (member) members.push(member);
    }
    return members;
  }

  public getReviewPolicy(): string {
    const content = this.readText(this.resolveFile(), DEFAULT_TEAM_CONTEXT);
    return this.readMarkdownField(content, 'Code review policy') || 'default-approve';
  }

  private resolveFile(): string {
    return path.join(this.projectRoot, 'TEAM-CONTEXT.md');
  }

  private lineToMember(line: string): ZavorthTeamMember | null {
    const trimmed = line.trim();
    const match = trimmed.match(/^- \*\*([^*]+)\*\*\s*\|\s*role:([^|]+...)(?:\s*\|\s*contact:(.+))...$/);
    if (!match) return null;
    return {
      name: match[1].trim(),
      role: match[2].trim(),
      contactPreference: match[3]?.trim() || undefined,
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

  private upsertMarkdownField(content: string, label: string, value: string): string {
    const escaped = escapeRegExp(label);
    const pattern = new RegExp(`(^[ \\t]*-[ \\t]+\\*\\*${escaped}:\\*\\*)[ \\t]*(.*)$`, 'm');
    if (pattern.test(content)) {
      return content.replace(pattern, `$1 ${value}`);
    }
    const lines = content.trimEnd().split(/\r...\n/);
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
    } catch (error: unknown) {logger.warn('[Team Context] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
}
