import { getZavorthControlClassicClientOverviewMeshIntegrationsScript } from './ZavorthControlClassicClientOverviewMeshIntegrationsScript.js';
import { getZavorthControlClassicClientOverviewMeshNodesScript } from './ZavorthControlClassicClientOverviewMeshNodesScript.js';
import { getZavorthControlClassicClientOverviewMeshRuntimeModesScript } from './ZavorthControlClassicClientOverviewMeshRuntimeModesScript.js';
import { getZavorthControlClassicClientOverviewMeshSecurityScript } from './ZavorthControlClassicClientOverviewMeshSecurityScript.js';
import { getZavorthControlClassicClientOverviewMeshTeamsScript } from './ZavorthControlClassicClientOverviewMeshTeamsScript.js';

export function getZavorthControlClassicClientOverviewMeshTopologyScript(): string {
  return [
    getZavorthControlClassicClientOverviewMeshRuntimeModesScript(),
    getZavorthControlClassicClientOverviewMeshSecurityScript(),
    getZavorthControlClassicClientOverviewMeshNodesScript(),
    getZavorthControlClassicClientOverviewMeshTeamsScript(),
    getZavorthControlClassicClientOverviewMeshIntegrationsScript(),
  ].join('\n\n');
}

