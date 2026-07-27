import type {
  ZavorthAgentCapabilityAssimilationCategory,
  ZavorthAgentCapabilityAssimilationPolicyRequirement,
} from './ZavorthAgentCapabilityAssimilationContract.js';

export const ZAVORTH_REASONING_ACTION_PATTERN_CONTRACT_VERSION =
  '2026-05-11.reasoning-action-pattern-gate-2' as const;

export type ZavorthReasoningActionPatternStatus =
  | 'ready'
  | 'approval-required'
  | 'blocked'
  | 'needs-setup';

export type ZavorthReasoningActionPatternActionKind =
  | 'answer'
  | 'read'
  | 'web_search'
  | 'use_skill'
  | 'absorb_skill'
  | 'spawn_subagent'
  | 'observe_browser'
  | 'observe_device'
  | 'observe_computer'
  | 'workspace_write'
  | 'command_exec'
  | 'external_send'
  | 'raw_reasoning'
  | 'unknown';

export type ZavorthReasoningActionPatternDecision =
  | 'allow'
  | 'allow_readonly'
  | 'require_approval'
  | 'setup_required'
  | 'deny';

export type ZavorthReasoningActionPatternRisk = 'safe' | 'review' | 'dangerous' | 'forbidden';

export type ZavorthReasoningActionPatternInput = {
  text: string;
  surface?: string | null;
  actorId?: string | null;
  availableSurfaces?: Array<'files' | 'web' | 'browser' | 'computer' | 'android' | 'skills' | 'subagents'> | null;
  approvalId?: string | null;
  ownerConfirmed?: boolean | null;
};

export type ZavorthReasoningActionPatternEvidence = {
  id: string;
  source: 'request' | 'assimilation-matrix' | 'policy' | 'capability';
  summary: string;
  trusted: boolean;
  untrustedContent: boolean;
};

export type ZavorthReasoningActionPatternAction = {
  id: string;
  kind: ZavorthReasoningActionPatternActionKind;
  decision: ZavorthReasoningActionPatternDecision;
  risk: ZavorthReasoningActionPatternRisk;
  title: string;
  summary: string;
  target: string | null;
  reversible: boolean;
  readOnly: boolean;
  policyRequirements: ZavorthAgentCapabilityAssimilationPolicyRequirement[];
};

export type ZavorthReasoningActionPatternApprovalRequest = {
  id: string;
  actionId: string;
  reason: string;
  requiredBefore: 'workspace-mutation' | 'command-exec' | 'external-effect' | 'live-import' | 'sensitive-network';
};

export type ZavorthReasoningActionPatternBlock = {
  id: string;
  actionId: string;
  reason: string;
  replacement: string;
  policyRequirements: ZavorthAgentCapabilityAssimilationPolicyRequirement[];
};

export type ZavorthReasoningActionPatternReasoningBlock = {
  id: string;
  kind: 'compact_plan' | 'evidence' | 'allowed_actions' | 'blocked_actions' | 'verification' | 'recovery';
  title: string;
  lines: string[];
  rawReasoning: false;
};

export type ZavorthReasoningActionPatternReceipt = {
  id: string;
  kind:
    | 'gate-2-pattern-plan'
    | 'policy-decision'
    | 'approval-request'
    | 'blocked-action'
    | 'recovery-policy'
    | 'no-raw-reasoning';
  status: 'recorded' | 'requires-approval' | 'blocked';
  summary: string;
  actionIds: string[];
};

export type ZavorthReasoningActionPatternSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REASONING_ACTION_PATTERN_CONTRACT_VERSION;
  source: 'ZavorthReasoningActionPatternService';
  gate: 'reasoning-action-patterns';
  status: ZavorthReasoningActionPatternStatus;
  request: {
    surface: string;
    actorId: string | null;
    textPreview: string;
    rawSecretsSerialized: false;
  };
  selectedMatrixItems: Array<{
    id: string;
    category: ZavorthAgentCapabilityAssimilationCategory;
    status: string;
    nativeName: string;
  }>;
  evidence: ZavorthReasoningActionPatternEvidence[];
  actions: ZavorthReasoningActionPatternAction[];
  approvalRequests: ZavorthReasoningActionPatternApprovalRequest[];
  blockedActions: ZavorthReasoningActionPatternBlock[];
  reasoningBlocks: ZavorthReasoningActionPatternReasoningBlock[];
  receipts: ZavorthReasoningActionPatternReceipt[];
  safety: {
    compactReasoningOnly: true;
    rawReasoningSerialized: false;
    noExternalPromptsCopied: true;
    noExternalSourceCodeCopied: true;
    policyBrokerRequiredForImpact: true;
    untrustedContentMustBeDelimited: true;
    mutationRequiresApproval: true;
    visualChangesRequireOwnerApproval: true;
  };
  recovery: {
    boundedRetries: number;
    retryOnlyWhenEvidenceChanges: true;
    askUserWhenAmbiguous: true;
    rollbackRequiredForMutation: true;
    summarizeBeforeContinuingAfterFailure: true;
  };
  summary: {
    actions: number;
    allowed: number;
    approvalRequired: number;
    setupRequired: number;
    denied: number;
    evidence: number;
    receipts: number;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-reasoning-action-patterns.ts --text "<request>"';
    json: 'npx tsx scripts/zavorth-reasoning-action-patterns.ts --json --text "<request>"';
    check: 'node scripts/zavorth-reasoning-action-patterns-check.mjs';
    nextAction: 'Approval gate - Context Memory And Error Recovery Assimilation';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
