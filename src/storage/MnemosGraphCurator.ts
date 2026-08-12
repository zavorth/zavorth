export interface MemoryNode {
  id: string;
  category: string;
  content: string;
  tags: string[];
  timestamp: number;
}

export interface ConsolidationResult {
  nodesConsolidated: number;
  graphEdgesAdded: Array<{ from: string; to: string; type: string }>;
}

export class MnemosGraphCurator {
  async consolidateMemoryNodes(nodes: MemoryNode[]): Promise<ConsolidationResult> {
    const edges: Array<{ from: string; to: string; type: string }> = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].category === nodes[j].category) {
          edges.push({ from: nodes[i].id, to: nodes[j].id, type: 'same-category' });
        }
      }
    }
    return {
      nodesConsolidated: nodes.length,
      graphEdgesAdded: edges,
    };
  }
}
