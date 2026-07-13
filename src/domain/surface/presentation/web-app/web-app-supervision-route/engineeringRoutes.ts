import {
  asLooseRecord,
  buildEngineeringWebContext,
  buildWebOperatorApprovalSafety,
  normalizeSystemOverlordCapability,
} from './helpers.js';
import type { WebAppSupervisionRouteContext, WebAppSupervisionRouteHandler } from './types.js';
import { asErrorLike } from '../../../../../utils/errorLike.js';

export const handleEngineeringRoutes: WebAppSupervisionRouteHandler = async (ctx) => {
  const { req, res, pathname, deps } = ctx;
  const service = deps.engineeringCore;

  if (pathname === '/api/web/engineering/runs' && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Engineering Core unavailable.' }, 503);
      return true;
    }
    const limit = Math.max(1, Math.min(25, Number(ctx.url.searchParams.get('limit') || 10) || 10));
    deps.writeJson(res, { ok: true, runs: service.listRuns(limit) }, 200);
    return true;
  }

  if (pathname === '/api/web/engineering/runs' && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Engineering Core unavailable.' }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const objective = String(body.objective || body.text || '').trim();
    if (!objective) {
      deps.writeJson(res, { ok: false, error: 'objective obrigatorio.' }, 400);
      return true;
    }
    const dispatchTask = body.dispatchTask === true || body.mode === 'task';
    const { webCtx } = buildEngineeringWebContext(ctx, body);
    const run = await service.startRun({
      rawText: objective,
      workspaceHint: String(body.workspaceRoot || body.workspace || '').trim() || null,
      dispatcher: dispatchTask ? deps.runtime.surfaceTaskDispatcher || null : null,
      dispatchContext: dispatchTask ? webCtx : null,
      autoDispatch: dispatchTask,
      startSession: body.startSession !== false,
    });
    deps.writeJson(res, { ok: true, run }, 200);
    return true;
  }

  if (pathname.startsWith('/api/web/engineering/runs/') && req.method === 'GET') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Engineering Core unavailable.' }, 503);
      return true;
    }
    const runId = decodeURIComponent(pathname.replace('/api/web/engineering/runs/', '')).trim();
    if (!runId) {
      deps.writeJson(res, { ok: false, error: 'runId obrigatorio.' }, 400);
      return true;
    }
    if (runId.endsWith('/replay')) {
      const replayRunId = runId.replace(/\/replay$/, '').trim();
      try {
        deps.writeJson(res, { ok: true, replay: service.getReplay(replayRunId) }, 200);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        deps.writeJson(res, { ok: false, error: error instanceof Error ? err.message : 'Replay unavailable.' }, 404);
      }
      return true;
    }
    const run = service.getRun(runId);
    if (!run) {
      deps.writeJson(res, { ok: false, error: 'Run de engenharia nao encontrado.' }, 404);
      return true;
    }
    deps.writeJson(res, { ok: true, run }, 200);
    return true;
  }

  if (pathname.startsWith('/api/web/engineering/runs/') && req.method === 'POST') {
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'Engineering Core unavailable.' }, 503);
      return true;
    }
    const actionMatch = pathname.match(
      /^\/api\/web\/engineering\/runs\/([^/]+)\/(input|approve|propose-patch|apply-patch|rollback|run-command|execute)$/,
    );
    if (!actionMatch) {
      return false;
    }
    const runId = decodeURIComponent(actionMatch[1] || '').trim();
    const actionId = actionMatch[2];
    try {
      if (actionId === 'approve') {
        deps.writeJson(res, { ok: true, run: service.approveRun(runId) }, 200);
        return true;
      }
      if (actionId === 'propose-patch') {
        const body = await deps.readJsonBody(req);
        const filePath = String(body.filePath || '').trim();
        const instruction = String(body.instruction || '').trim();
        if (!filePath || !instruction) {
          deps.writeJson(res, { ok: false, error: 'filePath e instruction sao obrigatorios.' }, 400);
          return true;
        }
        deps.writeJson(
          res,
          {
            ok: true,
            run: await service.proposePatch({
              runId,
              filePath,
              instruction,
              requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || null,
            }),
          },
          200,
        );
        return true;
      }
      if (actionId === 'apply-patch') {
        deps.writeJson(res, { ok: true, run: await service.applyPatch(runId) }, 200);
        return true;
      }
      if (actionId === 'rollback') {
        deps.writeJson(res, { ok: true, run: await service.rollbackRun(runId) }, 200);
        return true;
      }
      if (actionId === 'run-command') {
        const body = await deps.readJsonBody(req);
        const command = String(body.command || '').trim();
        if (!command) {
          deps.writeJson(res, { ok: false, error: 'command obrigatorio.' }, 400);
          return true;
        }
        const approvalSafety = buildWebOperatorApprovalSafety(ctx, body);
        deps.writeJson(
          res,
          {
            ok: true,
            run: await service.runCommand({
              runId,
              command,
              approved: approvalSafety.operatorApprovalAccepted,
              dryRun: body.dryRun === true || approvalSafety.bodyApprovalIgnored,
              requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || null,
              capability: normalizeSystemOverlordCapability(body.capability),
              metadata: asLooseRecord(body.metadata),
            }),
            safety: approvalSafety,
          },
          200,
        );
        return true;
      }
      if (actionId === 'execute') {
        const body = await deps.readJsonBody(req);
        const approvalSafety = buildWebOperatorApprovalSafety(ctx, body);
        deps.writeJson(
          res,
          {
            ok: true,
            run: await service.executeRun({
              runId,
              command: String(body.command || '').trim() || null,
              approved: approvalSafety.operatorApprovalAccepted,
              dryRun: body.dryRun === true || approvalSafety.bodyApprovalIgnored,
              requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || null,
              maxAttempts: Number(body.maxAttempts || 0) || null,
            }),
            safety: approvalSafety,
          },
          200,
        );
        return true;
      }

      const body = await deps.readJsonBody(req);
      const { webCtx } = buildEngineeringWebContext(ctx, body);
      deps.writeJson(
        res,
        {
          ok: true,
          run: await service.continueRun(runId, deps.runtime.surfaceTaskDispatcher || null, webCtx),
        },
        200,
      );
      return true;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : 'Failed to operar o run de engenharia.';
      deps.writeJson(res, { ok: false, error: message }, message.includes('nao encontrado') ? 404 : 409);
    }
  }

  return false;
};
