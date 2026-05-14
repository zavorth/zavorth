import type { ZavorthEcosystemControlPlaneService } from '../../services/ZavorthEcosystemControlPlaneService.js';
import type { ZavorthPlatformRegistryService } from '../../services/ZavorthPlatformRegistryService.js';
import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import { PlatformEcosystemUseCases } from './application/PlatformEcosystemUseCases.js';
import { PlatformEcosystemAdapter } from './infrastructure/PlatformEcosystemAdapter.js';
import { PlatformEcosystemDomainPresenter } from './presentation/PlatformEcosystemDomainPresenter.js';

type PlatformEcosystemFacadeRuntime = {
  now?: () => Date;
  platformRegistryService?: Pick<ZavorthPlatformRegistryService, 'buildSnapshot'>;
  ecosystemControlPlaneService?: Pick<ZavorthEcosystemControlPlaneService, 'buildSnapshot'>;
  registryReady?: boolean | null;
  sdkSurfaces?: number | null;
  vendorBundles?: number | null;
};

export type PlatformEcosystemDomainSnapshot = DomainSnapshot & {
  metrics: {
    registryReady: boolean;
    sdkSurfaces: number;
    vendorBundles: number;
  };
};

export class PlatformEcosystemFacade extends DomainFacadeBase<PlatformEcosystemDomainSnapshot> {
  private readonly useCases: PlatformEcosystemUseCases;
  private readonly presenter = new PlatformEcosystemDomainPresenter();

  constructor(runtime: PlatformEcosystemFacadeRuntime = {}) {
    super('platform-ecosystem', 'Platform Ecosystem', runtime.now);
    this.useCases = new PlatformEcosystemUseCases({
      now: runtime.now,
      platformEcosystem: new PlatformEcosystemAdapter({
        now: runtime.now,
        platformRegistryService: runtime.platformRegistryService || null,
        ecosystemControlPlaneService: runtime.ecosystemControlPlaneService || null,
        registryReady: runtime.registryReady,
        sdkSurfaces: runtime.sdkSurfaces,
        vendorBundles: runtime.vendorBundles,
      }),
    });
  }

  public buildSnapshot(): PlatformEcosystemDomainSnapshot {
    return this.composeSnapshot(this.presenter.presentReadiness(this.useCases.buildReadiness())) as PlatformEcosystemDomainSnapshot;
  }
}
