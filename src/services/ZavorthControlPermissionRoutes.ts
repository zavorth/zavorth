import * as http from 'http';
import * as schemas from '../domain/validation/controlSchemas.js';

import type { ZavorthControlCoreRouteDeps } from './ZavorthControlCoreRouteService.js';

export type ZavorthControlRouteInput = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  pathname: string;
  deps: ZavorthControlCoreRouteDeps;
};

type PermissionRouteContext = {
  readResolverContext: (body: Record<string, unknown>) => Record<string, unknown> | null;
};

export async function handleControlPermissionRoutes(
  input: ZavorthControlRouteInput,
  context: PermissionRouteContext,
): Promise<boolean | null> {
  const { req, res, pathname, deps } = input;
  if (pathname === '/api/v2/permissions/pending' && req.method === 'GET') {
    const data = deps.echo
      ? deps.echo.getPendingPermissions()
      : deps.proactivePermissions.listPending?.() || [];
    deps.writeJson(res, {
      ok: true,
      deprecated: true,
      canonical: '/api/v2/echo/permissions',
      data,
    });
    return true;
  }

  if (pathname === '/api/v2/permissions/resolve' && req.method === 'POST') {
    const body = await deps.readJsonBody(req);
    const parsed = schemas.resolvePermissionSchema.safeParse(body);
    if (!parsed.success) {
      deps.writeJson(res, {
        ok: false,
        deprecated: true,
        canonical: '/api/v2/echo/permissions/resolve',
        error: 'Validation failed',
        details: parsed.error.format()
      }, 400);
      return true;
    }
    const { id, approved } = parsed.data;

    if (deps.echo) {
      const resolverContext = context.readResolverContext(parsed.data);
      const result = resolverContext
        ? await deps.echo.resolvePermission(id, approved, resolverContext)
        : await deps.echo.resolvePermission(id, approved);
      deps.writeJson(res, {
        deprecated: true,
        canonical: '/api/v2/echo/permissions/resolve',
        ...((result || {}) as Record<string, unknown>),
      }, (result as { ok?: boolean })?.ok ? 200 : 404);
      return true;
    }

    const success = deps.proactivePermissions.resolve(id, approved);
    deps.writeJson(res, {
      ok: success,
      deprecated: true,
      canonical: '/api/v2/echo/permissions/resolve',
    });
    return true;
  }


  return null;
}
