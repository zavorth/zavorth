import type { DomainMetricValue } from '../../DomainFacadeBase.js';
import type { GatewayDomainReadModel } from '../domain/GatewayDomainTypes.js';

export class GatewayDomainPresenter {
  public presentReadiness(readModel: GatewayDomainReadModel): {
    summary: string;
    details: string[];
    metrics: Record<string, DomainMetricValue>;
  } {
    return {
      summary: readModel.summary,
      details: readModel.details,
      metrics: {
        state: readModel.state,
        channels: readModel.channels,
        sessions: readModel.sessions,
        memoryArtifacts: readModel.memoryArtifacts,
        remoteTransportsReady: readModel.remoteTransportsReady,
      },
    };
  }
}
