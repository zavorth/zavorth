import type { ZavorthCapabilityOsRouteDecision } from '../services/ZavorthCapabilityOsService.js';
import { IntentRouterV2, type IntentRouterV2Options } from '../orchestrator/IntentRouterV2.js';

export type ExecutionGatewayV2FallbackPlan = {
  stage: '26';
  surface: 'execution-gateway-v2';
  generatedAt: string;
  input: string;
  selectedCapabilityId: string | null;
  primaryExecutor: string;
  failedExecutor: string | null;
  fallbackExecutor: string;
  fallbackChain: string[];
  preserves: {
    task: true;
    artifacts: string[];
  };
  reason: string;
  decision: ZavorthCapabilityOsRouteDecision;
};

type ExecutionGatewayV2Runtime = {
  now?: () => Date;
  intentRouter?: Pick<IntentRouterV2, 'route'>;
};

type ExecutionGatewayV2PreviewOptions = IntentRouterV2Options & {
  failedExecutor?: string | null;
};

export class ExecutionGatewayV2 {
  private readonly now: () => Date;
  private readonly intentRouter: Pick<IntentRouterV2, 'route'>;

  constructor(runtime: ExecutionGatewayV2Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.intentRouter = runtime.intentRouter || new IntentRouterV2();
  }

  public previewFallback(
    input: string,
    options: ExecutionGatewayV2PreviewOptions = {},
  ): ExecutionGatewayV2FallbackPlan {
    const decision = this.intentRouter.route(input, {
      ...options,
      sourceSurface: options.sourceSurface || 'execution-gateway-v2',
    });
    const primaryExecutor = decision.decision.executorPreference || decision.selected?.executorPreference || 'conversation';
    const fallbackChain = decision.fallbackChain.length > 0
      ? decision.fallbackChain
      : ['conversation'];
    const failedExecutor = options.failedExecutor || null;
    const fallbackExecutor = failedExecutor
      ? (fallbackChain.find((entry) => entry !== failedExecutor) || 'conversation')
      : fallbackChain[0];
    const artifacts = decision.selected?.artifacts.kinds?.length
      ? decision.selected.artifacts.kinds
      : ['report'];

    return {
      stage: '26',
      surface: 'execution-gateway-v2',
      generatedAt: this.now().toISOString(),
      input: String(input || '').trim(),
      selectedCapabilityId: decision.selected?.id || null,
      primaryExecutor,
      failedExecutor,
      fallbackExecutor,
      fallbackChain,
      preserves: {
        task: true,
        artifacts,
      },
      reason: failedExecutor ? `Executor ${failedExecutor} failed; keeping task and artifacts for fallback ${fallbackExecutor}.`
        : `Route ready; se ${primaryExecutor} falhar, use ${fallbackExecutor}.`,
      decision,
    };
  }
}

export type { ExecutionGatewayV2PreviewOptions };
