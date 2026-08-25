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
  public readonly name = 'gemini-interactions';

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
    yield { type: 'done', accumulated: content, response, done: true };
  }
}
