import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthLearningStyle,
  ZavorthLearningPreferences,
} from '../contracts/LearningStyleContract.js';

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type LearningStyleServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

const DEFAULT_LEARNING_STYLE = `# LEARNING-STYLE.md - Learning Preferences

## Preferences

- **Primary style:** examples-first
- **Depth preference:** moderate
- **Documentation preference:** mixed
- **Hands-on preference:** mixed
`;

const DEFAULT_PREFERENCES: ZavorthLearningPreferences = {
  schemaVersion: 'zavorth.learning-preferences/v1',
  primaryStyle: 'examples-first',
  depthPreference: 'moderate',
  documentationPreference: 'mixed',
  handsOnPreference: 'mixed',
  updatedAt: '',
};

export class LearningStyleService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: LearningStyleServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): { configured: boolean; primaryStyle: ZavorthLearningStyle; filePath: string } {
    const prefs = this.getPreferences();
    return {
      configured: prefs.primaryStyle !== DEFAULT_PREFERENCES.primaryStyle || prefs.depthPreference !== DEFAULT_PREFERENCES.depthPreference,
      primaryStyle: prefs.primaryStyle,
      filePath: this.resolveFile(),
    };
  }

  public setPreferences(prefs: Partial<Omit<ZavorthLearningPreferences, 'schemaVersion' | 'updatedAt'>>): ZavorthLearningPreferences {
    const filePath = this.resolveFile();
    let content = this.readText(filePath, DEFAULT_LEARNING_STYLE);
    if (prefs.primaryStyle) content = this.upsertMarkdownField(content, 'Primary style', prefs.primaryStyle);
    if (prefs.depthPreference) content = this.upsertMarkdownField(content, 'Depth preference', prefs.depthPreference);
    if (prefs.documentationPreference) content = this.upsertMarkdownField(content, 'Documentation preference', prefs.documentationPreference);
    if (prefs.handsOnPreference) content = this.upsertMarkdownField(content, 'Hands-on preference', prefs.handsOnPreference);
    this.writeText(filePath, content);
    return this.getPreferences();
  }

  public getPreferences(): ZavorthLearningPreferences {
    const content = this.readText(this.resolveFile(), DEFAULT_LEARNING_STYLE);
    return {
      schemaVersion: 'zavorth.learning-preferences/v1',
      primaryStyle: (this.readMarkdownField(content, 'Primary style') as ZavorthLearningStyle) || DEFAULT_PREFERENCES.primaryStyle,
      depthPreference: (this.readMarkdownField(content, 'Depth preference') as ZavorthLearningPreferences['depthPreference']) || DEFAULT_PREFERENCES.depthPreference,
      documentationPreference: (this.readMarkdownField(content, 'Documentation preference') as ZavorthLearningPreferences['documentationPreference']) || DEFAULT_PREFERENCES.documentationPreference,
      handsOnPreference: (this.readMarkdownField(content, 'Hands-on preference') as ZavorthLearningPreferences['handsOnPreference']) || DEFAULT_PREFERENCES.handsOnPreference,
      updatedAt: new Date().toISOString(),
    };
  }

  public getLearningHint(): string {
    const prefs = this.getPreferences();
    const styleHints: Record<ZavorthLearningStyle, string> = {
      'examples-first': 'Lead with concrete examples before explaining theory',
      'theory-first': 'Explain the concept fully before showing examples',
      'hands-on': 'Provide interactive exercises and let the user try immediately',
      visual: 'Use diagrams, flowcharts, and visual representations',
      'step-by-step': 'Break everything into numbered sequential steps',
    };
    const parts: string[] = [styleHints[prefs.primaryStyle]];
    parts.push(`Depth: ${prefs.depthPreference}`);
    if (prefs.handsOnPreference === 'try-first') parts.push('Let user try before reading docs');
    else if (prefs.handsOnPreference === 'read-first') parts.push('Read documentation before attempting');
    return parts.join(' | ');
  }

  private resolveFile(): string {
    return path.join(this.projectRoot, 'LEARNING-STYLE.md');
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
    } catch (error: unknown) {logger.warn('[Learning Style] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, `${content.trimEnd()}\n`, 'utf8');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
