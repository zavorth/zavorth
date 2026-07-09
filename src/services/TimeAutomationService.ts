import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthDaySchedule,
  ZavorthTimeWindow,
  ZavorthTimeAutomationPolicy,
} from '../contracts/TimeAutomationContract.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type TimeAutomationServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

type DayOfWeek = ZavorthDaySchedule['day'];

const ALL_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_TIME_AUTOMATION = `# TIME-AUTOMATION.md - Time & Automation Policies

## Configuration

- **Timezone:** UTC
- **Weekend policy:** normal

## Schedules

<!-- Managed by TimeAutomationService. Each entry: - [day] working:start-end | focus:start-end | available:yes/no -->

`;

export class TimeAutomationService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: TimeAutomationServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): { configuredDays: number; timezone: string; weekendPolicy: string; filePath: string } {
    const content = this.readText(this.resolveFile(), DEFAULT_TIME_AUTOMATION);
    const schedules = this.listSchedules();
    const timezone = this.readMarkdownField(content, 'Timezone') || 'UTC';
    const weekendPolicy = this.readMarkdownField(content, 'Weekend policy') || 'normal';
    return { configuredDays: schedules.length, timezone, weekendPolicy, filePath: this.resolveFile() };
  }

  public setSchedule(day: DayOfWeek, schedule: { workingHours?: ZavorthTimeWindow | null; focusHours?: ZavorthTimeWindow | null; available?: boolean }): void {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_TIME_AUTOMATION);
    const sectionContent = this.readSection(content, 'Schedules');
    const existing = sectionContent.split(/\r?\n/).filter((l) => !l.includes(`[${day}]`));
    const existingSchedule = this.getSchedule(day) || { day, workingHours: null, focusHours: null, available: true };
    const merged: ZavorthDaySchedule = {
      day,
      workingHours: schedule.workingHours !== undefined ? schedule.workingHours : existingSchedule.workingHours,
      focusHours: schedule.focusHours !== undefined ? schedule.focusHours : existingSchedule.focusHours,
      available: schedule.available !== undefined ? schedule.available : existingSchedule.available,
    };
    existing.push(this.scheduleToLine(merged));
    const updated = this.upsertSection(content, 'Schedules', existing.join('\n'));
    this.writeText(filePath, updated);
  }

  public getSchedule(day: DayOfWeek): ZavorthDaySchedule | null {
    return this.listSchedules().find((s) => s.day === day) || null;
  }

  public setWeekendPolicy(policy: 'normal' | 'reduced' | 'urgent-only'): void {
    const filePath = this.resolveFile();
    let content = this.readText(filePath, DEFAULT_TIME_AUTOMATION);
    content = this.upsertMarkdownField(content, 'Weekend policy', policy);
    this.writeText(filePath, content);
  }

  public isWorkingHours(day: DayOfWeek, time: string): boolean {
    const schedule = this.getSchedule(day);
    if (!schedule || !schedule.available || !schedule.workingHours) return false;
    return this.isInWindow(time, schedule.workingHours.start, schedule.workingHours.end);
  }

  public isFocusHours(day: DayOfWeek, time: string): boolean {
    const schedule = this.getSchedule(day);
    if (!schedule || !schedule.focusHours) return false;
    return this.isInWindow(time, schedule.focusHours.start, schedule.focusHours.end);
  }

  private listSchedules(): ZavorthDaySchedule[] {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_TIME_AUTOMATION);
    const sectionContent = this.readSection(content, 'Schedules');
    const schedules: ZavorthDaySchedule[] = [];
    for (const line of sectionContent.split(/\r?\n/)) {
      const schedule = this.lineToSchedule(line);
      if (schedule) schedules.push(schedule);
    }
    return schedules;
  }

  private resolveFile(): string {
    return path.join(this.projectRoot, 'TIME-AUTOMATION.md');
  }

  private scheduleToLine(schedule: ZavorthDaySchedule): string {
    const wh = schedule.workingHours ? `${schedule.workingHours.start}-${schedule.workingHours.end}` : 'none';
    const fh = schedule.focusHours ? `${schedule.focusHours.start}-${schedule.focusHours.end}` : 'none';
    return `- [${schedule.day}] working:${wh} | focus:${fh} | available:${schedule.available ? 'yes' : 'no'}`;
  }

  private lineToSchedule(line: string): ZavorthDaySchedule | null {
    const trimmed = line.trim();
    const match = trimmed.match(/^- \[([^\]]+)\]\s+working:([^|]+)\|\s*focus:([^|]+)\|\s*available:(yes|no)$/);
    if (!match) return null;
    const parseWindow = (raw: string): ZavorthTimeWindow | null => {
      const wm = raw.trim().match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      return wm ? { start: wm[1], end: wm[2] } : null;
    };
    return {
      day: match[1] as DayOfWeek,
      workingHours: parseWindow(match[2]),
      focusHours: parseWindow(match[3]),
      available: match[4] === 'yes',
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
    } catch (error: any) { logger.warn('[Time Automation] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
