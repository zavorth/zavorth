/**
 * Ollama Local-First Wire Adapter for Zavorth.
 * Communicates directly with the local Ollama daemon via native fetch.
 */

import {
  LLMAdapter,
  AdapterCapabilities,
  Message,
  CompleteOptions,
  Completion,
  StreamChunk,
  ModelInfo,
  ValidationResult,
} from '../LLMAdapter.js';

export interface OllamaAdapterConfig {
  baseUrl?: string;
  defaultModel?: string;
}

export class OllamaAdapter implements LLMAdapter {
  public readonly name: string = 'ollama';
  public readonly capabilities: AdapterCapabilities = {
    streaming: true,
    toolCalling: true,
    vision: true,
    reasoning: true,
    jsonMode: true,
  };

  private baseUrl: string = 'http://127.0.0.1:11434';
  private defaultModel: string = 'llama3.3:latest';

  constructor(config: OllamaAdapterConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    this.defaultModel = config.defaultModel || 'llama3.3:latest';
  }

  public async complete(messages: Message[], options: CompleteOptions = {}): Promise<Completion> {
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/api/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
        },
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as any;
    return {
      id: `ollama_${Date.now()}`,
      model: json.model || model,
      content: json.message?.content || '',
      finishReason: json.done ? 'stop' : 'length',
      usage: json.prompt_eval_count ? {
        promptTokens: json.prompt_eval_count,
        completionTokens: json.eval_count,
        totalTokens: json.prompt_eval_count + json.eval_count,
      } : undefined,
    };
  }

  public async *streamComplete(messages: Message[], options: CompleteOptions = {}): AsyncIterable<StreamChunk> {
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/api/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      }),
      signal: options.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama stream error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            yield {
              delta: parsed.message?.content || '',
              finishReason: parsed.done ? 'stop' : undefined,
            };
          } catch {
            // Ignore malformed partial chunks
          }
        }
      }
    }
  }

  public async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      return (data.models || []).map((m: any) => ({
        id: m.name,
        name: m.name,
        supportsStreaming: true,
        supportsTools: true,
      }));
    } catch {
      return [
        { id: 'llama3.3:latest', name: 'Llama 3.3 70B', supportsStreaming: true, supportsTools: true },
        { id: 'qwen2.5-coder:latest', name: 'Qwen 2.5 Coder', supportsStreaming: true, supportsTools: true },
        { id: 'deepseek-r1:latest', name: 'DeepSeek R1', supportsStreaming: true, supportsTools: false },
      ];
    }
  }

  public async validateConfig(): Promise<ValidationResult> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (res.ok) {
        return { valid: true, latencyMs: Date.now() - start };
      }
      return { valid: false, error: `HTTP ${res.status}`, latencyMs: Date.now() - start };
    } catch (e: any) {
      return { valid: false, error: e.message, latencyMs: Date.now() - start };
    }
  }

  public async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config?.baseUrl) {
      this.baseUrl = config.baseUrl as string;
    }
  }

  public async shutdown(): Promise<void> {
    // Zero persistent connections
  }
}
