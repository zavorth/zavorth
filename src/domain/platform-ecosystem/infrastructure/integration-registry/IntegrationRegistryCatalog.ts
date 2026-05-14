import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { INTEGRATION_CHANNEL_MANIFESTS } from './IntegrationRegistryCatalogChannels.js';
import { INTEGRATION_LOCAL_RUNTIME_MANIFESTS } from './IntegrationRegistryCatalogLocalRuntime.js';
import { INTEGRATION_RECIPE_MANIFESTS } from './IntegrationRegistryCatalogRecipes.js';
import { INTEGRATION_REMOTE_PROVIDER_MANIFESTS } from './IntegrationRegistryCatalogRemoteProviders.js';
import { INTEGRATION_TEMPLATE_MANIFESTS } from './IntegrationRegistryCatalogTemplates.js';

export const INTEGRATION_MANIFESTS: IntegrationManifest[] = [
  ...INTEGRATION_RECIPE_MANIFESTS,
  ...INTEGRATION_REMOTE_PROVIDER_MANIFESTS,
  ...INTEGRATION_LOCAL_RUNTIME_MANIFESTS,
  ...INTEGRATION_TEMPLATE_MANIFESTS,
  ...INTEGRATION_CHANNEL_MANIFESTS,
];
