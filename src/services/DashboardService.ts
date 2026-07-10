/**
 * Compatibility alias: historical DashboardService is the full HTTP control/web host.
 * WebAppService remains the embedded request-handler composition used by ZavorthControl.
 */
export {
  ZavorthControlService as DashboardService,
  ZavorthControlService,
} from './ZavorthControlService.js';
export type { ChannelIngressGateways as DashboardChannelIngressGateways } from './ZavorthControlService.js';
export {
  WebAppService,
} from './WebAppService.js';
export type {
  WebAppRuntime as DashboardRuntime,
  WebAppServiceOptions as DashboardServiceOptions,
  WebAppRuntime,
  WebAppServiceOptions,
} from './WebAppService.js';
