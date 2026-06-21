import {
  buildZavorthMnemosMemoryOsContractSnapshot,
  ZAVORTH_MNEMOS_WIKI_ROOT,
} from '../../src/contracts/ZavorthMnemosMemoryOsContract';
import {
  ContextCompactionService,
  type ContextCompactionMessage,
} from '../../src/services/ContextCompactionService';

function bulkyToolOutput(): string {
  return Array.from({ length: 240 }, (_, index) => `stdout ${index}: repeated build line`).join('\n');
}

describe('Zavorth Mnemos Memory OS contract', () => {
  it('declares the governed four-tier memory model and wiki boundary', () => {
    const snapshot = buildZavorthMnemosMemoryOsContractSnapshot(new Date('2026-05-18T12:00:00.000Z'));

    expect(snapshot.version).toContain('mnemos-memory-os-v3');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      tiers: 4,
      compactionModes: 3,
      wikiLoops: 3,
      defaultIdleMicrocompactMinutes: 60,
      reservedTokenBuffer: 15000,
      recentVerbatimTurns: 5,
    }));
    expect(snapshot.tiers.map((tier) => tier.tier)).toEqual([
      'working',
      'episodic',
      'semantic',
      'procedural',
    ]);
    expect(snapshot.wiki.root).toBe(ZAVORTH_MNEMOS_WIKI_ROOT);
    expect(snapshot.hardRules).toContain('Compaction never grants tool authority.');
  });
});

