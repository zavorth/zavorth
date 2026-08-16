/**
 * OpenAI-Compatible Universal LLM Adapter.
 * Supports OpenAI, Groq, DeepSeek, Together AI, OpenRouter, Ollama, vLLM, and LM Studio.
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

export interface OpenAICompatibleAdapterConfig {
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  customHeaders?: Record<string, string>;
}

export class OpenAICompatibleAdapter implements LLMAdapter {
  public readonly id: string;
  public readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly customHeaders: Record<string, string>;

  constructor(config: OpenAICompatibleAdapterConfig = {}) {
    this.id = config.id || 'openai-compatible';
    this.name = config.name || 'OpenAI-Compatible Engine';
    this.baseUrl = (config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.defaultModel = config.defaultModel || 'gpt-4o';
    this.customHeaders = config.customHeaders || {};
  }

  public async complete(messages: ChatMessage[], options: CompletionOptions): Promise<CompletionResult> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;
    const body = this.buildRequestBody(messages, options, false);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.customHeaders,
      ...(options.customHeaders || {}),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await safeFetch(
        `${this.baseUrl}/chat/completions`,
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
        throw new Error(`HTTP ${response.status} from ${this.name}: ${errorText}`);
      }

      const data = (await response.json()) as Record<string, any>;
      const choice = data.choices?.[0] || {};
      const message = choice.message || {};

      const content = message.content || '';
      const reasoningContent = message.reasoning_content || message.thought || undefined;
      const toolCalls: ToolCall[] = (message.tool_calls || []).map((tc: any) => ({
        id: tc.id || `call_${Date.now()}`,
        type: 'function',
        function: {
          name: tc.function?.name || '',
          arguments: tc.function?.arguments || '{}',
        },
      }));

      const usage: TokenUsage = {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
        reasoningTokens: data.usage?.completion_tokens_details?.reasoning_tokens || 0,
        cacheReadTokens: data.usage?.prompt_tokens_details?.cached_tokens || 0,
      };

      const costUsd = DynamicCostEstimator.estimateCost(model, {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        reasoningTokens: usage.reasoningTokens,
        cacheReadTokens: usage.cacheReadTokens,
      });

      return {
        content,
        reasoningContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: choice.finish_reason || 'stop',
        usage,
        model,
        provider: this.name,
        latencyMs: Date.now() - startTime,
        costUsd,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      throw new Error(`[${this.name}] Request failed: ${err.message}`);
    }
  }

  public async *streamComplete(messages: ChatMessage[], options: CompletionOptions): AsyncIterable<StreamChunk> {
    const model = options.model || this.defaultModel;
    const body = this.buildRequestBody(messages, options, true);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.customHeaders,
      ...(options.customHeaders || {}),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await safeFetch(
      `${this.baseUrl}/chat/completions`,
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
      throw new Error(`HTTP ${response.status} from ${this.name}: ${errorText}`);
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
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') return;

          if (trimmed.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const choice = json.choices?.[0];
              if (!choice) continue;

              const delta = choice.delta || {};
              const chunk: StreamChunk = {
                deltaText: delta.content || '',
                deltaReasoning: delta.reasoning_content || delta.thought || undefined,
                finishReason: choice.finish_reason || undefined,
              };

              if (delta.tool_calls) {
                chunk.toolCallDeltas = delta.tool_calls.map((tc: any) => ({
                  index: tc.index || 0,
                  id: tc.id,
                  name: tc.function?.name,
                  arguments: tc.function?.arguments,
                }));
              }

              if (json.usage) {
                chunk.usage = {
                  promptTokens: json.usage.prompt_tokens || 0,
                  completionTokens: json.usage.completion_tokens || 0,
                  totalTokens: json.usage.total_tokens || 0,
                };
              }

              yield chunk;
            } catch {
              // Ignore partial JSON parse errors in stream
            }
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
        id: this.defaultModel,
        provider: this.name,
        displayName: this.defaultModel,
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportsTools: true,
        supportsVision: true,
        supportsReasoning: true,
      },
    ];
  }

  public async validateConfig(): Promise<{ valid: boolean; reason?: string }> {
    if (!this.apiKey && !this.baseUrl.includes('localhost') && !this.baseUrl.includes('127.0.0.1')) {
      return { valid: false, reason: 'API key is missing for remote OpenAI-compatible endpoint.' };
    }
    return { valid: true };
  }

  private buildRequestBody(messages: ChatMessage[], options: CompletionOptions, stream: boolean): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        name: m.name,
        tool_calls: m.toolCalls,
        tool_call_id: m.toolCallId,
      })),
      stream,
    };

    if (options.temperature !== undefined) payload.temperature = options.temperature;
    if (options.maxTokens !== undefined) payload.max_tokens = options.maxTokens;
    if (options.stopSequences) payload.stop = options.stopSequences;

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      if (options.toolChoice) payload.tool_choice = options.toolChoice;
    }

    if (options.thinking?.effort) {
      payload.reasoning_effort = options.thinking.effort;
    }

    return payload;
  }
}
