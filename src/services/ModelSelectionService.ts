import { ProviderConfig, ProviderConfigService } from './ProviderConfigService.js';
import { ProviderCapability, ProviderModelRegistry } from './ProviderModelRegistry.js';
import type { ResilientRoutePolicy } from './ResilientRoutePolicyService.js';
import { logger } from '../logger.js';

export interface ProviderRuntimeRequest {
  providerId?: string;
  modelId?: string;
  capability?: ProviderCapability;
  allowFallback?: boolean;
  workspaceId?: string;
  resiliencePolicy?: ResilientRoutePolicy;
}

export interface ResolvedProviderRuntime {
  providerId: string;
  providerType: string;
  displayName: string;
  modelId: string;
  baseUrl?: string;
  capabilities: ProviderCapability[];
  configured: boolean;
  runtimeReady: boolean;
}

export class ModelSelectionService {
  private static instance: ModelSelectionService;

  private constructor() {}

  public static getInstance(): ModelSelectionService {
    if (!ModelSelectionService.instance) {
      ModelSelectionService.instance = new ModelSelectionService();
    }
    return ModelSelectionService.instance;
  }

  /**
   * Evaluates all providers to find the best match for the request.
   * If a providerId is specified, it strictly uses it (or fails).
   */
  public async selectProvider(request: ProviderRuntimeRequest): Promise<ResolvedProviderRuntime> {
    const configService = ProviderConfigService.getInstance();
    const allProviders = await configService.getProviders();

    if (request.providerId) {
      const provider = allProviders.find(p => p.providerId === request.providerId);
      if (!provider) {
        throw new Error('provider_not_found');
      }
      return this.evaluateProvider(provider, request.modelId, request.capability);
    }

    // Try to find a default provider that meets the capability
    const enabledProviders = allProviders.filter(p => p.enabled);
    if (enabledProviders.length === 0) {
      throw new Error('no_providers_enabled');
    }

    // Heuristic: pick the first one that is configured and supports the capability
    for (const provider of enabledProviders) {
      try {
        const resolved = this.evaluateProvider(provider, request.modelId, request.capability);
        if (resolved.runtimeReady) {
          return resolved;
        }
      } catch (error: any) {
      // Ignore capability mismatches when searching for a default
      logger.warn('[Model Selection] operation failed', error);
    }
    }

    throw new Error('no_suitable_provider_found');
  }

  /**
   * Evaluates a specific provider against constraints.
   */
  private evaluateProvider(provider: ProviderConfig, requestedModelId?: string, requiredCapability?: ProviderCapability): ResolvedProviderRuntime {
    if (!provider.enabled) {
      throw new Error('provider_disabled');
    }

    const modelId = requestedModelId || provider.defaultModel || 'default';
    const caps = ProviderModelRegistry.getCapabilities(provider.type, modelId);

    if (requiredCapability && !ProviderModelRegistry.hasCapability(caps, requiredCapability)) {
      throw new Error('capability_not_supported');
    }

    // Check if runtime is ready
    let configured = true;
    let runtimeReady = true;

    // missing_key checks
    if (provider.requiresApiKey && !provider.secretRef) {
      configured = false;
      runtimeReady = false;
      // Note: we don't throw here immediately so that UI can see it's "missing_key", 
      // but in runtime Router it might throw missing_key.
    }

    // Local / No-Auth can work without key.
    if (!provider.requiresApiKey && provider.type === 'openai-compatible') {
       // local openai compatible
       configured = true;
       runtimeReady = true;
    }

    if (provider.type === 'ollama') {
       configured = true;
       runtimeReady = true;
    }

    // Build standard capabilities list
    const supportedCaps: ProviderCapability[] = [];
    if (caps.supportsChat) supportedCaps.push('chat');
    if (caps.supportsToolCalling) supportedCaps.push('tool_calling');
    if (caps.supportsVision) supportedCaps.push('vision');
    if (caps.supportsJsonMode) supportedCaps.push('json');
    if (caps.supportsEmbeddings) supportedCaps.push('embedding');

    return {
      providerId: provider.providerId,
      providerType: provider.type,
      displayName: provider.displayName,
      modelId,
      baseUrl: provider.baseUrl,
      capabilities: supportedCaps,
      configured,
      runtimeReady
    };
  }
}
