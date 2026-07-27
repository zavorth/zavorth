import type {
  AgentOsImmuneSignal,
  AgentOsImmuneSnapshot,
  AgentOsImpactDryRun,
  AgentOsPermissionLease,
  AgentOsProjectTwinSnapshot,
} from '../contracts/AgentOsContract.js';
import type { IntelligenceExecutionProposal } from '../contracts/native/IntelligenceFabricContract.js';
import { isAgentOsSensitivePath, truncateAgentOsText } from './AgentOsTextSafety.js';

export class AgentImmuneSystemService {
  public inspect(input: {
    proposal: IntelligenceExecutionProposal;
    dryRun: AgentOsImpactDryRun;
    lease: AgentOsPermissionLease;
    twin: AgentOsProjectTwinSnapshot;
  }): AgentOsImmuneSnapshot {
    const signals: AgentOsImmuneSignal[] = [];
    for (const action of input.proposal.actions) {
      if (action.touchesSecrets || isAgentOsSensitivePath(action.target)) {
        signals.push(signal('secret-access', 'critical', `Action touches a sensitive area: ${truncateAgentOsText(action.target, 100)}`, 'block'));
      }
      if (['exec', 'install', 'network'].includes(action.kind)) {
        signals.push(signal('shell-network-impact', 'warning', 'Shell, network, or installation requires sandbox or approval.', 'sandbox'));
      }
      if (action.kind === 'delete' || action.kind === 'deploy') {
        signals.push(signal('irreversible-impact', 'critical', 'Delete/deploy requires explicit confirmation.', 'approval'));
      }
      if (action.riskLevel >= 3 && !action.reversible) {
        signals.push(signal('non-reversible-action', 'warning', 'Significant action without declared reversibility.', 'approval'));
      }
    }
    if (input.dryRun.rollbackRequired && !input.dryRun.rollbackAvailable) {
      signals.push(signal('rollback-missing', 'critical', 'Rollback missing for significant impact.', 'block'));
    }
    if (input.lease.deniedActions.length > 0) {
      signals.push(signal('permission-lease-denied', 'warning', 'Part of the task exceeded the temporary permission.', 'approval'));
    }
    if (input.twin.freshness !== 'fresh') {
      signals.push(signal('stale-project-twin', 'info', 'Digital Twin must be updated before commit.', 'simulate'));
    }
    const critical = signals.some((entry) => entry.severity === 'critical');
    const warning = signals.some((entry) => entry.severity === 'warning');
    return {
      source: 'AgentImmuneSystemService',
      status: critical ? 'blocked' : warning ? 'warning' : 'passed',
      cautionLevel: critical ? 'blocked' : warning ? 'elevated' : 'normal',
      thinkingBlocked: false,
      requiresApproval: signals.some((entry) => ['approval', 'block'].includes(entry.recommendedEscalation)),
      requiresSandbox: signals.some((entry) => entry.recommendedEscalation === 'sandbox'),
      signals,
      receipts: [
        'immune-system-does-not-block-thinking',
        'immune-system-escalates-impact-only',
        critical ? 'immune-system-critical-signal' : 'immune-system-no-critical-signal',
      ],
    };
  }
}

function signal(
  id: string,
  severity: AgentOsImmuneSignal['severity'],
  message: string,
  recommendedEscalation: AgentOsImmuneSignal['recommendedEscalation'],
): AgentOsImmuneSignal {
  return { id, severity, message, recommendedEscalation };
}
