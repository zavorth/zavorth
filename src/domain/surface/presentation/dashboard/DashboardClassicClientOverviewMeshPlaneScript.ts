import { getDashboardClassicClientOverviewMeshChannelsScript } from './DashboardClassicClientOverviewMeshChannelsScript.js';
import { getDashboardClassicClientOverviewMeshPluginsScript } from './DashboardClassicClientOverviewMeshPluginsScript.js';

export function getDashboardClassicClientOverviewMeshPlaneScript(): string {
  return [
    getDashboardClassicClientOverviewMeshPluginsScript(),
    getDashboardClassicClientOverviewMeshChannelsScript(),
  ].join('\n\n');
}

