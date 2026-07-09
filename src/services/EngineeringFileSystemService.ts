import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';

type EngineeringFileSystemOptions = {
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
  statSync?: typeof fs.statSync;
  existsSync?: typeof fs.existsSync;
};

export class EngineeringFileSystemService {
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly statSync: typeof fs.statSync;
  private readonly existsSync: typeof fs.existsSync;

  constructor(options: EngineeringFileSystemOptions = {}) {
    this.readdirSync = options.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.statSync = options.statSync || fs.statSync.bind(fs);
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
  }

  public listTree(rootPath: string, maxDepth: number = 2, limit: number = 60): string[] {
    const normalizedRoot = path.resolve(rootPath);
    const lines: string[] = [];
    this.walk(normalizedRoot, 0, maxDepth, limit, lines, normalizedRoot);
    return lines;
  }

  public readFile(filePath: string, maxBytes: number = 64 * 1024): string {
    const normalizedPath = path.resolve(filePath);
    const raw = this.readFileSync(normalizedPath, 'utf8');
    return raw.length > maxBytes ? `${raw.slice(0, maxBytes)}\n...[truncated]` : raw;
  }

  public readExcerpt(filePath: string, startLine: number = 1, endLine: number = 80): string {
    const content = this.readFile(filePath, 256 * 1024);
    const lines = content.split(/\r?\n/);
    const start = Math.max(1, startLine);
    const end = Math.max(start, endLine);
    return lines
      .slice(start - 1, end)
      .map((line, index) => `${start + index}: ${line}`)
      .join('\n');
  }

  public searchFiles(rootPath: string, query: string, limit: number = 20): string[] {
    const normalizedRoot = path.resolve(rootPath);
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const matches: string[] = [];
    const queue = [normalizedRoot];
    while (queue.length > 0 && matches.length < limit) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      let entries: fs.Dirent[] = [];
      try {
        entries = this.readdirSync(current, { withFileTypes: true });
      } catch (error: unknown) {continue;
      }

      for (const entry of entries) {
        if (this.shouldIgnore(entry.name)) {
          continue;
        }
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) {
          queue.push(absolute);
          continue;
        }
        if (absolute.toLowerCase().includes(normalizedQuery)) {
          matches.push(absolute.replace(/\\/g, '/'));
          if (matches.length >= limit) {
            break;
          }
          continue;
        }
        try {
          const content = this.readFileSync(absolute, 'utf8');
          if (content.toLowerCase().includes(normalizedQuery)) {
            matches.push(absolute.replace(/\\/g, '/'));
            if (matches.length >= limit) {
              break;
            }
          }
        } catch (error: unknown) {continue;
        }
      }
    }

    return matches;
  }

  public inspectChanges(rootPath: string, limit: number = 20): Array<{ path: string; modifiedAt: string; sizeBytes: number }> {
    const normalizedRoot = path.resolve(rootPath);
    const queue = [normalizedRoot];
    const files: Array<{ path: string; modifiedAt: string; sizeBytes: number }> = [];

    while (queue.length > 0 && files.length < limit * 5) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      let entries: fs.Dirent[] = [];
      try {
        entries = this.readdirSync(current, { withFileTypes: true });
      } catch (error: unknown) {continue;
      }

      for (const entry of entries) {
        if (this.shouldIgnore(entry.name)) {
          continue;
        }
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) {
          queue.push(absolute);
          continue;
        }
        try {
          const stat = this.statSync(absolute);
          files.push({
            path: absolute.replace(/\\/g, '/'),
            modifiedAt: stat.mtime.toISOString(),
            sizeBytes: stat.size,
          });
        } catch (error: unknown) {continue;
        }
      }
    }

    return files
      .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
      .slice(0, limit);
  }

  public compareFiles(leftPath: string, rightPath: string): {
    same: boolean;
    leftPath: string;
    rightPath: string;
    leftSize: number;
    rightSize: number;
  } {
    const normalizedLeft = path.resolve(leftPath);
    const normalizedRight = path.resolve(rightPath);
    const leftContent = this.existsSync(normalizedLeft) ? this.readFileSync(normalizedLeft, 'utf8') : '';
    const rightContent = this.existsSync(normalizedRight) ? this.readFileSync(normalizedRight, 'utf8') : '';

    return {
      same: leftContent === rightContent,
      leftPath: normalizedLeft.replace(/\\/g, '/'),
      rightPath: normalizedRight.replace(/\\/g, '/'),
      leftSize: leftContent.length,
      rightSize: rightContent.length,
    };
  }

  private walk(
    currentPath: string,
    depth: number,
    maxDepth: number,
    limit: number,
    lines: string[],
    rootPath: string,
  ): void {
    if (depth > maxDepth || lines.length >= limit) {
      return;
    }

    let entries: fs.Dirent[] = [];
    try {
      entries = this.readdirSync(currentPath, { withFileTypes: true });
    } catch (error: unknown) {logger.warn('[Engineering File System] filesystem operation failed', error);
    return;
  }

    for (const entry of entries) {
      if (this.shouldIgnore(entry.name) || lines.length >= limit) {
        continue;
      }
      const absolute = path.join(currentPath, entry.name);
      const relative = path.relative(rootPath, absolute).replace(/\\/g, '/');
      lines.push(relative || '.');
      if (entry.isDirectory()) {
        this.walk(absolute, depth + 1, maxDepth, limit, lines, rootPath);
      }
    }
  }

  private shouldIgnore(name: string): boolean {
    return ['.git', 'node_modules', 'dist', 'coverage', '.next'].includes(String(name || '').trim());
  }
}
