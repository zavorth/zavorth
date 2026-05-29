import { getZavorthControlClassicClientOverviewSummaryCapabilitiesScript } from './ZavorthControlClassicClientOverviewSummaryCapabilitiesScript.js';
import { getZavorthControlClassicClientOverviewSummaryContextScript } from './ZavorthControlClassicClientOverviewSummaryContextScript.js';
import { getZavorthControlClassicClientOverviewSummaryReplayScript } from './ZavorthControlClassicClientOverviewSummaryReplayScript.js';

export function getZavorthControlClassicClientOverviewSummaryScript(): string {
  return [
    getZavorthControlClassicClientOverviewSummaryContextScript(),
    getZavorthControlClassicClientOverviewSummaryReplayScript(),
    getZavorthControlClassicClientOverviewSummaryCapabilitiesScript(),
  ].join('\n\n');
}

