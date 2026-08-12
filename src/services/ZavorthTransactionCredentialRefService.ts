import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  buildZavorthTransactionCredentialContractSnapshot,
  ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION,
  type ZavorthTransactionCredentialContractSnapshot,
  type ZavorthTransactionCredentialEnvironment,
  type ZavorthTransactionCredentialRefRecord,
  type ZavorthTransactionCredentialRegisterInput,
  type ZavorthTransactionCredentialRegisterResult,
  type ZavorthTransactionCredentialStoreSummary,
  type ZavorthTransactionCredentialValidationInput,
  type ZavorthTransactionCredentialValidationResult,
} from '../contracts/ZavorthTransactionCredentialContract.js';

import type {
  ZavorthTransactionActionKind,
} from '../contracts/ZavorthTransactionPlaneContract.js';
import type {
  ZavorthTransactionConnectorKind,
} from '../contracts/ZavorthTransactionPreviewContract.js';

type CredentialRuntime = {
  storeFile?: string;
  now?: () => Date;
  fsImpl?: Pick<typeof fs, 'existsSync' | 'mkdirSync' | 'readFileSync' | 'appendFileSync'>;
};

export class ZavorthTransactionCredentialRefService {
  private readonly storeFile: string;
  private readonly now: () => Date;
  private readonly fsImpl: Pick<typeof fs, 'existsSync' | 'mkdirSync' | 'readFileSync' | 'appendFileSync'>;

  public constructor(runtime: CredentialRuntime = {}) {
    this.storeFile = runtime.storeFile ?? path.join(process.cwd(), 'data', 'runtime', 'zavorth-transaction-credential-refs.jsonl');
    this.now = runtime.now ?? (() => new Date());
    this.fsImpl = runtime.fsImpl ?? fs;
  }

  public buildSnapshot(): ZavorthTransactionCredentialContractSnapshot {
    return buildZavorthTransactionCredentialContractSnapshot();
  }

  public register(input: ZavorthTransactionCredentialRegisterInput): ZavorthTransactionCredentialRegisterResult {
    const now = input.now ?? this.now();
    const blockers = registerBlockers(input);
    if (blockers.length > 0) {
      return {
        version: ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION,
        status: 'blocked',
        blockers,
        warnings: ['Credential reference was not written because raw secret or invalid metadata was detected.'],
        rawSecretSerialized: false,
      };
    }

    const environment = input.environment ?? 'dry-run';
    const allowedActions = input.allowedActions?.length ? input.allowedActions : defaultActionsForConnector(input.connectorKind);
    const ref = input.ref ?? buildCredentialRef(input.connectorKind, input.label, now);
    const recordBase = {
      version: ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION,
      id: buildRecordId(ref, now),
      createdAt: now.toISOString(),
      status: 'registered' as const,
      ref,
      label: sanitizeLabel(input.label),
      connectorKind: input.connectorKind,
      ...(input.connectorId ? { connectorId: sanitizeLabel(input.connectorId) } : {}),
      environment,
      allowedActions,
      ownerApproved: input.ownerApproved === true,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      storageKind: 'external-vault-ref' as const,
      rawSecretStored: false as const,
      rawSecretSerialized: false as const,
      valueReadableByLlm: false as const,
      valueSerialized: false as const,
      receipts: [
        'transaction-credential-ref-registered',
        'transaction-credential-no-raw-secret-stored',
        `transaction-credential-environment-${environment}`,
      ],
    };
    const record: ZavorthTransactionCredentialRefRecord = {
      ...recordBase,
      payloadDigest: digestPayload(recordBase),
    };
    this.appendRecord(record);
    return {
      version: ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION,
      status: 'registered',
      record,
      blockers: [],
      warnings: environment === 'live-candidate'
        ? ['Live-candidate credential ref is metadata only and does not authorize live execution.']
        : [],
      rawSecretSerialized: false,
    };
  }

