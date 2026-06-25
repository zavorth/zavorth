import { createHash, randomUUID } from 'node:crypto';
import { WorkspaceApplyPatchTool } from '../../tools/workspace/WorkspaceApplyPatchTool.js';
import { ZavorthSubagentInvocationGatewayService } from '../../services/ZavorthSubagentInvocationGatewayService.js';
import type {
  ZavorthSubagentRuntimeSnapshot,
} from '../../contracts/runtime/ZavorthSubagentRuntimeContract.js';
import type {
  GovernedReviewActionOutcome,
  GovernedReviewActionStatus,
  GovernedReviewExecutionSummary,
  GovernedReviewLiveAgentMode,
  GovernedReviewPatchRequest,
  GovernedReviewPolicyGate,
  GovernedReviewPolicyGateAction,
  GovernedReviewReceipt,
  GovernedReviewRequestedActions,
  GovernedReviewResult,
} from './GovernedReviewTypes.js';

export type GovernedReviewActionExecution = {
  execution: GovernedReviewExecutionSummary;
  receipts: GovernedReviewReceipt[];
};

export type GovernedReviewExternalActionAdapter = {
  postPullRequestComment?(input: {
    review: GovernedReviewResult;
    prTarget: string | null;
    body: string;
    approvalId: string;
  }): Promise<ReviewAdapterActionResult>;
  applyPatch?(input: {
    review: GovernedReviewResult;
    patch: GovernedReviewPatchRequest | null;
    approvalId: string;
  }): Promise<ReviewAdapterActionResult>;
};

export type ReviewAdapterActionResult = {
  status: Exclude<GovernedReviewActionStatus, 'not-requested' | 'approval-required'>;
  summary: string;
  metadata?: Record<string, unknown>;
};

type Runtime = {
  subagentGateway?: Pick<ZavorthSubagentInvocationGatewayService, 'invoke'> | null;
  actionAdapter?: GovernedReviewExternalActionAdapter | null;
  now?: () => Date;
};

