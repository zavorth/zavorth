import type { ZavorthReasoningActionPatternSnapshot } from './ZavorthReasoningActionPatternContract.js';

export const ZAVORTH_CONTEXT_RECOVERY_ASSIMILATION_CONTRACT_VERSION =
  '2026-05-11.context-memory-error-recovery-gate-3' as const;

export type ZavorthContextRecoveryStatus =
  | 'ready'
  | 'recovery-ready'
  | 'needs-user-clarification'
  | 'approval-required'
  | 'needs-setup'
  | 'blocked';

export type ZavorthContextRecoveryFailureKind =
  | 'none'
  | 'tool_error'
  | 'policy_block'
  | 'approval_missing'
  | 'missing_setup'
  | 'ambiguous_request'
  | 'verification_failed'
  | 'provider_error'
  | 'network_blocked'
  | 'secret_risk'
  | 'unknown';

export type ZavorthContextRecoveryNextAction =
  | 'proceed'
  | 'retry_with_new_evidence'
  | 'retry_safer_route'
  | 'ask_user'
  | 'request_approval'
  | 'run_setup'
  | 'stop_and_report';

export type ZavorthContextRecoveryMemoryLayer = 'hot' | 'warm' | 'cold';

export type ZavorthContextRecoveryMemoryFact = {
  id: string;
  layer?: ZavorthContextRecoveryMemoryLayer | null;
  summary: string;
  source?: string | null;
  confidence?: number | null;
  lastValidatedAt?: string | null;
};

export type ZavorthContextRecoveryInput = {
  text: string;
  surface?: string | null;
  actorId?: string | null;
  sessionId?: string | null;
  priorSummary?: string | null;
  recentEvents?: string[] | null;
  memoryFacts?: ZavorthContextRecoveryMemoryFact[] | null;
  lastFailure?: {
    message: string;
    toolId?: string | null;
    code?: string | null;
    attempt?: number | null;
    retryable?: boolean | null;
  } | null;
  availableSurfaces?: Array<'files' | 'web' | 'browser' | 'computer' | 'android' | 'skills' | 'subagents'> | null;
  approvalId?: string | null;
  ownerConfirmed?: boolean | null;
};

export type ZavorthContextRecoveryContextEntry = {
  id: string;
  layer: ZavorthContextRecoveryMemoryLayer;
  source: string;
  summary: string;
  confidence: number;
  trusted: boolean;
  retentionHint: 'session' | 'workspace' | 'long_term' | 'discard';
  usePolicy: 'authoritative' | 'supporting' | 'needs_verification';
};

export type ZavorthContextRecoveryContextPack = {
  sessionId: string;
  tokenBudget: number;
  estimatedTokens: number;
  hot: ZavorthContextRecoveryContextEntry[];
  warm: ZavorthContextRecoveryContextEntry[];
  cold: ZavorthContextRecoveryContextEntry[];
  warnings: string[];
  rawMemorySerialized: false;
  secretsSerialized: false;
  untrustedMemoryRequiresVerification: true;
};

export type ZavorthContextRecoveryFailureClassification = {
  kind: ZavorthContextRecoveryFailureKind;
  severity: 'none' | 'info' | 'warning' | 'blocker';
  retryable: boolean;
  repeatedFailure: boolean;
  failedToolId: string | null;
  attempt: number;
  summary: string;
  evidence: string[];
};

export type ZavorthContextRecoveryPlan = {
  nextAction: ZavorthContextRecoveryNextAction;
  retryAllowed: boolean;
  retryBudgetRemaining: number;
  maxRetries: 2;
  retryOnlyWhenEvidenceChanges: true;
  avoidSameFailingToolUntilEvidenceChanges: true;
  askUserWhenAmbiguous: true;
  rollbackRequiredBeforeMutationRetry: true;
  steps: string[];
  stopConditions: string[];
};

export type ZavorthContextRecoveryReceipt = {
  id: string;
  kind:
    | 'gate-3-context-pack'
    | 'memory-safety'
    | 'failure-classification'
    | 'recovery-plan'
    | 'approval-boundary'
    | 'blocked-retry';
  status: 'recorded' | 'requires-approval' | 'blocked';
  summary: string;
};

export type ZavorthContextRecoverySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CONTEXT_RECOVERY_ASSIMILATION_CONTRACT_VERSION;
  source: 'ZavorthContextRecoveryAssimilationService';
  gate: 'context-memory-error-recovery';
  status: ZavorthContextRecoveryStatus;
  request: {
    surface: string;
    actorId: string | null;
    textPreview: string;
    rawSecretsSerialized: false;
  };
  actionPattern: ZavorthReasoningActionPatternSnapshot;
  contextPack: ZavorthContextRecoveryContextPack;
  failure: ZavorthContextRecoveryFailureClassification;
  recovery: ZavorthContextRecoveryPlan;
  receipts: ZavorthContextRecoveryReceipt[];
  safety: {
    compactContextOnly: true;
    rawTranscriptSerialized: false;
    rawMemorySerialized: false;
    rawFailurePayloadSerialized: false;
    secretsSerialized: false;
    ledgerBeatsRecall: true;
    lowConfidenceMemoryNeedsVerification: true;
    noRawChainOfThought: true;
    policyDecisionInheritedFromStage2: true;
  };
  summary: {
    hot: number;
    warm: number;
    cold: number;
    warnings: number;
    receipts: number;
    retryBudgetRemaining: number;
  };
  commands: {
    report: 'npx tsx scripts/zavorth-context-recovery-assimilation.ts --text "<request>"';
    json: 'npx tsx scripts/zavorth-context-recovery-assimilation.ts --json --text "<request>"';
    check: 'node scripts/zavorth-context-recovery-assimilation-check.mjs';
    nextAction: 'Connector registry - Tool Orchestration And Verification Assimilation';
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};
