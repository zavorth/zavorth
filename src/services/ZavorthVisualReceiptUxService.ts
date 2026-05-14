import {
  ZAVORTH_VISUAL_RECEIPT_UX_CONTRACT_VERSION,
  type ZavorthVisualReceiptUxAction,
  type ZavorthVisualReceiptUxCard,
  type ZavorthVisualReceiptUxEvidenceRow,
  type ZavorthVisualReceiptUxSnapshot,
  type ZavorthVisualReceiptUxTone,
} from '../contracts/ZavorthVisualReceiptUxContract.js';
import type { ZavorthVisualReceiptContract } from '../contracts/ZavorthVisualReceiptContract.js';
import { ZavorthProductizationProtectedRuntimeService } from './ZavorthProductizationProtectedRuntimeService.js';

export type ZavorthVisualReceiptUxInput = {
  receipts?: ZavorthVisualReceiptContract[];
  includeAdvanced?: boolean;
};

export type ZavorthVisualReceiptUxRuntime = {
  now?: () => Date;
  productization?: Pick<ZavorthProductizationProtectedRuntimeService, 'buildSnapshot'>;
};

export class ZavorthVisualReceiptUxService {
  private readonly now: () => Date;
  private readonly productization: Pick<ZavorthProductizationProtectedRuntimeService, 'buildSnapshot'>;

  constructor(runtime: ZavorthVisualReceiptUxRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.productization = runtime.productization || new ZavorthProductizationProtectedRuntimeService({ now: this.now });
  }

  public buildSnapshot(input: ZavorthVisualReceiptUxInput = {}): ZavorthVisualReceiptUxSnapshot {
    const generatedAt = this.now().toISOString();
    const receipts = input.receipts?.length
      ? input.receipts
      : [this.productization.buildSnapshot({ source: 'web' }).receipt];
    const cards = receipts.map((receipt) => this.buildCard(receipt, input.includeAdvanced === true));
    const highRisk = cards.filter((card) => card.risk === 'high').length;
    const rollbackAvailable = cards.filter((card) => card.actions.some((action) => action.kind === 'rollback')).length;
    const approvalsPending = cards.filter((card) => card.evidence.some((row) => row.id === 'approvals' && row.value !== '0')).length;

    return {
      contractVersion: ZAVORTH_VISUAL_RECEIPT_UX_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'visual-receipt-ux',
      generatedAt,
      status: highRisk > 0 || approvalsPending > 0 ? 'attention' : 'ready',
      summary: {
        totalReceipts: cards.length,
        highRisk,
        rollbackAvailable,
        approvalsPending,
        rawSecretsSerialized: false,
      },
      cards,
      commandCenterProjection: {
        route: '/dashboard',
        renderMode: 'projection-only',
        executionAuthority: false,
        visualReceiptBlocksReady: true,
      },
      nextAction: this.resolveNextAction(cards),
    };
  }

