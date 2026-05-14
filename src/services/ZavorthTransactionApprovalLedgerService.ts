import fs from 'node:fs';
import path from 'node:path';
import { createHash, createHmac } from 'node:crypto';

import {
  buildZavorthTransactionApprovalContractSnapshot,
  ZAVORTH_TRANSACTION_APPROVAL_CONTRACT_VERSION,
  type ZavorthTransactionApprovalActor,
  type ZavorthTransactionApprovalContractSnapshot,
  type ZavorthTransactionApprovalDecisionInput,
  type ZavorthTransactionApprovalLedgerEntry,
  type ZavorthTransactionApprovalLedgerEntryKind,
  type ZavorthTransactionApprovalLedgerSummary,
  type ZavorthTransactionApprovalQuoteSnapshot,
  type ZavorthTransactionApprovalSignatureSource,
} from '../contracts/ZavorthTransactionApprovalContract.js';
import type { ZavorthTransactionPreview } from '../contracts/ZavorthTransactionPreviewContract.js';
import { ZavorthTransactionPreviewService } from './ZavorthTransactionPreviewService.js';
import { resolveToolApprovalSigningKeyDetails } from '../security/ApprovalSigningKeyService.js';

type ApprovalLedgerRuntime = {
  ledgerFile?: string;
  signingKey?: string;
  now?: () => Date;
  previewService?: ZavorthTransactionPreviewService;
  fsImpl?: Pick<typeof fs, 'existsSync' | 'mkdirSync' | 'readFileSync' | 'appendFileSync'>;
};

type SigningMaterial = {
  key: string;
  source: ZavorthTransactionApprovalSignatureSource;
};

export class ZavorthTransactionApprovalLedgerService {
  private readonly ledgerFile: string;
  private readonly signingKey: string | null;
  private readonly now: () => Date;
  private readonly previewService: ZavorthTransactionPreviewService;
  private readonly fsImpl: Pick<typeof fs, 'existsSync' | 'mkdirSync' | 'readFileSync' | 'appendFileSync'>;

  public constructor(runtime: ApprovalLedgerRuntime = {}) {
    this.ledgerFile = runtime.ledgerFile ?? path.join(process.cwd(), 'data', 'runtime', 'zavorth-transaction-approval-ledger.jsonl');
    this.signingKey = runtime.signingKey ?? null;
    this.now = runtime.now ?? (() => new Date());
    this.previewService = runtime.previewService ?? new ZavorthTransactionPreviewService();
    this.fsImpl = runtime.fsImpl ?? fs;
  }

  public buildSnapshot(): ZavorthTransactionApprovalContractSnapshot {
    return buildZavorthTransactionApprovalContractSnapshot();
  }

  public buildPreviewFromText(input: { text: string; channel?: string }): ZavorthTransactionPreview {
    return this.previewService.buildPreview({
      text: input.text,
      channel: input.channel,
      now: this.now(),
    });
  }

  public recordPreview(preview: ZavorthTransactionPreview, actor: ZavorthTransactionApprovalActor = 'system'): ZavorthTransactionApprovalLedgerEntry {
    const entry = this.buildEntry({
      preview,
      kind: 'preview-recorded',
      actor,
      reason: preview.summary,
    });
    this.appendEntry(entry);
    return entry;
  }

  public decide(input: ZavorthTransactionApprovalDecisionInput): ZavorthTransactionApprovalLedgerEntry {
    const previousDecision = this.findLatestDecision(input.preview.approval.approvalId ?? input.preview.id);
    if (previousDecision) {
      const entry = this.buildEntry({
        preview: input.preview,
        kind: 'approval-blocked',
        actor: input.actor ?? 'owner',
        decision: 'rejected',
        reason: `Approval already decided by ${previousDecision.id}.`,
      });
      this.appendEntry(entry);
      return entry;
    }

    const blockedReason = approvalBlocker(input.preview);
    if (blockedReason) {
      const entry = this.buildEntry({
        preview: input.preview,
        kind: 'approval-blocked',
        actor: input.actor ?? 'owner',
        decision: 'rejected',
        reason: blockedReason,
      });
      this.appendEntry(entry);
      return entry;
    }

    const kind: ZavorthTransactionApprovalLedgerEntryKind =
      input.decision === 'approved' ? 'approval-granted' : 'approval-rejected';
    const entry = this.buildEntry({
      preview: input.preview,
      kind,
      actor: input.actor ?? 'owner',
      decision: input.decision,
      reason: input.reason ?? defaultDecisionReason(input.decision, input.preview),
    });
    this.appendEntry(entry);
    return entry;
  }

