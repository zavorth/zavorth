import type { ChatMessage } from '../../providers/ILlmProvider.js';
import {
  ZavorthTrajectoryCompressorService,
  type TrajectoryTurn,
} from './ZavorthTrajectoryCompressorService.js';
import { TrajectoryFormatAdapter } from './TrajectoryFormatAdapter.js';

export type PreCompressionHook = (turns: readonly TrajectoryTurn[]) => Promise<void>;

export interface AutomaticCompactionResult {
  readonly compacted: boolean;
  readonly turns: readonly TrajectoryTurn[];
  readonly tokensBefore: number;
  readonly tokensAfter: number;
  readonly tokensSaved: number;
  readonly summary?: string;
}

export interface AutomaticMessageCompactionResult {
  readonly messages: ChatMessage[];
  readonly compacted: boolean;
  readonly tokensBefore: number;
  readonly tokensAfter: number;
  readonly tokensSaved: number;
  readonly summary?: string;
}

export interface AutomaticCompactorOptions {
  readonly contextLimitTokens?: number;
  readonly activationThresholdRatio?: number; // default 0.70 (70%)
  readonly maxActivationThresholdTokens?: number; // default 80,000
  readonly targetCompactedBudget?: number;
  readonly protectedHeadTurns?: number; // default 2
  readonly tailBudgetRatio?: number; // default 0.30 (30%)
  readonly maxTailBudgetTokens?: number; // default 15,000
  readonly minSavingsRatio?: number; // default 0.10 (10%)
  readonly onPreCompress?: PreCompressionHook;
  readonly compactionCooldownTurns?: number; // default 3
  readonly currentTurnIndex?: number;
}

export class AutomaticTrajectoryCompactorService {
  private readonly compressor: ZavorthTrajectoryCompressorService;
  private readonly adapter = new TrajectoryFormatAdapter();
  private lastCompactionTurnIndex = -100;
  private consecutiveIneffectiveCount = 0;

  constructor(compressor = new ZavorthTrajectoryCompressorService()) {
    this.compressor = compressor;
  }

  public async compactIfNeededAsync(
    turns: readonly TrajectoryTurn[],
    options: AutomaticCompactorOptions = {},
  ): Promise<AutomaticCompactionResult> {
    const contextLimit = options.contextLimitTokens || 128_000;
    const thresholdRatio = options.activationThresholdRatio || 0.70;
    const maxThreshold = options.maxActivationThresholdTokens || 80_000;
    const activationThreshold = Math.min(Math.floor(contextLimit * thresholdRatio), maxThreshold);

    const totalEstimatedTokens = turns.reduce(
      (sum, t) => sum + (typeof t.estimatedTokens === 'number' ? t.estimatedTokens : this.compressor.estimateTurnTokens(t.content)),
      0,
    );

    // Anti-thrash cooldown check
    const currentTurn = options.currentTurnIndex ?? 0;
    const cooldownTurns = options.compactionCooldownTurns ?? 3;
    if (
      this.consecutiveIneffectiveCount >= 2 &&
      currentTurn - this.lastCompactionTurnIndex < cooldownTurns
    ) {
      return {
        compacted: false,
        turns,
        tokensBefore: totalEstimatedTokens,
        tokensAfter: totalEstimatedTokens,
        tokensSaved: 0,
        summary: 'Compaction skipped (anti-thrash cooldown active due to recent low-yield compactions).',
      };
    }

    if (totalEstimatedTokens < activationThreshold || turns.length <= 4) {
      return {
        compacted: false,
        turns,
        tokensBefore: totalEstimatedTokens,
        tokensAfter: totalEstimatedTokens,
        tokensSaved: 0,
      };
    }

    const headCount = Math.max(1, options.protectedHeadTurns ?? 2);
    const tailCount = this.calculateDynamicTailCount(turns, headCount, contextLimit, options);
    const middleCount = turns.length - headCount - tailCount;

    if (middleCount <= 0) {
      return {
        compacted: false,
        turns,
        tokensBefore: totalEstimatedTokens,
        tokensAfter: totalEstimatedTokens,
        tokensSaved: 0,
      };
    }

    const middleTurns = turns.slice(headCount, turns.length - tailCount);

    // Invoke memory / reflection hook before middle turns are digested
    if (options.onPreCompress) {
      try {
        await options.onPreCompress(middleTurns);
      } catch {
        // Fail-open: reflection error must never block compaction or conversation
      }
    }

    const targetBudget = options.targetCompactedBudget || Math.floor(contextLimit * 0.40);

    const compressionResult = this.compressor.compressTrajectory(
      [...turns],
      {
        targetTokenBudget: targetBudget,
        protectedHeadTurnsCount: headCount,
        protectedTailTurnsCount: tailCount,
      },
    );

    const tokensSaved = Math.max(0, compressionResult.originalTotalTokens - compressionResult.compressedTotalTokens);
    const savingsRatio = compressionResult.originalTotalTokens > 0
      ? tokensSaved / compressionResult.originalTotalTokens
      : 0;

    const minSavings = options.minSavingsRatio ?? 0.10;
    if (savingsRatio < minSavings) {
      this.consecutiveIneffectiveCount += 1;
    } else {
      this.consecutiveIneffectiveCount = 0;
    }

    this.lastCompactionTurnIndex = currentTurn;

    return {
      compacted: true,
      turns: compressionResult.turns,
      tokensBefore: compressionResult.originalTotalTokens,
      tokensAfter: compressionResult.compressedTotalTokens,
      tokensSaved,
      summary: `Compacted ${turns.length} turns to ${compressionResult.turns.length} turns (saved ${tokensSaved} tokens, ${compressionResult.tokenSavingsPercentage}% reduction).`,
    };
  }

