import type { CompanionActionId, CompanionId } from '../contracts/CompanionControlContract.js';
import type { DesktopResourcePlaneService } from './DesktopResourcePlaneService.js';
import type { CapabilityLifecycleService } from './CapabilityLifecycleService.js';
import type {
  ZavorthExecutionBudget,
  CapabilityImpactEstimate,
  CompanionImpactEstimate,
  TaskResourceImpact,
} from '../contracts/TaskResourcePlannerContract.js';
import { CapabilityImpactEstimatorService } from './CapabilityImpactEstimatorService.js';
import { CompanionImpactEstimatorService } from './CompanionImpactEstimatorService.js';

type DesktopResourcePort = Pick<DesktopResourcePlaneService, 'readLatest' | 'inspectLive'>;
type CapabilityLifecyclePort = Pick<CapabilityLifecycleService, 'getManifest'>;

type TaskResourcePlannerRuntime = {
  now?: () => Date;
  capabilityLifecycle?: CapabilityLifecyclePort | null;
  desktopResources?: DesktopResourcePort | null;
  capabilityEstimator?: CapabilityImpactEstimatorService;
  companionEstimator?: CompanionImpactEstimatorService;
};

type PlanOptions = {
  preferCachedWithinMs?: number;
  requestedBy?: string | null;
};

export class TaskResourcePlannerService {
  private readonly now: () => Date;
  private readonly desktopResources: DesktopResourcePort | null;
  private readonly capabilityEstimator: CapabilityImpactEstimatorService;
  private readonly companionEstimator: CompanionImpactEstimatorService;

  constructor(runtime: TaskResourcePlannerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.desktopResources = runtime.desktopResources || null;
    this.capabilityEstimator = runtime.capabilityEstimator || new CapabilityImpactEstimatorService({
      capabilityLifecycle: runtime.capabilityLifecycle || null,
    });
    this.companionEstimator = runtime.companionEstimator || new CompanionImpactEstimatorService();
  }

  public async planChatTask(
    message: string,
    options: PlanOptions = {},
  ): Promise<TaskResourceImpact> {
    const normalized = String(message || '').trim();
    const capabilityIds = this.detectCapabilityIds(normalized);
    const capabilityEstimates = capabilityIds
      .map((capabilityId) => this.capabilityEstimator.estimateCapability(capabilityId))
      .filter((entry): entry is CapabilityImpactEstimate => Boolean(entry));
    const companionEstimates = this.detectCompanionDependencies(capabilityEstimates)
      .map((companionId) => this.companionEstimator.estimateAction(companionId, 'inspect'));
    return this.buildImpact('chat', normalized, capabilityEstimates, companionEstimates, options);
  }

  public async planCapabilityEnable(
    capabilityId: string,
    options: PlanOptions & { intent?: string | null } = {},
  ): Promise<TaskResourceImpact | null> {
    const estimate = this.capabilityEstimator.estimateCapability(String(capabilityId || '').trim());
    if (!estimate) {
      return null;
    }
    const companionEstimates = estimate.companionDependencies.map((companionId) =>
      this.companionEstimator.estimateAction(companionId, 'resume'));
    return this.buildImpact(
      'capability',
      String(options.intent || `enable ${capabilityId}`).trim(),
      [estimate],
      companionEstimates,
      options,
    );
  }

  public async planCompanionAction(
    companionId: CompanionId,
    actionId: CompanionActionId,
    options: PlanOptions & { intent?: string | null } = {},
  ): Promise<TaskResourceImpact> {
    const estimate = this.companionEstimator.estimateAction(companionId, actionId);
    return this.buildImpact(
      'companion',
      String(options.intent || `${actionId} ${companionId}`).trim(),
      [],
      [estimate],
      options,
    );
  }

  public renderImpactSummary(impact: TaskResourceImpact | null): string {
    if (!impact) {
      return 'Sem impacto relevante previsto; o Zavorth segue no core leve.';
    }

    const lines = [
      impact.userFacingSummary,
      `RAM: ${this.formatSignedNumber(impact.budget.ramMb)} MB | CPU: ${this.formatSignedNumber(impact.budget.cpuPercent)}% | Disco: ${this.formatSignedNumber(impact.budget.diskMb)} MB | Processos: ${this.formatSignedNumber(impact.budget.processCount)}.`,
      `Exposicao: ${impact.budget.externalExposure}.`,
      impact.budget.companionDependencies.length > 0
        ? `Companions envolvidos: ${impact.budget.companionDependencies.join(', ')}.`
        : 'Companions envolvidos: nenhum.',
      `Fallback leve: ${impact.budget.fallback}.`,
    ];

    if (impact.warnings.length > 0) {
      lines.push(`Alertas: ${impact.warnings.join(' | ')}.`);
    }
    return lines.join('\n');
  }

