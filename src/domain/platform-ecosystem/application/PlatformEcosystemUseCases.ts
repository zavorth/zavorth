import type {
  PlatformEcosystemDomainPort,
  PlatformEcosystemDomainReadModel,
  PlatformEcosystemReadinessInput,
} from '../domain/PlatformEcosystemDomainTypes.js';

type PlatformEcosystemUseCasesRuntime = {
  now?: () => Date;
  platformEcosystem?: PlatformEcosystemDomainPort | null;
};

export class PlatformEcosystemUseCases {
  private readonly now: () => Date;
  private readonly platformEcosystem: PlatformEcosystemDomainPort | null;

  constructor(runtime: PlatformEcosystemUseCasesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.platformEcosystem = runtime.platformEcosystem || null;
  }

  public buildReadiness(input: PlatformEcosystemReadinessInput = {}): PlatformEcosystemDomainReadModel {
    if (!this.platformEcosystem) {
      return {
        generatedAt: this.now().toISOString(),
        registryReady: false,
        sdkSurfaces: 0,
        vendorBundles: 0,
        headline: 'Platform ecosystem domain is waiting for the canonical adapter.',
        operatorSummary: 'No platform ecosystem adapter was injected into this domain.',
        details: ['No registry or ecosystem control plane was injected into this context.'],
        source: 'seed',
      };
    }
    return this.platformEcosystem.readPlatformState(input);
  }
}
