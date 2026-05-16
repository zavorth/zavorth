import type {
  GovernedReviewAgentRuntimePlan,
  GovernedReviewPolicyGate,
  GovernedReviewPolicyGateAction,
  GovernedReviewPolicyGateDecision,
  GovernedReviewRequestedActions,
  GovernedReviewVerificationSummary,
} from './GovernedReviewTypes.js';

export class ReviewPolicyGate {
  public evaluate(input: {
    agentRuntimePlan: GovernedReviewAgentRuntimePlan;
    verification: GovernedReviewVerificationSummary;
    actions?: GovernedReviewRequestedActions | null;
  }): GovernedReviewPolicyGate {
    const actions = input.actions || null;
    const approvalId = normalizeText(actions?.approvalId);
    const launchRequested = actions?.launchLiveAgents === true;
    const commentRequested = actions?.commentOnPr === true;
    const patchRequested = actions?.applyPatch === true;
    const decisions: GovernedReviewPolicyGateDecision[] = [
      this.decision('show-findings', true, false, 'Read-only findings can be shown without mutation.'),
      this.decision(
        'request-human-review',
        input.verification.needsHumanReviewFindingCount > 0,
        false,
        input.verification.needsHumanReviewFindingCount > 0
          ? 'Speculative findings are available for operator review.'
          : 'No speculative findings require a human review queue.',
      ),
      this.decision(
        'comment-on-pr',
        commentRequested && Boolean(approvalId),
        !commentRequested || !approvalId,
        commentRequested && approvalId
          ? `PR comment packet approved by ${approvalId}.`
          : 'Posting review output externally requires approval.',
      ),
      this.decision(
        'apply-patch',
        patchRequested && Boolean(approvalId),
        !patchRequested || !approvalId,
        patchRequested && approvalId
          ? `Patch action approved by ${approvalId}.`
          : 'Applying patches requires approval and a later mutation phase.',
      ),
      this.decision(
        'launch-live-agents',
        launchRequested && Boolean(approvalId),
        !launchRequested || !approvalId,
        launchRequested && approvalId
          ? `Live subagent launch approved by ${approvalId}.`
          : input.agentRuntimePlan.policy.approvalRequiredBeforeLaunch
            ? 'Compiled subagents cannot launch before explicit approval.'
          : 'Live launch is not enabled for governed review phase 4.',
      ),
    ];
    const requestedMutationActions = decisions.filter((decision) =>
      decision.action === 'comment-on-pr'
      || decision.action === 'apply-patch'
      || decision.action === 'launch-live-agents'
    );
    const approvedActionCount = requestedMutationActions.filter((decision) => decision.allowed).length;
    const requestedMutationActionCount = Number(commentRequested) + Number(patchRequested) + Number(launchRequested);
    const pendingApprovalCount = requestedMutationActions.filter((decision) =>
      decision.requiresApproval
      && (
        (decision.action === 'comment-on-pr' && commentRequested)
        || (decision.action === 'apply-patch' && patchRequested)
        || (decision.action === 'launch-live-agents' && launchRequested)
      )
    ).length;

    return {
      source: 'ReviewPolicyGate',
      status: pendingApprovalCount > 0
        ? 'approval-required'
        : approvedActionCount > 0
          ? 'allow-approved-actions'
          : requestedMutationActionCount === 0
            ? 'approval-required'
          : 'allow-read-only',
      decisions,
      summary: approvedActionCount > 0
        ? `${approvedActionCount} approved governed review action(s) may execute with receipts.`
        : 'Read-only review output is allowed; PR comments, patches and live agent launch remain approval-gated.',
    };
  }

  private decision(
    action: GovernedReviewPolicyGateAction,
    allowed: boolean,
    requiresApproval: boolean,
    reason: string,
  ): GovernedReviewPolicyGateDecision {
    return {
      action,
      allowed,
      requiresApproval,
      reason,
      policyTags: [
        'governed-review',
        'phase-4',
        `action:${action}`,
        allowed ? 'gate:allow' : requiresApproval ? 'gate:approval-required' : 'gate:blocked',
      ],
    };
  }
}

function normalizeText(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}
