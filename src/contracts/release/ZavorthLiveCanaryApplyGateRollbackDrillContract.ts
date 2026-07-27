import type {
  ZavorthLiveCanaryAdapterActionKind,
  ZavorthLiveCanaryAdapterInput,
  ZavorthLiveCanaryExecutionAdapterReviewInput,
  ZavorthLiveCanaryExecutionAdapterReviewSnapshot,
} from './ZavorthLiveCanaryExecutionAdapterReviewContract.js';
import type { ZavorthCrossSurfaceProjectionSurface } from '../ZavorthCrossSurfaceRuntimeProjectionContract.js';

export const ZAVORTH_LIVE_CANARY_APPLY_GATE_ROLLBACK_DRILL_CONTRACT_VERSION =
  '2026-05-11.live-canary-apply-gate-rollback-drill-gate-9' as const;

export const ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE = 'APPLY ZAVORTH LIVE CANARY' as const;

export type ZavorthLiveCanaryApplyGateStatus =
  | 'ready-for-controlled-apply'
  | 'needs-adapter-review'
  | 'approval-required'
  | 'rollback-drill-required'
  | 'blocked';

export type ZavorthLiveCanaryApplyGateMode =
  | 'controlled-apply-gate'
  | 'adapter-review-gate'
  | 'approval-gate'
  | 'rollback-drill-gate'
  | 'hold';

export type ZavorthLiveCanaryFinalTriggerInput = {
  triggerId?: string | null;
  ownerConfirmed?: boolean | null;
  phrase?: string | null;
  requestedBy?: string | null;
  issuedAt?: string | null;
};

export type ZavorthLiveCanaryRollbackDrillInput = {
  drillId?: string | null;
  performed?: boolean | null;
  successful?: boolean | null;
  summary?: string | null;
  replayCommand?: string | null;
  rollbackCommand?: string | null;
  artifacts?: string[] | null;
};

export type ZavorthLiveCanaryApplyGatePolicyInput = {
  requireFinalTrigger?: boolean | null;
  requireRollbackDrill?: boolean | null;
  requireSeparateLiveInvocation?: boolean | null;
};

export type ZavorthLiveCanaryApplyGateRollbackDrillInput = {
  adapterReview?: ZavorthLiveCanaryExecutionAdapterReviewInput | null;
  finalTrigger?: ZavorthLiveCanaryFinalTriggerInput | null;
  rollbackDrill?: ZavorthLiveCanaryRollbackDrillInput | null;
  policy?: ZavorthLiveCanaryApplyGatePolicyInput | null;
};

export type ZavorthLiveCanaryApplyGateCheck = {
  id: string;
  status: 'pass' | 'fail';
  kind:
    | 'adapter-review-ready'
    | 'final-owner-trigger'
    | 'rollback-drill'
    | 'rollback-replay'
    | 'execution-scope'
    | 'receipt-chain'
    | 'no-implicit-execution'
    | 'visual-boundary';
  summary: string;
  recommendation: string | null;
};

export type ZavorthLiveCanaryApplyAuthorizationPacket = {
  adapterId: string;
  surface: ZavorthCrossSurfaceProjectionSurface;
  actionKind: ZavorthLiveCanaryAdapterActionKind;
  targetPreview: string;
  policyScope: string;
  applyGateOpen: boolean;
  executionAuthorized: boolean;
  executionPerformed: false;
  liveActionExecutorBundled: false;
  requiresSeparateLiveInvocation: true;
  rollbackDrillReceiptRequired: true;
  finalTriggerId: string | null;
  rollbackDrillId: string | null;
  authorizationReceiptId: string | null;
  expiresAt: string | null;
  requiredFinalPhrase: typeof ZAVORTH_LIVE_CANARY_REQUIRED_FINAL_PHRASE;
  conditions: string[];
};

export type ZavorthLiveCanaryApplyGateReceipt = {
  id: string;
  kind:
    | 'gate-9-live-canary-apply-gate'
    | 'adapter-review-chain'
    | 'final-trigger-boundary'
    | 'rollback-drill-boundary'
    | 'execution-scope-boundary'
    | 'no-implicit-execution-boundary'
    | 'visual-change-boundary';
  status: 'recorded' | 'requires-approval' | 'blocked';
  summary: string;
};

export type ZavorthLiveCanaryApplyGateSafety = {
  gateOnly: true;
  noLiveActionExecuted: true;
  noExternalImpactFromGate: true;
  requiresFinalHumanTrigger: true;
  rollbackDrillRequiredBeforeLive: true;
  noZavorthControlVisualMutation: true;
  rawSecretsSerialized: false;
  separateExecutorRequired: true;
};

export type ZavorthLiveCanaryApplyGateRollbackDrillSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_LIVE_CANARY_APPLY_GATE_ROLLBACK_DRILL_CONTRACT_VERSION;
  source: 'ZavorthLiveCanaryApplyGateRollbackDrillService';
  gate: 'live-canary-apply-gate-rollback-drill';
  status: ZavorthLiveCanaryApplyGateStatus;
  mode: ZavorthLiveCanaryApplyGateMode;
  adapterReview: ZavorthLiveCanaryExecutionAdapterReviewSnapshot;
  adapter: ZavorthLiveCanaryAdapterInput;
  finalTrigger: Required<Pick<ZavorthLiveCanaryFinalTriggerInput, 'triggerId' | 'ownerConfirmed' | 'phrase'>> & {
    requestedBy: string | null;
    issuedAt: string | null;
    phraseAccepted: boolean;
  };
  rollbackDrill: Required<Pick<ZavorthLiveCanaryRollbackDrillInput, 'drillId' | 'performed' | 'successful' | 'summary' | 'replayCommand' | 'rollbackCommand'>> & {
    artifacts: string[];
  };
  checks: ZavorthLiveCanaryApplyGateCheck[];
  authorizationPacket: ZavorthLiveCanaryApplyAuthorizationPacket;
  receipts: ZavorthLiveCanaryApplyGateReceipt[];
  safety: ZavorthLiveCanaryApplyGateSafety;
  summary: {
    checks: number;
    passedChecks: number;
    failedChecks: number;
    adapterReviewed: boolean;
    finalTriggerAccepted: boolean;
    rollbackDrillAccepted: boolean;
    applyGateOpen: boolean;
    executionAuthorized: boolean;
    executionPerformed: false;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-live-canary-apply-gate.ts';
    json: 'npx tsx scripts/zavorth-live-canary-apply-gate.ts --json';
    check: 'node scripts/zavorth-live-canary-apply-gate-check.mjs';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
