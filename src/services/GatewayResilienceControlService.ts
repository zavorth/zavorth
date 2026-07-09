import {
  ProviderConfig,
  ProviderConfigService,
} from './ProviderConfigService.js';
import { ProviderFallbackPolicyService } from './ProviderFallbackPolicyService.js';

import {
  ResilientRouteAttempt,
  ResilientRouteBudgetEvaluation,
  ResilientRoutePolicy,
  ResilientRoutePolicyService,
} from './ResilientRoutePolicyService.js';

export const GATEWAY_RESILIENCE_CONTROL_CONTRACT_VERSION = '2026-06-16.gateway-resilience-control.v1';

type ProviderConfigLike = Pick<ProviderConfigService, 'getProviders'>;
type FallbackPolicyLike = Pick<ProviderFallbackPolicyService, 'invokeWithFallback'>;

export type GatewayResilienceReceipt = {
  receiptId: string;
  generatedAt: string;
  fallbackUsed: boolean;
  budgetDecision: string;
  attempts: ResilientRouteAttempt[];
};

export type GatewayResilienceSnapshot = {
  ok: true;
  contractVersion: typeof GATEWAY_RESILIENCE_CONTROL_CONTRACT_VERSION;
  generatedAt: string;
  policy: ResilientRoutePolicy;
  providers: Array<{
    providerId: string;
    type: ProviderConfig['type'];
    displayName: string;
    enabled: boolean;
    configured: boolean;
    defaultModel: string | null;
    secretRef: '[redacted]' | null;
  }>;
  budget: ResilientRouteBudgetEvaluation;
  receipts: GatewayResilienceReceipt[];
  health: {
    status: 'ready' | 'needs_provider';
    configuredProviders: number;
    lastFallbackUsed: boolean;
  };
};

export type GatewayResilienceActionInput = {
  action?: unknown;
  policy?: Partial<ResilientRoutePolicy>;
  workspaceId?: unknown;
};

export type GatewayResilienceActionResult = {
  ok: true;
  status: 'saved' | 'reset' | 'tested';
  resilience: GatewayResilienceSnapshot;
  receipt?: GatewayResilienceReceipt;
};

const policyService = new ResilientRoutePolicyService();
let activePolicy = policyService.normalizePolicy();
let receipts: GatewayResilienceReceipt[] = [];

export class GatewayResilienceControlService {
  private readonly providerConfig: ProviderConfigLike;
  private readonly fallbackPolicy: FallbackPolicyLike;
  private readonly now: () => Date;

  constructor(runtime: {
    providerConfig?: ProviderConfigLike;
    fallbackPolicy?: FallbackPolicyLike;
    now?: () => Date;
  } = {}) {
    this.providerConfig = runtime.providerConfig || ProviderConfigService.getInstance();
    this.fallbackPolicy = runtime.fallbackPolicy || ProviderFallbackPolicyService.getInstance();
    this.now = runtime.now || (() => new Date());
  }

  public async buildSnapshot(): Promise<GatewayResilienceSnapshot> {
    const providers = await this.providerConfig.getProviders();
    const redactedProviders = providers.map(redactProvider);
    const configuredProviders = redactedProviders.filter((provider) => provider.enabled && provider.configured).length;
    const lastReceipt = receipts[0] || null;

    return {
      ok: true,
      contractVersion: GATEWAY_RESILIENCE_CONTROL_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      policy: { ...activePolicy, fallbackOrder: activePolicy.fallbackOrder.map((target) => ({ ...target })) },
      providers: redactedProviders,
      budget: policyService.evaluateBudget(activePolicy),
      receipts: receipts.map(copyReceipt),
      health: {
        status: configuredProviders > 0 ? 'ready' : 'needs_provider',
        configuredProviders,
        lastFallbackUsed: lastReceipt?.fallbackUsed === true,
      },
    };
  }

  public async applyAction(input: GatewayResilienceActionInput): Promise<GatewayResilienceActionResult> {
    const action = String(input.action || '').trim();

    if (action === 'savePolicy') {
      activePolicy = policyService.normalizePolicy(input.policy || {});
      return {
        ok: true,
        status: 'saved',
        resilience: await this.buildSnapshot(),
      };
    }

    if (action === 'resetPolicy') {
      activePolicy = policyService.normalizePolicy();
      receipts = [];
      return {
        ok: true,
        status: 'reset',
        resilience: await this.buildSnapshot(),
      };
    }

    if (action === 'testRoute') {
      const testPolicy = policyService.normalizePolicy(input.policy || activePolicy);
      const workspaceId = clean(input.workspaceId) || 'system';
      const request = policyService.applyPrimaryTarget({
        allowFallback: true,
        workspaceId,
        resiliencePolicy: testPolicy,
      }, testPolicy);
      const result = await this.fallbackPolicy.invokeWithFallback(request, [
        { role: 'user', content: 'Zavorth resilience route test. Reply with ok.' },
      ]);
      const receipt: GatewayResilienceReceipt = {
        receiptId: result.routingReceiptId || policyService.buildReceiptId(workspaceId, this.now()),
        generatedAt: this.now().toISOString(),
        fallbackUsed: result.fallbackUsed === true,
        budgetDecision: result.budgetDecision || 'allowed',
        attempts: (result.routingAttempts || []).map((attempt: any) => ({ ...attempt })),
      };
      receipts = [receipt, ...receipts].slice(0, 20);
      return {
        ok: true,
        status: 'tested',
        receipt,
        resilience: await this.buildSnapshot(),
      };
    }

    throw new Error('unsupported_resilience_action');
  }
}

function redactProvider(provider: ProviderConfig): GatewayResilienceSnapshot['providers'][number] {
  return {
    providerId: provider.providerId,
    type: provider.type,
    displayName: provider.displayName,
    enabled: provider.enabled,
    configured: provider.requiresApiKey ? Boolean(provider.secretRef) : true,
    defaultModel: provider.defaultModel || null,
    secretRef: provider.secretRef ? '[redacted]' : null,
  };
}

function copyReceipt(receipt: GatewayResilienceReceipt): GatewayResilienceReceipt {
  return {
    ...receipt,
    attempts: receipt.attempts.map((attempt) => ({ ...attempt })),
  };
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
