import {
  ZavorthTrajectoryCompressorService,
  type TrajectoryTurn,
  type TrajectoryCompressionResult,
} from './ZavorthTrajectoryCompressorService.js';

export interface AutomaticCompactionResult {
  readonly compacted: boolean;
  readonly turns: readonly TrajectoryTurn[];
  readonly tokensBefore: number;
  readonly tokensAfter: number;
  readonly tokensSaved: number;
  readonly summary?: string;
}

export interface AutomaticCompactorOptions {
  readonly contextLimitTokens?: number;
  readonly activationThresholdRatio?: number; // default 0.75 (75%)
  readonly targetCompactedBudget?: number;
  readonly protectedHeadTurns?: number;
  readonly protectedTailTurns?: number;
}

export class AutomaticTrajectoryCompactorService {
  private readonly compressor: ZavorthTrajectoryCompressorService;

  constructor(compressor = new ZavorthTrajectoryCompressorService()) {
    this.compressor = compressor;
  }

  public compactIfNeeded(
    turns: readonly TrajectoryTurn[],
    options: AutomaticCompactorOptions = {}
  ): AutomaticCompactionResult {
    const contextLimit = options.contextLimitTokens || 128000;
    const thresholdRatio = options.activationThresholdRatio || 0.75;
    const activationThreshold = Math.floor(contextLimit * thresholdRatio);

    const totalEstimatedTokens = turns.reduce(
      (sum, t) => sum + (typeof t.estimatedTokens === 'number' ? t.estimatedTokens : this.compressor.estimateTurnTokens(t.content)),
      0
    );

    if (totalEstimatedTokens < activationThreshold || turns.length <= 4) {
      return {
        compacted: false,
        turns,
        tokensBefore: totalEstimatedTokens,
        tokensAfter: totalEstimatedTokens,
        tokensSaved: 0,
      };
    }

    const targetBudget = options.targetCompactedBudget || Math.floor(contextLimit * 0.4);
    const headCount = options.protectedHeadTurns ?? 2;
    const tailCount = options.protectedTailTurns ?? 3;

    const compressionResult = this.compressor.compressTrajectory(
      [...turns],
      {
        targetTokenBudget: targetBudget,
        protectedHeadTurnsCount: headCount,
        protectedTailTurnsCount: tailCount,
      }
    );

    return {
      compacted: true,
      turns: compressionResult.turns,
      tokensBefore: compressionResult.originalTotalTokens,
      tokensAfter: compressionResult.compressedTotalTokens,
      tokensSaved: Math.max(0, compressionResult.originalTotalTokens - compressionResult.compressedTotalTokens),
      summary: `Compacted ${turns.length} turns to ${compressionResult.turns.length} turns (saved ${compressionResult.originalTotalTokens - compressionResult.compressedTotalTokens} tokens, ${compressionResult.tokenSavingsPercentage}% reduction).`,
    };
  }
}
