
import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type QueryMode = 'read' | 'write';

export class DatabaseQueryTool extends BaseTool {
  public readonly name = 'database_query';

  public readonly description =
    'Executes queries against local SQLite databases.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'SQL query to execute.',
      },
      database_path: {
        type: 'string',
        description: 'Path to the SQLite database file. Default: data/runtime/zavorth.db.',
      },
      mode: {
        type: 'string',
        description: "Execution mode: 'read' (SELECT only), 'write' (INSERT/UPDATE/DELETE). Default: 'read'.",
      },
      max_rows: {
        type: 'number',
        description: 'Maximum number of returned rows (1-1000). Default: 100.',
      },
    },
    required: ['query'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const query = String(args.query || '');
    if (!query) return 'Error: the "query" parameter is required.';

    const mode = String(args.mode || 'read') as QueryMode;
    if (mode !== 'read' && mode !== 'write') {
      return `Error: invalid mode "${mode}" is invalid. Use 'read' or 'write'.`;
    }

    const maxRows = typeof args.max_rows === 'number' ? Math.min(Math.max(args.max_rows, 1), 1000) : 100;
    const rawDbPath = typeof args.database_path === 'string'
      ? args.database_path
      : path.join(process.cwd(), 'data', 'runtime', 'zavorth.db');

    // Restrict database_path to data/ directory inside workspace root
    const resolvedDbPath = path.resolve(rawDbPath);
    const allowedRoot = path.resolve(process.cwd(), 'data');
    const relative = path.relative(allowedRoot, resolvedDbPath);
    const isContained = !relative.startsWith('..') && !path.isAbsolute(relative);
    if (!isContained && resolvedDbPath !== allowedRoot) {
      return `Error: database path "${rawDbPath}" is outside the allowed Zavorth data root (${allowedRoot}).`;
    }

    const dbPath = resolvedDbPath;
    const normalizedQuery = query.trim().toUpperCase();

    if (mode === 'read') {
      if (!normalizedQuery.startsWith('SELECT') && !normalizedQuery.startsWith('PRAGMA') && !normalizedQuery.startsWith('EXPLAIN')) {
        return 'Error: invalid mode "read" allows only SELECT, PRAGMA, and EXPLAIN. Use mode="write" for write operations.';
      }
      // Remove mutable PRAGMA from read mode
      if (normalizedQuery.startsWith('PRAGMA') && normalizedQuery.includes('=')) {
        return 'Error: mutable configuration through PRAGMA is not allowed in "read" mode.';
      }
    }

    if (mode === 'write') {
      const isDestructive = normalizedQuery.startsWith('DROP') || normalizedQuery.startsWith('TRUNCATE');
      if (isDestructive) {
        return 'Error: DROP and TRUNCATE operations are not allowed. Remove data manually if necessary.';
      }
      if (!normalizedQuery.startsWith('INSERT') && !normalizedQuery.startsWith('UPDATE') && !normalizedQuery.startsWith('DELETE') && !normalizedQuery.startsWith('CREATE') && !normalizedQuery.startsWith('ALTER')) {
        return 'Error: invalid mode "write" allows INSERT, UPDATE, DELETE, CREATE, and ALTER.';
      }
    }

    try {
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      let sqlite3: { default: (dbPath: string, opts?: { readonly?: boolean }) => { prepare(query: string): { all(): unknown[]; run(): { changes: number; lastInsertRowid?: unknown } }; close(): void } };
      try {
        sqlite3 = await import('better-sqlite3');
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn('[Database Query] filesystem operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
        return `Error: real better-sqlite3 SQLite driver unavailable. Install native dependencies before running database_query. Detail: ${message}`;
  }

      const db = sqlite3.default(dbPath, { readonly: mode === 'read' });

      try {
        if (mode === 'read') {
          const rows = db.prepare(query).all();
           const limited = rows.slice(0, maxRows);
           return this.formatReadResult(limited as Record<string, unknown>[], rows.length, maxRows, dbPath);
        } else {
          const result = db.prepare(query).run();
          return this.formatWriteResult(result, dbPath);
        }
      } finally {
        db.close();
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Database Query] resource cleanup failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Failed to run query: ${message}`;
  }
  }

  private formatReadResult(rows: Record<string, unknown>[], totalRows: number, maxRows: number, dbPath: string): string {
    const lines: string[] = [];
    lines.push('Query executed successfully.');
    lines.push(`  - Database: ${dbPath}`);
    lines.push(`  ? Rows returned: ${rows.length}${totalRows > maxRows ? ` (of ${totalRows}, limited to ${maxRows})` : ''}`);

    if (rows.length === 0) {
      lines.push('  - No results found.');
      return lines.join('\n');
    }

    lines.push('');
    const columns = Object.keys(rows[0]);
    lines.push(`Columns: ${columns.join(', ')}`);
    lines.push('');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowValues = columns.map((col) => `${col}=${JSON.stringify(row[col])}`).join(', ');
      lines.push(`  [${i}] ${rowValues}`);
    }

    return lines.join('\n');
  }

  private formatWriteResult(result: { changes: number; lastInsertRowid?: unknown }, dbPath: string): string {
    const lines: string[] = [];
    lines.push(`Write query executed successfully.`);
    lines.push(`  - Database: ${dbPath}`);
    lines.push(`  - Linhas afetadas: ${result.changes}`);
    if (result.lastInsertRowid !== undefined) {
      lines.push(`  - Latest ID inserido: ${result.lastInsertRowid}`);
    }
    return lines.join('\n');
  }
}
