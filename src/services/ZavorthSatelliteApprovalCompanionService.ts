import {
  ZAVORTH_SATELLITE_APPROVAL_COMPANION_CONTRACT_VERSION,
  type ZavorthSatelliteApprovalButton,
  type ZavorthSatelliteApprovalCard,
  type ZavorthSatelliteApprovalCompanionSnapshot,
  type ZavorthSatelliteApprovalDecision,
} from '../contracts/ZavorthSatelliteApprovalCompanionContract.js';
import {
  ZavorthApprovalActionCardsUxService,
  type ZavorthApprovalActionCardsUxInput,
} from './ZavorthApprovalActionCardsUxService.js';
import {
  ZavorthVisualReceiptsV2Service,
  type ZavorthVisualReceiptsV2Input,
} from './ZavorthVisualReceiptsV2Service.js';

export type ZavorthSatelliteApprovalCompanionInput = ZavorthApprovalActionCardsUxInput & ZavorthVisualReceiptsV2Input & {
  user?: string | null;
  missionId?: string | null;
};

export type ZavorthSatelliteApprovalCompanionRuntime = {
  now?: () => Date;
  approvalCards?: Pick<ZavorthApprovalActionCardsUxService, 'buildSnapshot'>;
  visualReceipts?: Pick<ZavorthVisualReceiptsV2Service, 'buildSnapshot'>;
};

export class ZavorthSatelliteApprovalCompanionService {
  private readonly now: () => Date;
  private readonly approvalCards: Pick<ZavorthApprovalActionCardsUxService, 'buildSnapshot'>;
  private readonly visualReceipts: Pick<ZavorthVisualReceiptsV2Service, 'buildSnapshot'>;

  constructor(runtime: ZavorthSatelliteApprovalCompanionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.approvalCards = runtime.approvalCards || new ZavorthApprovalActionCardsUxService();
    this.visualReceipts = runtime.visualReceipts || new ZavorthVisualReceiptsV2Service();
  }

  public buildSnapshot(input: ZavorthSatelliteApprovalCompanionInput = {}): ZavorthSatelliteApprovalCompanionSnapshot {
    const approvalSnapshot = this.approvalCards.buildSnapshot({
      approvals: input.approvals?.length ? input.approvals : defaultApprovals(),
      sensitiveActionFlowUx: input.sensitiveActionFlowUx,
      visualReceipts: input.visualReceipts,
      activeMissionUx: input.activeMissionUx,
    });
    const receiptSnapshot = this.visualReceipts.buildSnapshot({
      receipts: input.receipts,
      includeAdvanced: input.includeAdvanced,
      includeAdvancedStory: input.includeAdvancedStory,
    });
    const receiptCards = receiptSnapshot.cards;
    const user = sanitizeText(input.user || 'local-operator') || 'local-operator';
    const cards = approvalSnapshot.cards.map((card, index): ZavorthSatelliteApprovalCard => {
      const receipt = receiptCards[index] || receiptCards[0] || null;
      return {
        id: `satellite-${card.id}`,
        approvalId: card.id,
        missionId: sanitizeText(input.missionId || null),
        title: sanitizeText(card.title) || 'Approval needed',
        summary: sanitizeText(card.summary || card.reason) || 'Review this request before Zavorth continues.',
        risk: card.risk,
        status: card.status,
        badge: badgeFor(card),
        scope: {
          action: sanitizeText(card.actions.find((action) => action.kind === 'allow_once')?.kind || 'approval.resolve') || 'approval.resolve',
          target: sanitizeText(card.scope) || 'session',
          argsHash: hashLike(card.id, card.scope),
          ttl: 'short-lived runtime approval',
          user,
          surface: 'satellite',
        },
        buttons: buildButtons(card.id),
        receiptPreview: receipt
          ? {
              id: receipt.id,
              headline: receipt.headline,
              confidence: receipt.confidence,
              tone: receipt.tone,
            }
          : null,
        safety: {
          policyBrokerRequired: true,
          approvalScopeBound: true,
          satelliteCanExecuteTargetAction: false,
          targetActionResumesThroughRuntime: true,
          rawSecretsSerialized: false,
        },
      };
    });

    return sanitizeValue({
      contractVersion: ZAVORTH_SATELLITE_APPROVAL_COMPANION_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'satellite-approval-companion',
      generatedAt: this.now().toISOString(),
      route: '/satellite',
      status: cards.some((card) => card.risk === 'high')
        ? 'blocked'
        : cards.some((card) => card.status === 'pending')
          ? 'attention'
          : 'ready',
      summary: {
        pending: cards.filter((card) => card.status === 'pending').length,
        totalCards: cards.length,
        highRisk: cards.filter((card) => card.risk === 'high').length,
        receiptPreviews: cards.filter((card) => card.receiptPreview).length,
        rawSecretsSerialized: false,
      },
      cards,
      transport: {
        websocketUrl: '/api/web/satellite/ws',
        websocketDecisionEnvelopeType: 'capability.result',
        restApproveEndpointTemplate: '/api/v1/approvals/:id/approve',
        restDenyEndpointTemplate: '/api/v1/approvals/:id/deny',
        offlineQueueSupported: true,
      },
      companionProjection: {
        pwaRoute: '/satellite',
        mobileFirst: true,
        executionAuthority: false,
        approvalResolutionAuthority: 'gateway-mediated',
        runtimeSourceOfTruth: '/api/v1',
      },
      safety: {
        projectionOnly: true,
        policyBrokerRequired: true,
        satelliteCanExecuteTargetAction: false,
        targetActionResumesThroughRuntime: true,
        rawSecretsSerialized: false,
        secretsMustUseSecretRefs: true,
      },
      nextAction: cards.length > 0
        ? 'Open Satellite to approve, deny or inspect pending runtime decisions from your phone.'
        : 'Satellite is ready; no approval is waiting right now.',
      invariants: [
        'Satellite is a companion surface, not a second runtime.',
        'Satellite approval buttons resolve scoped approval requests through the gateway.',
        'Approving in Satellite does not execute the target action inside the browser.',
        'The governed runtime resumes, blocks or dry-runs the target action after Policy Broker validation.',
        'Secrets remain redacted and represented as SecretRefs before reaching the PWA.',
      ],
    }) as ZavorthSatelliteApprovalCompanionSnapshot;
  }

