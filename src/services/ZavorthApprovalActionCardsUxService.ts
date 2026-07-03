import {
  ZAVORTH_APPROVAL_ACTION_CARDS_UX_CONTRACT_VERSION,
  type ZavorthApprovalActionCard,
  type ZavorthApprovalActionCardAction,
  type ZavorthApprovalActionCardsUxSnapshot,
  type ZavorthApprovalActionCardTone,
} from '../contracts/ZavorthApprovalActionCardsUxContract.js';

type LooseRecord = Record<string, any>;

export type ZavorthApprovalActionCardsUxInput = {
  approvals?: Array<LooseRecord> | null;
  sensitiveActionFlowUx?: LooseRecord | null;
  visualReceipts?: LooseRecord | null;
  activeMissionUx?: LooseRecord | null;
};

type ZavorthApprovalActionCardsUxRuntime = {
  now?: () => Date;
};

export class ZavorthApprovalActionCardsUxService {
  private readonly now: () => Date;

  constructor(runtime: ZavorthApprovalActionCardsUxRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: ZavorthApprovalActionCardsUxInput = {}): ZavorthApprovalActionCardsUxSnapshot {
    const generatedAt = this.now().toISOString();
    const sensitiveCard = asRecord(input.sensitiveActionFlowUx?.card);
    const receiptCards = Array.isArray(input.visualReceipts?.cards) ? input.visualReceipts?.cards as LooseRecord[] : [];
    const approvals = Array.isArray(input.approvals) ? input.approvals : [];
    const cards = approvals.length > 0
      ? approvals.map((approval, index) => buildApprovalCard({
          approval,
          index,
          sensitiveCard,
          receiptCard: receiptCards[index] || receiptCards[0] || null,
        }))
      : sensitiveCard?.approval?.required
        ? [buildApprovalCard({
            approval: {
              id: text(sensitiveCard.approval?.id) || text(sensitiveCard.id) || 'sensitive-flow-approval',
              title: text(sensitiveCard.title) || 'Approval needed',
              reason: text(sensitiveCard.approval?.simpleText) || text(sensitiveCard.subtitle) || 'Sensitive action requires approval.',
              status: text(sensitiveCard.approval?.status) || 'pending',
              risk: text(sensitiveCard.risk) || 'unknown',
              scope: text(sensitiveCard.request) || 'sensitive-flow',
            },
            index: 0,
            sensitiveCard,
            receiptCard: receiptCards[0] || null,
          })]
        : [];
    const snapshot = {
      contractVersion: ZAVORTH_APPROVAL_ACTION_CARDS_UX_CONTRACT_VERSION,
      schemaVersion: 1 as const,
      surface: 'approval-action-cards-ux' as const,
      generatedAt,
      status: cards.some((card) => card.tone === 'danger')
        ? 'blocked' as const
        : cards.some((card) => card.status === 'pending')
          ? 'attention' as const
          : 'ready' as const,
      summary: {
        totalCards: cards.length,
        pending: cards.filter((card) => card.status === 'pending').length,
        highRisk: cards.filter((card) => card.risk === 'high').length,
        previewAvailable: cards.filter((card) => card.preview.available).length,
        rollbackAvailable: cards.filter((card) => card.rollback.available).length,
        rawSecretsSerialized: false as const,
      },
      cards,
      zavorthControlProjection: {
        route: '/zavorthControl' as const,
        renderMode: 'interactive-action-cards' as const,
        executionAuthority: false as const,
        zavorthControlCanExecuteTargetAction: false as const,
        approvalResolutionAuthority: 'gateway-mediated' as const,
      },
      nextAction: cards.length > 0
        ? 'Review the pending approval cards; approve or deny only through the governed gateway.'
        : 'No approvals are waiting right now.',
    };
    return sanitizeValue(snapshot) as ZavorthApprovalActionCardsUxSnapshot;
  }

