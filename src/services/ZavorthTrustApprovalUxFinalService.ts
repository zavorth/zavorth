import { config } from '../config/index.js';
import {
  ZavorthPersistentApprovalPolicyService,
  type ZavorthPersistentApprovalPolicy,
  type ZavorthPersistentApprovalPolicySnapshot,
} from './ZavorthPersistentApprovalPolicyService.js';
import {
  ZavorthTrustOverviewService,
  type ZavorthTrustOverviewSnapshot,
} from './ZavorthTrustOverviewService.js';
import { tService } from '../i18n/services.js';

export const ZAVORTH_TRUST_APPROVAL_UX_FINAL_CONTRACT_VERSION =
  'zavorth-trust-approval-ux-final/1' as const;

export type ZavorthTrustApprovalUxStatus = 'ready' | 'attention' | 'danger';

export type ZavorthTrustApprovalUxCard = {
  id: string;
  label: string;
  status: ZavorthTrustApprovalUxStatus;
  summary: string;
  nextAction: string;
  command: string;
};

export type ZavorthTrustApprovalUxAction = {
  id: string;
  label: string;
  severity: 'info' | 'warn' | 'danger';
  reason: string;
  command: string;
};

export type ZavorthTrustApprovalUxPolicyView = Omit<ZavorthPersistentApprovalPolicy, 'reason'>;

export type ZavorthTrustApprovalUxFinalSnapshot = {
  contractVersion: typeof ZAVORTH_TRUST_APPROVAL_UX_FINAL_CONTRACT_VERSION;
  surface: 'trust-approval-ux-final';
  generatedAt: string;
  workspaceRoot: string;
  status: ZavorthTrustApprovalUxStatus;
  summary: {
    pendingApprovals: number;
    highRiskCapabilities: number;
    persistentPolicies: number;
    activePersistentPolicies: number;
    activeBreakGlassPolicies: number;
    expiredPolicies: number;
    recommendedActions: number;
  };
  cards: ZavorthTrustApprovalUxCard[];
  actions: ZavorthTrustApprovalUxAction[];
  persistentPolicies: ZavorthTrustApprovalUxPolicyView[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
  safety: {
    naturalLanguageCanRequestApprovalButNotBypass: true;
    broadPersistentApprovalRequiresExplicitScope: true;
    breakGlassRequiresDoubleConfirmation: true;
    breakGlassKeepsHardStops: true;
    revokeAllRequiresExplicitConfirmation: true;
    receiptsRequired: true;
    rawSecretsSerialized: false;
    criticalRiskCannotBeAutoApproved: true;
  };
  sourceSnapshots: {
    trustOverview: Pick<ZavorthTrustOverviewSnapshot, 'generatedAt' | 'workspaceRoot' | 'summary' | 'cards' | 'actions' | 'narrative'>;
    persistentApprovals: ZavorthPersistentApprovalPolicySnapshot;
  };
};

export type ZavorthTrustApprovalUxRevokeResult = {
  attempted: boolean;
  allowed: boolean;
  revoked: number;
  reason: string;
};

type TrustOverviewLike = Pick<ZavorthTrustOverviewService, 'buildSnapshot'>;
type PersistentApprovalsLike = Pick<ZavorthPersistentApprovalPolicyService, 'buildSnapshot' | 'revoke'>;

type Runtime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  trustOverviewService?: TrustOverviewLike | null;
  persistentApprovalPolicyService?: PersistentApprovalsLike | null;
};

