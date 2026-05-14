import type {
  TrustGovernanceDomainPort,
  TrustGovernanceDomainReadModel,
  TrustGovernanceReadinessInput,
} from '../domain/TrustGovernanceDomainTypes.js';

type TrustGovernanceUseCasesRuntime = {
  now?: () => Date;
  trustGovernance?: TrustGovernanceDomainPort | null;
};

export class TrustGovernanceUseCases {
  private readonly now: () => Date;
  private readonly trustGovernance: TrustGovernanceDomainPort | null;

  constructor(runtime: TrustGovernanceUseCasesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.trustGovernance = runtime.trustGovernance || null;
  }

  public buildReadiness(input: TrustGovernanceReadinessInput = {}): TrustGovernanceDomainReadModel {
    if (!this.trustGovernance) {
      return {
        generatedAt: this.now().toISOString(),
        trustReady: false,
        governanceReady: false,
        policiesTracked: 0,
        headline: 'Trust governance domain aguardando adapter canonico.',
        operatorSummary: 'Nenhum adapter de trust governance foi injetado neste dominio.',
        details: ['Nenhum trust plane ou governance plane foi injetado neste contexto.'],
        source: 'seed',
      };
    }
    return this.trustGovernance.readTrustState(input);
  }
}
