/**
 * Zavorth Memory Graph Tool.
 * Exposes knowledge graph query, fact ingestion, subgraph extraction,
 * and continuous memory consolidation via ToolRegistry and Cognitive Firewall.
 * Strictly typed (Zero any) and EN-First.
 */

import { BaseTool } from './BaseTool.js';
import {
  KnowledgeGraphStore,
  GraphTraversalEngine,
  MemoryGraphConsolidator,
  type GraphNodeCategory,
  type GraphRelationType,
  type ExtractedFact,
} from '../memory/graph/index.js';

export interface ZavorthMemoryGraphInput {
  action: 'add_fact' | 'query' | 'get_subgraph' | 'consolidate_text' | 'stats' | 'clear';
  subject?: string;
  subjectCategory?: GraphNodeCategory;
  relation?: GraphRelationType;
  object?: string;
  objectCategory?: GraphNodeCategory;
  description?: string;
  keyword?: string;
  category?: GraphNodeCategory;
  nodeId?: string;
  depth?: number;
  limit?: number;
  text?: string;
}

export class ZavorthMemoryGraphTool extends BaseTool {
  public static readonly name = 'zavorth_memory_graph';
  public static readonly description =
    'Queries and updates the persistent knowledge graph memory, enabling relational recall of facts, rules, user preferences, and project architectures.';

  public static readonly schema = {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['add_fact', 'query', 'get_subgraph', 'consolidate_text', 'stats', 'clear'],
        description: 'Action to perform on the knowledge graph memory.',
      },
      subject: { type: 'string', description: 'Subject entity when action is add_fact.' },
      subjectCategory: {
        type: 'string',
        enum: ['entity', 'concept', 'rule', 'preference', 'technology', 'project_decision', 'architecture'],
        description: 'Category for the subject entity.',
      },
      relation: {
        type: 'string',
        enum: ['depends_on', 'uses', 'implements', 'configured_as', 'violates', 'relates_to', 'prefers', 'solved_by'],
        description: 'Relationship type between subject and object.',
      },
      object: { type: 'string', description: 'Object entity when action is add_fact.' },
      objectCategory: {
        type: 'string',
        enum: ['entity', 'concept', 'rule', 'preference', 'technology', 'project_decision', 'architecture'],
        description: 'Category for the object entity.',
      },
      description: { type: 'string', description: 'Optional explanation or context for the fact.' },
      keyword: { type: 'string', description: 'Search term when action is query.' },
      category: {
        type: 'string',
        enum: ['entity', 'concept', 'rule', 'preference', 'technology', 'project_decision', 'architecture'],
        description: 'Filter category when action is query.',
      },
      nodeId: { type: 'string', description: 'Target node ID for neighborhood exploration.' },
      depth: { type: 'number', description: 'Search depth / hop count (default: 1).' },
      limit: { type: 'number', description: 'Maximum nodes to return (default: 20).' },
      text: { type: 'string', description: 'Raw conversation text when action is consolidate_text.' },
    },
    required: ['action'] as string[],
  };

  private static globalStore: KnowledgeGraphStore | null = null;

  public static getStore(): KnowledgeGraphStore {
    if (!this.globalStore) {
      this.globalStore = new KnowledgeGraphStore();
    }
    return this.globalStore;
  }

  readonly name = ZavorthMemoryGraphTool.name;
  readonly description = ZavorthMemoryGraphTool.description;
  readonly parameters = ZavorthMemoryGraphTool.schema;

  public async execute(args: Record<string, unknown>): Promise<string> {
    return ZavorthMemoryGraphTool.execute(args as unknown as ZavorthMemoryGraphInput);
  }

  public static async execute(input: ZavorthMemoryGraphInput): Promise<string> {
    const store = this.getStore();
    const traversal = new GraphTraversalEngine(store);
    const consolidator = new MemoryGraphConsolidator(store);

    switch (input.action) {
      case 'add_fact': {
        if (!input.subject || !input.object || !input.relation) {
          return JSON.stringify({
            status: 'error',
            message: 'subject, object, and relation are required to add a fact.',
          });
        }

        const fact: ExtractedFact = {
          subject: input.subject,
          subjectCategory: input.subjectCategory || 'concept',
          relation: input.relation,
          object: input.object,
          objectCategory: input.objectCategory || 'concept',
          description: input.description,
        };

        const result = consolidator.ingestFact(fact);
        return JSON.stringify({
          status: 'success',
          action: 'add_fact',
          result,
          message: `Consolidated fact: (${input.subject}) -[${input.relation}]-> (${input.object}).`,
        });
      }

      case 'query': {
        const results = traversal.search({
          keyword: input.keyword,
          category: input.category,
          nodeId: input.nodeId,
          depth: input.depth || 1,
          limit: input.limit || 20,
        });

        return JSON.stringify({
          status: 'success',
          action: 'query',
          totalNodes: results.nodes.length,
          totalEdges: results.edges.length,
          nodes: results.nodes,
          edges: results.edges,
        });
      }

      case 'get_subgraph': {
        if (!input.nodeId) {
          return JSON.stringify({
            status: 'error',
            message: 'nodeId is required to get a subgraph neighborhood.',
          });
        }

        const neighborhood = traversal.getNeighborhood(input.nodeId, input.depth || 1);
        return JSON.stringify({
          status: 'success',
          action: 'get_subgraph',
          startNodeId: input.nodeId,
          depth: neighborhood.depth,
          nodesCount: neighborhood.nodes.length,
          edgesCount: neighborhood.edges.length,
          nodes: neighborhood.nodes,
          edges: neighborhood.edges,
        });
      }

      case 'consolidate_text': {
        if (!input.text) {
          return JSON.stringify({
            status: 'error',
            message: 'text is required to consolidate memory.',
          });
        }

        const stats = consolidator.extractAndConsolidateFromText(input.text);
        return JSON.stringify({
          status: 'success',
          action: 'consolidate_text',
          stats,
          message: `Extracted and consolidated ${stats.factsProcessed} facts into the knowledge graph.`,
        });
      }

      case 'stats': {
        const allNodes = store.getAllNodes();
        const allEdges = store.getAllEdges();

        const categoryCounts: Record<string, number> = {};
        for (const node of allNodes) {
          categoryCounts[node.category] = (categoryCounts[node.category] || 0) + 1;
        }

        return JSON.stringify({
          status: 'success',
          action: 'stats',
          totalNodes: allNodes.length,
          totalEdges: allEdges.length,
          categories: categoryCounts,
        });
      }

      case 'clear': {
        store.clear();
        return JSON.stringify({
          status: 'success',
          action: 'clear',
          message: 'Knowledge graph memory cleared.',
        });
      }

      default:
        return JSON.stringify({
          status: 'error',
          message: `Unknown action: ${String(input.action)}`,
        });
    }
  }
}
