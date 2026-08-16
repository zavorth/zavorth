import { describe, it, expect } from '@jest/globals';
import { ZavorthBm25SearchTool } from '../../src/tools/ZavorthBm25SearchTool.js';

describe('ZavorthBm25SearchTool (BM25 Lexical Ranking Tool)', () => {
  const tool = new ZavorthBm25SearchTool();

  it('exposes correct metadata', () => {
    expect(tool.name).toBe('zavorth_bm25_search');
  });

  it('returns structured search results for query', async () => {
    const res = JSON.parse(await tool.execute({ query: 'Zavorth', limit: 5 }));
    expect(res.success).toBe(true);
    expect(Array.isArray(res.results)).toBe(true);
  });

  it('returns error when query is empty', async () => {
    const res = JSON.parse(await tool.execute({ query: '' }));
    expect(res.error).toBeDefined();
  });
});
