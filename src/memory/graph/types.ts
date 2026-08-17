/**
 * Knowledge Graph Memory Subsystem Types.
 * Defines strictly typed structures for nodes, edges, subgraphs, and consolidation events.
 * Strictly typed (Zero any) and EN-First.
 */

export type GraphNodeCategory =
  | 'entity'
  | 'concept'
  | 'rule'
  | 'preference'
  | 'technology'
  | 'project_decision'
  | 'architecture';

export type GraphRelationType =
  | 'depends_on'
  | 'uses'
  | 'implements'
  | 'configured_as'
  | 'violates'
  | 'relates_to'
  | 'prefers'
  | 'solved_by';

export interface GraphNode {
  id: string;
  label: string;
  category: GraphNodeCategory;
  description?: string;
  properties: Record<string, string | number | boolean>;
  weight: number;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: GraphRelationType;
  weight: number;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface KnowledgeGraphData {
  version: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  updatedAt: string;
}

export interface SubgraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  depth: number;
}

export interface GraphSearchQuery {
  keyword?: string;
  category?: GraphNodeCategory;
  nodeId?: string;
  depth?: number;
  limit?: number;
}

export interface ExtractedFact {
  subject: string;
  subjectCategory: GraphNodeCategory;
  relation: GraphRelationType;
  object: string;
  objectCategory: GraphNodeCategory;
  description?: string;
  weight?: number;
}

export interface ConsolidationResult {
  nodesAdded: number;
  nodesUpdated: number;
  edgesAdded: number;
  edgesUpdated: number;
  factsProcessed: number;
}
