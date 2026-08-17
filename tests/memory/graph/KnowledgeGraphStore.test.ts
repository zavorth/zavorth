import * as fs from 'node:fs';
import * as path from 'node:path';
import { KnowledgeGraphStore } from '../../../src/memory/graph/KnowledgeGraphStore.js';

describe('KnowledgeGraphStore', () => {
  const testDir = path.join(process.cwd(), '.zavorth', 'test_graph_store');
  let store: KnowledgeGraphStore;

  beforeAll(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    store = new KnowledgeGraphStore(testDir);
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

  it('should upsert nodes and persist them across instances', () => {
    const resA = store.upsertNode('auth_module', 'Authentication Module', 'architecture', { layer: 'core' });
    expect(resA.isNew).toBe(true);
    expect(resA.node.id).toBe('auth_module');

    const resB = store.upsertNode('argon2id', 'Argon2id Hashing', 'technology');
    expect(resB.isNew).toBe(true);

    const edge = store.upsertEdge('auth_module', 'argon2id', 'uses');
    expect(edge.isNew).toBe(true);
    expect(edge.edge.relation).toBe('uses');

    // Reload in a new store instance to test disk persistence
    const reloadedStore = new KnowledgeGraphStore(testDir);
    expect(reloadedStore.getNode('auth_module')).toBeDefined();
    expect(reloadedStore.getAllNodes().length).toBe(2);
    expect(reloadedStore.getAllEdges().length).toBe(1);
  });

  it('should increment weights upon subsequent upserts', () => {
    const res1 = store.upsertNode('argon2id', 'Argon2id Hashing', 'technology', {}, undefined, 1);
    expect(res1.isNew).toBe(false);
    expect(res1.node.weight).toBeGreaterThanOrEqual(2);
  });
});