  public toMutationResourceImpact(impact: TaskResourceImpact | null): {
    ramMb: number;
    diskMb: number;
    processCount: number;
    externalExposure: 'none' | 'local' | 'network' | 'public';
    recurring: boolean;
    notes: string[];
  } {
    if (!impact) {
      return {
        ramMb: 0,
        diskMb: 0,
        processCount: 0,
        externalExposure: 'none',
        recurring: false,
        notes: ['Planner nao identificou custo relevante alem do core.'],
      };
    }
    return {
      ramMb: Math.max(0, impact.budget.ramMb),
      diskMb: Math.max(0, impact.budget.diskMb),
      processCount: Math.max(0, impact.budget.processCount),
      externalExposure: impact.budget.externalExposure,
      recurring: impact.budget.recurring,
      notes: [...impact.budget.notes, ...impact.warnings],
    };
  }

  private async buildImpact(
    taskKind: TaskResourceImpact['taskKind'],
    intent: string,
    capabilityEstimates: CapabilityImpactEstimate[],
    companionEstimates: CompanionImpactEstimate[],
    options: PlanOptions,
  ): Promise<TaskResourceImpact> {
    const hostPressure = await this.readHostPressure(options.preferCachedWithinMs);
    const budget = this.buildBudget(capabilityEstimates, companionEstimates);
    const heavy = capabilityEstimates.some((entry) => entry.approvalRequired || entry.ramMb >= 96)
      || companionEstimates.some((entry) => entry.ramDeltaMb >= 200 || entry.requiresApproval);
    const approvalRequired = capabilityEstimates.some((entry) => entry.approvalRequired)
      || companionEstimates.some((entry) => entry.requiresApproval);
    const warnings = [
      hostPressure && hostPressure !== 'low'
        ? `Host em pressao ${hostPressure}.`
        : null,
      budget.companionDependencies.includes('docker-desktop') && budget.companionDependencies.includes('wsl')
        ? 'Sandbox mais pesada pode acordar Docker Desktop e WSL juntos.'
        : null,
      budget.externalExposure === 'public'
        ? 'A tarefa pode expor recursos publicamente.'
        : null,
    ].filter(Boolean) as string[];

    const summary = capabilityEstimates.length === 0 && companionEstimates.length === 0
      ? 'Nenhuma capability pesada prevista; o Zavorth deve seguir apenas com o core.'
      : `Planner detectou ${capabilityEstimates.length} capability(s) e ${companionEstimates.length} dependency(ies) de companion relevantes.`;
    const userFacingSummary = capabilityEstimates.length === 0 && companionEstimates.length === 0
      ? 'Para cumprir isso eu devo continuar no core leve, sem ligar trilhas pesadas.'
      : `Para cumprir isso eu posso precisar de ${this.describeNeeds(capabilityEstimates, companionEstimates)}.`;

    return {
      generatedAt: this.now().toISOString(),
      taskKind,
      intent,
      heavy,
      approvalRequired,
      summary,
      userFacingSummary,
      budget,
      capabilityEstimates,
      companionEstimates,
      warnings,
    };
  }

