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


import { GroqProvider } from '../../src/providers/GroqProvider';

describe('GroqProvider', () => {
  const originalApiKey = (config as any).groqApiKey;
  const originalModel = (config as any).groqModel;

  beforeEach(() => {
    mockCreate.mockReset();
    MockOpenAI.mockClear();
  });

  afterEach(() => {
    (config as any).groqApiKey = originalApiKey;
    (config as any).groqModel = originalModel;
    jest.restoreAllMocks();
  });

  it('throws when GROQ_API_KEY is missing', () => {
    (config as any).groqApiKey = '';
    expect(() => new GroqProvider()).toThrow('GROQ_API_KEY not configured in .env');
  });

  it('succeeds with valid config', () => {
    (config as any).groqApiKey = 'groq-key';
    expect(() => new GroqProvider()).not.toThrow();
  });

  it('creates OpenAI client with correct baseURL', () => {
    (config as any).groqApiKey = 'groq-key';
    new GroqProvider();

    expect(MockOpenAI).toHaveBeenCalledWith({
      apiKey: 'groq-key',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  });

  it('returns proper LlmResponse structure', async () => {
    (config as any).groqApiKey = 'groq-key';
    (config as any).groqModel = 'llama-3.3-70b-versatile';

    mockCreate.mockResolvedValue({
      choices: [{
        message: { content: 'Hello!', tool_calls: null },
        finish_reason: 'stop',
      }],
    });

    const provider = new GroqProvider();
    const response = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(response).toEqual({
      content: 'Hello!',
      toolCalls: [],
      finishReason: 'stop',
      metadata: expect.objectContaining({
        provider: 'groq',
        hardwareOptimized: true,
        speculativeStreaming: true,
      }),
    });
  });

  it('returns error response when no choices', async () => {
    (config as any).groqApiKey = 'groq-key';

    mockCreate.mockResolvedValue({ choices: [] });

    const provider = new GroqProvider();
    const response = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(response.content).toBe('Sem resposta do modelo.');
    expect(response.finishReason).toBe('error');
  });

  it('converts messages for all roles', async () => {
    (config as any).groqApiKey = 'groq-key';

    mockCreate.mockResolvedValue({
      choices: [{
        message: { content: 'ok', tool_calls: null },
        finish_reason: 'stop',
      }],
    });

    const provider = new GroqProvider();
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
    (config as any).groqApiKey = 'groq-key';

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

    const provider = new GroqProvider();
    const response = await provider.chat([{ role: 'user', content: 'Read file' }]);

    expect(response.toolCalls).toEqual([{
      id: 'call-1',
      name: 'read_file',
      arguments: { path: 'test.ts' },
    }]);
    expect(response.finishReason).toBe('tool_calls');
  });
});
