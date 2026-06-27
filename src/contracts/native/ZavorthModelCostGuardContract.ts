import type { ZavorthAutonomySliderLevel } from './ZavorthAutonomySliderContract.js';
import type { ZavorthExperienceProfileId } from '../ZavorthExperienceProfileContract.js';

export const ZAVORTH_MODEL_COST_GUARD_CONTRACT_VERSION = '2026-05-15.experience-layer.checkpoint-8' as const;

export type ZavorthModelCostTier =
  | 'free_or_local'
  | 'low'
  | 'standard'
  | 'premium'
  | 'unknown';

export type ZavorthModelCostGuardDecision =
  | 'allow_preview'
  | 'allow_with_budget'
  | 'ask_before_live'
  | 'block_until_configured';

export type ZavorthModelCostGuardProviderCard = {
  id: string;
  label: string;
  tier: ZavorthModelCostTier;
  bestFor: string[];
  privacy: 'local' | 'hosted' | 'proxy' | 'unknown';
  readiness: 'ready' | 'needs_setup' | 'needs_probe' | 'blocked' | 'unknown';
  liveUseNeedsApproval: boolean;
  costKnown: boolean;
  note: string;
};

export type ZavorthModelCostGuardContract = {
  contractVersion: typeof ZAVORTH_MODEL_COST_GUARD_CONTRACT_VERSION;
  schemaVersion: 1;
  surface: 'model-cost-guard';
  selectedProfile: ZavorthExperienceProfileId;
  autonomy: ZavorthAutonomySliderLevel;
  request: string | null;
  missionKind: 'daily' | 'documents' | 'development' | 'business' | 'automation' | 'device' | 'unknown';
  estimate: {
    complexity: 'small' | 'medium' | 'large';
    expectedTokens: {
      input: number;
      output: number;
      total: number;
    };
    expectedToolCalls: number;
    expectedSubagents: number;
    riskOfCostSurprise: 'low' | 'medium' | 'high';
  };
  budget: {
    profileDefaultCents: number;
    requestedMaxCents: number | null;
    effectiveMaxCents: number;
    requireApprovalAboveCents: number;
    stopWhenExceeded: true;
  };
  routing: {
    recommendedTier: ZavorthModelCostTier;
    decision: ZavorthModelCostGuardDecision;
    reason: string;
    fallbackOrder: string[];
  };
  providerCards: ZavorthModelCostGuardProviderCard[];
  userFacingCopy: {
    short: string;
    approvalPrompt: string;
    receiptLine: string;
  };
  safety: {
    previewOnlyByDefault: true;
    liveProviderUseRequiresExplicitReadiness: true;
    paidEscalationRequiresApproval: true;
    costLimitIsAdvisoryUntilProviderReportsUsage: true;
    rawSecretsSerialized: false;
  };
  commandPreview: {
    inspect: string;
    setBudget: string;
    runWithGuard: string;
  };
  invariants: string[];
};
