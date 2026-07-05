import { logger } from '../logger.js';
import { ProviderRuntimeRouter } from './ProviderRuntimeRouter.js';
import { ProviderRuntimeClientFactory, ProviderInvocationResult } from './ProviderRuntimeClientFactory.js';
import { ProviderRuntimeRequest, ResolvedProviderRuntime } from './ModelSelectionService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { ErrorNormalizationService } from './ErrorNormalizationService.js';

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
    const auditLogger = new SecurityAuditLogger();
    const wsId = request.workspaceId || 'system';

    if (wsId === 'system') {
      logger.info('[ProviderInvocationService] Warning: Fallback to system-level workspaceId. Diagnostic/global invocation.');
    }

    try {
      const router = ProviderRuntimeRouter.getInstance();
      resolved = await router.route(request);
      
      const factory = ProviderRuntimeClientFactory.getInstance();
      const invoker = await factory.createInvoker(resolved);

      await auditLogger.logWorkspaceEvent({
        event: 'provider_invocation_started',
        workspaceId: wsId,
        providerId: resolved.providerId,
        metadata: {
          providerType: resolved.providerType,
          modelId: resolved.modelId,
          capability: request.capability || 'chat'
        }
      });
      
      const result = await invoker.invoke({ messages, stream: false });
      
      const durationMs = Date.now() - startMs;
      await auditLogger.logWorkspaceEvent({
        event: 'provider_invocation_succeeded',
        workspaceId: wsId,
        providerId: resolved.providerId,
        durationMs,
        metadata: {
          providerType: resolved.providerType,
          modelId: resolved.modelId,
          capability: request.capability || 'chat'
        }
      });
      
      return result;
    } catch (error: unknown) {
      const durationMs = Date.now() - startMs;
      const normalized = ErrorNormalizationService.getInstance().normalize(error);
      const errorCode = normalized.code;

      await auditLogger.logWorkspaceEvent({
        event: 'provider_invocation_failed',
        workspaceId: wsId,
        providerId: resolved?.providerId || request.providerId || 'unknown',
        durationMs,
        metadata: {
          providerType: resolved?.providerType || 'unknown',
          modelId: resolved?.modelId || request.modelId || 'unknown',
          capability: request.capability || 'chat',
          errorCode,
          fallbackUsed: false
        }
      });
      
      throw new Error(normalized.message);
    }
  }
}
