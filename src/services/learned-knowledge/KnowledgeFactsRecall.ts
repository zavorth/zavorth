/**
 * Knowledge pillar — project facts via Mnemos wiki OS (FTS + keyword + tag + graph).
 * Read-only recall. Never silent-promotes durable memory.
 */

import path from 'node:path';
import fs from 'node:fs';
import {
  ZavorthMnemosQueryService,
} from '../ZavorthMnemosQueryService.js';
import type { ZavorthMnemosQuerySnapshot } from '../../contracts/memory/ZavorthMnemosQueryContract.js';
import { MnemosDreamCycleService } from '../MnemosDreamCycleService.js';
import { ZavorthMnemosPromotionGateService } from '../ZavorthMnemosPromotionGateService.js';
import { resolveLearnedKnowledgeFlags } from './LearnedKnowledgeFlags.js';
import { writeDreamLastPreview } from './LearnedKnowledgeDreamReceipt.js';

export type KnowledgeFactsQueryInput = {
  query: string;
  topK?: number;
  contextTokenBudget?: number;
  projectRoot?: string | null;
};

export type KnowledgeFactsQueryResult = ZavorthMnemosQuerySnapshot & {
  pillar: 'knowledge';
  productLabel: 'Knowledge';
  engine: 'mnemos-wiki-os';
};

export type KnowledgeConsolidatePreview = {
  pillar: 'knowledge';
  mode: 'preview-only';
  durableMutation: false;
  generatedAt: string;
  dream: {
    version: string;
    candidateCount: number;
    quarantineCount: number;
    actionCount: number;
    summary: string;
  };
  promotionGate: {
    canApply: boolean;
    blockers: string[];
    note: string;
  };
  nextSteps: string[];
};

function resolveRoot(projectRoot?: string | null): string {
  return path.resolve(String(projectRoot || process.cwd()));
}

/**
 * Query project knowledge (Mnemos wiki). Wiki is source of truth; SQLite FTS is derived.
 * Does not write durable memory.
 */
export function queryKnowledgeFacts(input: KnowledgeFactsQueryInput): KnowledgeFactsQueryResult {
  const projectRoot = resolveRoot(input.projectRoot);
  const flags = resolveLearnedKnowledgeFlags();
  const budget = Math.max(
    256,
    Math.min(
      Number(input.contextTokenBudget || flags.injectTokenBudget || 1800) || 1800,
      6000,
    ),
  );
  const topK = Math.max(1, Math.min(Number(input.topK || 6) || 6, 20));
  const service = new ZavorthMnemosQueryService({ projectRoot });
  const snap = service.query({
    query: String(input.query || '').trim(),
    topK,
    contextTokenBudget: budget,
  });
  return {
    ...snap,
    pillar: 'knowledge',
    productLabel: 'Knowledge',
    engine: 'mnemos-wiki-os',
  };
}

export function formatKnowledgeFactsLines(result: KnowledgeFactsQueryResult, maxHits = 8): string[] {
  const lines = [
    `Knowledge (Mnemos wiki) · status=${result.status} · hits=${result.summary.hits}`,
    `FTS available: ${result.summary.sqliteFtsAvailable ? 'yes' : 'no (keyword/tag/graph only)'}`,
    `Safety: wiki-only · no network · secrets redacted · no durable mutation (receipt ${result.receipt.id})`,
    '',
  ];
  if (!result.hits.length) {
    lines.push(
      'No knowledge hits.',
      'Ingest or promote facts into .zavorth/wiki (preview + approval).',
      'CLI: npm run mnemos:query -- "<query>" · zavorth knowledge facts "<query>"',
    );
    return lines;
  }
  for (const hit of result.hits.slice(0, maxHits)) {
    const sources = (hit.rankSources || []).join('+') || 'ranked';
    lines.push(
      `• ${hit.title} [${hit.pageId}] score=${hit.score.toFixed?.(2) ?? hit.score} (${sources})`,
      `  ${String(hit.excerpt || '').replace(/\s+/g, ' ').trim().slice(0, 220)}`,
      `  path: ${hit.path}`,
    );
  }
  if (result.context) {
    lines.push('', '--- context pack (budgeted, untrusted) ---', result.context.slice(0, 1200));
  }
  return lines;
}

/**
 * Preview-only consolidation (dream cycle + promotion gate).
 * Never applies without explicit approval id (gate enforces).
 */
export function previewKnowledgeConsolidate(options: {
  projectRoot?: string | null;
  sessionSummary?: string | null;
} = {}): KnowledgeConsolidatePreview {
  const projectRoot = resolveRoot(options.projectRoot);
  const generatedAt = new Date().toISOString();
  const summaryText = String(options.sessionSummary || 'Knowledge consolidate preview (no new observations).').slice(0, 500);
  const dream = new MnemosDreamCycleService().buildCycle({
    storeId: `knowledge-preview:${projectRoot}`,
    sessions: [
      {
        sessionId: 'knowledge-consolidate-preview',
        createdAt: generatedAt,
        summary: summaryText,
        observations: [
          {
            id: 'preview-obs-1',
            kind: 'project-fact',
            text: summaryText,
            evidenceRefs: ['knowledge-consolidate-preview'],
            updatedAt: generatedAt,
            confidence: 0.4,
          },
        ],
      },
    ],
    pruneBefore: null,
  });

  const memories = dream.candidateStore?.memories || [];
  const gate = new ZavorthMnemosPromotionGateService({ projectRoot }).buildSnapshot({
    apply: false,
    approvalId: null,
    candidates: memories.map((m) => ({
      id: m.id,
      targetPage: 'memory' as const,
      fact: String(m.text || '').slice(0, 500),
      source: 'knowledge-consolidate-preview',
      confidence: Number(m.confidence || 0.4),
    })),
  });

  const blockers = [
    ...(gate.apply?.blockers || []),
    'preview-only',
  ];
  if (!gate.apply?.approvalSatisfied) blockers.push('approval-id-required');

  const candidateCount = memories.length;
  const quarantineCount = dream.quarantine?.length || 0;
  const actionCount = dream.actions?.length || 0;

  // Hub last-run surface only — never a durable promote.
  writeDreamLastPreview(projectRoot, {
    generatedAt,
    candidateCount,
    quarantineCount,
    actionCount,
    dreamStatus: String(dream.status || 'ready'),
  });

  return {
    pillar: 'knowledge',
    mode: 'preview-only',
    durableMutation: false,
    generatedAt,
    dream: {
      version: dream.version,
      candidateCount,
      quarantineCount,
      actionCount,
      summary: `Dream status=${dream.status}; candidates=${candidateCount}; quarantine=${quarantineCount}.`,
    },
    promotionGate: {
      canApply: false,
      blockers: Array.from(new Set(blockers)),
      note: 'Promotion requires explicit approval id. Lifecycle hooks never silent-promote to wiki.',
    },
    nextSteps: [
      'Review with npm run mnemos:dream-cycle --silent',
      'Apply only via promotion gate + approval-id (never auto)',
      'Query facts: zavorth knowledge facts "<query>"',
      dream.review?.applyCommand ? `Review apply command: ${dream.review.applyCommand}` : '',
    ].filter(Boolean),
  };
}

export function knowledgeWikiPresent(projectRoot?: string | null): boolean {
  const root = resolveRoot(projectRoot);
  const wikiIndex = path.join(root, '.zavorth', 'wiki', 'index.json');
  return fs.existsSync(wikiIndex);
}
