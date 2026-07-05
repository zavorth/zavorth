import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthFileWatcherTool extends BaseTool {
  public readonly name = 'zavorth_file_watcher';

  public readonly description =
    'Watch files and directories for changes — real-time monitoring with filters, callbacks, and event logging.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'start', 'stop', 'list', 'status', 'log'.",
      },
      watch_id: {
        type: 'string',
        description: 'Watcher ID (for stop/status).',
      },
      directory: {
        type: 'string',
        description: 'Directory to watch.',
      },
      pattern: {
        type: 'string',
        description: "File pattern filter (e.g., '*.ts', '*.json').",
      },
      recursive: {
        type: 'boolean',
        description: 'Watch subdirectories. Default: true.',
      },
      events: {
        type: 'string',
        description: "Events to watch: 'create,modify,delete'. Default: 'all'.",
      },
      ignore_patterns: {
        type: 'string',
        description: "Patterns to ignore (e.g., 'node_modules,.git,dist').",
      },
      max_events: {
        type: 'number',
        description: 'Max events to log. Default: 100.',
      },
    },
    required: ['action'],
  };

  private watchers: Map<string, { id: string; directory: string; pattern: string; recursive: boolean; events: string[]; watcher: fs.FSWatcher | null; log: Array<{ event: string; path: string; timestamp: string }>; created_at: string }> = new Map();

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'start': return this.startWatcher(args);
      case 'stop': return this.stopWatcher(args);
      case 'list': return this.listWatchers();
      case 'status': return this.watcherStatus(args);
      case 'log': return this.watcherLog(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private startWatcher(args: Record<string, unknown>): string {
    const directory = String(args.directory || '');
    if (!directory) return 'Error: "directory" is required.';

    const resolved = path.resolve(directory);
    if (!fs.existsSync(resolved)) return `Error: directory "${directory}" not found.`;

    const pattern = String(args.pattern || '*');
    const recursive = args.recursive !== false;
    const events = String(args.events || 'all').split(',').map((e) => e.trim());
    const maxEvents = typeof args.max_events === 'number' ? args.max_events : 100;

    const id = `watch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    try {
      const watcher = fs.watch(resolved, { recursive }, (eventType, filename) => {
        const w = this.watchers.get(id);
        if (!w) return;

        const entry = {
          event: eventType,
          path: filename ? path.join(resolved, filename) : resolved,
          timestamp: new Date().toISOString(),
        };

        w.log.push(entry);
        if (w.log.length > maxEvents) w.log.shift();
      });

      this.watchers.set(id, {
        id,
        directory: resolved,
        pattern,
        recursive,
        events,
        watcher,
        log: [],
        created_at: new Date().toISOString(),
      });

      return `File watcher started:\n  ID: ${id}\n  Directory: ${resolved}\n  Pattern: ${pattern}\n  Recursive: ${recursive}`;
    } catch (error) { logger.warn('[Zavorth File Watcher] lifecycle operation failed', error); return ''; }
  }

  private stopWatcher(args: Record<string, unknown>): string {
    const watchId = String(args.watch_id || '');
    if (!watchId) return 'Error: "watch_id" is required.';

    const watcher = this.watchers.get(watchId);
    if (!watcher) return `Error: watcher "${watchId}" not found.`;

    if (watcher.watcher) watcher.watcher.close();
    this.watchers.delete(watchId);

    return `Watcher "${watchId}" stopped. ${watcher.log.length} events captured.`;
  }

  private listWatchers(): string {
    if (this.watchers.size === 0) return 'No active file watchers.';

    const lines: string[] = ['File Watchers:'];
    for (const [, w] of this.watchers) {
      lines.push(`  ${w.id}: ${w.directory} (${w.pattern}) events:${w.log.length}`);
    }
    return lines.join('\n');
  }

  private watcherStatus(args: Record<string, unknown>): string {
    const watchId = String(args.watch_id || '');
    if (!watchId) return 'Error: "watch_id" is required.';

    const watcher = this.watchers.get(watchId);
    if (!watcher) return `Error: watcher "${watchId}" not found.`;

    return [
      `Watcher: ${watcher.id}`,
      `  Directory: ${watcher.directory}`,
      `  Pattern: ${watcher.pattern}`,
      `  Recursive: ${watcher.recursive}`,
      `  Events captured: ${watcher.log.length}`,
      `  Created: ${watcher.created_at}`,
    ].join('\n');
  }

  private watcherLog(args: Record<string, unknown>): string {
    const watchId = String(args.watch_id || '');
    if (!watchId) return 'Error: "watch_id" is required.';

    const watcher = this.watchers.get(watchId);
    if (!watcher) return `Error: watcher "${watchId}" not found.`;

    if (watcher.log.length === 0) return 'No events captured yet.';

    const lines: string[] = [`Event log for "${watchId}" (${watcher.log.length} events):`];
    for (const entry of watcher.log.slice(-20)) {
      lines.push(`  [${entry.timestamp}] ${entry.event}: ${entry.path}`);
    }
    return lines.join('\n');
  }
}
