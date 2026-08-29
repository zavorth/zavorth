import { AutomaticTrajectoryCompactorService } from '../../../src/services/compression/AutomaticTrajectoryCompactorService.js';
import type { TrajectoryTurn } from '../../../src/services/compression/ZavorthTrajectoryCompressorService.js';
import type { ChatMessage } from '../../../src/providers/ILlmProvider.js';

describe('AutomaticTrajectoryCompactorService', () => {
  let compactor: AutomaticTrajectoryCompactorService;

  beforeEach(() => {
    compactor = new AutomaticTrajectoryCompactorService();
  });

  it('skips compaction when token usage is below threshold', () => {
    const turns: TrajectoryTurn[] = [
      { id: '1', role: 'user', content: 'Short query', estimatedTokens: 10 },
      { id: '2', role: 'assistant', content: 'Short reply', estimatedTokens: 15 },
    ];

    const result = compactor.compactIfNeeded(turns, { contextLimitTokens: 10000 });
    expect(result.compacted).toBe(false);
    expect(result.turns).toHaveLength(2);
    expect(result.tokensSaved).toBe(0);
  });

  it('caps activation threshold at maxActivationThresholdTokens for 1M+ models', () => {
    // 1,000,000 context window with 70% would normally be 700,000, but capped at 80,000 tokens
    const turns: TrajectoryTurn[] = [
      { id: '1', role: 'user', content: 'Prompt', estimatedTokens: 100 },
      { id: '2', role: 'assistant', content: 'Reply', estimatedTokens: 100 },
      { id: '3', role: 'user', content: 'Next', estimatedTokens: 100 },
      { id: '4', role: 'assistant', content: 'Reply 2', estimatedTokens: 100 },
      { id: '5', role: 'user', content: 'Next 2', estimatedTokens: 100 },
    ];

    // Total tokens 500 < 80,000 -> does not compact
    const result = compactor.compactIfNeeded(turns, {
      contextLimitTokens: 1_000_000,
      activationThresholdRatio: 0.70,
      maxActivationThresholdTokens: 80_000,
    });
    expect(result.compacted).toBe(false);
  });

  it('triggers transparent compaction when token usage exceeds threshold', () => {
    const longTurnContent = 'x'.repeat(4000);
    const turns: TrajectoryTurn[] = [
      { id: '1', role: 'user', content: 'Initial user prompt requirement', estimatedTokens: 200, isProtectedAnchor: true },
      { id: '2', role: 'assistant', content: 'Beginning investigation.', estimatedTokens: 100 },
      { id: '3', role: 'tool', content: `Tool output: ${longTurnContent}`, estimatedTokens: 1200 },
      { id: '4', role: 'tool', content: `Second tool output: ${longTurnContent}`, estimatedTokens: 1200 },
      { id: '5', role: 'tool', content: `Third tool output: ${longTurnContent}`, estimatedTokens: 1200 },
      { id: '6', role: 'assistant', content: 'Finished analysis.', estimatedTokens: 100 },
      { id: '7', role: 'user', content: 'Please apply the fix.', estimatedTokens: 50 },
    ];

    const result = compactor.compactIfNeeded(turns, {
      contextLimitTokens: 4000,
      activationThresholdRatio: 0.75,
      targetCompactedBudget: 1500,
    });

    expect(result.compacted).toBe(true);
    expect(result.tokensSaved).toBeGreaterThan(0);
    expect(result.summary).toContain('Compacted');
  });

  it('invokes onPreCompress hook with middle turns before compaction', async () => {
    let capturedTurns: readonly TrajectoryTurn[] | null = null;
    const longTurnContent = 'x'.repeat(4000);
    const turns: TrajectoryTurn[] = [
      { id: '1', role: 'user', content: 'Head turn 1', estimatedTokens: 200 },
      { id: '2', role: 'assistant', content: 'Head turn 2', estimatedTokens: 100 },
      { id: '3', role: 'tool', content: `Tool 1: ${longTurnContent}`, estimatedTokens: 1500 },
      { id: '4', role: 'tool', content: `Tool 2: ${longTurnContent}`, estimatedTokens: 1500 },
      { id: '5', role: 'assistant', content: 'Tail turn 1', estimatedTokens: 100 },
      { id: '6', role: 'user', content: 'Tail turn 2', estimatedTokens: 50 },
    ];

    const result = await compactor.compactIfNeededAsync(turns, {
      contextLimitTokens: 3000,
      activationThresholdRatio: 0.70,
      onPreCompress: async (middleTurns) => {
        capturedTurns = middleTurns;
      },
    });

    expect(result.compacted).toBe(true);
    expect(capturedTurns).not.toBeNull();
    expect(capturedTurns!.length).toBeGreaterThan(0);
    expect(capturedTurns![0].id).toBe('3');
  });

  it('compacts ChatMessage array end-to-end preserving tool pairs', async () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are an agent.' },
      { role: 'user', content: 'First request' },
      {
        role: 'assistant',
        content: 'Investigating',
        toolCalls: [{ id: 'call-1', name: 'terminal', arguments: { cmd: 'npm test' } }],
      },
      { role: 'tool', toolCallId: 'call-1', toolName: 'terminal', content: 'Large test output '.repeat(200) },
      {
        role: 'assistant',
        content: 'Investigating 2',
        toolCalls: [{ id: 'call-2', name: 'read_file', arguments: { path: 'app.ts' } }],
      },
      { role: 'tool', toolCallId: 'call-2', toolName: 'read_file', content: 'Large file output '.repeat(200) },
      { role: 'assistant', content: 'Recent reply' },
      { role: 'user', content: 'Recent request' },
    ];

    const result = await compactor.compactMessagesIfNeeded(messages, {
      contextLimitTokens: 1000,
      activationThresholdRatio: 0.50,
      targetCompactedBudget: 400,
    });

    expect(result.compacted).toBe(true);
    expect(result.tokensSaved).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(messages.length);

    // Verify no orphan tool messages
    for (let i = 0; i < result.messages.length; i += 1) {
      if (result.messages[i].role === 'tool') {
        const prev = result.messages[i - 1];
        expect(prev?.role).toBe('assistant');
        expect(prev?.toolCalls).toBeDefined();
      }
    }
  });
});
