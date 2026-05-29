// @ts-nocheck
import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';

function zavorthControlClassicClientDataInit() {
    loadMetrics();
    setInterval(loadMetrics, 10000);
}

export function getZavorthControlClassicClientDataInitScript(): string {
  return extractFunctionBody(zavorthControlClassicClientDataInit);
}

