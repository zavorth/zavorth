import type { DomainMetricValue } from '../../DomainFacadeBase.js';
import type { ExecutionDomainReadiness } from '../domain/ExecutionDomainTypes.js';

export class ExecutionDomainPresenter {
  public presentReadiness(readiness: ExecutionDomainReadiness): {
    summary: string;
    details: string[];
    metrics: Record<string, DomainMetricValue>;
  } {
    return {
      summary: readiness.summary,
      details: readiness.details,
      metrics: {
        decisionPipelineReady: readiness.decisionPipelineReady,
        continuityLinked: readiness.continuityLinked,
        approvalLinked: readiness.approvalLinked,
      },
    };
  }
}
