import type { AgentRunEvidencePipeline } from './AgentRunEvidencePipeline.js';
import type { AgentRunPolicyKernel } from './AgentRunPolicyKernel.js';
import type { RunBudgetPolicyDecision } from './RunBudgetPolicy.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalAgentRunResult,
} from './UniversalAgentRuntimeTypes.js';

export type AgentRunCorePipelineEventType =
  | 'agent.run.created'
  | 'agent.policy.evaluated'
  | 'agent.run.completed';

export type AgentRunCorePipelineOptions<TBaseline> = {
  createRun: (request: UniversalAgentRequest, baseline: TBaseline) => UniversalAgentRun;
  timeStage: <T>(
    run: UniversalAgentRun | null,
    baseline: TBaseline,
    name: string,
    action: () => T,
  ) => T;
  policyKernel: AgentRunPolicyKernel;
  evidencePipeline: AgentRunEvidencePipeline;
  publishRuntimeEvent: (
    run: UniversalAgentRun,
    type: AgentRunCorePipelineEventType,
    payload?: Record<string, unknown>,
  ) => Promise<void>;
  finishBaseline: (run: UniversalAgentRun, baseline: TBaseline) => void;
  applyMetadataDiet: (run: UniversalAgentRun) => void;
  readTrustMode: (run: UniversalAgentRun) => unknown;
  resolveProfile: (run: UniversalAgentRun) => string;
};

export type AgentRunCorePrepareResult = {
  run: UniversalAgentRun;
  budgetDecision: RunBudgetPolicyDecision;
  blockedResult: UniversalAgentRunResult | null;
};

export class AgentRunCorePipeline<TBaseline> {
  private readonly options: AgentRunCorePipelineOptions<TBaseline>;

  constructor(options: AgentRunCorePipelineOptions<TBaseline>) {
    this.options = options;
  }

  public async prepare(
    request: UniversalAgentRequest,
    baseline: TBaseline,
  ): Promise<AgentRunCorePrepareResult> {
    const run = this.options.timeStage(null, baseline, 'core-pipeline-create-run', () => (
      this.options.createRun(request, baseline)
    ));
    this.appendReceipt(run, 'created');
    await this.options.publishRuntimeEvent(run, 'agent.run.created', {
      requestId: run.requestId,
      sessionId: run.sessionId,
      channel: run.channel,
      profile: this.options.resolveProfile(run),
    });

    const trustReview = this.options.timeStage(run, baseline, 'core-pipeline-policy-trust', () => (
      this.options.policyKernel.evaluateTrust(run, request)
    ));
    if (trustReview.blockedResult) {
      this.appendReceipt(run, 'blocked-by-trust');
      return {
        run,
        budgetDecision: {
          allowed: false,
          degraded: true,
          reason: 'trust-blocked',
          summary: run.summary,
          metadata: {},
        },
        blockedResult: trustReview.blockedResult,
      };
    }

    const budgetReview = this.options.timeStage(run, baseline, 'core-pipeline-policy-budget', () => (
      this.options.policyKernel.evaluateBudget(run, request)
    ));
    const budgetDecision = budgetReview.decision;
    await this.options.publishRuntimeEvent(run, 'agent.policy.evaluated', {
      allowed: budgetDecision.allowed,
      degraded: budgetDecision.metadata.degraded,
      trustMode: this.options.readTrustMode(run),
      toolExposureMode: run.toolExposure.mode,
    });
    this.options.timeStage(run, baseline, 'core-pipeline-frontloaded-evidence', () => (
      this.options.evidencePipeline.applyFrontloaded({
        run,
        request,
        generatedAt: run.updatedAt,
      })
    ));
    this.appendReceipt(run, budgetDecision.allowed ? 'prepared' : 'budget-blocked');
    return {
      run,
      budgetDecision,
      blockedResult: null,
    };
  }

  public async finalize(run: UniversalAgentRun, baseline: TBaseline): Promise<void> {
    this.options.finishBaseline(run, baseline);
    this.appendReceipt(run, 'finalized');
    this.options.applyMetadataDiet(run);
    await this.options.publishRuntimeEvent(run, 'agent.run.completed', {
      status: run.status,
      summary: run.summary,
      metadataBytes: this.readCoreDietMetadataBytes(run),
    });
  }

  private appendReceipt(run: UniversalAgentRun, phase: string): void {
    const existing = run.metadata.corePipeline;
    const receipts = existing
      && typeof existing === 'object'
      && !Array.isArray(existing)
      && Array.isArray((existing as { receipts?: unknown[] }).receipts)
      ? (existing as { receipts: unknown[] }).receipts.slice(-9)
      : [];
    run.metadata = {
      ...run.metadata,
      corePipeline: {
        source: 'AgentRunCorePipeline',
        stage: 12,
        phase: 12,
        lastStage: phase,
        receipts: [
          ...receipts,
          {
            stage: phase,
            phase,
            status: run.status,
          },
        ],
      },
    };
  }

  private readCoreDietMetadataBytes(run: UniversalAgentRun): unknown {
    const baseline = run.metadata.coreDietBaseline;
    if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) {
      return null;
    }
    return (baseline as { metadataBytes?: unknown }).metadataBytes || null;
  }
}
