/**
 * knowledge_recall — agent tool for Knowledge pillar (Mnemos wiki OS).
 * Read-only. Does not promote or mutate durable memory.
 */

import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { formatKnowledgeFactsLines, queryKnowledgeFacts } from '../services/learned-knowledge/KnowledgeFactsRecall.js';

export class KnowledgeRecallTool extends BaseTool {
  public readonly name = 'knowledge_recall';

  public readonly description =
    'Search project knowledge in the local Mnemos wiki (facts, decisions, architecture notes). ' +
    'Use for “what did we decide about X?” — not for prior chat turns (use conversation_recall) ' +
    'and not for multi-tool workflows (use use_learned_skill). ' +
    'Local-only, redacted snippets, no durable writes.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for project knowledge / wiki facts.',
      },
      top_k: {
        type: 'number',
        description: 'Max hits (1–20, default 6).',
      },
      context_token_budget: {
        type: 'number',
        description: 'Token budget for packed context (256–6000, default from plane flags).',
      },
    },
    required: ['query'],
  };

  private readonly projectRoot: string | null;

  constructor(options?: { projectRoot?: string | null }) {
    super();
    this.projectRoot = options?.projectRoot || null;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const query = String(args.query || '').trim();
    if (!query) {
      return 'knowledge_recall requires "query". Example: { "query": "provider readiness" }';
    }
    const topK = typeof args.top_k === 'number' ? args.top_k : Number(args.top_k || 6);
    const budget =
      typeof args.context_token_budget === 'number'
        ? args.context_token_budget
        : Number(args.context_token_budget || 0) || undefined;

    try {
      const result = queryKnowledgeFacts({
        query,
        topK,
        contextTokenBudget: budget,
        projectRoot: this.projectRoot || process.cwd(),
      });
      const lines = [
        'Knowledge recall (Mnemos wiki · untrusted context · no tool authority).',
        ...formatKnowledgeFactsLines(result),
      ];
      return lines.join('\n').slice(0, 7000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error || 'query failed');
      return [
        'Knowledge recall failed.',
        msg,
        'Ensure .zavorth/wiki exists (mnemos ingest) or use conversation_recall for chat history.',
      ].join('\n');
    }
  }
}
