import * as fs from 'node:fs';
import * as path from 'node:path';
import { ZavorthMemoryGraphTool } from '../../src/tools/ZavorthMemoryGraphTool.js';
import { KnowledgeGraphStore } from '../../src/memory/graph/KnowledgeGraphStore.js';

describe('ZavorthMemoryGraphTool', () => {
  const testDir = path.join(process.cwd(), '.zavorth', 'test_tool_graph');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    const store = new KnowledgeGraphStore(testDir);
    (ZavorthMemoryGraphTool as any).globalStore = store;
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

  it('should add fact, query, get subgraph, and get stats via execute', async () => {
    // 1. Add fact
    const addRaw = await ZavorthMemoryGraphTool.execute({
      action: 'add_fact',
      subject: 'Scheduler',
      subjectCategory: 'architecture',
      relation: 'uses',
      object: 'SQLite',
      objectCategory: 'technology',
      description: 'Persistent store for scheduled jobs',
    });
    const addParsed = JSON.parse(addRaw);
    expect(addParsed.status).toBe('success');
    expect(addParsed.result.nodeAId).toBe('scheduler');

    // 2. Query
    const queryRaw = await ZavorthMemoryGraphTool.execute({
      action: 'query',
      keyword: 'SQLite',
    });
    const queryParsed = JSON.parse(queryRaw);
    expect(queryParsed.status).toBe('success');
    expect(queryParsed.totalNodes).toBeGreaterThanOrEqual(1);

    // 3. Subgraph
    const subRaw = await ZavorthMemoryGraphTool.execute({
      action: 'get_subgraph',
      nodeId: 'scheduler',
      depth: 1,
    });
    const subParsed = JSON.parse(subRaw);
    expect(subParsed.status).toBe('success');
    expect(subParsed.nodesCount).toBe(2);

    // 4. Stats
    const statsRaw = await ZavorthMemoryGraphTool.execute({
      action: 'stats',
    });
    const statsParsed = JSON.parse(statsRaw);
    expect(statsParsed.status).toBe('success');
    expect(statsParsed.totalNodes).toBe(2);
    expect(statsParsed.totalEdges).toBe(1);

    // 5. Consolidate text
    const textRaw = await ZavorthMemoryGraphTool.execute({
      action: 'consolidate_text',
      text: 'Frontend uses TailwindCSS.\nBackend uses Express.\n',
    });
    const textParsed = JSON.parse(textRaw);
    expect(textParsed.status).toBe('success');
    expect(textParsed.stats.factsProcessed).toBe(2);
  });
});
