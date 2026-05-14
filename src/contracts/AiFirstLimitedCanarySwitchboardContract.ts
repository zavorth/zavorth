import type {
  AiFirstRoutePlanIntent,
  AiFirstRoutePlanRisk,
} from './AiFirstRoutePlanContract.js';
import type {
  AiFirstPromotionAllowlistStatus,
  AiFirstPromotionRegistryReadiness,
} from './AiFirstPromotionCandidateRegistryContract.js';

export const AI_FIRST_LIMITED_CANARY_SWITCHBOARD_CONTRACT_VERSION = '2026-05-06.phase-6' as const;

export type AiFirstLimitedCanaryRouteStatus =
  | 'canary-enabled'
  | 'manual-activation-required'
  | 'withheld'
  | 'disabled';

export type AiFirstLimitedCanaryDecisionStatus =
  | 'select-ai-first-canary'
  | 'fallback-current-runtime';

export type AiFirstLimitedCanaryFallbackReason =
  | 'route-not-enabled'
  | 'surface-not-enabled'
  | 'risk-not-allowed'
  | 'phase3-guardrail-missing'
  | 'registry-receipt-missing'
  | 'allowlist-withheld'
  | 'manual-activation-missing'
  | 'manual-activation-disabled';

export type AiFirstLimitedCanaryActivation = {
  activationId: string;
  routeKey: string | null;
  familyId: AiFirstRoutePlanIntent | null;
  surfaces: string[];
  enabled: boolean;
  approvedBy: string | null;
  reason: string;
};

export type AiFirstLimitedCanaryRouteProbe = {
  requestId: string;
  familyId: AiFirstRoutePlanIntent;
  surface: string;
  risk: AiFirstRoutePlanRisk;
  phase3GuardrailPassed: boolean;
  registryReceiptPresent: boolean;
};

export type AiFirstLimitedCanaryRouteEntry = {
  id: string;
  routeKey: string;
  familyId: AiFirstRoutePlanIntent;
  status: AiFirstLimitedCanaryRouteStatus;
  sourceAllowlistStatus: AiFirstPromotionAllowlistStatus;
  configuredSurfaces: string[];
  enabledSurfaces: string[];
  allowedRiskLevels: AiFirstRoutePlanRisk[];
  maxRisk: AiFirstRoutePlanRisk;
  activationId: string | null;
  fallbackRoute: 'current-runtime';
  requiresPhase3Guardrail: true;
  requiresRegistryReceipt: true;
  requiresManualActivation: true;
  defaultEnabled: false;
  canExecuteNow: false;
  reason: string;
};

export type AiFirstLimitedCanaryRouteDecision = {
  id: string;
  requestId: string;
  familyId: AiFirstRoutePlanIntent;
  surface: string;
  risk: AiFirstRoutePlanRisk;
  decision: AiFirstLimitedCanaryDecisionStatus;
  matchedRouteKey: string | null;
  fallbackReason: AiFirstLimitedCanaryFallbackReason | null;
  fallbackRoute: 'current-runtime';
  phase3GuardrailRequired: true;
  registryReceiptRequired: true;
  fallbackAvailable: true;
  defaultRuntimeChanged: false;
  canExecuteNow: false;
  reason: string;
};

export type AiFirstLimitedCanarySwitchboardSnapshot = {
  contractVersion: typeof AI_FIRST_LIMITED_CANARY_SWITCHBOARD_CONTRACT_VERSION;
  source: 'ai-first-limited-canary-switchboard';
  generatedAt: string;
  switchboardId: string;
  input: {
    switchboardName: string;
    registryId: string;
    registryReadiness: AiFirstPromotionRegistryReadiness;
    activationCount: number;
    probeCount: number;
  };
  activations: AiFirstLimitedCanaryActivation[];
  routes: AiFirstLimitedCanaryRouteEntry[];
  decisions: AiFirstLimitedCanaryRouteDecision[];
  summary: {
    totalRoutes: number;
    canaryEnabledRoutes: number;
    manualActivationRequiredRoutes: number;
    withheldRoutes: number;
    disabledRoutes: number;
    aiFirstCanarySelections: number;
    fallbackSelections: number;
  };
  recommendation: {
    readiness:
      | 'canary-ready'
      | 'manual-activation-needed'
      | 'no-eligible-routes';
    action:
      | 'run-limited-canary'
      | 'request-manual-activation'
      | 'continue-registry';
    reason: string;
    defaultRuntimeChanged: false;
    keepCurrentRuntimeDecision: true;
    fallbackInstantlyAvailable: true;
    activateAutomatically: false;
    canExecuteNow: false;
  };
  receipts: Array<{
    id: string;
    kind: 'switchboard' | 'activation' | 'decision' | 'fallback' | 'no-runtime-change';
    detail: string;
  }>;
  gates: Array<{
    id: string;
    status: 'passed';
    detail: string;
  }>;
};
