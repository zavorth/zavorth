import type {
  ExecutionDecision,
  ExecutionIntent,
  ExecutionOutcome,
} from '../../../contracts/InternalBoundaryContract.js';
import { InternalExecutionApiAdapter } from '../infrastructure/InternalExecutionApiAdapter.js';
import type {
  ExecutionBoundaryPort,
  ExecutionDomainReadiness,
  ExecutionDomainRuntimeFlags,
} from '../domain/ExecutionDomainTypes.js';

type ExecutionUseCasesRuntime = ExecutionDomainRuntimeFlags & {
  now?: () => Date;
  executionApi?: ExecutionBoundaryPort | null;
};

export class ExecutionUseCases {
  private readonly now: () => Date;
  private readonly executionApi: ExecutionBoundaryPort;
  private readonly continuityLinked: boolean;
  private readonly approvalLinked: boolean;

  constructor(runtime: ExecutionUseCasesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.executionApi = runtime.executionApi || new InternalExecutionApiAdapter();
    this.continuityLinked = runtime.continuityLinked === true;
    this.approvalLinked = runtime.approvalLinked === true;
  }

  public buildReadiness(): ExecutionDomainReadiness {
    const decisionPipelineReady = Boolean(this.executionApi);
    return {
      generatedAt: this.now().toISOString(),
      decisionPipelineReady,
      continuityLinked: this.continuityLinked,
      approvalLinked: this.approvalLinked,
      summary:
        decisionPipelineReady || this.continuityLinked || this.approvalLinked
          ? 'Execution domain owns the canonical intent, decision and outcome use cases.'
          : 'Execution domain is waiting for the canonical execution API.',
      details: [
        `Decision pipeline: ${decisionPipelineReady ? 'ready' : 'pending'}.`,
        `Continuity linked: ${this.continuityLinked ? 'yes' : 'no'}.`,
        `Approval linked: ${this.approvalLinked ? 'yes' : 'no'}.`,
      ],
    };
  }

  public decide(intent: ExecutionIntent): Promise<ExecutionDecision> {
    return this.executionApi.decide(intent);
  }

  public execute(intent: ExecutionIntent): Promise<ExecutionOutcome> {
    return this.executionApi.execute(intent);
  }
}