export class ReviewActionExecutor {
  private readonly subagentGateway: Pick<ZavorthSubagentInvocationGatewayService, 'invoke'>;
  private readonly actionAdapter: GovernedReviewExternalActionAdapter;
  private readonly now: () => Date;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.subagentGateway = runtime.subagentGateway || new ZavorthSubagentInvocationGatewayService();
    this.actionAdapter = runtime.actionAdapter || new DefaultGovernedReviewActionAdapter();
  }

  public async execute(input: {
    review: GovernedReviewResult;
    actions?: GovernedReviewRequestedActions | null;
    policyGate: GovernedReviewPolicyGate;
  }): Promise<GovernedReviewActionExecution> {
    const requestedActions = collectRequestedActions(input.actions);
    if (requestedActions.length === 0) {
      return {
        execution: createEmptyExecution(),
        receipts: [],
      };
    }

    const receipts: GovernedReviewReceipt[] = [];
    const outcomes: GovernedReviewActionOutcome[] = [];
    let liveAgentSnapshot: GovernedReviewExecutionSummary['liveAgentSnapshot'] = null;

    for (const action of requestedActions) {
      const decision = input.policyGate.decisions.find((entry) => entry.action === action);
      if (!decision?.allowed) {
        const outcome = this.blockedOutcome(action, input.actions, decision?.requiresApproval ? 'approval-required' : 'blocked', decision?.reason);
        outcomes.push(outcome);
        receipts.push(this.receiptForOutcome(outcome, action));
        continue;
      }

      if (action === 'launch-live-agents') {
        const result = await this.launchLiveAgents(input.review, input.actions || {});
        liveAgentSnapshot = result.liveAgentSnapshot;
        outcomes.push(result.outcome);
        receipts.push(this.receiptForOutcome(result.outcome, action));
        continue;
      }

      if (action === 'comment-on-pr') {
        const outcome = await this.preparePrComment(input.review, input.actions || {});
        outcomes.push(outcome);
        receipts.push(this.receiptForOutcome(outcome, action));
        continue;
      }

      if (action === 'apply-patch') {
        const outcome = await this.applyPatch(input.review, input.actions || {});
        outcomes.push(outcome);
        receipts.push(this.receiptForOutcome(outcome, action));
      }
    }

    return {
      execution: {
        source: 'ReviewActionExecutor',
        status: resolveExecutionStatus(outcomes),
        approvalId: normalizeText(input.actions?.approvalId),
        requestedActions,
        outcomes,
        liveAgentSnapshot,
        summary: summarizeOutcomes(outcomes),
        nextSafeAction: nextSafeActionForOutcomes(outcomes),
      },
      receipts,
    };
  }

  private async launchLiveAgents(
    review: GovernedReviewResult,
    actions: GovernedReviewRequestedActions,
  ): Promise<{
    outcome: GovernedReviewActionOutcome;
    liveAgentSnapshot: NonNullable<GovernedReviewExecutionSummary['liveAgentSnapshot']>;
  }> {
    const approvalId = normalizeText(actions.approvalId) || 'approved-governed-review';
    try {
      const mode = normalizeLiveAgentMode(actions.liveAgentMode);
      const snapshot = await this.subagentGateway.invoke({
        source: 'internal',
        text: buildLiveAgentTask(review),
        channel: 'governed-review',
        actorId: normalizeText(review.context.metadata.userId) || 'governed-review',
        mode: 'oneshot',
        roleIds: mapReviewRolesToSubagentProfiles(review),
        approvalId,
        live: mode === 'live-llm',
        mockLive: mode === 'mock-live',
        maxLiveWorkers: positiveInteger(actions.maxLiveWorkers, Math.min(4, review.agentPlan.length)),
        maxToolCalls: positiveInteger(actions.maxToolCalls, 4),
        persistState: actions.persistSubagentState === true,
        securityProfile: review.mode === 'security-review' ? 'strict' : null,
      });
      const liveAgentSnapshot = summarizeLiveSnapshot(snapshot);
      return {
        liveAgentSnapshot,
        outcome: this.outcome('launch-live-agents', liveAgentSnapshot.status === 'completed' ? 'completed' : 'blocked', true, approvalId, {
          summary: `Live review agents executed with status=${liveAgentSnapshot.status}.`,
          metadata: {
            selectedRunId: liveAgentSnapshot.selectedRunId,
            workerResults: liveAgentSnapshot.workerResults,
            failedWorkerResults: liveAgentSnapshot.failedWorkerResults,
            liveRuns: liveAgentSnapshot.liveRuns,
            externalIoPerformed: liveAgentSnapshot.externalIoPerformed,
            mode,
          },
        }),
      };
    } catch (error) {
      return {
        liveAgentSnapshot: {
          status: 'failed',
          selectedRunId: null,
          workerResults: 0,
          failedWorkerResults: 0,
          liveRuns: 0,
          externalIoPerformed: false,
          outputPreview: '',
        },
        outcome: this.outcome('launch-live-agents', 'failed', true, approvalId, {
          summary: `Live review agents failed: ${error instanceof Error ? error.message : String(error)}`,
          metadata: { error: error instanceof Error ? error.message : String(error) },
        }),
      };
    }
  }

  private async preparePrComment(
    review: GovernedReviewResult,
    actions: GovernedReviewRequestedActions,
  ): Promise<GovernedReviewActionOutcome> {
    const approvalId = normalizeText(actions.approvalId) || 'approved-governed-review';
    const result = await this.actionAdapter.postPullRequestComment?.({
      review,
      prTarget: normalizeText(actions.prTarget),
      body: buildPrCommentBody(review),
      approvalId,
    }) || {
      status: 'blocked' as const,
      summary: 'No PR comment adapter is configured.',
      metadata: {},
    };
    return this.outcome('comment-on-pr', result.status, result.status !== 'blocked' && result.status !== 'failed', approvalId, {
      summary: result.summary,
      metadata: result.metadata || {},
    });
  }

  private async applyPatch(
    review: GovernedReviewResult,
    actions: GovernedReviewRequestedActions,
  ): Promise<GovernedReviewActionOutcome> {
    const approvalId = normalizeText(actions.approvalId) || 'approved-governed-review';
    const result = await this.actionAdapter.applyPatch?.({
      review,
      patch: actions.patch || null,
      approvalId,
    }) || {
      status: 'blocked' as const,
      summary: 'No patch adapter is configured.',
      metadata: {},
    };
    return this.outcome('apply-patch', result.status, result.status !== 'blocked' && result.status !== 'failed', approvalId, {
      summary: result.summary,
      metadata: result.metadata || {},
    });
  }

  private blockedOutcome(
    action: GovernedReviewPolicyGateAction,
    actions: GovernedReviewRequestedActions | null | undefined,
    status: 'approval-required' | 'blocked',
    reason?: string,
  ): GovernedReviewActionOutcome {
    return this.outcome(action, status, false, normalizeText(actions?.approvalId), {
      summary: reason || 'Action blocked by ReviewPolicyGate.',
      metadata: { policyGate: 'blocked-before-execution' },
    });
  }

  private outcome(
    action: GovernedReviewPolicyGateAction,
    status: GovernedReviewActionStatus,
    allowed: boolean,
    approvalId: string | null,
    details: {
      summary: string;
      metadata?: Record<string, unknown>;
    },
  ): GovernedReviewActionOutcome {
    return {
      action,
      status,
      allowed,
      approvalId,
      summary: details.summary,
      receiptId: createReceiptId(action, details.summary),
      metadata: details.metadata || {},
    };
  }

  private receiptForOutcome(
    outcome: GovernedReviewActionOutcome,
    action: GovernedReviewPolicyGateAction,
  ): GovernedReviewReceipt {
    return {
      id: outcome.receiptId,
      kind: receiptKindForAction(action),
      generatedAt: this.now().toISOString(),
      source: 'ReviewActionExecutor',
      status: outcome.status === 'approval-required'
        ? 'needs-approval'
        : outcome.status === 'blocked' || outcome.status === 'failed'
          ? 'blocked'
          : 'ready',
      detail: outcome.summary,
      metadata: {
        action,
        approvalId: outcome.approvalId,
        allowed: outcome.allowed,
        status: outcome.status,
        ...outcome.metadata,
      },
    };
  }
}

