import type {
  GovernedReviewFindingVerificationStatus,
  GovernedReviewPolicyGateAction,
  GovernedReviewResult,
  GovernedReviewSeverity,
} from './GovernedReviewTypes.js';

export type GovernedReviewZavorthControlLaneStatus =
  | 'ready'
  | 'waiting-approval'
  | 'needs-human-review'
  | 'blocked'
  | 'empty';

export type GovernedReviewZavorthControlSnapshot = {
  source: 'GovernedReviewZavorthControlPresenter';
  route: '/control/reviews';
  contractVersion: GovernedReviewResult['contractVersion'];
  reviewId: string;
  mode: GovernedReviewResult['mode'];
  status: GovernedReviewResult['status'];
  headline: string;
  summary: string;
  objective: string;
  counters: {
    files: number;
    agents: number;
    plannedSubagents: number;
    acceptedFindings: number;
    humanReviewFindings: number;
    discardedFindings: number;
    receipts: number;
    approvalRequiredActions: number;
    executedActions: number;
    liveWorkerResults: number;
  };
  lanes: Array<{
    id: string;
    label: string;
    status: GovernedReviewZavorthControlLaneStatus;
    detail: string;
  }>;
  findings: Array<{
    id: string;
    title: string;
    severity: GovernedReviewSeverity;
    confidence: number;
    status: GovernedReviewFindingVerificationStatus;
    location: string;
    sourceAgentId: string;
    recommendation: string;
  }>;
  actions: Array<{
    id: GovernedReviewPolicyGateAction;
    label: string;
    enabled: boolean;
    requiresApproval: boolean;
    detail: string;
  }>;
  receipts: Array<{
    id: string;
    kind: string;
    status: string;
    detail: string;
  }>;
};

export function buildGovernedReviewZavorthControlSnapshot(
  review: GovernedReviewResult,
): GovernedReviewZavorthControlSnapshot {
  const approvalActions = review.policyGate.decisions.filter((decision) => decision.requiresApproval);
  return {
    source: 'GovernedReviewZavorthControlPresenter',
    route: '/control/reviews',
    contractVersion: review.contractVersion,
    reviewId: review.reviewId,
    mode: review.mode,
    status: review.status,
    headline: headlineForReview(review),
    summary: review.summary,
    objective: review.objective,
    counters: {
      files: review.context.files.length,
      agents: review.agentPlan.length,
      plannedSubagents: review.agentRuntimePlan.subagentReceipts.length,
      acceptedFindings: review.verification.acceptedFindingCount,
      humanReviewFindings: review.verification.needsHumanReviewFindingCount,
      discardedFindings: review.verification.discardedFindingCount,
      receipts: review.receipts.length,
      approvalRequiredActions: approvalActions.length,
      executedActions: review.execution.outcomes.filter((outcome) =>
        outcome.status === 'completed' || outcome.status === 'prepared'
      ).length,
      liveWorkerResults: review.execution.liveAgentSnapshot?.workerResults || 0,
    },
    lanes: buildLanes(review),
    findings: [
      ...review.verification.acceptedFindings,
      ...review.verification.needsHumanReviewFindings,
    ]
      .slice(0, 12)
      .map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        confidence: finding.confidence,
        status: finding.verification.status,
        location: formatLocation(finding.file, finding.line),
        sourceAgentId: finding.sourceAgentId,
        recommendation: finding.recommendation,
      })),
    actions: review.policyGate.decisions.map((decision) => ({
      id: decision.action,
      label: labelForAction(decision.action),
      enabled: decision.allowed,
      requiresApproval: decision.requiresApproval,
      detail: decision.reason,
    })),
    receipts: review.receipts.slice(-12).map((receipt) => ({
      id: receipt.id,
      kind: receipt.kind,
      status: receipt.status,
      detail: receipt.detail,
    })),
  };
}

function buildLanes(review: GovernedReviewResult): GovernedReviewZavorthControlSnapshot['lanes'] {
  return [
    {
      id: 'context',
      label: 'Context',
      status: review.context.files.length > 0 ? 'ready' : 'empty',
      detail: `${review.context.files.length} file(s), source=${review.context.source}`,
    },
    {
      id: 'agents',
      label: 'Agents',
      status: review.agentRuntimePlan.status === 'waiting-approval' ? 'waiting-approval' : 'ready',
      detail: `${review.agentPlan.length} role(s), ${review.agentRuntimePlan.subagentReceipts.length} planned receipt(s)`,
    },
    {
      id: 'verification',
      label: 'Verifier',
      status: review.verification.needsHumanReviewFindingCount > 0 ? 'needs-human-review' : 'ready',
      detail: `${review.verification.acceptedFindingCount} accepted, ${review.verification.needsHumanReviewFindingCount} need human review`,
    },
    {
      id: 'policy',
      label: 'Policy Gate',
      status: review.policyGate.status === 'blocked'
        ? 'blocked'
        : review.policyGate.status === 'allow-approved-actions'
          ? 'ready'
          : 'waiting-approval',
      detail: review.policyGate.summary,
    },
    {
      id: 'actions',
      label: 'Approved Actions',
      status: actionLaneStatus(review),
      detail: review.execution.summary,
    },
    {
      id: 'receipts',
      label: 'Receipts',
      status: review.receipts.length > 0 ? 'ready' : 'empty',
      detail: `${review.receipts.length} receipt(s), no mutation applied=${review.policy.noMutationApplied}`,
    },
  ];
}

function actionLaneStatus(review: GovernedReviewResult): GovernedReviewZavorthControlLaneStatus {
  if (review.execution.status === 'not-requested') {
    return 'empty';
  }
  if (review.execution.status === 'approval-required') {
    return 'waiting-approval';
  }
  if (review.execution.status === 'blocked' || review.execution.status === 'failed') {
    return 'blocked';
  }
  return 'ready';
}

function headlineForReview(review: GovernedReviewResult): string {
  if (review.verification.acceptedFindingCount > 0) {
    return `${review.verification.acceptedFindingCount} governed finding(s) ready for review`;
  }
  if (review.verification.needsHumanReviewFindingCount > 0) {
    return `${review.verification.needsHumanReviewFindingCount} finding(s) need human confirmation`;
  }
  return 'Governed review preview ready';
}

function formatLocation(file: string | undefined, line: number | undefined): string {
  if (!file) {
    return 'workspace';
  }
  if (!line) {
    return file;
  }
  return `${file}:${line}`;
}

function labelForAction(action: GovernedReviewPolicyGateAction): string {
  switch (action) {
    case 'show-findings':
      return 'Show findings';
    case 'request-human-review':
      return 'Request human review';
    case 'comment-on-pr':
      return 'Comment on PR';
    case 'apply-patch':
      return 'Apply patch';
    case 'launch-live-agents':
      return 'Launch live agents';
    default:
      return action;
  }
}
