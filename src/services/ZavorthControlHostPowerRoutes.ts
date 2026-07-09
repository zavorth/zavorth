import * as http from 'http';
import { HostPowerModeService } from './HostPowerModeService.js';
import * as schemas from '../domain/validation/controlSchemas.js';
import type { ZavorthControlCoreRouteDeps } from './ZavorthControlCoreRouteService.js';
import { asErrorLike } from '../utils/errorLike';

export async function handleHostPowerRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  url: URL,
  deps: ZavorthControlCoreRouteDeps,
): Promise<boolean> {
  if (pathname === '/api/v2/workspace/host-power/status' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const workspaceId = url.searchParams.get('workspaceId');
      if (!workspaceId) {
        deps.writeJson(res, { ok: false, error: 'workspaceId parameter is required' }, 400);
        return true;
      }
      const state = HostPowerModeService.getInstance().getState(workspaceId);
      deps.writeJson(res, { ok: true, data: state });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: err.message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/host-power/enable' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.enableHostPowerSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId, durationMinutes } = parsed.data;

      await HostPowerModeService.getInstance().enable(workspaceId, durationMinutes);
      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: err.message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/workspace/host-power/disable' && req.method === 'POST') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const body = await deps.readJsonBody(req);
      const parsed = schemas.disableHostPowerSchema.safeParse(body);
      if (!parsed.success) {
        deps.writeJson(res, { ok: false, error: 'Validation failed', details: parsed.error.format() }, 400);
        return true;
      }
      const { workspaceId } = parsed.data;

      await HostPowerModeService.getInstance().disable(workspaceId);
      deps.writeJson(res, { ok: true });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: err.message }, 500);
    }
    return true;
  }

  return false;
}
