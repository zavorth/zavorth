/**
 * Zavorth BM25 Search Tool.
 * Fast in-memory token-level BM25 search across workspace source code, project memory rules, and sessions.
 */

import { BaseTool } from './BaseTool.js';
import { FastBm25SearchEngine } from '../services/search/FastBm25SearchEngine.js';
import { logger } from '../logger.js';

export class ZavorthBm25SearchTool extends BaseTool {
  readonly name = 'zavorth_bm25_search';
  readonly description = 'Performs sub-5ms lexical BM25 token-level ranking across workspace code files, project memory, and past sessions.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query to match against workspace files, memory, and sessions.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return. Default: 10.',
      },
    },
    required: ['query'] as string[],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const query = String(args.query || '').trim();
    if (!query) {
      return JSON.stringify({ error: 'Search query is required.' });
    }

    const limit = typeof args.limit === 'number' ? args.limit : 10;

    try {
      const results = FastBm25SearchEngine.search(query, process.cwd(), limit);
      return JSON.stringify({
        success: true,
        query,
        count: results.length,
        results: results.map((r) => ({
          source: r.source,
          title: r.title,
          snippet: r.snippet,
          score: Math.round(r.score * 1000) / 1000,
        })),
      });
    } catch (err: unknown) {
      logger.warn('[ZavorthBm25SearchTool] search failed', err);
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }
}
