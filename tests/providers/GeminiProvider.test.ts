import { config } from '../../src/config/index';


const { mockGetGenerativeModel, MockGoogleGenerativeAI } = (() => {
  const mockGetGenerativeModel = jest.fn();
  const MockGoogleGenerativeAI = jest.fn(function(this: any) {
    this.getGenerativeModel = mockGetGenerativeModel;
  });
  return { mockGetGenerativeModel, MockGoogleGenerativeAI };
})();

jest.mock('@google/generative-ai', () => ({
  __esModule: true,
  GoogleGenerativeAI: MockGoogleGenerativeAI,
  SchemaType: {
    OBJECT: 'object',
    STRING: 'string',
    NUMBER: 'number',
    INTEGER: 'integer',
    BOOLEAN: 'boolean',
    ARRAY: 'array',
  },
}));


import { GeminiProvider } from '../../src/providers/GeminiProvider';

describe('GeminiProvider', () => {
  const originalGeminiApiKey = config.geminiApiKey;
  const originalGeminiApiKeys = [...config.geminiApiKeys];
  const originalGeminiApiBaseUrl = config.geminiApiBaseUrl;
  const originalGeminiApiVersion = config.geminiApiVersion;
  const originalGeminiApiClient = config.geminiApiClient;
  const originalGeminiCustomHeaders = { ...config.geminiCustomHeaders };
  const originalCloudflareAiGatewayEnabled = config.cloudflareAiGatewayEnabled;
  const originalCloudflareAiGatewayBaseUrl = config.cloudflareAiGatewayBaseUrl;

  beforeEach(() => {
    mockGetGenerativeModel.mockReset();
    MockGoogleGenerativeAI.mockClear();
    (config as any).cloudflareAiGatewayEnabled = false;
    (config as any).cloudflareAiGatewayBaseUrl = '';
    mockGetGenerativeModel.mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [{ text: 'ok' }],
              },
            },
          ],
        },
      }),
    });
  });

  afterEach(() => {
    (config as any).geminiApiKey = originalGeminiApiKey;
    (config as any).geminiApiKeys = [...originalGeminiApiKeys];
    (config as any).geminiApiBaseUrl = originalGeminiApiBaseUrl;
    (config as any).geminiApiVersion = originalGeminiApiVersion;
    (config as any).geminiApiClient = originalGeminiApiClient;
    (config as any).geminiCustomHeaders = { ...originalGeminiCustomHeaders };
    (config as any).cloudflareAiGatewayEnabled = originalCloudflareAiGatewayEnabled;
    (config as any).cloudflareAiGatewayBaseUrl = originalCloudflareAiGatewayBaseUrl;
    jest.restoreAllMocks();
  });

  it('passes custom request options to the Gemini SDK when a proxy transport is configured', async () => {
    (config as any).geminiApiKey = 'gemini-key';
    (config as any).geminiApiKeys = ['gemini-key'];
    (config as any).geminiApiBaseUrl =
      'https://gateway.ai.cloudflare.com/v1/account/gateway/google-ai-studio';
    (config as any).geminiApiVersion = 'v1beta';
    (config as any).geminiApiClient = 'zavorth-test';
    (config as any).geminiCustomHeaders = {
      'cf-aig-authorization': 'Bearer token-123',
      'x-zavorth-route': 'gemma',
    };

    const provider = new GeminiProvider();
    await provider.chat([{ role: 'user', content: 'oi' }]);

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: config.geminiModel,
      }),
      expect.objectContaining({
        baseUrl: 'https://gateway.ai.cloudflare.com/v1/account/gateway/google-ai-studio',
        apiVersion: 'v1beta',
        apiClient: 'zavorth-test',
        customHeaders: expect.objectContaining({
          'cf-aig-authorization': 'Bearer token-123',
          'x-zavorth-route': 'gemma',
        }),
      }),
    );
  });

  it('omits request options when Gemini is running directly against Google', async () => {
    (config as any).geminiApiKey = 'gemini-key';
    (config as any).geminiApiKeys = ['gemini-key'];
    (config as any).geminiApiBaseUrl = '';
    (config as any).geminiApiVersion = '';
    (config as any).geminiApiClient = '';
    (config as any).geminiCustomHeaders = {};

    const provider = new GeminiProvider();
    await provider.chat([{ role: 'user', content: 'oi' }]);

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: config.geminiModel,
      }),
      undefined,
    );
  });

  it('routes Cloudflare AI Gateway traffic through the Gemini SDK request options path', async () => {
    (config as any).geminiApiKey = 'gemini-key';
    (config as any).geminiApiKeys = ['gemini-key'];
    (config as any).cloudflareAiGatewayEnabled = true;
    (config as any).cloudflareAiGatewayBaseUrl =
      'https://gateway.ai.cloudflare.com/v1/account/gateway/google-ai-studio';
    (config as any).geminiApiBaseUrl =
      'https://gateway.ai.cloudflare.com/v1/account/gateway/google-ai-studio';
    (config as any).geminiApiVersion = 'v1beta';
    (config as any).geminiCustomHeaders = {};

    const provider = new GeminiProvider();
    const response = await provider.chat([
      { role: 'system', content: 'Seja objetivo.' },
      { role: 'user', content: 'oi' },
    ], [
      {
        name: 'ping',
        description: 'Retorna pong.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ]);

    expect(response.content).toBe('ok');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: config.geminiModel,
        tools: [
          expect.objectContaining({
            functionDeclarations: [
              expect.objectContaining({
                name: 'ping',
              }),
            ],
          }),
        ],
      }),
      expect.objectContaining({
        baseUrl: 'https://gateway.ai.cloudflare.com/v1/account/gateway/google-ai-studio',
        apiVersion: 'v1beta',
      }),
    );

    const generateContent = mockGetGenerativeModel.mock.results[0]?.value?.generateContent as ReturnType<typeof jest.fn>;
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: 'Seja objetivo.',
        contents: expect.any(Array),
      }),
    );
  });

  it('adds a default string item schema for array parameters without explicit items', async () => {
    (config as any).geminiApiKey = 'gemini-key';
    (config as any).geminiApiKeys = ['gemini-key'];

    const provider = new GeminiProvider();
    await provider.chat([
      { role: 'user', content: 'liste os caminhos' },
    ], [
      {
        name: 'scan_paths',
        description: 'Varre caminhos informados.',
        parameters: {
          type: 'object',
          properties: {
            paths: {
              type: 'array',
              description: 'Lista de caminhos a processar.',
            },
          },
          required: ['paths'],
        },
      },
    ]);

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          expect.objectContaining({
            functionDeclarations: [
              expect.objectContaining({
                parameters: expect.objectContaining({
                  properties: expect.objectContaining({
                    paths: expect.objectContaining({
                      type: 'array',
                      items: expect.objectContaining({
                        type: 'string',
                      }),
                    }),
                  }),
                }),
              }),
            ],
          }),
        ],
      }),
      expect.anything(),
    );
  });

  it('uses the original tool name in Gemini functionResponse messages', async () => {
    (config as any).geminiApiKey = 'gemini-key';
    (config as any).geminiApiKeys = ['gemini-key'];

    const provider = new GeminiProvider();
    await provider.chat([
      { role: 'user', content: 'Leia o README.' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{
          id: 'call-read',
          name: 'read_file',
          arguments: { filePath: 'README.md' },
        }],
      },
      {
        role: 'tool',
        toolCallId: 'call-read',
        content: 'README content',
      },
    ], [
      {
        name: 'read_file',
        description: 'Le file',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Caminho' },
          },
          required: ['filePath'],
        },
      },
    ]);

    const generateContent = mockGetGenerativeModel.mock.results[0]?.value?.generateContent as ReturnType<typeof jest.fn>;
    const payload = generateContent.mock.calls[0][0];
    expect(payload.contents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'function',
        parts: [
          expect.objectContaining({
            functionResponse: expect.objectContaining({
              name: 'read_file',
              response: { result: 'README content' },
            }),
          }),
        ],
      }),
    ]));
  });
});
