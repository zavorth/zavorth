import type { WebAppSupervisionRouteContext, WebAppSupervisionRouteHandler } from './types.js';

export const handleSwarmV2Routes: WebAppSupervisionRouteHandler = async (ctx) => {
  const {
    req,
    res,
    url,
    deps,
    swarmV2Service: service,
    swarmV2Label,
    experimentalAlias,
    isSwarmV2Route,
  } = ctx;

  if (isSwarmV2Route() && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${swarmV2Label} indisponivel.` }, 503);
      return true;
    }
    deps.writeJson(res, { ok: true, experimental: experimentalAlias, swarms: service.listSwarms() }, 200);
    return true;
  }

  if (isSwarmV2Route() && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${swarmV2Label} indisponivel.` }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const objective = String(body.objective || '').trim();
    const roles = Array.isArray(body.roles)
      ? body.roles.map((role: any, index: number) => ({
        id: String(role?.id || `role-${index + 1}`),
        label: String(role?.label || `Role ${index + 1}`),
        systemPrompt: String(role?.systemPrompt || '').trim(),
        command: String(role?.command || '').trim() || undefined,
        args: Array.isArray(role?.args) ? role.args.map((value: unknown) => String(value)) : undefined,
      }))
      : [];
    const swarm = service.launchSwarm({
      swarmId: String(body.swarmId || '').trim() || undefined,
      objective,
      roles,
    });
    deps.writeJson(res, { ok: true, experimental: experimentalAlias, swarm }, 200);
    return true;
  }

  if (isSwarmV2Route('/state') && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${swarmV2Label} indisponivel.` }, 503);
      return true;
    }
    const swarmId = String(url.searchParams.get('swarmId') || '').trim();
    if (!swarmId) {
      deps.writeJson(res, { ok: false, error: 'swarmId obrigatorio.' }, 400);
      return true;
    }
    const swarm = service.getSwarm(swarmId);
    if (!swarm) {
      deps.writeJson(res, { ok: false, error: `${swarmV2Label} nao encontrado.` }, 404);
      return true;
    }
    deps.writeJson(res, { ok: true, experimental: experimentalAlias, swarm }, 200);
    return true;
  }

  if (isSwarmV2Route('/cancel') && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${swarmV2Label} indisponivel.` }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const swarmId = String(body.swarmId || '').trim();
    if (!swarmId) {
      deps.writeJson(res, { ok: false, error: 'swarmId obrigatorio.' }, 400);
      return true;
    }
    deps.writeJson(
      res,
      { ok: true, experimental: experimentalAlias, swarm: service.cancelSwarm(swarmId) },
      200,
    );
    return true;
  }

  return false;
};
