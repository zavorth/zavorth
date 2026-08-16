/**
 * Intra-Turn Context Compactor.
 * Automatically compacts verbose intermediate tool outputs and diffs during multi-step agent loops
 * to preserve model token budgets without losing technical directives or recent results.
 */

import type { ChatMessage } from '../../adapters/llm/LLMAdapterContract.js';

export interface CompactionMetrics {
  originalTokens: number;
  compactedTokens: number;
  savingsRatio: number;
  clearedToolOutputs: number;
  preservedMessages: number;
}

export interface CompactorOptions {
  maxBudgetTokens?: number;
  preservedRecentTurns?: number;
  largeOutputThresholdChars?: number;
}

export class IntraTurnCompactor {
  private static readonly DEFAULT_BUDGET_TOKENS = 64000;
  private static readonly DEFAULT_PRESERVED_TURNS = 2;
  private static readonly DEFAULT_LARGE_OUTPUT_THRESHOLD = 1500;

  /**
   * Fast token estimation (approx 4 chars per token).
   */
  static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  static estimateMessagesTokens(messages: ChatMessage[]): number {
    return messages.reduce((acc, m) => acc + this.estimateTokens(m.content), 0);
  }

  /**
   * Compacts a sequence of chat messages if total estimated tokens exceed the budget threshold.
   */
  static compact(
    messages: ChatMessage[],
    options: CompactorOptions = {}
  ): { compactedMessages: ChatMessage[]; metrics: CompactionMetrics } {
    const maxBudget = options.maxBudgetTokens || this.DEFAULT_BUDGET_TOKENS;
    const preservedTurns = options.preservedRecentTurns || this.DEFAULT_PRESERVED_TURNS;
    const largeThreshold = options.largeOutputThresholdChars || this.DEFAULT_LARGE_OUTPUT_THRESHOLD;

    const initialTokens = this.estimateMessagesTokens(messages);
    if (initialTokens <= maxBudget || messages.length <= preservedTurns + 2) {
      return {
        compactedMessages: messages,
        metrics: {
          originalTokens: initialTokens,
          compactedTokens: initialTokens,
          savingsRatio: 0,
          clearedToolOutputs: 0,
          preservedMessages: messages.length,
        },
      };
    }

    let clearedCount = 0;
    const safeBoundaryIdx = Math.max(1, messages.length - preservedTurns);

    const compactedMessages: ChatMessage[] = messages.map((msg, idx) => {
      // Always preserve system messages and recent turns untouched
      if (msg.role === 'system' || idx >= safeBoundaryIdx) {
        return msg;
      }

      // Compact older tool output responses that exceed threshold
      if (msg.role === 'tool' && msg.content && msg.content.length > largeThreshold) {
        clearedCount++;
        const preview = msg.content.slice(0, 300).replace(/\s+/g, ' ').trim();
        const tail = msg.content.slice(-150).replace(/\s+/g, ' ').trim();
        const compactedText = `[COMPACTED_TOOL_OUTPUT tool="${msg.name || 'tool'}"]\n${preview}\n... [${msg.content.length - 450} characters compacted to conserve token budget] ...\n${tail}\n[/COMPACTED_TOOL_OUTPUT]`;

        return {
          ...msg,
          content: compactedText,
        };
      }

      // Compact older assistant tool-call outputs if excessively verbose
      if (msg.role === 'assistant' && msg.content && msg.content.length > largeThreshold && msg.toolCalls) {
        clearedCount++;
        const preview = msg.content.slice(0, 200).replace(/\s+/g, ' ').trim();
        return {
          ...msg,
          content: `${preview}... [Reasoning compacted]`,
        };
      }

      return msg;
    });

    const finalTokens = this.estimateMessagesTokens(compactedMessages);
    const savingsRatio = initialTokens > 0 ? Number(((initialTokens - finalTokens) / initialTokens).toFixed(4)) : 0;

    return {
      compactedMessages,
      metrics: {
        originalTokens: initialTokens,
        compactedTokens: finalTokens,
        savingsRatio,
        clearedToolOutputs: clearedCount,
        preservedMessages: compactedMessages.length,
      },
    };
  }
}
