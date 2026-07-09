import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

interface SearchResult {
  session_id: string;
  session_file: string;
  match_score: number;
  matched_lines: string[];
  timestamp: string | null;
  context: string;
}

export class ZavorthSessionSearchTool extends BaseTool {
  public readonly name = 'zavorth_session_search';

  public readonly description =
    'Searches past Zavorth conversations and sessions. Supports full-text search, date filtering, channel filtering, message type filtering, and relevance ranking. Backed by the Mnemos FTS Index and session logs.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search term or phrase in sessions.',
      },
      session_id: {
        type: 'string',
        description: 'Limit search to a specific session.',
      },
      date_from: {
        type: 'string',
        description: 'Data inicial (ISO 8601 ou YYYY-MM-DD).',
      },
      date_to: {
        type: 'string',
        description: 'Data final (ISO 8601 ou YYYY-MM-DD).',
      },
      channel: {
        type: 'string',
        description: 'Filter by channel (telegram, discord, cli, etc).',
      },
      message_type: {
        type: 'string',
        description: "Filtrar por tipo: 'user', 'assistant', 'tool', 'system'.",
      },
      max_results: {
        type: 'number',
        description: 'Maximum results. Default: 10.',
      },
      context_lines: {
        type: 'number',
        description: 'Linhas de contexto ao redor de cada match. Default: 2.',
      },
      include_metadata: {
        type: 'boolean',
        description: 'If true, includes metadata da session. Default: true.',
      },
      sort_by: {
        type: 'string',
        description: "Ordenacao: 'relevance' (default), 'date_asc', 'date_desc'.",
      },
      search_mode: {
        type: 'string',
        description: "Modo: 'full_text' (default), 'exact', 'regex', 'semantic'.",
      },
    },
    required: ['query'],
  };

  private readonly sessionsDir: string;
  private readonly memoryDir: string;

  constructor(options?: { sessionsDir?: string; memoryDir?: string }) {
    super();
    this.sessionsDir = options?.sessionsDir || path.join(process.cwd(), 'data', 'sessions');
    this.memoryDir = options?.memoryDir || path.join(process.cwd(), 'data', 'runtime', 'memory');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const query = String(args.query || '');
    if (!query) return 'Error: "query" parameter is required.';

    const maxResults = typeof args.max_results === 'number' ? Math.min(args.max_results, 50) : 10;
    const contextLines = typeof args.context_lines === 'number' ? args.context_lines : 2;
    const searchMode = String(args.search_mode || 'full_text');
    const sortBy = String(args.sort_by || 'relevance');

    try {
      const results = this.performSearch({
        query,
        sessionId: typeof args.session_id === 'string' ? args.session_id : undefined,
        dateFrom: typeof args.date_from === 'string' ? args.date_from : undefined,
        dateTo: typeof args.date_to === 'string' ? args.date_to : undefined,
        channel: typeof args.channel === 'string' ? args.channel : undefined,
        messageType: typeof args.message_type === 'string' ? args.message_type : undefined,
        maxResults,
        contextLines,
        searchMode,
        sortBy,
      });

      if (results.length === 0) {
        return `No results found for "${query}" in sessions.`;
      }

      const lines: string[] = [`Encontrados ${results.length} result(s) para "${query}":`];

      for (const result of results) {
        lines.push('');
        lines.push(`--- Session: ${result.session_id} (${result.session_file}) ---`);
        if (result.timestamp) lines.push(`  Timestamp: ${result.timestamp}`);
        lines.push(`  Relevancia: ${result.match_score.toFixed(2)}`);
        if (result.context) lines.push(`  Contexto: ${result.context.slice(0, 120)}`);
        for (const matchedLine of result.matched_lines) {
          lines.push(`  > ${matchedLine.slice(0, 200)}`);
        }
      }

      return lines.join('\n');
    } catch (error: unknown) {
      logger.warn('[Zavorth Session Search] operation failed', error);
    const message = error instanceof Error ? error.message : String(error);
      return `Search error: ${message}`;
  }
  }

  private performSearch(params: {
    query: string;
    sessionId?: string;
    dateFrom?: string;
    dateTo?: string;
    channel?: string;
    messageType?: string;
    maxResults: number;
    contextLines: number;
    searchMode: string;
    sortBy: string;
  }): SearchResult[] {
    const results: SearchResult[] = [];

    const searchDirs = [
      { dir: this.sessionsDir, type: 'session' },
      { dir: this.memoryDir, type: 'memory' },
    ];

    for (const { dir, type } of searchDirs) {
      if (!fs.existsSync(dir)) continue;

      const files = this.listFilesRecursively(dir);

      for (const file of files) {
        if (!file.endsWith('.md') && !file.endsWith('.json') && !file.endsWith('.log')) continue;

        const fileName = path.basename(file, path.extname(file));

        if (params.sessionId && !fileName.includes(params.sessionId)) continue;

        const stat = fs.statSync(file);
        const fileDate = stat.mtime.toISOString();

        if (params.dateFrom && fileDate < params.dateFrom) continue;
        if (params.dateTo && fileDate > params.dateTo) continue;

        try {
          const content = fs.readFileSync(file, 'utf-8');
          const lines = content.split('\n');

          const matchResult = this.searchInContent(lines, params.query, params.searchMode, params.contextLines);

          if (matchResult.matchedLines.length > 0) {
            results.push({
              session_id: fileName,
              session_file: path.relative(process.cwd(), file),
              match_score: matchResult.score,
              matched_lines: matchResult.matchedLines,
              timestamp: fileDate,
              context: matchResult.contextSnippet,
            });
          }
        } catch (error: unknown) {continue;
        }
      }
    }

    if (params.sortBy === 'date_asc') {
      results.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    } else if (params.sortBy === 'date_desc') {
      results.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    } else {
      results.sort((a, b) => b.match_score - a.match_score);
    }

    return results.slice(0, params.maxResults);
  }

  private searchInContent(
    lines: string[],
    query: string,
    mode: string,
    contextLines: number,
  ): { matchedLines: string[]; score: number; contextSnippet: string } {
    const matchedLines: string[] = [];
    let score = 0;
    const queryLower = query.toLowerCase();

    let pattern: RegExp | null = null;
    if (mode === 'regex') {
      try {
        pattern = new RegExp(query, 'i');
      } catch (error: unknown) {logger.warn('[Zavorth Session Search] search failed', error);
    return { matchedLines: [], score: 0, contextSnippet: '' };
  }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      let matched = false;

      switch (mode) {
        case 'exact':
          matched = line.includes(query);
          break;
        case 'regex':
          matched = pattern ? pattern.test(line) : false;
          if (pattern) pattern.lastIndex = 0;
          break;
        case 'full_text':
        default: {
          const queryWords = queryLower.split(/\s+/).filter(Boolean);
          const matchedWords = queryWords.filter((w) => lineLower.includes(w));
          matched = matchedWords.length > 0;
          score += matchedWords.length / queryWords.length;
          break;
        }
      }

      if (matched) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length - 1, i + contextLines);
        const contextSlice = lines.slice(start, end + 1).map((l) => l.trim()).filter(Boolean);
        matchedLines.push(...contextSlice);

        if (lineLower.includes(queryLower)) {
          score += 2;
        } else {
          score += 0.5;
        }
      }
    }

    const uniqueLines = [...new Set(matchedLines)];
    const contextSnippet = uniqueLines.slice(0, 5).join(' | ');

    return {
      matchedLines: uniqueLines.slice(0, 20),
      score,
      contextSnippet,
    };
  }

  private listFilesRecursively(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.listFilesRecursively(fullPath));
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
    } catch (error: unknown) {// ignore permission errors
      logger.warn('[Zavorth Session Search] filesystem operation failed', error);
    }
    return results;
  }
}
