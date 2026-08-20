import { describe, expect, it } from 'vitest';
import {
  buildCapabilityMapFromRuntime,
  filterCapabilityMapNodes,
  hashString,
  layoutCapabilityMap,
  nodeRadius,
} from '../src/capability-map/capabilityMapLayout';

describe('capabilityMapLayout', () => {
  it('hashes deterministically', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });

  it('lays out nodes on rings with positions inside canvas', () => {
    const graph = layoutCapabilityMap(
      [
        { id: 'a', label: 'A', domain: 'skills' },
        { id: 'b', label: 'B', domain: 'channels', status: 'live' },
        { id: 'c', label: 'C', domain: 'trust', status: 'live', weight: 3 },
      ],
      { width: 800, height: 500 },
    );
    expect(graph.nodes).toHaveLength(3);
    for (const n of graph.nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(800);
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(500);
      expect(n.r).toBeGreaterThan(0);
    }
    expect(graph.cx).toBe(400);
    expect(graph.cy).toBe(250);
  });

  it('is stable for the same inputs', () => {
    const input = [
      { id: 's1', label: 'Skill', domain: 'skills' as const },
      { id: 'c1', label: 'Chan', domain: 'channels' as const },
    ];
    const a = layoutCapabilityMap(input);
    const b = layoutCapabilityMap(input);
    expect(a.nodes.map(n => [n.x, n.y, n.r])).toEqual(b.nodes.map(n => [n.x, n.y, n.r]));
  });

  it('filters by query', () => {
    const nodes = [
      { id: '1', label: 'Write file', domain: 'skills' as const },
      { id: '2', label: 'Telegram', domain: 'channels' as const },
    ];
    expect(filterCapabilityMapNodes(nodes, 'tele')).toHaveLength(1);
    expect(filterCapabilityMapNodes(nodes, '')).toHaveLength(2);
  });

  it('builds runtime capability map with cores and placeholders', () => {
    const nodes = buildCapabilityMapFromRuntime({
      tools: [{ id: 't1', name: 'Read' }],
      channels: [{ id: 'tg', name: 'Telegram', status: 'live' }],
      agents: [{ id: 'a1', role: 'reviewer', status: 'running' }],
      approvalsPending: 2,
      receiptsCount: 4,
    });
    expect(nodes.some(n => n.domain === 'trust')).toBe(true);
    expect(nodes.some(n => n.id === 'skill:t1')).toBe(true);
    expect(nodes.some(n => n.domain === 'channels' && n.status === 'live')).toBe(true);
    expect(nodes.some(n => n.domain === 'agents')).toBe(true);
    expect(nodes.some(n => n.domain === 'power')).toBe(true);
  });

  it('adds placeholders when catalogs empty', () => {
    const nodes = buildCapabilityMapFromRuntime({});
    expect(nodes.some(n => n.id.includes('placeholder'))).toBe(true);
  });

  it('scales radius with weight and live status', () => {
    expect(nodeRadius(4, 'live')).toBeGreaterThan(nodeRadius(1, 'available'));
  });
});
