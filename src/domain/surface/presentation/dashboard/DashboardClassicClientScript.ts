import { getDashboardClassicClientCoreScript } from './DashboardClassicClientCoreScript.js';
import { getDashboardClassicClientDataScript } from './DashboardClassicClientDataScript.js';
import { getDashboardClassicClientOverviewScript } from './DashboardClassicClientOverviewScript.js';

export function getDashboardClassicClientScript(): string {
  return [
    getDashboardClassicClientCoreScript(),
    getDashboardClassicClientOverviewScript(),
    getDashboardClassicClientDataScript(),
  ].join('\n\n');
}

