import * as http from 'http';
import { buildNaturalSetupMutationPlanner } from './WebAppSurfaceRouteActions.js';
import {
  readBooleanSearchParam,
  readNumberSearchParam,
  readTrimmedSearchParam,
} from './WebAppSurfaceRouteParsing.js';
import type { WebAppSurfaceRouteDeps } from './WebAppSurfaceRouteTypes.js';

export async function handleWebAppSurfaceOperationRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  pathname: string,
  deps: WebAppSurfaceRouteDeps,
): Promise<boolean> {
  if (pathname === '/api/web/operations/product-observability' && req.method === 'GET') {
    if (!deps.productObservability) {
      deps.writeJson(res, { ok: false, error: 'Observabilidade de produto indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        observability: await deps.productObservability.buildSnapshot({
          workspace: readTrimmedSearchParam(url, 'workspace'),
          sourceSurface: readTrimmedSearchParam(url, ['surface', 'sourceSurface']),
          executor: readTrimmedSearchParam(url, 'executor'),
          workflow: readTrimmedSearchParam(url, 'workflow'),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/evals' && req.method === 'GET') {
    if (!deps.evalControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de evals indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        evals: await deps.evalControlPlane.buildSnapshot({
          workspace: readTrimmedSearchParam(url, 'workspace'),
          sourceSurface: readTrimmedSearchParam(url, ['surface', 'sourceSurface']),
          executor: readTrimmedSearchParam(url, 'executor'),
          workflow: readTrimmedSearchParam(url, 'workflow'),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/qa' && req.method === 'GET') {
    if (!deps.qaControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de QA indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        qa: deps.qaControlPlane.buildSnapshot({
          profile: readTrimmedSearchParam(url, 'profile'),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/governance' && req.method === 'GET') {
    if (!deps.governanceControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de governance indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        governance: deps.governanceControlPlane.buildSnapshot({
          limit: readNumberSearchParam(url, 'limit', 8),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/replay-learning' && req.method === 'GET') {
    if (!deps.replayLearningControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de replay/learning indisponivel.' }, 503);
      return true;
    }

    const sessionId = deps.resolveSessionId(url);
    deps.writeJson(
      res,
      {
        ok: true,
        replayLearning: await deps.replayLearningControlPlane.buildSnapshot({
          sessionId,
          userId: deps.runtime?.webUserId || null,
          platform: 'web',
          chatId: deps.realtime?.getChatId(sessionId) || null,
          workspace: deps.workspaceRoot,
          limit: readNumberSearchParam(url, 'limit', 8),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/ecosystem' && req.method === 'GET') {
    if (!deps.ecosystemControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane do ecossistema indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        ecosystem: deps.ecosystemControlPlane.buildSnapshot({
          selectedId: readTrimmedSearchParam(url, 'selectedId'),
          query: readTrimmedSearchParam(url, ['q', 'query']),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/distributed-runtime' && req.method === 'GET') {
    if (!deps.distributedRuntimeControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane do runtime distribuido indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        distributedRuntime: await deps.distributedRuntimeControlPlane.buildSnapshot({
          selectedId: readTrimmedSearchParam(url, 'selectedId'),
          query: readTrimmedSearchParam(url, ['q', 'query']),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/runtime-stability' && req.method === 'GET') {
    if (!deps.runtimeStabilityControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de estabilidade do runtime indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        runtimeStability: deps.runtimeStabilityControlPlane.buildSnapshot(),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/rollout-readiness' && req.method === 'GET') {
    if (!deps.rolloutReadinessControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de rollout readiness indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        rolloutReadiness: await deps.rolloutReadinessControlPlane.buildSnapshot({
          profile: readTrimmedSearchParam(url, 'profile'),
          scope: readTrimmedSearchParam(url, 'scope'),
          refresh: readBooleanSearchParam(url, 'refresh'),
          includeSources: readBooleanSearchParam(url, 'includeSources') || readBooleanSearchParam(url, 'full'),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/natural-setup' && req.method === 'GET') {
    if (!deps.naturalSetupControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de natural setup indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        naturalSetup: await deps.naturalSetupControlPlane.buildSnapshot({
          channelId: readTrimmedSearchParam(url, 'channelId'),
          mode: readTrimmedSearchParam(url, 'mode'),
          intentText: readTrimmedSearchParam(url, ['text', 'intent']),
          autoApply: readBooleanSearchParam(url, 'apply'),
          autoDoctor: readBooleanSearchParam(url, 'doctor'),
          autoTest: readBooleanSearchParam(url, 'test'),
          localOnly: readBooleanSearchParam(url, 'localOnly'),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/operations/natural-setup/actions' && req.method === 'POST') {
    if (!deps.naturalSetupControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de natural setup indisponivel.' }, 503);
      return true;
    }

    try {
      const body = await deps.readJsonBody(req);
      const planner = buildNaturalSetupMutationPlanner(deps);
      const actionId = String(body?.actionId || body?.action || 'preview').trim().toLowerCase();
      const planId = String(body?.planId || body?.mutationPlanId || '').trim();
      const requestedBy = deps.runtime?.webUserId || 'web-user';
      if ((actionId === 'apply' || actionId === 'apply-plan') && planId) {
        const applied = await planner.apply({ planId, requestedBy });
        deps.writeJson(
          res,
          {
            ok: applied.ok,
            status: applied.status,
            naturalSetup: applied.snapshot,
            mutationPlan: applied.mutationPlan,
            results: applied.results,
            summary: applied.summary,
          },
          applied.status === 'waiting_approval' ? 202 : applied.ok ? 200 : 409,
        );
        return true;
      }

      const preview = await planner.preview({
        channelId: String(body?.channelId || body?.selectedId || '').trim() || null,
        mode: String(body?.mode || '').trim() || null,
        intentText: String(body?.intentText || body?.intent || '').trim() || null,
        apply: body?.apply === true || actionId === 'apply-scaffold' || actionId === 'scaffold',
        doctor: body?.doctor === true || actionId === 'doctor',
        test: body?.test === true || actionId === 'test' || actionId === 'send-test',
        localOnly: body?.localOnly === true,
        requestedBy,
        sourceSurface: 'web',
      });
      deps.writeJson(
        res,
        {
          ok: false,
          status: 'waiting_approval',
          naturalSetup: preview.snapshot,
          mutationPlan: preview.mutationPlan,
          trustDecision: preview.trustDecision,
        },
        202,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Falha no action seguro de Natural Setup.';
      deps.writeJson(res, { ok: false, error: errorMessage }, 400);
    }
    return true;
  }

  if (pathname === '/api/web/operations/automations' && req.method === 'GET') {
    if (!deps.automationControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de automacoes indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        automations: await deps.automationControlPlane.buildSnapshot({
          query: readTrimmedSearchParam(url, ['q', 'query']),
          limit: readNumberSearchParam(url, 'limit', 8) || 8,
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/automations/actions' && req.method === 'POST') {
    if (!deps.automationControlPlane || !deps.automationActions) {
      deps.writeJson(res, { ok: false, error: 'Acoes de automacao indisponiveis.' }, 503);
      return true;
    }

    const body = await deps.readJsonBody(req);
    const actionId = String(body?.actionId || '').trim();
    if (!actionId) {
      deps.writeJson(res, { ok: false, error: 'actionId obrigatorio.' }, 400);
      return true;
    }

    const requestedBy = deps.runtime?.webUserId || 'web-user';
    const planId = String(body?.planId || body?.mutationPlanId || '').trim();
    const action = actionId === 'apply' && planId && deps.automationActions.apply
      ? await deps.automationActions.apply({ planId, requestedBy })
      : await deps.automationActions.execute({
        actionId,
        intentText: String(body?.intentText || body?.intent || '').trim() || null,
        taskId: String(body?.taskId || '').trim() || null,
        requestedBy,
        sourceSurface: 'app',
      });
    deps.writeJson(
      res,
      {
        ok: action.ok,
        action,
        automations: action.snapshot,
      },
      action.status === 'waiting_approval' ? 202 : action.ok ? 200 : 409,
    );
    return true;
  }

  if (pathname === '/api/web/operations/watch-mode' && req.method === 'GET') {
    if (!deps.watchModeControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Control plane de Watch Mode indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        watchMode: deps.watchModeControlPlane.buildSnapshot({
          limit: readNumberSearchParam(url, 'limit', 8) || 8,
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/hub' && req.method === 'GET') {
    if (!deps.hubControlPlane) {
      deps.writeJson(res, { ok: false, error: 'Hub control plane indisponivel.' }, 503);
      return true;
    }

    deps.writeJson(
      res,
      {
        ok: true,
        hub: deps.hubControlPlane.buildSnapshot({
          selectedId: readTrimmedSearchParam(url, 'selectedId'),
          query: readTrimmedSearchParam(url, ['q', 'query']),
          recommendFor: readTrimmedSearchParam(url, ['recommend', 'recommendFor']),
        }),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/hub/actions' && req.method === 'POST') {
    if (!deps.hubControlPlane || !deps.hubActions) {
      deps.writeJson(res, { ok: false, error: 'Acoes do Hub + MCP indisponiveis.' }, 503);
      return true;
    }

    try {
      const body = await deps.readJsonBody(req);
      const actionId = String(body?.actionId || '').trim();
      if (!actionId) {
        deps.writeJson(res, { ok: false, error: 'actionId obrigatorio.' }, 400);
        return true;
      }

      const action = await deps.hubActions.execute({
        actionId,
        requestedBy: deps.runtime?.webUserId || 'web-user',
        workspace: deps.workspaceRoot,
        selectedId: String(body?.selectedId || '').trim() || null,
        query: String(body?.query || '').trim() || null,
        recommendFor: String(body?.recommendFor || '').trim() || null,
      });
      deps.writeJson(
        res,
        {
          ok: action.ok,
          action,
          hub: action.hub || deps.hubControlPlane?.buildSnapshot(),
        },
        action.ok ? 200 : 409,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Falha ao agir no Hub + MCP.';
      deps.writeJson(res, { ok: false, error: errorMessage }, 400);
    }
    return true;
  }

  return false;
}
