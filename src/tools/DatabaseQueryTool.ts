import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';

type QueryMode = 'read' | 'write';

export class DatabaseQueryTool extends BaseTool {
  public readonly name = 'database_query';

  public readonly description =
    'Executa queries em bancos de dados locais (SQLite).';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'SQL query a executar.',
      },
      database_path: {
        type: 'string',
        description: 'Caminho do banco de dados SQLite. Default: data/runtime/zavorth.db.',
      },
      mode: {
        type: 'string',
        description: "Modo de execucao: 'read' (SELECT apenas), 'write' (INSERT/UPDATE/DELETE). Default: 'read'.",
      },
      max_rows: {
        type: 'number',
        description: 'Numero maximo de linhas retornadas (1-1000). Default: 100.',
      },
    },
    required: ['query'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const query = String(args.query || '');
    if (!query) return 'Erro: o parametro "query" e obrigatorio.';

    const mode = String(args.mode || 'read') as QueryMode;
    if (mode !== 'read' && mode !== 'write') {
      return `Erro: modo "${mode}" invalido. Use 'read' ou 'write'.`;
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
      return `Erro: o caminho do banco de dados "${rawDbPath}" esta fora da raiz de dados permitida do Zavorth (${allowedRoot}).`;
    }

    const dbPath = resolvedDbPath;
    const normalizedQuery = query.trim().toUpperCase();

    if (mode === 'read') {
      if (!normalizedQuery.startsWith('SELECT') && !normalizedQuery.startsWith('PRAGMA') && !normalizedQuery.startsWith('EXPLAIN')) {
        return 'Erro: modo "read" permite apenas SELECT, PRAGMA e EXPLAIN. Use mode="write" para operacoes de escrita.';
      }
      // Remove mutable PRAGMA from read mode
      if (normalizedQuery.startsWith('PRAGMA') && normalizedQuery.includes('=')) {
        return 'Erro: configuracao mutavel via PRAGMA nao e permitida no modo "read".';
      }
    }

    if (mode === 'write') {
      const isDestructive = normalizedQuery.startsWith('DROP') || normalizedQuery.startsWith('TRUNCATE');
      if (isDestructive) {
        return 'Erro: operacoes DROP e TRUNCATE nao sao permitidas. Remova manualmente se necessario.';
      }
      if (!normalizedQuery.startsWith('INSERT') && !normalizedQuery.startsWith('UPDATE') && !normalizedQuery.startsWith('DELETE') && !normalizedQuery.startsWith('CREATE') && !normalizedQuery.startsWith('ALTER')) {
        return 'Erro: modo "write" permite INSERT, UPDATE, DELETE, CREATE e ALTER.';
      }
    }

    try {
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      let sqlite3: any;
      try {
        sqlite3 = await import('better-sqlite3');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return `Erro: driver SQLite real better-sqlite3 indisponivel. Instale as dependencias nativas antes de executar database_query. Detalhe: ${message}`;
      }

      const db = sqlite3.default(dbPath, { readonly: mode === 'read' });

      try {
        if (mode === 'read') {
          const rows = db.prepare(query).all();
          const limited = rows.slice(0, maxRows);
          return this.formatReadResult(limited, rows.length, maxRows, dbPath);
        } else {
          const result = db.prepare(query).run();
          return this.formatWriteResult(result, dbPath);
        }
      } finally {
        db.close();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro ao executar query: ${message}`;
    }
  }

  private formatReadResult(rows: any[], totalRows: number, maxRows: number, dbPath: string): string {
    const lines: string[] = [];
    lines.push(`Query executada com sucesso.`);
    lines.push(`  - Database: ${dbPath}`);
    lines.push(`  - Linhas retornadas: ${rows.length}${totalRows > maxRows ? ` (de ${totalRows}, limitado a ${maxRows})` : ''}`);

    if (rows.length === 0) {
      lines.push('  - Nenhum resultado encontrado.');
      return lines.join('\n');
    }

    lines.push('');
    const columns = Object.keys(rows[0]);
    lines.push(`Colunas: ${columns.join(', ')}`);
    lines.push('');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowValues = columns.map((col) => `${col}=${JSON.stringify(row[col])}`).join(', ');
      lines.push(`  [${i}] ${rowValues}`);
    }

    return lines.join('\n');
  }

  private formatWriteResult(result: any, dbPath: string): string {
    const lines: string[] = [];
    lines.push(`Query de escrita executada com sucesso.`);
    lines.push(`  - Database: ${dbPath}`);
    lines.push(`  - Linhas afetadas: ${result.changes}`);
    if (result.lastInsertRowid !== undefined) {
      lines.push(`  - Ultimo ID inserido: ${result.lastInsertRowid}`);
    }
    return lines.join('\n');
  }
}
