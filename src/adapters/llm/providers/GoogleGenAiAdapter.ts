/**
 * Google Gemini Universal LLM Adapter.
 * Native support for Gemini 2.5 Pro/Flash and Gemini 2.0 with function calling and thinking modes.
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

export interface GoogleGenAiAdapterConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  costEstimator?: (model: string, usage: { inputTokens: number; outputTokens: number; reasoningTokens?: number; cacheReadTokens?: number }) => number;
}

export class GoogleGenAiAdapter implements LLMAdapter {
  public readonly id = 'google';
  public readonly name = 'Google Gemini Engine';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly customCostEstimator?: GoogleGenAiAdapterConfig['costEstimator'];

  constructor(config: GoogleGenAiAdapterConfig = {}) {
    this.baseUrl = (config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || '';
    this.defaultModel = config.defaultModel || 'gemini-2.5-flash';
    this.customCostEstimator = config.costEstimator;
  }

  public async complete(messages: ChatMessage[], options: CompletionOptions): Promise<CompletionResult> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;
    const body = this.buildRequestBody(messages, options);

    const url = `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { 'x-goog-api-key': this.apiKey } : {}),
      ...(options.customHeaders || {}),
    };

    try {
      const response = await safeFetch(
        url,
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
        throw new Error(`HTTP ${response.status} from Google Gemini: ${errorText}`);
      }

      const data = (await response.json()) as Record<string, any>;
      const candidate = data.candidates?.[0] || {};
      const parts = candidate.content?.parts || [];

      let textContent = '';
      let reasoningContent: string | undefined;
      const toolCalls: ToolCall[] = [];

      for (const part of parts) {
        if (part.text) {
          textContent += part.text;
        }
        if (part.thought) {
          reasoningContent = (reasoningContent ? reasoningContent + '\n' : '') + part.thought;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `call_${Date.now()}_${toolCalls.length}`,
            type: 'function',
            function: {
              name: part.functionCall.name || '',
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          });
        }
      }

      const usage: TokenUsage = {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
        cacheReadTokens: data.usageMetadata?.cachedContentTokenCount || 0,
      };

      const costUsd = this.customCostEstimator
        ? this.customCostEstimator(model, {
            inputTokens: usage.promptTokens,
            outputTokens: usage.completionTokens,
            cacheReadTokens: usage.cacheReadTokens,
          })
        : DynamicCostEstimator.estimateCost(model, {
            inputTokens: usage.promptTokens,
            outputTokens: usage.completionTokens,
            cacheReadTokens: usage.cacheReadTokens,
          });

      return {
        content: textContent,
        reasoningContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: candidate.finishReason === 'STOP' ? 'stop' : candidate.finishReason?.toLowerCase() || 'stop',
        usage,
        model,
        provider: this.name,
        latencyMs: Date.now() - startTime,
        costUsd,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      throw new Error(`[Google Gemini] Request failed: ${err.message}`);
    }
  }

  public async *streamComplete(messages: ChatMessage[], options: CompletionOptions): AsyncIterable<StreamChunk> {
    const model = options.model || this.defaultModel;
    const body = this.buildRequestBody(messages, options);

    const url = `${this.baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { 'x-goog-api-key': this.apiKey } : {}),
      ...(options.customHeaders || {}),
    };

    const response = await safeFetch(
      url,
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
      throw new Error(`HTTP ${response.status} from Google Gemini stream: ${errorText}`);
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
            const data = JSON.parse(dataStr);
            const candidate = data.candidates?.[0];
            if (!candidate) continue;

            const parts = candidate.content?.parts || [];
            for (const part of parts) {
              if (part.text) {
                yield { deltaText: part.text };
              }
              if (part.thought) {
                yield { deltaText: '', deltaReasoning: part.thought };
              }
              if (part.functionCall) {
                yield {
                  deltaText: '',
                  toolCallDeltas: [
                    {
                      index: 0,
                      name: part.functionCall.name,
                      arguments: JSON.stringify(part.functionCall.args || {}),
                    },
                  ],
                };
              }
            }
          } catch {
            // Safe ignore of partial SSE JSON
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
        id: 'gemini-2.5-flash',
        provider: 'Google',
        displayName: 'Gemini 2.5 Flash',
        contextWindow: 1048576,
        maxOutputTokens: 65536,
        supportsTools: true,
        supportsVision: true,
        supportsReasoning: true,
      },
      {
        id: 'gemini-2.5-pro',
        provider: 'Google',
        displayName: 'Gemini 2.5 Pro',
        contextWindow: 2097152,
        maxOutputTokens: 65536,
        supportsTools: true,
        supportsVision: true,
        supportsReasoning: true,
      },
    ];
  }

  public async validateConfig(): Promise<{ valid: boolean; reason?: string }> {
    if (!this.apiKey) {
      return { valid: false, reason: 'GEMINI_API_KEY is not configured.' };
    }
    return { valid: true };
  }

  private buildRequestBody(messages: ChatMessage[], options: CompletionOptions): Record<string, unknown> {
    const contents: any[] = [];
    let systemInstruction: any = undefined;

    for (const m of messages) {
      if (m.role === 'system') {
        systemInstruction = {
          parts: [{ text: m.content }],
        };
      } else if (m.role === 'tool') {
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: m.name || 'tool',
                response: { output: m.content },
              },
            },
          ],
        });
      } else {
        const parts: any[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            let argsObj = {};
            try {
              argsObj = JSON.parse(tc.function.arguments || '{}');
            } catch {
              // fallback
            }
            parts.push({
              functionCall: {
                name: tc.function.name,
                args: argsObj,
              },
            });
          }
        }
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts,
        });
      }
    }

    const payload: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 8192,
      },
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    if (options.tools && options.tools.length > 0) {
      payload.tools = [
        {
          functionDeclarations: options.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    return payload;
  }
}