class DefaultGovernedReviewActionAdapter implements GovernedReviewExternalActionAdapter {
  public async postPullRequestComment(input: {
    prTarget: string | null;
    body: string;
    approvalId: string;
  }): Promise<ReviewAdapterActionResult> {
    if (!input.prTarget) {
      return {
        status: 'blocked',
        summary: 'PR comment approved but no PR target was provided.',
        metadata: {
          requiredFlag: '--pr=<number-or-url>',
        },
      };
    }
    return {
      status: 'prepared',
      summary: `PR comment packet prepared for ${input.prTarget}; adapter can post it after connector binding.`,
      metadata: {
        prTarget: input.prTarget,
        approvalId: input.approvalId,
        bodyPreview: input.body.slice(0, 1200),
        commandHint: `gh pr comment ${input.prTarget} --body-file <governed-review-comment.md>`,
        externalIoPerformed: false,
      },
    };
  }

  public async applyPatch(input: {
    patch: GovernedReviewPatchRequest | null;
    approvalId: string;
  }): Promise<ReviewAdapterActionResult> {
    if (!input.patch?.filePath || !input.patch.patch.trim()) {
      return {
        status: 'prepared',
        summary: 'Patch action approved; no patch payload was provided, so the runtime prepared the approval packet only.',
        metadata: {
          approvalId: input.approvalId,
          requiredFlags: ['--patch-file=<output/path>', '--patch=<unified-patch>'],
          workspaceMutationPerformed: false,
        },
      };
    }

    const raw = await new WorkspaceApplyPatchTool().execute({
      filepath: input.patch.filePath,
      patch: input.patch.patch,
      dryRun: input.patch.dryRun === true,
    });
    const parsed = parseJsonObject(raw);
    const success = parsed.success === true;
    const applied = parsed.applied === true;
    return {
      status: success ? 'completed' : 'failed',
      summary: success
        ? `Patch ${applied ? 'applied' : 'validated'} for ${input.patch.filePath}.`
        : `Patch failed for ${input.patch.filePath}.`,
      metadata: {
        approvalId: input.approvalId,
        tool: 'workspace.apply_patch',
        result: parsed,
        workspaceMutationPerformed: applied,
      },
    };
  }
}

export function createEmptyExecution(): GovernedReviewExecutionSummary {
  return {
    source: 'ReviewActionExecutor',
    status: 'not-requested',
    approvalId: null,
    requestedActions: [],
    outcomes: [],
    liveAgentSnapshot: null,
    summary: 'No approval-gated governed review actions were requested.',
    nextSafeAction: 'Review findings, then request explicit approval for live agents, PR comments or patches.',
  };
}

function collectRequestedActions(actions: GovernedReviewRequestedActions | null | undefined): GovernedReviewPolicyGateAction[] {
  const requested: GovernedReviewPolicyGateAction[] = [];
  if (actions?.launchLiveAgents === true) {
    requested.push('launch-live-agents');
  }
  if (actions?.commentOnPr === true) {
    requested.push('comment-on-pr');
  }
  if (actions?.applyPatch === true) {
    requested.push('apply-patch');
  }
  return requested;
}

function normalizeLiveAgentMode(value: unknown): GovernedReviewLiveAgentMode {
  if (value === 'live-llm' || value === 'governed-in-process' || value === 'mock-live') {
    return value;
  }
  return 'mock-live';
}

function mapReviewRolesToSubagentProfiles(review: GovernedReviewResult): string[] {
  const ids = review.agentPlan.map((role) => {
    switch (role.kind) {
      case 'context':
        return 'researcher';
      case 'bug-review':
      case 'regression-review':
        return 'qa';
      case 'security-review':
      case 'policy-review':
      case 'verifier':
      default:
        return 'auditor';
    }
  });
  return Array.from(new Set(ids));
}

