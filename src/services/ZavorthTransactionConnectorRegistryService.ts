import { createHash } from 'node:crypto';
import {
  ZAVORTH_TRANSACTION_REAL_MONEY_ACTIONS,
} from '../contracts/ZavorthTransactionPlaneContract.js';
import {
  buildZavorthTransactionConnectorContractSnapshot,
  ZAVORTH_TRANSACTION_CONNECTOR_CONTRACT_VERSION,
  type ZavorthTransactionConnectorContractSnapshot,
  type ZavorthTransactionConnectorMode,
  type ZavorthTransactionConnectorPayload,
  type ZavorthTransactionConnectorPolicySnapshot,
  type ZavorthTransactionConnectorRunInput,
  type ZavorthTransactionConnectorRunResult,
  type ZavorthTransactionConnectorRunStatus,
  type ZavorthTransactionTypedConnectorDefinition,
} from '../contracts/ZavorthTransactionConnectorContract.js';
import { isAllowedZavorthTransactionCredentialRef } from './ZavorthTransactionCredentialRefService.js';

import type {
  ZavorthTransactionActionKind,
} from '../contracts/ZavorthTransactionPlaneContract.js';

import type {
  ZavorthTransactionApprovalLedgerEntry,
} from '../contracts/ZavorthTransactionApprovalContract.js';
import type {
  ZavorthTransactionPreview,
} from '../contracts/ZavorthTransactionPreviewContract.js';


const DEFAULT_CONNECTORS: readonly ZavorthTransactionTypedConnectorDefinition[] = [
  {
    id: 'zavorth.connector.market-data.typed',
    kind: 'market-data',
    displayName: 'Zavorth Typed Market Data Simulator',
    trusted: true,
    enabled: true,
    supportedModes: ['dry-run', 'sandbox'],
    supportsLive: false,
    rawSecretsAccepted: false,
    credentialMode: 'none',
    requiresApprovalFor: [],
    notes: ['Read-only observation connector for quotes, prices and monitoring previews.'],
  },
  {
    id: 'zavorth.connector.commerce.typed',
    kind: 'commerce',
    displayName: 'Zavorth Typed Commerce Simulator',
    trusted: true,
    enabled: true,
    supportedModes: ['dry-run', 'sandbox'],
    supportsLive: false,
    rawSecretsAccepted: false,
    credentialMode: 'future-vault-ref',
    requiresApprovalFor: ['purchase-submit', 'api-credit-purchase'],
    notes: ['Simulates cart, checkout and API credit purchase payloads only.'],
  },
  {
    id: 'zavorth.connector.payment.typed',
    kind: 'payment',
    displayName: 'Zavorth Typed Payment Simulator',
    trusted: true,
    enabled: true,
    supportedModes: ['dry-run', 'sandbox'],
    supportsLive: false,
    rawSecretsAccepted: false,
    credentialMode: 'future-vault-ref',
    requiresApprovalFor: ['payment-submit', 'refund-request', 'mandate-create', 'mandate-revoke'],
    notes: ['Simulates payment and refund connector schemas without network calls.'],
  },
  {
    id: 'zavorth.connector.exchange.typed',
    kind: 'exchange',
    displayName: 'Zavorth Typed Exchange Simulator',
    trusted: true,
    enabled: true,
    supportedModes: ['dry-run', 'paper'],
    supportsLive: false,
    rawSecretsAccepted: false,
    credentialMode: 'future-vault-ref',
    requiresApprovalFor: ['trade-order', 'trade-cancel'],
    notes: ['Simulates trade orders and paper-mode payloads without broker/exchange calls.'],
  },
  {
    id: 'zavorth.connector.fx.typed',
    kind: 'currency-exchange',
    displayName: 'Zavorth Typed FX Simulator',
    trusted: true,
    enabled: true,
    supportedModes: ['dry-run', 'sandbox'],
    supportsLive: false,
    rawSecretsAccepted: false,
    credentialMode: 'future-vault-ref',
    requiresApprovalFor: ['currency-conversion'],
    notes: ['Simulates currency conversion payloads only.'],
  },
  {
    id: 'zavorth.connector.subscription.typed',
    kind: 'subscription',
    displayName: 'Zavorth Typed Subscription Simulator',
    trusted: true,
    enabled: true,
    supportedModes: ['dry-run', 'sandbox'],
    supportsLive: false,
    rawSecretsAccepted: false,
    credentialMode: 'future-vault-ref',
    requiresApprovalFor: ['subscription-create', 'subscription-cancel'],
    notes: ['Simulates subscription lifecycle payloads only.'],
  },
  {
    id: 'zavorth.connector.wallet.owner-gated',
    kind: 'wallet',
    displayName: 'Zavorth Owner-Gated Wallet Simulator',
    trusted: false,
    enabled: false,
    supportedModes: ['dry-run'],
    supportsLive: false,
    rawSecretsAccepted: false,
    credentialMode: 'vault-ref-required',
    requiresApprovalFor: ['asset-transfer', 'asset-withdrawal'],
    notes: ['Wallet value movement remains disabled until an owner-gated future phase.'],
  },
] as const;

