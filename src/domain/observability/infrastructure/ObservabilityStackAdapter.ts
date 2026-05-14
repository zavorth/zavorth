import type {
  ArchitectureScorecardPort,
  IntegrationHealthPort,
  ObservabilityDomainPort,
  ObservabilityDomainReadModel,
  OperationsHealthPort,
} from '../domain/ObservabilityDomainTypes.js';

type ObservabilityStackAdapterRuntime = {
  now?: () => Date;
  operationsHealthService?: OperationsHealthPort | null;
  architectureScorecardService?: ArchitectureScorecardPort | null;
  integrationHealthService?: IntegrationHealthPort | null;
  controlPlanes?: number | null;
  scorecards?: number | null;
  healthSignalsReady?: boolean | null;
};

export class ObservabilityStackAdapter implements ObservabilityDomainPort {
  private readonly now: () => Date;
  private readonly operationsHealthService: OperationsHealthPort | null;
  private readonly architectureScorecardService: ArchitectureScorecardPort | null;
  private readonly integrationHealthService: IntegrationHealthPort | null;
  private readonly controlPlanesHint: number | null;
  private readonly scorecardsHint: number | null;
  private readonly healthSignalsReadyHint: boolean | null;

  constructor(runtime: ObservabilityStackAdapterRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.operationsHealthService = runtime.operationsHealthService || null;
    this.architectureScorecardService = runtime.architectureScorecardService || null;
    this.integrationHealthService = runtime.integrationHealthService || null;
    this.controlPlanesHint = Number.isFinite(runtime.controlPlanes) ? Number(runtime.controlPlanes) : null;
    this.scorecardsHint = Number.isFinite(runtime.scorecards) ? Number(runtime.scorecards) : null;
    this.healthSignalsReadyHint = runtime.healthSignalsReady === true ? true : null;
  }

  public readObservabilityState(): ObservabilityDomainReadModel {
    const healthSnapshot = this.operationsHealthService?.readSnapshot?.()
      || this.operationsHealthService?.buildSnapshot?.()
      || null;
    const scorecardSnapshot = this.architectureScorecardService?.buildSnapshot() || null;
    const integrationSnapshots = this.integrationHealthService?.listDoctorSnapshots() || [];
    const controlPlanes = (
      this.controlPlanesHint
      ?? Number(scorecardSnapshot?.summary?.controlPlaneFamiliesReady ?? scorecardSnapshot?.summary?.controlPlaneFamiliesTotal ?? 0)
    ) || 0;
    const scorecards = (
      this.scorecardsHint
      ?? ((scorecardSnapshot ? 1 : 0) + (integrationSnapshots.length > 0 ? 1 : 0))
    ) || 0;
    const healthSignalsReady = this.healthSignalsReadyHint ?? Boolean(healthSnapshot);
    const hasSignals = controlPlanes > 0 || scorecards > 0 || healthSignalsReady;

    return {
      generatedAt: this.now().toISOString(),
      controlPlanes,
      scorecards,
      healthSignalsReady,
      headline: hasSignals
        ? 'Observability domain ja consolida scorecard arquitetural, health operacional e doctor de integracoes.'
        : 'Observability domain aguardando a pilha canonica de observabilidade.',
      operatorSummary:
        scorecardSnapshot?.narrative?.operatorSummary
        || healthSnapshot?.narrative?.operatorSummary
        || (hasSignals
          ? `Observability domain pronto com ${controlPlanes} control plane(s) e ${scorecards} scorecard(s) ativo(s).`
          : 'Observability domain registrado para receber a plataforma de snapshots e postura operacional.'),
      details: [
        healthSnapshot?.narrative?.headline || 'Operations health ainda nao publicou headline neste contexto.',
        scorecardSnapshot?.narrative?.operatorSummary || 'Architecture scorecard ainda nao publicou resumo neste contexto.',
        `Control planes: ${controlPlanes}.`,
        `Scorecards: ${scorecards}.`,
        `Health signals ready: ${healthSignalsReady ? 'yes' : 'no'}.`,
      ],
      source: hasSignals ? 'observability-stack' : 'seed',
    };
  }
}
