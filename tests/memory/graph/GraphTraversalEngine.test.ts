import * as fs from 'node:fs';
import * as path from 'node:path';
import { KnowledgeGraphStore } from '../../../src/memory/graph/KnowledgeGraphStore.js';
import { GraphTraversalEngine } from '../../../src/memory/graph/GraphTraversalEngine.js';

describe('GraphTraversalEngine', () => {
  const testDir = path.join(process.cwd(), '.zavorth', 'test_graph_traversal');
  let store: KnowledgeGraphStore;
  let engine: GraphTraversalEngine;

  beforeAll(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    store = new KnowledgeGraphStore(testDir);
    store.upsertNode('gateway', 'AI Gateway', 'architecture');
    store.upsertNode('rate_limiter', 'Token Bucket Rate Limiter', 'technology');
    store.upsertNode('redis', 'Redis Store', 'technology');

    store.upsertEdge('gateway', 'rate_limiter', 'uses');
    store.upsertEdge('rate_limiter', 'redis', 'depends_on');

    engine = new GraphTraversalEngine(store);
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('should search nodes by keyword matching', () => {
    const results = engine.search({ keyword: 'rate limiter' });
    expect(results.nodes.length).toBeGreaterThanOrEqual(1);
    expect(results.nodes.some((n) => n.id === 'rate_limiter')).toBe(true);
  });

  it('should perform BFS neighborhood expansion across 2 hops', () => {
    const subgraph = engine.getNeighborhood('gateway', 2);
    expect(subgraph.nodes.length).toBe(3);
    expect(subgraph.edges.length).toBe(2);
  });
});
