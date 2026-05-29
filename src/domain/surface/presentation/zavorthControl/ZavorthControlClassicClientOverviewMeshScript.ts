import { getZavorthControlClassicClientOverviewMeshPlaneScript } from './ZavorthControlClassicClientOverviewMeshPlaneScript.js';
import { getZavorthControlClassicClientOverviewMeshTopologyScript } from './ZavorthControlClassicClientOverviewMeshTopologyScript.js';

export function getZavorthControlClassicClientOverviewMeshScript(): string {
  return [
    getZavorthControlClassicClientOverviewMeshPlaneScript(),
    getZavorthControlClassicClientOverviewMeshTopologyScript(),
  ].join('\n\n');
}

