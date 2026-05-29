import { getZavorthControlClassicClientOverviewMeshChannelsScript } from './ZavorthControlClassicClientOverviewMeshChannelsScript.js';
import { getZavorthControlClassicClientOverviewMeshPluginsScript } from './ZavorthControlClassicClientOverviewMeshPluginsScript.js';

export function getZavorthControlClassicClientOverviewMeshPlaneScript(): string {
  return [
    getZavorthControlClassicClientOverviewMeshPluginsScript(),
    getZavorthControlClassicClientOverviewMeshChannelsScript(),
  ].join('\n\n');
}

