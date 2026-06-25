import type {
  ZavorthFunctionalClosureDecision,
  ZavorthFunctionalClosureItemStatus,
  ZavorthFunctionalClosurePriority,
  ZavorthFunctionalClosureRiskLevel,
  ZavorthFunctionalClosureSnapshot,
} from './ZavorthFunctionalClosureContract.js';

export const ZAVORTH_SEMANTIC_FUNCTIONAL_CLOSURE_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.semantic-s9' as const;

export type ZavorthSemanticFunctionalClosureCertificationStatus =
  | 'passed'
  | 'failed';

export type ZavorthSemanticFunctionalClosureClaimKind =
  | 'closure-item-coverage'
  | 'closure-receipt-coverage'
  | 'priority-closure-policy'
  | 'decision-closure-policy'
  | 'dashboard-policy'
  | 'ledger-update-policy'
  | 'release-gate-policy'
  | 'machine-readable-policy'
  | 'live-io-policy'
  | 'artifact-receipt-policy'
  | 'unsafe-closure-policy';

export type ZavorthSemanticFunctionalClosureClaimStatus =
  | 'covered'
  | 'owner-gated'
  | 'rejected'
  | 'gap';

export type ZavorthSemanticFunctionalClosureClaimPriority =
  | 'P0'
  | 'P1'
  | 'P2';

export type ZavorthSemanticFunctionalClosureClaim = {
  id: string;
  kind: ZavorthSemanticFunctionalClosureClaimKind;
  status: ZavorthSemanticFunctionalClosureClaimStatus;
  priority: ZavorthSemanticFunctionalClosureClaimPriority;
  phase?: number;
  itemId?: string;
  closurePriority?: ZavorthFunctionalClosurePriority;
  decision?: ZavorthFunctionalClosureDecision;
  sourceStatus?: ZavorthFunctionalClosureItemStatus | ZavorthSemanticFunctionalClosureCertificationStatus;
  risk?: ZavorthFunctionalClosureRiskLevel;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds: string[];
  notes: string[];
};

export type ZavorthSemanticFunctionalClosureScenario = {
  id:
    | 'all-p0-closed-with-receipts'
    | 'optional-packs-are-explicit'
    | 'ledger-updater-preview-only'
    | 'release-gate-allows-without-live-io';
  status: 'passed' | 'failed';
  evidence: string[];
  receiptIds: string[];
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
  updatesApplied: false;
  releaseAllowed: boolean;
};

export type ZavorthSemanticFunctionalClosureCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SEMANTIC_FUNCTIONAL_CLOSURE_CERTIFICATION_CONTRACT_VERSION;
  status: ZavorthSemanticFunctionalClosureCertificationStatus;
  semanticPhase: 'S9';
  statement: 'Full functional closure semantics certify every absorbed or intentionally optional capability family as machine-readable, release-gated and receipt-backed.';
  closureStatus: ZavorthFunctionalClosureSnapshot['status'];
  closureContractVersion: ZavorthFunctionalClosureSnapshot['contractVersion'];
  runtime: ZavorthFunctionalClosureSnapshot['runtime'];
  claims: ZavorthSemanticFunctionalClosureClaim[];
  scenarios: ZavorthSemanticFunctionalClosureScenario[];
  summary: {
    semanticClaims: number;
    covered: number;
    ownerGated: number;
    rejected: number;
    gaps: number;
    p0Claims: number;
    p1Claims: number;
    p2Claims: number;
    receiptBackedClaims: number;
    itemClaimsCertified: number;
    receiptClaimsCertified: number;
    priorityPoliciesCertified: number;
    decisionPoliciesCertified: number;
    scenariosPassed: number;
    closureItems: number;
    closureReceipts: number;
    p0Items: number;
    p1Items: number;
    p2Items: number;
    passedItems: number;
    warnedItems: number;
    failedItems: number;
    implemented: number;
    replaced: number;
    optionalPacks: number;
    ownerWaived: number;
    rejectedItems: number;
    releaseAllowed: boolean;
    releaseBlockers: number;
    ledgerUpdatesPreviewOnly: true;
    ledgerUpdatesApplied: false;
    machineReadableReceipt: true;
    liveExternalIoPerformed: false;
    secretValuesSerialized: false;
    sourceCodeCopied: false;
  };
  policy: {
    semanticClaimRequiredForEveryClosureItem: true;
    semanticClaimRequiredForEveryClosureReceipt: true;
    allP0ClosedWithProof: true;
    allP1ClosedWithPackOrOwnerDecision: true;
    allP2ClosedWithOptionalPathOrNonGoal: true;
    optionalPacksExplicit: true;
    ledgerUpdatesRequireReceipts: true;
    ledgerUpdatesPreviewOnlyByDefault: true;
    releaseGateBlocksP0Regression: true;
    releaseGateMustPass: true;
    dashboardMustBeMachineReadable: true;
    noLiveIoInClosureCommand: true;
    artifactFirstReceipts: true;
    noSecretValuesSerialized: true;
    defaultLedgerMutationRejected: true;
    releaseWithBlockersRejected: true;
    unreceiptedClosureRejected: true;
    gapsBlockRelease: true;
  };
  commands: {
    inspect: 'npm run semantic-functional-closure-certification --silent';
    inspectJson: 'npm run semantic-functional-closure-certification:json --silent';
    check: 'npm run semantic-functional-closure-certification:check --silent';
    qa: 'npm run qa:semantic-functional-closure-certification --silent';
    releaseGate: 'npm run semantic-functional-closure-certification -- --release-gate --require-pass';
    nextStep: 'Semantic functional closure complete';
  };
};
