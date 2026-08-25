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
import { logger } from '../../src/logger';
import type {
  ChatMessage,
  LlmStreamEvent,
  ProviderChatOptions,
} from '../../src/providers/ILlmProvider';

type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
};

type GeminiCandidate = {
  finishReason?: string;
  content?: { parts?: GeminiPart[] };
  groundingMetadata?: Record<string, unknown>;
};

type GeminiStreamChunk = { candidates?: GeminiCandidate[] };

type StreamResultStub = {
  stream: AsyncIterable<GeminiStreamChunk>;
  response: Promise<{ candidates?: GeminiCandidate[] }>;
};

type ModelStub = {
  generateContent: jest.Mock;
  generateContentStream: jest.Mock;
};

type GenerateContentPayload = {
  contents: Array<{ role: string; parts: GeminiPart[] }>;
  systemInstruction?: string;
};

type ChatResponseStub = { response: { candidates?: GeminiCandidate[] } };

const streamFlags = {
  providerNativeTokenStreaming: true,
  providerNativeStreamSource: 'gemini-generate-content-stream',
};

function configureSingleKey(): void {
  (config as any).geminiApiKey = 'gemini-key-1';
  (config as any).geminiApiKeys = ['gemini-key-1'];
}

function configureDualKey(): void {
  (config as any).geminiApiKey = 'gemini-key-1';
  (config as any).geminiApiKeys = ['gemini-key-1', 'gemini-key-2'];
}

function createModelStub(): ModelStub {
  return {
    generateContent: jest.fn().mockResolvedValue({
      response: { candidates: [] },
    } satisfies ChatResponseStub),
    generateContentStream: jest.fn().mockRejectedValue(new Error('generateContentStream not configured')),
  };
}

async function* streamOf(chunks: GeminiStreamChunk[]): AsyncIterable<GeminiStreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function* failingStream(
  chunks: GeminiStreamChunk[],
  failure: Error,
): AsyncIterable<GeminiStreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
  throw failure;
}

function streamResultStub(
  stream: AsyncIterable<GeminiStreamChunk>,
  finalCandidates?: GeminiCandidate[],
): StreamResultStub {
  return {
    stream,
    response: Promise.resolve({ candidates: finalCandidates }),
  };
}

async function collectStreamEvents(
  provider: GeminiProvider,
  messages: ChatMessage[],
  options?: ProviderChatOptions,
): Promise<LlmStreamEvent[]> {
  const events: LlmStreamEvent[] = [];
  for await (const event of provider.streamChat(messages, undefined, options)) {
    events.push(event);
  }
  return events;
}