type ConnectorRuntime = {
  connectors?: readonly ZavorthTransactionTypedConnectorDefinition[];
  now?: () => Date;
};

export class ZavorthTransactionConnectorRegistryService {
  private readonly connectors: readonly ZavorthTransactionTypedConnectorDefinition[];
  private readonly now: () => Date;

  public constructor(runtime: ConnectorRuntime = {}) {
    this.connectors = runtime.connectors ?? DEFAULT_CONNECTORS;
    this.now = runtime.now ?? (() => new Date());
  }

  public buildSnapshot(): ZavorthTransactionConnectorContractSnapshot {
    return buildZavorthTransactionConnectorContractSnapshot([...this.connectors]);
  }

  public listConnectors(): ZavorthTransactionTypedConnectorDefinition[] {
    return [...this.connectors];
  }

  public findConnector(input: {
    connectorId?: string;
    preview: ZavorthTransactionPreview;
  }): ZavorthTransactionTypedConnectorDefinition | null {
    if (input.connectorId) {
      return this.connectors.find((connector) => connector.id === input.connectorId) ?? null;
    }
    return this.connectors.find((connector) => connector.kind === input.preview.connector.kind) ?? null;
  }

  public run(input: ZavorthTransactionConnectorRunInput): ZavorthTransactionConnectorRunResult {
    const now = input.now ?? this.now();
    const mode = input.mode ?? 'dry-run';
    const connector = this.findConnector({
      connectorId: input.connectorId,
      preview: input.preview,
    });
    const credentialRef = sanitizeCredentialRef(input.credentialRef ?? null);
    const blockers = buildBlockers(input.preview, connector, mode, input.approvalEntry ?? null, credentialRef);
    const status: ZavorthTransactionConnectorRunStatus = blockers.length > 0 ? 'blocked' : 'simulated';
    const payload = status === 'simulated'
      ? buildPayload(input.preview, mode, credentialRef.value)
      : null;
    const policy = buildPolicySnapshot(input.preview, input.approvalEntry ?? null);
    const result: ZavorthTransactionConnectorRunResult = {
      version: ZAVORTH_TRANSACTION_CONNECTOR_CONTRACT_VERSION,
      id: buildRunId(input.preview, connector?.id ?? 'missing', mode, now),
      createdAt: now.toISOString(),
      status,
      mode,
      connector,
      previewId: input.preview.id,
      ...(input.preview.approval.approvalId ? { approvalId: input.preview.approval.approvalId } : {}),
      ...(input.approvalEntry?.id ? { approvalEntryId: input.approvalEntry.id } : {}),
      actionKind: input.preview.intent.actionKind,
      targetLabel: input.preview.intent.target.label,
      connectorKind: input.preview.connector.kind,
      payload,
      policy,
      blockers,
      receipts: buildReceipts(status, connector, mode, input.approvalEntry ?? null),
      externalSideEffects: false,
      liveActionApplied: false,
      liveExecutionAuthorized: false,
      executableNow: false,
      nextSteps: buildNextSteps(status, blockers),
    };

    return result;
  }

