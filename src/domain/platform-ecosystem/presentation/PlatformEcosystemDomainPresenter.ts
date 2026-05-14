import type { DomainMetricValue } from '../../DomainFacadeBase.js';
import type { PlatformEcosystemDomainReadModel } from '../domain/PlatformEcosystemDomainTypes.js';

export class PlatformEcosystemDomainPresenter {
  public presentReadiness(readModel: PlatformEcosystemDomainReadModel): {
    summary: string;
    details: string[];
    metrics: Record<string, DomainMetricValue>;
  } {
    return {
      summary: readModel.operatorSummary,
      details: readModel.details,
      metrics: {
        registryReady: readModel.registryReady,
        sdkSurfaces: readModel.sdkSurfaces,
        vendorBundles: readModel.vendorBundles,
      },
    };
  }
}
