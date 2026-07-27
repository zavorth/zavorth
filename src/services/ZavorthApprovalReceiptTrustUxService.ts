import {
  ZAVORTH_APPROVAL_RECEIPT_TRUST_UX_CONTRACT_VERSION,
  type ZavorthApprovalReceiptTrustUxSnapshot,
} from '../contracts/ZavorthApprovalReceiptTrustUxContract.js';
import type { ZavorthApprovalActionCardsUxSnapshot } from '../contracts/ZavorthApprovalActionCardsUxContract.js';
import type { ZavorthVisualReceiptUxSnapshot } from '../contracts/ZavorthVisualReceiptUxContract.js';

export type ZavorthApprovalReceiptTrustUxRuntime = {
  now?: () => Date;
};

export class ZavorthApprovalReceiptTrustUxService {
  private readonly now: () => Date;

  constructor(runtime: ZavorthApprovalReceiptTrustUxRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: {
    approvalCards: ZavorthApprovalActionCardsUxSnapshot;
    visualReceipts: ZavorthVisualReceiptUxSnapshot;
  }): ZavorthApprovalReceiptTrustUxSnapshot {
    const pendingApprovals = input.approvalCards.summary.pending;
    const highRiskApprovals = input.approvalCards.summary.highRisk;
    const rollbackAvailable = Math.max(
      input.approvalCards.summary.rollbackAvailable,
      input.visualReceipts.summary.rollbackAvailable,
    );
    const status = highRiskApprovals > 0
      ? 'blocked'
      : pendingApprovals > 0 || input.visualReceipts.status === 'attention'
        ? 'attention'
        : 'ready';

    return sanitizeValue({
      contractVersion: ZAVORTH_APPROVAL_RECEIPT_TRUST_UX_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'approval-receipt-trust-ux',
      generatedAt: this.now().toISOString(),
      status,
      summary: {
        pendingApprovals,
        receiptCards: input.visualReceipts.summary.totalReceipts,
        highRiskApprovals,
        rollbackAvailable,
        rawSecretsSerialized: false,
      },
      simpleMode: buildSimpleMode(pendingApprovals, highRiskApprovals, rollbackAvailable),
      advancedMode: {
        visibleByDefault: false,
        policyBrokerRequired: true,
        trustPlaneActive: true,
        exactScopeRequired: true,
        receiptRequired: true,
        rollbackEvidenceRequiredForMutations: true,
      },
      decisionFlow: {
        previewFirst: true,
        approveOnceEndpoint: '/api/v1/approvals/:id/approve',
        denyEndpoint: '/api/v1/approvals/:id/deny',
        receiptEndpoint: '/api/v1/receipts',
        approvalDoesNotExecuteTargetAction: true,
        targetActionRequiresRuntimeGate: true,
      },
      cards: input.approvalCards.cards,
      receipts: input.visualReceipts.cards,
      safety: {
        zavorthControlCanExecuteTargetAction: false,
        zavorthControlCanResolveApprovalOnlyThroughGateway: true,
        approvalScopedToExactAction: true,
        rawSecretsSerialized: false,
        telegramPrivileged: false,
      },
      nextAction: buildNextAction(pendingApprovals, highRiskApprovals, rollbackAvailable),
    }) as ZavorthApprovalReceiptTrustUxSnapshot;
  }
}

function buildSimpleMode(
  pendingApprovals: number,
  highRiskApprovals: number,
  rollbackAvailable: number,
): ZavorthApprovalReceiptTrustUxSnapshot['simpleMode'] {
  if (highRiskApprovals > 0) {
    return {
      headline: 'High-risk approval waiting',
      primaryText: 'Zavorth is asking for something sensitive. Review the preview and rollback evidence before deciding.',
      decisionHint: 'Deny if the request is unclear, broader than expected, or missing rollback evidence.',
    };
  }
  if (pendingApprovals > 0) {
    return {
      headline: `${pendingApprovals} approval${pendingApprovals === 1 ? '' : 's'} waiting`,
      primaryText: 'Zavorth needs your decision before continuing. Approval is scoped to the exact action shown.',
      decisionHint: rollbackAvailable > 0
        ? 'Use approve once only if the preview matches your intent; rollback evidence is available.'
        : 'Use approve once only if the preview matches your intent.',
    };
  }
  return {
    headline: 'No approval waiting',
    primaryText: 'Zavorth can continue read-only or preview work without a decision right now.',
    decisionHint: 'Inspect receipts when you need proof of what happened.',
  };
}

function buildNextAction(
  pendingApprovals: number,
  highRiskApprovals: number,
  rollbackAvailable: number,
): string {
  if (highRiskApprovals > 0) {
    return 'Review high-risk approval cards in advanced mode and deny anything that is not exact, reversible and expected.';
  }
  if (pendingApprovals > 0) {
    return rollbackAvailable > 0
      ? 'Review preview, receipt and rollback evidence before approving once or denying.'
      : 'Review preview and receipt evidence before approving once or denying.';
  }
  return 'No trust decision is waiting; keep using receipts as operational proof.';
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeValue(entry)]),
  );
}

function redactText(value: string): string {
  return value
    .replace(/\b([A-Z0-9_]*(?:API[_-]...KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*)\s*=\s*[^\s"'`]+/gi, '$1=[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{4,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b(?:ghp|github_pat|xoxb|xoxp|xoxa)-[A-Za-z0-9_-]{4,}\b/g, '[REDACTED_SECRET]');
}