export class ZavorthTrustApprovalUxFinalService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly trustOverview: TrustOverviewLike;
  private readonly persistentApprovals: PersistentApprovalsLike;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = normalizeText(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.trustOverview = runtime.trustOverviewService || new ZavorthTrustOverviewService();
    this.persistentApprovals = runtime.persistentApprovalPolicyService || new ZavorthPersistentApprovalPolicyService();
  }

  public buildSnapshot(input: { limit?: number | null } = {}): ZavorthTrustApprovalUxFinalSnapshot {
    const trustOverview = this.trustOverview.buildSnapshot({ limit: normalizeLimit(input.limit) });
    const persistentApprovals = this.persistentApprovals.buildSnapshot();
    const activePolicies = persistentApprovals.policies.filter((policy) => policy.enabled && !isExpired(policy, this.now()));
    const activeBreakGlassPolicies = activePolicies.filter((policy) => policy.mode === 'break-glass');
    const activePersistentPolicies = activePolicies.filter((policy) => policy.mode === 'standard');
    const pendingApprovals = Number(trustOverview.summary.pendingApprovals || 0) || 0;
    const highRiskCapabilities = Number(trustOverview.summary.highRiskCapabilities || 0) || 0;
    const status = this.resolveStatus({
      pendingApprovals,
      highRiskCapabilities,
      activeBreakGlassPolicies: activeBreakGlassPolicies.length,
      posture: trustOverview.summary.posture,
    });
    const actions = this.buildActions({
      pendingApprovals,
      highRiskCapabilities,
      activeBreakGlassPolicies: activeBreakGlassPolicies.length,
      activePersistentPolicies: activePersistentPolicies.length,
    });
    const cards = this.buildCards({
      status,
      pendingApprovals,
      highRiskCapabilities,
      activePersistentPolicies,
      activeBreakGlassPolicies,
      expiredPolicies: persistentApprovals.summary.expired,
    });
    const nextAction = actions[0]?.command || 'zavorth trust --json';

    return {
      contractVersion: ZAVORTH_TRUST_APPROVAL_UX_FINAL_CONTRACT_VERSION,
      surface: 'trust-approval-ux-final',
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      status,
      summary: {
        pendingApprovals,
        highRiskCapabilities,
        persistentPolicies: persistentApprovals.summary.total,
        activePersistentPolicies: activePersistentPolicies.length,
        activeBreakGlassPolicies: activeBreakGlassPolicies.length,
        expiredPolicies: persistentApprovals.summary.expired,
        recommendedActions: actions.length,
      },
      cards,
      actions,
      persistentPolicies: persistentApprovals.policies.map(toPolicyView),
      narrative: {
        headline: 'Trust & Approval UX Final',
        operatorSummary: this.buildOperatorSummary({
          status,
          pendingApprovals,
          highRiskCapabilities,
          activePersistentPolicies: activePersistentPolicies.length,
          activeBreakGlassPolicies: activeBreakGlassPolicies.length,
        }),
        nextAction,
      },
      safety: {
        naturalLanguageCanRequestApprovalButNotBypass: true,
        broadPersistentApprovalRequiresExplicitScope: true,
        breakGlassRequiresDoubleConfirmation: true,
        breakGlassKeepsHardStops: true,
        revokeAllRequiresExplicitConfirmation: true,
        receiptsRequired: true,
        rawSecretsSerialized: false,
        criticalRiskCannotBeAutoApproved: true,
      },
      sourceSnapshots: {
        trustOverview: {
          generatedAt: trustOverview.generatedAt,
          workspaceRoot: trustOverview.workspaceRoot,
          summary: trustOverview.summary,
          cards: trustOverview.cards,
          actions: trustOverview.actions,
          narrative: trustOverview.narrative,
        },
        persistentApprovals,
      },
    };
  }

  public revokeAll(input: { confirm: boolean; reason?: string | null }): {
    snapshot: ZavorthTrustApprovalUxFinalSnapshot;
    revokeResult: ZavorthTrustApprovalUxRevokeResult;
  } {
    const before = this.persistentApprovals.buildSnapshot();
    const activePolicies = before.policies.filter((policy) => policy.enabled && !isExpired(policy, this.now()));
    if (input.confirm !== true) {
      return {
        snapshot: this.buildSnapshot(),
        revokeResult: {
          attempted: true,
          allowed: false,
          revoked: 0,
          reason: tService('approval.revoke_global_refused'),
        },
      };
    }
    let revoked = 0;
    for (const policy of activePolicies) {
      if (this.persistentApprovals.revoke(policy.id, normalizeText(input.reason, 'Owner revoked all persistent approval policies from Trust UX.'))) {
        revoked += 1;
      }
    }
    return {
      snapshot: this.buildSnapshot(),
      revokeResult: {
        attempted: true,
        allowed: true,
        revoked,
        reason: revoked > 0
          ? tService('approval.revoked_persistent', { count: String(revoked) })
          : 'No active persistent permission to revoke.',
      },
    };
  }

  public renderText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Trust & Approval UX',
      `Status: ${renderStatus(snapshot.status)}`,
      snapshot.narrative.operatorSummary,
      '',
      tService('approval.render_summary'),
      `- ${tService('approval.pending_approvals')}: ${snapshot.summary.pendingApprovals}`,
      `- ${tService('approval.high_risk_capabilities')}: ${snapshot.summary.highRiskCapabilities}`,
      `- ${tService('approval.active_persistent_permissions')}: ${snapshot.summary.activePersistentPolicies}`,
      `- ${tService('approval.active_break_glass')}: ${snapshot.summary.activeBreakGlassPolicies}`,
      `- ${tService('approval.expired_permissions')}: ${snapshot.summary.expiredPolicies}`,
      '',
      tService('approval.render_cards'),
      ...snapshot.cards.map((card) => `- ${card.label}: ${renderStatus(card.status)} | ${card.summary} | ${card.command}`),
      '',
      tService('approval.render_actions'),
      ...snapshot.actions.map((action) => `- [${action.severity}] ${action.label}: ${action.command}`),
      '',
      tService('approval.render_guarantees'),
      '- Natural text can request approval, but does not bypass policy.',
      `- ${tService('approval.break_glass_guarantee')}.`,
      `- ${tService('approval.revoke_all_guarantee')}.`,
      '- Critical risk does not receive auto-approval.',
      '',
    ];
    return lines.join('\n');
  }

  private resolveStatus(input: {
    pendingApprovals: number;
    highRiskCapabilities: number;
    activeBreakGlassPolicies: number;
    posture: string;
  }): ZavorthTrustApprovalUxStatus {
    if (input.activeBreakGlassPolicies > 0 || input.posture === 'critical') return 'danger';
    if (input.pendingApprovals > 0 || input.highRiskCapabilities > 0 || input.posture === 'attention') return 'attention';
    return 'ready';
  }

  private buildCards(input: {
    status: ZavorthTrustApprovalUxStatus;
    pendingApprovals: number;
    highRiskCapabilities: number;
    activePersistentPolicies: ZavorthPersistentApprovalPolicy[];
    activeBreakGlassPolicies: ZavorthPersistentApprovalPolicy[];
    expiredPolicies: number;
  }): ZavorthTrustApprovalUxCard[] {
    return [
      {
        id: 'approval-inbox',
        label: 'Approval Inbox',
        status: input.pendingApprovals > 0 ? 'attention' : 'ready',
        summary: tService('approval.inbox_summary', { count: String(input.pendingApprovals) }),
        nextAction: input.pendingApprovals > 0 ? tService('approval.inbox_next_action') : tService('approval.nothing_pending'),
        command: 'zavorth approvals',
      },
      {
        id: 'persistent-permissions',
        label: 'Persistent Permissions',
        status: input.activePersistentPolicies.length > 0 ? 'attention' : 'ready',
        summary: tService('approval.persistent_summary', { count: String(input.activePersistentPolicies.length) }),
        nextAction: input.activePersistentPolicies.length > 0 ? tService('approval.persistent_review') : tService('approval.persistent_create'),
        command: 'zavorth persistent-approvals --json',
      },
      {
        id: 'break-glass',
        label: 'Break Glass',
        status: input.activeBreakGlassPolicies.length > 0 ? 'danger' : 'ready',
        summary: tService('approval.break_glass_summary', { count: String(input.activeBreakGlassPolicies.length) }),
        nextAction: input.activeBreakGlassPolicies.length > 0 ? tService('approval.break_glass_revoke') : tService('approval.break_glass_governed'),
        command: 'zavorth trust revoke-all --confirm-revoke-all',
      },
      {
        id: 'risk-boundary',
        label: 'Risk Boundary',
        status: input.highRiskCapabilities > 0 ? 'attention' : input.status,
        summary: tService('approval.risk_boundary_summary', { highRisk: String(input.highRiskCapabilities), expired: String(input.expiredPolicies) }),
        nextAction: tService('approval.risk_boundary_next'),
        command: 'zavorth trust --json',
      },
    ];
  }

  private buildActions(input: {
    pendingApprovals: number;
    highRiskCapabilities: number;
    activePersistentPolicies: number;
    activeBreakGlassPolicies: number;
  }): ZavorthTrustApprovalUxAction[] {
    const actions: ZavorthTrustApprovalUxAction[] = [];
    if (input.pendingApprovals > 0) {
      actions.push({
        id: 'review-pending-approvals',
        label: tService('approval.action_review_pending'),
        severity: 'warn',
        reason: tService('approval.action_review_pending_reason'),
        command: 'zavorth approvals',
      });
    }
    if (input.activeBreakGlassPolicies > 0) {
      actions.push({
        id: 'revoke-break-glass',
        label: 'Revoke break glass when it is no longer necessary',
        severity: 'danger',
        reason: tService('approval.break_glass_reason'),
        command: 'zavorth trust revoke-all --confirm-revoke-all',
      });
    }
    if (input.activePersistentPolicies > 0) {
      actions.push({
        id: 'audit-persistent-permissions',
        label: tService('approval.action_audit_persistent'),
        severity: 'warn',
        reason: tService('approval.action_audit_persistent_reason'),
        command: 'zavorth persistent-approvals --json',
      });
    }
    if (input.highRiskCapabilities > 0) {
      actions.push({
        id: 'review-high-risk-capabilities',
        label: tService('approval.action_review_high_risk'),
        severity: 'warn',
        reason: tService('approval.action_review_high_risk_reason'),
        command: 'zavorth trust-panel --json',
      });
    }
    actions.push({
      id: 'show-trust-json',
      label: tService('approval.action_export_snapshot'),
      severity: 'info',
      reason: tService('approval.action_export_snapshot_reason'),
      command: 'zavorth trust --json',
    });
    return actions;
  }

  private buildOperatorSummary(input: {
    status: ZavorthTrustApprovalUxStatus;
    pendingApprovals: number;
    highRiskCapabilities: number;
    activePersistentPolicies: number;
    activeBreakGlassPolicies: number;
  }): string {
    if (input.activeBreakGlassPolicies > 0) {
      return tService('approval.break_glass_active_summary', { count: String(input.activeBreakGlassPolicies) });
    }
    if (input.pendingApprovals > 0 || input.highRiskCapabilities > 0 || input.activePersistentPolicies > 0) {
      return tService('approval.operator_summary_active', {
        approvals: String(input.pendingApprovals),
        highRisk: String(input.highRiskCapabilities),
        persistent: String(input.activePersistentPolicies),
      });
    }
    return tService('approval.trust_plane_clean');
  }
}

function normalizeLimit(value: number | null | undefined): number {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 8;
  return Math.max(3, Math.min(16, Math.floor(numeric)));
}

function normalizeText(value: unknown, fallback: string): string {
  const text = String(value || '').trim();
  return text || fallback;
}

function isExpired(policy: ZavorthPersistentApprovalPolicy, now: Date): boolean {
  return Boolean(policy.expiresAt && policy.expiresAt <= now.toISOString());
}

function renderStatus(status: ZavorthTrustApprovalUxStatus): string {
  if (status === 'ready') return tService('approval.status_ready');
  if (status === 'danger') return tService('approval.status_danger');
  return tService('approval.status_attention');
}

function toPolicyView(policy: ZavorthPersistentApprovalPolicy): ZavorthTrustApprovalUxPolicyView {
  const {
    reason: _reason,
    ...view
  } = policy;
  return view;
}
