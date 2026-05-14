import type { DomainMetricValue } from '../../DomainFacadeBase.js';
import type { MemoryDomainReadModel } from '../domain/MemoryDomainTypes.js';

export class MemoryDomainPresenter {
  public presentReadiness(readModel: MemoryDomainReadModel): {
    summary: string;
    details: string[];
    metrics: Record<string, DomainMetricValue>;
  } {
    return {
      summary: readModel.operatorSummary,
      details: [
        readModel.headline,
        `Artifacts: ${readModel.artifacts}.`,
        `Workflow runs: ${readModel.workflowRuns}.`,
      ],
      metrics: {
        persistedMemories: readModel.persistedMemories,
        relevantMemories: readModel.relevantMemories,
        artifacts: readModel.artifacts,
        workflowRuns: readModel.workflowRuns,
        timelineEvents: readModel.timelineEvents,
      },
    };
  }
}