  public validate(input: ZavorthTransactionCredentialValidationInput): ZavorthTransactionCredentialValidationResult {
    const now = input.now ?? this.now();
    const rawSecret = looksLikeRawSecret(input.ref);
    if (rawSecret) {
      return {
        version: ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION,
        status: 'blocked',
        ref: '[REDACTED_CREDENTIAL_REF]',
        connectorKind: input.connectorKind,
        actionKind: input.actionKind,
        canUseForConnectorRun: false,
        blockers: ['raw_credential_value_blocked'],
        warnings: [],
        rawSecretSerialized: false,
        valueReadableByLlm: false,
        receipts: ['transaction-credential-validation-blocked'],
      };
    }

    if (!isAllowedCredentialRef(input.ref)) {
      return {
        version: ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION,
        status: 'blocked',
        ref: sanitizeCredentialRefForOutput(input.ref),
        connectorKind: input.connectorKind,
        actionKind: input.actionKind,
        canUseForConnectorRun: false,
        blockers: ['credential_ref_format_invalid'],
        warnings: ['Use vault://zavorth/transaction/... or <SecretRef:...> references.'],
        rawSecretSerialized: false,
        valueReadableByLlm: false,
        receipts: ['transaction-credential-validation-blocked'],
      };
    }

    const record = this.findByRef(input.ref);
    if (!record) {
      return {
        version: ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION,
        status: 'missing',
        ref: input.ref,
        connectorKind: input.connectorKind,
        actionKind: input.actionKind,
        canUseForConnectorRun: false,
        blockers: ['credential_ref_missing'],
        warnings: [],
        rawSecretSerialized: false,
        valueReadableByLlm: false,
        receipts: ['transaction-credential-validation-missing'],
      };
    }

    const blockers: string[] = [];
    if (record.status !== 'registered') {
      blockers.push('credential_ref_not_registered');
    }
    if (record.connectorKind !== input.connectorKind) {
      blockers.push('credential_connector_kind_mismatch');
    }
    if (!record.allowedActions.includes(input.actionKind)) {
      blockers.push('credential_action_not_allowed');
    }
    if (record.expiresAt && new Date(record.expiresAt).getTime() <= now.getTime()) {
      blockers.push('credential_ref_expired');
    }

    const status = blockers.includes('credential_ref_expired') ? 'expired'
      : blockers.some((blocker) => blocker.includes('mismatch') || blocker.includes('not_allowed')) ? 'mismatch'
        : blockers.length > 0
          ? 'blocked'
          : 'ready';

    return {
      version: ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION,
      status,
      ref: record.ref,
      record,
      connectorKind: input.connectorKind,
      actionKind: input.actionKind,
      canUseForConnectorRun: status === 'ready',
      blockers,
      warnings: record.ownerApproved ? [] : ['Credential ref is not owner-approved for future live-candidate use.'],
      rawSecretSerialized: false,
      valueReadableByLlm: false,
      receipts: [
        `transaction-credential-validation-${status}`,
        'transaction-credential-value-not-readable',
      ],
    };
  }

