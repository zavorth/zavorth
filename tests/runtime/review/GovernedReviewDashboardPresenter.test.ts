import {
  buildGovernedReviewDashboardSnapshot,
  GovernedReviewService,
} from '../../../src/runtime/review';

describe('GovernedReviewDashboardPresenter phase 4', () => {
  it('projects governed review results into dashboard-ready lanes, actions and counters', () => {
    const review = new GovernedReviewService().run({
      reviewId: 'review-dashboard-1',
      mode: 'security-review',
      objective: 'review auth token handling before PR comment',
      workspace: 'C:/repo',
      targetRef: 'HEAD',
      baseRef: 'main',
      files: [
        { path: 'src/auth.ts', status: 'modified', additions: 8, deletions: 2 },
      ],
      rawFindings: [
        {
          title: 'Token may be logged',
          severity: 'high',
          confidence: 82,
          file: 'src/auth.ts',
          line: 42,
          evidence: ['logger receives token-like value'],
          recommendation: 'Redact token before logging.',
          sourceAgentId: 'security-review-agent',
        },
        {
          title: 'Refresh fallback needs confirmation',
          severity: 'medium',
          confidence: 60,
          file: 'src/auth.ts',
          evidence: ['fallback changes session behavior'],
          recommendation: 'Ask the owner whether fallback is intended.',
          sourceAgentId: 'verifier-agent',
        },
      ],
    });

    const dashboard = buildGovernedReviewDashboardSnapshot(review);

    expect(dashboard).toEqual(expect.objectContaining({
      source: 'GovernedReviewDashboardPresenter',
      route: '/dashboard/reviews',
      reviewId: 'review-dashboard-1',
      mode: 'security-review',
      headline: '1 governed finding(s) ready for review',
    }));
    expect(dashboard.counters).toEqual(expect.objectContaining({
      files: 1,
      agents: review.agentPlan.length,
      plannedSubagents: review.agentRuntimePlan.subagentReceipts.length,
      acceptedFindings: 1,
      humanReviewFindings: 1,
      receipts: review.receipts.length,
      approvalRequiredActions: 3,
    }));
    expect(dashboard.lanes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'context', status: 'ready' }),
      expect.objectContaining({ id: 'agents', status: 'waiting-approval' }),
      expect.objectContaining({ id: 'verification', status: 'needs-human-review' }),
      expect.objectContaining({ id: 'policy', status: 'waiting-approval' }),
      expect.objectContaining({ id: 'receipts', status: 'ready' }),
    ]));
    expect(dashboard.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Token may be logged',
        location: 'src/auth.ts:42',
        status: 'accepted',
      }),
      expect.objectContaining({
        title: 'Refresh fallback needs confirmation',
        location: 'src/auth.ts',
        status: 'needs-human-review',
      }),
    ]));
    expect(dashboard.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'show-findings', enabled: true, requiresApproval: false }),
      expect.objectContaining({ id: 'comment-on-pr', enabled: false, requiresApproval: true }),
      expect.objectContaining({ id: 'apply-patch', enabled: false, requiresApproval: true }),
      expect.objectContaining({ id: 'launch-live-agents', enabled: false, requiresApproval: true }),
    ]));
    expect(dashboard.receipts.length).toBeGreaterThan(0);
  });
});
