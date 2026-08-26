import type {
  ChatMessage,
  LlmResponse,
  LlmStreamEvent,
  ProviderChatOptions,
  ToolDefinition,
} from '../ILlmProvider.js';
import type { TransportAdapter } from './TransportAdapter.js';
import { GeminiInteractionsProviderAdapter } from '../GeminiInteractionsProviderAdapter.js';

export type GeminiInteractionsTransportOptions = {
  adapter?: Pick<GeminiInteractionsProviderAdapter, 'name' | 'chat'>;
};

export class GeminiInteractionsTransport implements TransportAdapter {
  public readonly name = 'gemini_interactions';

  private readonly adapter: Pick<GeminiInteractionsProviderAdapter, 'name' | 'chat'>;

  constructor(options: GeminiInteractionsTransportOptions = {}) {
    this.adapter = options.adapter || new GeminiInteractionsProviderAdapter();
  }

  public chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    return this.adapter.chat(messages, tools, options);
  }

  /**
   * Buffered stream facade over the non-streaming interactions API.
   *
   * The underlying Gemini Interactions API does not support token-level
   * streaming. This method calls `chat()`, waits for the complete response,
   * and yields the entire content as a single delta event. Tool call deltas
   * are synthesized from the buffered response so that consumers can process
   * them incrementally; however, the full `done` event is only available
   * after the entire response has been received.
   *
   * Consumers relying on tool calls should always handle the `done` event,
   * as the interactions API may return tool calls without text content.
   */
  public async *streamChat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent> {
    yield { type: 'start', accumulated: '', done: false };
    const response = await this.adapter.chat(messages, tools, options);
    const content = typeof response.content === 'string' && response.content.length > 0 ? response.content : '';
    if (content) {
      yield { type: 'delta', delta: content, accumulated: content, chunkIndex: 1, done: false };
    }
    for (let i = 0; i < response.toolCalls.length; i++) {
      const tc = response.toolCalls[i];
      yield {
        type: 'tool_call_delta',
        toolCallDelta: {
          index: i,
          id: tc.id,
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
        accumulated: content,
        done: false,
      };
    }
    yield { type: 'done', accumulated: content, response, done: true };
  }
}
