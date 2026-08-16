import { describe, it, expect } from '@jest/globals';
import { IntraTurnCompactor } from '../../../src/runtime/agent/IntraTurnCompactor.js';
import type { ChatMessage } from '../../../src/adapters/llm/LLMAdapterContract.js';

describe('IntraTurnCompactor (Token-Budgeted Tool Output Compaction)', () => {
  it('should not compact messages if total tokens are within budget', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'List directory' },
      { role: 'tool', name: 'list_dir', content: 'file1.ts\nfile2.ts' },
    ];

    const { compactedMessages, metrics } = IntraTurnCompactor.compact(messages, {
      maxBudgetTokens: 1000,
    });

    expect(compactedMessages.length).toBe(3);
    expect(metrics.savingsRatio).toBe(0);
    expect(metrics.clearedToolOutputs).toBe(0);
  });

  it('should compact large older tool outputs while preserving recent turns and system messages', () => {
    const hugeOutput = 'A'.repeat(3000);
    const messages: ChatMessage[] = [
      { role: 'system', content: 'System instruction invariant' },
      { role: 'user', content: 'Step 1: read large file' },
      { role: 'tool', name: 'read_file', content: hugeOutput },
      { role: 'assistant', content: 'I read the file. Now step 2.' },
      { role: 'user', content: 'Step 2: run tests' },
      { role: 'tool', name: 'run_tests', content: 'Test passed 10/10' },
    ];

    const { compactedMessages, metrics } = IntraTurnCompactor.compact(messages, {
      maxBudgetTokens: 100, // force compaction
      preservedRecentTurns: 2,
      largeOutputThresholdChars: 500,
    });

    expect(metrics.clearedToolOutputs).toBe(1);
    expect(metrics.savingsRatio).toBeGreaterThan(0.3);

    // Verify system message untouched
    expect(compactedMessages[0].content).toBe('System instruction invariant');

    // Verify older tool output was compacted
    expect(compactedMessages[2].content).toContain('[COMPACTED_TOOL_OUTPUT');
    expect(compactedMessages[2].content.length).toBeLessThan(hugeOutput.length);

    // Verify recent tool output preserved verbatim
    expect(compactedMessages[5].content).toBe('Test passed 10/10');
  });
});
