import { createHash, randomUUID } from 'node:crypto';
import { ReviewContextCollector } from './ReviewContextCollector.js';
import { ReviewFindingNormalizer } from './ReviewFindingNormalizer.js';
import { ReviewAgentOrchestrator } from './ReviewAgentOrchestrator.js';
import { ReviewFindingVerifier } from './ReviewFindingVerifier.js';
import { ReviewPolicyGate } from './ReviewPolicyGate.js';
import { ReviewReceiptBuilder } from './ReviewReceiptBuilder.js';
import {
  ReviewActionExecutor,
  createEmptyExecution,
} from './ReviewActionExecutor.js';
import {
  GOVERNED_REVIEW_CONTRACT_VERSION,
  type GovernedReviewAgentRole,
  type GovernedReviewMode,
  type GovernedReviewRequest,
  type GovernedReviewResult,
  type GovernedReviewStatus,
} from './GovernedReviewTypes.js';

export class GovernedReviewService {
  private readonly contextCollector: ReviewContextCollector;
  private readonly findingNormalizer: ReviewFindingNormalizer;
  private readonly agentOrchestrator: ReviewAgentOrchestrator;
  private readonly findingVerifier: ReviewFindingVerifier;
  private readonly policyGate: ReviewPolicyGate;
  private readonly receiptBuilder: ReviewReceiptBuilder;
  private readonly actionExecutor: ReviewActionExecutor;

  constructor(runtime: {
    contextCollector?: ReviewContextCollector;
    findingNormalizer?: ReviewFindingNormalizer;
    agentOrchestrator?: ReviewAgentOrchestrator;
    findingVerifier?: ReviewFindingVerifier;
    policyGate?: ReviewPolicyGate;
    receiptBuilder?: ReviewReceiptBuilder;
    actionExecutor?: ReviewActionExecutor;
  } = {}) {
    this.contextCollector = runtime.contextCollector || new ReviewContextCollector();
    this.findingNormalizer = runtime.findingNormalizer || new ReviewFindingNormalizer();
    this.agentOrchestrator = runtime.agentOrchestrator || new ReviewAgentOrchestrator();
    this.findingVerifier = runtime.findingVerifier || new ReviewFindingVerifier();
    this.policyGate = runtime.policyGate || new ReviewPolicyGate();
    this.receiptBuilder = runtime.receiptBuilder || new ReviewReceiptBuilder();
    this.actionExecutor = runtime.actionExecutor || new ReviewActionExecutor();
  }

  public run(request: GovernedReviewRequest): GovernedReviewResult {
    const objective = normalizeText(request.objective, 'Governed review');
    const mode = normalizeMode(request.mode, objective);
    const reviewId = normalizeText(request.reviewId) || this.createReviewId(mode, objective);
    const context = this.contextCollector.collect(request);
    const agentPlan = this.buildAgentPlan(mode, objective);
    const agentRuntimePlan = this.agentOrchestrator.compile({
      reviewId,
      mode,
      objective,
      context,
      agentPlan,
    });
    const normalizedFindings = this.findingNormalizer.normalize(request.rawFindings);
    const verification = this.findingVerifier.verify({
      findings: normalizedFindings,
      context,
    });
    const policyGate = this.policyGate.evaluate({
      agentRuntimePlan,
      verification,
      actions: request.actions,
    });
    const findings = verification.acceptedFindings;
    const receipts = this.receiptBuilder.build({
      reviewId,
      context,
      agentPlan,
      agentRuntimePlan,
      normalizedFindings,
      verification,
      policyGate,
    });
    const status = this.resolveStatus(objective);

    return {
      contractVersion: GOVERNED_REVIEW_CONTRACT_VERSION,
      reviewId,
      mode,
      status,
      objective,
      context,
      agentPlan,
      agentRuntimePlan,
      verification,
      policyGate,
      execution: createEmptyExecution(),
      findings,
      receipts,
      summary: this.buildSummary({
        mode,
        contextFileCount: context.files.length,
        agentCount: agentPlan.length,
        subagentReceiptCount: agentRuntimePlan.subagentReceipts.length,
        findingCount: findings.length,
        needsHumanReviewFindingCount: verification.needsHumanReviewFindingCount,
        discardedFindingCount: verification.discardedFindingCount,
      }),
      nextSafeAction: 'Review accepted findings and human-review queue; PR comments, patches and live agents remain approval-gated.',
      policy: {
        readOnlyPhase: true,
        noMutationApplied: true,
        approvalRequiredBeforeMutation: true,
        externalEgressNotPerformed: true,
      },
    };
  }

