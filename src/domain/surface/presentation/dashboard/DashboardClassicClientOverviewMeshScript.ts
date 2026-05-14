import { getDashboardClassicClientOverviewMeshPlaneScript } from './DashboardClassicClientOverviewMeshPlaneScript.js';
import { getDashboardClassicClientOverviewMeshTopologyScript } from './DashboardClassicClientOverviewMeshTopologyScript.js';

export function getDashboardClassicClientOverviewMeshScript(): string {
  return [
    getDashboardClassicClientOverviewMeshPlaneScript(),
    getDashboardClassicClientOverviewMeshTopologyScript(),
  ].join('\n\n');
}

