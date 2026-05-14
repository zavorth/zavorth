import { ReplyPipeline } from '../reply/ReplyPipeline.js';
import {
  FailureSemanticsRegistry,
  type FailureSemantics,
} from './FailureSemanticsRegistry.js';
import { AgentRunAuditHooks } from './security/AgentRunAuditHooks.js';
import { AgentRunRiskHooks } from './security/AgentRunRiskHooks.js';
import type {
  UniversalAgentRun,
  UniversalAgentRunResult,
} from './UniversalAgentRuntimeTypes.js';

export type AgentRunFailureResultBuilderRuntime = {
  now: () => Date;
  idFactory: (prefix: string) => string;
  failureSemanticsRegistry: FailureSemanticsRegistry;
  replyPipeline: ReplyPipeline;
  riskHooks: AgentRunRiskHooks;
  auditHooks: AgentRunAuditHooks;
};

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function buildFailureReplyText(failure: FailureSemantics): string {
  const retry = failure.retryable ? ' Pode ser tentado novamente.' : '';
  return `Falha estruturada no ${failure.source}: ${failure.message}.${retry}`.replace('..', '.');
}

export class AgentRunFailureResultBuilder {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly failureSemanticsRegistry: FailureSemanticsRegistry;
  private readonly replyPipeline: ReplyPipeline;
  private readonly riskHooks: AgentRunRiskHooks;
  private readonly auditHooks: AgentRunAuditHooks;

  constructor(runtime: AgentRunFailureResultBuilderRuntime) {
    this.now = runtime.now;
    this.idFactory = runtime.idFactory;
    this.failureSemanticsRegistry = runtime.failureSemanticsRegistry;
    this.replyPipeline = runtime.replyPipeline;
    this.riskHooks = runtime.riskHooks;
    this.auditHooks = runtime.auditHooks;
  }

  public build(
    run: UniversalAgentRun,
    error: unknown,
    source: string,
  ): UniversalAgentRunResult {
    const now = this.now().toISOString();
    const failure = this.failureSemanticsRegistry.fromError(error, {
      source,
      metadata: {
        runId: run.id,
      },
    });
    const replyText = buildFailureReplyText(failure);

    run.status = 'failed';
    run.summary = failure.message;
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      failureSemantics: failure,
    };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'error',
      title: 'Falha estruturada do executor',
      detail: replyText,
      status: 'failed',
      createdAt: now,
      metadata: {
        failureSemantics: failure,
      },
    });
    this.applyInterruptedDefenseReview(run, now);

    return this.replyPipeline.buildResult({
      run,
      text: replyText,
    });
  }

  private applyInterruptedDefenseReview(run: UniversalAgentRun, now: string): void {
    const review = this.riskHooks.review({ run, stage: 'interrupted' });
    const lifecycleDefense = recordOrNull(run.metadata.lifecycleDefense) || {};
    run.metadata.lifecycleDefense = {
      ...lifecycleDefense,
      interrupted: review,
    };
    run.events.push(this.auditHooks.buildRiskReviewEvent({
      run,
      review,
      now,
      idFactory: this.idFactory,
    }));
  }
}