  public readRecords(): ZavorthTransactionCredentialRefRecord[] {
    if (!this.fsImpl.existsSync(this.storeFile)) {
      return [];
    }
    const raw = this.fsImpl.readFileSync(this.storeFile, 'utf8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ZavorthTransactionCredentialRefRecord);
  }

  public buildSummary(): ZavorthTransactionCredentialStoreSummary {
    const records = this.readRecords();
    const latest = records.at(-1) ?? null;
    return {
      version: ZAVORTH_TRANSACTION_CREDENTIAL_CONTRACT_VERSION,
      storeFile: this.storeFile,
      records: records.length,
      registered: records.filter((record) => record.status === 'registered').length,
      blocked: records.filter((record) => record.status === 'blocked').length,
      rawSecretStored: false,
      rawSecretSerialized: false,
      latestRecordId: latest?.id ?? null,
    };
  }

  public renderRegister(result: ZavorthTransactionCredentialRegisterResult): string {
    const record = result.record;
    return [
      '[transaction-credential] Credential vault credential ref',
      `[transaction-credential] status: ${result.status}`,
      `[transaction-credential] ref: ${record?.ref ?? 'none'}`,
      `[transaction-credential] connector: ${record?.connectorKind ?? 'none'}`,
      `[transaction-credential] environment: ${record?.environment ?? 'none'}`,
      `[transaction-credential] raw-secret-stored: false`,
      `[transaction-credential] raw-secret-serialized: false`,
      ...(result.blockers.length ? [`[transaction-credential] blockers: ${result.blockers.join(', ')}`] : []),
      ...(result.warnings.length ? [`[transaction-credential] warnings: ${result.warnings.join(' | ')}`] : []),
    ].join('\n');
  }

  public renderValidation(result: ZavorthTransactionCredentialValidationResult): string {
    return [
      '[transaction-credential] Credential vault credential validation',
      `[transaction-credential] status: ${result.status}`,
      `[transaction-credential] ref: ${result.ref}`,
      `[transaction-credential] connector: ${result.connectorKind}`,
      `[transaction-credential] action: ${result.actionKind}`,
      `[transaction-credential] can-use-for-connector-run: ${result.canUseForConnectorRun}`,
      `[transaction-credential] value-readable-by-llm: ${result.valueReadableByLlm}`,
      `[transaction-credential] raw-secret-serialized: ${result.rawSecretSerialized}`,
      ...(result.blockers.length ? [`[transaction-credential] blockers: ${result.blockers.join(', ')}`] : []),
      ...(result.warnings.length ? [`[transaction-credential] warnings: ${result.warnings.join(' | ')}`] : []),
    ].join('\n');
  }

  public renderSummary(summary: ZavorthTransactionCredentialStoreSummary = this.buildSummary()): string {
    return [
      '[transaction-credential] Credential vault credential store summary',
      `[transaction-credential] store: ${summary.storeFile}`,
      `[transaction-credential] records: ${summary.records}`,
      `[transaction-credential] registered: ${summary.registered}`,
      `[transaction-credential] blocked: ${summary.blocked}`,
      `[transaction-credential] raw-secret-stored: ${summary.rawSecretStored}`,
      `[transaction-credential] raw-secret-serialized: ${summary.rawSecretSerialized}`,
      `[transaction-credential] latest-record: ${summary.latestRecordId ?? 'none'}`,
    ].join('\n');
  }

  private appendRecord(record: ZavorthTransactionCredentialRefRecord): void {
    this.fsImpl.mkdirSync(path.dirname(this.storeFile), { recursive: true });
    this.fsImpl.appendFileSync(this.storeFile, `${JSON.stringify(record)}\n`, 'utf8');
  }

  private findByRef(ref: string): ZavorthTransactionCredentialRefRecord | null {
    return [...this.readRecords()].reverse().find((record) => record.ref === ref) ?? null;
  }
}

export function isAllowedZavorthTransactionCredentialRef(ref: string): boolean {
  return isAllowedCredentialRef(ref);
}

function registerBlockers(input: ZavorthTransactionCredentialRegisterInput): string[] {
  const blockers: string[] = [];
  if (!input.label.trim()) {
    blockers.push('credential_label_required');
  }
  if (input.secretValue && looksLikeRawSecret(input.secretValue)) {
    blockers.push('raw_secret_value_blocked');
  }
  if (input.ref) {
    if (looksLikeRawSecret(input.ref)) {
      blockers.push('raw_credential_ref_blocked');
    } else if (!isAllowedCredentialRef(input.ref)) {
      blockers.push('credential_ref_format_invalid');
    }
  }
  if (input.expiresAt && Number.isNaN(new Date(input.expiresAt).getTime())) {
    blockers.push('credential_expiry_invalid');
  }
  return [...new Set(blockers)];
}

function buildCredentialRef(connectorKind: ZavorthTransactionConnectorKind, label: string, now: Date): string {
  const slug = slugify(label);
  const hash = createHash('sha256').update(`${connectorKind}:${label}:${now.toISOString()}`).digest('hex').slice(0, 12);
  return `vault://zavorth/transaction/${connectorKind}/${slug}-${hash}`;
}

function buildRecordId(ref: string, now: Date): string {
  const hash = createHash('sha256').update(`${ref}:${now.toISOString()}`).digest('hex').slice(0, 16);
  return `ztx-credential-${hash}`;
}

function defaultActionsForConnector(connectorKind: ZavorthTransactionConnectorKind): ZavorthTransactionActionKind[] {
  switch (connectorKind) {
    case 'market-data':
      return ['market-data-read', 'price-monitor', 'cart-preview'];
    case 'commerce':
      return ['purchase-submit', 'api-credit-purchase'];
    case 'payment':
      return ['payment-submit', 'refund-request', 'mandate-create', 'mandate-revoke'];
    case 'exchange':
      return ['trade-order', 'trade-cancel'];
    case 'currency-exchange':
      return ['currency-conversion'];
    case 'subscription':
      return ['subscription-create', 'subscription-cancel'];
    case 'wallet':
      return ['asset-transfer', 'asset-withdrawal'];
    default:
      return [];
  }
}

function digestPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function sanitizeLabel(value: string): string {
  return value
    .replace(/\b(api[_-]?key|token|secret|private[_-]?key|senha|password)\b\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9_-]{12,}|pk_live_[A-Za-z0-9_-]{12,}|rk_live_[A-Za-z0-9_-]{12,})\b/g, '[REDACTED_SECRET]')
    .trim();
}

function sanitizeCredentialRefForOutput(ref: string): string {
  return looksLikeRawSecret(ref) ? '[REDACTED_CREDENTIAL_REF]' : ref.trim();
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'credential';
}

function isAllowedCredentialRef(ref: string): boolean {
  const trimmed = ref.trim();
  return /^vault:\/\/zavorth\/transaction\/[a-z-]+\/[a-z0-9._-]+$/i.test(trimmed)
    || /^<SecretRef:[A-Za-z0-9._:/-]+>$/.test(trimmed);
}

function looksLikeRawSecret(value: string): boolean {
  return /\b(api[_-]?key|token|secret|private[_-]?key|senha|password)\b\s*[:=]/i.test(value)
    || /\b(sk-[A-Za-z0-9_-]{12,}|pk_live_[A-Za-z0-9_-]{12,}|rk_live_[A-Za-z0-9_-]{12,})\b/.test(value);
}
