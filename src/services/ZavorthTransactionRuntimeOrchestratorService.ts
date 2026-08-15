import { createHash } from 'node:crypto';
import { ZavorthTransactionApprovalLedgerService } from './ZavorthTransactionApprovalLedgerService.js';

import {
  buildZavorthTransactionRuntimeContractSnapshot,
  ZAVORTH_TRANSACTION_RUNTIME_CONTRACT_VERSION,
  type ZavorthTransactionRuntimeContractSnapshot,
  type ZavorthTransactionRuntimeRunInput,
  type ZavorthTransactionRuntimeRunResult,
  type ZavorthTransactionRuntimeStageReceipt,
  type ZavorthTransactionRuntimeStatus,
} from '../contracts/ZavorthTransactionRuntimeContract.js';
import type { ZavorthTransactionApprovalLedgerEntry } from '../contracts/ZavorthTransactionApprovalContract.js';
import type { ZavorthTransactionConnectorMode } from '../contracts/ZavorthTransactionConnectorContract.js';
import type { ZavorthTransactionCredentialValidationResult } from '../contracts/ZavorthTransactionCredentialContract.js';

import { ZavorthTransactionConnectorRegistryService } from './ZavorthTransactionConnectorRegistryService.js';
import { ZavorthTransactionCredentialRefService } from './ZavorthTransactionCredentialRefService.js';
import { ZavorthTransactionPreviewService } from './ZavorthTransactionPreviewService.js';

type RuntimeDeps = {
  now?: () => Date;
  previewService?: ZavorthTransactionPreviewService;
  approvalLedger?: ZavorthTransactionApprovalLedgerService;
  credentialRefs?: ZavorthTransactionCredentialRefService;
  connectorRegistry?: ZavorthTransactionConnectorRegistryService;
};

export class ZavorthTransactionRuntimeOrchestratorService {
  private readonly now: () => Date;
  private readonly previewService: ZavorthTransactionPreviewService;
  private readonly approvalLedger: ZavorthTransactionApprovalLedgerService;
  private readonly credentialRefs: ZavorthTransactionCredentialRefService;
  private readonly connectorRegistry: ZavorthTransactionConnectorRegistryService;

  public constructor(deps: RuntimeDeps = {}) {
    this.now = deps.now ?? (() => new Date());
    this.previewService = deps.previewService ?? new ZavorthTransactionPreviewService();
    this.approvalLedger = deps.approvalLedger ?? new ZavorthTransactionApprovalLedgerService();
    this.credentialRefs = deps.credentialRefs ?? new ZavorthTransactionCredentialRefService();
    this.connectorRegistry = deps.connectorRegistry ?? new ZavorthTransactionConnectorRegistryService();
  }

  public buildSnapshot(): ZavorthTransactionRuntimeContractSnapshot {
    return buildZavorthTransactionRuntimeContractSnapshot();
  }

