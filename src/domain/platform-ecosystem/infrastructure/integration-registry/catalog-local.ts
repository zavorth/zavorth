import type { IntegrationManifest } from '../../../../contracts/IntegrationHubContract.js';
import { INTEGRATION_AGENT_CONNECTOR_MANIFESTS } from './IntegrationRegistryCatalogAgentConnectors.js';
import { INTEGRATION_LOCAL_RUNTIME_MANIFESTS } from './IntegrationRegistryCatalogLocalRuntime.js';
import { INTEGRATION_TEMPLATE_MANIFESTS } from './IntegrationRegistryCatalogTemplates.js';

export const LOCAL_MANIFESTS: IntegrationManifest[] = [
  ...INTEGRATION_AGENT_CONNECTOR_MANIFESTS,
  ...INTEGRATION_LOCAL_RUNTIME_MANIFESTS,
  ...INTEGRATION_TEMPLATE_MANIFESTS,
];