  public compactIfNeeded(
    turns: readonly TrajectoryTurn[],
    options: AutomaticCompactorOptions = {},
  ): AutomaticCompactionResult {
    const contextLimit = options.contextLimitTokens || 128_000;
    const thresholdRatio = options.activationThresholdRatio || 0.70;
    const maxThreshold = options.maxActivationThresholdTokens || 80_000;
    const activationThreshold = Math.min(Math.floor(contextLimit * thresholdRatio), maxThreshold);

    const totalEstimatedTokens = turns.reduce(
      (sum, t) => sum + (typeof t.estimatedTokens === 'number' ? t.estimatedTokens : this.compressor.estimateTurnTokens(t.content)),
      0,
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

    const headCount = Math.max(1, options.protectedHeadTurns ?? 2);
    const tailCount = this.calculateDynamicTailCount(turns, headCount, contextLimit, options);
    const targetBudget = options.targetCompactedBudget || Math.floor(contextLimit * 0.40);

    const compressionResult = this.compressor.compressTrajectory(
      [...turns],
      {
        targetTokenBudget: targetBudget,
        protectedHeadTurnsCount: headCount,
        protectedTailTurnsCount: tailCount,
      },
    );

    const tokensSaved = Math.max(0, compressionResult.originalTotalTokens - compressionResult.compressedTotalTokens);

    return {
      compacted: true,
      turns: compressionResult.turns,
      tokensBefore: compressionResult.originalTotalTokens,
      tokensAfter: compressionResult.compressedTotalTokens,
      tokensSaved,
      summary: `Compacted ${turns.length} turns to ${compressionResult.turns.length} turns (saved ${tokensSaved} tokens, ${compressionResult.tokenSavingsPercentage}% reduction).`,
    };
  }

  /**
   * End-to-end ChatMessage compaction with atomic tool-pair grouping.
   */
  public async compactMessagesIfNeeded(
    messages: readonly ChatMessage[],
    options: AutomaticCompactorOptions = {},
  ): Promise<AutomaticMessageCompactionResult> {
    const turns = this.adapter.toTrajectoryTurns(messages);
    const result = await this.compactIfNeededAsync(turns, options);

    if (!result.compacted) {
      return {
        messages: messages.map((m) => ({ ...m })),
        compacted: false,
        tokensBefore: result.tokensBefore,
        tokensAfter: result.tokensAfter,
        tokensSaved: 0,
        summary: result.summary,
      };
    }

    const compactedMessages = this.adapter.toChatMessages(result.turns);

    return {
      messages: compactedMessages,
      compacted: true,
      tokensBefore: result.tokensBefore,
      tokensAfter: result.tokensAfter,
      tokensSaved: result.tokensSaved,
      summary: result.summary,
    };
  }

  private calculateDynamicTailCount(
    turns: readonly TrajectoryTurn[],
    headCount: number,
    contextLimit: number,
    options: AutomaticCompactorOptions,
  ): number {
    const tailRatio = options.tailBudgetRatio ?? 0.30;
    const maxTailTokensCap = options.maxTailBudgetTokens ?? 15_000;
    const maxTailTokenBudget = Math.min(Math.floor(contextLimit * tailRatio), maxTailTokensCap);

    let accumulatedTokens = 0;
    let count = 0;
    const minTailTurns = 2;
    const maxAvailable = Math.max(0, turns.length - headCount - 1);

    for (let i = turns.length - 1; i >= headCount; i -= 1) {
      const turnTokens = typeof turns[i].estimatedTokens === 'number'
        ? turns[i].estimatedTokens
        : this.compressor.estimateTurnTokens(turns[i].content);

      if (count >= minTailTurns && accumulatedTokens + turnTokens > maxTailTokenBudget) {
        break;
      }

      accumulatedTokens += turnTokens;
      count += 1;

      if (count >= maxAvailable) {
        break;
      }
    }

    return Math.max(minTailTurns, Math.min(count, maxAvailable));
  }
}
