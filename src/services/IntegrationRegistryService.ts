import type { IntegrationManifest, IntegrationResolution } from '../contracts/IntegrationHubContract.js';
import { INTEGRATION_MANIFESTS } from '../domain/platform-ecosystem/infrastructure/integration-registry/IntegrationRegistryCatalog.js';
import { IntegrationRegistryResolver } from '../domain/platform-ecosystem/infrastructure/integration-registry/IntegrationRegistryResolver.js';

export class IntegrationRegistryService {
  private readonly resolver = new IntegrationRegistryResolver(INTEGRATION_MANIFESTS);

  public listManifests(): IntegrationManifest[] {
    return this.resolver.listManifests();
  }

  public getManifestById(id: string | null | undefined): IntegrationManifest | null {
    return this.resolver.getManifestById(id);
  }

  public getSuggestedTemplates(): IntegrationManifest[] {
    return this.resolver.getSuggestedTemplates();
  }

  public resolveRequestedIntegration(rawValue: string | null | undefined): IntegrationResolution {
    return this.resolver.resolveRequestedIntegration(rawValue);
  }
}
