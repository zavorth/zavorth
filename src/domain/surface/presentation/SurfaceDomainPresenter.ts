import type { DomainMetricValue } from '../../DomainFacadeBase.js';
import type { SurfaceDomainReadModel } from '../domain/SurfaceDomainTypes.js';

export class SurfaceDomainPresenter {
  public presentReadiness(readModel: SurfaceDomainReadModel): {
    summary: string;
    details: string[];
    metrics: Record<string, DomainMetricValue>;
  } {
    return {
      summary: readModel.summary,
      details: readModel.details,
      metrics: {
        supportedCommands: readModel.supportedCommands,
        boundaryPortsReady: readModel.boundaryPortsReady,
      },
    };
  }
}
