import type { WebAppSupervisionRouteContext, WebAppSupervisionRouteHandler } from './types.js';

export const handleSessionV2Routes: WebAppSupervisionRouteHandler = async (ctx) => {
  const {
    req,
    res,
    url,
    pathname,
    deps,
    sessionV2Service: service,
    sessionV2Label,
    experimentalAlias,
    isSessionV2Route,
    isSessionV2RecordingRoute,
  } = ctx;

  if (isSessionV2Route() && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${sessionV2Label} unavailable.` }, 503);
      return true;
    }
    deps.writeJson(res, { ok: true, experimental: experimentalAlias, sessions: service.listSessions() }, 200);
    return true;
  }

  if (isSessionV2Route() && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${sessionV2Label} unavailable.` }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const session = service.createSession({
      sessionId: String(body.sessionId || '').trim() || undefined,
      cwd: String(body.cwd || '').trim() || undefined,
      command: String(body.command || '').trim() || undefined,
      args: Array.isArray(body.args) ? body.args.map((value: unknown) => String(value)) : undefined,
      record: typeof body.record === 'boolean' ? body.record : undefined,
    });
    deps.writeJson(res, { ok: true, experimental: experimentalAlias, session }, 200);
    return true;
  }

  if (isSessionV2Route('/state') && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${sessionV2Label} unavailable.` }, 503);
      return true;
    }
    const sessionId = String(url.searchParams.get('sessionId') || '').trim();
    if (!sessionId) {
      deps.writeJson(res, { ok: false, error: 'sessionId obrigatorio.' }, 400);
      return true;
    }
    const session = service.getSession(sessionId);
    if (!session) {
      deps.writeJson(res, { ok: false, error: `${sessionV2Label} nao encontrada.` }, 404);
      return true;
    }
    deps.writeJson(res, { ok: true, experimental: experimentalAlias, session }, 200);
    return true;
  }

  if (isSessionV2Route('/write') && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${sessionV2Label} unavailable.` }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) {
      deps.writeJson(res, { ok: false, error: 'sessionId obrigatorio.' }, 400);
      return true;
    }
    const session = service.writeSession(sessionId, String(body.input || ''));
    deps.writeJson(res, { ok: true, experimental: experimentalAlias, session }, 200);
    return true;
  }

  if (isSessionV2Route('/kill') && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${sessionV2Label} unavailable.` }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) {
      deps.writeJson(res, { ok: false, error: 'sessionId obrigatorio.' }, 400);
      return true;
    }
    deps.writeJson(res, { ok: true, experimental: experimentalAlias, session: service.killSession(sessionId) }, 200);
    return true;
  }

  if (isSessionV2Route('/recordings') && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${sessionV2Label} unavailable.` }, 503);
      return true;
    }
    const sessionId = String(url.searchParams.get('sessionId') || '').trim();
    deps.writeJson(
      res,
      {
        ok: true,
        experimental: experimentalAlias,
        recordings: service.listRecordings(sessionId || undefined),
      },
      200,
    );
    return true;
  }

  if (isSessionV2Route('/memory') && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${sessionV2Label} unavailable.` }, 503);
      return true;
    }
    const sessionId = String(url.searchParams.get('sessionId') || '').trim();
    if (!sessionId) {
      deps.writeJson(res, { ok: false, error: 'sessionId obrigatorio.' }, 400);
      return true;
    }
    deps.writeJson(
      res,
      {
        ok: true,
        experimental: experimentalAlias,
        memory: service.queryMemory(sessionId, url.searchParams.get('query')),
      },
      200,
    );
    return true;
  }

  if (isSessionV2RecordingRoute && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${sessionV2Label} unavailable.` }, 503);
      return true;
    }
    const filename = pathname.split('/').pop() || '';
    if (!filename.endsWith('.cast')) {
      deps.writeJson(res, { ok: false, error: 'Formato invalido.' }, 400);
      return true;
    }
    const target = service.getRecording(filename);
    if (!target) {
      deps.writeJson(res, { ok: false, error: 'Gravacao nao encontrada.' }, 404);
      return true;
    }
    const { readFileSync } = await import('fs');
    const content = readFileSync(target.path, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(content);
    return true;
  }

  return false;
};
