import type {
  AgentOsImpactSimulation,
  AgentOsProjectTwinSnapshot,
} from '../contracts/AgentOsContract.js';
import type { IntelligenceExecutionProposal } from '../contracts/native/IntelligenceFabricContract.js';
import { agentOsHash, isAgentOsSensitivePath, truncateAgentOsText } from './AgentOsTextSafety.js';

export class ImpactSimulatorService {
  public simulate(input: {
    proposal: IntelligenceExecutionProposal;
    twin: AgentOsProjectTwinSnapshot;
  }): AgentOsImpactSimulation {
    const actions = input.proposal.actions;
    const targets = Array.from(new Set(actions.map((action) => truncateAgentOsText(action.target, 160)).filter(Boolean)));
    const touchesSecrets = actions.some((action) => action.touchesSecrets || isAgentOsSensitivePath(action.target));
    const writes = actions.filter((action) => ['write', 'edit', 'delete', 'install', 'deploy'].includes(action.kind));
    const shellOrNetwork = actions.some((action) => ['exec', 'network', 'install', 'deploy', 'send'].includes(action.kind));
    const rollbackRequired = writes.length > 0;
    const rollbackAvailable = rollbackRequired
      ? writes.every((action) => action.reversible && action.insideWorkspace && !action.touchesSecrets)
      : true;
    const blockers = [
      ...(touchesSecrets ? ['secret-like target requires explicit approval and must not be serialized'] : []),
      ...(rollbackRequired && !rollbackAvailable ? ['impact is not fully reversible'] : []),
    ];
    const warnings = [
      ...(shellOrNetwork ? ['shell/network/install/deploy impact needs sandbox or approval'] : []),
      ...(input.twin.freshness !== 'fresh' ? ['project twin is not fresh; re-index before commit'] : []),
    ];
    return {
      id: `impact-${agentOsHash({ targets, risk: input.proposal.riskLevel })}`,
      source: 'ImpactSimulatorService',
      status: blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'passed',
      sideEffectsApplied: false,
      affectedTargets: targets,
      recommendedTests: this.recommendTests(targets, input.twin),
      rollbackRequired,
      rollbackAvailable,
      requiresApproval: input.proposal.requiresApproval || input.proposal.riskLevel >= 4 || touchesSecrets,
      requiresSandbox: input.proposal.requiresSandbox || shellOrNetwork,
      blockers,
      warnings,
      receipts: [
        'impact-simulation-no-side-effects',
        'impact-simulation-before-commit',
        rollbackAvailable ? 'rollback-path-available-or-not-required' : 'rollback-path-missing',
      ],
    };
  }

  private recommendTests(targets: string[], twin: AgentOsProjectTwinSnapshot): string[] {
    const scripts = twin.packageSummary.scripts;
    const recommendations = new Set<string>();
    if (targets.some((target) => /\.(ts|tsx|js|jsx)$/.test(target))) {
      if (scripts.includes('test')) recommendations.add('npm test');
      if (scripts.includes('runtime:check')) recommendations.add('npm run runtime:check');
    }
    if (targets.some((target) => target.includes('security') || target.includes('policy'))) {
      if (scripts.includes('security:secrets')) recommendations.add('npm run security:secrets');
    }
    if (scripts.includes('workspace:check')) recommendations.add('npm run workspace:check');
    return Array.from(recommendations).slice(0, 5);
  }
}
