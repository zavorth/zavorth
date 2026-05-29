import { getZavorthControlClassicClientCoreScript } from './ZavorthControlClassicClientCoreScript.js';
import { getZavorthControlClassicClientDataScript } from './ZavorthControlClassicClientDataScript.js';
import { getZavorthControlClassicClientOverviewScript } from './ZavorthControlClassicClientOverviewScript.js';

export function getZavorthControlClassicClientScript(): string {
  return [
    getZavorthControlClassicClientCoreScript(),
    getZavorthControlClassicClientOverviewScript(),
    getZavorthControlClassicClientDataScript(),
  ].join('\n\n');
}

