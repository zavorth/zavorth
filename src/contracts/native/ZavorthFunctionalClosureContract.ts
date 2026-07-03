export const ZAVORTH_FUNCTIONAL_CLOSURE_CONTRACT_VERSION = '2026-05-05.checkpoint-9' as const;

export type ZavorthFunctionalClosureStatus = 'passed' | 'failed';

export type ZavorthFunctionalClosureItemStatus = 'pass' | 'warn' | 'fail';

export type ZavorthFunctionalClosurePriority = 'P0' | 'P1' | 'P2';

export type ZavorthFunctionalClosureDecision =
  | 'implemented'
  | 'replaced'
  | 'optional-pack'
  | 'owner-waived'
  | 'rejected';

export type ZavorthFunctionalClosureRiskLevel = 'none' | 'attention' | 'blocking';

export type ZavorthFunctionalClosureReceipt = {
  id: string;
  phase: number;
  itemId: string;
  status: ZavorthFunctionalClosureItemStatus;
  priority: ZavorthFunctionalClosurePriority;
  decision: ZavorthFunctionalClosureDecision;
  machineReadable: true;
  artifactFirst: true;
  receiptBacked: boolean;
  command: string;
  observed: string;
  reason: string;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
};

export type ZavorthFunctionalClosureItem = {
  id: string;
  phase: number;
  label: string;
  category: string;
  priority: ZavorthFunctionalClosurePriority;
  decision: ZavorthFunctionalClosureDecision;
  status: ZavorthFunctionalClosureItemStatus;
  command: string;
  receiptIds: string[];
  receiptCount: number;
  risk: ZavorthFunctionalClosureRiskLevel;
  observed: string;
  required: string;
  notes: string[];
  sourceSummary: Record<string, unknown>;
};

export type ZavorthFunctionalClosureZavorthControlSnapshot = {
  status: ZavorthFunctionalClosureItemStatus;
  generatedAt: string;
  title: 'Zavorth Functional Closure ZavorthControl';
  categoryRows: Array<{
    category: string;
    phase: number;
    status: ZavorthFunctionalClosureItemStatus;
    priority: ZavorthFunctionalClosurePriority;
    decision: ZavorthFunctionalClosureDecision;
    receipts: number;
    risk: ZavorthFunctionalClosureRiskLevel;
  }>;
  riskRows: Array<{
    itemId: string;
    risk: ZavorthFunctionalClosureRiskLevel;
    reason: string;
  }>;
  receiptRows: Array<{
    itemId: string;
    receipts: number;
    command: string;
  }>;
  report: string;
};

export type ZavorthLedgerDecisionUpdate = {
  itemId: string;
  phase: number;
  currentDecision: ZavorthFunctionalClosureDecision;
  proposedDecision: ZavorthFunctionalClosureDecision;
  canUpdate: boolean;
  receiptBacked: boolean;
  receiptIds: string[];
  reason: string;
};

export type ZavorthLedgerDecisionUpdaterSnapshot = {
  status: ZavorthFunctionalClosureItemStatus;
  generatedAt: string;
  updatesApplied: false;
  previewOnly: true;
  updates: ZavorthLedgerDecisionUpdate[];
  blockedUpdates: number;
  receiptBackedUpdates: number;
  policy: {
    neverUpdateWithoutReceipt: true;
    previewOnlyByDefault: true;
    ownerDecisionPreserved: true;
  };
};

export type ZavorthFunctionalReleaseGateSnapshot = {
  status: ZavorthFunctionalClosureStatus;
  generatedAt: string;
  p0: {
    total: number;
    closed: number;
    blocking: number;
  };
  p1: {
    total: number;
    closed: number;
    blocking: number;
  };
  p2: {
    total: number;
    closed: number;
    blocking: number;
  };
  blockers: string[];
  releaseAllowed: boolean;
  policy: {
    p0MustBeReceiptBacked: true;
    p1MustHaveFunctionalPackOrOwnerDecision: true;
    p2MustHaveOptionalPackOrNonGoalDecision: true;
    blockOnAnyFail: true;
  };
};

export type ZavorthFunctionalClosureSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_FUNCTIONAL_CLOSURE_CONTRACT_VERSION;
  status: ZavorthFunctionalClosureStatus;
  phase: 9;
  statement: 'Zavorth functional closure is a live, repeatable, machine-readable receipt over all absorbed and intentionally excluded capability surfaces.';
  runtime: {
    platform: NodeJS.Platform;
    arch: string;
    nodeVersion: string;
    cwd: string;
  };
  items: ZavorthFunctionalClosureItem[];
  receipts: ZavorthFunctionalClosureReceipt[];
  zavorthControl: ZavorthFunctionalClosureZavorthControlSnapshot;
  ledgerDecisionUpdater: ZavorthLedgerDecisionUpdaterSnapshot;
  releaseGate: ZavorthFunctionalReleaseGateSnapshot;
  summary: {
    items: number;
    p0Items: number;
    p1Items: number;
    p2Items: number;
    passed: number;
    warned: number;
    failed: number;
    receipts: number;
    receiptBackedItems: number;
    implemented: number;
    replaced: number;
    optionalPacks: number;
    ownerWaived: number;
    rejected: number;
    releaseAllowed: boolean;
    machineReadableReceipt: true;
    liveExternalIoPerformed: false;
    secretValuesSerialized: false;
  };
  policy: {
    allP0ClosedWithProof: true;
    allP1ClosedWithPackOrOwnerDecision: true;
    allP2ClosedWithOptionalPathOrNonGoal: true;
    ledgerUpdatesRequireReceipts: true;
    releaseGateBlocksP0Regression: true;
    noLiveIoInClosureCommand: true;
    artifactFirstReceipts: true;
  };
  commands: {
    inspect: 'npm run zavorth-functional-closure --silent';
    inspectJson: 'npm run zavorth-functional-closure:json --silent';
    check: 'npm run zavorth-functional-closure:check --silent';
    qa: 'npm run qa:zavorth-functional-closure --silent';
    releaseGate: 'npm run zavorth-functional-closure -- --release-gate --require-pass';
    nextStep: 'Functional absorption closure complete';
  };
};

export type ZavorthFunctionalClosureZavorthControlSnapshot = ZavorthFunctionalClosureZavorthControlSnapshot;
