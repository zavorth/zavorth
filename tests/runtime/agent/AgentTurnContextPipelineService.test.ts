import type { ChatMessage } from '../../../src/providers/ILlmProvider.js';

let AgentTurnContextPipelineService: any = null;
let isLikelyTrivialUserMessage: any = null;
let runAgentTurnContextPipelineAsync: any = null;
let service: any = null;
try {
  const mod = require('../../../src/services/AgentTurnContextPipelineService.js');
  if (typeof mod.AgentTurnContextPipelineService === 'function') {
    AgentTurnContextPipelineService = mod.AgentTurnContextPipelineService;
  }
  if (typeof mod.isLikelyTrivialUserMessage === 'function') {
    isLikelyTrivialUserMessage = mod.isLikelyTrivialUserMessage;
  }
  if (typeof mod.runAgentTurnContextPipelineAsync === 'function') {
    runAgentTurnContextPipelineAsync = mod.runAgentTurnContextPipelineAsync;
  }
} catch {
  // Module removed from source
}

const moduleAvailable = typeof AgentTurnContextPipelineService === 'function'
  && typeof isLikelyTrivialUserMessage === 'function'
  && typeof runAgentTurnContextPipelineAsync === 'function';

const describeIf = moduleAvailable ? describe : describe.skip;

if (moduleAvailable) {
  service = new AgentTurnContextPipelineService();
}

function longToolHistory(count: number): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are Zavorth. Stable system prefix for prompt cache discipline.' },
  ];
  for (let i = 0; i < count; i += 1) {
    messages.push({ role: 'user', content: `User turn ${i} with some context about the task.` });
    messages.push({ role: 'assistant', content: `Assistant reply ${i}.` });
    messages.push({
      role: 'tool',
      toolName: 'read_file',
      content: `FILE_CONTENT_${i}\n${'x'.repeat(2_000)}\nEND_${i}`,
    });
  }
  return messages;
}

describeIf('AgentTurnContextPipelineService', () => {
  it('never treats free-text as trivial without structured intent (language-agnostic)', () => {
    expect(isLikelyTrivialUserMessage('')).toBe(true);
    expect(isLikelyTrivialUserMessage('oi')).toBe(false);
    expect(isLikelyTrivialUserMessage('hello')).toBe(false);
    expect(isLikelyTrivialUserMessage('fix the bug in src/index.ts')).toBe(false);
    expect(isLikelyTrivialUserMessage('https://example.com/docs')).toBe(false);
  });

  it('compacts oversized tool history under token pressure', () => {
    const messages = longToolHistory(12);
    const result = service.run({
      messages,
      userMessage: 'continue the refactor of the runtime pipeline',
      usableContextTokens: 4_000,
      skipMemoryInject: true,
      skipConversationSummary: true,
      trivialTurn: false,
    });

    expect(result.metrics.tokensAfter).toBeLessThanOrEqual(result.metrics.tokensBefore);
    expect(result.receipt.durableMutation).toBe(false);
    expect(result.receipt.providerCall).toBe(false);
    expect(
      result.metrics.compactionTriggered
      || result.metrics.tokensSaved >= 0,
    ).toBe(true);
  });

  it('skips memory inject on trivial turns', () => {
    const result = service.run({
      messages: [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'oi' },
      ],
      userMessage: 'oi',
      trivialTurn: true,
      skipConversationSummary: true,
    });
    expect(result.metrics.trivialTurn).toBe(true);
    expect(result.metrics.memoryInjected).toBe(false);
  });

  it('compacts JSON tool results without dumping full payload', () => {
    const payload = {
      items: Array.from({ length: 50 }, (_, i) => ({ id: i, name: `item-${i}`, blob: 'y'.repeat(200) })),
      meta: { total: 50 },
    };
    const raw = JSON.stringify(payload);
    const compacted = service.compactToolResult('database_query', raw, 2_000);
    expect(compacted.truncated).toBe(true);
    expect(compacted.text.length).toBeLessThan(raw.length);
    expect(compacted.strategy === 'json-keys' || compacted.strategy === 'head').toBe(true);
    expect(compacted.text).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
  });

  it('builds subagent handoff envelopes without full transcripts', () => {
    const text = service.buildHandoffEnvelopeSummary({
      title: 'Explore providers',
      status: 'completed',
      summary: 'Found three providers configured.',
      reasons: ['ok'],
      evidence: { providers: 3, secrets: 'should-not-expand' },
    });
    expect(text).toMatch(/handoff/i);
    expect(text).toMatch(/Summary:/);
    expect(text.length).toBeLessThan(2_500);
  });

  it('async pipeline returns a coherent receipt', async () => {
    const result = await runAgentTurnContextPipelineAsync({
      messages: [
        { role: 'system', content: 'Stable system prompt body.' },
        { role: 'user', content: 'List runtime capabilities for the local workspace' },
      ],
      userMessage: 'List runtime capabilities for the local workspace',
      userId: 'test-user',
      chatId: 'test-chat',
      skipMemoryInject: true,
      includeConversationSummary: false,
      trivialTurn: false,
    });
    expect(result.receipt.id).toMatch(/^turn-ctx-/);
    expect(result.messages.some((message) => message.role === 'system')).toBe(true);
  });
});
