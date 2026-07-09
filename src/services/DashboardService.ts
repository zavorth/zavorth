/**
 * Compatibility alias: DashboardService was renamed to WebAppService
 * during the zavorthControl migration. Tests and legacy imports keep working.
 */
export {
  WebAppService as DashboardService,
  WebAppService,
} from './WebAppService.js';
export type {
  WebAppRuntime as DashboardRuntime,
  WebAppServiceOptions as DashboardServiceOptions,
  WebAppRuntime,
  WebAppServiceOptions,
} from './WebAppService.js';