  public renderText(snapshot: ZavorthSatelliteApprovalCompanionSnapshot): string {
    return [
      '[zavorth-satellite-approval-companion]',
      `status=${snapshot.status} route=${snapshot.route} pending=${snapshot.summary.pending} cards=${snapshot.summary.totalCards}`,
      `transport=${snapshot.transport.websocketUrl} decision=${snapshot.transport.websocketDecisionEnvelopeType}`,
      '',
      ...snapshot.cards.map((card) => [
        `[${card.approvalId}] ${card.title}`,
        `risk=${card.risk} status=${card.status} scope=${card.scope.target}`,
        `receipt=${card.receiptPreview?.headline || 'none'}`,
        `buttons=${card.buttons.map((button) => `${button.label}:${button.decision}`).join(', ')}`,
      ].join('\n')),
      '',
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }
}

function buildButtons(approvalId: string): ZavorthSatelliteApprovalButton[] {
  return [
    button(approvalId, 'approve', 'Approve once', `/api/v1/approvals/${encodeURIComponent(approvalId)}/approve`, 'POST'),
    button(approvalId, 'deny', 'Deny', `/api/v1/approvals/${encodeURIComponent(approvalId)}/deny`, 'POST'),
    button(approvalId, 'preview', 'Preview', `/api/v1/approvals/${encodeURIComponent(approvalId)}`, 'GET'),
  ];
}

function button(
  approvalId: string,
  decision: ZavorthSatelliteApprovalDecision,
  label: string,
  endpoint: string,
  method: 'POST' | 'GET',
): ZavorthSatelliteApprovalButton {
  return {
    id: `${approvalId}:${decision}`,
    label,
    decision,
    approvalId,
    endpoint,
    method,
    websocketEnvelope: {
      type: 'capability.result',
      payload: {
        actionId: approvalId,
        approvalId,
        decision,
        ok: true,
        source: 'satellite',
      },
    },
    requiresPolicyBroker: true,
    mutatesTargetAction: false,
  };
}

function defaultApprovals(): Array<Record<string, any>> {
  return [
    {
      id: 'satellite-demo-approval',
      title: 'Review a proposed file change',
      reason: 'Zavorth wants to continue a scoped mission that may edit workspace files.',
      status: 'pending',
      risk: 'medium',
      scope: 'workspace.write:preview-only-until-approved',
    },
  ];
}

function badgeFor(card: { risk: string; status: string }): string {
  if (card.risk === 'high') return 'HIGH_RISK';
  if (card.status === 'pending') return 'ACTION_REQUIRED';
  return 'DECISION';
}

function hashLike(...parts: unknown[]): string {
  const raw = parts.map((part) => String(part || '')).join('|');
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
  }
  return `scope_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeValue(entry)]),
  );
}

function sanitizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*)\s*=\s*[^\s"'`]+/gi, '$1=[REDACTED]')
    .replace(/\b(sk|pk|ghp|gho|xox[baprs])[-_A-Za-z0-9]{8,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .slice(0, 1200);
}
