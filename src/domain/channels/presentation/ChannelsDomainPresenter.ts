import type { DomainMetricValue } from '../../DomainFacadeBase.js';
import type { ChannelsDomainReadModel } from '../domain/ChannelsDomainTypes.js';

export class ChannelsDomainPresenter {
  public present(readModel: ChannelsDomainReadModel): {
    summary: string;
    details: string[];
    metrics: Record<string, DomainMetricValue>;
  } {
    return {
      summary: readModel.operatorSummary,
      details: [
        readModel.headline,
        `Configured channels: ${readModel.configuredChannels}.`,
        `Remote-ready channels: ${readModel.remoteReady}.`,
        `Source: ${readModel.source}.`,
      ],
      metrics: {
        configuredChannels: readModel.configuredChannels,
        remoteReady: readModel.remoteReady,
        total: readModel.total,
        partial: readModel.partial,
        planned: readModel.planned,
        disabled: readModel.disabled,
        sessionSendReady: readModel.sessionSendReady,
      },
    };
  }
}
