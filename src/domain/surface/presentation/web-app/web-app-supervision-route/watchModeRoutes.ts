import * as fs from 'fs';
import type { WebAppSupervisionRouteContext, WebAppSupervisionRouteHandler } from './types.js';
import { getRequestedBy } from './helpers.js';
import { asErrorLike } from '../../../../../utils/errorLike.js';

export const handleWatchModeRoutes: WebAppSupervisionRouteHandler = async (ctx) => {
  const { req, res, url, pathname, deps } = ctx;
  const service = deps.watchMode;

  if (pathname === '/api/web/watch-mode' && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Watch Mode supervisionado indisponivel.' }, 503);
      return true;
    }
    const limit = Number(url.searchParams.get('limit') || 6) || 6;
    deps.writeJson(res, { ok: true, snapshot: service.buildSnapshot(limit) }, 200);
    return true;
  }

  if (pathname === '/api/web/watch-mode/policy' && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Watch Mode supervisionado indisponivel.' }, 503);
      return true;
    }
    const snapshot = service.buildSnapshot(8);
    deps.writeJson(res, { ok: true, policy: snapshot.policy, snapshot }, 200);
    return true;
  }

  if (pathname === '/api/web/watch-mode/policy' && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Watch Mode supervisionado indisponivel.' }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const actionId = String(body.actionId || '').trim().toLowerCase();
    try {
      let snapshot: ReturnType<typeof service.buildSnapshot>;
      if (actionId === 'set-strict-default') {
        const strictApproval = typeof body.strictApproval === 'boolean'
          ? body.strictApproval
          : String(body.value || '').trim().toLowerCase() === 'true';
        if (strictApproval === false && typeof service.previewMutation === 'function') {
          const preview = await service.previewMutation({
            actionId: 'set-strict-default',
            strictApproval,
            requestedBy: getRequestedBy(ctx),
            sourceSurface: 'web',
          });
          deps.writeJson(res, { ok: false, status: preview.status, mutationPlan: preview.mutationPlan, trustDecision: preview.trustDecision, snapshot: preview.snapshot }, 202);
          return true;
        }
        snapshot = service.setStrictApprovalDefault(strictApproval);
      } else if (actionId === 'allow-app') {
        const app = String(body.app || body.value || '').trim();
        if (!app) {
          deps.writeJson(res, { ok: false, error: 'app obrigatorio para allow-app.' }, 400);
          return true;
        }
        if (typeof service.previewMutation === 'function') {
          const preview = await service.previewMutation({
            actionId: 'allow-app',
            app,
            requestedBy: getRequestedBy(ctx),
            sourceSurface: 'web',
          });
          deps.writeJson(res, { ok: false, status: preview.status, mutationPlan: preview.mutationPlan, trustDecision: preview.trustDecision, snapshot: preview.snapshot }, 202);
          return true;
        }
        snapshot = service.allowApp(app);
      } else if (actionId === 'allow-site') {
        const site = String(body.site || body.value || '').trim();
        if (!site) {
          deps.writeJson(res, { ok: false, error: 'site obrigatorio para allow-site.' }, 400);
          return true;
        }
        if (typeof service.previewMutation === 'function') {
          const preview = await service.previewMutation({
            actionId: 'allow-site',
            site,
            requestedBy: getRequestedBy(ctx),
            sourceSurface: 'web',
          });
          deps.writeJson(res, { ok: false, status: preview.status, mutationPlan: preview.mutationPlan, trustDecision: preview.trustDecision, snapshot: preview.snapshot }, 202);
          return true;
        }
        snapshot = service.allowSite(site);
      } else if (actionId === 'apply') {
        const planId = String(body.planId || body.mutationPlanId || '').trim();
        if (!planId || typeof service.applyMutationPlan !== 'function') {
          deps.writeJson(res, { ok: false, error: 'planId obrigatorio para apply.' }, 400);
          return true;
        }
        const applied = await service.applyMutationPlan({
          planId,
          requestedBy: getRequestedBy(ctx),
        });
        deps.writeJson(res, applied, 200);
        return true;
      } else {
        deps.writeJson(res, { ok: false, error: 'actionId invalido para policy do Watch Mode.' }, 400);
        return true;
      }
      deps.writeJson(res, { ok: true, policy: snapshot.policy, snapshot }, 200);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: error instanceof Error ? err.message : 'Falha ao ajustar a policy do Watch Mode.' }, 400);
    }
    return true;
  }

  if (pathname === '/api/web/watch-mode/runs' && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Watch Mode supervisionado indisponivel.' }, 503);
      return true;
    }
    const limit = Number(url.searchParams.get('limit') || 10) || 10;
    deps.writeJson(
      res,
      {
        ok: true,
        runs: service.listRuns(limit),
        activeRun: service.getActiveRun(),
        snapshot: service.buildSnapshot(Math.max(limit, 6)),
      },
      200,
    );
    return true;
  }

  if (pathname === '/api/web/watch-mode/runs' && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Watch Mode supervisionado indisponivel.' }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const targetWindow = String(body.targetWindow || '').trim();
    const objective = String(body.objective || '').trim();
    if (!targetWindow || !objective) {
      deps.writeJson(res, { ok: false, error: 'targetWindow e objective obrigatorios.' }, 400);
      return true;
    }
    try {
      if (typeof service.previewMutation === 'function' && !body.planId && body.apply !== true) {
        const preview = await service.previewMutation({
          actionId: 'start',
          targetWindow,
          objective,
          siteUrl: String(body.siteUrl || '').trim() || null,
          strictApproval: typeof body.strictApproval === 'boolean' ? body.strictApproval : null,
          maxIterations: Number(body.maxIterations || 0) || null,
          maxDurationMs: Number(body.maxDurationMs || 0) || null,
          maxScreenshots: Number(body.maxScreenshots || 0) || null,
          maxMemoryMb: Number(body.maxMemoryMb || 0) || null,
          idleTtlMs: Number(body.idleTtlMs || 0) || null,
          screenshotTtlMs: Number(body.screenshotTtlMs || 0) || null,
          maxScreenshotBytes: Number(body.maxScreenshotBytes || 0) || null,
          screenshotRedactionMode: String(body.screenshotRedactionMode || body.redactionMode || '').trim() || null,
          sensitiveScreenPolicy: String(body.sensitiveScreenPolicy || '').trim() || null,
          requestedBy: getRequestedBy(ctx),
          sourceSurface: 'web',
        });
        deps.writeJson(res, { ok: false, status: preview.status, mutationPlan: preview.mutationPlan, trustDecision: preview.trustDecision, snapshot: preview.snapshot }, 202);
        return true;
      }
      if (body.planId && typeof service.applyMutationPlan === 'function') {
        const applied = await service.applyMutationPlan({
          planId: String(body.planId || '').trim(),
          requestedBy: getRequestedBy(ctx),
        });
        deps.writeJson(res, applied, 200);
        return true;
      }
      const run = await service.startRun({
        targetWindow,
        objective,
        siteUrl: String(body.siteUrl || '').trim() || null,
        requestedBy: getRequestedBy(ctx),
        strictApproval: typeof body.strictApproval === 'boolean' ? body.strictApproval : null,
        maxIterations: Number(body.maxIterations || 0) || null,
        maxDurationMs: Number(body.maxDurationMs || 0) || null,
        maxScreenshots: Number(body.maxScreenshots || 0) || null,
        maxMemoryMb: Number(body.maxMemoryMb || 0) || null,
        idleTtlMs: Number(body.idleTtlMs || 0) || null,
        screenshotTtlMs: Number(body.screenshotTtlMs || 0) || null,
        maxScreenshotBytes: Number(body.maxScreenshotBytes || 0) || null,
        screenshotRedactionMode: String(body.screenshotRedactionMode || body.redactionMode || '').trim() || null,
        sensitiveScreenPolicy: String(body.sensitiveScreenPolicy || '').trim() || null,
        delayBetweenActionsMs: Number(body.delayBetweenActionsMs || 0) || null,
      });
      deps.writeJson(res, { ok: true, run, snapshot: service.buildSnapshot(8) }, 200);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'Falha ao iniciar o Watch Mode.';
      const statusCode = /bloqueado por seguranca/i.test(message) ? 403 : 409;
      deps.writeJson(res, { ok: false, error: message }, statusCode);
    }
    return true;
  }

  if (pathname.startsWith('/api/web/watch-mode/runs/') && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Watch Mode supervisionado indisponivel.' }, 503);
      return true;
    }
    const screenshotMatch = pathname.match(/^\/api\/web\/watch-mode\/runs\/([^/]+)\/screenshot$/);
    if (screenshotMatch) {
      const runId = decodeURIComponent(screenshotMatch[1] || '').trim();
      if (!runId) {
        deps.writeJson(res, { ok: false, error: 'runId obrigatorio.' }, 400);
        return true;
      }
      const entryId = String(url.searchParams.get('entryId') || '').trim() || null;
      const screenshotPath = service.resolveScreenshotPath(runId, entryId);
      if (!screenshotPath) {
        deps.writeJson(res, { ok: false, error: 'Screenshot do Watch Mode nao encontrado.' }, 404);
        return true;
      }
      const content = fs.readFileSync(screenshotPath);
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': content.byteLength,
        'Cache-Control': 'no-store',
      });
      res.end(content);
      return true;
    }

    const runId = decodeURIComponent(pathname.replace('/api/web/watch-mode/runs/', '')).trim();
    if (!runId) {
      deps.writeJson(res, { ok: false, error: 'runId obrigatorio.' }, 400);
      return true;
    }
    const run = service.getRun(runId);
    if (!run) {
      deps.writeJson(res, { ok: false, error: 'Run do Watch Mode nao encontrado.' }, 404);
      return true;
    }
    deps.writeJson(res, { ok: true, run }, 200);
    return true;
  }

  if (pathname.startsWith('/api/web/watch-mode/runs/') && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Watch Mode supervisionado indisponivel.' }, 503);
      return true;
    }
    const approvalMatch = pathname.match(/^\/api\/web\/watch-mode\/runs\/([^/]+)\/approvals\/([^/]+)$/);
    if (approvalMatch) {
      const runId = decodeURIComponent(approvalMatch[1] || '').trim();
      const approvalId = decodeURIComponent(approvalMatch[2] || '').trim();
      const body = await deps.readJsonBody(req);
      const decision = String(body.decision || '').trim();
      if ((decision !== 'approve' && decision !== 'reject') || !runId || !approvalId) {
        deps.writeJson(res, { ok: false, error: 'runId, approvalId e decision approve/reject sao obrigatorios.' }, 400);
        return true;
      }
      try {
        const run = service.decideApproval({
          runId,
          approvalId,
          decision,
          requestedBy: getRequestedBy(ctx),
          note: String(body.note || '').trim() || null,
        });
        deps.writeJson(res, { ok: true, run, snapshot: service.buildSnapshot(8) }, 200);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        deps.writeJson(res, { ok: false, error: error instanceof Error ? err.message : 'Falha ao decidir approval do Watch Mode.' }, 409);
      }
      return true;
    }

    const actionMatch = pathname.match(/^\/api\/web\/watch-mode\/runs\/([^/]+)\/(pause|resume|stop)$/);
    if (!actionMatch) {
      return false;
    }
    const runId = decodeURIComponent(actionMatch[1] || '').trim();
    const action = actionMatch[2];
    const body = await deps.readJsonBody(req);
    if (!runId) {
      deps.writeJson(res, { ok: false, error: 'runId obrigatorio.' }, 400);
      return true;
    }
    try {
      const requestedBy = getRequestedBy(ctx);
      const run = action === 'pause'
        ? service.pauseRun(runId, requestedBy)
        : action === 'resume'
          ? service.resumeRun(runId, requestedBy)
          : service.stopRun(runId, requestedBy);
      deps.writeJson(res, { ok: true, run, snapshot: service.buildSnapshot(8) }, 200);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: error instanceof Error ? err.message : 'Falha ao mutar o Watch Mode.' }, 409);
    }
    return true;
  }

  return false;
};