  public renderText(snapshot: ZavorthApprovalActionCardsUxSnapshot): string {
    return [
      '[approval-action-cards]',
      `status=${snapshot.status}`,
      `pending=${snapshot.summary.pending}`,
      `cards=${snapshot.summary.totalCards}`,
      '',
      ...snapshot.cards.map((card) => [
        `- ${card.id}: ${card.title}`,
        `  risk=${card.risk} status=${card.status} scope=${card.scope}`,
        `  actions=${card.actions.map((action) => action.kind).join(', ')}`,
      ].join('\n')),
      '',
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }
}

function buildApprovalCard(input: {
  approval: LooseRecord;
  index: number;
  sensitiveCard: LooseRecord | null;
  receiptCard: LooseRecord | null;
}): ZavorthApprovalActionCard {
  const approvalId = text(input.approval.id || input.approval.approvalId) || `approval-${input.index + 1}`;
  const status = normalizeStatus(text(input.approval.status));
  const risk = normalizeRisk(text(input.approval.risk || input.sensitiveCard?.risk));
  const preview = asRecord(input.sensitiveCard?.preview);
  const rollback = asRecord(input.sensitiveCard?.rollback);
  const receipt = asRecord(input.receiptCard) || asRecord(input.sensitiveCard?.receipt);
  const previewCommand = findSensitiveActionCommand(input.sensitiveCard, 'preview')
    || `zavorth sensitive-flow --request="${escapeCommandValue(text(input.approval.scope || input.approval.reason || input.approval.title))}" --json`;
  const rollbackCommand = text(rollback?.command) || findSensitiveActionCommand(input.sensitiveCard, 'rollback') || null;
  const receiptId = text(receipt?.id) || text(input.sensitiveCard?.receipt?.id) || null;

  const card: ZavorthApprovalActionCard = {
    id: approvalId,
    title: text(input.approval.title) || text(input.sensitiveCard?.title) || 'Approval needed',
    summary: text(input.sensitiveCard?.subtitle) || text(input.approval.summary) || 'Review before releasing a sensitive action.',
    reason: text(input.approval.reason) || text(input.sensitiveCard?.approval?.simpleText) || 'Policy requires your decision.',
    status,
    risk,
    tone: toneForApproval(status, risk),
    scope: text(input.approval.scope) || text(input.sensitiveCard?.request) || 'session',
    preview: {
      available: true,
      command: previewCommand,
      filesChanged: number(preview?.filesChanged),
      commands: number(preview?.commands),
      networkCalls: number(preview?.networkCalls),
      messages: number(preview?.messages),
    },
    rollback: {
      available: Boolean(rollback?.available || rollbackCommand),
      command: rollbackCommand,
      summary: text(rollback?.summary) || 'Rollback appears after a mutable plan prepares recovery metadata.',
    },
    receipt: {
      available: Boolean(receiptId),
      id: receiptId,
      command: receiptId ? `zavorth receipts ${escapeCommandValue(receiptId)} --advanced` : 'zavorth receipts',
    },
    actions: [],
    safety: {
      policyBrokerRequired: true,
      zavorthControlCanExecuteTargetAction: false,
      zavorthControlCanExecuteTargetAction: false,
      rawSecretsSerialized: false,
      approvalScopeBound: true,
    },
  };
  card.actions = buildActions(card);
  return card;
}

function buildActions(card: ZavorthApprovalActionCard): ZavorthApprovalActionCardAction[] {
  const actions: ZavorthApprovalActionCardAction[] = [
    {
      id: `${card.id}:preview`,
      label: 'Preview',
      kind: 'view_preview',
      command: card.preview.command,
      approvalId: card.id,
      zavorthControlCanResolveApproval: false,
      zavorthControlCanExecuteTargetAction: false,
      zavorthControlCanExecuteTargetAction: false,
      requiresApproval: false,
    },
  ];
  if (card.status === 'pending') {
    actions.push(
      {
        id: `${card.id}:allow-once`,
        label: 'Approve once',
        kind: 'allow_once',
        command: `zavorth approvals approve ${escapeCommandValue(card.id)} --once`,
        approvalId: card.id,
        zavorthControlCanResolveApproval: true,
        zavorthControlCanExecuteTargetAction: false,
        zavorthControlCanExecuteTargetAction: false,
        requiresApproval: false,
      },
      {
        id: `${card.id}:deny`,
        label: 'Deny',
        kind: 'deny',
        command: `zavorth approvals deny ${escapeCommandValue(card.id)}`,
        approvalId: card.id,
        zavorthControlCanResolveApproval: true,
        zavorthControlCanExecuteTargetAction: false,
        zavorthControlCanExecuteTargetAction: false,
        requiresApproval: false,
      },
    );
  }
  if (card.rollback.available && card.rollback.command) {
    actions.push({
      id: `${card.id}:rollback`,
      label: 'Rollback preview',
      kind: 'view_rollback',
      command: card.rollback.command,
      approvalId: card.id,
      zavorthControlCanResolveApproval: false,
      zavorthControlCanExecuteTargetAction: false,
      zavorthControlCanExecuteTargetAction: false,
      requiresApproval: false,
    });
  }
  actions.push({
    id: `${card.id}:receipt`,
    label: 'Receipt',
    kind: 'view_receipt',
    command: card.receipt.command,
    approvalId: card.id,
    zavorthControlCanResolveApproval: false,
    zavorthControlCanExecuteTargetAction: false,
    zavorthControlCanExecuteTargetAction: false,
    requiresApproval: false,
  });
  return actions;
}

function findSensitiveActionCommand(card: LooseRecord | null, kind: string): string | null {
  const actions = Array.isArray(card?.actions) ? card?.actions as LooseRecord[] : [];
  const action = actions.find((entry) => text(entry.kind) === kind || text(entry.id).includes(kind));
  return text(action?.command) || null;
}

function normalizeStatus(value: string): ZavorthApprovalActionCard['status'] {
  if (value === 'approved') return 'approved';
  if (value === 'denied' || value === 'rejected') return 'denied';
  if (value === 'expired') return 'expired';
  if (value === 'not_required') return 'not_required';
  return 'pending';
}

function normalizeRisk(value: string): ZavorthApprovalActionCard['risk'] {
  if (value === 'danger') return 'high';
  if (value === 'attention') return 'medium';
  if (value === 'safe') return 'low';
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'unknown';
}

function toneForApproval(
  status: ZavorthApprovalActionCard['status'],
  risk: ZavorthApprovalActionCard['risk'],
): ZavorthApprovalActionCardTone {
  if (status === 'denied' || status === 'expired' || risk === 'high') return 'danger';
  if (status === 'pending' || risk === 'medium') return 'warn';
  if (status === 'approved' || status === 'not_required') return 'ok';
  return 'info';
}

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as LooseRecord : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? redactText(value).trim() : '';
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeCommandValue(value: string): string {
  return redactText(value).replace(/["`$\\]/g, ' ').slice(0, 180);
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
    .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*)\s*=\s*[^\s"'`]+/gi, '$1=[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{4,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b(?:ghp|github_pat|xoxb|xoxp|xoxa)-[A-Za-z0-9_-]{4,}\b/g, '[REDACTED_SECRET]');
}
