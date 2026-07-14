import { ConversationalAgent } from '../../src/agents/ConversationalAgent';
import { config } from '../../src/config/index';

describe('Agent tools golden path', () => {
  const originalProvider = (config as any).llmProvider;

  beforeEach(() => {
    (config as any).llmProvider = 'gemini';
  });

  afterEach(() => {
    (config as any).llmProvider = originalProvider;
  });

  it('exposes agent-brain tools and multi-step catalog for free-text work', async () => {
    const chatDetailed = jest.fn()
      .mockResolvedValueOnce({
        providerName: 'gemini',
        response: {
          content: '',
          toolCalls: [
            { id: 'c1', name: 'web_search', arguments: { query: 'AI news 2026' } },
          ],
        },
      })
      .mockResolvedValueOnce({
        providerName: 'gemini',
        response: {
          content: '',
          toolCalls: [
            {
              id: 'c2',
              name: 'create_file',
              arguments: { filepath: 'reports/ai.md', content: '# AI news\n- item' },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        providerName: 'gemini',
        response: { content: 'Report ready at reports/ai.md with sources.' },
      });

    const executeTool = jest.fn()
      .mockResolvedValueOnce('QUALITY_GATE: ok\n1. Example headline — https://example.com')
      .mockResolvedValueOnce('File created.');

    const agent = new ConversationalAgent({
      llmRuntime: {
        isProviderAvailable: jest.fn(() => true),
        chatDetailed,
      } as any,
      toolRuntime: {
        getToolDefinitions: jest.fn().mockReturnValue([
          { name: 'web_search', description: 'Web search', parameters: { type: 'object', properties: {}, required: [] } },
          { name: 'create_file', description: 'Create file', parameters: { type: 'object', properties: {}, required: ['filepath', 'content'] } },
          { name: 'zavorth_delegate', description: 'Delegate to subagents', parameters: { type: 'object', properties: {}, required: [] } },
          { name: 'capability_discovery', description: 'Discover capabilities', parameters: { type: 'object', properties: {}, required: [] } },
          { name: 'agent_manager', description: 'Manage agents', parameters: { type: 'object', properties: {}, required: [] } },
        ]),
        executeTool,
      },
    } as any);

    const response = await agent.chat(
      'research the latest AI news and write a short report with sources',
      undefined,
      { mode: 'direct' },);

    expect(chatDetailed).toHaveBeenCalled();
    const firstTools = chatDetailed.mock.calls[0][1]?.map((t: any) => t.name) || [];
    expect(firstTools).toEqual(expect.arrayContaining([
      'web_search',
      'create_file',
      'zavorth_delegate',
      'capability_discovery',
    ]));

    const systemMsg = chatDetailed.mock.calls[0][0].find((m: any) => m.role === 'system');
    expect(String(systemMsg?.content || '')).toMatch(/AVAILABLE TOOLS/i);

    expect(executeTool).toHaveBeenCalledWith('web_search', expect.any(Object));
    expect(executeTool).toHaveBeenCalledWith('create_file', expect.objectContaining({
      filepath: 'reports/ai.md',
    }));
    expect(response.text).toMatch(/Report ready|reports\/ai/i);
    expect(response.toolTelemetry).toEqual(expect.objectContaining({
      toolRounds: expect.any(Number),
      toolsCalled: expect.arrayContaining(['web_search', 'create_file']),
      toolReceiptCount: expect.any(Number),
    }));
    expect(response.toolTelemetry!.toolRounds).toBeGreaterThanOrEqual(2);
  });

  it('reports clearly when the model asks for an unavailable tool', async () => {
    const chatDetailed = jest.fn()
      .mockResolvedValueOnce({
        providerName: 'gemini',
        response: {
          content: '',
          toolCalls: [{ id: 'x', name: 'not_a_real_tool', arguments: {} }],
        },
      })
      .mockResolvedValueOnce({
        providerName: 'gemini',
        response: {
          content: 'not_a_real_tool is not available; I can use web_search or capability_discovery instead.',
        },
      });

    const agent = new ConversationalAgent({
      llmRuntime: {
        isProviderAvailable: jest.fn(() => true),
        chatDetailed,
      } as any,
      toolRuntime: {
        getToolDefinitions: jest.fn().mockReturnValue([
          { name: 'web_search', description: 'Web search', parameters: { type: 'object', properties: {}, required: [] } },
          { name: 'capability_discovery', description: 'Discover', parameters: { type: 'object', properties: {}, required: [] } },
        ]),
        executeTool: jest.fn(),
      },
    } as any);

    const response = await agent.chat('do something impossible with a missing tool', undefined, { mode: 'direct' });

    expect(response.toolTelemetry?.unknownToolCalls).toEqual(expect.arrayContaining(['not_a_real_tool']));
    expect(response.text).toMatch(/not available|web_search|capability_discovery/i);
  });
});
