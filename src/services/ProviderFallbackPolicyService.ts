import { ProviderInvocationService } from './ProviderInvocationService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { ProviderRuntimeRequest } from './ModelSelectionService.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { ProviderInvocationResult } from './ProviderRuntimeClientFactory.js';

export class ProviderFallbackPolicyService {
  private static instance: ProviderFallbackPolicyService;

  private constructor() {}

  public static getInstance(): ProviderFallbackPolicyService {
    if (!ProviderFallbackPolicyService.instance) {
      ProviderFallbackPolicyService.instance = new ProviderFallbackPolicyService();
    }
    return ProviderFallbackPolicyService.instance;
  }

  public async invokeWithFallback(request: ProviderRuntimeRequest, messages: unknown[]): Promise<ProviderInvocationResult> {
    const logger = new SecurityAuditLogger();
    
    try {
      return await ProviderInvocationService.getInstance().invoke(request, messages);
    } catch (originalError: any) {
      if (!request.allowFallback) {
        throw originalError;
      }

      // Check if the error is a definitive failure where fallback is unsafe/useless
      // Rule: fallback nunca pula missing_key para remoto sem key
      if (originalError.message === 'missing_key') {
        throw originalError;
      }

      // Find another provider
      const configSvc = ProviderConfigService.getInstance();
      const allProviders = await configSvc.getProviders();
      // Use only enabled and configured (has key if required) providers as fallbacks
      const fallbackCandidates = allProviders.filter(p => 
        p.enabled && 
        p.providerId !== request.providerId && 
        (p.requiresApiKey ? !!p.secretRef : true)
      );
      
      for (const p of fallbackCandidates) {
        try {
          await logger.logWorkspaceEvent({
            event: 'provider_runtime_fallback_attempted' as any,
            workspaceId: 'system',
            metadata: {
              fallbackTo: p.providerId,
              fallbackToType: p.type
            }
          });
          
          const fallbackRequest: ProviderRuntimeRequest = {
            ...request,
            providerId: p.providerId, // force to new provider
            modelId: undefined // let model selection pick default
          };
          
          const result = await ProviderInvocationService.getInstance().invoke(fallbackRequest, messages);
          
          await logger.logWorkspaceEvent({
            event: 'provider_runtime_fallback_succeeded' as any,
            workspaceId: 'system',
            metadata: {
              fallbackUsed: p.providerId 
            }
          });
          
          return result;
        } catch (fallbackError: any) {
          await logger.logWorkspaceEvent({
            event: 'provider_runtime_fallback_failed' as any,
            workspaceId: 'system',
            metadata: {
              fallbackFailedOn: p.providerId,
              errorCode: fallbackError.message
            }
          });
          continue;
        }
      }

      // Throw original error if all fallbacks fail or if there are no candidates
      throw originalError;
    }
  }
}
