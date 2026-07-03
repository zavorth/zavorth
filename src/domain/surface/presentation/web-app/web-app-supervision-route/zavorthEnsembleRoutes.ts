import type { WebAppSupervisionRouteContext, WebAppSupervisionRouteHandler } from './types.js';
import { buildWebOperatorApprovalSafety } from './helpers.js';

export const handleZavorthEnsembleRoutes: WebAppSupervisionRouteHandler = async (ctx) => {
  const {
    req,
    res,
    url,
    deps,
    zavorthEnsembleService: service,
    zavorthEnsembleLabel,
    experimentalAlias,
    isZavorthEnsembleRoute,
    isSwarmScaleRoute,
    swarmScalePlaneService: scaleService,
  } = ctx;

  if (isSwarmScaleRoute() && req.method === 'GET') {
    if (!scaleService?.listRuns) {
      deps.writeJson(res, { ok: false, error: 'Swarm Scale Plane indisponivel.' }, 503);
      return true;
    }
    deps.writeJson(res, {
      ok: true,
      experimental: experimentalAlias,
      official: !experimentalAlias,
      surface: experimentalAlias ? 'swarm-scale-legacy-alias' : 'swarm-scale-plane',
      runs: scaleService.listRuns(),
    }, 200);
    return true;
  }

  if (isSwarmScaleRoute() && req.method === 'POST') {
    if (!scaleService?.launch) {
      deps.writeJson(res, { ok: false, error: 'Swarm Scale Plane indisponivel.' }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const objective = String(body.objective || body.text || '').trim();
    if (!objective) {
      deps.writeJson(res, { ok: false, error: 'objective obrigatorio.' }, 400);
      return true;
    }
    const desiredAgents = Number.isFinite(Number(body.desiredAgents || body.agents))
      ? Number(body.desiredAgents || body.agents)
      : undefined;
    const executionMode = String(body.executionMode || '').trim();
    const approvalSafety = buildWebOperatorApprovalSafety(ctx, body);
    if (executionMode === 'llm-live' && Number(desiredAgents || 0) > 20 && !approvalSafety.operatorApprovalAccepted) {
      deps.writeJson(res, {
        ok: false,
        error: 'Swarm Scale Plane live com mais de 20 agentes exige approval header forte.',
        code: 'swarm_scale_live_approval_required',
        approval: approvalSafety,
      }, 403);
      return true;
    }
    const snapshot = await scaleService.launch({
      runId: String(body.runId || '').trim() || undefined,
      objective,
      desiredAgents,
      maxAgents: Number.isFinite(Number(body.maxAgents)) ? Number(body.maxAgents) : undefined,
      maxSteps: Number.isFinite(Number(body.maxSteps || body.steps)) ? Number(body.maxSteps || body.steps) : undefined,
      maxConcurrency: Number.isFinite(Number(body.maxConcurrency || body.concurrency)) ? Number(body.maxConcurrency || body.concurrency) : undefined,
      plannerMode: String(body.plannerMode || '').trim() as any || undefined,
      executionMode: executionMode as any || undefined,
      stopAfterSteps: Number.isFinite(Number(body.stopAfterSteps)) ? Number(body.stopAfterSteps) : undefined,
      persistState: body.persistState !== false,
      approvalId: String(body.approvalId || '').trim() || undefined,
    });
    deps.writeJson(res, {
      ok: true,
      experimental: experimentalAlias,
      official: !experimentalAlias,
      surface: experimentalAlias ? 'swarm-scale-legacy-alias' : 'swarm-scale-plane',
      snapshot,
    }, 200);
    return true;
  }

  if (isSwarmScaleRoute('/state') && req.method === 'GET') {
    if (!scaleService?.getRun) {
      deps.writeJson(res, { ok: false, error: 'Swarm Scale Plane indisponivel.' }, 503);
      return true;
    }
    const runId = String(url.searchParams.get('runId') || '').trim();
    if (!runId) {
      deps.writeJson(res, { ok: false, error: 'runId obrigatorio.' }, 400);
      return true;
    }
    const snapshot = scaleService.getRun(runId);
    if (!snapshot) {
      deps.writeJson(res, { ok: false, error: 'Swarm Scale Plane run nao encontrado.' }, 404);
      return true;
    }
    deps.writeJson(res, {
      ok: true,
      experimental: experimentalAlias,
      official: !experimentalAlias,
      snapshot,
    }, 200);
    return true;
  }

  if (isSwarmScaleRoute('/resume') && req.method === 'POST') {
    if (!scaleService?.resume) {
      deps.writeJson(res, { ok: false, error: 'Swarm Scale Plane indisponivel.' }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const runId = String(body.runId || '').trim();
    if (!runId) {
      deps.writeJson(res, { ok: false, error: 'runId obrigatorio.' }, 400);
      return true;
    }
    const snapshot = await scaleService.resume({
      runId,
      stopAfterSteps: Number.isFinite(Number(body.stopAfterSteps)) ? Number(body.stopAfterSteps) : undefined,
      persistState: body.persistState !== false,
    });
    deps.writeJson(res, {
      ok: true,
      experimental: experimentalAlias,
      official: !experimentalAlias,
      snapshot,
    }, 200);
    return true;
  }

  if (isZavorthEnsembleRoute() && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} indisponivel.` }, 503);
      return true;
    }
    deps.writeJson(res, {
      ok: true,
      experimental: experimentalAlias,
      official: !experimentalAlias,
      surface: experimentalAlias ? 'zavorth-ensemble-legacy-alias' : 'zavorth-ensemble-official',
      swarms: service.listSwarms(),
    }, 200);
    return true;
  }

  if (isZavorthEnsembleRoute() && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} indisponivel.` }, 503);
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
        error: 'Zavorth Ensemble web/API route blocks direct command/toolSpecs execution. Use the governed execution/approval path for shell tools.',
        code: 'zavorth_ensemble_governed_tool_execution_required',
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
      surface: experimentalAlias ? 'zavorth-ensemble-legacy-alias' : 'zavorth-ensemble-official',
      swarm,
    }, 200);
    return true;
  }

  if (isZavorthEnsembleRoute('/roles') && req.method === 'GET') {
    if (!service?.listRoleLibrary) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} role library indisponivel.` }, 503);
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

  if (isZavorthEnsembleRoute('/roles') && req.method === 'POST') {
    if (!service?.upsertRoleLibraryEntry) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} role library indisponivel.` }, 503);
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

  if (isZavorthEnsembleRoute('/replay') && req.method === 'GET') {
    if (!service?.getSwarmReplay) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} replay indisponivel.` }, 503);
      return true;
    }
    const swarmId = String(url.searchParams.get('swarmId') || '').trim();
    if (!swarmId) {
      deps.writeJson(res, { ok: false, error: 'swarmId obrigatorio.' }, 400);
      return true;
    }
    const replay = service.getSwarmReplay(swarmId);
    if (!replay) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} replay nao encontrado.` }, 404);
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

  if (isZavorthEnsembleRoute('/state') && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} indisponivel.` }, 503);
      return true;
    }
    const swarmId = String(url.searchParams.get('swarmId') || '').trim();
    if (!swarmId) {
      deps.writeJson(res, { ok: false, error: 'swarmId obrigatorio.' }, 400);
      return true;
    }
    const swarm = service.getSwarm(swarmId);
    if (!swarm) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} nao encontrado.` }, 404);
      return true;
    }
    deps.writeJson(res, { ok: true, experimental: experimentalAlias, official: !experimentalAlias || swarm.official === true, swarm }, 200);
    return true;
  }

  if (isZavorthEnsembleRoute('/cancel') && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} indisponivel.` }, 503);
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
