import { getDashboardClassicClientDataAuditScript } from './DashboardClassicClientDataAuditScript.js';
import { getDashboardClassicClientDataInitScript } from './DashboardClassicClientDataInitScript.js';
import { getDashboardClassicClientDataLogsScript } from './DashboardClassicClientDataLogsScript.js';
import { getDashboardClassicClientDataSnippetsScript } from './DashboardClassicClientDataSnippetsScript.js';

export function getDashboardClassicClientDataScript(): string {
  return [
    getDashboardClassicClientDataLogsScript(),
    getDashboardClassicClientDataSnippetsScript(),
    getDashboardClassicClientDataAuditScript(),
    getDashboardClassicClientDataInitScript(),
  ].join('\n\n');
}

