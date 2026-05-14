import type { DomainMetricValue } from '../../DomainFacadeBase.js';
import type { SessionsDomainReadModel } from '../domain/SessionDomainTypes.js';

export class SessionsDomainPresenter {
  public presentStatus(readModel: SessionsDomainReadModel): {
    summary: string;
    details: string[];
    metrics: Record<string, DomainMetricValue>;
  } {
    return {
      summary: readModel.operatorSummary,
      details: [
        readModel.headline,
        `Sessions visiveis: ${readModel.sessions}.`,
        `History items: ${readModel.historyItems}.`,
        `Source: ${readModel.source}.`,
      ],
      metrics: {
        sessions: readModel.sessions,
        historyItems: readModel.historyItems,
        sendReady: readModel.sendReady,
        spawnReady: readModel.spawnReady,
      },
    };
  }
}