  public renderReport(result: ZavorthTransactionConnectorRunResult): string {
    return [
      '[transaction-connector] Connector registry typed connector dry-run',
      `[transaction-connector] status: ${result.status}`,
      `[transaction-connector] mode: ${result.mode}`,
      `[transaction-connector] connector: ${result.connector?.id ?? 'missing'}`,
      `[transaction-connector] action: ${result.actionKind}`,
      `[transaction-connector] target: ${result.targetLabel}`,
      `[transaction-connector] approval: ${result.approvalId ?? 'none'} (${result.policy.approvalStatus})`,
      `[transaction-connector] payload: ${result.payload ? result.payload.method : 'none'}`,
      `[transaction-connector] external-side-effects: ${result.externalSideEffects}`,
      `[transaction-connector] live-execution-authorized: ${result.liveExecutionAuthorized}`,
      `[transaction-connector] executable-now: ${result.executableNow}`,
      `[transaction-connector] live-action-applied: ${result.liveActionApplied}`,
      ...(result.blockers.length > 0 ? [`[transaction-connector] blockers: ${result.blockers.join(', ')}`] : []),
      ...result.nextSteps.map((step) => `[transaction-connector] next: ${step}`),
      ...result.receipts.map((receipt) => `[transaction-connector] receipt: ${receipt}`),
    ].join('\n');
  }
}

function buildBlockers(
  preview: ZavorthTransactionPreview,
  connector: ZavorthTransactionTypedConnectorDefinition | null,
  mode: ZavorthTransactionConnectorMode,
  approvalEntry: ZavorthTransactionApprovalLedgerEntry | null,
  credentialRef: { value: string | null; rawSecretDetected: boolean; invalidFormat: boolean },
): string[] {
  const blockers: string[] = [];
  if (preview.status !== 'ready-for-review') {
    blockers.push('preview_not_ready');
  }
  if (!connector) {
    blockers.push('typed_connector_missing');
  } else {
    if (!connector.enabled) {
      blockers.push('typed_connector_disabled');
    }
    if (!connector.supportedModes.includes(mode)) {
      blockers.push('connector_mode_unsupported');
    }
    if (connector.supportsLive !== false) {
      blockers.push('connector-registry_live_connector_forbidden');
    }
    if (connector.rawSecretsAccepted !== false) {
      blockers.push('raw_secret_accepting_connector_forbidden');
    }
  }
  if (credentialRef.rawSecretDetected) {
    blockers.push('raw_credential_ref_blocked');
  }
  if (credentialRef.invalidFormat) {
    blockers.push('credential_ref_format_invalid');
  }
  if (preview.approval.required) {
    if (!approvalEntry || approvalEntry.kind !== 'approval-granted' || approvalEntry.previewId !== preview.id) {
      blockers.push('approval_grant_required');
    }
  }
  if (approvalEntry && (approvalEntry.liveExecutionAuthorized !== false || approvalEntry.liveActionApplied !== false)) {
    blockers.push('approval_entry_live_effect_forbidden');
  }
  if (preview.policy.blockers.length > 0) {
    blockers.push('preview_policy_blocked');
  }
  return unique(blockers);
}

function buildPolicySnapshot(
  preview: ZavorthTransactionPreview,
  approvalEntry: ZavorthTransactionApprovalLedgerEntry | null,
): ZavorthTransactionConnectorPolicySnapshot {
  return {
    policyStatus: preview.policy.decision.status,
    riskLevel: preview.intent.riskLevel,
    approvalStatus: approvalEntry?.approvalStatus ?? preview.approval.status,
    approvalRequired: preview.approval.required,
    trustedConnectorRequired: preview.policy.decision.trustedConnectorRequired,
    typedConnectorRequired: preview.policy.decision.typedConnectorRequired,
    requiredControls: preview.policy.requiredControls,
    blockers: preview.policy.blockers,
  };
}

