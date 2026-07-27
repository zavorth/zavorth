import { Database } from '../storage/Database.js';
import { logger } from '../logger.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import type { ILlmProvider } from '../providers/ILlmProvider.js';
import { asErrorLike } from '../utils/errorLike.js';

export interface PathNodeInfo {
  id: string;
  name: string;
  type: string;
  content: string;
}

export class MccPathfinderService {
  private db!: Database;
  private initialized = false;
  private provider: ILlmProvider | null = null;
  private readonly providerName = 'default';

  private getProvider(): ILlmProvider {
    if (!this.provider) {
      this.provider = ProviderFactory.create(this.providerName);
    }
    return this.provider;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.db = await Database.getInstance();
    this.initialized = true;
  }

  /**
   * Finds the shortest connection chain between two nodes (BFS).
   */
  public async findShortestPath(startNodeId: string, endNodeId: string): Promise<string[]> {
    await this.init();

    // Load all edges from the database for in-memory search (extremely fast and local)
    const edges = this.db.all<{ source_node_id: string; target_node_id: string }>(
      'SELECT source_node_id, target_node_id FROM mcc_edges'
    );

    // Build bidirectional adjacency list (semantic/relational connection)
    const adjacencyList = new Map<string, Set<string>>();
    for (const edge of edges) {
      const src = edge.source_node_id;
      const dest = edge.target_node_id;

      if (!adjacencyList.has(src)) adjacencyList.set(src, new Set());
      if (!adjacencyList.has(dest)) adjacencyList.set(dest, new Set());

      adjacencyList.get(src)!.add(dest);
      adjacencyList.get(dest)!.add(src); // Bidirectional for general context navigation.
    }

    if (!adjacencyList.has(startNodeId) || !adjacencyList.has(endNodeId)) {
      return [];
    }

    // BFS algorithm to find the shortest path
    const queue: string[] = [startNodeId];
    const visited = new Set<string>([startNodeId]);
    const parentMap = new Map<string, string>();

    let found = false;
    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === endNodeId) {
        found = true;
        break;
      }

      const neighbors = adjacencyList.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parentMap.set(neighbor, current);
          queue.push(neighbor);
        }
      }
    }

    if (!found) {
      return [];
    }

    // Reconstruct the path backwards
    const path: string[] = [];
    let curr = endNodeId;
    while (curr !== startNodeId) {
      path.push(curr);
      curr = parentMap.get(curr)!;
    }
    path.push(startNodeId);
    return path.reverse();
  }

  /**
   * Scans the user query, finds semantically related nodes and extracts the context chain.
   */
  public async resolveContextForQuery(userQuery: string): Promise<string> {
    await this.init();
    const cleanQuery = String(userQuery || '').toLowerCase().trim();
    if (!cleanQuery) return '';

    // 1. Locate nodes that match the key terms cited in the query.
    const allNodes = this.db.all<{ id: string; name: string }>(
      'SELECT id, name FROM mcc_nodes'
    );

    const matchedNodes: string[] = [];
    let tokens = cleanQuery.split(/\s+/).filter((t) => t.length > 3);

    // Call LLM to extract translated technical terms in English
    try {
      const provider = this.getProvider();
      const response = await provider.chat([
        {
          role: 'system',
          content: `You are a technical concept extractor. Analyze the user's query and extract 1 to 3 key programming terms, class names, file names, or database tables in English. Translate any conceptual terms to English.
Respond with ONLY a JSON array of strings:
["term1", "term2", ...]`
        },
        {
          role: 'user',
          content: userQuery
        }
      ], [], { modelName: undefined });

      const content = response.content || '';
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const extractedTokens = parsed.map((t: string) => t.toLowerCase().trim()).filter((t) => t.length > 2);
        tokens = Array.from(new Set([...tokens, ...extractedTokens]));
        logger.info(`[MCC Pathfinder] Extracted tokens from LLM: ${JSON.stringify(extractedTokens)}`);
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error(`[MCC Pathfinder] LLM concept extraction failed, using fallback tokens: ${err.message}`);
    }

    for (const node of allNodes) {
      const nodeNameLower = node.name.toLowerCase();
      const nodeIdLower = node.id.toLowerCase();

      // Check if the node name or ID matches the query tokens
      const isMatched = tokens.some((token) => nodeNameLower.includes(token) || nodeIdLower.includes(token));
      if (isMatched) {
        matchedNodes.push(node.id);
      }
    }

    // If no direct node found, return empty
    if (matchedNodes.length === 0) {
      return '';
    }

    // If only one found, return its content
    if (matchedNodes.length === 1) {
      const singleNode = this.db.get<PathNodeInfo>(
        'SELECT id, name, type, content FROM mcc_nodes WHERE id = ?',
        [matchedNodes[0]]
      );
      if (!singleNode) return '';
      return `[GRAPH RAG] Related Element Found:\n- Name: ${singleNode.name} (${singleNode.type})\n- Path: ${singleNode.id}\n- Preview:\n${singleNode.content}\n`;
    }

    // 2. If there are multiple nodes, try to trace the shortest connecting path
    // that connects the first two located nodes
    const startNode = matchedNodes[0];
    const endNode = matchedNodes[1];
    const pathIds = await this.findShortestPath(startNode, endNode);

    if (pathIds.length === 0) {
      // If there is no direct connection path, return the individual content of the found nodes
      const selectIds = matchedNodes.slice(0, 3);
      const nodesData = this.db.all<PathNodeInfo>(
        `SELECT id, name, type, content FROM mcc_nodes WHERE id IN (${selectIds.map(() => '?').join(',')})`,
        selectIds
      );
      
      let context = `[GRAPH RAG] Isolated Semantic Elements (No direct mutual dependency):\n`;
      for (const n of nodesData) {
        context += `\n--- [${n.name}] (${n.type} | ID: ${n.id}) ---\n${n.content}\n`;
      }
      return context;
    }

    // 3. If there is a structural connection path, extract the content of all nodes in the path
    const nodesData = this.db.all<PathNodeInfo>(
      `SELECT id, name, type, content FROM mcc_nodes WHERE id IN (${pathIds.map(() => '?').join(',')})`,
      pathIds
    );

    // Arrange in path order
    const orderedNodes = pathIds.map((id) => nodesData.find((n) => n.id === id)).filter(Boolean) as PathNodeInfo[];

    let context = `[GRAPH RAG] Relational Connection Chain (Shortest path found):\n`;
    context += `Logical Path: ${orderedNodes.map((n) => `[${n.name}]`).join(' -> ')}\n`;

    for (const n of orderedNodes) {
      context += `\n--- [Node: ${n.name}] (Type: ${n.type} | ID: ${n.id}) ---\n${n.content}\n`;
    }

    return context;
  }
}
