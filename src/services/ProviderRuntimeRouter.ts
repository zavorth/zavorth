import { ModelSelectionService, ProviderRuntimeRequest, ResolvedProviderRuntime } from './ModelSelectionService.js';
import { AgentWorkspaceConfigService } from './AgentWorkspaceConfigService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';
import { asErrorLike } from '../utils/errorLike.js';

export class ProviderRuntimeRouter {
  private static instance: ProviderRuntimeRouter;

  private constructor() {}

  public static getInstance(): ProviderRuntimeRouter {
    if (!ProviderRuntimeRouter.instance) {
      ProviderRuntimeRouter.instance = new ProviderRuntimeRouter();
    }
    return ProviderRuntimeRouter.instance;
  }

  /**
   * Routes a request to an appropriate provider runtime.
   * Enforces that the returned runtime is fully ready (e.g. has keys if required).
   * Respects workspace configuration bounds (e.g., fallback allowed, capability allowed).
   * Throws strictly normalized errors (e.g., 'missing_key', 'provider_not_found').
   */
  public async route(request: ProviderRuntimeRequest): Promise<ResolvedProviderRuntime> {
    const configService = AgentWorkspaceConfigService.getInstance();
    const workspaceId = request.workspaceId || 'global';
    const config = await configService.getConfig(workspaceId);

    // Provide defaults from config if not explicitly requested
    const effectiveRequest = {
      ...request,
      providerId: request.providerId || config.defaultProviderId,
      modelId: request.modelId || config.defaultModelId,
      allowFallback: request.allowFallback !== undefined ?         (request.allowFallback && config.allowProviderFallback) :
        config.allowProviderFallback
    };

    const selector = ModelSelectionService.getInstance();

    let resolved: ResolvedProviderRuntime;
    try {
      resolved = await selector.selectProvider(effectiveRequest);
    } catch (error: unknown) { const err = asErrorLike(error); if (err.message === 'missing_key' || err.message === 'provider_not_found' || err.message === 'capability_not_supported') {
        throw error;
      }
      throw new Error('routing_error');
    }

    if (!resolved.runtimeReady) {
      throw new Error('missing_key');
    }

    // Capability check against workspace policy
    if (request.capability) {
      if (!config.allowedCapabilities.includes(request.capability)) {
        throw new Error('capability_not_supported');
      }
    }

    // Ensure we audit if fallback was used
    if (resolved.providerId !== effectiveRequest.providerId) {
      const auditLogger = new SecurityAuditLogger(new LogRepository());
      await auditLogger.logWorkspaceEvent({
        event: 'provider_runtime_fallback_succeeded',
        workspaceId,
        providerId: resolved.providerId,
        reason: `Fallback activated for model ${resolved.modelId}`,
      });
    }

    return resolved;
  }
}
