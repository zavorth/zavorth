import type {
  ZavorthTransactionActionKind,
} from './ZavorthTransactionPlaneContract.js';
import type {
  ZavorthTransactionConnectorKind,
} from './ZavorthTransactionPreviewContract.js';

export const ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION = 'zavorth-transaction-credential/gate-5' as const;

export type ZavorthTransactionCredentialEnvironment =
  | 'dry-run'
  | 'sandbox'
  | 'paper'
  | 'live-candidate';

export type ZavorthTransactionCredentialRecordStatus = 'registered' | 'blocked';

export type ZavorthTransactionCredentialValidationStatus =
  | 'ready'
  | 'missing'
  | 'blocked'
  | 'mismatch'
  | 'expired';

export type ZavorthTransactionCredentialStorageKind =
  | 'metadata-only'
  | 'external-vault-ref';

export type ZavorthTransactionCredentialRefRecord = {
  version: typeof ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION;
  id: string;
  createdAt: string;
  status: ZavorthTransactionCredentialRecordStatus;
  ref: string;
  label: string;
  connectorKind: ZavorthTransactionConnectorKind;
  connectorId?: string;
  environment: ZavorthTransactionCredentialEnvironment;
  allowedActions: ZavorthTransactionActionKind[];
  ownerApproved: boolean;
  expiresAt?: string;
  storageKind: ZavorthTransactionCredentialStorageKind;
  rawSecretStored: false;
  rawSecretSerialized: false;
  valueReadableByLlm: false;
  valueSerialized: false;
  payloadDigest: string;
  receipts: string[];
};

export type ZavorthTransactionCredentialRegisterInput = {
  label: string;
  connectorKind: ZavorthTransactionConnectorKind;
  connectorId?: string;
  environment?: ZavorthTransactionCredentialEnvironment;
  allowedActions?: ZavorthTransactionActionKind[];
  ownerApproved?: boolean;
  expiresAt?: string;
  ref?: string;
  secretValue?: string;
  now?: Date;
};

export type ZavorthTransactionCredentialRegisterResult = {
  version: typeof ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION;
  status: ZavorthTransactionCredentialRecordStatus;
  record?: ZavorthTransactionCredentialRefRecord;
  blockers: string[];
  warnings: string[];
  rawSecretSerialized: false;
};

export type ZavorthTransactionCredentialValidationInput = {
  ref: string;
  connectorKind: ZavorthTransactionConnectorKind;
  actionKind: ZavorthTransactionActionKind;
  now?: Date;
};

export type ZavorthTransactionCredentialValidationResult = {
  version: typeof ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION;
  status: ZavorthTransactionCredentialValidationStatus;
  ref: string;
  record?: ZavorthTransactionCredentialRefRecord;
  connectorKind: ZavorthTransactionConnectorKind;
  actionKind: ZavorthTransactionActionKind;
  canUseForConnectorRun: boolean;
  blockers: string[];
  warnings: string[];
  rawSecretSerialized: false;
  valueReadableByLlm: false;
  receipts: string[];
};

export type ZavorthTransactionCredentialStoreSummary = {
  version: typeof ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION;
  storeFile: string;
  records: number;
  registered: number;
  blocked: number;
  rawSecretStored: false;
  rawSecretSerialized: false;
  latestRecordId: string | null;
};

export type ZavorthTransactionCredentialContractSnapshot = {
  version: typeof ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION;
  summary: string;
  environments: ZavorthTransactionCredentialEnvironment[];
  validationStatuses: ZavorthTransactionCredentialValidationStatus[];
  invariants: string[];
};

export function buildZavorthTransactionCredentialContractSnapshot(): ZavorthTransactionCredentialContractSnapshot {
  return {
    version: ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION,
    summary: 'Credential reference boundary for Zavorth Transaction Plane Credential vault.',
    environments: ['dry-run', 'sandbox', 'paper', 'live-candidate'],
    validationStatuses: ['ready', 'missing', 'blocked', 'mismatch', 'expired'],
    invariants: [
      'Credential vault stores credential references and metadata only, never raw secret values.',
      'Raw credential values are blocked and redacted before any store write.',
      'LLM-visible outputs may include SecretRef metadata, but never the credential value.',
      'Connector runs can use only valid vault-style credential references.',
      'Credential references do not authorize live execution by themselves.',
      'Every registered reference declares connector kind, environment and allowed actions.',
    ],
  };
}
