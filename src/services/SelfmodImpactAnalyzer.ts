import type {
  SelfmodCompanionImpact,
  SelfmodOptimizationAnalysis,
  SelfmodRollbackConfidenceLabel,
  SelfmodResourceDelta,
} from '../contracts/SelfmodOptimizationContract.js';
import { SelfmodOptimizationCatalog } from './SelfmodOptimizationCatalog.js';
import { SelfmodPatternMemory } from './SelfmodPatternMemory.js';
import { SelfmodRuntimeGuard } from './SelfmodRuntimeGuard.js';

type ResourceImpactShape = {
  ramIdleMb: number;
  diskMb: number;
  processCount: number;
  notes?: string;
};

export class SelfmodImpactAnalyzer {
  constructor(
    private readonly deps: {
      runtimeGuard: SelfmodRuntimeGuard;
      optimizationCatalog: SelfmodOptimizationCatalog;
      patternMemory: SelfmodPatternMemory;
    },
  ) {}

  public analyzeGoalPreview(input: {
    goal: string;
    relativePaths: string[];
    resourceImpact: ResourceImpactShape;
    changeCount: number;
  }): SelfmodOptimizationAnalysis {
    const runtimeRisk = this.deps.runtimeGuard.assess(input.relativePaths);
    const companionImpact = this.inferCompanionImpact(input.goal, input.relativePaths, runtimeRisk.level);
    const resourceDelta = this.buildResourceDelta(input.resourceImpact, runtimeRisk.reasons, input.changeCount);
    const rollbackConfidence = this.computeRollbackConfidence({
      changeCount: input.changeCount,
      runtimeRiskLevel: runtimeRisk.level,
      launcherTouch: runtimeRisk.launcherTouch,
      relativePaths: input.relativePaths,
    });
    const opportunities = this.deps.optimizationCatalog.collect({
      goal: input.goal,
      relativePaths: input.relativePaths,
      runtimeRisk,
      companionImpact,
    });
    const patternSignals = this.deps.patternMemory.summarizeSignals({
      goal: input.goal,
      relativePaths: input.relativePaths,
    });

    return {
      resourceDelta,
      runtimeRisk,
      companionImpact,
      rollbackConfidence,
      rollbackConfidenceLabel: this.labelRollbackConfidence(rollbackConfidence),
      opportunities,
      patternSignals,
    };
  }

  private buildResourceDelta(
    resourceImpact: ResourceImpactShape,
    runtimeReasons: string[],
    changeCount: number,
  ): SelfmodResourceDelta {
    const notes = [
      ...(resourceImpact.notes ? [String(resourceImpact.notes).trim()] : []),
      ...(changeCount > 1 ? [`Changeset multi-arquivo com ${changeCount} mudancas planejadas.`] : []),
      ...runtimeReasons.slice(0, 2),
    ].filter(Boolean);

    return {
      ramIdleMb: Number(resourceImpact.ramIdleMb || 0),
      diskMb: Number(resourceImpact.diskMb || 0),
      processCount: Number(resourceImpact.processCount || 0),
      summary: `${Number(resourceImpact.ramIdleMb || 0)} MB RAM | ${Number(resourceImpact.diskMb || 0)} MB disco | ${Number(resourceImpact.processCount || 0)} proc`,
      notes,
    };
  }

  private inferCompanionImpact(
    goal: string,
    relativePaths: string[],
    runtimeRiskLevel: 'low' | 'moderate' | 'high' | 'critical',
  ): SelfmodCompanionImpact {
    const normalizedGoal = String(goal || '').toLowerCase();
    const normalizedPaths = relativePaths.map((entry) => entry.replace(/\\/g, '/').toLowerCase());
    const companionIds = new Set<string>();
    const notes: string[] = [];
    const recommendedActions: string[] = [];

    const touchesWorkspace = normalizedPaths.some((entry) =>
      entry.includes('webapp') ||
      entry.includes('webconsole') ||
      entry.includes('workspace') ||
      entry.includes('contextresolver') ||
      entry.includes('desktopresource') ||
      entry.includes('companion'),
    ) || /workspace|ide|zavorthBridge|editor|ui|dashboard/.test(normalizedGoal);
    if (touchesWorkspace) {
      companionIds.add('zavorthBridge');
      notes.push('Mudanca toca surface/workspace e pode refletir em watchers ou carga da IDE companheira.');
      recommendedActions.push('/workspace optimize zavorthBridge');
    }

    const touchesDockerOrSandbox = normalizedPaths.some((entry) =>
      entry.includes('sandbox') ||
      entry.includes('docker') ||
      entry.includes('gvisor') ||
      entry.includes('remote'),
    ) || /docker|container|sandbox|wsl|ubuntu|linux/.test(normalizedGoal);
    if (touchesDockerOrSandbox) {
      companionIds.add('docker-desktop');
      companionIds.add('wsl');
      notes.push('Mudanca pode acionar Docker Desktop/WSL para sandbox ou runtime remoto.');
      recommendedActions.push('/companion inspect docker-desktop');
      recommendedActions.push('/companion inspect wsl');
    }

    const touchesRemoteOrGateway = normalizedPaths.some((entry) =>
      entry.includes('gateway') || entry.includes('mesh') || entry.includes('remote'),
    ) || /gateway|remote|codex/.test(normalizedGoal);
    if (touchesRemoteOrGateway) {
      companionIds.add('codex-companion');
      notes.push('Mudanca toca gateway/remote e merece revisao da surface que conversa com o runtime.');
      recommendedActions.push('/doctor desktop');
    }

    const companionList = Array.from(companionIds);
    if (companionList.length === 0) {
      return {
        level: 'none',
        companionIds: [],
        summary: 'Nenhum companion adicional deve ser afetado por este changeset.',
        notes: [],
        recommendedActions: [],
      };
    }

    const level = runtimeRiskLevel === 'high' || runtimeRiskLevel === 'critical'
      ? 'high'
      : companionList.length >= 2
        ? 'moderate'
        : 'low';

    return {
      level,
      companionIds: companionList,
      summary: `Companions a revisar: ${companionList.join(', ')}.`,
      notes,
      recommendedActions: Array.from(new Set(recommendedActions)),
    };
  }

  private computeRollbackConfidence(input: {
    changeCount: number;
    runtimeRiskLevel: 'low' | 'moderate' | 'high' | 'critical';
    launcherTouch: boolean;
    relativePaths: string[];
  }): number {
    let score = 0.88;
    if (input.changeCount >= 4) {
      score -= 0.12;
    } else if (input.changeCount >= 2) {
      score -= 0.06;
    }

    if (input.runtimeRiskLevel === 'moderate') {
      score -= 0.08;
    } else if (input.runtimeRiskLevel === 'high') {
      score -= 0.2;
    } else if (input.runtimeRiskLevel === 'critical') {
      score -= 0.3;
    }

    if (input.launcherTouch) {
      score -= 0.12;
    }

    if (input.relativePaths.every((entry) => entry.startsWith('tests/'))) {
      score += 0.04;
    }

    return Math.max(0.2, Math.min(0.96, Number(score.toFixed(2))));
  }

  private labelRollbackConfidence(value: number): SelfmodRollbackConfidenceLabel {
    if (value >= 0.78) {
      return 'high';
    }
    if (value >= 0.55) {
      return 'medium';
    }
    return 'low';
  }
}
