import { createHash } from 'node:crypto';
import type {
  GovernedReviewAgentRole,
  GovernedReviewAgentRuntimePlan,
  GovernedReviewContext,
  GovernedReviewFinding,
  GovernedReviewPolicyGate,
  GovernedReviewReceipt,
  GovernedReviewReceiptKind,
  GovernedReviewVerificationSummary,
} from './GovernedReviewTypes.js';

export class ReviewReceiptBuilder {
  private readonly now: () => Date;

  constructor(runtime: { now?: () => Date } = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public build(input: {
    reviewId: string;
    context: GovernedReviewContext;
    agentPlan: GovernedReviewAgentRole[];
    agentRuntimePlan: GovernedReviewAgentRuntimePlan;
    normalizedFindings: GovernedReviewFinding[];
    verification: GovernedReviewVerificationSummary;
    policyGate: GovernedReviewPolicyGate;
  }): GovernedReviewReceipt[] {
    const generatedAt = this.now().toISOString();
    const receipts: GovernedReviewReceipt[] = [
      this.receipt({
        reviewId: input.reviewId,
        kind: 'review-created',
        generatedAt,
        source: 'GovernedReviewService',
        status: 'ready',
        detail: 'Governed review run was created in read-only phase 4 mode.',
        metadata: { readOnlyPhase: true },
      }),
      this.receipt({
        reviewId: input.reviewId,
        kind: 'context-collected',
        generatedAt,
        source: 'ReviewContextCollector',
        status: input.context.source === 'empty' ? 'empty' : 'ready',
        detail: `Collected ${input.context.files.length} file(s) and ${input.context.instructions.length} instruction item(s).`,
        metadata: {
          workspace: input.context.workspace,
          targetRef: input.context.targetRef,
          baseRef: input.context.baseRef,
        },
      }),
      this.receipt({
        reviewId: input.reviewId,
        kind: 'agent-plan-created',
        generatedAt,
        source: 'GovernedReviewService',
        status: 'ready',
        detail: `Prepared ${input.agentPlan.length} read-only review role(s).`,
        metadata: {
          roles: input.agentPlan.map((role) => role.id),
          approvalRequiredBeforeMutation: true,
        },
      }),
      this.receipt({
        reviewId: input.reviewId,
        kind: 'agent-team-compiled',
        generatedAt,
        source: 'ReviewAgentOrchestrator',
        status: input.agentRuntimePlan.status === 'blocked' ? 'blocked' : 'needs-approval',
        detail: `Compiled ${input.agentRuntimePlan.teamCompiler.summary.roleCount} review subagent contract(s) through AgentTeamCompilerService.`,
        metadata: {
          teamCompilerStatus: input.agentRuntimePlan.teamCompiler.status,
          topology: input.agentRuntimePlan.teamCompiler.topology.mode,
          noSubagentsLaunched: input.agentRuntimePlan.policy.noSubagentsLaunched,
          compilerOnly: input.agentRuntimePlan.policy.compilerOnly,
        },
      }),
      this.receipt({
        reviewId: input.reviewId,
        kind: 'subagent-receipts-prepared',
        generatedAt,
        source: 'subagents/contracts',
        status: input.agentRuntimePlan.subagentReceipts.length > 0 ? 'needs-approval' : 'empty',
        detail: `Prepared ${input.agentRuntimePlan.subagentReceipts.length} subagent result receipt(s) with zero budget.`,
        metadata: {
          roleIds: input.agentRuntimePlan.roleLinks.map((link) => link.roleId),
          allBudgetsZero: input.agentRuntimePlan.roleLinks.every((link) => link.budgetZero),
          allScopesBlocked: input.agentRuntimePlan.roleLinks.every((link) => link.scopeMode === 'blocked'),
        },
      }),
      this.receipt({
        reviewId: input.reviewId,
        kind: 'finding-normalized',
        generatedAt,
        source: 'ReviewFindingNormalizer',
        status: input.normalizedFindings.length > 0 ? 'ready' : 'empty',
        detail: `Normalized ${input.normalizedFindings.length} finding(s).`,
        metadata: {
          highConfidenceCount: input.normalizedFindings.filter((finding) => finding.confidence >= 80).length,
        },
      }),
      this.receipt({
        reviewId: input.reviewId,
        kind: 'finding-scored',
        generatedAt,
        source: 'ReviewConfidenceScorer',
        status: input.verification.inputFindingCount > 0 ? 'ready' : 'empty',
        detail: `Scored ${input.verification.inputFindingCount} finding(s) with threshold ${input.verification.acceptedThreshold}.`,
        metadata: {
          acceptedThreshold: input.verification.acceptedThreshold,
          humanReviewThreshold: input.verification.humanReviewThreshold,
        },
      }),
      this.receipt({
        reviewId: input.reviewId,
        kind: 'finding-verified',
        generatedAt,
        source: 'ReviewFindingVerifier',
        status: input.verification.acceptedFindingCount > 0 ? 'ready' : 'empty',
        detail: `${input.verification.acceptedFindingCount} accepted, ${input.verification.needsHumanReviewFindingCount} need human review, ${input.verification.discardedFindingCount} discarded.`,
        metadata: {
          acceptedFindingCount: input.verification.acceptedFindingCount,
          needsHumanReviewFindingCount: input.verification.needsHumanReviewFindingCount,
          discardedFindingCount: input.verification.discardedFindingCount,
        },
      }),
      this.receipt({
        reviewId: input.reviewId,
        kind: 'policy-gate-evaluated',
        generatedAt,
        source: 'ReviewPolicyGate',
        status: input.policyGate.status === 'blocked'
          ? 'blocked'
          : input.policyGate.status === 'approval-required'
            ? 'needs-approval'
            : 'ready',
        detail: input.policyGate.summary,
        metadata: {
          decisions: input.policyGate.decisions.map((decision) => ({
            action: decision.action,
            allowed: decision.allowed,
            requiresApproval: decision.requiresApproval,
          })),
        },
      }),
      this.receipt({
        reviewId: input.reviewId,
        kind: 'policy-boundary',
        generatedAt,
        source: 'GovernedReviewService',
        status: 'needs-approval',
        detail: 'Connector registry scores, verifies and surfaces findings but performs no mutation, PR comment, external egress or patch application.',
        metadata: {
          noMutationApplied: true,
          externalEgressNotPerformed: true,
          approvalRequiredBeforeLaunch: true,
        },
      }),
      this.receipt({
        reviewId: input.reviewId,
        kind: 'review-completed',
        generatedAt,
        source: 'GovernedReviewService',
        status: 'ready',
        detail: 'Governed review kernel completed and produced an auditable result object.',
        metadata: {
          findingCount: input.verification.acceptedFindingCount,
          inputFindingCount: input.verification.inputFindingCount,
        },
      }),
    ];
    return receipts;
  }

  private receipt(input: {
    reviewId: string;
    kind: GovernedReviewReceiptKind;
    generatedAt: string;
    source: string;
    status: GovernedReviewReceipt['status'];
    detail: string;
    metadata: Record<string, unknown>;
  }): GovernedReviewReceipt {
    return {
      id: `grr_${hashStable({
        reviewId: input.reviewId,
        kind: input.kind,
        source: input.source,
        detail: input.detail,
      }).slice(0, 16)}`,
      kind: input.kind,
      generatedAt: input.generatedAt,
      source: input.source,
      status: input.status,
      detail: input.detail,
      metadata: { ...input.metadata },
    };
  }
}

function hashStable(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}
