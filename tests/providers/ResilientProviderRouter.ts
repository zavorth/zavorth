import type { ILlmProvider, ChatMessage, ToolDefinition, LlmResponse, ProviderChatOptions } from '../../src/providers/ILlmProvider.js';

type ResilientTarget = {
  providerName: string;
  apiKey?: string | null;
  [key: string]: unknown;
};

const RETRYABLE_STATUS_CODES = new Set([429, 503, 502, 500]);

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const status = (error as any).status ?? (error as any).statusCode;
  if (typeof status === 'number' && RETRYABLE_STATUS_CODES.has(status)) return true;
  const message = String((error as any).message ?? '');
  if (/rate.?limit|too many requests|503|502|500|unavailable/i.test(message)) return true;
  return false;
}

export class ResilientProviderRouter {
  private readonly name: string;
  private readonly targets: ResilientTarget[];
  private readonly buildProvider: (target: ResilientTarget) => ILlmProvider;

  constructor(
    name: string,
    targets: ResilientTarget[],
    buildProvider: (target: ResilientTarget) => ILlmProvider,
  ) {
    this.name = name;
    this.targets = targets;
    this.buildProvider = buildProvider;
  }

  public async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): Promise<LlmResponse> {
    let lastError: unknown;
    for (const target of this.targets) {
      try {
        const provider = this.buildProvider(target);
        return await provider.chat(messages, tools, options);
      } catch (error: unknown) {
        lastError = error;
        if (!isRetryableError(error)) {
          throw error;
        }
      }
    }
    throw lastError;
  }
}
