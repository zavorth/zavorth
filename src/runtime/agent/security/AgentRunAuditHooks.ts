import type {
  UniversalAgentEvent,
  UniversalAgentRun,
} from '../UniversalAgentRuntimeTypes.js';
import type { AgentRunRiskReview } from './AgentRunRiskHooks.js';

export class AgentRunAuditHooks {
  public buildRiskReviewEvent(input: {
    run: UniversalAgentRun;
    review: AgentRunRiskReview;
    now: string;
    idFactory: (prefix: string) => string;
  }): UniversalAgentEvent {
    return {
      id: input.idFactory('agent-event'),
      runId: input.run.id,
      kind: 'status',
      title: `Defense hook ${input.review.phase}`,
      detail: input.review.summary,
      status: input.review.blocked ? 'pending' : 'done',
      createdAt: input.now,
      metadata: {
        source: 'AgentRunAuditHooks',
        riskReview: input.review,
        auditRequired: input.review.requiresApproval || input.review.toolIds.length > 0,
      },
    };
  }
}
