import {
  GeminiInteractionsTransport,
} from '../../../src/providers/transports/GeminiInteractionsTransport';
import type {
  ChatMessage,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolCall,
  ToolDefinition,
} from '../../../src/providers/ILlmProvider';

type ProviderBootstrapModule = typeof import('../../../src/providers/ProviderBootstrap');
type GeminiInteractionsTransportModule = typeof import('../../../src/providers/transports/GeminiInteractionsTransport');

const messagesFixture: ChatMessage[] = [
  { role: 'system', content: 'Be concise.' },
  { role: 'user', content: 'Hello there.' },
];

function toolFixture(): ToolDefinition[] {
  return [{
    name: 'preview',
    description: 'Previews a plan.',
    parameters: {
      type: 'object',
      properties: {
        risk: { type: 'string', description: 'Risk level.' },
      },
      required: ['risk'],
    },
  }];
}

function responseFixture(content: string | null, toolCalls: ToolCall[] = []): LlmResponse {
  return {
    content,
    toolCalls,
    finishReason: 'stop',
    metadata: { geminiInteractionReceipt: { provider: 'gemini-interactions', steps: [] } },
  };
}

async function collectStreamEvents(
  transport: GeminiInteractionsTransport,
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  options?: ProviderChatOptions,
): Promise<LlmStreamEvent[]> {
  const events: LlmStreamEvent[] = [];
  for await (const event of transport.streamChat(messages, tools, options)) {
    events.push(event);
  }
  return events;
}

describe('GeminiInteractionsTransport', () => {
  it('exposes the gemini-interactions transport name', () => {
    const chat = jest.fn().mockResolvedValue(responseFixture('ok'));
    const transport = new GeminiInteractionsTransport({ adapter: { name: 'gemini-interactions', chat } });

    expect(transport.name).toBe('gemini-interactions');
  });

  describe('chat', () => {
    it('delegates messages, tools and options straight through to the adapter', async () => {
      const response = responseFixture('Hello there.');
      const chat = jest.fn().mockResolvedValue(response);
      const transport = new GeminiInteractionsTransport({ adapter: { name: 'gemini-interactions', chat } });
      const tools = toolFixture();
      const options: ProviderChatOptions = { modelName: 'gemini-2.5-flash' };

      await expect(transport.chat(messagesFixture, tools, options)).resolves.toBe(response);

      expect(chat).toHaveBeenCalledTimes(1);
      expect(chat).toHaveBeenCalledWith(messagesFixture, tools, options);
    });

    it('delegates without tools or options when none are given', async () => {
      const chat = jest.fn().mockResolvedValue(responseFixture(null));
      const transport = new GeminiInteractionsTransport({ adapter: { name: 'gemini-interactions', chat } });

      await transport.chat(messagesFixture);

      expect(chat).toHaveBeenCalledWith(messagesFixture, undefined, undefined);
    });
  });

  describe('streamChat', () => {
    it('synthesizes exactly start, delta and done for non-empty content', async () => {
      const response = responseFixture('Hello there.');
      const chat = jest.fn().mockResolvedValue(response);
      const transport = new GeminiInteractionsTransport({ adapter: { name: 'gemini-interactions', chat } });

      const events = await collectStreamEvents(
        transport,
        messagesFixture,
        toolFixture(),
        { modelName: 'gemini-2.5-flash' },
      );

      expect(events.map((event) => event.type)).toEqual(['start', 'delta', 'done']);
      expect(events[0]).toEqual({ type: 'start', accumulated: '', done: false });
      expect(events[1]).toEqual({
        type: 'delta',
        delta: 'Hello there.',
        accumulated: 'Hello there.',
        chunkIndex: 1,
        done: false,
      });
      expect(events[2]).toEqual({
        type: 'done',
        accumulated: 'Hello there.',
        response,
        done: true,
      });
      expect(chat).toHaveBeenCalledWith(messagesFixture, toolFixture(), { modelName: 'gemini-2.5-flash' });
    });

    it('skips the delta event when content is null but tool calls are present', async () => {
      const toolCalls: ToolCall[] = [{
        id: 'interaction_step_2',
        name: 'preview',
        arguments: { risk: 'low' },
      }];
      const response = responseFixture(null, toolCalls);
      const chat = jest.fn().mockResolvedValue(response);
      const transport = new GeminiInteractionsTransport({ adapter: { name: 'gemini-interactions', chat } });

      const events = await collectStreamEvents(transport, messagesFixture);

      expect(events.map((event) => event.type)).toEqual(['start', 'done']);
      expect(events[1]).toEqual({
        type: 'done',
        accumulated: '',
        response,
        done: true,
      });
      expect(events[1]?.response?.toolCalls).toEqual(toolCalls);
    });

    it('propagates the adapter rejection after start without yielding any delta', async () => {
      const failure = new Error('Gemini Interactions API error: HTTP 500');
      const chat = jest.fn().mockRejectedValue(failure);
      const transport = new GeminiInteractionsTransport({ adapter: { name: 'gemini-interactions', chat } });

      const events: LlmStreamEvent[] = [];
      await expect((async () => {
        for await (const event of transport.streamChat(messagesFixture)) {
          events.push(event);
        }
      })()).rejects.toBe(failure);

      expect(events.map((event) => event.type)).toEqual(['start']);
    });
  });
});

describe('ProviderBootstrap gemini_interactions gating', () => {
  const originalEnv = process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED;
    } else {
      process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED = originalEnv;
    }
    jest.resetModules();
  });

  function loadFreshModules(): {
    bootstrap: ProviderBootstrapModule['ProviderBootstrap'];
    transportCtor: GeminiInteractionsTransportModule['GeminiInteractionsTransport'];
  } {
    // Re-require after resetModules so each scenario gets a fresh bootstrap singleton (CJS-safe instance).
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const bootstrapModule = require('../../../src/providers/ProviderBootstrap') as ProviderBootstrapModule;
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const transportModule = require('../../../src/providers/transports/GeminiInteractionsTransport') as GeminiInteractionsTransportModule;
    return { bootstrap: bootstrapModule.ProviderBootstrap, transportCtor: transportModule.GeminiInteractionsTransport };
  }

  it('resolves gemini-interactions through the neutral seam when the flag is enabled', () => {
    process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED = 'true';
    const { bootstrap, transportCtor } = loadFreshModules();

    const resolved = bootstrap.resolveProvider('gemini-interactions');

    expect(resolved.apiMode).toBe('gemini_interactions');
    expect(resolved.transport).toBeInstanceOf(transportCtor);
    expect(resolved.transport.name).toBe('gemini-interactions');
  });

  it('resolves the interactions-api alias to the same api mode when enabled', () => {
    process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED = 'true';
    const { bootstrap, transportCtor } = loadFreshModules();

    const resolved = bootstrap.resolveProvider('interactions-api');

    expect(resolved.apiMode).toBe('gemini_interactions');
    expect(resolved.transport).toBeInstanceOf(transportCtor);
  });

  it('fails fast with the standard no-transport error when the flag is off', () => {
    delete process.env.ZAVORTH_GEMINI_INTERACTIONS_ENABLED;
    const { bootstrap } = loadFreshModules();

    expect(() => bootstrap.resolveProvider('gemini-interactions'))
      .toThrow('No transport registered for apiMode "gemini_interactions"');
  });
});