  public run(input: ZavorthTransactionRuntimeRunInput): ZavorthTransactionRuntimeRunResult {
    const now = this.now();
    const mode = input.mode ?? 'dry-run';
    const preview = this.previewService.buildPreview({
      text: input.text,
      kind: input.kind,
      actionKind: input.actionKind,
      targetKind: input.targetKind,
      channel: input.channel ?? 'transaction-runtime',
      now,
    });
    const phaseReceipts: ZavorthTransactionRuntimeStageReceipt[] = [
      {
        phase: 'intent',
        status: preview.intent.kind,
        receiptIds: [preview.intent.intentId],
      },
      {
        phase: 'preview',
        status: preview.status,
        receiptIds: preview.receipts.map((receipt) => receipt.id),
      },
    ];
    const blockers: string[] = [];
    const warnings: string[] = [];
    let previewEntry: ZavorthTransactionApprovalLedgerEntry | undefined;
    let approvalEntry: ZavorthTransactionApprovalLedgerEntry | undefined;
    let credentialValidation: ZavorthTransactionCredentialValidationResult | undefined;

    if (preview.status !== 'ready-for-review') {
      blockers.push(preview.status === 'needs-clarification' ? 'preview_needs_clarification' : 'preview_blocked');
      return this.finish({
        input,
        now,
        mode,
        preview,
        status: preview.status === 'needs-clarification' ? 'needs-clarification' : 'blocked',
        blockers,
        warnings,
        phaseReceipts,
      });
    }

    previewEntry = this.approvalLedger.recordPreview(preview, 'system');
    phaseReceipts.push({
      phase: 'approval-ledger',
      status: previewEntry.kind,
      receiptIds: [previewEntry.id],
    });

    if (preview.approval.required) {
      if (input.reject === true) {
        approvalEntry = this.approvalLedger.decide({
          preview,
          decision: 'rejected',
          actor: 'owner',
          reason: 'Rejected by Runtime gateway runtime input.',
        });
        blockers.push('approval_rejected');
      } else if (input.approve === true) {
        approvalEntry = this.approvalLedger.decide({
          preview,
          decision: 'approved',
          actor: 'owner',
          reason: 'Approved by Runtime gateway runtime input for dryRun only.',
        });
        if (approvalEntry.kind !== 'approval-granted') {
          blockers.push('approval_not_granted');
        }
      } else {
        blockers.push('approval_required');
      }
      if (approvalEntry) {
        phaseReceipts.push({
          phase: 'approval-ledger',
          status: approvalEntry.kind,
          receiptIds: [approvalEntry.id],
        });
      }
    }

    const connector = this.connectorRegistry.findConnector({
      connectorId: input.connectorId,
      preview,
    });
    const credentialRequired = input.requireCredential === true || connector?.credentialMode === 'vault-ref-required';
    if (input.credentialRef) {
      credentialValidation = this.credentialRefs.validate({
        ref: input.credentialRef,
        connectorKind: preview.connector.kind,
        actionKind: preview.intent.actionKind,
        now,
      });
      phaseReceipts.push({
        phase: 'credential-validation',
        status: credentialValidation.status,
        receiptIds: credentialValidation.receipts,
      });
      if (!credentialValidation.canUseForConnectorRun) {
        blockers.push(...credentialValidation.blockers);
      }
      warnings.push(...credentialValidation.warnings);
    } else if (credentialRequired) {
      blockers.push('credential_ref_required');
      phaseReceipts.push({
        phase: 'credential-validation',
        status: 'missing',
        receiptIds: ['transaction-runtime-credential-ref-required'],
      });
    }

    if (blockers.length > 0) {
      return this.finish({
        input,
        now,
        mode,
        preview,
        previewEntry,
        approvalEntry,
        credentialValidation,
        status: resolveBlockedStatus(blockers),
        blockers,
        warnings,
        phaseReceipts,
      });
    }

    const connectorRun = this.connectorRegistry.run({
      preview,
      approvalEntry,
      connectorId: input.connectorId,
      mode,
      credentialRef: credentialValidation?.canUseForConnectorRun
        ? credentialValidation.ref
        : (input.credentialRef ?? null),
      now,
    });
    phaseReceipts.push({
      phase: 'typed-connector',
      status: connectorRun.status,
      receiptIds: connectorRun.receipts,
    });

    if (connectorRun.status === 'blocked') {
      blockers.push(...connectorRun.blockers);
    }

    return this.finish({
      input,
      now,
      mode,
      preview,
      previewEntry,
      approvalEntry,
      credentialValidation,
      connectorRun,
      status: connectorRun.status === 'dryRun' ? 'simulated' : 'blocked',
      blockers,
      warnings,
      phaseReceipts,
    });
  }

  public renderReport(result: ZavorthTransactionRuntimeRunResult): string {
    return [
      '[transaction-runtime] Runtime gateway transaction runtime',
      `[transaction-runtime] status: ${result.status}`,
      `[transaction-runtime] mode: ${result.mode}`,
      `[transaction-runtime] action: ${result.preview.intent.actionKind}`,
      `[transaction-runtime] target: ${result.preview.intent.target.kind}:${result.preview.intent.target.label}`,
      `[transaction-runtime] preview: ${result.preview.status}`,
      `[transaction-runtime] approval-entry: ${result.approvalEntry?.kind ?? 'none'}`,
      `[transaction-runtime] credential: ${result.credentialValidation?.status ?? 'not-provided'}`,
      `[transaction-runtime] connector: ${result.connectorRun?.status ?? 'not-run'}`,
      `[transaction-runtime] external-side-effects: ${result.externalSideEffects}`,
      `[transaction-runtime] live-execution-authorized: ${result.liveExecutionAuthorized}`,
      `[transaction-runtime] executable-now: ${result.executableNow}`,
      `[transaction-runtime] live-action-applied: ${result.liveActionApplied}`,
      ...(result.blockers.length > 0 ? [`[transaction-runtime] blockers: ${result.blockers.join(', ')}`] : []),
      ...(result.warnings.length > 0 ? [`[transaction-runtime] warnings: ${result.warnings.join(' | ')}`] : []),
      ...result.nextSteps.map((step) => `[transaction-runtime] next: ${step}`),
    ].join('\n');
  }

