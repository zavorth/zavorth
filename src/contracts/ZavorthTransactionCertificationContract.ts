import type {
  ZavorthTransactionCommandCenterTone,
} from './ZavorthTransactionCommandCenterContract.js';
import type {
  ZavorthTransactionSurfaceKind,
} from './ZavorthTransactionSurfaceContract.js';
import type {
  ZavorthTransactionRuntimeStatus,
} from './ZavorthTransactionRuntimeContract.js';

export const ZAVORTH_TRANSACTION_CERTIFICATION_CONTRACT_VERSION = 'zavorth-transaction-certification/checkpoint-9' as const;

export type ZavorthTransactionCertificationStatus = 'passed' | 'failed';

export type ZavorthTransactionCertificationScenarioId =
  | 'web-trade-approval'
  | 'api-approved-paper-trade'
  | 'cli-credential-required'
  | 'telegram-price-monitor'
  | 'web-raw-secret-blocked';

export type ZavorthTransactionCertificationGateKind =
  | 'natural-first-routing'
  | 'approval-gate'
  | 'credential-ref-gate'
  | 'typed-connector-simulation'
  | 'command-center-projection'
  | 'cross-surface-parity'
  | 'secret-redaction'
  | 'no-live-execution';

export type ZavorthTransactionCertificationScenarioCheck = {
  id: string;
  label: string;
  passed: boolean;
  expected: string;
  observed: string;
};

export type ZavorthTransactionCertificationScenario = {
  id: ZavorthTransactionCertificationScenarioId;
  label: string;
  surface: ZavorthTransactionSurfaceKind;
  status: ZavorthTransactionCertificationStatus;
  expectedStatus: ZavorthTransactionRuntimeStatus;
  observedStatus: ZavorthTransactionRuntimeStatus;
  expectedTone: ZavorthTransactionCommandCenterTone;
  observedTone: ZavorthTransactionCommandCenterTone;
  projectionId: string;
  sourceProjectionId: string;
  naturalFirstRoute: string;
  connectorStatus: string;
  enabledActions: string[];
  laneKinds: string[];
  timelineStatuses: Record<string, string>;
  checks: ZavorthTransactionCertificationScenarioCheck[];
};

export type ZavorthTransactionCertificationGate = {
  kind: ZavorthTransactionCertificationGateKind;
  passed: boolean;
  summary: string;
  evidence: string[];
};

export type ZavorthTransactionCertificationSafety = {
  noLiveExecution: true;
  noHiddenLiveAction: true;
  noRawSecretSerialized: true;
  externalSideEffects: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  liveActionApplied: false;
};

export type ZavorthTransactionCertificationReport = {
  version: typeof ZAVORTH_TRANSACTION_CERTIFICATION_CONTRACT_VERSION;
  generatedAt: string;
  status: ZavorthTransactionCertificationStatus;
  summary: string;
  scenarioCount: number;
  passedScenarioCount: number;
  failedScenarioCount: number;
  gates: ZavorthTransactionCertificationGate[];
  scenarios: ZavorthTransactionCertificationScenario[];
  safety: ZavorthTransactionCertificationSafety;
  nextStage: 'Intent model0 - Owner-Gated Live Candidate Envelope';
};

export type ZavorthTransactionCertificationContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_CERTIFICATION_CONTRACT_VERSION;
  summary: string;
  scenarioIds: ZavorthTransactionCertificationScenarioId[];
  gateKinds: ZavorthTransactionCertificationGateKind[];
  invariants: string[];
};

export function buildZavorthTransactionCertificationContractSnapshot(): ZavorthTransactionCertificationContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_CERTIFICATION_CONTRACT_VERSION,
    summary: 'End-to-end certification gate for Zavorth Transaction Plane Certification matrix.',
    scenarioIds: [
      'web-trade-approval',
      'api-approved-paper-trade',
      'cli-credential-required',
      'telegram-price-monitor',
      'web-raw-secret-blocked',
    ],
    gateKinds: [
      'natural-first-routing',
      'approval-gate',
      'credential-ref-gate',
      'typed-connector-simulation',
      'command-center-projection',
      'cross-surface-parity',
      'secret-redaction',
      'no-live-execution',
    ],
    invariants: [
      'Certification matrix certifies Phases 0-8 as one transaction plane.',
      'Certification scenarios must never serialize raw transaction secrets.',
      'Certification must prove approval, credential, connector, surface and cockpit behavior together.',
      'A passed report still does not authorize live transaction execution.',
      'Every scenario must preserve externalSideEffects=false and liveActionApplied=false.',
    ],
  };
}