function buildLiveAgentTask(review: GovernedReviewResult): string {
  const files = review.context.files.map((file) => file.path).slice(0, 12).join(', ') || 'no explicit files';
  return [
    `Use subagentes governados em paralelo para revisar: ${review.objective}`,
    `Mode: ${review.mode}`,
    `Files: ${files}`,
    'Boundary: read-only analysis, no workspace mutation, no PR comment, no shell commands.',
    'Return concrete findings with evidence, confidence and recommendation.',
  ].join('\n');
}

function summarizeLiveSnapshot(snapshot: ZavorthSubagentRuntimeSnapshot): NonNullable<GovernedReviewExecutionSummary['liveAgentSnapshot']> {
  const selectedRun = snapshot.runs.find((run) => run.runId === snapshot.selectedRunId) || snapshot.runs.at(-1);
  return {
    status: snapshot.status,
    selectedRunId: snapshot.selectedRunId,
    workerResults: snapshot.summary.workerResults,
    failedWorkerResults: snapshot.summary.failedWorkerResults,
    liveRuns: snapshot.summary.liveRuns,
    externalIoPerformed: snapshot.summary.externalIoPerformed,
    outputPreview: (selectedRun?.output || '').slice(0, 2000),
  };
}

function buildPrCommentBody(review: GovernedReviewResult): string {
  const lines = [
    `## Zavorth Governed Review`,
    '',
    `- Review: ${review.reviewId}`,
    `- Mode: ${review.mode}`,
    `- Findings accepted: ${review.verification.acceptedFindingCount}`,
    `- Needs human review: ${review.verification.needsHumanReviewFindingCount}`,
    `- Discarded: ${review.verification.discardedFindingCount}`,
    `- Policy gate: ${review.policyGate.status}`,
    '',
  ];
  if (review.findings.length === 0) {
    lines.push('No accepted findings in this governed review result.');
  } else {
    for (const finding of review.findings.slice(0, 10)) {
      lines.push(
        `### ${finding.title}`,
        `- Severity: ${finding.severity}`,
        `- Confidence: ${finding.confidence}`,
        `- Location: ${finding.file || 'workspace'}${finding.line ? `:${finding.line}` : ''}`,
        `- Recommendation: ${finding.recommendation}`,
        '',
      );
    }
  }
  lines.push('Generated by Zavorth Governed Review with approval-gated external posting.');
  return lines.join('\n');
}

function resolveExecutionStatus(outcomes: GovernedReviewActionOutcome[]): GovernedReviewExecutionSummary['status'] {
  if (outcomes.length === 0) {
    return 'not-requested';
  }
  if (outcomes.some((outcome) => outcome.status === 'approval-required')) {
    return 'approval-required';
  }
  if (outcomes.every((outcome) => outcome.status === 'completed' || outcome.status === 'prepared')) {
    return 'completed';
  }
  if (outcomes.some((outcome) => outcome.status === 'completed' || outcome.status === 'prepared')) {
    return 'partial';
  }
  if (outcomes.some((outcome) => outcome.status === 'failed')) {
    return 'failed';
  }
  return 'blocked';
}

function summarizeOutcomes(outcomes: GovernedReviewActionOutcome[]): string {
  if (outcomes.length === 0) {
    return 'No approval-gated governed review actions were requested.';
  }
  const parts = outcomes.map((outcome) => `${outcome.action}=${outcome.status}`);
  return `Governed review actions: ${parts.join(', ')}.`;
}

function nextSafeActionForOutcomes(outcomes: GovernedReviewActionOutcome[]): string {
  if (outcomes.some((outcome) => outcome.status === 'approval-required')) {
    return 'Provide an approval id before launching live agents, posting PR comments or applying patches.';
  }
  if (outcomes.some((outcome) => outcome.status === 'prepared')) {
    return 'Bind the prepared packet to a connector or provide the missing payload to finish execution.';
  }
  return 'Inspect receipts and promote only the actions the operator still wants.';
}

function receiptKindForAction(action: GovernedReviewPolicyGateAction): GovernedReviewReceipt['kind'] {
  if (action === 'launch-live-agents') {
    return 'live-agents-launched';
  }
  if (action === 'comment-on-pr') {
    return 'pr-comment-prepared';
  }
  if (action === 'apply-patch') {
    return 'patch-applied';
  }
  return 'policy-gate-evaluated';
}

function createReceiptId(action: string, detail: string): string {
  const digest = createHash('sha256')
    .update(action)
    .update('\n')
    .update(detail)
    .update('\n')
    .update(randomUUID())
    .digest('hex')
    .slice(0, 16);
  return `gra_${digest}`;
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
