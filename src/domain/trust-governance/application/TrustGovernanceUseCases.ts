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
        headline: 'Trust governance domain is waiting for the canonical adapter.',
        operatorSummary: 'No trust governance adapter was injected into this domain.',
        details: ['No trust plane or governance plane was injected into this context.'],
        source: 'seed',
      };
    }
    return this.trustGovernance.readTrustState(input);
  }
}
