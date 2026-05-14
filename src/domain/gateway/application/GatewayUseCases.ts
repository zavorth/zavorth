import type { GatewayDomainPort, GatewayDomainReadModel, GatewayStatusInput } from '../domain/GatewayDomainTypes.js';

type GatewayUseCasesRuntime = {
  now?: () => Date;
  gateway?: GatewayDomainPort | null;
};

export class GatewayUseCases {
  private readonly now: () => Date;
  private readonly gateway: GatewayDomainPort | null;

  constructor(runtime: GatewayUseCasesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.gateway = runtime.gateway || null;
  }

  public buildReadiness(input: GatewayStatusInput): GatewayDomainReadModel {
    if (!this.gateway) {
      return {
        generatedAt: this.now().toISOString(),
        state: null,
        channels: 0,
        sessions: 0,
        memoryArtifacts: 0,
        remoteTransportsReady: 0,
        summary: 'Gateway domain aguardando adapter canonico.',
        details: ['Nenhum adapter de gateway foi injetado neste dominio.'],
        source: 'empty',
      };
    }
    return this.gateway.readGatewayState(input);
  }
}
