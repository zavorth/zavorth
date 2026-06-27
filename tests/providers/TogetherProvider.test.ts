

const { mockCreate, MockOpenAI } = (() => {
  const mockCreate = jest.fn();
  const MockOpenAI = jest.fn(function(this: any) { this.chat = { completions: { create: mockCreate } }; });
  return { mockCreate, MockOpenAI };
})();

jest.mock('openai', () => ({
  __esModule: true,
  default: MockOpenAI,
}));

import { config } from '../../src/config/index';
import { TogetherProvider } from '../../src/providers/TogetherProvider';

describe('TogetherProvider', () => {
  const originalApiKey = (config as any).togetherApiKey;
  const originalModel = (config as any).togetherModel;

  beforeEach(() => {
    mockCreate.mockReset();
    MockOpenAI.mockClear();
  });

  afterEach(() => {
    (config as any).togetherApiKey = originalApiKey;
    (config as any).togetherModel = originalModel;
    jest.restoreAllMocks();
  });

  it('throws when TOGETHER_API_KEY is missing', () => {
    (config as any).togetherApiKey = '';
    expect(() => new TogetherProvider()).toThrow('TOGETHER_API_KEY not configured in .env');
  });

  it('succeeds with valid config', () => {
    (config as any).togetherApiKey = 'together-key';
    expect(() => new TogetherProvider()).not.toThrow();
  });

  it('creates OpenAI client with correct baseURL', () => {
    (config as any).togetherApiKey = 'together-key';
    new TogetherProvider();

    expect(MockOpenAI).toHaveBeenCalledWith({
      apiKey: 'together-key',
      baseURL: 'https://api.together.xyz/v1',
    });
  });

  it('returns proper LlmResponse structure', async () => {
    (config as any).togetherApiKey = 'together-key';
    (config as any).togetherModel = 'meta-llama/Llama-3.3-70B-Instruct-Turbo';

    mockCreate.mockResolvedValue({
      choices: [{
        message: { content: 'Hello!', tool_calls: null },
        finish_reason: 'stop',
      }],
    });

    const provider = new TogetherProvider();
    const response = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(response).toEqual({
      content: 'Hello!',
      toolCalls: [],
      finishReason: 'stop',
      metadata: expect.objectContaining({
        provider: 'together',
        embeddingEndpoint: 'https://api.together.xyz/v1/embeddings',
      }),
    });
  });

  it('returns error response when no choices', async () => {
    (config as any).togetherApiKey = 'together-key';

    mockCreate.mockResolvedValue({ choices: [] });

    const provider = new TogetherProvider();
    const response = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(response.content).toBe('Sem resposta do modelo.');
    expect(response.finishReason).toBe('error');
  });

  it('converts messages for all roles', async () => {
    (config as any).togetherApiKey = 'together-key';

    mockCreate.mockResolvedValue({
      choices: [{
        message: { content: 'ok', tool_calls: null },
        finish_reason: 'stop',
      }],
    });

    const provider = new TogetherProvider();
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
    (config as any).togetherApiKey = 'together-key';

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

    const provider = new TogetherProvider();
    const response = await provider.chat([{ role: 'user', content: 'Read file' }]);

    expect(response.toolCalls).toEqual([{
      id: 'call-1',
      name: 'read_file',
      arguments: { path: 'test.ts' },
    }]);
    expect(response.finishReason).toBe('tool_calls');
  });
});
