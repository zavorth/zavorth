import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';

declare const loadMetrics: () => void;

function zavorthControlClassicClientDataInit() {
    loadMetrics();
    setInterval(loadMetrics, 10000);
}

export function getZavorthControlClassicClientDataInitScript(): string {
  return extractFunctionBody(zavorthControlClassicClientDataInit);
}

