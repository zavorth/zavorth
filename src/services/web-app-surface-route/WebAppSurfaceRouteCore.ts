import * as http from 'http';
import { readLowerTrimmedSearchParam, readTrimmedSearchParam } from './WebAppSurfaceRouteParsing.js';
import type { WebAppSurfaceRouteDeps } from './WebAppSurfaceRouteTypes.js';

export async function handleWebAppSurfaceCoreRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  pathname: string,
  deps: any,
): Promise<boolean> {
  if (pathname === '/api/web/capabilities' && req.method === 'GET') {
    if (!deps.capabilityCatalog) {
      deps.writeJson(res, { ok: false, error: 'Capability catalog unavailable.' }, 503);
      return true;
    }

    deps.writeJson(res, { ok: true, capabilities: deps.capabilityCatalog.buildSnapshot() }, 200);
    return true;
  }

  if (pathname === '/api/web/gateway' && req.method === 'GET') {
    const gatewayService = deps.runtimeGateway || deps.gateway;
    if (!gatewayService) {
      deps.writeJson(res, { ok: false, error: 'Gateway unificado indisponivel.' }, 503);
      return true;
    }

    const requestedSessionId = readTrimmedSearchParam(url, 'sessionId');
    const sessionId = requestedSessionId || (deps.realtime ? deps.realtime.createSession() : 'web-gateway');
    const snapshot = await gatewayService.buildHydratedSnapshot({
      sessionId,
      chatId: deps.realtime?.getChatId(sessionId) || `web:${sessionId}`,
      userId: deps.runtime?.webUserId || '1',
    });
    const runtime = deps.gatewayRuntime
      ? await deps.gatewayRuntime.buildCanonicalSnapshot({
          sessionId,
          chatId: deps.realtime?.getChatId(sessionId) || `web:${sessionId}`,
          userId: deps.runtime?.webUserId || '1',
        })
      : null;
    deps.writeJson(res, { ok: true, gateway: snapshot, runtime }, 200);
    return true;
  }

  if (pathname === '/api/web/gateway/domains' && req.method === 'GET') {
    const gatewayService = deps.runtimeGateway || deps.gateway;
    if (!gatewayService) {
      deps.writeJson(res, { ok: false, error: 'Domain plane indisponivel.' }, 503);
      return true;
    }

    const detail = readLowerTrimmedSearchParam(url, 'detail');
    if (detail === 'full' && typeof gatewayService.buildDomainSnapshot === 'function') {
      deps.writeJson(res, { ok: true, domains: gatewayService.buildDomainSnapshot() }, 200);
      return true;
    }

    if (typeof gatewayService.buildDomainSummarySnapshot === 'function') {
      deps.writeJson(res, { ok: true, domains: gatewayService.buildDomainSummarySnapshot() }, 200);
      return true;
    }

    const requestedSessionId = readTrimmedSearchParam(url, 'sessionId');
    const sessionId = requestedSessionId || (deps.realtime ? deps.realtime.createSession() : 'web-gateway-domains');
    const snapshot = await gatewayService.buildHydratedSnapshot({
      sessionId,
      chatId: deps.realtime?.getChatId(sessionId) || `web:${sessionId}`,
      userId: deps.runtime?.webUserId || '1',
    });
    deps.writeJson(res, { ok: true, domains: snapshot.domains || null, gateway: snapshot }, 200);
    return true;
  }

  if (pathname === '/api/web/control-plane' && req.method === 'GET') {
    const gatewayService = deps.runtimeGateway || deps.gateway;
    if (!gatewayService) {
      deps.writeJson(res, { ok: false, error: 'Control plane indisponivel.' }, 503);
      return true;
    }

    const requestedSessionId = readTrimmedSearchParam(url, 'sessionId');
    const sessionId = requestedSessionId || (deps.realtime ? deps.realtime.createSession() : 'web-control-plane');
    const snapshot = await gatewayService.buildHydratedSnapshot({
      sessionId,
      chatId: deps.realtime?.getChatId(sessionId) || `web:${sessionId}`,
      userId: deps.runtime?.webUserId || '1',
    });
    const runtime = deps.gatewayRuntime
      ? await deps.gatewayRuntime.buildCanonicalSnapshot({
          sessionId,
          chatId: deps.realtime?.getChatId(sessionId) || `web:${sessionId}`,
          userId: deps.runtime?.webUserId || '1',
        })
      : null;
    deps.writeJson(res, { ok: true, controlPlane: snapshot.controlPlane, gateway: snapshot, runtime }, 200);
    return true;
  }

  if (pathname === '/api/web/memory-plane' && req.method === 'GET') {
    const sessionId = deps.resolveSessionId(url);
    const memoryPlane = await deps.buildMemoryPlaneSnapshot(sessionId);
    if (!memoryPlane) {
      deps.writeJson(res, { ok: false, error: 'Memory plane indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(res, { ok: true, memoryPlane }, 200);
    return true;
  }

  return false;
}
