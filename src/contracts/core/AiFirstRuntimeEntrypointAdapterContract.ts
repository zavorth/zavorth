import type {
  AiFirstLimitedCanaryDecisionStatus,
  AiFirstLimitedCanaryFallbackReason,
} from './AiFirstLimitedCanarySwitchboardContract.js';
import type {
  ZavorthResponseDecisionConfidence,
  ZavorthResponseDecisionMode,
  ZavorthResponseDecisionPath,
  ZavorthResponseDecisionTarget,
} from '../ZavorthResponseDecisionContract.js';

export const AI_FIRST_RUNTIME_ENTRYPOINT_ADAPTER_CONTRACT_VERSION = '2026-05-06.checkpoint-7' as const;

export type AiFirstRuntimeEntrypointSelectedPath = 'ai-first-canary' | 'current-runtime';

export type AiFirstRuntimeEntrypointStatus =
  | 'canary-selected'
  | 'fallback-current-runtime'
  | 'current-runtime-only';

export type AiFirstRuntimeEntrypointFallbackReason =
  | AiFirstLimitedCanaryFallbackReason
  | 'switchboard-missing'
  | 'canary-decision-missing'
  | 'canary-not-selected';

export type AiFirstRuntimeEntrypointCurrentRuntimeSummary = {
  mode: ZavorthResponseDecisionMode;
  responsePath: ZavorthResponseDecisionPath;
  confidence: ZavorthResponseDecisionConfidence;
  shouldExecute: boolean;
  requestedTools: string[];
  target: ZavorthResponseDecisionTarget;
  reason: string;
  sourceReason: string;
  diagnosticRisk: string | null;
  diagnosticNextSafeAction: string | null;
  retainedAsFallback: true;
};

export type AiFirstRuntimeEntrypointCanarySummary = {
  switchboardId: string | null;
  switchboardReadiness: string | null;
  decision: AiFirstLimitedCanaryDecisionStatus | 'unavailable';
  requestId: string | null;
  matchedRouteKey: string | null;
  fallbackReason: AiFirstRuntimeEntrypointFallbackReason | null;
  approvalGateGuardrailRequired: true;
  registryReceiptRequired: true;
  fallbackAvailable: true;
  defaultRuntimeChanged: false;
  canExecuteNow: false;
};

export type AiFirstRuntimeEntrypointEffectiveDecision = {
  status: AiFirstRuntimeEntrypointStatus;
  selectedPath: AiFirstRuntimeEntrypointSelectedPath;
  dispatchTarget: AiFirstRuntimeEntrypointSelectedPath;
  reason: string;
  canarySelected: boolean;
  currentRuntimeDecisionRetained: true;
  fallbackAvailable: true;
  defaultRuntimeChanged: false;
  keepCurrentRuntimeDecision: true;
  adapterOnly: true;
  canExecuteNow: false;
};

export type AiFirstRuntimeEntrypointAdapterSnapshot = {
  contractVersion: typeof AI_FIRST_RUNTIME_ENTRYPOINT_ADAPTER_CONTRACT_VERSION;
  source: 'ai-first-runtime-entrypoint-adapter';
  generatedAt: string;
  adapterId: string;
  input: {
    adapterName: string;
    requestId: string;
    surface: string;
    userMessage: string;
  };
  currentRuntime: AiFirstRuntimeEntrypointCurrentRuntimeSummary;
  canary: AiFirstRuntimeEntrypointCanarySummary;
  effective: AiFirstRuntimeEntrypointEffectiveDecision;
  sideBySide: {
    currentRuntimeWouldHandle: true;
    aiFirstCanaryWouldHandle: boolean;
    selectedDecisionRecordedBesideCurrent: true;
    canaryDecisionSource: 'checkpoint-6-switchboard' | 'missing';
  };
  receipts: Array<{
    id: string;
    kind: 'entrypoint' | 'current-runtime' | 'canary' | 'fallback' | 'no-runtime-change';
    detail: string;
  }>;
  gates: Array<{
    id: string;
    status: 'passed';
    detail: string;
  }>;
};
