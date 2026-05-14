import type {
  UniversalAgentRequest,
  UniversalAgentRun,
} from './UniversalAgentRuntimeTypes.js';

export type AgentRunEvidenceStepId =
  | 'memoryWithReceipts'
  | 'skillMcpQuarantine'
  | 'universalIntentTrustEnforcement'
  | 'capabilityNegotiation'
  | 'toolRehearsal'
  | 'providerArena'
  | 'providerMeshConsolidation'
  | 'crossChannelContinuity'
  | 'agentTeamCompiler'
  | 'askBeforeAssumptionPolicy'
  | 'artifactMemory'
  | 'personalOpsAutopilot'
  | 'selfingDashboard'
  | 'runArtifactReceiptReplay'
  | 'productizationEvidence'
  | 'productEntryRuntime'
  | 'releaseInstallerRollbackPath'
  | 'publicSiteDocsDemoSync'
  | 'feedbackTelemetryProductLoop'
  | 'publicAdoptionPilotLoop'
  | 'integrationShowcasePartnerSurface'
  | 'releaseAdoptionReadiness'
  | 'releaseCandidatePreCanaryGate'
  | 'blueprintCompletionGate'
  | 'capabilityLoopGovernance';

export type AgentRunEvidencePipelineContext = {
  run: UniversalAgentRun;
  request: UniversalAgentRequest | null;
  generatedAt: string;
};

export type AgentRunEvidencePipelineStep = {
  id: AgentRunEvidenceStepId;
  apply: (context: AgentRunEvidencePipelineContext) => void;
};

export type AgentRunEvidenceCollectorId =
  | 'memory'
  | 'safety'
  | 'runtime'
  | 'collaboration'
  | 'product'
  | 'release';

export type AgentRunEvidencePhase =
  | 'initial'
  | 'frontloaded'
  | 'secondary'
  | 'budget-short-circuit'
  | 'post-executor';

export type AgentRunEvidenceCollector = {
  id: AgentRunEvidenceCollectorId;
  label: string;
  stepIds: AgentRunEvidenceStepId[];
};

export type AgentRunEvidencePipelineOptions = {
  steps: AgentRunEvidencePipelineStep[];
  collectors?: AgentRunEvidenceCollector[];
  workerMode?: 'inline' | 'async-heavy' | 'worker-first-heavy';
  worker?: AgentRunEvidenceWorker | null;
  asyncCollectorIds?: AgentRunEvidenceCollectorId[];
};

export type AgentRunEvidenceWorkerJob = {
  id: string;
  run: UniversalAgentRun;
  phase: AgentRunEvidencePhase;
  collectorId: AgentRunEvidenceCollectorId;
  stepIds: AgentRunEvidenceStepId[];
  generatedAt: string;
  execute: () => void;
};

export type AgentRunEvidenceWorker = {
  schedule: (job: AgentRunEvidenceWorkerJob) => void | Promise<void>;
};

export type AgentRunEvidenceCollectorExecutionMode = 'inline' | 'pending' | 'scheduled';

export type AgentRunEvidenceWorkerReceiptStatus =
  | 'pending'
  | 'scheduled'
  | 'failed'
  | 'fallback-inline'
  | 'fallback-failed';

type AgentRunEvidenceScheduleAttempt = {
  deferred: boolean;
  executionMode: AgentRunEvidenceCollectorExecutionMode;
};

