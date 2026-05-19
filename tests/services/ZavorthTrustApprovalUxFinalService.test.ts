import { ZavorthTrustApprovalUxFinalService } from '../../src/services/ZavorthTrustApprovalUxFinalService.js';

const NOW = new Date('2026-05-18T12:00:00.000Z');

function makeTrustOverview(overrides: any = {}) {
  return {
    buildSnapshot: jest.fn(() => ({
      generatedAt: NOW.toISOString(),
      workspaceRoot: 'C:/zavorth',
      summary: {
        posture: 'healthy',
        healthyPlanes: 3,
        attentionPlanes: 0,
        criticalPlanes: 0,
        tenants: 1,
        pendingOnboarding: 0,
        restrictedShared: 0,
        pendingApprovals: 0,
        highRiskCapabilities: 0,
        trustedPlugins: 0,
        restrictedNodes: 0,
        recommendedActions: 0,
        ...overrides.summary,
      },
      cards: [],
      actions: [],
      sourceSnapshots: {},
      narrative: {
        headline: 'Trust Overview',
        operatorSummary: 'ok',
        nextAction: 'none',
      },
    })),
  };
}

function makePersistentApprovals(policies: any[] = []) {
  const service = {
    revoked: [] as string[],
    buildSnapshot: jest.fn(() => ({
      contractVersion: 'zavorth-persistent-approval-policy/1',
      surface: 'persistent-approval-policy',
      generatedAt: NOW.toISOString(),
      policies,
      summary: {
        total: policies.length,
        enabled: policies.filter((policy) => policy.enabled).length,
        expired: policies.filter((policy) => Boolean(policy.expiresAt && policy.expiresAt <= NOW.toISOString())).length,
        broadPolicies: policies.filter((policy) => policy.actions?.includes('*') || policy.maxRisk === 'high').length,
        breakGlassActive: policies.filter((policy) => policy.enabled && policy.mode === 'break-glass').length,
      },
      safety: {
        noCriticalAutoApproval: true,
        breakGlassStillHasHardStops: true,
        breakGlassRequiresDoubleConfirmation: true,
        destructivePreviewMustBeExplicit: true,
        expiresOrCanBeRevoked: true,
        receiptRequired: true,
      },
    })),
    revoke: jest.fn((policyId: string) => {
      service.revoked.push(policyId);
      const policy = policies.find((entry) => entry.id === policyId);
      if (policy) policy.enabled = false;
      return Boolean(policy);
    }),
  };
  return service;
}

function policy(id: string, mode: 'standard' | 'break-glass' = 'standard') {
  return {
    id,
    mode,
    label: id,
    surface: 'skill-curator-live-loop',
    enabled: true,
    actions: ['apply-curator-proposal'],
    maxRisk: mode === 'break-glass' ? 'high' : 'medium',
    allowDestructivePreview: true,
    expiresAt: '2026-05-19T12:00:00.000Z',
    createdAt: NOW.toISOString(),
    createdBy: 'owner',
    reason: 'test',
    receiptId: `${id}.receipt`,
    usageCount: 0,
    lastUsedAt: null,
    hardStops: mode === 'break-glass' ? ['raw-secret-read'] : [],
  };
}

describe('ZavorthTrustApprovalUxFinalService', () => {
  it('builds a unified ready snapshot with approval safety guarantees', () => {
    const service = new ZavorthTrustApprovalUxFinalService({
      now: () => NOW,
      workspaceRoot: 'C:/zavorth',
      trustOverviewService: makeTrustOverview(),
      persistentApprovalPolicyService: makePersistentApprovals(),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-trust-approval-ux-final/1');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.cards.map((card) => card.id)).toEqual(expect.arrayContaining([
      'approval-inbox',
      'persistent-permissions',
      'break-glass',
      'risk-boundary',
    ]));
    expect(snapshot.safety.breakGlassRequiresDoubleConfirmation).toBe(true);
    expect(snapshot.safety.criticalRiskCannotBeAutoApproved).toBe(true);
    expect(snapshot.safety.rawSecretsSerialized).toBe(false);
  });

  it('marks pending approvals and high risk capabilities as attention', () => {
    const service = new ZavorthTrustApprovalUxFinalService({
      now: () => NOW,
      trustOverviewService: makeTrustOverview({
        summary: {
          posture: 'attention',
          pendingApprovals: 2,
          highRiskCapabilities: 1,
        },
      }),
      persistentApprovalPolicyService: makePersistentApprovals([policy('pap-one')]),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.pendingApprovals).toBe(2);
    expect(snapshot.summary.activePersistentPolicies).toBe(1);
    expect(snapshot.actions.some((action) => action.id === 'review-pending-approvals')).toBe(true);
  });

  it('marks active break glass as danger', () => {
    const service = new ZavorthTrustApprovalUxFinalService({
      now: () => NOW,
      trustOverviewService: makeTrustOverview(),
      persistentApprovalPolicyService: makePersistentApprovals([policy('pap-bg', 'break-glass')]),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('danger');
    expect(snapshot.summary.activeBreakGlassPolicies).toBe(1);
    expect(snapshot.cards.find((card) => card.id === 'break-glass')?.status).toBe('danger');
  });

  it('refuses revoke-all without explicit confirmation', () => {
    const approvals = makePersistentApprovals([policy('pap-one')]);
    const service = new ZavorthTrustApprovalUxFinalService({
      now: () => NOW,
      trustOverviewService: makeTrustOverview(),
      persistentApprovalPolicyService: approvals,
    });

    const result = service.revokeAll({ confirm: false });

    expect(result.revokeResult.allowed).toBe(false);
    expect(result.revokeResult.revoked).toBe(0);
    expect(approvals.revoke).not.toHaveBeenCalled();
  });

  it('revokes active persistent approvals only with explicit confirmation', () => {
    const approvals = makePersistentApprovals([policy('pap-one'), policy('pap-bg', 'break-glass')]);
    const service = new ZavorthTrustApprovalUxFinalService({
      now: () => NOW,
      trustOverviewService: makeTrustOverview(),
      persistentApprovalPolicyService: approvals,
    });

    const result = service.revokeAll({ confirm: true });

    expect(result.revokeResult.allowed).toBe(true);
    expect(result.revokeResult.revoked).toBe(2);
    expect(approvals.revoke).toHaveBeenCalledWith('pap-one', expect.any(String));
    expect(approvals.revoke).toHaveBeenCalledWith('pap-bg', expect.any(String));
  });
});
