import { isComputerUseAllowed } from './helpers.js';
import type { WebAppSupervisionRouteContext, WebAppSupervisionRouteHandler } from './types.js';
import { asErrorLike } from '../../../../../utils/errorLike.js';

export const handleComputerUseRoutes: WebAppSupervisionRouteHandler = async (ctx) => {
  const { req, res, pathname, deps } = ctx;

  if (pathname === '/api/web/experimental/computer-use' && req.method === 'GET') {
    const watchMode = deps.watchMode;
    if (watchMode) {
      deps.writeJson(
        res,
        {
          ok: true,
          experimental: true,
          snapshot: watchMode.getActiveRun(),
          watchMode: watchMode.buildSnapshot(6),
        },
        200,
      );
      return true;
    }
    const agent = deps.computerUseAgent;
    if (!agent) {
      deps.writeJson(res, { ok: false, error: 'Computer Use Agent unavailable.' }, 503);
      return true;
    }
    deps.writeJson(res, { ok: true, experimental: true, snapshot: agent.getSnapshot() }, 200);
    return true;
  }

  if (pathname === '/api/web/experimental/computer-use' && req.method === 'POST') {
    const watchMode = deps.watchMode;
    if (watchMode) {
      const body = await deps.readJsonBody(req);
      const targetWindow = String(body.targetWindow || '').trim();
      const objective = String(body.objective || '').trim();
      if (!targetWindow || !objective) {
        deps.writeJson(res, { ok: false, error: 'targetWindow e objective requireds.' }, 400);
        return true;
      }
      try {
        if (typeof watchMode.previewMutation === 'function' && !body.planId && body.apply !== true) {
          const preview = await watchMode.previewMutation({
            actionId: 'start',
            targetWindow,
            objective,
            siteUrl: String(body.siteUrl || '').trim() || null,
            strictApproval: typeof body.strictApproval === 'boolean' ? body.strictApproval : null,
            requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || null,
            sourceSurface: 'web-experimental',
          });
          deps.writeJson(
            res,
            {
              ok: false,
              experimental: true,
              status: preview.status,
              mutationPlan: preview.mutationPlan,
              trustDecision: preview.trustDecision,
              watchMode: preview.snapshot,
            },
            202,
          );
          return true;
        }
        if (body.planId && typeof watchMode.applyMutationPlan === 'function') {
          const applied = await watchMode.applyMutationPlan({
            planId: String(body.planId || '').trim(),
            requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || null,
          });
          deps.writeJson(res, { ...applied, experimental: true }, 200);
          return true;
        }
        const run = await watchMode.startRun({
          targetWindow,
          objective,
          siteUrl: String(body.siteUrl || '').trim() || null,
          requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || null,
          strictApproval: typeof body.strictApproval === 'boolean' ? body.strictApproval : null,
          maxIterations: Number(body.maxIterations || 0) || null,
          delayBetweenActionsMs: Number(body.delayBetweenActionsMs || 0) || null,
        });
        deps.writeJson(
          res,
          {
            ok: true,
            experimental: true,
            message: 'Supervised Watch Mode iniciado.',
            snapshot: run,
            watchMode: watchMode.buildSnapshot(6),
          },
          200,
        );
      } catch (error: unknown) {
        const err = asErrorLike(error);
        const message = error instanceof Error ? err.message : 'Failed to start experimental Computer Use.';
        const statusCode = err.name === 'SecurityError' ? 403 : 409;
        deps.writeJson(res, { ok: false, error: message }, statusCode);
      }
      return true;
    }

    const agent = deps.computerUseAgent;
    if (!agent) {
      deps.writeJson(res, { ok: false, error: 'Computer Use Agent unavailable.' }, 503);
      return true;
    }
    if (!isComputerUseAllowed()) {
      deps.writeJson(
        res,
        {
          ok: false,
          error:
            'Visual Computer Use blocked by security. Set ZAVORTH_COMPUTER_USE_ENABLED=true '
            + 'ou ZAVORTH_COMPUTER_USE_PROFILE=trusted|dangerous.',
        },
        403,
      );
      return true;
    }
    const body = await deps.readJsonBody(req);
    const targetWindow = String(body.targetWindow || '').trim();
    const objective = String(body.objective || '').trim();
    if (!targetWindow || !objective) {
      deps.writeJson(res, { ok: false, error: 'targetWindow e objective requireds.' }, 400);
      return true;
    }
    agent.run({ targetWindow, objective, maxIterations: body.maxIterations || 25 }).catch(() => undefined);
    deps.writeJson(
      res,
      { ok: true, experimental: true, message: 'Computer Use Agent iniciado.', snapshot: agent.getSnapshot() },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/experimental/computer-use/stop' && req.method === 'POST') {
    const watchMode = deps.watchMode;
    if (watchMode) {
      const activeRun = watchMode.getActiveRun();
      if (!activeRun) {
        deps.writeJson(res, { ok: false, error: 'There is no active Watch Mode to stop.' }, 404);
        return true;
      }
      const stopped = watchMode.stopRun(
        activeRun.runId,
        String(deps.runtime.webUserId || '').trim() || null,
      );
      deps.writeJson(res, { ok: true, experimental: true, message: 'Stop requested.', snapshot: stopped }, 200);
      return true;
    }

    const agent = deps.computerUseAgent;
    if (!agent) {
      deps.writeJson(res, { ok: false, error: 'Computer Use Agent unavailable.' }, 503);
      return true;
    }
    agent.stop();
    deps.writeJson(res, { ok: true, message: 'Stop requested.' }, 200);
    return true;
  }

  return false;
};