function buildPayload(
  preview: ZavorthTransactionPreview,
  mode: ZavorthTransactionConnectorMode,
  credentialRef: string | null,
): ZavorthTransactionConnectorPayload {
  return {
    method: `SIMULATE_${preview.intent.actionKind.toUpperCase().replace(/-/g, '_')}`,
    operation: preview.intent.actionKind,
    target: {
      kind: preview.intent.target.kind,
      label: preview.intent.target.label,
    },
    ...(preview.quote.amount !== undefined ? { amount: preview.quote.amount } : {}),
    ...(preview.quote.currency ? { currency: preview.quote.currency } : {}),
    conditions: preview.intent.conditions.map((condition) => condition.kind),
    idempotencyKey: buildIdempotencyKey(preview, mode),
    ...(credentialRef ? { credentialRef } : {}),
    redacted: true,
    rawSecretPresent: false,
  };
}

function buildReceipts(
  status: ZavorthTransactionConnectorRunStatus,
  connector: ZavorthTransactionTypedConnectorDefinition | null,
  mode: ZavorthTransactionConnectorMode,
  approvalEntry: ZavorthTransactionApprovalLedgerEntry | null,
): string[] {
  const receipts = [
    'transaction-connector-connector-registry-run-created',
    `transaction-connector-mode-${mode}`,
    'transaction-connector-no-external-side-effects',
    'transaction-connector-live-disabled',
  ];
  if (connector) {
    receipts.push(`transaction-connector-selected:${connector.id}`);
  }
  if (approvalEntry?.kind === 'approval-granted') {
    receipts.push(`transaction-connector-approval-verified:${approvalEntry.id}`);
  }
  receipts.push(status === 'simulated' ? 'transaction-connector-payload-simulated' : 'transaction-connector-run-blocked');
  return receipts;
}

function buildNextSteps(status: ZavorthTransactionConnectorRunStatus, blockers: string[]): string[] {
  if (status === 'simulated') {
    return ['Use the simulated payload for review, connector onboarding or future sandbox certification; no live call was made.'];
  }
  if (blockers.includes('approval_grant_required')) {
    return ['Approve the Preview engine preview through the Approval gate approval ledger before running a real-money dry-run.'];
  }
  if (blockers.includes('typed_connector_disabled')) {
    return ['Enable or replace the typed connector in a future owner-gated connector phase.'];
  }
  return ['Resolve blockers and rebuild the typed connector dry-run.'];
}

function buildRunId(
  preview: ZavorthTransactionPreview,
  connectorId: string,
  mode: ZavorthTransactionConnectorMode,
  now: Date,
): string {
  const hash = createHash('sha256')
    .update(`${now.toISOString()}:${preview.id}:${connectorId}:${mode}`)
    .digest('hex')
    .slice(0, 16);
  return `ztx-connector-${hash}`;
}

function buildIdempotencyKey(preview: ZavorthTransactionPreview, mode: ZavorthTransactionConnectorMode): string {
  return createHash('sha256')
    .update(`${preview.id}:${preview.intent.actionKind}:${preview.intent.target.label}:${mode}`)
    .digest('hex');
}

function sanitizeCredentialRef(value: string | null): { value: string | null; rawSecretDetected: boolean; invalidFormat: boolean } {
  if (!value) {
    return { value: null, rawSecretDetected: false, invalidFormat: false };
  }
  if (looksLikeSecret(value)) {
    return { value: '[REDACTED_CREDENTIAL_REF]', rawSecretDetected: true, invalidFormat: false };
  }
  const trimmed = value.trim();
  if (!isAllowedZavorthTransactionCredentialRef(trimmed)) {
    return { value: null, rawSecretDetected: false, invalidFormat: true };
  }
  return { value: trimmed, rawSecretDetected: false, invalidFormat: false };
}

function looksLikeSecret(value: string): boolean {
  return /\b(api[_-]?key|token|secret|private[_-]?key|senha|password)\b\s*[:=]/i.test(value)
    || /\b(sk-[A-Za-z0-9_-]{12,}|pk_live_[A-Za-z0-9_-]{12,}|rk_live_[A-Za-z0-9_-]{12,})\b/.test(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function isZavorthTransactionRealMoneyAction(actionKind: ZavorthTransactionActionKind): boolean {
  return ZAVORTH_TRANSACTION_REAL_MONEY_ACTIONS.includes(actionKind);
}
