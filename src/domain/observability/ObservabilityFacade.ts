import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import { ObservabilityUseCases } from './application/ObservabilityUseCases.js';
import type { ArchitectureScorecardPort, IntegrationHealthPort, OperationsHealthPort } from './domain/ObservabilityDomainTypes.js';
import { ObservabilityStackAdapter } from './infrastructure/ObservabilityStackAdapter.js';
import { ObservabilityDomainPresenter } from './presentation/ObservabilityDomainPresenter.js';

type ObservabilityFacadeRuntime = {
  now?: () => Date;
  operationsHealthService?: OperationsHealthPort;
  architectureScorecardService?: ArchitectureScorecardPort;
  integrationHealthService?: IntegrationHealthPort;
  controlPlanes?: number | null;
  scorecards?: number | null;
  healthSignalsReady?: boolean | null;
};

export type ObservabilityDomainSnapshot = DomainSnapshot & {
  metrics: {
    controlPlanes: number;
    scorecards: number;
    healthSignalsReady: boolean;
  };
};

export class ObservabilityFacade extends DomainFacadeBase<ObservabilityDomainSnapshot> {
  private readonly useCases: ObservabilityUseCases;
  private readonly presenter = new ObservabilityDomainPresenter();

  constructor(runtime: ObservabilityFacadeRuntime = {}) {
    super('observability', 'Observability', runtime.now);
    this.useCases = new ObservabilityUseCases({
      now: runtime.now,
      observability: new ObservabilityStackAdapter({
        now: runtime.now,
        operationsHealthService: runtime.operationsHealthService || null,
        architectureScorecardService: runtime.architectureScorecardService || null,
        integrationHealthService: runtime.integrationHealthService || null,
        controlPlanes: runtime.controlPlanes,
        scorecards: runtime.scorecards,
        healthSignalsReady: runtime.healthSignalsReady,
      }),
    });
  }

  public buildSnapshot(): ObservabilityDomainSnapshot {
    return this.composeSnapshot(this.presenter.presentReadiness(this.useCases.buildReadiness())) as ObservabilityDomainSnapshot;
  }
}
