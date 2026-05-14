import type { DomainMetricValue } from '../../DomainFacadeBase.js';
import type { ObservabilityDomainReadModel } from '../domain/ObservabilityDomainTypes.js';

export class ObservabilityDomainPresenter {
  public presentReadiness(readModel: ObservabilityDomainReadModel): {
    summary: string;
    details: string[];
    metrics: Record<string, DomainMetricValue>;
  } {
    return {
      summary: readModel.operatorSummary,
      details: readModel.details,
      metrics: {
        controlPlanes: readModel.controlPlanes,
        scorecards: readModel.scorecards,
        healthSignalsReady: readModel.healthSignalsReady,
      },
    };
  }
}
