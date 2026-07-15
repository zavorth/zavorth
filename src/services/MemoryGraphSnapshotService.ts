/**
 * Read-only snapshot of the Zavorth memory knowledge graph for control API / desktop.
 * Shares storage layout with ZavorthMemoryGraphTool (data/runtime/memory-graph).
 */

import fs from 'node:fs';
import path from 'node:path';

export type MemoryGraphNodeSnapshot = {
  id: string;
  type: string;
  label: string;
  content: string;
  importance?: number;
  created_at?: string;
  last_accessed?: string;
  access_count?: number;
  metadata?: Record<string, unknown>;
};

export type MemoryGraphEdgeSnapshot = {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
  weight: number;
  created_at?: string;
};

export type MemoryGraphSnapshot = {
  generatedAt: string;
  source: 'MemoryGraphSnapshotService';
  storageDir: string;
  nodeCount: number;
  edgeCount: number;
  nodes: MemoryGraphNodeSnapshot[];
  edges: MemoryGraphEdgeSnapshot[];
  byType: Record<string, number>;
  byRelation: Record<string, number>;
  narrative: string;
};

type Runtime = {
  storageDir?: string;
  now?: () => Date;
  readFileSync?: typeof fs.readFileSync;
  existsSync?: typeof fs.existsSync;
};

export class MemoryGraphSnapshotService {
  private readonly storageDir: string;
  private readonly now: () => Date;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly existsSync: typeof fs.existsSync;

  public constructor(runtime: Runtime = {}) {
    this.storageDir = runtime.storageDir || path.join(process.cwd(), 'data', 'runtime', 'memory-graph');
    this.now = runtime.now || (() => new Date());
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
  }

  public buildSnapshot(): MemoryGraphSnapshot {
    const nodesMap = this.loadNodes();
    const edges = this.loadEdges();
    const nodes = Array.from(nodesMap.values());
    const byType: Record<string, number> = {};
    for (const node of nodes) {
      const t = String(node.type || 'unknown');
      byType[t] = (byType[t] || 0) + 1;
    }
    const byRelation: Record<string, number> = {};
    for (const edge of edges) {
      const r = String(edge.relation || 'related_to');
      byRelation[r] = (byRelation[r] || 0) + 1;
    }

    return {
      generatedAt: this.now().toISOString(),
      source: 'MemoryGraphSnapshotService',
      storageDir: this.storageDir,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes: nodes.slice(0, 500),
      edges: edges.slice(0, 1000),
      byType,
      byRelation,
      narrative:
        nodes.length === 0
          ? 'No memory graph nodes yet. The agent can add facts via zavorth_memory_graph.'
          : `Graph has ${nodes.length} node(s) and ${edges.length} edge(s).`,
    };
  }

  private loadNodes(): Map<string, MemoryGraphNodeSnapshot> {
    const nodesPath = path.join(this.storageDir, 'nodes.json');
    const map = new Map<string, MemoryGraphNodeSnapshot>();
    if (!this.existsSync(nodesPath)) return map;
    try {
      const raw = JSON.parse(this.readFileSync(nodesPath, 'utf8')) as Record<string, MemoryGraphNodeSnapshot>;
      for (const [id, node] of Object.entries(raw || {})) {
        if (!node || typeof node !== 'object') continue;
        map.set(id, {
          id: String(node.id || id),
          type: String(node.type || 'fact'),
          label: String(node.label || id),
          content: String(node.content || node.label || ''),
          importance: Number(node.importance || 0.5),
          created_at: node.created_at,
          last_accessed: node.last_accessed,
          access_count: node.access_count,
          metadata: node.metadata && typeof node.metadata === 'object' ? node.metadata : {},
        });
      }
    } catch {
      // Soft-fail empty graph
    }
    return map;
  }

  private loadEdges(): MemoryGraphEdgeSnapshot[] {
    const edgesPath = path.join(this.storageDir, 'edges.json');
    if (!this.existsSync(edgesPath)) return [];
    try {
      const raw = JSON.parse(this.readFileSync(edgesPath, 'utf8'));
      if (!Array.isArray(raw)) return [];
      return raw
        .map((edge: Partial<MemoryGraphEdgeSnapshot>, index: number) => ({
          id: String(edge.id || `edge_${index}`),
          source_id: String(edge.source_id || ''),
          target_id: String(edge.target_id || ''),
          relation: String(edge.relation || 'related_to'),
          weight: Number(edge.weight || 1) || 1,
          created_at: edge.created_at,
        }))
        .filter((e) => e.source_id && e.target_id);
    } catch {
      return [];
    }
  }
}
