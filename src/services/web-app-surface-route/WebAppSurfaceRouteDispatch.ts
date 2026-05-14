import * as http from 'http';
import type { WebAppSurfaceRouteDeps } from './WebAppSurfaceRouteTypes.js';
import { handleWebAppSurfaceCoreRoutes } from './WebAppSurfaceRouteCore.js';
import { handleWebAppSurfaceOperationRoutes } from './WebAppSurfaceRouteOperations.js';
import { handleWebAppSurfaceSkillRoutes } from './WebAppSurfaceRouteSkills.js';

export async function handleWebAppSurfaceRouteRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  pathname: string,
  deps: WebAppSurfaceRouteDeps,
): Promise<boolean> {
  if (await handleWebAppSurfaceSkillRoutes(req, res, url, pathname, deps)) {
    return true;
  }

  if (await handleWebAppSurfaceOperationRoutes(req, res, url, pathname, deps)) {
    return true;
  }

  if (await handleWebAppSurfaceCoreRoutes(req, res, url, pathname, deps)) {
    return true;
  }

  return false;
}
