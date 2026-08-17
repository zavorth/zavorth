import * as fs from 'node:fs';
import * as path from 'node:path';
import { KnowledgeGraphStore } from '../../../src/memory/graph/KnowledgeGraphStore.js';
import { MemoryGraphConsolidator } from '../../../src/memory/graph/MemoryGraphConsolidator.js';

describe('MemoryGraphConsolidator', () => {
  const testDir = path.join(process.cwd(), '.zavorth', 'test_graph_consolidator');
  let store: KnowledgeGraphStore;
  let consolidator: MemoryGraphConsolidator;

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    store = new KnowledgeGraphStore(testDir);
    consolidator = new MemoryGraphConsolidator(store);
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

  it('should ingest structured facts and link nodes', () => {
    const result = consolidator.ingestFact({
      subject: 'Zavorth Desktop',
      subjectCategory: 'architecture',
      relation: 'uses',
      object: 'Electron',
      objectCategory: 'technology',
      description: 'Desktop client GUI layer',
    });

    expect(result.nodeAId).toBe('zavorth_desktop');
    expect(result.nodeBId).toBe('electron');
    expect(store.getAllNodes().length).toBeGreaterThanOrEqual(2);
  });

  it('should extract and consolidate facts from session conversation text', () => {
    const text = `
    User prefers English comments in code.
    Agent runtime depends on Pluggable Adapters.
    `;

    const stats = consolidator.extractAndConsolidateFromText(text);
    expect(stats.factsProcessed).toBe(2);
    expect(store.getNode('user')).toBeDefined();
  });
});
