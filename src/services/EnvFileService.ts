import fs from 'fs';
import path from 'path';

export type EnvFileEntry = {
  key: string;
  value: string;
  overwrite?: boolean;
};

export type EnvFileWriteReport = {
  filePath: string;
  writtenKeys: string[];
  preservedKeys: string[];
  created: boolean;
};

export type EnvFileRemoveReport = {
  filePath: string;
  removedKeys: string[];
  missingKeys: string[];
};

type EnvFileServiceOptions = {
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

export class EnvFileService {
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;

  constructor(options: EnvFileServiceOptions = {}) {
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = options.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = options.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public readMap(filePath: string): Record<string, string> {
    const targetPath = path.resolve(filePath);
    if (!this.existsSync(targetPath)) {
      return {};
    }

    const content = String(this.readFileSync(targetPath, 'utf8') || '');
    const result: Record<string, string> = {};
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
      if (!match) {
        continue;
      }
      result[match[1]] = match[2] || '';
    }
    return result;
  }

  public upsertEntries(filePath: string, entries: EnvFileEntry[]): EnvFileWriteReport {
    const targetPath = path.resolve(filePath);
    const parentDir = path.dirname(targetPath);
    const created = !this.existsSync(targetPath);
    const currentLines = created
      ? [] as string[]
      : String(this.readFileSync(targetPath, 'utf8') || '').split(/\r?\n/);
    const currentMap = this.readMap(targetPath);
    const lineIndexByKey = new Map<string, number>();

    currentLines.forEach((line, index) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
      if (match) {
        lineIndexByKey.set(match[1], index);
      }
    });

    const writtenKeys: string[] = [];
    const preservedKeys: string[] = [];

    for (const entry of entries) {
      const key = String(entry.key || '').trim();
      if (!key) {
        continue;
      }

      const currentValue = Object.prototype.hasOwnProperty.call(currentMap, key)
        ? String(currentMap[key] || '')
        : null;
      const shouldOverwrite = entry.overwrite === true || currentValue === null || currentValue === '';
      if (!shouldOverwrite && currentValue !== null) {
        preservedKeys.push(key);
        continue;
      }

      const rendered = `${key}=${this.renderValue(entry.value)}`;
      const existingIndex = lineIndexByKey.get(key);
      if (typeof existingIndex === 'number') {
        currentLines[existingIndex] = rendered;
      } else {
        if (currentLines.length > 0 && String(currentLines[currentLines.length - 1] || '').trim()) {
          currentLines.push('');
        }
        currentLines.push(rendered);
      }
      currentMap[key] = String(entry.value || '');
      writtenKeys.push(key);
    }

    this.mkdirSync(parentDir, { recursive: true });
    const finalContent = currentLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    this.writeFileSync(targetPath, finalContent, 'utf8');

    return {
      filePath: targetPath,
      writtenKeys,
      preservedKeys,
      created,
    };
  }

  public removeEntries(filePath: string, keys: string[]): EnvFileRemoveReport {
    const targetPath = path.resolve(filePath);
    if (!this.existsSync(targetPath)) {
      return { filePath: targetPath, removedKeys: [], missingKeys: keys };
    }

    const wanted = new Set(keys.map((key) => String(key).trim().toUpperCase()).filter(Boolean));
    const currentLines = String(this.readFileSync(targetPath, 'utf8') || '').split(/\r?\n/);
    const remaining: string[] = [];
    const removedKeys: string[] = [];
    const missingKeys: string[] = Array.from(wanted);

    for (const line of currentLines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
      if (match && wanted.has(match[1])) {
        removedKeys.push(match[1]);
        const index = missingKeys.indexOf(match[1]);
        if (index >= 0) {
          missingKeys.splice(index, 1);
        }
        continue;
      }
      remaining.push(line);
    }

    if (removedKeys.length > 0) {
      const finalContent = remaining.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
      this.writeFileSync(targetPath, finalContent, 'utf8');
    }

    return { filePath: targetPath, removedKeys, missingKeys };
  }

  private renderValue(value: string): string {
    const normalized = String(value || '');
    return normalized.replace(/\r?\n/g, ' ').trim();
  }
}
