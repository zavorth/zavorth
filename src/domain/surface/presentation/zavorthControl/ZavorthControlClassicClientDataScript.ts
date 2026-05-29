import { getZavorthControlClassicClientDataAuditScript } from './ZavorthControlClassicClientDataAuditScript.js';
import { getZavorthControlClassicClientDataInitScript } from './ZavorthControlClassicClientDataInitScript.js';
import { getZavorthControlClassicClientDataLogsScript } from './ZavorthControlClassicClientDataLogsScript.js';
import { getZavorthControlClassicClientDataSnippetsScript } from './ZavorthControlClassicClientDataSnippetsScript.js';

export function getZavorthControlClassicClientDataScript(): string {
  return [
    getZavorthControlClassicClientDataLogsScript(),
    getZavorthControlClassicClientDataSnippetsScript(),
    getZavorthControlClassicClientDataAuditScript(),
    getZavorthControlClassicClientDataInitScript(),
  ].join('\n\n');
}

