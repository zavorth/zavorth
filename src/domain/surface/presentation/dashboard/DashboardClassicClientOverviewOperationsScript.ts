import { getDashboardClassicClientOverviewOperationsCockpitScript } from './DashboardClassicClientOverviewOperationsCockpitScript.js';
import { getDashboardClassicClientOverviewOperationsHostScript } from './DashboardClassicClientOverviewOperationsHostScript.js';

export function getDashboardClassicClientOverviewOperationsScript(): string {
  return [
    getDashboardClassicClientOverviewOperationsCockpitScript(),
    getDashboardClassicClientOverviewOperationsHostScript(),
  ].join('\n\n');
}