  private buildBudget(
    capabilityEstimates: CapabilityImpactEstimate[],
    companionEstimates: CompanionImpactEstimate[],
  ): ZavorthExecutionBudget {
    const companionDependencies = new Set<string>();
    const capabilityIds = capabilityEstimates.map((entry) => entry.capabilityId);
    let ramMb = 0;
    let cpuPercent = 0;
    let diskMb = 0;
    let processCount = 0;
    let externalExposure: ZavorthExecutionBudget['externalExposure'] = 'none';
    let recurring = false;
    const notes: string[] = [];
    let fallback = 'Seguir apenas com o core leve.';
    let capabilityFallbackResolved = false;

    for (const estimate of capabilityEstimates) {
      ramMb += estimate.ramMb;
      cpuPercent += estimate.cpuPercent;
      diskMb += estimate.diskMb;
      processCount += estimate.processCount;
      estimate.companionDependencies.forEach((entry) => companionDependencies.add(entry));
      externalExposure = this.maxExposure(externalExposure, estimate.externalExposure);
      if (estimate.fallback) {
        fallback = estimate.fallback;
        capabilityFallbackResolved = true;
      }
      notes.push(...estimate.notes);
      recurring = recurring || estimate.capabilityId === 'recurring-automation';
    }

    for (const estimate of companionEstimates) {
      ramMb += estimate.ramDeltaMb;
      cpuPercent += estimate.cpuDeltaPercent;
      diskMb += estimate.diskDeltaMb;
      processCount += estimate.processDelta;
      companionDependencies.add(estimate.companionId);
      externalExposure = this.maxExposure(externalExposure, estimate.externalExposure);
      if (!capabilityFallbackResolved && estimate.fallback) {
        fallback = estimate.fallback;
      }
      notes.push(...estimate.notes);
    }

    return {
      ramMb,
      cpuPercent,
      diskMb,
      processCount,
      externalExposure,
      recurring,
      companionDependencies: Array.from(companionDependencies) as ZavorthExecutionBudget['companionDependencies'],
      capabilityIds,
      fallback,
      notes: Array.from(new Set(notes)).slice(0, 8),
    };
  }

  private detectCapabilityIds(message: string): string[] {
    const normalized = String(message || '').toLowerCase();
    const capabilityIds = new Set<string>();
    if (/(screenshot|captura|visual|playwright|browser|navegador|site|pagina|clicar|click|watch mode|computer use)/i.test(normalized)) {
      capabilityIds.add(/watch mode|computer use|clicar|click/i.test(normalized) ? 'watch-mode' : 'qa');
    }
    if (/(audio|video|mp3|wav|transcri|tts|voz|pdf|youtube)/i.test(normalized)) {
      capabilityIds.add('media');
    }
    if (/(sandbox|docker|container|wsl|isola|firecracker|untrusted)/i.test(normalized)) {
      capabilityIds.add('sandbox');
    }
    if (/(t[úu]nel|cloudflare|public url|acesso remoto|remote sidecar|publicar.*web|expor)/i.test(normalized)) {
      capabilityIds.add(/public/i.test(normalized) || /cloudflare/i.test(normalized) ? 'public-tunnel' : 'remote');
    }
    if (/(recorrente|agendar|schedule|cron|todo dia|todo dia|automaticamente|automacao recorrente)/i.test(normalized)) {
      capabilityIds.add('recurring-automation');
    }
    return Array.from(capabilityIds);
  }

  private detectCompanionDependencies(
    capabilityEstimates: CapabilityImpactEstimate[],
  ): CompanionId[] {
    const values = new Set<CompanionId>();
    for (const estimate of capabilityEstimates) {
      for (const dependency of estimate.companionDependencies) {
        values.add(dependency as CompanionId);
      }
    }
    return Array.from(values);
  }

  private async readHostPressure(preferCachedWithinMs = 15_000): Promise<string | null> {
    if (!this.desktopResources) {
      return null;
    }
    const cached = this.desktopResources.readLatest?.();
    if (cached) {
      const ageMs = Math.max(0, this.now().getTime() - new Date(cached.generatedAt).getTime());
      if (ageMs <= Math.max(0, Number(preferCachedWithinMs || 0) || 0)) {
        return cached.host.pressure;
      }
    }
    try {
      const snapshot = await this.desktopResources.inspectLive?.({ preferCachedWithinMs });
      return snapshot?.host?.pressure || null;
    } catch {
      return null;
    }
  }

  private maxExposure(
    left: ZavorthExecutionBudget['externalExposure'],
    right: ZavorthExecutionBudget['externalExposure'],
  ): ZavorthExecutionBudget['externalExposure'] {
    const order: ZavorthExecutionBudget['externalExposure'][] = ['none', 'local', 'network', 'public'];
    return order[Math.max(order.indexOf(left), order.indexOf(right))] || 'none';
  }

  private describeNeeds(
    capabilityEstimates: CapabilityImpactEstimate[],
    companionEstimates: CompanionImpactEstimate[],
  ): string {
    const labels = [
      ...capabilityEstimates.map((entry) => entry.label),
      ...companionEstimates
        .filter((entry) => entry.actionId === 'resume')
        .map((entry) => entry.companionId),
    ];
    return Array.from(new Set(labels)).join(', ') || 'mais recursos locais';
  }

  private formatSignedNumber(value: number): string {
    const numeric = Number(value || 0);
    if (numeric > 0) {
      return `+${numeric}`;
    }
    return String(numeric);
  }
}
