import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export interface GraphNode {
  id: string;
  type: 'fact' | 'preference' | 'person' | 'concept' | 'event' | 'skill';
  label: string;
  content: string;
  importance: number;
  created_at: string;
  last_accessed: string;
  access_count: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation: string;
  weight: number;
  created_at: string;
}

export class ZavorthMemoryGraphTool extends BaseTool {
  public readonly name = 'zavorth_memory_graph';

  public readonly description =
    'Memory Knowledge Graph — semantic connections between facts, preferences, people, concepts, and events. Query, traverse, and discover relationships.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'add_node', 'add_edge', 'query', 'traverse', 'neighbors', 'path', 'stats', 'visualize', 'remove_node'.",
      },
      node_type: {
        type: 'string',
        description: "Node type: 'fact', 'preference', 'person', 'concept', 'event', 'skill'.",
      },
      label: {
        type: 'string',
        description: 'Node label.',
      },
      content: {
        type: 'string',
        description: 'Node content/description.',
      },
      source_id: {
        type: 'string',
        description: 'Source node ID for edges.',
      },
      target_id: {
        type: 'string',
        description: 'Target node ID for edges.',
      },
      relation: {
        type: 'string',
        description: "Edge relation: 'related_to', 'caused_by', 'part_of', 'depends_on', 'contradicts', 'supports', 'requires'.",
      },
      query: {
        type: 'string',
        description: 'Search query.',
      },
      depth: {
        type: 'number',
        description: 'Traversal depth. Default: 2.',
      },
      node_id: {
        type: 'string',
        description: 'Node ID for specific operations.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'memory-graph');
    this.ensureDir();
    this.loadGraph();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
  }

  private loadGraph(): void {
    const nodesPath = path.join(this.storageDir, 'nodes.json');
    const edgesPath = path.join(this.storageDir, 'edges.json');
    try { if (fs.existsSync(nodesPath)) { const d = JSON.parse(fs.readFileSync(nodesPath, 'utf-8')); this.nodes = new Map(Object.entries(d)); } } catch (error) { /* ignore */ logger.warn('[Zavorth Memory Graph] JSON parse failed', error); }
    try { if (fs.existsSync(edgesPath)) this.edges = JSON.parse(fs.readFileSync(edgesPath, 'utf-8')); } catch (error) { /* ignore */ logger.warn('[Zavorth Memory Graph] JSON parse failed', error); }
  }

  private saveGraph(): void {
    fs.writeFileSync(path.join(this.storageDir, 'nodes.json'), JSON.stringify(Object.fromEntries(this.nodes), null, 2), 'utf-8');
    fs.writeFileSync(path.join(this.storageDir, 'edges.json'), JSON.stringify(this.edges, null, 2), 'utf-8');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'add_node': return this.addNode(args);
      case 'add_edge': return this.addEdge(args);
      case 'query': return this.query(args);
      case 'traverse': return this.traverse(args);
      case 'neighbors': return this.neighbors(args);
      case 'path': return this.findPath(args);
      case 'stats': return this.getStats();
      case 'visualize': return this.visualize(args);
      case 'remove_node': return this.removeNode(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private addNode(args: Record<string, unknown>): string {
    const label = String(args.label || '');
    if (!label) return 'Error: "label" is required.';

    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const node: GraphNode = {
      id,
      type: (String(args.node_type || 'fact')) as GraphNode['type'],
      label,
      content: String(args.content || label),
      importance: 0.5,
      created_at: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      access_count: 0,
      metadata: {},
    };

    this.nodes.set(id, node);
    this.saveGraph();
    return `Node "${label}" added with ID ${id} (type: ${node.type}).`;
  }

  private addEdge(args: Record<string, unknown>): string {
    const sourceId = String(args.source_id || '');
    const targetId = String(args.target_id || '');
    const relation = String(args.relation || 'related_to');
    if (!sourceId || !targetId) return 'Error: "source_id" and "target_id" are required.';

    if (!this.nodes.has(sourceId)) return `Error: source node "${sourceId}" not found.`;
    if (!this.nodes.has(targetId)) return `Error: target node "${targetId}" not found.`;

    const existing = this.edges.find((e) => e.source_id === sourceId && e.target_id === targetId && e.relation === relation);
    if (existing) {
      existing.weight++;
      this.saveGraph();
      return `Edge weight incremented to ${existing.weight}.`;
    }

    this.edges.push({
      id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source_id: sourceId,
      target_id: targetId,
      relation,
      weight: 1,
      created_at: new Date().toISOString(),
    });
    this.saveGraph();

    const source = this.nodes.get(sourceId)!;
    const target = this.nodes.get(targetId)!;
    return `Edge created: "${source.label}" --[${relation}]--> "${target.label}"`;
  }

  private query(args: Record<string, unknown>): string {
    const query = String(args.query || '').toLowerCase();
    if (!query) return 'Error: "query" is required.';

    const results: Array<{ node: GraphNode; score: number }> = [];
    for (const node of this.nodes.values()) {
      let score = 0;
      if (node.label.toLowerCase().includes(query)) score += 3;
      if (node.content.toLowerCase().includes(query)) score += 2;
      if (node.type.includes(query)) score += 1;
      if (score > 0) results.push({ node, score });
    }

    results.sort((a, b) => b.score - a.score);

    if (results.length === 0) return `No nodes found for "${query}".`;

    const lines: string[] = [`Graph query: "${query}" (${results.length} results):`];
    for (const { node } of results.slice(0, 10)) {
      const edges = this.edges.filter((e) => e.source_id === node.id || e.target_id === node.id);
      lines.push(`  [${node.type}] ${node.id}: ${node.label} — ${node.content.slice(0, 80)} (${edges.length} edges)`);
    }
    return lines.join('\n');
  }

  private traverse(args: Record<string, unknown>): string {
    const nodeId = String(args.node_id || '');
    const depth = typeof args.depth === 'number' ? args.depth : 2;
    if (!nodeId) return 'Error: "node_id" is required.';

    const startNode = this.nodes.get(nodeId);
    if (!startNode) return `Error: node "${nodeId}" not found.`;

    const visited = new Set<string>();
    const result: Array<{ node: GraphNode; depth: number; via: string }> = [];

    const traverse_depth = (currentId: string, currentDepth: number, via: string) => {
      if (currentDepth > depth || visited.has(currentId)) return;
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (!node) return;
      result.push({ node, depth: currentDepth, via });

      const edges = this.edges.filter((e) => e.source_id === currentId || e.target_id === currentId);
      for (const edge of edges) {
        const nextId = edge.source_id === currentId ? edge.target_id : edge.source_id;
        traverse_depth(nextId, currentDepth + 1, edge.relation);
      }
    };

    traverse_depth(nodeId, 0, 'root');

    const lines: string[] = [`Traversal from "${startNode.label}" (depth ${depth}):`];
    for (const { node, depth: d, via } of result) {
      const indent = '  '.repeat(d + 1);
      lines.push(`${indent}[${node.type}] ${node.label} (${via})`);
    }
    return lines.join('\n');
  }

  private neighbors(args: Record<string, unknown>): string {
    const nodeId = String(args.node_id || '');
    if (!nodeId) return 'Error: "node_id" is required.';

    const node = this.nodes.get(nodeId);
    if (!node) return `Error: node "${nodeId}" not found.`;

    const edges = this.edges.filter((e) => e.source_id === nodeId || e.target_id === nodeId);
    if (edges.length === 0) return `Node "${node.label}" has no connections.`;

    const lines: string[] = [`Neighbors of "${node.label}" (${edges.length} connections):`];
    for (const edge of edges) {
      const neighborId = edge.source_id === nodeId ? edge.target_id : edge.source_id;
      const neighbor = this.nodes.get(neighborId);
      if (neighbor) {
        lines.push(`  --[${edge.relation}]--> [${neighbor.type}] ${neighbor.label} (weight: ${edge.weight})`);
      }
    }
    return lines.join('\n');
  }

  private findPath(args: Record<string, unknown>): string {
    const sourceId = String(args.source_id || '');
    const targetId = String(args.target_id || '');
    if (!sourceId || !targetId) return 'Error: "source_id" and "target_id" are required.';

    const source = this.nodes.get(sourceId);
    const target = this.nodes.get(targetId);
    if (!source || !target) return 'Error: one or both nodes not found.';

    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: sourceId, path: [sourceId] }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.id === targetId) {
        const pathLabels = current.path.map((id) => this.nodes.get(id)?.label || id);
        return `Path found (${current.path.length - 1} hops): ${pathLabels.join(' → ')}`;
      }

      if (visited.has(current.id)) continue;
      visited.add(current.id);

      const edges = this.edges.filter((e) => e.source_id === current.id || e.target_id === current.id);
      for (const edge of edges) {
        const nextId = edge.source_id === current.id ? edge.target_id : edge.source_id;
        if (!visited.has(nextId)) {
          queue.push({ id: nextId, path: [...current.path, nextId] });
        }
      }
    }

    return `No path found between "${source.label}" and "${target.label}".`;
  }

  private getStats(): string {
    const byType: Record<string, number> = {};
    for (const node of this.nodes.values()) byType[node.type] = (byType[node.type] || 0) + 1;

    const byRelation: Record<string, number> = {};
    for (const edge of this.edges) byRelation[edge.relation] = (byRelation[edge.relation] || 0) + 1;

    return [
      'Memory Graph Stats:',
      `  Nodes: ${this.nodes.size}`,
      `  Edges: ${this.edges.length}`,
      '',
      'By type:',
      ...Object.entries(byType).map(([t, c]) => `  ${t}: ${c}`),
      '',
      'By relation:',
      ...Object.entries(byRelation).map(([r, c]) => `  ${r}: ${c}`),
    ].join('\n');
  }

  private visualize(args: Record<string, unknown>): string {
    const nodeId = String(args.node_id || '');
    const node = nodeId ? this.nodes.get(nodeId) : null;

    if (node) {
      const edges = this.edges.filter((e) => e.source_id === nodeId || e.target_id === nodeId);
      const lines: string[] = [`[${node.type}] ${node.label}`];
      for (const edge of edges) {
        const neighborId = edge.source_id === nodeId ? edge.target_id : edge.source_id;
        const neighbor = this.nodes.get(neighborId);
        if (neighbor) lines.push(`  → ${edge.relation} → [${neighbor.type}] ${neighbor.label}`);
      }
      return lines.join('\n');
    }

    const lines: string[] = ['Memory Graph Visualization:'];
    for (const node of this.nodes.values()) {
      const edges = this.edges.filter((e) => e.source_id === node.id || e.target_id === node.id);
      lines.push(`  [${node.type}] ${node.label} (${edges.length} edges)`);
    }
    return lines.join('\n');
  }

  private removeNode(args: Record<string, unknown>): string {
    const nodeId = String(args.node_id || '');
    if (!nodeId) return 'Error: "node_id" is required.';

    if (!this.nodes.has(nodeId)) return `Error: node "${nodeId}" not found.`;

    const label = this.nodes.get(nodeId)!.label;
    this.nodes.delete(nodeId);
    this.edges = this.edges.filter((e) => e.source_id !== nodeId && e.target_id !== nodeId);
    this.saveGraph();

    return `Node "${label}" and all its edges removed.`;
  }
}
