import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { CHANNEL_MANIFESTS } from './catalog-channels.js';
import { LOCAL_MANIFESTS } from './catalog-local.js';
import { REMOTE_MANIFESTS } from './catalog-remote.js';

export const BUILTIN_MANIFESTS: IntegrationManifest[] = [
  ...REMOTE_MANIFESTS,
  ...LOCAL_MANIFESTS,
  ...CHANNEL_MANIFESTS,
];