  public readLedger(): ZavorthTransactionApprovalLedgerEntry[] {
    if (!this.fsImpl.existsSync(this.ledgerFile)) {
      return [];
    }
    const raw = this.fsImpl.readFileSync(this.ledgerFile, 'utf8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ZavorthTransactionApprovalLedgerEntry);
  }

  public buildSummary(): ZavorthTransactionApprovalLedgerSummary {
    const entries = this.readLedger();
    const latest = entries.at(-1) ?? null;
    return {
      version: ZAVORTH_TRANSACTION_APPROVAL_CONTRACT_VERSION,
      ledgerFile: this.ledgerFile,
      entries: entries.length,
      previewsRecorded: entries.filter((entry) => entry.kind === 'preview-recorded').length,
      approvalsGranted: entries.filter((entry) => entry.kind === 'approval-granted').length,
      approvalsRejected: entries.filter((entry) => entry.kind === 'approval-rejected').length,
      approvalsBlocked: entries.filter((entry) => entry.kind === 'approval-blocked').length,
      liveActionsApplied: 0,
      executableEntries: 0,
      latestEntryId: latest?.id ?? null,
      latestEntryDigest: latest?.payloadDigest ?? null,
    };
  }

  public renderEntry(entry: ZavorthTransactionApprovalLedgerEntry): string {
    return [
      '[transaction-approval] Phase 3 approval ledger',
      `[transaction-approval] kind: ${entry.kind}`,
      `[transaction-approval] preview: ${entry.previewId}`,
      `[transaction-approval] approval: ${entry.approvalId ?? 'none'} (${entry.approvalStatus})`,
      `[transaction-approval] actor: ${entry.actor}`,
      `[transaction-approval] action: ${entry.actionKind}`,
      `[transaction-approval] target: ${entry.targetKind}:${entry.targetLabel}`,
      `[transaction-approval] connector: ${entry.connectorKind}`,
      `[transaction-approval] risk: ${entry.riskLevel}`,
      `[transaction-approval] policy: ${entry.policyStatus}`,
      `[transaction-approval] live-execution-authorized: ${entry.liveExecutionAuthorized}`,
      `[transaction-approval] executable-now: ${entry.executableNow}`,
      `[transaction-approval] live-action-applied: ${entry.liveActionApplied}`,
      `[transaction-approval] digest: ${entry.payloadDigest}`,
      `[transaction-approval] signature-source: ${entry.signatureSource}`,
      `[transaction-approval] reason: ${entry.reason}`,
    ].join('\n');
  }

  public renderSummary(summary: ZavorthTransactionApprovalLedgerSummary = this.buildSummary()): string {
    return [
      '[transaction-approval] Phase 3 approval ledger summary',
      `[transaction-approval] ledger: ${summary.ledgerFile}`,
      `[transaction-approval] entries: ${summary.entries}`,
      `[transaction-approval] previews-recorded: ${summary.previewsRecorded}`,
      `[transaction-approval] approvals-granted: ${summary.approvalsGranted}`,
      `[transaction-approval] approvals-rejected: ${summary.approvalsRejected}`,
      `[transaction-approval] approvals-blocked: ${summary.approvalsBlocked}`,
      `[transaction-approval] executable-entries: ${summary.executableEntries}`,
      `[transaction-approval] live-actions-applied: ${summary.liveActionsApplied}`,
      `[transaction-approval] latest-entry: ${summary.latestEntryId ?? 'none'}`,
    ].join('\n');
  }

  private buildEntry(input: {
    preview: ZavorthTransactionPreview;
    kind: ZavorthTransactionApprovalLedgerEntryKind;
    actor: ZavorthTransactionApprovalActor;
    decision?: 'approved' | 'rejected';
    reason: string;
  }): ZavorthTransactionApprovalLedgerEntry {
    const previousEntryDigest = this.readLedger().at(-1)?.payloadDigest;
    const createdAt = this.now().toISOString();
    const approvalStatus = approvalStatusForKind(input.kind);
    const base = {
      version: ZAVORTH_TRANSACTION_APPROVAL_CONTRACT_VERSION,
      id: buildApprovalEntryId(input.preview, input.kind, createdAt, input.reason),
      createdAt,
      kind: input.kind,
      previewId: input.preview.id,
      ...(input.preview.approval.approvalId ? { approvalId: input.preview.approval.approvalId } : {}),
      actor: input.actor,
      ...(input.decision ? { decision: input.decision } : {}),
      approvalStatus,
      reason: sanitizeLedgerText(input.reason),
      previewStatus: input.preview.status,
      actionKind: input.preview.intent.actionKind,
      targetLabel: sanitizeLedgerText(input.preview.intent.target.label),
      targetKind: input.preview.intent.target.kind,
      riskLevel: input.preview.intent.riskLevel,
      connectorKind: input.preview.connector.kind,
      quote: quoteSnapshot(input.preview),
      policyStatus: input.preview.policy.decision.status,
      policyBlockers: input.preview.policy.blockers.map(sanitizeLedgerText),
      liveActionApplied: false,
      executableNow: false,
      liveExecutionAuthorized: false,
      ...(previousEntryDigest ? { previousEntryDigest } : {}),
      receipts: [
        'transaction-approval-ledger-entry-created',
        `transaction-approval-${input.kind}`,
        'transaction-approval-no-live-execution',
      ],
    } satisfies Omit<ZavorthTransactionApprovalLedgerEntry, 'payloadDigest' | 'signature' | 'signatureSource'>;
    const payloadDigest = digestPayload(base);
    const signing = this.resolveSigningMaterial();
    return {
      ...base,
      payloadDigest,
      signature: signDigest(payloadDigest, signing.key),
      signatureSource: signing.source,
    };
  }

  private appendEntry(entry: ZavorthTransactionApprovalLedgerEntry): void {
    this.fsImpl.mkdirSync(path.dirname(this.ledgerFile), { recursive: true });
    this.fsImpl.appendFileSync(this.ledgerFile, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  private findLatestDecision(approvalIdOrPreviewId: string): ZavorthTransactionApprovalLedgerEntry | null {
    const entries = this.readLedger();
    return [...entries].reverse().find((entry) => {
      const sameApproval = entry.approvalId === approvalIdOrPreviewId || entry.previewId === approvalIdOrPreviewId;
      return sameApproval && ['approval-granted', 'approval-rejected'].includes(entry.kind);
    }) ?? null;
  }

  private resolveSigningMaterial(): SigningMaterial {
    if (this.signingKey) {
      return {
        key: this.signingKey,
        source: 'injected-test-key',
      };
    }

    const envKey = String(process.env.ZAVORTH_TRANSACTION_APPROVAL_SIGNING_KEY || '').trim();
    if (envKey.length >= 32) {
      return {
        key: envKey,
        source: 'env',
      };
    }

    const resolved = resolveToolApprovalSigningKeyDetails();
    return {
      key: resolved.key,
      source: resolved.source,
    };
  }
}

function approvalBlocker(preview: ZavorthTransactionPreview): string | null {
  if (preview.status !== 'ready-for-review') {
    return `Preview status ${preview.status} cannot be approved.`;
  }
  if (!preview.approval.required) {
    return 'Preview does not require approval.';
  }
  if (!preview.validation.canAskApproval) {
    return 'Preview validation does not allow approval request.';
  }
  if (preview.policy.blockers.length > 0) {
    return `Policy blockers prevent approval: ${preview.policy.blockers.join(', ')}.`;
  }
  return null;
}

function defaultDecisionReason(decision: 'approved' | 'rejected', preview: ZavorthTransactionPreview): string {
  return decision === 'approved'
    ? `Operator approved preview ${preview.id}; live execution remains unauthorized in Phase 3.`
    : `Operator rejected preview ${preview.id}.`;
}

function approvalStatusForKind(kind: ZavorthTransactionApprovalLedgerEntryKind): 'none' | 'pending' | 'approved' | 'rejected' {
  if (kind === 'approval-granted') {
    return 'approved';
  }
  if (kind === 'approval-rejected' || kind === 'approval-blocked') {
    return 'rejected';
  }
  return 'pending';
}

function quoteSnapshot(preview: ZavorthTransactionPreview): ZavorthTransactionApprovalQuoteSnapshot {
  return {
    ...(preview.quote.amount !== undefined ? { amount: preview.quote.amount } : {}),
    ...(preview.quote.currency ? { currency: preview.quote.currency } : {}),
    quoteStatus: preview.quote.status,
    feeStatus: preview.quote.feeStatus,
  };
}

function buildApprovalEntryId(
  preview: ZavorthTransactionPreview,
  kind: ZavorthTransactionApprovalLedgerEntryKind,
  createdAt: string,
  reason: string,
): string {
  const hash = createHash('sha256')
    .update(`${createdAt}:${preview.id}:${kind}:${reason}`)
    .digest('hex')
    .slice(0, 16);
  return `ztx-approval-${hash}`;
}

function digestPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function signDigest(digest: string, signingKey: string): string {
  return createHmac('sha256', signingKey).update(digest).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sanitizeLedgerText(text: string): string {
  return text
    .replace(/\b(api[_-]?key|token|secret|private[_-]?key|senha|password)\b\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9_-]{12,}|pk_live_[A-Za-z0-9_-]{12,}|rk_live_[A-Za-z0-9_-]{12,})\b/g, '[REDACTED_SECRET]');
}
