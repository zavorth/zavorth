import type { IntelligenceExecutionProposal } from '../contracts/native/IntelligenceFabricContract.js';
import type { CapabilityBuilderProposal, SecurityRedTeamFinding, SecurityRedTeamSnapshot } from '../contracts/PracticalAgencyContract.js';

export class ZavorthSecurityRedTeamService {
  public review(input: {
    proposal: IntelligenceExecutionProposal;
    capability: CapabilityBuilderProposal;
  }): SecurityRedTeamSnapshot {
    const findings: SecurityRedTeamFinding[] = [];
    for (const action of input.proposal.actions) {
      if (action.touchesSecrets || action.kind === 'secret_access') {
        findings.push({ id: `${action.id}.secret`, severity: 'blocker', message: 'A proposta tenta acessar segredo e precisa de confirmacao explicita.' });
      }
      if (action.kind === 'delete' || /rm\s+-rf|del\s+\/s|remove-item/i.test(action.description)) {
        findings.push({ id: `${action.id}.destructive`, severity: 'blocker', message: 'A proposta contem acao destrutiva.' });
      }
      if ((action.kind === 'exec' || action.kind === 'install' || action.kind === 'network') && !input.proposal.requiresApproval && !input.proposal.requiresSandbox) {
        findings.push({ id: `${action.id}.ungated-impact`, severity: 'blocker', message: 'Shell, instalacao ou rede precisam de sandbox ou aprovacao.' });
      }
      if (action.riskLevel >= 3 && !input.proposal.rollbackPlan) {
        findings.push({ id: `${action.id}.rollback`, severity: 'warning', message: 'Impacto reversivel deve declarar rollback.' });
      }
    }

    const manifest = input.capability.manifest;
    if (manifest) {
      if (manifest.defaultEnabled || manifest.liveAllowedByDefault) {
        findings.push({ id: 'capability.live-default', severity: 'blocker', message: 'Capacidade nova nao pode ativar live por padrao.' });
      }
      if (manifest.riskLevel >= 3 && !manifest.approvalRequiredFor.includes('activate-live')) {
        findings.push({ id: 'capability.approval-missing', severity: 'blocker', message: 'Capacidade de risco 3+ precisa de aprovacao para ativacao.' });
      }
    }

    const blockers = findings.filter((finding) => finding.severity === 'blocker');
    return {
      source: 'ZavorthSecurityRedTeamService',
      status: blockers.length > 0 ? 'blocked' : findings.length > 0 ? 'warning' : 'passed',
      findings,
      blocksUnsafeImpact: true,
    };
  }
}
