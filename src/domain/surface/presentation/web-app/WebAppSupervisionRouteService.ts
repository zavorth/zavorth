import * as http from 'http';
import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';
import { buildWebAppSupervisionRouteContext } from './web-app-supervision-route/helpers.js';
import { handleComputerUseRoutes } from './web-app-supervision-route/computerUseRoutes.js';
import { handleEngineeringRoutes } from './web-app-supervision-route/engineeringRoutes.js';
import { handleSessionV2Routes } from './web-app-supervision-route/sessionV2Routes.js';
import { handleZavorthEnsembleRoutes } from './web-app-supervision-route/zavorthEnsembleRoutes.js';
import { handleSystemOverlordRoutes } from './web-app-supervision-route/systemSupervisorRoutes.js';
import { handleMobileSupervisionRoutes } from './web-app-supervision-route/mobileSupervisionRoutes.js';
import { handleProviderRouterRoutes } from './web-app-supervision-route/providerRouterRoutes.js';
import { handleWatchModeRoutes } from './web-app-supervision-route/watchModeRoutes.js';

export class WebAppSupervisionRouteService {
  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    const ctx = buildWebAppSupervisionRouteContext(req, res, url, pathname, deps);

    if (await handleSystemOverlordRoutes(ctx)) {
      return true;
    }

    if (await handleMobileSupervisionRoutes(ctx)) {
      return true;
    }



    if (await handleProviderRouterRoutes(ctx)) {
      return true;
    }

    if (await handleWatchModeRoutes(ctx)) {
      return true;
    }

    if (await handleEngineeringRoutes(ctx)) {
      return true;
    }

    if (await handleSessionV2Routes(ctx)) {
      return true;
    }

    if (await handleComputerUseRoutes(ctx)) {
      return true;
    }

    if (await handleZavorthEnsembleRoutes(ctx)) {
      return true;
    }

    return false;
  }
}
