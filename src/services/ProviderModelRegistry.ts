export type ProviderCapability = 'chat' | 'tool_calling' | 'vision' | 'audio' | 'json' | 'reasoning' | 'embedding';

export interface ProviderModelCapability {
  providerType: string;
  modelId: string;
  supportsChat: boolean;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
  supportsEmbeddings: boolean;
  contextWindow?: number;
}

export class ProviderModelRegistry {
  /**
   * Returns a conservative capability profile for a given provider type and model.
   * If the model or capability is unknown, it defaults to `false` (unsupported).
   */
  public static getCapabilities(providerType: string, modelId?: string): ProviderModelCapability {
    const defaultCaps: ProviderModelCapability = {
      providerType,
      modelId: modelId || 'unknown',
      supportsChat: false,
      supportsToolCalling: false,
      supportsVision: false,
      supportsJsonMode: false,
      supportsStreaming: false,
      supportsEmbeddings: false,
    };

    // Very conservative static registry for basic types
    if (providerType === 'openai') {
      defaultCaps.supportsChat = true;
      defaultCaps.supportsStreaming = true;
      
      if (modelId) {
        if (modelId.includes('gpt-4') || modelId.includes('gpt-3.5')) {
          defaultCaps.supportsToolCalling = true;
          defaultCaps.supportsJsonMode = true;
        }
        if (modelId.includes('vision') || modelId === 'gpt-4o' || modelId === 'gpt-4o-mini') {
          defaultCaps.supportsVision = true;
        }
        if (modelId.includes('embedding')) {
          defaultCaps.supportsEmbeddings = true;
          defaultCaps.supportsChat = false;
        }
      } else {
        // Assume basic chat if no model specified
        defaultCaps.supportsToolCalling = true;
      }
    } else if (providerType === 'anthropic') {
      defaultCaps.supportsChat = true;
      defaultCaps.supportsStreaming = true;
      
      if (modelId && modelId.includes('claude-3')) {
        defaultCaps.supportsToolCalling = true;
        defaultCaps.supportsVision = true;
      }
    } else if (providerType === 'google') {
      defaultCaps.supportsChat = true;
      defaultCaps.supportsStreaming = true;
      
      if (modelId && modelId.includes('gemini-1.5')) {
        defaultCaps.supportsToolCalling = true;
        defaultCaps.supportsVision = true;
        defaultCaps.supportsJsonMode = true;
      }
    } else if (providerType === 'openrouter') {
      // OpenRouter supports basically everything but depends on the underlying model.
      // We assume basic capabilities.
      defaultCaps.supportsChat = true;
      defaultCaps.supportsStreaming = true;
      defaultCaps.supportsToolCalling = true; // OpenRouter passes through
    } else if (providerType === 'ollama') {
      defaultCaps.supportsChat = true;
      defaultCaps.supportsStreaming = true;
      // Ollama tool calling depends heavily on the model (e.g. llama3.1), we default to false to be conservative unless we know
      if (modelId && (modelId.includes('llama3.1') || modelId.includes('llama3.2') || modelId.includes('qwen2.5'))) {
        defaultCaps.supportsToolCalling = true;
      }
    } else if (providerType === 'openai-compatible') {
      // Conservative generic fallback
      defaultCaps.supportsChat = true;
      defaultCaps.supportsStreaming = true;
    }

    return defaultCaps;
  }

  public static hasCapability(capabilities: ProviderModelCapability, capability: ProviderCapability): boolean {
    switch (capability) {
      case 'chat': return capabilities.supportsChat;
      case 'tool_calling': return capabilities.supportsToolCalling;
      case 'vision': return capabilities.supportsVision;
      case 'audio': return false; // Not implemented yet
      case 'json': return capabilities.supportsJsonMode;
      case 'reasoning': return false; // Custom logic needed if we add deepseek-reasoner
      case 'embedding': return capabilities.supportsEmbeddings;
      default: return false; // Conservative
    }
  }
}
