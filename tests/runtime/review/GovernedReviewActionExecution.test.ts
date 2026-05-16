import {
  GovernedReviewService,
  ReviewActionExecutor,
  type GovernedReviewExternalActionAdapter,
} from '../../../src/runtime/review';

describe('GovernedReviewService action execution', () => {
  it('keeps live agents, PR comments and patches blocked until approval exists', async () => {
    const result = await new GovernedReviewService().runWithActions({
      reviewId: 'review-actions-no-approval',
      mode: 'security-review',
      objective: 'review auth changes with live agents',
      files: [{ path: 'src/auth.ts', status: 'modified' }],
      actions: {
        launchLiveAgents: true,
        commentOnPr: true,
        prTarget: '12',
        applyPatch: true,
      },
    });

    expect(result.status).toBe('waiting_approval');
    expect(result.execution.status).toBe('approval-required');
    expect(result.execution.liveAgentSnapshot).toBeNull();
    expect(result.execution.outcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'launch-live-agents', status: 'approval-required', allowed: false }),
      expect.objectContaining({ action: 'comment-on-pr', status: 'approval-required', allowed: false }),
      expect.objectContaining({ action: 'apply-patch', status: 'approval-required', allowed: false }),
    ]));
    expect(result.receipts.map((receipt) => receipt.kind)).toEqual(expect.arrayContaining([
      'live-agents-launched',
      'pr-comment-prepared',
      'patch-applied',
    ]));
  });

  it('launches governed live agents with approval and keeps the run receipt-backed', async () => {
    const result = await new GovernedReviewService().runWithActions({
      reviewId: 'review-actions-live-approved',
      mode: 'security-review',
      objective: 'review auth changes with multiagent auditors',
      files: [{ path: 'src/auth.ts', status: 'modified' }],
      actions: {
        approvalId: 'approval-live-1',
        launchLiveAgents: true,
        liveAgentMode: 'mock-live',
        maxLiveWorkers: 3,
        persistSubagentState: false,
      },
    });

    expect(result.status).toBe('completed');
    expect(result.policyGate.status).toBe('allow-approved-actions');
    expect(result.execution.status).toBe('completed');
    expect(result.execution.liveAgentSnapshot).toEqual(expect.objectContaining({
      status: 'completed',
      liveRuns: 1,
      externalIoPerformed: false,
    }));
    expect(result.execution.liveAgentSnapshot?.workerResults).toBeGreaterThan(0);
    expect(result.execution.outcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'launch-live-agents',
        status: 'completed',
        allowed: true,
        approvalId: 'approval-live-1',
      }),
    ]));
    expect(result.receipts.map((receipt) => receipt.kind)).toEqual(expect.arrayContaining([
      'live-agents-launched',
    ]));
  });

  it('executes approved PR comment and patch adapters without bypassing receipts', async () => {
    const adapter: GovernedReviewExternalActionAdapter = {
      postPullRequestComment: jest.fn(async () => ({
        status: 'completed',
        summary: 'Posted governed review comment.',
        metadata: { externalIoPerformed: true, prTarget: '34' },
      })),
      applyPatch: jest.fn(async () => ({
        status: 'completed',
        summary: 'Applied approved governed patch.',
        metadata: { workspaceMutationPerformed: true, filePath: 'output/review.patch' },
      })),
    };
    const service = new GovernedReviewService({
      actionExecutor: new ReviewActionExecutor({ actionAdapter: adapter }),
    });

    const result = await service.runWithActions({
      reviewId: 'review-actions-comment-patch',
      mode: 'code-review',
      objective: 'review code and publish approved output',
      files: [{ path: 'src/a.ts', status: 'modified' }],
      actions: {
        approvalId: 'approval-actions-1',
        commentOnPr: true,
        prTarget: '34',
        applyPatch: true,
        patch: {
          filePath: 'output/review.patch',
          patch: '@@ -1 +1 @@\n-old\n+new\n',
        },
      },
    });

    expect(adapter.postPullRequestComment).toHaveBeenCalledWith(expect.objectContaining({
      prTarget: '34',
      approvalId: 'approval-actions-1',
    }));
    expect(adapter.applyPatch).toHaveBeenCalledWith(expect.objectContaining({
      approvalId: 'approval-actions-1',
    }));
    expect(result.execution.status).toBe('completed');
    expect(result.policy.noMutationApplied).toBe(false);
    expect(result.policy.externalEgressNotPerformed).toBe(false);
    expect(result.receipts.map((receipt) => receipt.kind)).toEqual(expect.arrayContaining([
      'pr-comment-prepared',
      'patch-applied',
    ]));
  });
});
