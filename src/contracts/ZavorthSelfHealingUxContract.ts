import type { ExperienceCommandResult, ExperienceSnapshot } from '../services/experience/ExperienceContracts.js';
import type { ZavorthProviderReadinessMatrixSnapshot } from './ZavorthProviderReadinessMatrixContract.js';

export const ZAVORTH_SELF_HEALING_UX_CONTRACT_VERSION = 'ZavorthSelfHealingUx/v1' as const;

export type ZavorthSelfHealingIssueKind =
  | 'none'
  | 'provider_missing'
  | 'provider_auth'
  | 'provider_quota'
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'channel_missing'
  | 'channel_unpaired'
  | 'sandbox_unavailable'
  | 'approval_required'
  | 'runtime_unavailable'
  | 'unknown_failure';

export type ZavorthSelfHealingActionKind =
  | 'continue'
  | 'ask_user'
  | 'approve'
  | 'configure_provider'
  | 'configure_channel'
  | 'retry_fallback'
  | 'repair_runtime'
  | 'repair_sandbox'
  | 'open_evidence'
  | 'escalate';

export type ZavorthSelfHealingAction = {
  id: string;
  kind: ZavorthSelfHealingActionKind;
  label: string;
  detail: string;
  approvalRequired: boolean;
  needsUserInput: boolean;
  safeToAutomate: boolean;
  command?: string | null;
  prompt?: string | null;
};

export type ZavorthSelfHealingFallback = {
  attempted: boolean;
  reason: string;
  selectedProvider: string | null;
  candidates: string[];
};

export type ZavorthSelfHealingSetupContext = {
  target: 'provider' | 'channel' | 'sandbox' | 'runtime' | 'approval' | 'general';
  requiredInput: string[];
  secretSafe: boolean;
  notes: string[];
};

export type ZavorthSelfHealingProjection = {
  contractVersion: typeof ZAVORTH_SELF_HEALING_UX_CONTRACT_VERSION;
  ok: boolean;
  shouldRender: boolean;
  issue: ZavorthSelfHealingIssueKind;
  attempted: string;
  problem: string;
  impact: string;
  nextSafeAction: string;
  canZavorthRepair: boolean;
  needsUserInput: boolean;
  actions: ZavorthSelfHealingAction[];
  fallback: ZavorthSelfHealingFallback | null;
  setup: ZavorthSelfHealingSetupContext | null;
  receipt: {
    willBeCreated: boolean;
    reason: string;
  };
  invariants: {
    secretsRedacted: true;
    noPolicyBypass: true;
    noUnsafeAutoApply: true;
  };
  debug?: {
    sanitizedError?: string | null;
    signalText?: string | null;
  };
};

export type ZavorthSelfHealingBuildInput = {
  attempted?: string | null;
  commandText?: string | null;
  commandName?: string | null;
  result?: ExperienceCommandResult | null;
  snapshot?: ExperienceSnapshot | null;
  error?: unknown;
  providerMatrix?: ZavorthProviderReadinessMatrixSnapshot | null;
  debug?: boolean;
};
