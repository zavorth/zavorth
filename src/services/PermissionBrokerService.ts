import type { AgentOsPermissionLease, AgentOsStatus } from '../contracts/AgentOsContract.js';
import type { IntelligenceExecutionProposal, IntelligenceProposedAction } from '../contracts/native/IntelligenceFabricContract.js';
import { agentOsHash, isAgentOsSensitivePath } from './AgentOsTextSafety.js';

export class PermissionBrokerService {
  public createLease(input: {
    taskId: string;
    proposal: IntelligenceExecutionProposal;
    now?: Date;
    ttlMs?: number;
  }): AgentOsPermissionLease {
    const now = input.now || new Date();
    const allowedActions: IntelligenceProposedAction[] = [];
    const deniedActions: IntelligenceProposedAction[] = [];
    for (const action of input.proposal.actions) {
      if (this.canAllow(action)) {
        allowedActions.push(action);
      } else {
        deniedActions.push(action);
      }
    }
    const status: AgentOsStatus = deniedActions.some((action) => action.riskLevel >= 5 || action.touchesSecrets) ? 'blocked'
      : deniedActions.length > 0
        ? 'warning'
        : 'passed';
    return {
      id: `lease-${agentOsHash({ taskId: input.taskId, actions: input.proposal.actions })}`,
      source: 'PermissionBrokerService',
      taskId: input.taskId,
      status,
      expiresAt: new Date(now.getTime() + (input.ttlMs || 15 * 60 * 1000)).toISOString(),
      allowedActions,
      deniedActions,
      hardBlocksPreserved: true,
      rawSecretsSerialized: false,
      receipts: [
        'permission-lease-task-scoped',
        'permission-lease-expires',
        'permission-lease-hard-blocks-preserved',
      ],
    };
  }

  private canAllow(action: IntelligenceProposedAction): boolean {
    if (action.touchesSecrets || isAgentOsSensitivePath(action.target)) return false;
    if (['secret_access', 'deploy', 'delete', 'send', 'install', 'network', 'exec'].includes(action.kind)) return false;
    if (action.riskLevel <= 2) return true;
    return action.riskLevel === 3 && action.insideWorkspace && action.reversible && ['write', 'edit'].includes(action.kind);
  }
}
