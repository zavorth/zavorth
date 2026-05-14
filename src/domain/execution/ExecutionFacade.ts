import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import type { ExecutionBoundaryPort } from './domain/ExecutionDomainTypes.js';
import { ExecutionUseCases } from './application/ExecutionUseCases.js';
import { ExecutionDomainPresenter } from './presentation/ExecutionDomainPresenter.js';

type ExecutionFacadeRuntime = {
  now?: () => Date;
  executionApi?: ExecutionBoundaryPort | null;
  decisionPipelineReady?: boolean | null;
  continuityLinked?: boolean | null;
  approvalLinked?: boolean | null;
};

export type ExecutionDomainSnapshot = DomainSnapshot & {
  metrics: {
    decisionPipelineReady: boolean;
    continuityLinked: boolean;
    approvalLinked: boolean;
  };
};

export class ExecutionFacade extends DomainFacadeBase<ExecutionDomainSnapshot> {
  private readonly useCases: ExecutionUseCases;
  private readonly presenter = new ExecutionDomainPresenter();

  constructor(runtime: ExecutionFacadeRuntime = {}) {
    super('execution', 'Execution', runtime.now);
    this.useCases = new ExecutionUseCases({
      now: runtime.now,
      executionApi: runtime.executionApi || null,
      continuityLinked: runtime.continuityLinked,
      approvalLinked: runtime.approvalLinked,
    });
  }

  public buildSnapshot(): ExecutionDomainSnapshot {
    return this.composeSnapshot(this.presenter.presentReadiness(this.useCases.buildReadiness())) as ExecutionDomainSnapshot;
  }
}
