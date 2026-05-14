import type { DomainMetricValue } from '../../DomainFacadeBase.js';
import type { NodesDomainReadModel } from '../domain/NodesDomainTypes.js';

export class NodesDomainPresenter {
  public present(readModel: NodesDomainReadModel): {
    summary: string;
    details: string[];
    metrics: Record<string, DomainMetricValue>;
  } {
    return {
      summary: readModel.operatorSummary,
      details: [
        readModel.headline,
        readModel.nextAction,
        `Source: ${readModel.source}.`,
      ],
      metrics: {
        total: readModel.total,
        paired: readModel.paired,
        online: readModel.online,
        invokable: readModel.invokable,
        queued: readModel.queued,
        capabilities: readModel.capabilities,
      },
    };
  }
}
