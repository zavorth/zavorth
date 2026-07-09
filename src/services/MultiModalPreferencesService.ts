import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthModality,
  ZavorthModalityPreference,
} from '../contracts/MultiModalPreferencesContract.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type MultiModalPreferencesServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

const DEFAULT_MULTI_MODAL = `# MULTI-MODAL.md - Multi-Modal Preferences

## Preferences

<!-- Managed by MultiModalPreferencesService. Each entry: - [modality] enabled:yes/no | whenToUse:description -->

`;

export class MultiModalPreferencesService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: MultiModalPreferencesServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): { preferenceCount: number; enabledCount: number; filePath: string } {
    const preferences = this.listPreferences();
    return {
      preferenceCount: preferences.length,
      enabledCount: preferences.filter((p) => p.enabled).length,
      filePath: this.resolveFile(),
    };
  }

  public setPreference(modality: ZavorthModality, preference: Omit<ZavorthModalityPreference, 'modality' | 'addedAt'>): ZavorthModalityPreference {
    const full: ZavorthModalityPreference = { ...preference, modality, addedAt: new Date().toISOString() };
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_MULTI_MODAL);
    const sectionContent = this.readSection(content, 'Preferences');
    const existing = sectionContent.split(/\r?\n/).filter((l) => !l.includes(`[${modality}]`));
    existing.push(this.preferenceToLine(full));
    const updated = this.upsertSection(content, 'Preferences', existing.join('\n'));
    this.writeText(filePath, updated);
    return full;
  }

  public getPreference(modality: ZavorthModality): ZavorthModalityPreference | null {
    return this.listPreferences().find((p) => p.modality === modality) || null;
  }

  public listPreferences(): ZavorthModalityPreference[] {
    const filePath = this.resolveFile();
    const content = this.readText(filePath, DEFAULT_MULTI_MODAL);
    const sectionContent = this.readSection(content, 'Preferences');
    const preferences: ZavorthModalityPreference[] = [];
    for (const line of sectionContent.split(/\r?\n/)) {
      const pref = this.lineToPreference(line);
      if (pref) preferences.push(pref);
    }
    return preferences;
  }

  public getModalityHint(context: string): string {
    const preferences = this.listPreferences().filter((p) => p.enabled);
    if (preferences.length === 0) return '';
    const lower = context.toLowerCase();
    const codeKeywords = ['code', 'function', 'class', 'api', 'component', 'script'];
    const imageKeywords = ['image', 'diagram', 'chart', 'visual', 'graph', 'illustration'];
    const tableKeywords = ['table', 'data', 'comparison', 'matrix', 'spreadsheet'];
    const voiceKeywords = ['audio', 'voice', 'speak', 'listen', 'podcast'];
    let modality: ZavorthModality = 'text';
    if (codeKeywords.some((k) => lower.includes(k))) modality = 'code';
    else if (imageKeywords.some((k) => lower.includes(k))) modality = 'diagram';
    else if (tableKeywords.some((k) => lower.includes(k))) modality = 'table';
    else if (voiceKeywords.some((k) => lower.includes(k))) modality = 'voice';
    const match = preferences.find((p) => p.modality === modality);
    if (match) return `${match.modality}: ${match.whenToUse}`;
    return '';
  }

  private resolveFile(): string {
    return path.join(this.projectRoot, 'MULTI-MODAL.md');
  }

  private preferenceToLine(pref: ZavorthModalityPreference): string {
    return `- [${pref.modality}] enabled:${pref.enabled ? 'yes' : 'no'} | ${pref.whenToUse}`;
  }

  private lineToPreference(line: string): ZavorthModalityPreference | null {
    const trimmed = line.trim();
    const match = trimmed.match(/^- \[([^\]]+)\]\s+enabled:(yes|no)\s*\|\s*(.+)$/);
    if (!match) return null;
    return {
      modality: match[1] as ZavorthModality,
      enabled: match[2] === 'yes',
      whenToUse: match[3].trim(),
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
    } catch (error: any) { logger.warn('[Multi Modal Preferences] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
