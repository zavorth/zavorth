/**
 * Persistent Knowledge Graph Store.
 * Provides atomic, thread-safe JSON persistence for nodes and edges in the graph memory.
 * Strictly typed (Zero any) and EN-First.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GraphNode, GraphEdge, KnowledgeGraphData, GraphNodeCategory, GraphRelationType } from './types.js';
import { logger } from '../../logger.js';

export class KnowledgeGraphStore {
  private readonly storePath: string;
  private readonly nodesMap = new Map<string, GraphNode>();
  private readonly edgesMap = new Map<string, GraphEdge>();
  private isLoaded = false;

  constructor(storageDir: string = path.join(process.cwd(), '.zavorth', 'memory')) {
    this.storePath = path.join(path.resolve(storageDir), 'knowledge-graph.json');
  }

  private ensureLoaded(): void {
    if (this.isLoaded) return;
    this.loadFromDisk();
    this.isLoaded = true;
  }

  private loadFromDisk(): void {
    if (!fs.existsSync(this.storePath)) {
      return;
    }

    try {
      const content = fs.readFileSync(this.storePath, 'utf-8');
      const data: KnowledgeGraphData = JSON.parse(content);

      this.nodesMap.clear();
      this.edgesMap.clear();

      for (const node of data.nodes || []) {
        this.nodesMap.set(node.id, node);
      }
      for (const edge of data.edges || []) {
        this.edgesMap.set(edge.id, edge);
      }
      logger.debug(`[KnowledgeGraphStore] Loaded ${this.nodesMap.size} nodes and ${this.edgesMap.size} edges from disk.`);
    } catch (err: unknown) {
      logger.error(
        `[KnowledgeGraphStore] Failed to load knowledge graph from "${this.storePath}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private saveToDisk(): void {
    const data: KnowledgeGraphData = {
      version: '1.0.0',
      nodes: Array.from(this.nodesMap.values()),
      edges: Array.from(this.edgesMap.values()),
      updatedAt: new Date().toISOString(),
    };

    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tmpPath = `${this.storePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.storePath);
  }

  public upsertNode(
    id: string,
    label: string,
    category: GraphNodeCategory,
    properties: Record<string, string | number | boolean> = {},
    description?: string,
    weightDelta = 1,
  ): { node: GraphNode; isNew: boolean } {
    this.ensureLoaded();

    const existing = this.nodesMap.get(id);
    const now = new Date().toISOString();

    if (existing) {
      existing.label = label;
      existing.category = category;
      existing.properties = { ...existing.properties, ...properties };
      if (description) existing.description = description;
      existing.weight += weightDelta;
      existing.updatedAt = now;
      this.saveToDisk();
      return { node: existing, isNew: false };
    }

    const newNode: GraphNode = {
      id,
      label,
      category,
      description,
      properties,
      weight: Math.max(1, weightDelta),
      createdAt: now,
      updatedAt: now,
    };

    this.nodesMap.set(id, newNode);
    this.saveToDisk();
    return { node: newNode, isNew: true };
  }

  public upsertEdge(
    sourceId: string,
    targetId: string,
    relation: GraphRelationType,
    metadata?: Record<string, string | number | boolean>,
    weightDelta = 1,
  ): { edge: GraphEdge; isNew: boolean } {
    this.ensureLoaded();

    const edgeId = `${sourceId}:${relation}:${targetId}`;
    const existing = this.edgesMap.get(edgeId);

    if (existing) {
      existing.weight += weightDelta;
      if (metadata) {
        existing.metadata = { ...existing.metadata, ...metadata };
      }
      this.saveToDisk();
      return { edge: existing, isNew: false };
    }

    const newEdge: GraphEdge = {
      id: edgeId,
      sourceId,
      targetId,
      relation,
      weight: Math.max(1, weightDelta),
      metadata,
      createdAt: new Date().toISOString(),
    };

    this.edgesMap.set(edgeId, newEdge);
    this.saveToDisk();
    return { edge: newEdge, isNew: true };
  }

  public getNode(id: string): GraphNode | undefined {
    this.ensureLoaded();
    return this.nodesMap.get(id);
  }

  public getAllNodes(): GraphNode[] {
    this.ensureLoaded();
    return Array.from(this.nodesMap.values());
  }

  public getAllEdges(): GraphEdge[] {
    this.ensureLoaded();
    return Array.from(this.edgesMap.values());
  }

  public deleteNode(id: string): boolean {
    this.ensureLoaded();
    const deleted = this.nodesMap.delete(id);
    if (!deleted) return false;

    for (const [edgeId, edge] of this.edgesMap.entries()) {
      if (edge.sourceId === id || edge.targetId === id) {
        this.edgesMap.delete(edgeId);
      }
    }

    this.saveToDisk();
    return true;
  }

  public clear(): void {
    this.nodesMap.clear();
    this.edgesMap.clear();
    this.isLoaded = true;
    this.saveToDisk();
  }
}