  private finish(input: {
    input: ZavorthTransactionRuntimeRunInput;
    now: Date;
    mode: ZavorthTransactionConnectorMode;
    preview: ReturnType<ZavorthTransactionPreviewService['buildPreview']>;
    previewEntry?: ZavorthTransactionApprovalLedgerEntry;
    approvalEntry?: ZavorthTransactionApprovalLedgerEntry;
    credentialValidation?: ZavorthTransactionCredentialValidationResult;
    connectorRun?: ReturnType<ZavorthTransactionConnectorRegistryService['run']>;
    status: ZavorthTransactionRuntimeStatus;
    blockers: string[];
    warnings: string[];
    phaseReceipts: ZavorthTransactionRuntimeStageReceipt[];
  }): ZavorthTransactionRuntimeRunResult {
    const blockers = unique(input.blockers);
    return {
      version: ZAVORTH_TRANSACTION_RUNTIME_CONTRACT_VERSION,
      id: buildRuntimeId(input.input.text, input.mode, input.now),
      createdAt: input.now.toISOString(),
      status: input.status,
      text: sanitizeText(input.input.text),
      mode: input.mode,
      preview: input.preview,
      ...(input.previewEntry ? { previewEntry: input.previewEntry } : {}),
      ...(input.approvalEntry ? { approvalEntry: input.approvalEntry } : {}),
      ...(input.credentialValidation ? { credentialValidation: input.credentialValidation } : {}),
      ...(input.connectorRun ? { connectorRun: input.connectorRun } : {}),
      blockers,
      warnings: unique(input.warnings),
      phaseReceipts: input.phaseReceipts,
      nextSteps: buildNextSteps(input.status, blockers),
      externalSideEffects: false,
      liveActionApplied: false,
      liveExecutionAuthorized: false,
      executableNow: false,
    };
  }
}

function resolveBlockedStatus(blockers: string[]): ZavorthTransactionRuntimeStatus {
  if (blockers.includes('approval_required')) {
    return 'approval-required';
  }
  if (blockers.includes('credential_ref_required') || blockers.includes('credential_ref_missing')) {
    return 'credential-required';
  }
  if (blockers.includes('preview_needs_clarification')) {
    return 'needs-clarification';
  }
  return 'blocked';
}

function buildNextSteps(status: ZavorthTransactionRuntimeStatus, blockers: string[]): string[] {
  if (status === 'simulated') {
    return ['Review the full runtime receipt; no live transaction was executed.'];
  }
  if (status === 'approval-required') {
    return ['Request explicit approval, then rerun in approve mode for dryRun only.'];
  }
  if (status === 'credential-required') {
    return ['Register or provide a valid transaction credential ref before connector dry-run.'];
  }
  if (status === 'needs-clarification') {
    return ['Clarify the target, amount, limit or condition before rebuilding the runtime run.'];
  }
  if (blockers.includes('approval_rejected')) {
    return ['The operator rejected this transaction preview; do not continue without a new preview.'];
  }
  return ['Resolve blockers and rebuild the transaction runtime run.'];
}

function buildRuntimeId(text: string, mode: ZavorthTransactionConnectorMode, now: Date): string {
  const hash = createHash('sha256').update(`${now.toISOString()}:${mode}:${text}`).digest('hex').slice(0, 16);
  return `ztx-runtime-${hash}`;
}

function sanitizeText(text: string): string {
  return text
    .replace(/\b(api[_-]?key|token|secret|private[_-]?key|senha|password)\b\s*[:=]\s*([^\s,;]+)/gi, '$1=[REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9_-]{12}|pk_live_[A-Za-z0-9_-]{12}|rk_live_[A-Za-z0-9_-]{12})\b/g, '[REDACTED_SECRET]');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
