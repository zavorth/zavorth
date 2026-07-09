import {
  createBoundaryCorrelation,
  createBoundaryError,
  type ApprovalLink,
  type ExecutionDecision,
  type ExecutionIntent,
  type ExecutionOutcome,
  type RunContext,
} from '../../contracts/InternalBoundaryContract.js';
import {
  buildCanonicalRunContext,
  buildExecutionLifecycleRecord,
  type ZavorthExecutionLifecycleStatus,
  type ExecutionLifecycleRecord,
} from '../../contracts/ExecutionLifecycleContract.js';
type InternalExecutionApiDeps = {
  decideExecution?: (intent: ExecutionIntent) => Partial<ExecutionDecision> | Promise<Partial<ExecutionDecision>>;
  executeExecution?: (intent: ExecutionIntent) => Partial<ExecutionOutcome> | Promise<Partial<ExecutionOutcome>>;
};

export class InternalExecutionApiService {
  private readonly decideExecution?: InternalExecutionApiDeps['decideExecution'];
  private readonly executeExecution?: InternalExecutionApiDeps['executeExecution'];

  constructor(deps: InternalExecutionApiDeps = {}) {
    this.decideExecution = deps.decideExecution;
    this.executeExecution = deps.executeExecution;
  }

  public async decide(intent: ExecutionIntent): Promise<ExecutionDecision> {
    const correlation = createBoundaryCorrelation(intent.correlation);
    const runContext = this.buildRunContext(intent, correlation);
    const defaultApproval = this.buildApprovalLink(intent, correlation.approvalId);
    try {
      const decision = this.decideExecution ? await this.decideExecution(intent) : {};
      const resolvedDecision = decision.decision
        || (intent.approved || !defaultApproval.required ? 'approved' : 'approval_required');
      const summary =
        decision.summary
        || (resolvedDecision === 'approved'
          ? 'Execution intent cleared for the shared execution pipeline.'
          : 'Execution intent requires approval before mutation can proceed.');
      return {
        ok: resolvedDecision === 'approved',
        decision: resolvedDecision,
        summary,
        correlation,
        runContext,
        approval: {
          approvalId: decision.approval?.approvalId ?? defaultApproval.approvalId,
          required: decision.approval?.required ?? defaultApproval.required,
          summary: decision.approval?.summary ?? defaultApproval.summary,
        },
        lifecycle: this.buildDecisionLifecycle(intent, resolvedDecision, summary, correlation),
        error: decision.error || null,
        metadata: {
          ...(decision.metadata || {}),
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        decision: 'blocked',
        summary: message,
        correlation,
        runContext,
        approval: defaultApproval,
        lifecycle: this.buildDecisionLifecycle(intent, 'blocked', message, correlation),
        error: createBoundaryError('execution_failed', message, [], true),
        metadata: {},
      };
    }
  }

  public async execute(intent: ExecutionIntent): Promise<ExecutionOutcome> {
    const correlation = createBoundaryCorrelation(intent.correlation);
    const runContext = this.buildRunContext(intent, correlation);
    try {
      const outcome = this.executeExecution ? await this.executeExecution(intent) : {};
      const status = outcome.status || (intent.dryRun ? 'noop' : 'completed');
      return {
        ok: outcome.ok ?? (status === 'completed' || status === 'noop'),
        status,
        summary:
          outcome.summary
          || (status === 'noop'
            ? 'Execution intent was normalized but did not mutate runtime state.'
            : 'Execution intent completed through the canonical execution pipeline.'),
        correlation,
        runContext,
        artifacts: Array.isArray(outcome.artifacts) ? outcome.artifacts : [],
        lifecycle: this.buildOutcomeLifecycle(intent, status, outcome.summary || null, correlation, outcome.artifacts),
        error: outcome.error || null,
        metadata: {
          ...(outcome.metadata || {}),
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        status: 'failed',
        summary: message,
        correlation,
        runContext,
        artifacts: [],
        lifecycle: this.buildOutcomeLifecycle(intent, 'failed', message, correlation, []),
        error: createBoundaryError('execution_failed', message, [], true),
        metadata: {},
      };
    }
  }

  private buildRunContext(
    intent: ExecutionIntent,
    correlation: ReturnType<typeof createBoundaryCorrelation>,
  ): RunContext {
    return buildCanonicalRunContext({
      correlation,
      sessionId: intent.sessionId || null,
      surface: intent.surface,
      requestedBy: intent.requestedBy,
      profile: intent.profile || null,
    });
  }

  private buildApprovalLink(intent: ExecutionIntent, approvalId: string | null): ApprovalLink {
    return {
      approvalId: intent.approved ? null : approvalId,
      required: !intent.approved && !intent.dryRun,
      summary: !intent.approved && !intent.dryRun ? 'Approval is required before mutating execution.' : null,
    };
  }

  private buildDecisionLifecycle(
    intent: ExecutionIntent,
    decision: ExecutionDecision['decision'],
    summary: string,
    correlation: ReturnType<typeof createBoundaryCorrelation>,
  ): ExecutionLifecycleRecord[] {
    const runStatus: ZavorthExecutionLifecycleStatus =
      decision === 'approved' ? 'approved' : decision === 'approval_required' ? 'approval_required' : 'blocked';
    const records = [
      buildExecutionLifecycleRecord({
        kind: 'intent',
        status: 'received',
        correlation,
        summary: intent.objective || 'Execution intent received.',
        source: 'internal-execution-api',
        surface: intent.surface,
        metadata: {
          dryRun: intent.dryRun === true,
          approved: intent.approved === true,
        },
      }),
      buildExecutionLifecycleRecord({
        kind: 'run',
        status: runStatus,
        correlation,
        summary,
        source: 'internal-execution-api',
        surface: intent.surface,
        metadata: {
          decision,
        },
      }),
    ];

    if (decision === 'approval_required' || correlation.approvalId) {
      records.push(buildExecutionLifecycleRecord({
        kind: 'approval',
        status: decision === 'approval_required' ? 'approval_required' : 'linked',
        correlation,
        summary: decision === 'approval_required'
          ? 'Approval gate linked to canonical run.'
          : 'Approval id linked to canonical run.',
        source: 'internal-execution-api',
        surface: intent.surface,
        parentId: correlation.runId,
      }));
    }

    return records;
  }

  private buildOutcomeLifecycle(
    intent: ExecutionIntent,
    status: ExecutionOutcome['status'],
    summary: string | null,
    correlation: ReturnType<typeof createBoundaryCorrelation>,
    artifacts: string[] | undefined,
  ): ExecutionLifecycleRecord[] {
    const runStatus: ZavorthExecutionLifecycleStatus =
      status === 'completed' ? 'completed' : status === 'noop' ? 'noop' : status === 'blocked' ? 'blocked' : 'failed';
    const records = [
      buildExecutionLifecycleRecord({
        kind: 'run',
        status: runStatus,
        correlation,
        summary: summary || `Execution run ${status}.`,
        source: 'internal-execution-api',
        surface: intent.surface,
        metadata: {
          status,
          dryRun: intent.dryRun === true,
        },
      }),
    ];

    for (const artifactId of Array.isArray(artifacts) ? artifacts : []) {
      records.push(buildExecutionLifecycleRecord({
        kind: 'artifact',
        id: artifactId,
        status: 'linked',
        correlation: {
          ...correlation,
          artifactId,
        },
        summary: 'Artifact linked to canonical execution run.',
        source: 'internal-execution-api',
        surface: intent.surface,
        parentId: correlation.runId,
      }));
    }

    return records;
  }
}
