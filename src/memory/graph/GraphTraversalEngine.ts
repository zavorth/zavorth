/**
 * Knowledge Graph Traversal & Query Engine.
 * Provides BFS/DFS neighborhood exploration, category filtering, and semantic subgraph extraction.
 * Strictly typed (Zero any) and EN-First.
 */

import { KnowledgeGraphStore } from './KnowledgeGraphStore.js';
import type { GraphNode, GraphEdge, SubgraphResult, GraphSearchQuery } from './types.js';

export class GraphTraversalEngine {
  private readonly store: KnowledgeGraphStore;

  constructor(store: KnowledgeGraphStore) {
    this.store = store;
  }

  /**
   * Searches the graph by keyword in label/description or category.
   */
  public search(query: GraphSearchQuery): SubgraphResult {
    const allNodes = this.store.getAllNodes();
    const allEdges = this.store.getAllEdges();

    const matchedNodes = new Map<string, GraphNode>();
    const matchedEdges = new Map<string, GraphEdge>();

    const keyword = query.keyword?.trim().toLowerCase();
    const limit = query.limit || 20;

    for (const node of allNodes) {
      if (query.category && node.category !== query.category) {
        continue;
      }

      if (keyword) {
        const inLabel = node.label.toLowerCase().includes(keyword);
        const inDesc = node.description ? node.description.toLowerCase().includes(keyword) : false;
        if (!inLabel && !inDesc) {
          continue;
        }
      }

      matchedNodes.set(node.id, node);
      if (matchedNodes.size >= limit) {
        break;
      }
    }

    // If starting node ID was provided, explore n-hop neighborhood
    if (query.nodeId) {
      const neighborhood = this.getNeighborhood(query.nodeId, query.depth || 1);
      for (const node of neighborhood.nodes) {
        matchedNodes.set(node.id, node);
      }
      for (const edge of neighborhood.edges) {
        matchedEdges.set(edge.id, edge);
      }
    }

    // Connect edges between matched nodes
    for (const edge of allEdges) {
      if (matchedNodes.has(edge.sourceId) && matchedNodes.has(edge.targetId)) {
        matchedEdges.set(edge.id, edge);
      }
    }

    return {
      nodes: Array.from(matchedNodes.values()),
      edges: Array.from(matchedEdges.values()),
      depth: query.depth || 1,
    };
  }

  /**
   * Performs Breadth-First Search (BFS) starting from a specific node up to maxDepth hops.
   */
  public getNeighborhood(startNodeId: string, maxDepth = 1): SubgraphResult {
    const startNode = this.store.getNode(startNodeId);
    if (!startNode) {
      return { nodes: [], edges: [], depth: 0 };
    }

    const allEdges = this.store.getAllEdges();
    const visitedNodes = new Map<string, GraphNode>([[startNode.id, startNode]]);
    const visitedEdges = new Map<string, GraphEdge>();

    let currentLevel = [startNode.id];

    for (let depth = 1; depth <= maxDepth; depth++) {
      const nextLevel: string[] = [];

      for (const nodeId of currentLevel) {
        for (const edge of allEdges) {
          let neighborId: string | null = null;

          if (edge.sourceId === nodeId) {
            neighborId = edge.targetId;
          } else if (edge.targetId === nodeId) {
            neighborId = edge.sourceId;
          }

          if (neighborId) {
            visitedEdges.set(edge.id, edge);
            if (!visitedNodes.has(neighborId)) {
              const neighborNode = this.store.getNode(neighborId);
              if (neighborNode) {
                visitedNodes.set(neighborId, neighborNode);
                nextLevel.push(neighborId);
              }
            }
          }
        }
      }

      currentLevel = nextLevel;
      if (currentLevel.length === 0) break;
    }

    return {
      nodes: Array.from(visitedNodes.values()),
      edges: Array.from(visitedEdges.values()),
      depth: maxDepth,
    };
  }
}
