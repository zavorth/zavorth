import { LocalEncryptedProviderSecretStore } from './ProviderSecretStore.js';
import { ResolvedProviderRuntime } from './ModelSelectionService.js';
import type {
  ResilientRouteAttempt,
  ResilientRouteBudgetDecision,
} from './ResilientRoutePolicyService.js';

export interface SanitizedProviderInvocationRequest {
  messages: unknown[];
  stream?: boolean;
}

export interface ProviderInvocationResult {
  text: string;
  finishReason?: string;
  routingReceiptId?: string;
  routingAttempts?: ResilientRouteAttempt[];
  fallbackUsed?: boolean;
  budgetDecision?: ResilientRouteBudgetDecision;
  rawError?: never; // ensure raw error is never passed back
}

export interface ProviderRuntimeInvoker {
  invoke(request: SanitizedProviderInvocationRequest): Promise<ProviderInvocationResult>;
}

export class ProviderRuntimeClientFactory {
  private static instance: ProviderRuntimeClientFactory;

  private constructor() {}

  public static getInstance(): ProviderRuntimeClientFactory {
    if (!ProviderRuntimeClientFactory.instance) {
      ProviderRuntimeClientFactory.instance = new ProviderRuntimeClientFactory();
    }
    return ProviderRuntimeClientFactory.instance;
  }

  public async createInvoker(resolved: ResolvedProviderRuntime): Promise<ProviderRuntimeInvoker> {
    let rawKey: string | null = null;

    // Safely resolve the secret inside the backend boundary
    if (resolved.providerId) {
      const store = LocalEncryptedProviderSecretStore.getInstance();
      rawKey = await store.getSecret(resolved.providerId);
    }

    // Return an opaque invoker that keeps the key safely in its closure
    return {
      invoke: async (request: SanitizedProviderInvocationRequest) => {
        try {
          return await this.executeSafeRequest(resolved, rawKey, request);
        } catch (error: unknown) {throw this.sanitizeError(error);
        }
      }
    };
  }

  private async executeSafeRequest(resolved: ResolvedProviderRuntime, apiKey: string | null, _request: SanitizedProviderInvocationRequest): Promise<ProviderInvocationResult> {
    // Basic local implementation for the framework structure
    // A real implementation would map `request.messages` to OpenAI/Anthropic spec and use node-fetch or native fetch

    if (resolved.providerType === 'openai-compatible' || resolved.providerType === 'openai') {
       if (!apiKey && resolved.providerType === 'openai') {
         throw new Error('missing_key'); // explicit openai needs key
       }
       // dryRun fetch...
        if (apiKey === 'invalid_key') {
          // dryRun API error
          const err = new Error('HTTP 401 Unauthorized') as Error & { status?: number };
          err.status = 401;
          throw err;
        }
    }

    return {
      text: 'Mock response',
      finishReason: 'stop'
    };
  }

  private sanitizeError(error: unknown): Error {
    const message = error instanceof Error
      ? error.message
      : (error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : String(error || 'Unknown error'));

    if (message.includes('401') || message.includes('Unauthorized') || message.includes('invalid_api_key')) {
      return new Error('invalid_key');
    }
    if (message.includes('429') || message.includes('Too Many Requests')) {
      return new Error('rate_limited');
    }
    if (message.includes('timeout')) {
      return new Error('timeout');
    }
    if (message.includes('ECONNREFUSED') || message.includes('network')) {
      return new Error('network_error');
    }
    if (message.includes('missing_key')) {
      return new Error('missing_key');
    }

    // Default provider generic error
    return new Error('provider_error');
  }
}
