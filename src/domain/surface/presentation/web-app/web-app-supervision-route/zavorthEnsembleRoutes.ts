import type { WebAppSupervisionRouteHandler } from './types.js';
import { buildWebOperatorApprovalSafety } from './helpers.js';
import type {
  SwarmScaleControlSurface,
  SwarmScaleExecutionBackendId,
  SwarmScaleExecutionMode,
  SwarmScalePlannerMode,
} from '../../../../../contracts/execution/SwarmScalePlaneContract.js';
import type {
  ZavorthEnsembleCreateInput,
  ZavorthEnsembleIsolationMode,
  ZavorthEnsembleRoleLibraryEntry,
  ZavorthEnsembleTokenBudgetInput,
} from '../../../../../agents/ZavorthEnsembleService.js';
import type { SwarmRole } from '../../../../../runtime/sessions/v2/SwarmOrchestrator.js';

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
      deps.writeJson(res, { ok: false, error: 'Swarm Scale Plane is unavailable.' }, 503);
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
      deps.writeJson(res, { ok: false, error: 'Swarm Scale Plane is unavailable.' }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const objective = String(body.objective || body.text || '').trim();
    if (!objective) {
      deps.writeJson(res, { ok: false, error: 'objective is required.' }, 400);
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
        error: 'Swarm Scale Plane live mode with more than 20 agents requires a strong operator approval header.',
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
      plannerMode: String(body.plannerMode || '').trim() as SwarmScalePlannerMode || undefined,
      executionMode: executionMode as SwarmScaleExecutionMode || undefined,
      executionBackend: optionalString(body.executionBackend || body.backend) as SwarmScaleExecutionBackendId || undefined,
      cloudSandboxEnabled: optionalBoolean(body.cloudSandboxEnabled ?? body.cloudSandbox ?? body.cloud),
      deviceNodeRouting: optionalBoolean(body.deviceNodeRouting ?? body.deviceRouting ?? body.devices),
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

  if (isSwarmScaleRoute('/configure') && req.method === 'POST') {
    if (!scaleService?.configureRun) {
      deps.writeJson(res, { ok: false, error: 'Swarm Scale Plane dynamic configuration is unavailable.' }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const runId = String(body.runId || '').trim();
    if (!runId) {
      deps.writeJson(res, { ok: false, error: 'runId is required.' }, 400);
      return true;
    }
    const snapshot = scaleService.configureRun({
      runId,
      sourceSurface: normalizeSwarmScaleSurface(body.sourceSurface || body.surface || 'zavorthControl') as SwarmScaleControlSurface,
      actorId: optionalString(body.actorId || body.actor || body.userId) || null,
      reason: optionalString(body.reason) || null,
      persistState: body.persistState !== false,
      patch: {
        maxConcurrency: optionalNumber(body.maxConcurrency ?? body.concurrency),
        maxSteps: optionalNumber(body.maxSteps ?? body.steps),
        executionMode: optionalString(body.executionMode || body.mode) as SwarmScaleExecutionMode || undefined,
        executionBackend: optionalString(body.executionBackend || body.backend) as SwarmScaleExecutionBackendId || undefined,
        cloudSandboxEnabled: optionalBoolean(body.cloudSandboxEnabled ?? body.cloudSandbox ?? body.cloud),
        deviceNodeRouting: optionalBoolean(body.deviceNodeRouting ?? body.deviceRouting ?? body.devices),
        pauseReason: body.pauseReason === null ? null : optionalString(body.pauseReason) || undefined,
      },
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
      deps.writeJson(res, { ok: false, error: 'Swarm Scale Plane is unavailable.' }, 503);
      return true;
    }
    const runId = String(url.searchParams.get('runId') || '').trim();
    if (!runId) {
      deps.writeJson(res, { ok: false, error: 'runId is required.' }, 400);
      return true;
    }
    const snapshot = scaleService.getRun(runId);
    if (!snapshot) {
      deps.writeJson(res, { ok: false, error: 'Swarm Scale Plane run was not found.' }, 404);
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
      deps.writeJson(res, { ok: false, error: 'Swarm Scale Plane is unavailable.' }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const runId = String(body.runId || '').trim();
    if (!runId) {
      deps.writeJson(res, { ok: false, error: 'runId is required.' }, 400);
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
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} is unavailable.` }, 503);
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
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} is unavailable.` }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const objective = String(body.objective || '').trim();
    const roles = Array.isArray(body.roles)
      ? body.roles.map((entry: unknown, index: number): SwarmRole => {
        const role = asRecord(entry) || {};
        return {
          id: String(role?.id || `role-${index + 1}`),
          label: String(role?.label || `Role ${index + 1}`),
          systemPrompt: String(role?.systemPrompt || '').trim(),
          stdinMode: role?.stdinMode === 'prompt' ? 'prompt' : role?.stdinMode === 'none' ? 'none' : undefined,
          cwd: String(role?.cwd || '').trim() || undefined,
          toolSpecId: String(role?.toolSpecId || '').trim() || undefined,
        };
      })
      : [];
    const requestedCommandRoles = Array.isArray(body.roles)
      ? body.roles.some((entry: unknown) => {
        const role = asRecord(entry);
        return String(role?.command || '').trim() || (Array.isArray(role?.args) && role.args.length > 0);
      })
      : false;
    const requestedToolSpecs = Array.isArray(body.toolSpecs)
      ? body.toolSpecs.some((entry: unknown) => String(asRecord(entry)?.command || '').trim())
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
    const tokenBudget = asRecord(body.tokenBudget);
    const officialInput: ZavorthEnsembleCreateInput = {
      swarmId: String(body.swarmId || '').trim() || undefined,
      objective,
      roles,
      official: true,
      roleLibraryIds: Array.isArray(body.roleLibraryIds) ? body.roleLibraryIds.map((value: unknown) => String(value)) : undefined,
      maxRoles: Number.isFinite(Number(body.maxRoles)) ? Number(body.maxRoles) : undefined,
      maxConcurrency: Number.isFinite(Number(body.maxConcurrency)) ? Number(body.maxConcurrency) : undefined,
      batchSize: Number.isFinite(Number(body.batchSize)) ? Number(body.batchSize) : undefined,
      isolationMode: normalizeZavorthEnsembleIsolationMode(body.isolationMode),
      isolationImage: String(body.isolationImage || '').trim() || undefined,
      wslDistro: String(body.wslDistro || '').trim() || undefined,
      requireStrongIsolation: body.requireStrongIsolation === true,
      autoSelectRoles: body.autoSelectRoles === true,
      desiredRoleCount: Number.isFinite(Number(body.desiredRoleCount)) ? Number(body.desiredRoleCount) : undefined,
      benchmark: body.benchmark === true,
      tokenBudget: tokenBudget
        ? {
          maxLlmCalls: Number.isFinite(Number(tokenBudget.maxLlmCalls)) ? Number(tokenBudget.maxLlmCalls) : undefined,
          maxEstimatedTokens: Number.isFinite(Number(tokenBudget.maxEstimatedTokens)) ? Number(tokenBudget.maxEstimatedTokens) : undefined,
          maxEstimatedUsd: Number.isFinite(Number(tokenBudget.maxEstimatedUsd)) ? Number(tokenBudget.maxEstimatedUsd) : undefined,
          modelClass: normalizeTokenBudgetModelClass(tokenBudget.modelClass),
          approved: false,
          allowHighCost: false,
        } satisfies ZavorthEnsembleTokenBudgetInput
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
      official: !experimentalAlias || ('official' in swarm && swarm.official === true),
      surface: experimentalAlias ? 'zavorth-ensemble-legacy-alias' : 'zavorth-ensemble-official',
      swarm,
    }, 200);
    return true;
  }

  if (isZavorthEnsembleRoute('/roles') && req.method === 'GET') {
    if (!service?.listRoleLibrary) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} role library is unavailable.` }, 503);
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
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} role library is unavailable.` }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const role = service.upsertRoleLibraryEntry({
      id: String(body.id || '').trim(),
      label: String(body.label || '').trim(),
      kind: normalizeRoleLibraryKind(body.kind),
      systemPrompt: String(body.systemPrompt || '').trim(),
      defaultTools: Array.isArray(body.defaultTools) ? body.defaultTools.map((value: unknown) => String(value)) : undefined,
      risk: normalizeRoleLibraryRisk(body.risk),
      scope: normalizeRoleLibraryScope(body.scope),
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
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} replay is unavailable.` }, 503);
      return true;
    }
    const swarmId = String(url.searchParams.get('swarmId') || '').trim();
    if (!swarmId) {
      deps.writeJson(res, { ok: false, error: 'swarmId required.' }, 400);
      return true;
    }
    const replay = service.getSwarmReplay(swarmId);
    if (!replay) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} replay not found.` }, 404);
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
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} is unavailable.` }, 503);
      return true;
    }
    const swarmId = String(url.searchParams.get('swarmId') || '').trim();
    if (!swarmId) {
      deps.writeJson(res, { ok: false, error: 'swarmId required.' }, 400);
      return true;
    }
    const swarm = service.getSwarm(swarmId);
    if (!swarm) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} not found.` }, 404);
      return true;
    }
    deps.writeJson(res, {
      ok: true,
      experimental: experimentalAlias,
      official: !experimentalAlias || ('official' in swarm && swarm.official === true),
      swarm,
    }, 200);
    return true;
  }

  if (isZavorthEnsembleRoute('/cancel') && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: `${zavorthEnsembleLabel} is unavailable.` }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const swarmId = String(body.swarmId || '').trim();
    if (!swarmId) {
      deps.writeJson(res, { ok: false, error: 'swarmId required.' }, 400);
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

function optionalString(value: unknown): string {
  return String(value || '').trim();
}

function optionalNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === true || value === false) return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'enabled', 'enable'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disabled', 'disable'].includes(normalized)) return false;
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeZavorthEnsembleIsolationMode(value: unknown): ZavorthEnsembleIsolationMode | undefined {
  const normalized = String(value || '').trim();
  return ['direct', 'temp-worktree', 'docker', 'wsl', 'external-sandbox'].includes(normalized)
    ? normalized as ZavorthEnsembleIsolationMode
    : undefined;
}

