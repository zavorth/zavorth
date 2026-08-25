type FakeCompletions = { create: jest.Mock };
type FakeOpenAIClient = { chat: { completions: FakeCompletions } };

const MockOpenAI = jest.fn(function (this: FakeOpenAIClient) {
  this.chat = { completions: { create: jest.fn() } };
});

jest.mock('openai', () => ({
  __esModule: true,
  default: MockOpenAI,
}));

import { OpenAITransport } from '../../../src/providers/transports/OpenAITransport';
import { logger } from '../../../src/logger';
import type { LlmStreamEvent } from '../../../src/providers/ILlmProvider';

function createForClient(index: number): jest.Mock {
  const instance = MockOpenAI.mock.instances[index] as unknown as FakeOpenAIClient;
  return instance.chat.completions.create;
}

function chatResponse(content: string): unknown {
  return {
    choices: [
      {
        message: { content, tool_calls: [] },
        finish_reason: 'stop',
      },
    ],
  };
}

async function* streamOf(chunks: unknown[]): AsyncIterable<unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function* failingStream(chunks: unknown[], failure: unknown): AsyncIterable<unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
  throw failure;
}

function deltaChunk(text: string, finishReason?: string): unknown {
  return {
    choices: [
      {
        delta: { content: text },
        finish_reason: finishReason ?? null,
      },
    ],
  };
}

async function collectStream(transport: OpenAITransport): Promise<LlmStreamEvent[]> {
  const events: LlmStreamEvent[] = [];
  for await (const event of transport.streamChat([{ role: 'user', content: 'hello' }])) {
    events.push(event);
  }
  return events;
}

describe('OpenAITransport key failover', () => {
  const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
  const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

  beforeEach(() => {
    MockOpenAI.mockClear();
    warnSpy.mockClear();
    infoSpy.mockClear();
  });

  it('parses a first-key chat response without touching the remaining keys', async () => {
    const transport = new OpenAITransport(['key-1', 'key-2'], 'gpt-test');
    createForClient(0).mockResolvedValueOnce(chatResponse('hello'));

    await expect(
      transport.chat([{ role: 'user', content: 'hi' }]),
    ).resolves.toEqual({ content: 'hello', toolCalls: [], finishReason: 'stop' });

    expect(createForClient(0)).toHaveBeenCalledTimes(1);
    expect(createForClient(0)).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-test' }),
      undefined,
    );
    expect(createForClient(1)).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('fails over to key 2 on request failure and stays sticky afterwards', async () => {
    const transport = new OpenAITransport(['key-1', 'key-2'], 'gpt-test');
    createForClient(0).mockRejectedValueOnce(new Error('boom'));
    createForClient(1).mockResolvedValueOnce(chatResponse('recovered'));

    await expect(
      transport.chat([{ role: 'user', content: 'hi' }]),
    ).resolves.toEqual({ content: 'recovered', toolCalls: [], finishReason: 'stop' });

    expect(warnSpy).toHaveBeenCalledWith('[OpenAI Transport] Request failed with key 1: boom');
    expect(infoSpy).toHaveBeenCalledWith('[OpenAI Transport] Failover succeeded with key 2/2');

    createForClient(1).mockResolvedValueOnce(chatResponse('again'));
    await expect(
      transport.chat([{ role: 'user', content: 'hi again' }]),
    ).resolves.toEqual({ content: 'again', toolCalls: [], finishReason: 'stop' });

    expect(createForClient(0)).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it('propagates the original error when every chat key fails', async () => {
    const transport = new OpenAITransport(['key-1', 'key-2'], 'gpt-test');
    const firstError = new Error('first down');
    const secondError = new Error('second down');
    createForClient(0).mockRejectedValueOnce(firstError);
    createForClient(1).mockRejectedValueOnce(secondError);

    await expect(transport.chat([{ role: 'user', content: 'hi' }])).rejects.toBe(secondError);

    expect(warnSpy).toHaveBeenCalledWith('[OpenAI Transport] Request failed with key 1: first down');
    expect(warnSpy).toHaveBeenCalledWith('[OpenAI Transport] Request failed with key 2: second down');
  });

  it('retries raw stream errors against the next key within one stream', async () => {
    const transport = new OpenAITransport(['key-1', 'key-2'], 'gpt-test');
    createForClient(0).mockResolvedValueOnce(
      failingStream([deltaChunk('partial ')], new Error('stream broke')),
    );
    createForClient(1).mockResolvedValueOnce(
      streamOf([deltaChunk('recovered', 'stop')]),
    );

    const events = await collectStream(transport);

    expect(events.map((event) => event.type)).toEqual(['start', 'delta', 'delta', 'done']);
    expect(events[0]).toEqual({ type: 'start', accumulated: '', done: false });
    expect(events[1]).toMatchObject({ type: 'delta', delta: 'partial ', accumulated: 'partial ', chunkIndex: 1 });
    expect(events[2]).toMatchObject({ type: 'delta', delta: 'recovered', accumulated: 'partial recovered', chunkIndex: 2 });
    expect(events[3]).toMatchObject({
      type: 'done',
      accumulated: 'partial recovered',
      done: true,
      response: { content: 'partial recovered', toolCalls: [], finishReason: 'stop' },
    });
    expect(warnSpy).toHaveBeenCalledWith('[OpenAI Transport] Stream failed with key 1: stream broke');
    expect(infoSpy).toHaveBeenCalledWith('[OpenAI Transport] Stream failover succeeded with key 2/2');
  });

  it('propagates the last stream error when every key fails while streaming', async () => {
    const transport = new OpenAITransport(['key-1', 'key-2'], 'gpt-test');
    const firstError = new Error('down one');
    const secondError = new Error('down two');
    createForClient(0).mockRejectedValueOnce(firstError);
    createForClient(1).mockRejectedValueOnce(secondError);

    await expect(collectStream(transport)).rejects.toBe(secondError);

    expect(warnSpy).toHaveBeenCalledWith('[OpenAI Transport] Stream failed with key 1: down one');
    expect(warnSpy).toHaveBeenCalledWith('[OpenAI Transport] Stream failed with key 2: down two');
  });
});
