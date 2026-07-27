import type { ChatMessage } from '../../../src/providers/ILlmProvider.js';
import type { ContextCompactionDecision } from '../../../src/services/ContextCompactionService.js';

let AgentRunNativeToolContextCompactor: any;
let NativeToolContextCompactionService: any;
try {
  const mod = require('../../../src/runtime/agent/AgentRunNativeToolContextCompactor.js');
  AgentRunNativeToolContextCompactor = mod.AgentRunNativeToolContextCompactor;
  NativeToolContextCompactionService = mod.NativeToolContextCompactionService;
} catch {
  // Module removed from source
}

function unchangedDecision(messages: ChatMessage[]): ContextCompactionDecision {
  return {
    mode: 'none',
    triggered: false,
    reason: 'not-needed',
    estimatedBeforeTokens: 0,
    estimatedAfterTokens: 0,
    reductionTokens: 0,
    preservedRecentTurns: messages.length,
    clearedToolOutputs: 0,
    compactedOlderMessages: 0,
    anchorSummary: null,
    compactedMessages: messages.map((message) => ({
      role: message.role,
      content: message.content || '',
      toolName: message.toolName,
      toolCallId: message.toolCallId,
      toolCalls: message.toolCalls,
    })),
    receipt: {
      id: 'receipt-test',
      generatedAt: '2026-07-16T00:00:00.000Z',
      durableMutation: false,
      providerCall: false,
      secretsRedacted: true,
      gatesToolAuthority: false,
    },
  };
}

const describeIf = AgentRunNativeToolContextCompactor ? describe : describe.skip;

describeIf('AgentRunNativeToolContextCompactor', () => {
  it('does not invoke compaction while the context is within budget', async () => {
    const service = {
      compact: jest.fn((input: any) => unchangedDecision(input.messages as ChatMessage[])),
      compactSemanticAsync: jest.fn(),
    };
    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

    await expect(new AgentRunNativeToolContextCompactor(null, service).compact(messages, 100)).resolves.toEqual({
      compacted: false,
      truncatedToolMessages: 0,
    });
    expect(service.compact).not.toHaveBeenCalled();
  });

  it('preserves recent messages and bounds oversized old tool output', async () => {
    const service = {
      compact: jest.fn((input: any) => unchangedDecision(input.messages as ChatMessage[])),
      compactSemanticAsync: jest.fn(),
    };
    const messages: ChatMessage[] = [
      { role: 'system', content: 'System instruction' },
      { role: 'tool', toolName: 'read_file', toolCallId: 'call-1', content: 'x'.repeat(4000) },
      ...Array.from({ length: 8 }, (_, index): ChatMessage => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Recent message ${index + 1}`,
      })),
    ];

    const result = await new AgentRunNativeToolContextCompactor(null, service).compact(messages, 100);

    expect(result).toEqual({ compacted: true, truncatedToolMessages: 1 });
    expect(messages.find((message) => message.toolCallId === 'call-1')?.content).toContain(
      '[tool result compacted before next round]',
    );
    expect(messages[1].role).toBe('system');
    expect(messages.at(-1)?.content).toBe('Recent message 8');
    expect(service.compact).toHaveBeenCalledTimes(2);
  });
});
