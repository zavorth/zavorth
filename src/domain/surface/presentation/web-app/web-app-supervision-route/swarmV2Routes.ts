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
    deps.writeJson(res, {
      ok: true,
      experimental: experimentalAlias,
      official: !experimentalAlias,
      surface: experimentalAlias ? 'swarm-v2-legacy-alias' : 'swarm-v2-official',
      swarms: service.listSwarms(),
    }, 200);
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
        stdinMode: role?.stdinMode === 'prompt' ? 'prompt' : role?.stdinMode === 'none' ? 'none' : undefined,
        cwd: String(role?.cwd || '').trim() || undefined,
        toolSpecId: String(role?.toolSpecId || '').trim() || undefined,
      }))
      : [];
    const requestedCommandRoles = Array.isArray(body.roles)
      ? body.roles.some((role: any) => String(role?.command || '').trim() || (Array.isArray(role?.args) && role.args.length > 0))
      : false;
    const requestedToolSpecs = Array.isArray(body.toolSpecs)
      ? body.toolSpecs.some((tool: any) => String(tool?.command || '').trim())
      : false;
    if (requestedCommandRoles || requestedToolSpecs) {
      deps.writeJson(res, {
        ok: false,
        error: 'Swarm v2 web/API route blocks direct command/toolSpecs execution. Use the governed execution/approval path for shell tools.',
        code: 'swarm_v2_governed_tool_execution_required',
      }, 403);
      return true;
    }
    const canonicalOfficial = !experimentalAlias || body.official === true;
    const officialInput = {
        swarmId: String(body.swarmId || '').trim() || undefined,
        objective,
        roles,
        official: true,
        roleLibraryIds: Array.isArray(body.roleLibraryIds) ? body.roleLibraryIds.map((value: unknown) => String(value)) : undefined,
        maxRoles: Number.isFinite(Number(body.maxRoles)) ? Number(body.maxRoles) : undefined,
        maxConcurrency: Number.isFinite(Number(body.maxConcurrency)) ? Number(body.maxConcurrency) : undefined,
        batchSize: Number.isFinite(Number(body.batchSize)) ? Number(body.batchSize) : undefined,
        isolationMode: String(body.isolationMode || '').trim() as any || undefined,
        isolationImage: String(body.isolationImage || '').trim() || undefined,
        wslDistro: String(body.wslDistro || '').trim() || undefined,
        requireStrongIsolation: body.requireStrongIsolation === true,
        autoSelectRoles: body.autoSelectRoles === true,
        desiredRoleCount: Number.isFinite(Number(body.desiredRoleCount)) ? Number(body.desiredRoleCount) : undefined,
        benchmark: body.benchmark === true,
        tokenBudget: body.tokenBudget && typeof body.tokenBudget === 'object'
          ? {
            maxLlmCalls: Number.isFinite(Number(body.tokenBudget.maxLlmCalls)) ? Number(body.tokenBudget.maxLlmCalls) : undefined,
            maxEstimatedTokens: Number.isFinite(Number(body.tokenBudget.maxEstimatedTokens)) ? Number(body.tokenBudget.maxEstimatedTokens) : undefined,
            maxEstimatedUsd: Number.isFinite(Number(body.tokenBudget.maxEstimatedUsd)) ? Number(body.tokenBudget.maxEstimatedUsd) : undefined,
            modelClass: body.tokenBudget.modelClass,
            approved: false,
            allowHighCost: false,
          }
          : undefined,
        toolSpecs: undefined,
      };
    const swarm = canonicalOfficial && typeof service.launchOfficialSwarmAsync === 'function'
      ? await service.launchOfficialSwarmAsync(officialInput)
      : canonicalOfficial && typeof service.launchOfficialSwarm === 'function'
      ? service.launchOfficialSwarm(officialInput)
      : service.launchSwarm({
      swarmId: String(body.swarmId || '').trim() || undefined,
      objective,
      roles,
    });
    deps.writeJson(res, {
      ok: true,
      experimental: experimentalAlias,
      official: !experimentalAlias || swarm.official === true,
      surface: experimentalAlias ? 'swarm-v2-legacy-alias' : 'swarm-v2-official',
      swarm,
    }, 200);
    return true;
  }

  if (isSwarmV2Route('/roles') && req.method === 'GET') {
    if (!service?.listRoleLibrary) {
      deps.writeJson(res, { ok: false, error: `${swarmV2Label} role library indisponivel.` }, 503);
      return true;
    }
    deps.writeJson(res, {
      ok: true,
      experimental: experimentalAlias,
      official: !experimentalAlias,
      roles: service.listRoleLibrary(),
    }, 200);
    return true;
  }

  if (isSwarmV2Route('/roles') && req.method === 'POST') {
    if (!service?.upsertRoleLibraryEntry) {
      deps.writeJson(res, { ok: false, error: `${swarmV2Label} role library indisponivel.` }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const role = service.upsertRoleLibraryEntry({
      id: String(body.id || '').trim(),
      label: String(body.label || '').trim(),
      kind: body.kind,
      systemPrompt: String(body.systemPrompt || '').trim(),
      defaultTools: Array.isArray(body.defaultTools) ? body.defaultTools.map((value: unknown) => String(value)) : undefined,
      risk: body.risk,
      scope: body.scope,
      tags: Array.isArray(body.tags) ? body.tags.map((value: unknown) => String(value)) : undefined,
    });
    deps.writeJson(res, {
      ok: true,
      experimental: experimentalAlias,
      official: !experimentalAlias,
      role,
    }, 200);
    return true;
  }

  if (isSwarmV2Route('/replay') && req.method === 'GET') {
    if (!service?.getSwarmReplay) {
      deps.writeJson(res, { ok: false, error: `${swarmV2Label} replay indisponivel.` }, 503);
      return true;
    }
    const swarmId = String(url.searchParams.get('swarmId') || '').trim();
    if (!swarmId) {
      deps.writeJson(res, { ok: false, error: 'swarmId obrigatorio.' }, 400);
      return true;
    }
    const replay = service.getSwarmReplay(swarmId);
    if (!replay) {
      deps.writeJson(res, { ok: false, error: `${swarmV2Label} replay nao encontrado.` }, 404);
      return true;
    }
    deps.writeJson(res, {
      ok: true,
      experimental: experimentalAlias,
      official: !experimentalAlias,
      replay: replay.events,
    }, 200);
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
    deps.writeJson(res, { ok: true, experimental: experimentalAlias, official: !experimentalAlias || swarm.official === true, swarm }, 200);
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
      {
        ok: true,
        experimental: experimentalAlias,
        official: !experimentalAlias,
        swarm: service.cancelSwarm(swarmId),
      },
      200,
    );
    return true;
  }

  return false;
};
