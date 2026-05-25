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
        title: 'Revisar hygiene de runtime e sidecars',
        summary: 'Rodar o doctor de desktop e revisar sidecars ajuda a confirmar que a mudanca nao reacendeu loops pesados.',
        recommendedCommand: '/doctor desktop',
        appliesBecause: input.runtimeRisk.reasons.slice(0, 3),
      });
    }

    if (input.companionImpact.companionIds.includes('zavorthBridge')) {
      opportunities.push({
        id: 'zavorth-bridge-preset-review',
        category: 'workspace',
        title: 'Reaplicar preset leve para ZavorthBridge',
        summary: 'Se a mudanca tocar watchers, contexto ou UI, vale revisar o preset leve do workspace para evitar regressao de RAM.',
        recommendedCommand: '/workspace optimize zavorthBridge',
        appliesBecause: ['Companion impact cita ZavorthBridge/VS Code como superficie sensivel.'],
      });
    }

    if (input.companionImpact.companionIds.includes('docker-desktop')) {
      opportunities.push({
        id: 'docker-idle-trim',
        category: 'companion',
        title: 'Validar Docker Desktop ocioso',
        summary: 'Quando o objetivo toca sandbox, containers ou runtime remoto, vale revisar Docker Desktop para evitar WSL pesado desnecessario.',
        recommendedCommand: '/companion inspect docker-desktop',
        appliesBecause: ['Mudanca pode tocar trilhas que usam Docker Desktop ou WSL.'],
      });
    }

    if (input.companionImpact.companionIds.includes('wsl')) {
      opportunities.push({
        id: 'wsl-hibernate-review',
        category: 'companion',
        title: 'Revisar hibernacao do WSL apos apply',
        summary: 'Se a mudanca usar sandbox, Docker ou runtime Linux, vale revisar se o WSL pode voltar a dormir depois.',
        recommendedCommand: '/companion inspect wsl',
        appliesBecause: ['Mudanca cita WSL/Linux/sandbox e pode reativar distro auxiliar.'],
      });
    }

    if (
      normalizedPaths.some((entry) =>
        entry.startsWith('src/services/webapp')
        || entry.startsWith('src/domain/surface/presentation/web-console/')
        || entry.startsWith('src/domain/surface/presentation/web-app/')) ||
      normalizedGoal.includes('ui') ||
      normalizedGoal.includes('painel') ||
      normalizedGoal.includes('dashboard')
    ) {
      opportunities.push({
        id: 'control-ui-polish',
        category: 'ui',
        title: 'Validar clareza da Dashboard',
        summary: 'Mudancas em UI/web pedem revisao se os cards, approvals e diffs continuam honestos e legiveis.',
        recommendedCommand: '/doctor desktop',
        appliesBecause: ['Changeset toca a surface web ou narrativa visual do Zavorth.'],
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
        title: 'Checar pressao de watchers e companions',
        summary: 'Mudancas ligadas a watchers merecem revisao do preset do workspace e do perfil core para evitar loops pesados.',
        recommendedCommand: '/workspace doctor',
        appliesBecause: ['Objective ou paths indicam mudanca em watchers/observacao.'],
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
