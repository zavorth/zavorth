import { describe, expect, it } from 'vitest';
import {
  emptyMemoryGraph,
  layoutMemoryGraph,
  memoryItemsToGraphNodes,
  normalizeMemoryGraph,
  truncateLabel,
} from '../src/views/panels/memoryGraphLayout';

describe('memoryGraphLayout', () => {
  it('normalizes API graph payloads and drops dangling edges', () => {
    const graph = normalizeMemoryGraph({
      ok: true,
      data: {
        nodes: [
          { id: 'a', type: 'person', label: 'Ada' },
          { id: 'b', type: 'concept', label: 'Memory' },
        ],
        edges: [
          { id: 'e1', source_id: 'a', target_id: 'b', relation: 'related_to', weight: 2 },
          { id: 'e2', source_id: 'a', target_id: 'missing', relation: 'related_to' },
        ],
      },
    });
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.stats?.edgeCount).toBe(1);
  });

  it('lays out nodes with coordinates', () => {
    const layout = layoutMemoryGraph({
      nodes: [
        { id: 'a', label: 'A', type: 'fact' },
        { id: 'b', label: 'B', type: 'skill' },
        { id: 'c', label: 'C', type: 'person' },
      ],
      edges: [{ source_id: 'a', target_id: 'b', relation: 'supports' }],
    });
    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges).toHaveLength(1);
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.r).toBeGreaterThan(0);
    }
  });

  it('projects memory items into isolated nodes', () => {
    const graph = memoryItemsToGraphNodes([
      { id: '1', title: 'Prefers dark mode', kind: 'preference' },
      { id: '2', title: 'Uses TypeScript', kind: 'fact' },
    ]);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(0);
  });

  it('truncates labels and exposes empty graph', () => {
    expect(truncateLabel('short')).toBe('short');
    expect(truncateLabel('this-is-a-very-long-label-value', 10).endsWith('…')).toBe(true);
    expect(emptyMemoryGraph().nodes).toEqual([]);
  });
});
