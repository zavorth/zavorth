import type {
  AiFirstRouteNextSafeAction,
  AiFirstRoutePlanIntent,
  AiFirstRoutePlanRisk,
} from './AiFirstRoutePlanContract.js';

export const AI_FIRST_SHADOW_ROUTER_CONTRACT_VERSION = '2026-05-06.gate-2' as const;

export type AiFirstShadowLegacySource =
  | 'zavorth-response-decision'
  | 'legacy-intent-router'
  | 'manual-fixture'
  | 'none';

export type AiFirstShadowRouteFamily =
  | 'conversation'
  | 'inspection'
  | 'mutation'
  | 'command'
  | 'research'
  | 'configuration'
  | 'automation'
  | 'unknown';

export type AiFirstShadowDivergenceKind =
  | 'ai-plan-quality'
  | 'intent-family'
  | 'execution-posture'
  | 'risk'
  | 'policy'
  | 'tools'
  | 'next-action';

export type AiFirstShadowDivergenceSeverity = 'info' | 'low' | 'medium' | 'high';

export type AiFirstShadowLegacyRouteSummary = {
  source: AiFirstShadowLegacySource;
  mode: string;
  responsePath: string;
  shouldExecute: boolean;
  requestedTools: string[];
  routeFamily: AiFirstShadowRouteFamily;
  risk: AiFirstRoutePlanRisk;
  nextSafeAction: AiFirstRouteNextSafeAction;
  confidence: string;
  reason: string;
};

export type AiFirstShadowAiRouteSummary = {
  accepted: boolean;
  intent: AiFirstRoutePlanIntent;
  routeFamily: AiFirstShadowRouteFamily;
  risk: AiFirstRoutePlanRisk;
  nextSafeAction: AiFirstRouteNextSafeAction;
  requestedTools: string[];
  requiresApproval: boolean;
  requiresPreview: boolean;
  canExecuteNow: false;
  diagnostics: {
    warnings: string[];
    errors: string[];
  };
};

export type AiFirstShadowDivergence = {
  id: string;
  kind: AiFirstShadowDivergenceKind;
  severity: AiFirstShadowDivergenceSeverity;
  legacy: string;
  aiFirst: string;
  detail: string;
};

export type AiFirstShadowRouterReceipt = {
  id: string;
  kind: 'shadow-normalization' | 'comparison' | 'no-runtime-change' | 'divergence';
  detail: string;
};

export type AiFirstShadowRouterRecommendation = {
  defaultRuntimeChanged: false;
  keepCurrentRuntimeDecision: true;
  action:
    | 'observe'
    | 'investigate-divergence'
    | 'collect-more-samples'
    | 'ready-for-shadow-batch';
  reason: string;
};

export type AiFirstShadowRouterSnapshot = {
  contractVersion: typeof AI_FIRST_SHADOW_ROUTER_CONTRACT_VERSION;
  source: 'ai-first-shadow-router';
  generatedAt: string;
  shadowId: string;
  input: {
    surface: string;
    userMessage: string;
  };
  legacy: AiFirstShadowLegacyRouteSummary;
  aiFirst: AiFirstShadowAiRouteSummary;
  divergences: AiFirstShadowDivergence[];
  summary: {
    totalDivergences: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  recommendation: AiFirstShadowRouterRecommendation;
  receipts: AiFirstShadowRouterReceipt[];
  gates: Array<{
    id: string;
    status: 'passed';
    detail: string;
  }>;
};
