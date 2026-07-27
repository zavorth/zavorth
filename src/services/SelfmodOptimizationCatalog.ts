import type {
  SelfmodCompanionImpact,
  SelfmodOptimizationOpportunity,
  SelfmodRuntimeRiskReport,
} from '../contracts/SelfmodOptimizationContract.js';

export class SelfmodOptimizationCatalog {
  public collect(input: {
    goal: string;
    relativePaths: string[];
    runtimeRisk: SelfmodRuntimeRiskReport;
    companionImpact: SelfmodCompanionImpact;
  }): SelfmodOptimizationOpportunity[] {
    const normalizedGoal = String(input.goal || '').toLowerCase();
    const normalizedPaths = input.relativePaths.map((entry) => entry.replace(/\\/g, '/').toLowerCase());
    const opportunities: SelfmodOptimizationOpportunity[] = [];

    if (input.runtimeRisk.requiresSupervisorAttention) {
      opportunities.push({
        id: 'runtime-sidecar-hygiene',
        category: 'runtime',
        title: 'review hygiene de runtime e sidecars',
        summary: 'Running the desktop doctor and reviewing sidecars helps confirm the change did not restart heavy loops.',
        recommendedCommand: '/doctor desktop',
        appliesBecause: input.runtimeRisk.reasons.slice(0, 3),
      });
    }

    if (input.companionImpact.companionIds.includes('zavorthBridge')) {
      opportunities.push({
        id: 'zavorth-bridge-preset-review',
        category: 'workspace',
        title: 'Reaplicar preset leve para ZavorthBridge',
        summary: 'Se a change tocar watchers, contexto or UI, it is worth reviewing o preset leve do workspace para avoid regression de RAM.',
        recommendedCommand: '/workspace optimize zavorthBridge',
        appliesBecause: ['Companion impact cita ZavorthBridge/VS Code como surface sensitive.'],
      });
    }

    if (input.companionImpact.companionIds.includes('docker-desktop')) {
      opportunities.push({
        id: 'docker-idle-trim',
        category: 'companion',
        title: 'validate Docker Desktop ocioso',
        summary: 'when o objetivo toca sandbox, containers or runtime remote, it is worth reviewing Docker Desktop para evitar WSL pesado desnecessario.',
        recommendedCommand: '/companion inspect docker-desktop',
        appliesBecause: ['Change can touch flows that use Docker Desktop or WSL.'],
      });
    }

    if (input.companionImpact.companionIds.includes('wsl')) {
      opportunities.push({
        id: 'wsl-hibernate-review',
        category: 'companion',
        title: 'review hibernaction do WSL after apply',
        summary: 'Se a change usar sandbox, Docker or runtime Linux, it is worth reviewing se o WSL pode sleep again afterward.',
        recommendedCommand: '/companion inspect wsl',
        appliesBecause: ['Change mentions WSL, Linux, or sandbox and can reactivate an auxiliary distro.'],
      });
    }

    if (
      normalizedPaths.some((entry) =>
        entry.startsWith('src/services/webapp')
        || entry.startsWith('src/domain/surface/presentation/web-console/')
        || entry.startsWith('src/domain/surface/presentation/web-app/')) ||
      normalizedGoal.includes('ui') ||
      normalizedGoal.includes('panel') ||
      normalizedGoal.includes('zavorthControl')
    ) {
      opportunities.push({
        id: 'control-ui-polish',
        category: 'ui',
        title: 'validate clareza da ZavorthControl',
        summary: 'changes em UI/web pedunder review se os cards, approvals e diffs continuam honestos e legiveis.',
        recommendedCommand: '/doctor desktop',
        appliesBecause: ['Changeset toca a surface web or narractive visual do Zavorth.'],
      });
    }

    if (
      normalizedPaths.some((entry) => entry.includes('watch')) ||
      normalizedGoal.includes('watcher') ||
      normalizedGoal.includes('watch mode')
    ) {
      opportunities.push({
        id: 'watcher-pressure-review',
        category: 'watchers',
        title: 'Checar pressure de watchers e companions',
        summary: 'changes ligadas a watchers merecunder review do preset do workspace e do profile core para evitar loops pesados.',
        recommendedCommand: '/workspace doctor',
        appliesBecause: ['Objective or paths indicate change in watchers/observation.'],
      });
    }

    return this.dedupe(opportunities);
  }

  private dedupe(opportunities: SelfmodOptimizationOpportunity[]): SelfmodOptimizationOpportunity[] {
    const seen = new Set<string>();
    return opportunities.filter((entry) => {
      if (seen.has(entry.id)) {
        return false;
      }
      seen.add(entry.id);
      return true;
    });
  }
}