describe('GeminiProvider golden flows', () => {
  const originalGeminiApiKey = config.geminiApiKey;
  const originalGeminiApiKeys = [...config.geminiApiKeys];
  const originalGeminiApiBaseUrl = config.geminiApiBaseUrl;
  const originalGeminiApiVersion = config.geminiApiVersion;
  const originalGeminiApiClient = config.geminiApiClient;
  const originalGeminiCustomHeaders = { ...config.geminiCustomHeaders };
  const originalCloudflareAiGatewayEnabled = config.cloudflareAiGatewayEnabled;
  const originalCloudflareAiGatewayBaseUrl = config.cloudflareAiGatewayBaseUrl;

  let defaultModel: ModelStub;

  beforeEach(() => {
    mockGetGenerativeModel.mockReset();
    MockGoogleGenerativeAI.mockClear();
    (config as any).cloudflareAiGatewayEnabled = false;
    (config as any).cloudflareAiGatewayBaseUrl = '';
    (config as any).geminiApiBaseUrl = '';
    (config as any).geminiApiVersion = '';
    (config as any).geminiApiClient = '';
    (config as any).geminiCustomHeaders = {};
    defaultModel = createModelStub();
    mockGetGenerativeModel.mockReturnValue(defaultModel);
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

  describe('chat', () => {
    it('returns candidate text with the STOP finish reason for a plain user message', async () => {
      configureSingleKey();
      defaultModel.generateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: 'All systems operational.' }] },
            },
          ],
        },
      } satisfies ChatResponseStub);

      const provider = new GeminiProvider();
      const response = await provider.chat([{ role: 'user', content: 'Report system status.' }]);

      expect(response).toEqual({
        content: 'All systems operational.',
        toolCalls: [],
        finishReason: 'STOP',
        metadata: undefined,
      });
      expect(defaultModel.generateContent).toHaveBeenCalledWith({
        contents: [{ role: 'user', parts: [{ text: 'Report system status.' }] }],
        systemInstruction: undefined,
      });
    });

    it('returns the no-response fallback with error finish reason when the candidate list is empty', async () => {
      configureSingleKey();

      const provider = new GeminiProvider();
      const response = await provider.chat([{ role: 'user', content: 'Anyone there?' }]);

      expect(response).toEqual({
        content: 'No response from model.',
        toolCalls: [],
        finishReason: 'error',
        metadata: undefined,
      });
    });

    it('joins multiple system messages into systemInstruction and converts assistant roles to model', async () => {
      configureSingleKey();

      const provider = new GeminiProvider();
      await provider.chat([
        { role: 'system', content: 'Rule one.' },
        { role: 'system', content: 'Rule two.' },
        { role: 'user', content: 'Hello there.' },
        { role: 'assistant', content: 'Hi back.' },
      ]);

      const payload = defaultModel.generateContent.mock.calls[0][0] as GenerateContentPayload;
      expect(payload.systemInstruction).toBe('Rule one.\nRule two.');
      expect(payload.contents).toEqual([
        { role: 'user', parts: [{ text: 'Hello there.' }] },
        { role: 'model', parts: [{ text: 'Hi back.' }] },
      ]);
    });

    it('extracts tool calls alongside joined text from mixed candidate parts', async () => {
      configureSingleKey();
      defaultModel.generateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  { text: 'Checking now.' },
                  { functionCall: { name: 'read_file' } },
                  { functionCall: { name: 'search_web', args: { query: 'zavorth release notes' } } },
                ],
              },
            },
          ],
        },
      } satisfies ChatResponseStub);

      const provider = new GeminiProvider();
      const response = await provider.chat([{ role: 'user', content: 'Find the notes.' }]);

      expect(response.content).toBe('Checking now.');
      expect(response.finishReason).toBe('STOP');
      expect(response.toolCalls).toEqual([
        { id: expect.stringMatching(/^call_/), name: 'read_file', arguments: {} },
        {
          id: expect.stringMatching(/^call_/),
          name: 'search_web',
          arguments: { query: 'zavorth release notes' },
        },
      ]);
    });

    it('fails over to the second key on quota rejection and stays sticky for the next request', async () => {
      configureDualKey();
      const quotaError = new Error('429 quota exceeded');
      const failingGenerateContent = jest.fn().mockRejectedValue(quotaError);
      const recoveredGenerateContent = jest.fn().mockResolvedValue({
        response: {
          candidates: [
            { finishReason: 'STOP', content: { parts: [{ text: 'recovered answer' }] } },
          ],
        },
      } satisfies ChatResponseStub);
      mockGetGenerativeModel
        .mockImplementationOnce(() => ({ generateContent: failingGenerateContent }))
        .mockImplementation(() => ({ generateContent: recoveredGenerateContent }));
      const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

      const provider = new GeminiProvider();
      const firstResponse = await provider.chat([{ role: 'user', content: 'Try me.' }]);

      expect(firstResponse.content).toBe('recovered answer');
      expect(warnSpy).toHaveBeenCalledWith('[Gemini] Error using key 1: 429 quota exceeded');
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(
        '[Gemini Failover] Request succeeded using the secondary key (2/2).',
      );

      const secondResponse = await provider.chat([{ role: 'user', content: 'Again.' }]);

      expect(secondResponse.content).toBe('recovered answer');
      expect(failingGenerateContent).toHaveBeenCalledTimes(1);
      expect(recoveredGenerateContent).toHaveBeenCalledTimes(2);
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(3);
      const [firstClient, secondClient] = MockGoogleGenerativeAI.mock.instances;
      const contexts = mockGetGenerativeModel.mock.contexts;
      expect(contexts).toHaveLength(3);
      expect(contexts[0]).toBe(firstClient);
      expect(contexts[1]).toBe(secondClient);
      expect(contexts[2]).toBe(secondClient);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    it('propagates an SDK abort error without attempting the next key', async () => {
      configureDualKey();
      const controller = new AbortController();
      const abortError = Object.assign(new Error('The operation was aborted'), {
        name: 'AbortError',
      });
      const abortingGenerateContent = jest.fn().mockRejectedValue(abortError);
      mockGetGenerativeModel.mockImplementation(() => ({
        generateContent: abortingGenerateContent,
      }));
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

      const provider = new GeminiProvider();
      const outcome = provider.chat([{ role: 'user', content: 'hello there' }], undefined, {
        signal: controller.signal,
      });

      await expect(outcome).rejects.toBe(abortError);
      expect(controller.signal.aborted).toBe(false);
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(abortingGenerateContent).toHaveBeenCalledWith(
        {
          contents: [{ role: 'user', parts: [{ text: 'hello there' }] }],
          systemInstruction: undefined,
        },
        { signal: controller.signal },
      );
    });
  });

  describe('streamChat', () => {
    it('emits start, delta and done events with the resolved final response on the happy path', async () => {
      configureSingleKey();
      defaultModel.generateContentStream.mockResolvedValue(
        streamResultStub(
          streamOf([
            { candidates: [{ content: { parts: [{ text: 'Hello ' }] } }] },
            { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'world' }] } }] },
          ]),
          [{ finishReason: 'STOP', content: { parts: [{ text: 'Hello world' }] } }],
        ),
      );

      const provider = new GeminiProvider();
      const events = await collectStreamEvents(provider, [{ role: 'user', content: 'Say hello.' }]);

      expect(events.map((event) => event.type)).toEqual(['start', 'delta', 'delta', 'done']);
      expect(events[0]).toEqual({
        type: 'start',
        accumulated: '',
        done: false,
        metadata: streamFlags,
      });
      expect(events[1]).toEqual({
        type: 'delta',
        delta: 'Hello ',
        accumulated: 'Hello ',
        chunkIndex: 1,
        done: false,
        metadata: streamFlags,
      });
      expect(events[2]).toEqual({
        type: 'delta',
        delta: 'world',
        accumulated: 'Hello world',
        chunkIndex: 2,
        done: false,
        metadata: streamFlags,
      });
      expect(events[3]?.done).toBe(true);
      expect(events[3]?.accumulated).toBe('Hello world');
      expect(events[3]?.response).toEqual({
        content: 'Hello world',
        toolCalls: [],
        finishReason: 'STOP',
        metadata: streamFlags,
      });
      expect(events[3]?.metadata).toEqual(streamFlags);
      expect(defaultModel.generateContentStream).toHaveBeenCalledTimes(1);
      expect(defaultModel.generateContentStream).toHaveBeenCalledWith(
        { contents: [{ role: 'user', parts: [{ text: 'Say hello.' }] }] },
        undefined,
      );
    });

    it('emits tool_call_delta events for functionCall parts and carries them into the done response', async () => {
      configureSingleKey();
      defaultModel.generateContentStream.mockResolvedValue(
        streamResultStub(
          streamOf([
            {
              candidates: [
                {
                  content: {
                    parts: [
                      { functionCall: { name: 'lookup_city', args: { city: 'Porto Alegre' } } },
                    ],
                  },
                },
              ],
            },
            { candidates: [{ finishReason: 'STOP' }] },
          ]),
          [{ finishReason: 'STOP' }],
        ),
      );

      const provider = new GeminiProvider();
      const events = await collectStreamEvents(provider, [
        { role: 'user', content: 'Which city is this?' },
      ]);

      expect(events.map((event) => event.type)).toEqual(['start', 'tool_call_delta', 'done']);
      expect(events[1]?.toolCallDelta).toEqual({
        index: 0,
        id: expect.stringMatching(/^call_/),
        name: 'lookup_city',
        arguments: '{"city":"Porto Alegre"}',
      });
      expect(events[1]?.accumulated).toBe('');
      expect(events[2]?.response).toEqual({
        content: null,
        toolCalls: [
          {
            id: expect.stringMatching(/^call_/),
            name: 'lookup_city',
            arguments: { city: 'Porto Alegre' },
          },
        ],
        finishReason: 'STOP',
        metadata: streamFlags,
      });
      expect(events[2]?.accumulated).toBe('');
    });

    it('retries with the next key when stream iteration throws mid-flight', async () => {
      configureDualKey();
      const streamFailure = new Error('stream disconnected mid-flight');
      const brokenGenerateContentStream = jest.fn().mockResolvedValue(
        streamResultStub(
          failingStream(
            [{ candidates: [{ content: { parts: [{ text: 'partial ' }] } }] }],
            streamFailure,
          ),
        ),
      );
      const healthyGenerateContentStream = jest.fn().mockResolvedValue(
        streamResultStub(
          streamOf([
            {
              candidates: [
                { finishReason: 'STOP', content: { parts: [{ text: 'recovered answer' }] } },
              ],
            },
          ]),
          [{ finishReason: 'STOP', content: { parts: [{ text: 'recovered answer' }] } }],
        ),
      );
      mockGetGenerativeModel
        .mockImplementationOnce(() => ({ generateContentStream: brokenGenerateContentStream }))
        .mockImplementationOnce(() => ({ generateContentStream: healthyGenerateContentStream }));
      const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

      const provider = new GeminiProvider();
      const events = await collectStreamEvents(provider, [{ role: 'user', content: 'Tell me.' }]);

      expect(events.map((event) => event.type)).toEqual(['start', 'delta', 'start', 'delta', 'done']);
      expect(events[1]?.delta).toBe('partial ');
      expect(events[3]?.delta).toBe('recovered answer');
      expect(events[3]?.chunkIndex).toBe(1);
      expect(events[4]?.done).toBe(true);
      expect(events[4]?.accumulated).toBe('recovered answer');
      expect(events[4]?.response).toEqual({
        content: 'recovered answer',
        toolCalls: [],
        finishReason: 'STOP',
        metadata: streamFlags,
      });
      expect(warnSpy).toHaveBeenCalledWith(
        '[Gemini] Streaming error using key 1: stream disconnected mid-flight',
      );
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(
        '[Gemini Failover] Streaming succeeded using the secondary key (2/2).',
      );
      expect(brokenGenerateContentStream).toHaveBeenCalledTimes(1);
      expect(healthyGenerateContentStream).toHaveBeenCalledTimes(1);
      const [firstClient, secondClient] = MockGoogleGenerativeAI.mock.instances;
      expect(mockGetGenerativeModel.mock.contexts[0]).toBe(firstClient);
      expect(mockGetGenerativeModel.mock.contexts[1]).toBe(secondClient);
    });
  });

  describe('providerNativeTools', () => {
    it('adds googleSearch to the tools payload and reports grounding citations in metadata', async () => {
      configureSingleKey();
      defaultModel.generateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: 'Grounded answer.' }] },
              groundingMetadata: {
                groundingChunks: [
                  { web: { uri: 'https://example.com/zavorth-docs', title: 'Zavorth Docs' } },
                  { web: { uri: 'https://example.com/spec' } },
                ],
              },
            },
          ],
        },
      } satisfies ChatResponseStub);
      const options: ProviderChatOptions = {
        providerNativeTools: [
          { name: 'google_search', reason: 'Needs fresh sources.', requiredEvidence: 'citations' },
        ],
      };

      const provider = new GeminiProvider();
      const response = await provider.chat(
        [{ role: 'user', content: 'What changed recently?' }],
        undefined,
        options,
      );

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        { model: config.geminiModel, tools: [{ googleSearch: {} }] },
        undefined,
      );
      expect(response.content).toBe('Grounded answer.');
      expect(response.metadata).toEqual({
        providerNativeTools: {
          requested: [
            { name: 'google_search', reason: 'Needs fresh sources.', requiredEvidence: 'citations' },
          ],
          activated: ['google_search'],
          unsupported: [],
          googleSearch: {
            used: true,
            citationCount: 2,
            citations: [
              { title: 'Zavorth Docs', url: 'https://example.com/zavorth-docs' },
              { title: 'https://example.com/spec', url: 'https://example.com/spec' },
            ],
          },
        },
        groundingMetadata: {
          groundingChunks: [
            { web: { uri: 'https://example.com/zavorth-docs', title: 'Zavorth Docs' } },
            { web: { uri: 'https://example.com/spec' } },
          ],
        },
      });
    });

    it('lists requested tools without activation support under unsupported while code_execution self-enables', async () => {
      configureSingleKey();
      defaultModel.generateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: 'Computed and searched.' }] },
            },
          ],
        },
      } satisfies ChatResponseStub);
      const options: ProviderChatOptions = {
        providerNativeTools: [
          { name: 'google_search', reason: 'Fresh sources.' },
          { name: 'code_execution', reason: 'Run generated code.' },
          { name: 'provider_web_search', reason: 'Secondary web search.' },
        ],
      };

      const provider = new GeminiProvider();
      const response = await provider.chat(
        [{ role: 'user', content: 'Compute and search.' }],
        undefined,
        options,
      );

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        { model: config.geminiModel, tools: [{ googleSearch: {} }, { codeExecution: {} }] },
        undefined,
      );
      expect(response.metadata).toEqual({
        providerNativeTools: {
          requested: [
            { name: 'google_search', reason: 'Fresh sources.', requiredEvidence: 'none' },
            { name: 'code_execution', reason: 'Run generated code.', requiredEvidence: 'none' },
            {
              name: 'provider_web_search',
              reason: 'Secondary web search.',
              requiredEvidence: 'none',
            },
          ],
          activated: ['google_search', 'code_execution'],
          unsupported: ['provider_web_search'],
          googleSearch: {
            used: false,
            citationCount: 0,
            citations: [],
          },
        },
      });
    });
  });
});
