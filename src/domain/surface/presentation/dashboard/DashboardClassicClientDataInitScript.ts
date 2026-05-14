// @ts-nocheck
import { extractFunctionBody } from './DashboardClassicScriptUtils.js';

function dashboardClassicClientDataInit() {
    loadMetrics();
    setInterval(loadMetrics, 10000);
}

export function getDashboardClassicClientDataInitScript(): string {
  return extractFunctionBody(dashboardClassicClientDataInit);
}

