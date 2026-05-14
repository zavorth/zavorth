import { getDashboardClassicClientOverviewMeshIntegrationsScript } from './DashboardClassicClientOverviewMeshIntegrationsScript.js';
import { getDashboardClassicClientOverviewMeshNodesScript } from './DashboardClassicClientOverviewMeshNodesScript.js';
import { getDashboardClassicClientOverviewMeshRuntimeModesScript } from './DashboardClassicClientOverviewMeshRuntimeModesScript.js';
import { getDashboardClassicClientOverviewMeshSecurityScript } from './DashboardClassicClientOverviewMeshSecurityScript.js';
import { getDashboardClassicClientOverviewMeshTeamsScript } from './DashboardClassicClientOverviewMeshTeamsScript.js';

export function getDashboardClassicClientOverviewMeshTopologyScript(): string {
  return [
    getDashboardClassicClientOverviewMeshRuntimeModesScript(),
    getDashboardClassicClientOverviewMeshSecurityScript(),
    getDashboardClassicClientOverviewMeshNodesScript(),
    getDashboardClassicClientOverviewMeshTeamsScript(),
    getDashboardClassicClientOverviewMeshIntegrationsScript(),
  ].join('\n\n');
}

