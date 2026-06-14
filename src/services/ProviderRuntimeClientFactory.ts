import { ProviderSecretStore } from './ProviderSecretStore.js';
import { ResolvedProviderRuntime } from './ModelSelectionService.js';

export interface SanitizedProviderInvocationRequest {
  messages: unknown[];
  stream?: boolean;
}

export interface ProviderInvocationResult {
  text: string;
  finishReason?: string;
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
      const store = ProviderSecretStore.getInstance();
      rawKey = await store.getSecret(resolved.providerId);
    }

    // Return an opaque invoker that keeps the key safely in its closure
    return {
      invoke: async (request: SanitizedProviderInvocationRequest) => {
        try {
          return await this.executeSafeRequest(resolved, rawKey, request);
        } catch (error: any) {
          throw this.sanitizeError(error);
        }
      }
    };
  }

  private async executeSafeRequest(resolved: ResolvedProviderRuntime, apiKey: string | null, request: SanitizedProviderInvocationRequest): Promise<ProviderInvocationResult> {
    // Basic mock implementation for the framework structure
    // A real implementation would map `request.messages` to OpenAI/Anthropic spec and use node-fetch or native fetch
    
    if (resolved.providerType === 'openai-compatible' || resolved.providerType === 'openai') {
       if (!apiKey && resolved.providerType === 'openai') {
         throw new Error('missing_key'); // explicit openai needs key
       }
       // simulated fetch...
       if (apiKey === 'invalid_key') {
         // simulated API error
         const err = new Error('HTTP 401 Unauthorized');
         (err as any).status = 401;
         throw err;
       }
    }

    return {
      text: 'Mock response',
      finishReason: 'stop'
    };
  }

  private sanitizeError(error: any): Error {
    const message = error?.message || 'Unknown error';
    
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