  public renderText(snapshot: ZavorthVisualReceiptUxSnapshot): string {
    return [
      '[visual-receipts]',
      `status=${snapshot.status}`,
      `receipts=${snapshot.summary.totalReceipts}`,
      `high_risk=${snapshot.summary.highRisk}`,
      `rollback=${snapshot.summary.rollbackAvailable}`,
      `approvals=${snapshot.summary.approvalsPending}`,
      '',
      ...snapshot.cards.map((card) => [
        `[receipt:${card.id}]`,
        `${card.title} | risk=${card.risk} | outcome=${card.outcome}`,
        card.simpleText,
        ...card.evidence.map((row) => `- ${row.label}: ${row.value} | ${row.detail}`),
        ...card.actions.map((action) => `> ${action.id}: ${action.command} | mutates=${action.mutatesState}`),
      ].join('\n')),
      '',
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }

  private buildCard(receipt: ZavorthVisualReceiptContract, includeAdvanced: boolean): ZavorthVisualReceiptUxCard {
    const tone = resolveTone(receipt);
    return {
      id: receipt.id,
      title: receipt.summary.title || 'Zavorth receipt',
      subtitle: buildSubtitle(receipt),
      risk: receipt.summary.risk,
      tone,
      outcome: String(receipt.summary.outcome || 'unknown'),
      simpleText: sanitizeReceiptText(receipt.simpleText || 'Receipt recorded.'),
      evidence: buildEvidenceRows(receipt),
      actions: buildActions(receipt),
      advanced: {
        visible: includeAdvanced,
        policyBroker: receipt.advanced.policyBroker,
        trustPlane: receipt.advanced.trustPlane,
        sandboxMutationMode: receipt.advanced.sandboxMutationMode,
        approvalOptions: receipt.advanced.approvalOptions,
        artifacts: receipt.advanced.artifacts,
      },
      safety: {
        rawSecretsSerialized: false,
        secretPolicy: receipt.redaction.policy,
        commandCenterCanExecute: false,
        projectionOnly: true,
      },
    };
  }

  private resolveNextAction(cards: ZavorthVisualReceiptUxCard[]): string {
    if (cards.some((card) => card.actions.some((action) => action.kind === 'approval'))) {
      return 'Review the preview and approve only the exact scoped action if it matches the user intent.';
    }
    if (cards.some((card) => card.actions.some((action) => action.kind === 'rollback'))) {
      return 'Rollback is available if the result is not desired.';
    }
    return 'Inspect the receipt details before making claims about completed work.';
  }
}

function buildEvidenceRows(receipt: ZavorthVisualReceiptContract): ZavorthVisualReceiptUxEvidenceRow[] {
  return [
    row('files-read', 'Files read', receipt.summary.filesRead, 'info', 'How much local context was inspected.'),
    row('files-changed', 'Files changed', receipt.summary.filesChanged, receipt.summary.filesChanged > 0 ? 'warn' : 'ok', 'Mutations require approval and receipt evidence.'),
    row('actions-blocked', 'Blocked', receipt.summary.actionsBlocked, receipt.summary.actionsBlocked > 0 ? 'warn' : 'ok', 'Policy or sandbox blocked unsafe actions.'),
    row('network-used', 'Network used', receipt.summary.networkUsed, receipt.summary.networkUsed > 0 ? 'warn' : 'ok', 'Outbound access shown separately from local work.'),
    row('network-blocked', 'Network blocked', receipt.summary.networkBlocked, receipt.summary.networkBlocked > 0 ? 'warn' : 'ok', 'Network attempts blocked by policy or risk.'),
    row('approvals', 'Approvals', receipt.summary.approvals, receipt.summary.approvals > 0 ? 'warn' : 'ok', 'Human approval still required for scoped action.'),
    row('rollback', 'Rollback', receipt.summary.rollbackAvailable ? 'available' : 'none', receipt.summary.rollbackAvailable ? 'ok' : 'info', 'Whether the action can be reversed from receipt data.'),
  ];
}

function buildActions(receipt: ZavorthVisualReceiptContract): ZavorthVisualReceiptUxAction[] {
  const actions: ZavorthVisualReceiptUxAction[] = [
    {
      id: 'inspect',
      label: 'Inspect receipt',
      command: `zavorth receipts ${receipt.id} --advanced`,
      kind: 'inspect',
      requiresApproval: false,
      mutatesState: false,
      dashboardCanExecute: false,
    },
  ];
  if (receipt.summary.approvals > 0) {
    actions.push({
      id: 'view-preview',
      label: 'View preview',
      command: `zavorth approvals preview ${receipt.missionId}`,
      kind: 'approval',
      requiresApproval: false,
      mutatesState: false,
      dashboardCanExecute: false,
    });
  }
  if (receipt.summary.rollbackAvailable) {
    actions.push({
      id: 'rollback',
      label: 'Prepare rollback',
      command: `zavorth rollback ${receipt.missionId} --preview`,
      kind: 'rollback',
      requiresApproval: true,
      mutatesState: true,
      dashboardCanExecute: false,
    });
  }
  return actions;
}

function row(
  id: string,
  label: string,
  value: string | number,
  tone: ZavorthVisualReceiptUxTone,
  detail: string,
): ZavorthVisualReceiptUxEvidenceRow {
  return {
    id,
    label,
    value: String(value),
    tone,
    detail,
  };
}

function buildSubtitle(receipt: ZavorthVisualReceiptContract): string {
  const changes = receipt.summary.filesChanged > 0
    ? `${receipt.summary.filesChanged} file change(s)`
    : 'no file changes';
  const network = receipt.summary.networkUsed > 0
    ? `${receipt.summary.networkUsed} network use`
    : 'local/no network';
  return `${receipt.summary.risk} risk · ${changes} · ${network}`;
}

function resolveTone(receipt: ZavorthVisualReceiptContract): ZavorthVisualReceiptUxTone {
  if (receipt.summary.risk === 'high' || receipt.summary.actionsBlocked > 0) {
    return 'danger';
  }
  if (receipt.summary.risk === 'medium' || receipt.summary.approvals > 0 || receipt.summary.filesChanged > 0) {
    return 'warn';
  }
  return 'ok';
}

function sanitizeReceiptText(value: string): string {
  return String(value || '')
    .replace(/\b(sk|pk|ghp|gho|xox[baprs])[-_A-Za-z0-9]{12,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .slice(0, 1200);
}
