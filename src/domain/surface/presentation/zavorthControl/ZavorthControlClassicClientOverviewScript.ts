import { getZavorthControlClassicClientOverviewMeshScript } from './ZavorthControlClassicClientOverviewMeshScript.js';
import { getZavorthControlClassicClientOverviewOperationsScript } from './ZavorthControlClassicClientOverviewOperationsScript.js';
import { getZavorthControlClassicClientOverviewSummaryScript } from './ZavorthControlClassicClientOverviewSummaryScript.js';

export function getZavorthControlClassicClientOverviewScript(): string {
  return [
    getZavorthControlClassicClientOverviewSummaryScript(),
    getZavorthControlClassicClientOverviewMeshScript(),
    getZavorthControlClassicClientOverviewOperationsScript(),
  ].join('\n\n');
}

