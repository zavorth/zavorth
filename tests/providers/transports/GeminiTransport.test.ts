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

import { GeminiTransport } from '../../../src/providers/transports/GeminiTransport';
import { logger } from '../../../src/logger';
import type {
  ChatMessage,
  LlmStreamEvent,
  ProviderChatOptions,
} from '../../../src/providers/ILlmProvider';

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

function chatResponse(text: string, candidateExtras: Partial<GeminiCandidate> = {}): unknown {
  return {
    response: {
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ text }] },
          ...candidateExtras,
        },
      ],
    },
  };
}

async function collectStreamEvents(
  transport: GeminiTransport,
  messages: ChatMessage[],
  options?: ProviderChatOptions,
): Promise<LlmStreamEvent[]> {
  const events: LlmStreamEvent[] = [];
  for await (const event of transport.streamChat(messages, undefined, options)) {
    events.push(event);
  }
  return events;
}

describe('GeminiTransport', () => {
  const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
  const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

  beforeEach(() => {
    mockGetGenerativeModel.mockReset();
    MockGoogleGenerativeAI.mockClear();
    warnSpy.mockClear();
    infoSpy.mockClear();
    mockGetGenerativeModel.mockReturnValue({
      generateContent: jest.fn().mockResolvedValue(chatResponse('ok')),
      generateContentStream: jest.fn().mockResolvedValue(
        streamResultStub(streamOf([]), [{ finishReason: 'STOP', content: { parts: [{ text: 'ok' }] } }]),
      ),
    });
  });

  describe('construction', () => {
    it('throws when no API keys are provided', () => {
      expect(() => new GeminiTransport([], 'gemini-test')).toThrow('At least one Gemini API key is required');
    });

    it('creates one SDK client per key in order', () => {
      const transport = new GeminiTransport(['key-a', 'key-b'], 'gemini-test');

      expect(transport.name).toBe('gemini');
      expect(MockGoogleGenerativeAI).toHaveBeenCalledTimes(2);
      expect(MockGoogleGenerativeAI.mock.calls[0][0]).toBe('key-a');
      expect(MockGoogleGenerativeAI.mock.calls[1][0]).toBe('key-b');
    });

    it('passes request options through to getGenerativeModel', async () => {
      const transport = new GeminiTransport(['key-a'], 'gemini-test', {
        baseUrl: 'https://proxy.internal',
        apiVersion: 'v1beta',
        customHeaders: { 'x-route': 'gemma' },
      });

      await transport.chat([{ role: 'user', content: 'oi' }]);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-test' }),
        expect.objectContaining({
          baseUrl: 'https://proxy.internal',
          apiVersion: 'v1beta',
          customHeaders: expect.objectContaining({ 'x-route': 'gemma' }),
        }),
      );
    });

    it('omits request options entirely when none are configured', async () => {
      const transport = new GeminiTransport(['key-a'], 'gemini-test');

      await transport.chat([{ role: 'user', content: 'oi' }]);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-test' }),
        undefined,
      );
    });
  });

  describe('chat', () => {
    it('omits the SDK call second argument when no signal is given but always passes it while streaming', async () => {
      const modelStub: ModelStub = {
        generateContent: jest.fn().mockResolvedValue(chatResponse('ok')),
        generateContentStream: jest.fn().mockResolvedValue(
          streamResultStub(streamOf([{ candidates: [{ finishReason: 'STOP' }] }])),
        ),
      };
      mockGetGenerativeModel.mockReturnValue(modelStub);
      const transport = new GeminiTransport(['key-a'], 'gemini-test');

      await transport.chat([{ role: 'user', content: 'hi' }]);
      await collectStreamEvents(transport, [{ role: 'user', content: 'hi' }]);

      expect(modelStub.generateContent.mock.calls[0]).toHaveLength(1);
      expect(modelStub.generateContentStream.mock.calls[0]).toEqual([
        expect.objectContaining({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
        undefined,
      ]);
    });

    it('passes the abort signal as the explicit second argument on chat calls', async () => {
      const controller = new AbortController();
      const transport = new GeminiTransport(['key-a'], 'gemini-test');

      await transport.chat([{ role: 'user', content: 'hello there' }], undefined, {
        signal: controller.signal,
      });

      const generateContent = mockGetGenerativeModel.mock.results[0].value.generateContent as jest.Mock;
      expect(generateContent).toHaveBeenCalledWith(
        {
          contents: [{ role: 'user', parts: [{ text: 'hello there' }] }],
          systemInstruction: undefined,
        },
        { signal: controller.signal },
      );
    });

    it('joins multiple system messages into a single systemInstruction', async () => {
      const transport = new GeminiTransport(['key-a'], 'gemini-test');

      await transport.chat([
        { role: 'system', content: 'Rule one.' },
        { role: 'system', content: 'Rule two.' },
        { role: 'user', content: 'Hello there.' },
        { role: 'assistant', content: 'Hi back.' },
      ]);

      const payload = (mockGetGenerativeModel.mock.results[0].value.generateContent as jest.Mock)
        .mock.calls[0][0] as GenerateContentPayload;
      expect(payload.systemInstruction).toBe('Rule one.\nRule two.');
      expect(payload.contents).toEqual([
        { role: 'user', parts: [{ text: 'Hello there.' }] },
        { role: 'model', parts: [{ text: 'Hi back.' }] },
      ]);
    });

    it('defaults array parameters to a string item schema', async () => {
      const transport = new GeminiTransport(['key-a'], 'gemini-test');

      await transport.chat([{ role: 'user', content: 'list paths' }], [
        {
          name: 'scan_paths',
          description: 'Scans provided paths.',
          parameters: {
            type: 'object',
            properties: {
              paths: { type: 'array', description: 'Paths to process.' },
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
                  name: 'scan_paths',
                  parameters: expect.objectContaining({
                    type: 'object',
                    properties: expect.objectContaining({
                      paths: expect.objectContaining({
                        type: 'array',
                        items: expect.objectContaining({ type: 'string' }),
                      }),
                    }),
                  }),
                }),
              ],
            }),
          ],
        }),
        undefined,
      );
    });

    it('uses the original tool name in functionResponse messages', async () => {
      const transport = new GeminiTransport(['key-a'], 'gemini-test');

      await transport.chat([
        { role: 'user', content: 'Read the README.' },
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
          description: 'Reads a file',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Path' },
            },
            required: ['filePath'],
          },
        },
      ]);

      const payload = (mockGetGenerativeModel.mock.results[0].value.generateContent as jest.Mock)
        .mock.calls[0][0] as GenerateContentPayload;
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

    it('returns the no-response fallback object when candidates are empty', async () => {
      mockGetGenerativeModel.mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({ response: { candidates: [] } }),
      });
      const transport = new GeminiTransport(['key-a'], 'gemini-test');

      await expect(transport.chat([{ role: 'user', content: 'Anyone there?' }])).resolves.toEqual({
        content: 'No response from model.',
        toolCalls: [],
        finishReason: 'error',
      });
    });

    it('fails over to the second key on quota rejection and stays sticky for the next request', async () => {
      const quotaError = new Error('429 quota exceeded');
      const failingGenerateContent = jest.fn().mockRejectedValue(quotaError);
      const recoveredGenerateContent = jest.fn().mockResolvedValue(chatResponse('recovered answer'));
      mockGetGenerativeModel
        .mockImplementationOnce(() => ({ generateContent: failingGenerateContent }))
        .mockImplementation(() => ({ generateContent: recoveredGenerateContent }));

      const transport = new GeminiTransport(['key-1', 'key-2'], 'gemini-test');
      const [firstClient, secondClient] = MockGoogleGenerativeAI.mock.instances;

      await expect(transport.chat([{ role: 'user', content: 'Try me.' }]))
        .resolves.toEqual(expect.objectContaining({ content: 'recovered answer' }));

      expect(warnSpy).toHaveBeenCalledWith('[Gemini] Error using key 1: 429 quota exceeded');
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(
        '[Gemini Failover] Request succeeded using the secondary key (2/2).',
      );

      await expect(transport.chat([{ role: 'user', content: 'Again.' }]))
        .resolves.toEqual(expect.objectContaining({ content: 'recovered answer' }));

      expect(failingGenerateContent).toHaveBeenCalledTimes(1);
      expect(recoveredGenerateContent).toHaveBeenCalledTimes(2);
      expect(mockGetGenerativeModel.mock.contexts).toHaveLength(3);
      expect(mockGetGenerativeModel.mock.contexts[0]).toBe(firstClient);
      expect(mockGetGenerativeModel.mock.contexts[1]).toBe(secondClient);
      expect(mockGetGenerativeModel.mock.contexts[2]).toBe(secondClient);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    it('propagates an abort error without attempting the next key', async () => {
      const controller = new AbortController();
      const abortError = Object.assign(new Error('The operation was aborted'), {
        name: 'AbortError',
      });
      const abortingGenerateContent = jest.fn().mockRejectedValue(abortError);
      mockGetGenerativeModel.mockImplementation(() => ({
        generateContent: abortingGenerateContent,
      }));
      const transport = new GeminiTransport(['key-1', 'key-2'], 'gemini-test');

      await expect(
        transport.chat([{ role: 'user', content: 'hello there' }], undefined, {
          signal: controller.signal,
        }),
      ).rejects.toBe(abortError);

      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('activates googleSearch natively and extracts grounding citations into metadata', async () => {
      mockGetGenerativeModel.mockReturnValue({
        generateContent: jest.fn().mockResolvedValue(chatResponse('Grounded answer.', {
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: 'https://example.com/zavorth-docs', title: 'Zavorth Docs' } },
              { web: { uri: 'https://example.com/spec' } },
            ],
          },
        })),
      });
      const transport = new GeminiTransport(['key-a'], 'gemini-test');

      const response = await transport.chat(
        [{ role: 'user', content: 'What changed recently?' }],
        undefined,
        {
          providerNativeTools: [
            { name: 'google_search', reason: 'Needs fresh sources.', requiredEvidence: 'citations' },
          ],
        },
      );

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        { model: 'gemini-test', tools: [{ googleSearch: {} }] },
        undefined,
      );
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
  });

  describe('streamChat', () => {
    it('emits start, delta and done with the resolved final response on the happy path', async () => {
      mockGetGenerativeModel.mockReturnValue({
        generateContentStream: jest.fn().mockResolvedValue(
          streamResultStub(
            streamOf([
              { candidates: [{ content: { parts: [{ text: 'Hello ' }] } }] },
              { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'world' }] } }] },
            ]),
            [{ finishReason: 'STOP', content: { parts: [{ text: 'Hello world' }] } }],
          ),
        ),
      });
      const transport = new GeminiTransport(['key-a'], 'gemini-test');

      const events = await collectStreamEvents(transport, [{ role: 'user', content: 'Say hello.' }]);

      expect(events.map((event) => event.type)).toEqual(['start', 'delta', 'delta', 'done']);
      expect(events[0]).toEqual({
        type: 'start',
        accumulated: '',
        done: false,
        metadata: {
          providerNativeTokenStreaming: true,
          providerNativeStreamSource: 'gemini-generate-content-stream',
        },
      });
      expect(events[1]).toMatchObject({ delta: 'Hello ', accumulated: 'Hello ', chunkIndex: 1 });
      expect(events[3]?.done).toBe(true);
      expect(events[3]?.response).toEqual({
        content: 'Hello world',
        toolCalls: [],
        finishReason: 'STOP',
        metadata: {
          providerNativeTokenStreaming: true,
          providerNativeStreamSource: 'gemini-generate-content-stream',
        },
      });
    });

    it('emits JSON-stringified tool_call_delta arguments and carries parsed tool calls into the done response', async () => {
      mockGetGenerativeModel.mockReturnValue({
        generateContentStream: jest.fn().mockResolvedValue(
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
            [{ finishReason: 'STOP', content: { parts: [{ functionCall: { name: 'lookup_city', args: { city: 'Porto Alegre' } } }] } }],
          ),
        ),
      });
      const transport = new GeminiTransport(['key-a'], 'gemini-test');

      const events = await collectStreamEvents(transport, [
        { role: 'user', content: 'Which city is this?' },
      ]);

      expect(events.map((event) => event.type)).toEqual(['start', 'tool_call_delta', 'done']);
      expect(events[1]?.toolCallDelta).toEqual({
        index: 0,
        id: expect.stringMatching(/^call_/),
        name: 'lookup_city',
        arguments: '{"city":"Porto Alegre"}',
      });
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
        metadata: {
          providerNativeTokenStreaming: true,
          providerNativeStreamSource: 'gemini-generate-content-stream',
        },
      });
    });

    it('retries with the next key mid-flight and resets accumulator state between attempts', async () => {
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

      const transport = new GeminiTransport(['key-1', 'key-2'], 'gemini-test');
      const [firstClient, secondClient] = MockGoogleGenerativeAI.mock.instances;

      const events = await collectStreamEvents(transport, [{ role: 'user', content: 'Tell me.' }]);

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
        metadata: {
          providerNativeTokenStreaming: true,
          providerNativeStreamSource: 'gemini-generate-content-stream',
        },
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
      expect(mockGetGenerativeModel.mock.contexts[0]).toBe(firstClient);
      expect(mockGetGenerativeModel.mock.contexts[1]).toBe(secondClient);
    });

    it('propagates an abort error raised during streaming without attempting the next key', async () => {
      const controller = new AbortController();
      const abortError = Object.assign(new Error('The operation was aborted'), {
        name: 'AbortError',
      });
      const abortingGenerateContentStream = jest.fn().mockRejectedValue(abortError);
      mockGetGenerativeModel.mockImplementation(() => ({
        generateContentStream: abortingGenerateContentStream,
      }));
      const transport = new GeminiTransport(['key-1', 'key-2'], 'gemini-test');

      await expect(
        collectStreamEvents(transport, [{ role: 'user', content: 'stop now' }], {
          signal: controller.signal,
        }),
      ).rejects.toBe(abortError);

      expect(abortingGenerateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({ contents: [{ role: 'user', parts: [{ text: 'stop now' }] }] }),
        { signal: controller.signal },
      );
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('rejects with the last stream error when every key fails', async () => {
      const firstError = new Error('down one');
      const secondError = new Error('down two');
      mockGetGenerativeModel
        .mockImplementationOnce(() => ({
          generateContentStream: jest.fn().mockRejectedValue(firstError),
        }))
        .mockImplementationOnce(() => ({
          generateContentStream: jest.fn().mockRejectedValue(secondError),
        }));
      const transport = new GeminiTransport(['key-1', 'key-2'], 'gemini-test');

      await expect(collectStreamEvents(transport, [{ role: 'user', content: 'hello' }]))
        .rejects.toBe(secondError);

      expect(warnSpy).toHaveBeenCalledWith('[Gemini] Streaming error using key 1: down one');
      expect(warnSpy).toHaveBeenCalledWith('[Gemini] Streaming error using key 2: down two');
    });
  });
});
