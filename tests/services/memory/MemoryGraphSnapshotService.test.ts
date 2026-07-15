import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { MemoryGraphSnapshotService } from '../../../src/services/MemoryGraphSnapshotService.js';

describe('MemoryGraphSnapshotService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-memory-graph-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('returns empty narrative when no graph files exist', () => {
    const snap = new MemoryGraphSnapshotService({ storageDir: root }).buildSnapshot();
    expect(snap.nodeCount).toBe(0);
    expect(snap.edgeCount).toBe(0);
    expect(snap.nodes).toEqual([]);
    expect(snap.narrative).toMatch(/No memory graph/i);
    expect(snap.source).toBe('MemoryGraphSnapshotService');
  });

  it('loads nodes and edges from storage layout', () => {
    fs.writeFileSync(
      path.join(root, 'nodes.json'),
      JSON.stringify({
        node_a: {
          id: 'node_a',
          type: 'person',
          label: 'Ada',
          content: 'Engineer',
          importance: 0.9,
        },
        node_b: {
          id: 'node_b',
          type: 'concept',
          label: 'Zavorth',
          content: 'Local agent runtime',
        },
      }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'edges.json'),
      JSON.stringify([
        {
          id: 'edge_1',
          source_id: 'node_a',
          target_id: 'node_b',
          relation: 'uses',
          weight: 2,
        },
      ]),
      'utf8',
    );

    const snap = new MemoryGraphSnapshotService({ storageDir: root }).buildSnapshot();
    expect(snap.nodeCount).toBe(2);
    expect(snap.edgeCount).toBe(1);
    expect(snap.byType.person).toBe(1);
    expect(snap.byType.concept).toBe(1);
    expect(snap.byRelation.uses).toBe(1);
    expect(snap.nodes.some((n) => n.label === 'Ada')).toBe(true);
    expect(snap.narrative).toMatch(/2 node/);
  });
});
