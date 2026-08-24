import { ConversationalAgent } from '../../src/agents/ConversationalAgent.js';
import { config } from '../../src/config/index.js';

function buildAgent(contextDecision: Record<string, unknown>, replyText: string) {
  const toolDefinitions = [
    {
      name: 'get_datetime',
      description: 'Date and time',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  ];
  const llmRuntime = {
    isProviderAvailable: jest.fn((name: string) => ['gemini', 'aigateway', 'openrouter'].includes(name)),
    chatDetailed: jest.fn().mockResolvedValue({
      providerName: 'gemini',
      response: { content: replyText },
    }),
  };
  const agent = new ConversationalAgent({
    llmRuntime,
    toolRuntime: {
      getToolDefinitions: jest.fn().mockReturnValue(toolDefinitions),
      executeTool: jest.fn(),
    },
    contextEngine: {
      prepareAsync: jest.fn().mockResolvedValue(contextDecision),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return agent;
}

describe('ConversationalAgent memory recall indicator', () => {
  const originalProvider = (config as unknown as { llmProvider?: string }).llmProvider;

  beforeEach(() => {
    (config as unknown as { llmProvider?: string }).llmProvider = 'gemini';
  });

  afterEach(() => {
    (config as unknown as { llmProvider?: string }).llmProvider = originalProvider;
  });

  it('appends the non-sensitive recall indicator when memory informed the reply', async () => {
    const agent = buildAgent(
      {
        messages: [
          { role: 'system', content: 'system' },
          { role: 'user', content: 'what stack do I use?' },
        ],
        tools: [],
        useFastModel: false,
        firewallStats: 'stats',
        intentCategory: 'memory-recall',
        memoryRecall: { informed: true, memoryCount: 3, searchTimeMs: 9 },
      },
      'You usually work with TypeScript.',
    );

    const response = await agent.chat('what stack do I use?', undefined, {
      mode: 'direct',
      requireContextEngine: true,
      userId: 'user-1',
      chatId: 'chat-1',
      surface: 'web',
    });

    expect(response.text).toContain('You usually work with TypeScript.');
    expect(response.text).toMatch(/Recalled 3 relevant long-term memories/i);
  });

  it('keeps replies clean when memory did not inform the turn', async () => {
    const agent = buildAgent(
      {
        messages: [{ role: 'user', content: 'hi' }],
        tools: [],
        useFastModel: false,
        firewallStats: 'stats',
        intentCategory: 'general',
        memoryRecall: { informed: false, memoryCount: 0, searchTimeMs: 1 },
      },
      'Plain answer.',
    );

    const response = await agent.chat('hi', undefined, {
      mode: 'direct',
      requireContextEngine: true,
      userId: 'user-1',
      chatId: 'chat-2',
      surface: 'web',
    });

    expect(response.text).toBe('Plain answer.');
    expect(response.text).not.toMatch(/Recalled/i);
  });
});