const DEFAULT_COLLECTORS: AgentRunEvidenceCollector[] = [
  {
    id: 'memory',
    label: 'Memory Evidence Collector',
    stepIds: [
      'memoryWithReceipts',
      'artifactMemory',
      'runArtifactReceiptReplay',
    ],
  },
  {
    id: 'safety',
    label: 'Safety Evidence Collector',
    stepIds: [
      'skillMcpQuarantine',
      'universalIntentTrustEnforcement',
      'capabilityNegotiation',
      'toolRehearsal',
      'askBeforeAssumptionPolicy',
      'capabilityLoopGovernance',
    ],
  },
  {
    id: 'runtime',
    label: 'Runtime Evidence Collector',
    stepIds: [
      'providerArena',
      'providerMeshConsolidation',
      'crossChannelContinuity',
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaboration Evidence Collector',
    stepIds: [
      'agentTeamCompiler',
      'personalOpsAutopilot',
      'selfingDashboard',
    ],
  },
  {
    id: 'product',
    label: 'Product Evidence Collector',
    stepIds: [
      'productizationEvidence',
      'productEntryRuntime',
      'publicSiteDocsDemoSync',
      'feedbackTelemetryProductLoop',
      'publicAdoptionPilotLoop',
      'integrationShowcasePartnerSurface',
    ],
  },
  {
    id: 'release',
    label: 'Release Evidence Collector',
    stepIds: [
      'releaseInstallerRollbackPath',
      'releaseAdoptionReadiness',
      'releaseCandidatePreCanaryGate',
      'blueprintCompletionGate',
    ],
  },
];

const INITIAL_STEP_IDS = flattenCollectors(DEFAULT_COLLECTORS, [
  'memoryWithReceipts',
  'skillMcpQuarantine',
  'universalIntentTrustEnforcement',
  'capabilityNegotiation',
  'toolRehearsal',
  'providerArena',
  'providerMeshConsolidation',
  'crossChannelContinuity',
  'agentTeamCompiler',
  'askBeforeAssumptionPolicy',
  'artifactMemory',
  'personalOpsAutopilot',
  'selfingDashboard',
  'runArtifactReceiptReplay',
  'productizationEvidence',
  'productEntryRuntime',
  'releaseInstallerRollbackPath',
  'publicSiteDocsDemoSync',
  'feedbackTelemetryProductLoop',
  'publicAdoptionPilotLoop',
  'integrationShowcasePartnerSurface',
  'releaseAdoptionReadiness',
  'releaseCandidatePreCanaryGate',
  'blueprintCompletionGate',
]);

const FRONTLOADED_STEP_IDS: AgentRunEvidenceStepId[] = INITIAL_STEP_IDS.filter((id) => (
  id !== 'memoryWithReceipts' && id !== 'skillMcpQuarantine' && id !== 'universalIntentTrustEnforcement'
));

const SECONDARY_STEP_IDS: AgentRunEvidenceStepId[] = [
  'providerMeshConsolidation',
  'crossChannelContinuity',
  'agentTeamCompiler',
  'askBeforeAssumptionPolicy',
  'artifactMemory',
  'personalOpsAutopilot',
  'selfingDashboard',
  'runArtifactReceiptReplay',
  'productizationEvidence',
  'productEntryRuntime',
  'releaseInstallerRollbackPath',
  'publicSiteDocsDemoSync',
  'feedbackTelemetryProductLoop',
  'publicAdoptionPilotLoop',
  'integrationShowcasePartnerSurface',
  'releaseAdoptionReadiness',
  'releaseCandidatePreCanaryGate',
  'blueprintCompletionGate',
];

const POST_EXECUTOR_STEP_IDS: AgentRunEvidenceStepId[] = [
  'memoryWithReceipts',
  'skillMcpQuarantine',
  'universalIntentTrustEnforcement',
  'capabilityNegotiation',
  'toolRehearsal',
  'providerArena',
  'providerMeshConsolidation',
  'crossChannelContinuity',
  'agentTeamCompiler',
  'askBeforeAssumptionPolicy',
  'artifactMemory',
  'personalOpsAutopilot',
];

export class AgentRunEvidencePipeline {
  private readonly steps: Map<AgentRunEvidenceStepId, AgentRunEvidencePipelineStep>;
  private readonly collectors: AgentRunEvidenceCollector[];
  private readonly workerMode: 'inline' | 'async-heavy' | 'worker-first-heavy';
  private readonly worker: AgentRunEvidenceWorker | null;
  private readonly asyncCollectorIds: Set<AgentRunEvidenceCollectorId>;

  constructor(options: AgentRunEvidencePipelineOptions) {
    this.steps = new Map(options.steps.map((step) => [step.id, step]));
    this.collectors = options.collectors || DEFAULT_COLLECTORS;
    this.worker = options.worker || null;
    this.workerMode = options.workerMode || (this.worker ? 'worker-first-heavy' : 'inline');
    this.asyncCollectorIds = new Set(options.asyncCollectorIds || ['product', 'release']);
  }

  public applyInitial(context: AgentRunEvidencePipelineContext): void {
    this.applyPhase('initial', INITIAL_STEP_IDS, context);
  }

  public applyFrontloaded(context: AgentRunEvidencePipelineContext): void {
    this.applyPhase('frontloaded', FRONTLOADED_STEP_IDS, context);
  }

  public applySecondary(context: AgentRunEvidencePipelineContext): void {
    this.applyPhase('secondary', SECONDARY_STEP_IDS, context);
  }

  public applyBudgetShortCircuit(context: AgentRunEvidencePipelineContext): void {
    this.applyPhase('budget-short-circuit', ['capabilityLoopGovernance', ...FRONTLOADED_STEP_IDS], context);
  }

  public applyPostExecutor(context: AgentRunEvidencePipelineContext): void {
    this.applyPhase('post-executor', POST_EXECUTOR_STEP_IDS, context);
  }

  public describeCollectors(): AgentRunEvidenceCollector[] {
    return this.collectors.map((collector) => ({
      ...collector,
      stepIds: collector.stepIds.slice(),
    }));
  }

  private applyPhase(
    phase: AgentRunEvidencePhase,
    stepIds: AgentRunEvidenceStepId[],
    context: AgentRunEvidencePipelineContext,
  ): void {
    const stepSet = new Set(stepIds);
    const scheduledStepIds = new Set<AgentRunEvidenceStepId>();
    const collectorReceipts: Array<{
      collectorId: AgentRunEvidenceCollectorId;
      phase: AgentRunEvidencePhase;
      stepIds: AgentRunEvidenceStepId[];
      executionMode: AgentRunEvidenceCollectorExecutionMode;
    }> = [];
    for (const collector of this.collectors) {
      const selectedStepIds = collector.stepIds.filter((stepId) => stepSet.has(stepId));
      if (selectedStepIds.length === 0) {
        continue;
      }
      const scheduleAttempt = this.tryScheduleCollector(collector.id, phase, selectedStepIds, context);
      if (scheduleAttempt.deferred) {
        selectedStepIds.forEach((stepId) => scheduledStepIds.add(stepId));
      }
      collectorReceipts.push({
        collectorId: collector.id,
        phase,
        stepIds: selectedStepIds,
        executionMode: scheduleAttempt.executionMode,
      });
    }
    this.applySteps(stepIds.filter((stepId) => !scheduledStepIds.has(stepId)), context);
    this.appendCollectorReceipt(context, phase, collectorReceipts);
  }

  private tryScheduleCollector(
    collectorId: AgentRunEvidenceCollectorId,
    phase: AgentRunEvidencePhase,
    stepIds: AgentRunEvidenceStepId[],
    context: AgentRunEvidencePipelineContext,
  ): AgentRunEvidenceScheduleAttempt {
    if (
      this.workerMode !== 'async-heavy'
      && this.workerMode !== 'worker-first-heavy'
      || !this.worker
      || !this.asyncCollectorIds.has(collectorId)
      || phase === 'initial'
      || phase === 'budget-short-circuit'
    ) {
      return {
        deferred: false,
        executionMode: 'inline',
      };
    }

    const job: AgentRunEvidenceWorkerJob = {
      id: `evidence-job:${context.run.id}:${phase}:${collectorId}:${context.generatedAt}`,
      run: context.run,
      phase,
      collectorId,
      stepIds: stepIds.slice(),
      generatedAt: context.generatedAt,
      execute: () => this.applySteps(stepIds, context),
    };
    try {
      const scheduleResult = this.worker.schedule(job);
      if (this.isThenable(scheduleResult)) {
        this.appendWorkerReceipt(context, {
          jobId: job.id,
          phase,
          collectorId,
          status: 'pending',
        });
        void scheduleResult
          .then(() => {
            this.appendWorkerReceipt(context, {
              jobId: job.id,
              phase,
              collectorId,
              status: 'scheduled',
            });
          })
          .catch((error) => {
            this.appendWorkerReceipt(context, {
              jobId: job.id,
              phase,
              collectorId,
              status: 'failed',
              error: this.formatError(error),
            });
            this.applyInlineScheduleFallback(job, context);
          });
        return {
          deferred: true,
          executionMode: 'pending',
        };
      }
      this.appendWorkerReceipt(context, {
        jobId: job.id,
        phase,
        collectorId,
        status: 'scheduled',
      });
      return {
        deferred: true,
        executionMode: 'scheduled',
      };
    } catch (error) {
      this.appendWorkerReceipt(context, {
        jobId: job.id,
        phase,
        collectorId,
        status: 'failed',
        error: this.formatError(error),
      });
      return {
        deferred: false,
        executionMode: 'inline',
      };
    }
  }

  private applyInlineScheduleFallback(
    job: AgentRunEvidenceWorkerJob,
    context: AgentRunEvidencePipelineContext,
  ): void {
    try {
      job.execute();
      this.appendWorkerReceipt(context, {
        jobId: job.id,
        phase: job.phase,
        collectorId: job.collectorId,
        status: 'fallback-inline',
      });
    } catch (fallbackError) {
      this.appendWorkerReceipt(context, {
        jobId: job.id,
        phase: job.phase,
        collectorId: job.collectorId,
        status: 'fallback-failed',
        error: this.formatError(fallbackError),
      });
    }
  }

  private applySteps(
    stepIds: AgentRunEvidenceStepId[],
    context: AgentRunEvidencePipelineContext,
  ): void {
    for (const stepId of stepIds) {
      const step = this.steps.get(stepId);
      if (step) {
        step.apply(context);
      }
    }
  }

  private isThenable(value: void | Promise<void>): value is Promise<void> {
    return Boolean(value && typeof (value as { then?: unknown }).then === 'function');
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private appendCollectorReceipt(
    context: AgentRunEvidencePipelineContext,
    phase: AgentRunEvidencePhase,
    collectors: Array<{
      collectorId: AgentRunEvidenceCollectorId;
      phase: AgentRunEvidencePhase;
      stepIds: AgentRunEvidenceStepId[];
      executionMode: AgentRunEvidenceCollectorExecutionMode;
    }>,
  ): void {
    const existing = context.run.metadata.evidenceCollectors;
    const previousReceipts = existing
      && typeof existing === 'object'
      && !Array.isArray(existing)
      && Array.isArray((existing as { receipts?: unknown[] }).receipts)
      ? (existing as { receipts: unknown[] }).receipts.slice(-11)
      : [];
    context.run.metadata = {
      ...context.run.metadata,
      evidenceCollectors: {
        source: 'AgentRunEvidencePipeline',
        phase: 3,
        lastPhase: phase,
        collectorCount: this.collectors.length,
        workerMode: this.workerMode,
        receipts: [
          ...previousReceipts,
          ...collectors,
        ],
      },
    };
  }

  private appendWorkerReceipt(
    context: AgentRunEvidencePipelineContext,
    receipt: {
      jobId: string;
      phase: AgentRunEvidencePhase;
      collectorId: AgentRunEvidenceCollectorId;
      status: AgentRunEvidenceWorkerReceiptStatus;
      error?: string;
    },
  ): void {
    const existing = context.run.metadata.evidenceWorkers;
    const receipts = existing
      && typeof existing === 'object'
      && !Array.isArray(existing)
      && Array.isArray((existing as { receipts?: unknown[] }).receipts)
      ? (existing as { receipts: unknown[] }).receipts.slice(-19)
      : [];
    context.run.metadata = {
      ...context.run.metadata,
      evidenceWorkers: {
        source: 'AgentRunEvidencePipeline',
        phase: this.workerMode === 'worker-first-heavy' ? 11 : 9,
        mode: this.workerMode,
        receipts: [
          ...receipts,
          receipt,
        ],
      },
    };
  }
}

function flattenCollectors(
  collectors: AgentRunEvidenceCollector[],
  preferredOrder: AgentRunEvidenceStepId[],
): AgentRunEvidenceStepId[] {
  const available = new Set(collectors.flatMap((collector) => collector.stepIds));
  return preferredOrder.filter((stepId) => available.has(stepId));
}
