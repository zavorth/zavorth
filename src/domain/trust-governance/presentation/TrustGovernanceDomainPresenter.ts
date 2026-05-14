import type { DomainMetricValue } from '../../DomainFacadeBase.js';
import type { TrustGovernanceDomainReadModel } from '../domain/TrustGovernanceDomainTypes.js';

export class TrustGovernanceDomainPresenter {
  public presentReadiness(readModel: TrustGovernanceDomainReadModel): {
    summary: string;
    details: string[];
    metrics: Record<string, DomainMetricValue>;
  } {
    return {
      summary: readModel.operatorSummary,
      details: readModel.details,
      metrics: {
        trustReady: readModel.trustReady,
        governanceReady: readModel.governanceReady,
        policiesTracked: readModel.policiesTracked,
      },
    };
  }
}
