import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import {
  ZavorthTrajectoryCompressorService,
  type TrajectoryTurn,
} from '../services/compression/ZavorthTrajectoryCompressorService.js';
import { logger } from '../logger.js';

export class ZavorthTrajectoryCompressorTool extends BaseTool {
  public readonly name = 'zavorth_trajectory_compressor';

  public readonly description =
    'Semantic Trajectory Compression Engine. Compacts long conversational trajectories, tool outputs, and file views into structured digests, saving 50%-70% of context window tokens while preserving reasoning continuity.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action to perform: 'compress', 'estimate_tokens'.",
      },
      turns: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of trajectory turn objects (for action=compress).',
      },
      targetTokenBudget: {
        type: 'number',
        description: 'Target token budget to compress within (default: 4000).',
      },
      content: {
        type: 'string',
        description: 'Text content to estimate tokens for (for action=estimate_tokens).',
      },
    },
    required: ['action'],
  };

  private readonly compressorService: ZavorthTrajectoryCompressorService;

  constructor(service?: ZavorthTrajectoryCompressorService) {
    super();
    this.compressorService = service || new ZavorthTrajectoryCompressorService();
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || 'compress').trim().toLowerCase();

    try {
      switch (action) {
        case 'compress': {
          const rawTurns = Array.isArray(args.turns) ? (args.turns as Record<string, unknown>[]) : [];
          if (rawTurns.length === 0) {
            return JSON.stringify({ error: 'turns array is required for action=compress.' });
          }

          const turns: TrajectoryTurn[] = rawTurns.map((r, idx) => ({
            id: String(r.id || `turn-${idx}`),
            role: (String(r.role || 'assistant') as 'system' | 'user' | 'assistant' | 'tool'),
            content: String(r.content || ''),
            toolCalls: Array.isArray(r.toolCalls) ? (r.toolCalls as any) : undefined,
            estimatedTokens: typeof r.estimatedTokens === 'number'
              ? r.estimatedTokens
              : this.compressorService.estimateTurnTokens(String(r.content || '')),
            isProtectedAnchor: Boolean(r.isProtectedAnchor),
          }));

          const budget = typeof args.targetTokenBudget === 'number' ? args.targetTokenBudget : 4000;
          const headCount = typeof args.protectedHeadTurnsCount === 'number' ? args.protectedHeadTurnsCount : 2;
          const tailCount = typeof args.protectedTailTurnsCount === 'number' ? args.protectedTailTurnsCount : 2;
          const result = this.compressorService.compressTrajectory(turns, {
            targetTokenBudget: budget,
            protectedHeadTurnsCount: headCount,
            protectedTailTurnsCount: tailCount,
          });

          return JSON.stringify({
            success: true,
            originalTotalTokens: result.originalTotalTokens,
            compressedTotalTokens: result.compressedTotalTokens,
            tokenSavingsPercentage: result.tokenSavingsPercentage,
            compressedTurnsCount: result.compressedTurnsCount,
            summaryDigest: result.summaryDigest,
            finalTurnsCount: result.turns.length,
          });
        }

        case 'estimate_tokens': {
          const content = typeof args.content === 'string' ? args.content : '';
          const count = this.compressorService.estimateTurnTokens(content);
          return JSON.stringify({
            success: true,
            estimatedTokens: count,
          });
        }

        default:
          return JSON.stringify({
            error: `Unknown action "${action}". Valid actions: compress, estimate_tokens.`,
          });
      }
    } catch (err: unknown) {
      logger.warn('[ZavorthTrajectoryCompressorTool] execution failed', { error: err });
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }
}
