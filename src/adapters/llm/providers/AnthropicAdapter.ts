/**
 * Anthropic Claude Universal LLM Adapter.
 * Native support for Claude 3.5/3.7 Sonnet, Haiku, Opus with tools, extended thinking, and prompt caching.
 */

import { safeFetch } from '../../../security/SafeFetchService.js';
import { asErrorLike } from '../../../utils/errorLike.js';
import { DynamicCostEstimator } from '../../../services/pricing/DynamicCostEstimator.js';
import type {
  LLMAdapter,
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  ModelMetadata,
  ToolCall,
  TokenUsage,
} from '../LLMAdapterContract.js';

export interface AnthropicAdapterConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  costEstimator?: (model: string, usage: { inputTokens: number; outputTokens: number; reasoningTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number }) => number;
}

export class AnthropicAdapter implements LLMAdapter {
  public readonly id = 'anthropic';
  public readonly name = 'Anthropic Claude Engine';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly customCostEstimator?: AnthropicAdapterConfig['costEstimator'];

  constructor(config: AnthropicAdapterConfig = {}) {
    this.baseUrl = (config.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.defaultModel = config.defaultModel || 'claude-3-7-sonnet-20250219';
    this.customCostEstimator = config.costEstimator;
  }

  public async complete(messages: ChatMessage[], options: CompletionOptions): Promise<CompletionResult> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;
    const { systemPrompt, anthropicMessages } = this.formatMessages(messages);
    const body = this.buildRequestBody(systemPrompt, anthropicMessages, options, false);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31,thinking-2024-11-06',
      ...(options.customHeaders || {}),
    };

    try {
      const response = await safeFetch(
        `${this.baseUrl}/messages`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: options.signal,
        },
        { serviceName: this.name }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} from Anthropic: ${errorText}`);
      }

      const data = (await response.json()) as Record<string, any>;
      let textContent = '';
      let reasoningContent: string | undefined;
      const toolCalls: ToolCall[] = [];

      for (const block of data.content || []) {
        if (block.type === 'text') {
          textContent += block.text || '';
        } else if (block.type === 'thinking') {
          reasoningContent = (reasoningContent ? reasoningContent + '\n' : '') + (block.thinking || '');
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id || `call_${Date.now()}`,
            type: 'function',
            function: {
              name: block.name || '',
              arguments: JSON.stringify(block.input || {}),
            },
          });
        }
      }

      const usage: TokenUsage = {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        cacheReadTokens: data.usage?.cache_read_input_tokens || 0,
        cacheWriteTokens: data.usage?.cache_creation_input_tokens || 0,
      };

      const costUsd = this.customCostEstimator
        ? this.customCostEstimator(model, {
            inputTokens: usage.promptTokens,
            outputTokens: usage.completionTokens,
            cacheReadTokens: usage.cacheReadTokens,
            cacheWriteTokens: usage.cacheWriteTokens,
          })
        : DynamicCostEstimator.estimateCost(model, {
            inputTokens: usage.promptTokens,
            outputTokens: usage.completionTokens,
            cacheReadTokens: usage.cacheReadTokens,
            cacheWriteTokens: usage.cacheWriteTokens,
          });

      return {
        content: textContent,
        reasoningContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
        usage,
        model,
        provider: this.name,
        latencyMs: Date.now() - startTime,
        costUsd,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      throw new Error(`[Anthropic] Request failed: ${err.message}`);
    }
  }

  public async *streamComplete(messages: ChatMessage[], options: CompletionOptions): AsyncIterable<StreamChunk> {
    const { systemPrompt, anthropicMessages } = this.formatMessages(messages);
    const body = this.buildRequestBody(systemPrompt, anthropicMessages, options, true);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31,thinking-2024-11-06',
      ...(options.customHeaders || {}),
    };

    const response = await safeFetch(
      `${this.baseUrl}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options.signal,
      },
      { serviceName: this.name }
    );

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status} from Anthropic stream: ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') return;

          try {
            const event = JSON.parse(dataStr);
            if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'text_delta') {
                yield { deltaText: event.delta.text || '' };
              } else if (event.delta?.type === 'thinking_delta') {
                yield { deltaText: '', deltaReasoning: event.delta.thinking || '' };
              } else if (event.delta?.type === 'input_json_delta') {
                yield {
                  deltaText: '',
                  toolCallDeltas: [
                    {
                      index: event.index || 0,
                      arguments: event.delta.partial_json || '',
                    },
                  ],
                };
              }
            } else if (event.type === 'message_delta') {
              if (event.delta?.stop_reason) {
                yield {
                  deltaText: '',
                  finishReason: event.delta.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
                };
              }
            }
          } catch {
            // Skip partial stream lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  public async listModels(): Promise<ModelMetadata[]> {
    return [
      {
        id: 'claude-3-7-sonnet-20250219',
        provider: 'Anthropic',
        displayName: 'Claude 3.7 Sonnet',
        contextWindow: 200000,
        maxOutputTokens: 64000,
        supportsTools: true,
        supportsVision: true,
        supportsReasoning: true,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        provider: 'Anthropic',
        displayName: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsTools: true,
        supportsVision: true,
        supportsReasoning: false,
      },
    ];
  }

  public async validateConfig(): Promise<{ valid: boolean; reason?: string }> {
    if (!this.apiKey) {
      return { valid: false, reason: 'ANTHROPIC_API_KEY is not configured.' };
    }
    return { valid: true };
  }

  private formatMessages(messages: ChatMessage[]): { systemPrompt: string; anthropicMessages: any[] } {
    let systemPrompt = '';
    const anthropicMessages: any[] = [];

    for (const m of messages) {
      if (m.role === 'system') {
        systemPrompt = (systemPrompt ? systemPrompt + '\n' : '') + m.content;
      } else if (m.role === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId || '',
              content: m.content,
            },
          ],
        });
      } else if (m.role === 'assistant') {
        const blocks: any[] = [];
        if (m.thought) {
          blocks.push({ type: 'thinking', thinking: m.thought, signature: '' });
        }
        if (m.content) {
          blocks.push({ type: 'text', text: m.content });
        }
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            let inputJson = {};
            try {
              inputJson = JSON.parse(tc.function.arguments || '{}');
            } catch {
              // Safe fallback
            }
            blocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input: inputJson,
            });
          }
        }
        anthropicMessages.push({ role: 'assistant', content: blocks });
      } else {
        anthropicMessages.push({ role: 'user', content: m.content });
      }
    }

    return { systemPrompt, anthropicMessages };
  }

  private buildRequestBody(
    systemPrompt: string,
    messages: any[],
    options: CompletionOptions,
    stream: boolean
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      max_tokens: options.maxTokens || 4096,
      messages,
      stream,
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    if (options.thinking?.enabled || options.thinking?.effort) {
      payload.thinking = {
        type: 'enabled',
        budget_tokens: options.thinking.budgetTokens || 2048,
      };
      // Anthropic invariant: temperature must be exactly 1.0 when extended thinking is enabled
      payload.temperature = 1.0;
    } else if (options.temperature !== undefined) {
      payload.temperature = options.temperature;
    }

    return payload;
  }
}