function normalizeTokenBudgetModelClass(
  value: unknown,
): NonNullable<ZavorthEnsembleTokenBudgetInput['modelClass']> | undefined {
  const normalized = String(value || '').trim();
  return ['cheap', 'standard', 'premium'].includes(normalized)
    ? normalized as NonNullable<ZavorthEnsembleTokenBudgetInput['modelClass']>
    : undefined;
}

function normalizeRoleLibraryKind(value: unknown): ZavorthEnsembleRoleLibraryEntry['kind'] | undefined {
  const normalized = String(value || '').trim();
  return ['planner', 'researcher', 'implementer', 'verifier', 'critic', 'synthesizer', 'operator', 'custom'].includes(normalized)
    ? normalized as ZavorthEnsembleRoleLibraryEntry['kind']
    : undefined;
}

function normalizeRoleLibraryRisk(value: unknown): ZavorthEnsembleRoleLibraryEntry['risk'] | undefined {
  const normalized = String(value || '').trim();
  return ['safe', 'attention', 'danger', 'unknown'].includes(normalized)
    ? normalized as ZavorthEnsembleRoleLibraryEntry['risk']
    : undefined;
}

function normalizeRoleLibraryScope(value: unknown): ZavorthEnsembleRoleLibraryEntry['scope'] | undefined {
  const normalized = String(value || '').trim();
  return ['read_only', 'tool_limited', 'workspace_patch'].includes(normalized)
    ? normalized as ZavorthEnsembleRoleLibraryEntry['scope']
    : undefined;
}

function normalizeSwarmScaleSurface(value: unknown): string {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase().replace(/[\s_-]+/g, '');
  const aliases: Record<string, string> = {
    cli: 'cli',
    tui: 'tui',
    desktop: 'desktop',
    zavorthcontrol: 'zavorthControl',
    dashboard: 'zavorthControl',
    web: 'zavorthControl',
    api: 'api',
    agent: 'agent',
    system: 'system',
  };
  return aliases[normalized] || 'api';
}