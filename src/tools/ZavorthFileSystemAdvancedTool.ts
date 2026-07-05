import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../logger.js';

export class ZavorthFileSystemAdvancedTool extends BaseTool {
  public readonly name = 'zavorth_file_system_advanced';

  public readonly description =
    'Advanced file operations — watch files for changes, compress/extract archives (zip, tar, gz), batch rename, deduplicate files, sync directories, checksum, file search with content, and disk usage analysis.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'watch', 'compress', 'extract', 'batch_rename', 'dedup', 'sync', 'checksum', 'search_content', 'disk_usage', 'find_large', 'find_empty', 'chmod', 'touch'.",
      },
      source_path: {
        type: 'string',
        description: 'Source file or directory path.',
      },
      target_path: {
        type: 'string',
        description: 'Target file or directory path.',
      },
      pattern: {
        type: 'string',
        description: 'Glob pattern for file matching.',
      },
      search_text: {
        type: 'string',
        description: 'Text to search within files.',
      },
      rename_pattern: {
        type: 'string',
        description: "Rename pattern with placeholders: {name}, {ext}, {n}, {date}.",
      },
      archive_format: {
        type: 'string',
        description: "Archive format: 'zip', 'tar', 'tar.gz', 'tar.bz2'.",
      },
      recursive: {
        type: 'boolean',
        description: 'Recursive operation. Default: true.',
      },
      exclude_pattern: {
        type: 'string',
        description: "Exclude pattern (e.g., 'node_modules,.git,dist').",
      },
      file_extension: {
        type: 'string',
        description: 'File extension filter (e.g., ".ts", ".py").',
      },
      min_size: {
        type: 'string',
        description: "Minimum file size (e.g., '10MB', '1GB').",
      },
      max_results: {
        type: 'number',
        description: 'Maximum results to return. Default: 100.',
      },
      watch_duration_ms: {
        type: 'number',
        description: 'How long to watch in milliseconds. Default: 30000.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'watch': return await this.watch(args);
      case 'compress': return await this.compress(args);
      case 'extract': return await this.extract(args);
      case 'batch_rename': return await this.batchRename(args);
      case 'dedup': return await this.dedup(args);
      case 'sync': return await this.sync(args);
      case 'checksum': return await this.checksum(args);
      case 'search_content': return await this.searchContent(args);
      case 'disk_usage': return await this.diskUsage(args);
      case 'find_large': return await this.findLarge(args);
      case 'find_empty': return await this.findEmpty(args);
      case 'chmod': return await this.chmod(args);
      case 'touch': return await this.touch(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async watch(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '');
    if (!sourcePath) return 'Error: "source_path" is required.';

    const duration = Number(args.watch_duration_ms || 30000);
    const pattern = String(args.pattern || '*');

    try {
      if (!fs.existsSync(sourcePath)) return `Error: Path ${sourcePath} does not exist.`;

      const events: string[] = [];
      const watcher = fs.watch(sourcePath, { recursive: args.recursive !== false }, (eventType, filename) => {
        events.push(`[${new Date().toISOString()}] ${eventType}: ${filename}`);
        if (events.length > 500) events.shift();
      });

      await new Promise(resolve => setTimeout(resolve, Math.min(duration, 60000)));
      watcher.close();

      return [
        `Watched ${sourcePath} for ${duration}ms`,
        `Events captured: ${events.length}`,
        '',
        ...events.slice(0, 50),
        events.length > 50 ? `... and ${events.length - 50} more` : '',
      ].filter(Boolean).join('\n');
    } catch (error) { logger.warn('[Zavorth File System Advanced] resource cleanup failed', error); return ''; }
  }

  private async compress(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '');
    const targetPath = String(args.target_path || `${sourcePath}.zip`);
    const format = String(args.archive_format || 'zip');
    if (!sourcePath) return 'Error: "source_path" is required.';

    try {
      const { execFileSync } = await import('child_process');

      if (format === 'zip' || targetPath.endsWith('.zip')) {
        if (process.platform === 'win32') {
          execFileSync('powershell', ['-Command', `Compress-Archive -Path '${sourcePath}' -DestinationPath '${targetPath}' -Force`], { timeout: 120000 });
        } else {
          execFileSync('zip', ['-r', targetPath, sourcePath], { timeout: 120000 });
        }
      } else if (format === 'tar.gz' || targetPath.endsWith('.tar.gz')) {
        execFileSync('tar', ['-czf', targetPath, sourcePath], { timeout: 120000 });
      } else if (format === 'tar.bz2' || targetPath.endsWith('.tar.bz2')) {
        execFileSync('tar', ['-cjf', targetPath, sourcePath], { timeout: 120000 });
      } else {
        execFileSync('tar', ['-cf', targetPath, sourcePath], { timeout: 120000 });
      }

      const stats = fs.statSync(targetPath);
      return `Compressed ${sourcePath} → ${targetPath} (${(stats.size / 1024).toFixed(1)} KB)`;
    } catch (error) { logger.warn('[Zavorth File System Advanced] filesystem operation failed', error); return ''; }
  }

  private async extract(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '');
    const targetPath = String(args.target_path || path.dirname(sourcePath));
    if (!sourcePath) return 'Error: "source_path" is required.';

    try {
      const { execFileSync } = await import('child_process');

      if (sourcePath.endsWith('.zip')) {
        if (process.platform === 'win32') {
          execFileSync('powershell', ['-Command', `Expand-Archive -Path '${sourcePath}' -DestinationPath '${targetPath}' -Force`], { timeout: 120000 });
        } else {
          execFileSync('unzip', ['-o', sourcePath, '-d', targetPath], { timeout: 120000 });
        }
      } else if (sourcePath.endsWith('.tar.gz') || sourcePath.endsWith('.tgz')) {
        execFileSync('tar', ['-xzf', sourcePath, '-C', targetPath], { timeout: 120000 });
      } else if (sourcePath.endsWith('.tar.bz2')) {
        execFileSync('tar', ['-xjf', sourcePath, '-C', targetPath], { timeout: 120000 });
      } else if (sourcePath.endsWith('.tar')) {
        execFileSync('tar', ['-xf', sourcePath, '-C', targetPath], { timeout: 120000 });
      } else {
        return `Error: Unsupported archive format for ${sourcePath}`;
      }

      return `Extracted ${sourcePath} → ${targetPath}`;
    } catch (error) { logger.warn('[Zavorth File System Advanced] process execution failed', error); return ''; }
  }

  private async batchRename(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '');
    const pattern = String(args.rename_pattern || '');
    if (!sourcePath || !pattern) return 'Error: "source_path" and "rename_pattern" are required.';

    try {
      if (!fs.existsSync(sourcePath)) return `Error: ${sourcePath} does not exist.`;

      const files = fs.readdirSync(sourcePath).filter(f => {
        const stat = fs.statSync(path.join(sourcePath, f));
        return stat.isFile();
      });

      const ext = String(args.file_extension || '');
      const filtered = ext ? files.filter(f => f.endsWith(ext)) : files;
      const results: string[] = [];
      const date = new Date().toISOString().slice(0, 10);

      filtered.forEach((file, i) => {
        const parsed = path.parse(file);
        let newName = pattern
          .replace('{name}', parsed.name)
          .replace('{ext}', parsed.ext)
          .replace('{n}', String(i + 1).padStart(3, '0'))
          .replace('{date}', date);

        if (!path.extname(newName)) newName += parsed.ext;

        const oldPath = path.join(sourcePath, file);
        const newPath = path.join(sourcePath, newName);

        if (oldPath !== newPath) {
          fs.renameSync(oldPath, newPath);
          results.push(`  ${file} → ${newName}`);
        }
      });

      return `Batch rename (${results.length} files):\n${results.join('\n').slice(0, 3000)}`;
    } catch (error) { logger.warn('[Zavorth File System Advanced] parsing failed', error); return ''; }
  }

  private async dedup(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '');
    if (!sourcePath) return 'Error: "source_path" is required.';

    try {
      const crypto = await import('crypto');
      if (!fs.existsSync(sourcePath)) return `Error: ${sourcePath} does not exist.`;

      const files = fs.readdirSync(sourcePath, { recursive: args.recursive !== false })
        .filter(f => {
          const fullPath = path.join(sourcePath, String(f));
          try { return fs.statSync(fullPath).isFile(); } catch (error) { logger.warn('[Zavorth File System Advanced] filesystem operation failed', error); return false; }
        });

      const hashMap = new Map<string, string[]>();
      for (const file of files) {
        const fullPath = path.join(sourcePath, String(file));
        try {
          const content = fs.readFileSync(fullPath);
          const hash = crypto.createHash('md5').update(content).digest('hex');
          const existing = hashMap.get(hash) || [];
          existing.push(fullPath);
          hashMap.set(hash, existing);
        } catch (error) { /* skip unreadable files */ logger.warn('[Zavorth File System Advanced] filesystem operation failed', error); }
      }

      const duplicates: string[][] = [];
      for (const [, paths] of hashMap) {
        if (paths.length > 1) duplicates.push(paths);
      }

      if (duplicates.length === 0) return 'No duplicates found.';

      return [
        `Found ${duplicates.length} duplicate groups:`,
        ...duplicates.map(group => `  ${group.join('\n    ')}`),
      ].join('\n').slice(0, 5000);
    } catch (error) { logger.warn('[Zavorth File System Advanced] operation failed', error); return ''; }
  }

  private async sync(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '');
    const targetPath = String(args.target_path || '');
    if (!sourcePath || !targetPath) return 'Error: "source_path" and "target_path" are required.';

    try {
      const { execFileSync } = await import('child_process');

      if (process.platform === 'win32') {
        const excludeArgs = args.exclude_pattern
          ? String(args.exclude_pattern).split(',').map(p => `/XD ${p.trim()}`).join(' ')
          : '';
        const cmd = `robocopy "${sourcePath}" "${targetPath}" /MIR ${excludeArgs}`;
        try {
          execFileSync('robocopy', [sourcePath, targetPath, '/MIR'], { timeout: 300000 });
        } catch (error) { // robocopy returns non-zero on success sometimes logger.warn('[Zavorth File System Advanced] process execution failed', error); }
        return `Synced ${sourcePath} → ${targetPath} (robocopy /MIR)`;
      } else {
        const rsyncArgs = ['-avz', '--delete', sourcePath + '/', targetPath + '/'];
        if (args.exclude_pattern) {
          for (const pattern of String(args.exclude_pattern).split(',')) {
            rsyncArgs.push('--exclude', pattern.trim());
          }
        }
        const result = execFileSync('rsync', rsyncArgs, { timeout: 300000 }).toString();
        return `Synced ${sourcePath} → ${targetPath}:\n${result.trim().slice(0, 2000)}`;
      }
    } catch (error) { logger.warn('[Zavorth File System Advanced] process execution failed', error); return ''; }
  }

  private async checksum(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '');
    if (!sourcePath) return 'Error: "source_path" is required.';

    try {
      const crypto = await import('crypto');
      if (!fs.existsSync(sourcePath)) return `Error: ${sourcePath} does not exist.`;

      const stat = fs.statSync(sourcePath);
      if (stat.isDirectory()) {
        const files = fs.readdirSync(sourcePath)
          .filter(f => fs.statSync(path.join(sourcePath, f)).isFile())
          .slice(0, 100);

        const results = files.map(f => {
          const content = fs.readFileSync(path.join(sourcePath, f));
          const md5 = crypto.createHash('md5').update(content).digest('hex');
          const sha256 = crypto.createHash('sha256').update(content).digest('hex');
          return `  ${f}:\n    MD5: ${md5}\n    SHA256: ${sha256}`;
        });

        return `Checksums for ${sourcePath} (${files.length} files):\n${results.join('\n')}`;
      }

      const content = fs.readFileSync(sourcePath);
      const md5 = crypto.createHash('md5').update(content).digest('hex');
      const sha1 = crypto.createHash('sha1').update(content).digest('hex');
      const sha256 = crypto.createHash('sha256').update(content).digest('hex');

      return [
        `Checksums for ${sourcePath}:`,
        `  MD5: ${md5}`,
        `  SHA1: ${sha1}`,
        `  SHA256: ${sha256}`,
      ].join('\n');
    } catch (error) { logger.warn('[Zavorth File System Advanced] creation failed', error); return ''; }
  }

  private async searchContent(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '');
    const searchText = String(args.search_text || '');
    if (!sourcePath || !searchText) return 'Error: "source_path" and "search_text" are required.';

    try {
      const { execFileSync } = await import('child_process');
      const maxResults = Number(args.max_results || 100);

      if (process.platform === 'win32') {
        const result = execFileSync('findstr', ['/S', '/I', '/N', searchText, path.join(sourcePath, '*')], {
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024,
        }).toString();
        return `Content search results:\n${result.trim().slice(0, 5000)}`;
      } else {
        const result = execFileSync('grep', ['-r', '-n', '-i', searchText, sourcePath], {
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024,
        }).toString();
        return `Content search results:\n${result.trim().slice(0, 5000)}`;
      }
    } catch (error) { logger.warn('[Zavorth File System Advanced] process execution failed', error); return ''; }
  }

  private async diskUsage(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '.');

    try {
      const { execFileSync } = await import('child_process');

      if (process.platform === 'win32') {
        const result = execFileSync('powershell', ['-Command', `Get-ChildItem -Path '${sourcePath}' -Directory | ForEach-Object { $size = (Get-ChildItem -Path $_.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum; "$([math]::Round($size/1MB, 2)) MB - $($_.Name)" } | Sort-Object -Descending`], { timeout: 60000 }).toString();
        return `Disk usage for ${sourcePath}:\n${result.trim()}`;
      } else {
        const result = execFileSync('du', ['-sh', sourcePath], { timeout: 30000 }).toString();
        return `Disk usage:\n${result.trim()}`;
      }
    } catch (error) { logger.warn('[Zavorth File System Advanced] process execution failed', error); return ''; }
  }

  private async findLarge(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '.');
    const minSize = String(args.min_size || '10MB');

    try {
      const { execFileSync } = await import('child_process');

      if (process.platform === 'win32') {
        const result = execFileSync('powershell', ['-Command', `Get-ChildItem -Path '${sourcePath}' -Recurse -File | Where-Object { $_.Length -gt ${this.parseSize(minSize)} } | Sort-Object Length -Descending | Select-Object -First ${Number(args.max_results || 20)} | ForEach-Object { "$([math]::Round($_.Length/1MB, 2)) MB - $($_.FullName)" }`], { timeout: 60000 }).toString();
        return `Large files (>${minSize}):\n${result.trim()}`;
      } else {
        const result = execFileSync('find', [sourcePath, '-type', 'f', '-size', `+${minSize}`, '-exec', 'ls', '-lh', '{}', ';'], { timeout: 30000 }).toString();
        return `Large files:\n${result.trim().slice(0, 3000)}`;
      }
    } catch (error) { logger.warn('[Zavorth File System Advanced] process execution failed', error); return ''; }
  }

  private parseSize(size: string): number {
    const match = size.match(/^(\d+)(KB|MB|GB)$/i);
    if (!match) return 10 * 1024 * 1024;
    const num = safeParseInt(match[1], 0);
    switch (match[2].toUpperCase()) {
      case 'KB': return num * 1024;
      case 'MB': return num * 1024 * 1024;
      case 'GB': return num * 1024 * 1024 * 1024;
      default: return num;
    }
  }

  private async findEmpty(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '.');

    try {
      const { execFileSync } = await import('child_process');

      if (process.platform === 'win32') {
        const result = execFileSync('powershell', ['-Command', `Get-ChildItem -Path '${sourcePath}' -Recurse -File | Where-Object { $_.Length -eq 0 } | Select-Object -First 100 | ForEach-Object { $_.FullName }`], { timeout: 30000 }).toString();
        return `Empty files:\n${result.trim() || 'None found'}`;
      } else {
        const result = execFileSync('find', [sourcePath, '-type', 'f', '-empty'], { timeout: 30000 }).toString();
        return `Empty files:\n${result.trim() || 'None found'}`;
      }
    } catch (error) { logger.warn('[Zavorth File System Advanced] process execution failed', error); return ''; }
  }

  private async chmod(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '');
    const pattern = String(args.pattern || '755');
    if (!sourcePath) return 'Error: "source_path" is required.';

    try {
      const { execFileSync } = await import('child_process');
      execFileSync('chmod', ['-R', pattern, sourcePath], { timeout: 15000 });
      return `Changed permissions of ${sourcePath} to ${pattern}`;
    } catch (error) { logger.warn('[Zavorth File System Advanced] process execution failed', error); return ''; }
  }

  private async touch(args: Record<string, unknown>): Promise<string> {
    const sourcePath = String(args.source_path || '');
    if (!sourcePath) return 'Error: "source_path" is required.';

    try {
      if (!fs.existsSync(sourcePath)) {
        fs.writeFileSync(sourcePath, '');
        return `Created file: ${sourcePath}`;
      }
      const now = new Date();
      fs.utimesSync(sourcePath, now, now);
      return `Updated timestamp: ${sourcePath}`;
    } catch (error) { logger.warn('[Zavorth File System Advanced] filesystem operation failed', error); return ''; }
  }
}
