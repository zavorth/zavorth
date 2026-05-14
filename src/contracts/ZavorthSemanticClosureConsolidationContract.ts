export const ZAVORTH_SEMANTIC_CLOSURE_CONSOLIDATION_CONTRACT_VERSION = '2026-05-05.semantic-consolidation' as const;

export type ZavorthSemanticClosureConsolidationStatus = 'passed' | 'failed';

export type ZavorthSemanticClosurePhaseId =
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S5'
  | 'S6'
  | 'S7'
  | 'S8'
  | 'S9';

export type ZavorthSemanticClosureClaimStatus =
  | 'covered'
  | 'replaced'
  | 'owner-gated'
  | 'rejected'
  | 'gap';

export type ZavorthSemanticClosureClaimPriority = 'P0' | 'P1' | 'P2';

export type ZavorthSemanticClosurePhaseLabel =
  | 'Plugin and package semantics'
  | 'Agent runtime semantics'
  | 'Provider mesh semantics'
  | 'Channel mesh semantics'
  | 'Memory, document, search and terminal semantics'
  | 'Native companion and device semantics'
  | 'QA, security and release semantics'
  | 'Skill ecosystem semantics'
  | 'Functional closure semantics';

export type ZavorthSemanticClosurePhaseReceipt = {
  phase: ZavorthSemanticClosurePhaseId;
  label: ZavorthSemanticClosurePhaseLabel;
  status: ZavorthSemanticClosureConsolidationStatus;
  contractVersion: string;
  statement: string;
  command: string;
  checkCommand: string;
  qaCommand: string;
  semanticClaims: number;
  covered: number;
  replaced: number;
  ownerGated: number;
  rejected: number;
  gaps: number;
  p0Claims: number;
  p1Claims: number;
  p2Claims: number;
  receiptBackedClaims: number;
  receiptIds: string[];
  claimIdsUnique: boolean;
  receiptIdsValid: boolean;
  liveExternalIoPerformed: boolean;
  liveExecutionPerformed: boolean;
  runtimeExecutionPerformed: boolean;
  secretValuesSerialized: boolean;
  sourceCodeCopied: boolean;
  enabledByDefault: boolean;
  releaseAllowed?: boolean;
  releaseBlockers?: number;
  next: string;
};

export type ZavorthSemanticClosureReleaseGate = {
  status: ZavorthSemanticClosureConsolidationStatus;
  releaseAllowed: boolean;
  phaseCount: number;
  phasesPassed: number;
  phasesFailed: number;
  totalGaps: number;
  totalReleaseBlockers: number;
  allClaimsReceiptBacked: boolean;
  allPhaseClaimIdsUnique: boolean;
  allReceiptIdsValid: boolean;
  machineReadableClosurePassed: boolean;
  functionalReleaseAllowed: boolean;
  noLiveExternalIo: boolean;
  noLiveExecution: boolean;
  noRuntimeExecutionDuringCertification: boolean;
  noSecretValuesSerialized: boolean;
  noSourceCodeCopied: boolean;
  noDefaultEnablement: boolean;
  blockers: string[];
};

export type ZavorthSemanticClosureConsolidationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SEMANTIC_CLOSURE_CONSOLIDATION_CONTRACT_VERSION;
  status: ZavorthSemanticClosureConsolidationStatus;
  semanticScope: 'S1-S9';
  statement: 'Semantic closure consolidation proves S1-S9 remain passing together as one artifact-first Zavorth release gate.';
  phaseReceipts: ZavorthSemanticClosurePhaseReceipt[];
  releaseGate: ZavorthSemanticClosureReleaseGate;
  summary: {
    phases: number;
    passed: number;
    failed: number;
    semanticClaims: number;
    covered: number;
    replaced: number;
    ownerGated: number;
    rejected: number;
    gaps: number;
    p0Claims: number;
    p1Claims: number;
    p2Claims: number;
    receiptBackedClaims: number;
    receiptIds: number;
    phasesWithOwnerGates: number;
    phasesWithRejectedPolicies: number;
    releaseAllowed: boolean;
    releaseBlockers: number;
    machineReadableClosurePassed: boolean;
    functionalReleaseAllowed: boolean;
    liveExternalIoPerformed: boolean;
    liveExecutionPerformed: boolean;
    runtimeExecutionPerformed: boolean;
    secretValuesSerialized: boolean;
    sourceCodeCopied: boolean;
    enabledByDefault: boolean;
  };
  policy: {
    everySemanticPhaseMustPass: true;
    everyPhaseMustHaveClaims: true;
    everyClaimMustHaveReceipt: true;
    claimIdsMustBeUniqueWithinPhase: true;
    noGapsAllowed: true;
    functionalClosureMustAllowRelease: true;
    semanticClosureMustBeMachineReadable: true;
    noLiveExternalIoDuringConsolidation: true;
    noRuntimeExecutionDuringCertification: true;
    noSecretValuesSerialized: true;
    noSourceCodeCopied: true;
    noDefaultEnablement: true;
    rejectedPoliciesRemainExplicit: true;
    ownerGatesRemainExplicit: true;
    releaseGateBlocksAnyRegression: true;
  };
  commands: {
    inspect: 'npm run semantic-closure-consolidation --silent';
    inspectJson: 'npm run semantic-closure-consolidation:json --silent';
    check: 'npm run semantic-closure-consolidation:check --silent';
    qa: 'npm run qa:semantic-closure-consolidation --silent';
    releaseGate: 'npm run semantic-closure-consolidation -- --release-gate --require-pass';
    nextStep: 'S1-S9 semantic consolidation complete';
  };
};
