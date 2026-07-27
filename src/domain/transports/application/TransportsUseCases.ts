import type { TransportsDomainPort, TransportsDomainReadModel } from '../domain/TransportsDomainTypes.js';

type TransportsUseCasesRuntime = {
  now?: () => Date;
  transports?: TransportsDomainPort | null;
};

export class TransportsUseCases {
  private readonly now: () => Date;
  private readonly transports: TransportsDomainPort | null;

  constructor(runtime: TransportsUseCasesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.transports = runtime.transports || null;
  }

  public buildReadiness(): TransportsDomainReadModel {
    if (!this.transports) {
      return {
        generatedAt: this.now().toISOString(),
        total: 0,
        ready: 0,
        partial: 0,
        attentionRequired: 0,
        pendingWork: 0,
        headline: 'Transports domain waiting for the canonical remote transport plane.',
        operatorSummary: 'No adapter de transport foi injetado neste domain.',
        selectedSummary: 'No transporte remote foi selecionado neste recorte.',
        source: 'empty',
      };
    }
    return this.transports.readTransportState();
  }
}
