import type { DomainMetricValue } from '../../DomainFacadeBase.js';
import type { TransportsDomainReadModel } from '../domain/TransportsDomainTypes.js';

export class TransportsDomainPresenter {
  public presentReadiness(readModel: TransportsDomainReadModel): {
    summary: string;
    details: string[];
    metrics: Record<string, DomainMetricValue>;
  } {
    return {
      summary: readModel.operatorSummary,
      details: [
        readModel.headline,
        readModel.selectedSummary,
      ],
      metrics: {
        total: readModel.total,
        ready: readModel.ready,
        partial: readModel.partial,
        attentionRequired: readModel.attentionRequired,
        pendingWork: readModel.pendingWork,
      },
    };
  }
}
