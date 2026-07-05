import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { INTEGRATION_RECIPE_MANIFESTS } from './IntegrationRegistryCatalogRecipes.js';
import { INTEGRATION_REMOTE_PROVIDER_MANIFESTS } from './IntegrationRegistryCatalogRemoteProviders.js';

export const REMOTE_MANIFESTS: IntegrationManifest[] = [
  ...INTEGRATION_RECIPE_MANIFESTS,
  ...INTEGRATION_REMOTE_PROVIDER_MANIFESTS,
];
