import { ModelSelectionService, ProviderRuntimeRequest, ResolvedProviderRuntime } from './ModelSelectionService.js';

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
   * Throws strictly normalized errors (e.g., 'missing_key', 'provider_not_found').
   */
  public async route(request: ProviderRuntimeRequest): Promise<ResolvedProviderRuntime> {
    const selector = ModelSelectionService.getInstance();
    const resolved = await selector.selectProvider(request);
    
    if (!resolved.runtimeReady) {
      throw new Error('missing_key');
    }

    return resolved;
  }
}
