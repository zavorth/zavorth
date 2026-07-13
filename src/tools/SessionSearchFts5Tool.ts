/**
 * SessionSearchFts5Tool - zero-LLM-cost full-text session search.
 *
 * Unified tool with modes: discover, scroll, read, browse.
 * Prefer SessionContinuumService (shared recall store) when available;
 * otherwise fall back to an in-memory index for offline/tests.
 */

import { BaseTool } from './BaseTool.js';
import type { SessionContinuumService } from '../services/SessionContinuumService.js';

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
  storePath?: string;
}

export class SessionSearchFts5Tool extends BaseTool {
  public readonly name = 'session_search';
  public readonly description =
    'Full-text search across stored sessions via the local session continuum. Modes: discover (search), scroll (navigate), read (read session), browse (list sessions).';

  public readonly parameters = {
    type: 'object' as const,
    properties: {
      mode: {
        type: 'string',
        enum: ['discover', 'scroll', 'read', 'browse'],
        description: 'Search mode: discover=search by text, scroll=navigate results, read=read a specific session, browse=list sessions.',
      },
      query: {
        type: 'string',
        description: 'Search text (for discover mode).',
      },
      sessionId: {
        type: 'string',
        description: 'Session ID for read mode.',
      },
      role: {
        type: 'string',
        enum: ['user', 'assistant', 'system', 'tool'],
        description: 'Filter by message role.',
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
        description: 'Maximum number of results (default: 20).',
      },
      offset: {
        type: 'number',
        description: 'Pagination offset.',
      },
    },
    required: ['mode'],
  };

  private entries: SessionEntry[] = [];
  private sessionIndex = new Map<string, SessionEntry[]>();
  private invertedIndex = new Map<string, Set<number>>();
  private readonly continuum: SessionContinuumService | null;

  constructor(options?: { continuum?: SessionContinuumService | null }) {
    super();
    this.continuum = options?.continuum || null;
  }

  /**
   * Indexes a session entry (in-memory fallback path).
   */
  indexEntry(entry: SessionEntry): void {
    const idx = this.entries.length;
    this.entries.push(entry);

    const sessionEntries = this.sessionIndex.get(entry.sessionId) ?? [];
    sessionEntries.push(entry);
    this.sessionIndex.set(entry.sessionId, sessionEntries);

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

  private read(sessionId: string): SearchResult {
    const entries = this.sessionIndex.get(sessionId) ?? [];
    return {
      entries,
      total: entries.length,
      hasMore: false,
    };
  }

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

  private searchViaContinuum(options: SearchOptions): SearchResult | null {
    if (!this.continuum) return null;

    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const storePath = this.continuum.getStorePath();

    if (options.mode === 'browse') {
      const snapshot = this.continuum.browse({
        currentSessionId: options.sessionId || null,
        limit: limit + offset,
      });
      const hits = snapshot.hits.slice(offset, offset + limit);
      return {
        storePath,
        total: snapshot.returned,
        hasMore: offset + limit < snapshot.returned,
        entries: hits.map((hit) => ({
          id: hit.messageId || hit.sessionId,
          sessionId: hit.sessionId,
          role: (hit.role as SessionEntry['role']) || 'system',
          content: `[${hit.title}] ${hit.snippet}`,
          timestamp: hit.updatedAt || hit.createdAt || snapshot.generatedAt,
        })),
      };
    }

    if (options.mode === 'read') {
      const snapshot = this.continuum.scroll({
        sessionId: options.sessionId,
        aroundMessageId: null,
        limit: 50,
        window: 8,
      });
      const hits = snapshot.hits.filter((hit) => hit.sessionId === options.sessionId);
      return {
        storePath,
        total: hits.length,
        hasMore: false,
        entries: hits.map((hit) => ({
          id: hit.messageId || hit.sessionId,
          sessionId: hit.sessionId,
          role: (hit.role as SessionEntry['role']) || 'system',
          content: hit.snippet,
          timestamp: hit.createdAt || hit.updatedAt || snapshot.generatedAt,
        })),
      };
    }

    if (options.mode === 'scroll') {
      const snapshot = this.continuum.scroll({
        sessionId: options.sessionId || null,
        aroundMessageId: null,
        limit: limit + offset,
        window: 2,
      });
      const hits = snapshot.hits.slice(offset, offset + limit);
      return {
        storePath,
        total: snapshot.returned,
        hasMore: offset + limit < snapshot.returned,
        entries: hits.map((hit) => ({
          id: hit.messageId || hit.sessionId,
          sessionId: hit.sessionId,
          role: (hit.role as SessionEntry['role']) || 'system',
          content: hit.snippet,
          timestamp: hit.createdAt || hit.updatedAt || snapshot.generatedAt,
        })),
      };
    }

    const query = String(options.query || '').trim();
    if (!query) return null;
    const snapshot = this.continuum.discover(query, {
      sessionId: options.sessionId || null,
      limit: limit + offset,
      window: 2,
    });
    const hits = snapshot.hits.slice(offset, offset + limit);
    return {
      storePath,
      total: snapshot.returned,
      hasMore: offset + limit < snapshot.returned,
      entries: hits.map((hit) => ({
        id: hit.messageId || hit.sessionId,
        sessionId: hit.sessionId,
        role: (hit.role as SessionEntry['role']) || 'system',
        content: hit.snippet,
        timestamp: hit.createdAt || hit.updatedAt || snapshot.generatedAt,
      })),
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
      limit,
      offset,
    };

    if (mode === 'discover' && !query) return 'Error: modo discover requer campo "query".';
    if (mode === 'read' && !sessionId) return 'Error: modo read requer campo "sessionId".';
    if (!['discover', 'scroll', 'read', 'browse'].includes(mode)) {
      return `Modo desconhecido: ${mode}. Use: discover, scroll, read, browse.`;
    }

    let result = this.searchViaContinuum(options);
    if (!result) {
      switch (mode) {
        case 'discover':
          result = this.discover(query, options);
          break;
        case 'scroll':
          result = this.scroll(options);
          break;
        case 'read':
          result = this.read(sessionId);
          break;
        case 'browse':
          result = this.browse(options);
          break;
        default:
          return `Modo desconhecido: ${mode}. Use: discover, scroll, read, browse.`;
      }
    }

    const lines: string[] = [
      `Resultados: ${result.total} total, ${result.entries.length} retornados`,
      result.storePath ? `store: ${result.storePath}` : '',
      result.hasMore ? 'More results available (use offset)' : '',
      '',
    ];

    for (const entry of result.entries) {
      const preview = entry.content.slice(0, 200).replace(/\n/g, ' ');
      lines.push(`[${entry.timestamp}] ${entry.role}: ${preview}`);
    }

    return lines.filter(Boolean).join('\n');
  }
}
