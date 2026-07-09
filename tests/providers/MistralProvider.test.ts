import { config } from '../../src/config/index';


const { mockCreate, MockOpenAI } = (() => {
  const mockCreate = jest.fn();
  const MockOpenAI = jest.fn(function(this: any) { this.chat = { completions: { create: mockCreate } }; });
  return { mockCreate, MockOpenAI };
})();

jest.mock('openai', () => ({
  __esModule: true,
  default: MockOpenAI,
}));


import { MistralProvider } from '../../src/providers/MistralProvider';

describe('MistralProvider', () => {
  const originalApiKey = (config as any).mistralApiKey;
  const originalModel = (config as any).mistralModel;

  beforeEach(() => {
    mockCreate.mockReset();
    MockOpenAI.mockClear();
  });

  afterEach(() => {
    (config as any).mistralApiKey = originalApiKey;
    (config as any).mistralModel = originalModel;
    jest.restoreAllMocks();
  });

  it('throws when MISTRAL_API_KEY is missing', () => {
    (config as any).mistralApiKey = '';
    expect(() => new MistralProvider()).toThrow('MISTRAL_API_KEY not configured in .env');
  });

  it('succeeds with valid config', () => {
    (config as any).mistralApiKey = 'mistral-key';
    expect(() => new MistralProvider()).not.toThrow();
  });

  it('creates OpenAI client with correct baseURL', () => {
    (config as any).mistralApiKey = 'mistral-key';
    new MistralProvider();

    expect(MockOpenAI).toHaveBeenCalledWith({
      apiKey: 'mistral-key',
      baseURL: 'https://api.mistral.ai/v1',
    });
  });

  it('returns proper LlmResponse structure', async () => {
    (config as any).mistralApiKey = 'mistral-key';
    (config as any).mistralModel = 'mistral-large-latest';

    mockCreate.mockResolvedValue({
      choices: [{
        message: { content: 'Hello!', tool_calls: null },
        finish_reason: 'stop',
      }],
    });

    const provider = new MistralProvider();
    const response = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(response).toEqual({
      content: 'Hello!',
      toolCalls: [],
      finishReason: 'stop',
      metadata: expect.objectContaining({
        provider: 'mistral',
      }),
    });
  });

  it('returns error response when no choices', async () => {
    (config as any).mistralApiKey = 'mistral-key';

    mockCreate.mockResolvedValue({ choices: [] });

    const provider = new MistralProvider();
    const response = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(response.content).toBe('No model response.');
    expect(response.finishReason).toBe('error');
  });

  it('converts messages for all roles', async () => {
    (config as any).mistralApiKey = 'mistral-key';

    mockCreate.mockResolvedValue({
      choices: [{
        message: { content: 'ok', tool_calls: null },
        finish_reason: 'stop',
      }],
    });

    const provider = new MistralProvider();
    await provider.chat([
      { role: 'system', content: 'Be helpful.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'tool', content: 'result', toolCallId: 'call-1' },
    ]);

    const calledMessages = mockCreate.mock.calls[0][0].messages;
    expect(calledMessages[0]).toEqual({ role: 'system', content: 'Be helpful.' });
    expect(calledMessages[1]).toEqual({ role: 'user', content: 'Hello' });
    expect(calledMessages[2]).toEqual(expect.objectContaining({ role: 'assistant', content: 'Hi there!' }));
    expect(calledMessages[3]).toEqual({ role: 'tool', content: 'result', tool_call_id: 'call-1' });
  });

  it('extracts tool calls from response', async () => {
    (config as any).mistralApiKey = 'mistral-key';

    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"test.ts"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
    });

    const provider = new MistralProvider();
    const response = await provider.chat([{ role: 'user', content: 'Read file' }]);

    expect(response.toolCalls).toEqual([{
      id: 'call-1',
      name: 'read_file',
      arguments: { path: 'test.ts' },
    }]);
    expect(response.finishReason).toBe('tool_calls');
  });

  it('injects code_execution native tool when provider_code_execution is requested', async () => {
    (config as any).mistralApiKey = 'mistral-key';

    mockCreate.mockResolvedValue({
      choices: [{
        message: { content: 'executed', tool_calls: null },
        finish_reason: 'stop',
      }],
    });

    const provider = new MistralProvider();
    await provider.chat(
      [{ role: 'user', content: 'Run code' }],
      undefined,
      {
        providerNativeTools: [{
          name: 'provider_code_execution',
          reason: 'execute code',
        }],
      },
    );

    const calledTools = mockCreate.mock.calls[0][0].tools;
    expect(calledTools).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'function',
        function: expect.objectContaining({ name: 'code_execution' }),
      }),
    ]));
  });
});
