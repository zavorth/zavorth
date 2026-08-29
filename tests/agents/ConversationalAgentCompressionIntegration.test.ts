import { ConversationalAgent } from '../../src/agents/ConversationalAgent.js';
import type { LlmRuntimeService } from '../../src/services/llm/LlmRuntimeService.js';
import type { ChatMessage, LlmResponse } from '../../src/providers/ILlmProvider.js';
import { config } from '../../src/config/index.js';

describe('ConversationalAgent Compression Integration', () => {
  const originalEnv = process.env.ZAVORTH_AUTO_COMPACT_TRAJECTORY;
  const originalProvider = (config as { llmProvider?: string }).llmProvider;

  beforeEach(() => {
    process.env.ZAVORTH_AUTO_COMPACT_TRAJECTORY = '1';
    (config as { llmProvider?: string }).llmProvider = 'anthropic';
  });

  afterEach(() => {
    (config as { llmProvider?: string }).llmProvider = originalProvider;
    if (originalEnv === undefined) {
      delete process.env.ZAVORTH_AUTO_COMPACT_TRAJECTORY;
    } else {
      process.env.ZAVORTH_AUTO_COMPACT_TRAJECTORY = originalEnv;
    }
  });

  it('compacts older tool results using ToolResultPruningService without fragile regex', async () => {
    const chatDetailedMock = jest.fn();
    chatDetailedMock
      // Turn 1: model calls read_file
      .mockResolvedValueOnce({
        providerName: 'anthropic',
        response: {
          content: '',
          toolCalls: [{ id: 'call-1', name: 'read_file', arguments: { path: 'src/main.ts' } }],
        } as LlmResponse,
      })
      // Turn 2: model calls read_file again (same file to test deduplication)
      .mockResolvedValueOnce({
        providerName: 'anthropic',
        response: {
          content: '',
          toolCalls: [{ id: 'call-2', name: 'read_file', arguments: { path: 'src/main.ts' } }],
        } as LlmResponse,
      })
      // Turn 3: model calls terminal command
      .mockResolvedValueOnce({
        providerName: 'anthropic',
        response: {
          content: '',
          toolCalls: [{ id: 'call-3', name: 'terminal', arguments: { command: 'git status' } }],
        } as LlmResponse,
      })
      // Turn 4: model provides final answer
      .mockResolvedValueOnce({
        providerName: 'anthropic',
        response: {
          content: 'All operations completed.',
          toolCalls: [],
        } as LlmResponse,
      });

    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: chatDetailedMock,
    } as unknown as LlmRuntimeService;

    const toolRuntime = {
      getToolDefinitions: () => [
        { name: 'read_file', description: 'Read file', parameters: { type: 'object', properties: {} } },
        { name: 'terminal', description: 'Run terminal', parameters: { type: 'object', properties: {} } },
      ],
      executeTool: async (toolName: string) => {
        if (toolName === 'read_file') {
          return 'line of source code\n'.repeat(100);
        }
        return 'clean branch\n'.repeat(10);
      },
    };

    const agent = new ConversationalAgent({ llmRuntime, toolRuntime });
    const response = await agent.chat('Please inspect the project', undefined, { mode: 'direct' });

    expect(chatDetailedMock).toHaveBeenCalledTimes(4);
    expect(response.text).toBe('All operations completed.');
    expect(response.toolTelemetry?.historyCompactions).toBeGreaterThanOrEqual(1);

    // Verify that the final messages array had compacted tool messages with structured 1-line format
    const finalSentMessages: ChatMessage[] = chatDetailedMock.mock.calls[3][0];
    const toolMessages = finalSentMessages.filter((m) => m.role === 'tool');

    expect(toolMessages.length).toBeGreaterThanOrEqual(3);
    const compacted = toolMessages.filter((m) => String(m.content).includes('[compacted tool history]'));
    expect(compacted.length).toBeGreaterThanOrEqual(1);
  });

  it('anchors the static system instruction and tool catalog as the prefix before dynamic context', async () => {
    const chatDetailedMock = jest.fn().mockResolvedValue({
      providerName: 'anthropic',
      response: {
        content: 'Hello, how can I help you?',
      } as LlmResponse,
    });

    const llmRuntime = {
      isProviderAvailable: jest.fn(() => true),
      chatDetailed: chatDetailedMock,
    } as unknown as LlmRuntimeService;

    const toolRuntime = {
      getToolDefinitions: () => [
        { name: 'read_file', description: 'Read file', parameters: { type: 'object', properties: {} } },
      ],
      executeTool: async () => 'test',
    };

    const agent = new ConversationalAgent({ llmRuntime, toolRuntime });
    await agent.chat('Hello world', undefined, { mode: 'direct', userId: 'user-cache-test' });

    expect(chatDetailedMock).toHaveBeenCalledTimes(1);
    const sentMessages: ChatMessage[] = chatDetailedMock.mock.calls[0][0];
    const systemMessage = sentMessages.find((m) => m.role === 'system');

    expect(systemMessage).toBeDefined();
    const content = String(systemMessage?.content || '');

    const personaIndex = content.indexOf('You are **Zavorth**');
    const toolsIndex = content.indexOf('**TOOLS');

    expect(personaIndex).toBeGreaterThanOrEqual(0);
    expect(toolsIndex).toBeGreaterThan(personaIndex);

    // If dynamic runtime context is present, it must be located AFTER **TOOLS
    const learnedKnowledgeIndex = content.indexOf('LEARNED KNOWLEDGE');
    if (learnedKnowledgeIndex >= 0) {
      expect(learnedKnowledgeIndex).toBeGreaterThan(toolsIndex);
    }
  });
});
