import type { SurfaceDomainPort, SurfaceDomainReadModel } from '../domain/SurfaceDomainTypes.js';

type SurfaceUseCasesRuntime = {
  now?: () => Date;
  surfaceDomain?: SurfaceDomainPort | null;
};

export class SurfaceUseCases {
  private readonly now: () => Date;
  private readonly surfaceDomain: SurfaceDomainPort | null;

  constructor(runtime: SurfaceUseCasesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.surfaceDomain = runtime.surfaceDomain || null;
  }

  public buildReadiness(): SurfaceDomainReadModel {
    if (!this.surfaceDomain) {
      return {
        generatedAt: this.now().toISOString(),
        supportedCommands: 0,
        boundaryPortsReady: false,
        summary: 'Surface domain waiting for the canonical boundary adapter.',
        details: ['No surface adapter was injected into this domain.'],
        source: 'seed',
      };
    }
    return this.surfaceDomain.readCapabilities();
  }
}
