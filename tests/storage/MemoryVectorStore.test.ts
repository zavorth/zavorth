import fs from 'fs';
import os from 'os';
import path from 'path';
import { MemoryVectorStore } from '../../src/storage/MemoryVectorStore.js';
import type { MemoryChunk } from '../../src/runtime/sessions/v2/InfiniteMemoryCompressor.js';

function chunk(id: string, sessionId: string, keywords: string[]): MemoryChunk {
  return {
    id,
    sessionId,
    createdAt: new Date().toISOString(),
    originalTokenCount: 42,
    compressedSummary: `summary ${id}`,
    keywords,
    relevanceScore: 1,
  };
}

describe('MemoryVectorStore', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-memory-store-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('persists and searches memory chunks', async () => {
    const store = new MemoryVectorStore(dir);
    await store.save(chunk('one', 'session-a', ['alpha', 'beta']));
    await store.save(chunk('two', 'session-b', ['gamma']));

    expect(store.count()).toBe(2);
    expect(store.listBySession('session-a')).toHaveLength(1);
    expect(store.search(['alpha'])).toEqual([
      expect.objectContaining({ id: 'one' }),
    ]);

    store.close();
  });

  it('falls back to JSON storage when requested', async () => {
    const store = new MemoryVectorStore(dir, { forceFallback: true });
    await store.save(chunk('fallback-one', 'session-json', ['json']));

    expect(store.count()).toBe(1);
    expect(store.search(['json'])[0]).toEqual(expect.objectContaining({ id: 'fallback-one' }));
    expect(fs.existsSync(path.join(dir, 'memory_vectors.json'))).toBe(true);

    store.close();
  });

  it('ranks stored chunks by semantic similarity when embeddings are available', async () => {
    const store = new MemoryVectorStore(dir, { forceFallback: true });
    await store.save({
      ...chunk('one', 'session-a', ['alpha', 'approval']),
      compressedSummary: 'Memoria sobre approval da luz da sala.',
      embedding: [1, 0, 0],
    });
    await store.save({
      ...chunk('two', 'session-b', ['gamma']),
      compressedSummary: 'Memoria sobre browser automation.',
      embedding: [0, 1, 0],
    });

    const results = store.searchSemantic([0.95, 0.05, 0], 2, ['approval']);

    expect(results[0]).toEqual(expect.objectContaining({
      id: 'one',
      embedding: [1, 0, 0],
    }));
    expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
    store.close();
  });

  it('backfills embeddings on save when an embedding provider is configured', async () => {
    const embeddingService = {
      generate: jest.fn(async () => [0.3, 0.4, 0.5]),
    };
    const store = new MemoryVectorStore(dir, {
      forceFallback: true,
      embeddingService,
    });

    await store.save(chunk('semantic', 'session-semantic', ['memory', 'semantic']));
    const results = store.searchSemantic([0.3, 0.4, 0.5], 1, ['memory']);

    expect(embeddingService.generate).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual(expect.objectContaining({
      id: 'semantic',
      embedding: [0.3, 0.4, 0.5],
    }));
    store.close();
  });
});
