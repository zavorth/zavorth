import { ProviderRuntimeRouter } from './ProviderRuntimeRouter.js';
import { ProviderRuntimeClientFactory, ProviderInvocationResult } from './ProviderRuntimeClientFactory.js';
import { ProviderRuntimeRequest, ResolvedProviderRuntime } from './ModelSelectionService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';

export class ProviderInvocationService {
  private static instance: ProviderInvocationService;

  private constructor() {}

  public static getInstance(): ProviderInvocationService {
    if (!ProviderInvocationService.instance) {
      ProviderInvocationService.instance = new ProviderInvocationService();
    }
    return ProviderInvocationService.instance;
  }

  public async invoke(request: ProviderRuntimeRequest, messages: unknown[]): Promise<ProviderInvocationResult> {
    const startMs = Date.now();
    let resolved: ResolvedProviderRuntime | null = null;
    const logger = new SecurityAuditLogger();

    try {
      const router = ProviderRuntimeRouter.getInstance();
      resolved = await router.route(request);
      
      const factory = ProviderRuntimeClientFactory.getInstance();
      const invoker = await factory.createInvoker(resolved);

      await logger.logWorkspaceEvent('provider_invocation_started', `Started invocation on ${resolved.providerId}`, {
        providerId: resolved.providerId,
        providerType: resolved.providerType,
        modelId: resolved.modelId,
        capability: request.capability || 'chat'
      });
      
      const result = await invoker.invoke({ messages, stream: false });
      
      const durationMs = Date.now() - startMs;
      await logger.logWorkspaceEvent('provider_invocation_succeeded', `Invocation succeeded on ${resolved.providerId}`, {
        providerId: resolved.providerId,
        providerType: resolved.providerType,
        modelId: resolved.modelId,
        capability: request.capability || 'chat',
        durationMs
      });
      
      return result;
    } catch (error: any) {
      const durationMs = Date.now() - startMs;
      const errorCode = error.message;

      // Log failure safely without exposing headers or secrets
      await logger.logWorkspaceEvent('provider_invocation_failed', `Invocation failed with error: ${errorCode}`, {
        providerId: resolved?.providerId || request.providerId || 'unknown',
        providerType: resolved?.providerType || 'unknown',
        modelId: resolved?.modelId || request.modelId || 'unknown',
        capability: request.capability || 'chat',
        errorCode,
        durationMs,
        fallbackUsed: false
      });
      
      throw error;
    }
  }
}
