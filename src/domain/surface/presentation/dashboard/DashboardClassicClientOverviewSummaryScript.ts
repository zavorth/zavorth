import { getDashboardClassicClientOverviewSummaryCapabilitiesScript } from './DashboardClassicClientOverviewSummaryCapabilitiesScript.js';
import { getDashboardClassicClientOverviewSummaryContextScript } from './DashboardClassicClientOverviewSummaryContextScript.js';
import { getDashboardClassicClientOverviewSummaryReplayScript } from './DashboardClassicClientOverviewSummaryReplayScript.js';

export function getDashboardClassicClientOverviewSummaryScript(): string {
  return [
    getDashboardClassicClientOverviewSummaryContextScript(),
    getDashboardClassicClientOverviewSummaryReplayScript(),
    getDashboardClassicClientOverviewSummaryCapabilitiesScript(),
  ].join('\n\n');
}

