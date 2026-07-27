import type {
  ZavorthTransactionApprovalLedgerEntry,
} from './ZavorthTransactionApprovalContract.js';
import type {
  ZavorthTransactionActionKind,
  ZavorthTransactionApprovalStatus,
  ZavorthTransactionDecisionStatus,
  ZavorthTransactionRiskLevel,
} from './ZavorthTransactionPlaneContract.js';
import type {
  ZavorthTransactionConnectorKind,
  ZavorthTransactionPreview,
} from './ZavorthTransactionPreviewContract.js';

export const ZAVORTH_TRANSACTION_CONNECTOR_CONTRACT_VERSION = 'zavorth-transaction-connector/gate-4' as const;

export type ZavorthTransactionConnectorMode = 'dry-run' | 'sandbox' | 'paper';

export type ZavorthTransactionConnectorRunStatus = 'dryRun' | 'blocked';

export type ZavorthTransactionConnectorCredentialMode =
  | 'none'
  | 'vault-ref-required'
  | 'future-vault-ref';

export type ZavorthTransactionTypedConnectorDefinition = {
  id: string;
  kind: ZavorthTransactionConnectorKind;
  displayName: string;
  trusted: boolean;
  enabled: boolean;
  supportedModes: ZavorthTransactionConnectorMode[];
  supportsLive: false;
  rawSecretsAccepted: false;
  credentialMode: ZavorthTransactionConnectorCredentialMode;
  requiresApprovalFor: ZavorthTransactionActionKind[];
  notes: string[];
};

export type ZavorthTransactionConnectorPayload = {
  method: string;
  operation: ZavorthTransactionActionKind;
  target: {
    kind: string;
    label: string;
  };
  amount?: number;
  currency?: string;
  conditions: string[];
  idempotencyKey: string;
  credentialRef?: string;
  redacted: true;
  rawSecretPresent: false;
};

export type ZavorthTransactionConnectorRunInput = {
  preview: ZavorthTransactionPreview;
  approvalEntry?: ZavorthTransactionApprovalLedgerEntry | null;
  connectorId?: string;
  mode?: ZavorthTransactionConnectorMode;
  credentialRef?: string | null;
  now?: Date;
};

export type ZavorthTransactionConnectorPolicySnapshot = {
  policyStatus: ZavorthTransactionDecisionStatus;
  riskLevel: ZavorthTransactionRiskLevel;
  approvalStatus: ZavorthTransactionApprovalStatus;
  approvalRequired: boolean;
  trustedConnectorRequired: boolean;
  typedConnectorRequired: boolean;
  requiredControls: string[];
  blockers: string[];
};

export type ZavorthTransactionConnectorRunResult = {
  version: typeof ZAVORTH_TRANSACTION_CONNECTOR_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  status: ZavorthTransactionConnectorRunStatus;
  mode: ZavorthTransactionConnectorMode;
  connector: ZavorthTransactionTypedConnectorDefinition | null;
  previewId: string;
  approvalId?: string;
  approvalEntryId?: string;
  actionKind: ZavorthTransactionActionKind;
  targetLabel: string;
  connectorKind: ZavorthTransactionConnectorKind;
  payload: ZavorthTransactionConnectorPayload | null;
  policy: ZavorthTransactionConnectorPolicySnapshot;
  blockers: string[];
  receipts: string[];
  externalSideEffects: false;
  liveActionApplied: false;
  liveExecutionAuthorized: false;
  executableNow: false;
  nextSteps: string[];
};

export type ZavorthTransactionConnectorContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_CONNECTOR_CONTRACT_VERSION;
  summary: string;
  supportedModes: ZavorthTransactionConnectorMode[];
  connectors: ZavorthTransactionTypedConnectorDefinition[];
  invariants: string[];
};

export function buildZavorthTransactionConnectorContractSnapshot(
  connectors: ZavorthTransactionTypedConnectorDefinition[],
): ZavorthTransactionConnectorContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_CONNECTOR_CONTRACT_VERSION,
    summary: 'Typed connector dry-run contract for Zavorth Transaction Plane Connector registry.',
    supportedModes: ['dry-run', 'sandbox', 'paper'],
    connectors,
    invariants: [
      'Connector registry connectors can validate and simulate payloads, but cannot execute live effects.',
      'All connector run results report externalSideEffects=false.',
      'Real-money dry-runs require a Approval gate approval-granted ledger entry.',
      'Connector payloads accept vault credential references only, never raw secrets.',
      'Every dryRun connector call carries an idempotency key and receipts.',
      'supportsLive remains false for every Connector registry connector.',
    ],
  };
}
