/**
 * Memory Graph Consolidator.
 * Synthesizes facts, rules, user preferences, and project decisions into the knowledge graph store.
 * Strictly typed (Zero any) and EN-First.
 */

import { KnowledgeGraphStore } from './KnowledgeGraphStore.js';
import type { ExtractedFact, ConsolidationResult } from './types.js';
import { logger } from '../../logger.js';

export class MemoryGraphConsolidator {
  private readonly store: KnowledgeGraphStore;

  constructor(store: KnowledgeGraphStore) {
    this.store = store;
  }

  /**
   * Ingests a structured fact directly into the graph.
   */
  public ingestFact(fact: ExtractedFact): { nodeAId: string; nodeBId: string; edgeId: string } {
    const safeSubjId = fact.subject.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '_');
    const safeObjId = fact.object.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '_');

    const nodeA = this.store.upsertNode(
      safeSubjId,
      fact.subject,
      fact.subjectCategory,
      {},
      fact.description,
      fact.weight || 1,
    );

    const nodeB = this.store.upsertNode(
      safeObjId,
      fact.object,
      fact.objectCategory,
      {},
      undefined,
      fact.weight || 1,
    );

    const edge = this.store.upsertEdge(
      safeSubjId,
      safeObjId,
      fact.relation,
      undefined,
      fact.weight || 1,
    );

    logger.debug(`[GraphConsolidator] Consolidated fact: (${fact.subject}) -[${fact.relation}]-> (${fact.object})`);

    return {
      nodeAId: nodeA.node.id,
      nodeBId: nodeB.node.id,
      edgeId: edge.edge.id,
    };
  }

  /**
   * Consolidates a batch of facts and returns statistics.
   */
  public consolidateBatch(facts: ExtractedFact[]): ConsolidationResult {
    let nodesAdded = 0;
    let nodesUpdated = 0;
    let edgesAdded = 0;
    let edgesUpdated = 0;

    for (const fact of facts) {
      const safeSubjId = fact.subject.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '_');
      const safeObjId = fact.object.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '_');

      const resA = this.store.upsertNode(safeSubjId, fact.subject, fact.subjectCategory, {}, fact.description, fact.weight || 1);
      if (resA.isNew) nodesAdded++; else nodesUpdated++;

      const resB = this.store.upsertNode(safeObjId, fact.object, fact.objectCategory, {}, undefined, fact.weight || 1);
      if (resB.isNew) nodesAdded++; else nodesUpdated++;

      const resEdge = this.store.upsertEdge(safeSubjId, safeObjId, fact.relation, undefined, fact.weight || 1);
      if (resEdge.isNew) edgesAdded++; else edgesUpdated++;
    }

    return {
      nodesAdded,
      nodesUpdated,
      edgesAdded,
      edgesUpdated,
      factsProcessed: facts.length,
    };
  }

  /**
   * Simple rule-based extraction for common project patterns from raw session text.
   */
  public extractAndConsolidateFromText(text: string): ConsolidationResult {
    const facts: ExtractedFact[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Extract technology/dependency mentions
      if (/uses|using|depends on|built with/i.test(trimmed)) {
        const parts = trimmed.split(/uses|using|depends on|built with/i);
        if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
          facts.push({
            subject: parts[0].trim(),
            subjectCategory: 'technology',
            relation: 'uses',
            object: parts[1].trim().replace(/[.;,]$/, ''),
            objectCategory: 'technology',
          });
        }
      }

      // Extract preferences
      if (/prefers|preferred|always use/i.test(trimmed)) {
        const parts = trimmed.split(/prefers|preferred|always use/i);
        if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
          facts.push({
            subject: 'User',
            subjectCategory: 'preference',
            relation: 'prefers',
            object: parts[1].trim().replace(/[.;,]$/, ''),
            objectCategory: 'rule',
          });
        }
      }
    }

    return this.consolidateBatch(facts);
  }
}