  public async runWithActions(request: GovernedReviewRequest): Promise<GovernedReviewResult> {
    const review = this.run(request);
    const actionExecution = await this.actionExecutor.execute({
      review,
      actions: request.actions,
      policyGate: review.policyGate,
    });
    const receipts = [
      ...review.receipts,
      ...actionExecution.receipts,
    ];
    const execution = actionExecution.execution;
    return {
      ...review,
      status: this.resolveExecutionStatus(review.status, execution.status),
      execution,
      receipts,
      summary: `${review.summary} ${execution.summary}`,
      nextSafeAction: execution.nextSafeAction,
      policy: {
        ...review.policy,
        noMutationApplied: !execution.outcomes.some((outcome) =>
          outcome.action === 'apply-patch'
          && outcome.status === 'completed'
          && outcome.metadata.workspaceMutationPerformed === true
        ),
        externalEgressNotPerformed: !execution.liveAgentSnapshot?.externalIoPerformed
          && !execution.outcomes.some((outcome) => outcome.metadata.externalIoPerformed === true),
      },
    };
  }

  private resolveExecutionStatus(
    baseStatus: GovernedReviewStatus,
    executionStatus: GovernedReviewResult['execution']['status'],
  ): GovernedReviewStatus {
    if (executionStatus === 'approval-required') {
      return 'waiting_approval';
    }
    if (executionStatus === 'blocked') {
      return 'blocked';
    }
    if (executionStatus === 'failed') {
      return 'failed';
    }
    return baseStatus;
  }

  private buildAgentPlan(mode: GovernedReviewMode, objective: string): GovernedReviewAgentRole[] {
    const base: GovernedReviewAgentRole[] = [
      this.role('context-agent', 'context', 'Context Agent', `Collect diff, instructions and local review context for: ${objective}`),
      this.role('bug-review-agent', 'bug-review', 'Bug Review Agent', 'Look for correctness bugs, broken assumptions and regression risks.'),
      this.role('policy-review-agent', 'policy-review', 'Policy Review Agent', 'Compare the change against repository instructions and Zavorth governance boundaries.'),
      this.role('verifier-agent', 'verifier', 'Verifier Agent', 'Deduplicate findings and prepare confidence scoring in the next phase.'),
    ];

    if (mode === 'security-review' || mode === 'code-review') {
      base.splice(2, 0, this.role(
        'security-review-agent',
        'security-review',
        'Security Review Agent',
        'Look for injection, secret exposure, unsafe command, workspace escape and egress risks.',
      ));
    }

    if (mode === 'regression-review') {
      base.splice(2, 0, this.role(
        'regression-review-agent',
        'regression-review',
        'Regression Review Agent',
        'Focus on changed behavior, test gaps and compatibility risks.',
      ));
    }

    return base;
  }

  private role(
    id: GovernedReviewAgentRole['id'],
    kind: GovernedReviewAgentRole['kind'],
    label: string,
    objective: string,
  ): GovernedReviewAgentRole {
    return {
      id,
      kind,
      label,
      objective,
      readOnly: true,
      requiresApprovalBeforeMutation: true,
      policyTags: [
        'governed-review',
        'phase-4',
        'read-only',
        `role:${kind}`,
      ],
    };
  }

  private resolveStatus(objective: string): GovernedReviewStatus {
    return objective ? 'completed' : 'failed';
  }

  private buildSummary(input: {
    mode: GovernedReviewMode;
    contextFileCount: number;
    agentCount: number;
    subagentReceiptCount: number;
    findingCount: number;
    needsHumanReviewFindingCount: number;
    discardedFindingCount: number;
  }): string {
    return [
      `Governed ${input.mode} kernel completed in read-only mode.`,
      `${input.agentCount} review role(s) planned.`,
      `${input.subagentReceiptCount} governed subagent receipt(s) prepared.`,
      `${input.contextFileCount} context file(s) recorded.`,
      `${input.findingCount} finding(s) accepted.`,
      `${input.needsHumanReviewFindingCount} finding(s) need human review.`,
      `${input.discardedFindingCount} finding(s) discarded by verifier.`,
    ].join(' ');
  }

  private createReviewId(mode: GovernedReviewMode, objective: string): string {
    const digest = createHash('sha256')
      .update(mode)
      .update('\n')
      .update(objective)
      .update('\n')
      .update(randomUUID())
      .digest('hex')
      .slice(0, 16);
    return `gr_${digest}`;
  }
}

function normalizeMode(mode: unknown, objective: string): GovernedReviewMode {
  if (
    mode === 'code-review'
    || mode === 'security-review'
    || mode === 'policy-review'
    || mode === 'regression-review'
  ) {
    return mode;
  }
  const normalized = objective.toLowerCase();
  if (/\bsecurity|secret|vulnerab|injection|auth|permission\b/.test(normalized)) {
    return 'security-review';
  }
  if (/\bpolicy|governance|approval|receipt|broker\b/.test(normalized)) {
    return 'policy-review';
  }
  if (/\bregression|compat|break|test\b/.test(normalized)) {
    return 'regression-review';
  }
  return 'code-review';
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}
