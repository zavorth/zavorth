import type {
  UniversalAgentEvent,
  UniversalAgentRun,
  UniversalApprovalRequest,
} from './UniversalAgentRuntimeTypes.js';

export function createAgentRunApprovalEventIfNeeded(input: {
  run: UniversalAgentRun;
  now: string;
  idFactory: (prefix: string) => string;
}): { event: UniversalAgentEvent; approval: UniversalApprovalRequest } | null {
  const riskyTool = input.run.toolExposure.tools.find((tool) => tool.requiresApproval);
  if (!riskyTool) {
    return null;
  }

  const approval: UniversalApprovalRequest = {
    id: input.idFactory('approval'),
    runId: input.run.id,
    title: `Approve ${riskyTool.label}`,
    reason: riskyTool.description || 'Sensitive tool requested by execution.',
    risk: riskyTool.risk,
    status: 'pending',
    createdAt: input.now,
  };

  return {
    approval,
    event: {
      id: input.idFactory('agent-event'),
      runId: input.run.id,
      kind: 'approval',
      title: approval.title,
      detail: approval.reason,
      status: 'pending',
      createdAt: input.now,
      metadata: {
        approvalId: approval.id,
        toolId: riskyTool.id,
      },
    },
  };
}