describe('ContextCompactionService', () => {
  it('microcompacts stale bulky tool output without touching recent turns', () => {
    const service = new ContextCompactionService();
    const now = new Date('2026-05-18T12:00:00.000Z');
    const messages: ContextCompactionMessage[] = [
      { role: 'user', content: 'Analyze the repository.' },
      { role: 'assistant', content: 'Let me run a shell command.', toolCalls: [{ id: 'call-shell-1', name: 'shell', arguments: {} }] },
      { role: 'tool', toolName: 'shell', toolCallId: 'call-shell-1', status: 'ok', content: bulkyToolOutput() },
      { role: 'assistant', content: 'I found the architecture entrypoints.' },
      { role: 'user', content: 'Keep this exact instruction for the next step.' },
    ];

    const result = service.compact({
      messages,
      now,
      lastActivityAt: new Date(now.getTime() - 61 * 60 * 1000),
      usableContextTokens: 50000,
      recentVerbatimTurns: 2,
    });

    expect(result.mode).toBe('time-based-microcompact');
    expect(result.triggered).toBe(true);
    expect(result.clearedToolOutputs).toBe(1);
    expect(result.compactedMessages[2].content).toContain('[Old tool result cleared (shell)');
    expect(result.compactedMessages.at(-1)?.content).toBe('Keep this exact instruction for the next step.');
    expect(result.receipt).toEqual(expect.objectContaining({
      durableMutation: false,
      providerCall: false,
      gatesToolAuthority: false,
      secretsRedacted: true,
    }));
  });

  it('builds an anchored summary when the token budget is exceeded', () => {
    const service = new ContextCompactionService();
    const messages: ContextCompactionMessage[] = [
      { role: 'user', content: 'Implement memory compaction in src/services/ContextCompactionService.ts.' },
      { role: 'assistant', content: 'Tried a raw vector-only approach, but it was discarded because it loses decisions.' },
      { role: 'tool', toolName: 'jest', status: 'error', content: 'tests failed with timeout while checking docs/security.md' },
      { role: 'user', content: 'Next, preserve recent turns verbatim and continue phase 2 later.' },
      { role: 'assistant', content: 'Recent turn 1' },
      { role: 'user', content: 'Recent turn 2' },
    ];

    const result = service.compact({
      messages,
      now: new Date('2026-05-18T12:00:00.000Z'),
      usableContextTokens: 30,
      reservedTokenBuffer: 1,
      recentVerbatimTurns: 2,
      existingAnchorSummary: 'Previous work focused on Mnemos.',
    });

    expect(result.mode).toBe('incremental-anchored-compaction');
    expect(result.anchorSummary).not.toBeNull();
    expect(result.compactedOlderMessages).toBe(4);
    expect(result.compactedMessages[0].id).toBe('zavorth-session-summary');
    expect(result.compactedMessages[0].content).toContain('<zavorth-session-summary>');
    expect(result.compactedMessages[0].content).toContain('ContextCompactionService.ts');
    expect(result.compactedMessages.slice(1).map((message) => message.content)).toEqual([
      'Recent turn 1',
      'Recent turn 2',
    ]);
  });

  it('redacts secrets before compacting or preserving messages', () => {
    const service = new ContextCompactionService();
    const result = service.compact({
      messages: [
        { role: 'user', content: 'Use token=super-secret-token-value for this test only.' },
        { role: 'tool', toolName: 'shell', status: 'ok', content: bulkyToolOutput() },
      ],
      now: new Date('2026-05-18T12:00:00.000Z'),
      lastActivityAt: new Date('2026-05-18T10:58:00.000Z'),
      usableContextTokens: 50000,
      recentVerbatimTurns: 1,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).toContain('[REDACTED_SECRET]');
    expect(serialized).not.toContain('super-secret-token-value');
  });

  it('does nothing when context is fresh and within budget', () => {
    const service = new ContextCompactionService();
    const result = service.compact({
      messages: [{ role: 'user', content: 'Short request.' }],
      now: new Date('2026-05-18T12:00:00.000Z'),
      lastActivityAt: new Date('2026-05-18T11:50:00.000Z'),
      usableContextTokens: 50000,
    });

    expect(result.mode).toBe('none');
    expect(result.triggered).toBe(false);
    expect(result.reductionTokens).toBe(0);
    expect(result.compactedMessages).toEqual([{ role: 'user', content: 'Short request.', id: 'msg-1', toolName: null, status: null, toolCalls: null, toolCallId: null }]);
  });

  it('injects placeholder stubs for tool calls whose tool outputs were compacted/removed', () => {
    const service = new ContextCompactionService();
    const result = service.compact({
      messages: [
        {
          role: 'assistant',
          content: 'Running tool',
          toolCalls: [{ id: 'call-1', name: 'read_file', arguments: {} }],
        },
      ],
      now: new Date('2026-05-18T12:00:00.000Z'),
      usableContextTokens: 50000,
    });

    expect(result.compactedMessages).toHaveLength(2);
    expect(result.compactedMessages[0].role).toBe('assistant');
    expect(result.compactedMessages[1].role).toBe('tool');
    expect(result.compactedMessages[1].toolName).toBe('read_file');
    expect(result.compactedMessages[1].toolCallId).toBe('call-1');
    expect(result.compactedMessages[1].content).toContain('Context compacted');
  });

  it('removes orphan tool responses whose corresponding assistant tool calls were compacted', () => {
    const service = new ContextCompactionService();
    const result = service.compact({
      messages: [
        {
          role: 'assistant',
          content: 'Compacted tool call',
          toolCalls: [{ id: 'call-orphaned', name: 'list_dir', arguments: {} }],
        },
        {
          role: 'tool',
          toolCallId: 'call-orphaned',
          toolName: 'list_dir',
          content: 'some directory files',
        },
        {
          role: 'user',
          content: 'Please explain this output.',
        },
      ],
      now: new Date('2026-05-18T12:00:00.000Z'),
      usableContextTokens: 10, // Very low budget to force anchored compaction
      reservedTokenBuffer: 1,
      recentVerbatimTurns: 1, // Only user message is kept verbatim
    });

    // The older assistant message and tool response are compacted.
    // The user message is kept. But the tool response, if kept, would be orphan.
    // We expect only the session summary and the user message, with no orphan tool response.
    expect(result.mode).toBe('incremental-anchored-compaction');

    const roles = result.compactedMessages.map((m) => m.role);
    expect(roles).not.toContain('tool'); // No orphan tool message remains!
    expect(result.compactedMessages).toHaveLength(2);
    expect(result.compactedMessages[0].id).toBe('zavorth-session-summary');
    expect(result.compactedMessages[1].role).toBe('user');
  });
});
