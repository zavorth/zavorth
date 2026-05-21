import { createAgentRunApprovalEventIfNeeded } from './AgentRunApprovalEventFactory.js';
import type { RunBudgetPolicyDecision } from './RunBudgetPolicy.js';
import type {
  UniversalAgentEvent,
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalAgentRunResult,
  UniversalApprovalRequest,
} from './UniversalAgentRuntimeTypes.js';

export type AgentRunPolicyKernelApproval = {
  event: UniversalAgentEvent;
  approval: UniversalApprovalRequest;
};

export type AgentRunPolicyKernelTrustReview = {
  blockedResult: UniversalAgentRunResult | null;
};

export type AgentRunPolicyKernelBudgetReview = {
  decision: RunBudgetPolicyDecision;
};

export type AgentRunPolicyKernelPreExecutionReview = {
  approval: AgentRunPolicyKernelApproval | null;
};

export type AgentRunPolicyKernelOptions = {
  now: () => Date;
  idFactory: (prefix: string) => string;
  evaluateTrust: (run: UniversalAgentRun, request: UniversalAgentRequest) => UniversalAgentRunResult | null;
  evaluateBudget: (run: UniversalAgentRun, request: UniversalAgentRequest) => RunBudgetPolicyDecision;
  reviewPreExecution: (run: UniversalAgentRun) => void;
};

export class AgentRunPolicyKernel {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly evaluateTrustCallback: AgentRunPolicyKernelOptions['evaluateTrust'];
  private readonly evaluateBudgetCallback: AgentRunPolicyKernelOptions['evaluateBudget'];
  private readonly reviewPreExecutionCallback: AgentRunPolicyKernelOptions['reviewPreExecution'];

  constructor(options: AgentRunPolicyKernelOptions) {
    this.now = options.now;
    this.idFactory = options.idFactory;
    this.evaluateTrustCallback = options.evaluateTrust;
    this.evaluateBudgetCallback = options.evaluateBudget;
    this.reviewPreExecutionCallback = options.reviewPreExecution;
  }

  public evaluateTrust(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): AgentRunPolicyKernelTrustReview {
    const blockedResult = this.evaluateTrustCallback(run, request);
    this.appendReceipt(run, 'trust', blockedResult ? 'blocked' : 'allowed');
    return { blockedResult };
  }

  public evaluateBudget(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): AgentRunPolicyKernelBudgetReview {
    const decision = this.evaluateBudgetCallback(run, request);
    run.metadata = {
      ...run.metadata,
      runBudget: decision.metadata,
    };
    this.appendReceipt(run, 'budget', decision.allowed ? 'allowed' : 'blocked', {
      reason: decision.reason,
      degraded: decision.degraded,
    });
    return { decision };
  }

  public reviewPreExecution(run: UniversalAgentRun): AgentRunPolicyKernelPreExecutionReview {
    this.reviewPreExecutionCallback(run);
    const approval = createAgentRunApprovalEventIfNeeded({
      run,
      now: this.now().toISOString(),
      idFactory: this.idFactory,
    });
    this.appendReceipt(run, 'pre-execution', approval ? 'approval-required' : 'allowed', {
      approvalId: approval?.approval.id || null,
    });
    return { approval };
  }

  private appendReceipt(
    run: UniversalAgentRun,
    phase: string,
    decision: string,
    metadata: Record<string, unknown> = {},
  ): void {
    const existing = run.metadata.policyKernel;
    const receipts = existing
      && typeof existing === 'object'
      && !Array.isArray(existing)
      && Array.isArray((existing as { receipts?: unknown[] }).receipts)
      ? (existing as { receipts: unknown[] }).receipts.slice(-9)
      : [];
    run.metadata = {
      ...run.metadata,
      policyKernel: {
        source: 'AgentRunPolicyKernel',
        stage: 6,
        phase: 6,
        lastStage: phase,
        receipts: [
          ...receipts,
          {
            stage: phase,
            phase,
            decision,
            emittedAt: this.now().toISOString(),
            ...metadata,
          },
        ],
      },
    };
  }
}
