/**
 * SessionSearchFts5Tool — Busca full-text em sessões com zero custo LLM.
 *
 * Ferramenta unificada com 4 modos: discover, scroll, read, browse.
 * Indexa sessões localmente e permite busca por conteúdo, metadados
 * e período de tempo sem custo de tokens LLM.
 *
 * Uso via tool registry:
 *   const result = await tool.execute({
 *     mode: 'discover',
 *     query: 'authentication bug',
 *     limit: 10,
 *   });
 */

import { BaseTool } from './BaseTool.js';

export interface SessionEntry {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  model?: string;
  tokenCount?: number;
  tags?: string[];
}

export interface SearchOptions {
  mode: 'discover' | 'scroll' | 'read' | 'browse';
  query?: string;
  sessionId?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  entries: SessionEntry[];
  total: number;
  hasMore: boolean;
}

export class SessionSearchFts5Tool extends BaseTool {
  public readonly name = 'session_search_fts5';
  public readonly description = 'Busca full-text em sessões armazenadas. Modos: discover (buscar), scroll (navegar), read (ler sessão), browse (listar sessões).';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      mode: {
        type: 'string',
        enum: ['discover', 'scroll', 'read', 'browse'],
        description: 'Modo de busca: discover=buscar por texto, scroll=navegar resultados, read=ler sessão específica, browse=listar sessões.',
      },
      query: {
        type: 'string',
        description: 'Texto de busca (para modo discover).',
      },
      sessionId: {
        type: 'string',
        description: 'ID da sessão (para modo read).',
      },
      role: {
        type: 'string',
        enum: ['user', 'assistant', 'system', 'tool'],
        description: 'Filtrar por papel da mensagem.',
      },
      startDate: {
        type: 'string',
        description: 'Data inicial para filtro (ISO 8601).',
      },
      endDate: {
        type: 'string',
        description: 'Data final para filtro (ISO 8601).',
      },
      limit: {
        type: 'number',
        description: 'Número máximo de resultados (padrão: 20).',
      },
      offset: {
        type: 'number',
        description: 'Offset para paginação.',
      },
    },
    required: ['mode'],
  };

  private entries: SessionEntry[] = [];
  private sessionIndex = new Map<string, SessionEntry[]>();
  private invertedIndex = new Map<string, Set<number>>();

  /**
   * Indexa uma entrada de sessão.
   */
  indexEntry(entry: SessionEntry): void {
    const idx = this.entries.length;
    this.entries.push(entry);

    // Indexar por sessão
    const sessionEntries = this.sessionIndex.get(entry.sessionId) ?? [];
    sessionEntries.push(entry);
    this.sessionIndex.set(entry.sessionId, sessionEntries);

    // Indexar palavras para busca full-text
    const words = this.tokenize(entry.content);
    for (const word of words) {
      const positions = this.invertedIndex.get(word) ?? new Set();
      positions.add(idx);
      this.invertedIndex.set(word, positions);
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  private matchesQuery(entry: SessionEntry, query: string): boolean {
    const queryWords = this.tokenize(query);
    const entryWords = new Set(this.tokenize(entry.content));
    return queryWords.some((w) => entryWords.has(w));
  }

  private matchesFilters(
    entry: SessionEntry,
    options: SearchOptions,
  ): boolean {
    if (options.role && entry.role !== options.role) return false;
    if (options.sessionId && entry.sessionId !== options.sessionId) return false;
    if (options.startDate && entry.timestamp < options.startDate) return false;
    if (options.endDate && entry.timestamp > options.endDate) return false;
    return true;
  }

  /**
   * Modo discover: busca por texto com scoring.
   */
  private discover(query: string, options: SearchOptions): SearchResult {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    const scored = this.entries
      .map((entry, idx) => {
        const queryWords = this.tokenize(query);
        const entryWords = this.tokenize(entry.content);
        let score = 0;
        for (const qw of queryWords) {
          if (entryWords.includes(qw)) score++;
        }
        return { entry, score, idx };
      })
      .filter((e) => e.score > 0 && this.matchesFilters(e.entry, options))
      .sort((a, b) => b.score - a.score);

    const page = scored.slice(offset, offset + limit);
    return {
      entries: page.map((e) => e.entry),
      total: scored.length,
      hasMore: offset + limit < scored.length,
    };
  }

  /**
   * Modo scroll: navega por sessão com paginação cronológica.
   */
  private scroll(options: SearchOptions): SearchResult {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    const filtered = this.entries.filter((e) => this.matchesFilters(e, options));
    const sorted = filtered.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const page = sorted.slice(offset, offset + limit);
    return {
      entries: page,
      total: sorted.length,
      hasMore: offset + limit < sorted.length,
    };
  }

  /**
   * Modo read: retorna todas as entradas de uma sessão.
   */
  private read(sessionId: string): SearchResult {
    const entries = this.sessionIndex.get(sessionId) ?? [];
    return {
      entries,
      total: entries.length,
      hasMore: false,
    };
  }

  /**
   * Modo browse: lista sessões únicas com contagem.
   */
  private browse(options: SearchOptions): SearchResult {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    const sessionIds = [...new Set(this.entries.map((e) => e.sessionId))];
    const sessions = sessionIds
      .map((id) => {
        const entries = this.sessionIndex.get(id) ?? [];
        const latest = entries[entries.length - 1];
        return {
          id,
          entryCount: entries.length,
          lastActivity: latest?.timestamp ?? '',
          preview: latest?.content.slice(0, 100) ?? '',
        };
      })
      .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

    const page = sessions.slice(offset, offset + limit);
    const entries: SessionEntry[] = page.map((s) => ({
      id: s.id,
      sessionId: s.id,
      role: 'system',
      content: `[${s.entryCount} msgs] ${s.preview}`,
      timestamp: s.lastActivity,
    }));

    return {
      entries,
      total: sessions.length,
      hasMore: offset + limit < sessions.length,
    };
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const mode = String(args.mode || 'discover') as SearchOptions['mode'];
    const query = String(args.query || '');
    const sessionId = String(args.sessionId || '');
    const limit = Number(args.limit) || 20;
    const offset = Number(args.offset) || 0;

    const options: SearchOptions = {
      mode,
      query,
      sessionId,
      role: args.role as string,
      startDate: args.startDate as string,
      endDate: args.endDate as string,
    };

    let result: SearchResult;

    switch (mode) {
      case 'discover':
        if (!query) return 'Erro: modo discover requer campo "query".';
        result = this.discover(query, options);
        break;
      case 'scroll':
        result = this.scroll(options);
        break;
      case 'read':
        if (!sessionId) return 'Erro: modo read requer campo "sessionId".';
        result = this.read(sessionId);
        break;
      case 'browse':
        result = this.browse(options);
        break;
      default:
        return `Modo desconhecido: ${mode}. Use: discover, scroll, read, browse.`;
    }

    const lines: string[] = [
      `Resultados: ${result.total} total, ${result.entries.length} retornados`,
      result.hasMore ? 'Mais resultados disponíveis (use offset)' : '',
      '',
    ];

    for (const entry of result.entries) {
      const preview = entry.content.slice(0, 200).replace(/\n/g, ' ');
      lines.push(`[${entry.timestamp}] ${entry.role}: ${preview}`);
    }

    return lines.filter(Boolean).join('\n');
  }
}
