import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { INTEGRATION_CHANNEL_MANIFESTS } from './IntegrationRegistryCatalogChannels.js';

export const CHANNEL_MANIFESTS: IntegrationManifest[] = [
  ...INTEGRATION_CHANNEL_MANIFESTS,
];
