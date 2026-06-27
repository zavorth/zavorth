import { LlmRuntimeService, type LlmRunOptions } from './llm/LlmRuntimeService.js';
import type { ChatMessage, LlmResponse } from '../providers/ILlmProvider.js';

export type ZavorthLlmCallOptions = {
  providerName?: string;
  modelName?: string;
  allowFallback?: boolean;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
};

export type ZavorthLlmSynthesisResult = {
  content: string;
  providerName: string;
  modelName: string | null;
  inputTokens: number;
  outputTokens: number;
};

type LlmUsageMetadata = {
  inputTokens?: unknown;
  outputTokens?: unknown;
};

export class ZavorthLlmRuntimeService {
  private readonly runtime: LlmRuntimeService;

  constructor(preferredProviderName?: string) {
    this.runtime = new LlmRuntimeService(preferredProviderName);
  }

  async synthesize(
    systemPrompt: string,
    userContent: string,
    options?: ZavorthLlmCallOptions,
  ): Promise<ZavorthLlmSynthesisResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];

    const runOptions: LlmRunOptions = {
      ...(options?.providerName ? { providerName: options.providerName } : {}),
      ...(options?.modelName ? { modelName: options.modelName } : {}),
      ...(options?.allowFallback !== undefined ? { allowFallback: options.allowFallback } : {}),
    };

    const response: LlmResponse = await this.runtime.chat(messages, undefined, runOptions);

    return {
      content: response.content || '',
      providerName: runOptions.providerName || this.runtime.getPreferredProviderName(),
      modelName: runOptions.modelName || null,
      ...this.readUsage(response),
    };
  }

  async multiPassReasoning(
    turns: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: ZavorthLlmCallOptions,
  ): Promise<ZavorthLlmSynthesisResult> {
    const messages: ChatMessage[] = turns.map((t) => ({
      role: t.role as 'system' | 'user' | 'assistant',
      content: t.content,
    }));

    const runOptions: LlmRunOptions = {
      ...(options?.providerName ? { providerName: options.providerName } : {}),
      ...(options?.modelName ? { modelName: options.modelName } : {}),
      ...(options?.allowFallback !== undefined ? { allowFallback: options.allowFallback } : {}),
    };

    const response: LlmResponse = await this.runtime.chat(messages, undefined, runOptions);

    return {
      content: response.content || '',
      providerName: runOptions.providerName || this.runtime.getPreferredProviderName(),
      modelName: runOptions.modelName || null,
      ...this.readUsage(response),
    };
  }

  getPreferredProviderName(): string {
    return this.runtime.getPreferredProviderName();
  }

  isProviderAvailable(name: string): boolean {
    return this.runtime.isProviderAvailable(name);
  }

  private readUsage(response: LlmResponse): Pick<ZavorthLlmSynthesisResult, 'inputTokens' | 'outputTokens'> {
    const usage = response.metadata?.usage as LlmUsageMetadata | undefined;
    return {
      inputTokens: typeof usage?.inputTokens === 'number' ? usage.inputTokens : 0,
      outputTokens: typeof usage?.outputTokens === 'number' ? usage.outputTokens : 0,
    };
  }
}
