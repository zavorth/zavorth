import { getDashboardClassicClientOverviewMeshScript } from './DashboardClassicClientOverviewMeshScript.js';
import { getDashboardClassicClientOverviewOperationsScript } from './DashboardClassicClientOverviewOperationsScript.js';
import { getDashboardClassicClientOverviewSummaryScript } from './DashboardClassicClientOverviewSummaryScript.js';

export function getDashboardClassicClientOverviewScript(): string {
  return [
    getDashboardClassicClientOverviewSummaryScript(),
    getDashboardClassicClientOverviewMeshScript(),
    getDashboardClassicClientOverviewOperationsScript(),
  ].join('\n\n');
}

