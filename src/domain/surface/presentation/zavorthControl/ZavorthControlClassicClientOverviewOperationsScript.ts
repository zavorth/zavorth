import { getZavorthControlClassicClientOverviewOperationsCockpitScript } from './ZavorthControlClassicClientOverviewOperationsDashboardScript.js';
import { getZavorthControlClassicClientOverviewOperationsHostScript } from './ZavorthControlClassicClientOverviewOperationsHostScript.js';

export function getZavorthControlClassicClientOverviewOperationsScript(): string {
  return [
    getZavorthControlClassicClientOverviewOperationsCockpitScript(),
    getZavorthControlClassicClientOverviewOperationsHostScript(),
  ].join('\n\n');
}

