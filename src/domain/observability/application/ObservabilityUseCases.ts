import type { ObservabilityDomainPort, ObservabilityDomainReadModel } from '../domain/ObservabilityDomainTypes.js';

type ObservabilityUseCasesRuntime = {
  now?: () => Date;
  observability?: ObservabilityDomainPort | null;
};

export class ObservabilityUseCases {
  private readonly now: () => Date;
  private readonly observability: ObservabilityDomainPort | null;

  constructor(runtime: ObservabilityUseCasesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.observability = runtime.observability || null;
  }

  public buildReadiness(): ObservabilityDomainReadModel {
    if (!this.observability) {
      return {
        generatedAt: this.now().toISOString(),
        controlPlanes: 0,
        scorecards: 0,
        healthSignalsReady: false,
        headline: 'Observability domain waiting for adapter canonical.',
        operatorSummary: 'No observability adapter was injected into this domain.',
        details: ['No health service or scorecard was injected into this context.'],
        source: 'seed',
      };
    }
    return this.observability.readObservabilityState();
  }
}
