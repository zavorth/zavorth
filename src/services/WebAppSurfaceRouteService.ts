import * as http from 'http';
import type { WebAppSurfaceRouteDeps as WebAppSurfaceRouteDepsType } from './web-app-surface-route/WebAppSurfaceRouteTypes.js';
import { handleWebAppSurfaceRouteRequest } from './web-app-surface-route/WebAppSurfaceRouteDispatch.js';
import { WebAppSurfaceChannelTransportRouteService } from './WebAppSurfaceChannelTransportRouteService.js';
import { WebAppSurfaceToolingRouteService } from './WebAppSurfaceToolingRouteService.js';

export type { WebAppSurfaceRouteDeps } from './web-app-surface-route/WebAppSurfaceRouteTypes.js';

export class WebAppSurfaceRouteService {
  private readonly channelTransportRoutes = new WebAppSurfaceChannelTransportRouteService();
  private readonly toolingRoutes = new WebAppSurfaceToolingRouteService();

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: WebAppSurfaceRouteDepsType,
  ): Promise<boolean> {
    if (await handleWebAppSurfaceRouteRequest(req, res, url, pathname, deps)) {
      return true;
    }

    if (await this.channelTransportRoutes.handleRequest(req, res, url, pathname, deps)) {
      return true;
    }

    if (await this.toolingRoutes.handleRequest(req, res, url, pathname, deps)) {
      return true;
    }

    return false;
  }
}
