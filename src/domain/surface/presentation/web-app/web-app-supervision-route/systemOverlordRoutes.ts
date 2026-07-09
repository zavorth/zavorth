import {
  asLooseRecord,
  buildWebOperatorApprovalSafety,
  isSystemOverlordCapability,
  normalizeSystemOverlordExecutionProfile,
  normalizeSystemOverlordAutonomyLevel,
} from './helpers.js';
import type { WebAppSupervisionRouteContext, WebAppSupervisionRouteHandler } from './types.js';

export const handleSystemOverlordRoutes: WebAppSupervisionRouteHandler = async (ctx) => {
  const { req, res, url, pathname, deps } = ctx;

  if (pathname === '/api/web/system-overlord' && req.method === 'GET') {
    const service = deps.systemOverlordControl;
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'System Overlord control plane indisponivel.' }, 503);
      return true;
    }
    const limit = Number(url.searchParams.get('limit') || 25) || 25;
    deps.writeJson(res, { ok: true, snapshot: service.buildSnapshot(limit) }, 200);
    return true;
  }

  if (pathname === '/api/web/system-overlord/approvals' && req.method === 'GET') {
    const service = deps.systemOverlordControl;
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'System Overlord control plane indisponivel.' }, 503);
      return true;
    }
    const limit = Number(url.searchParams.get('limit') || 25) || 25;
    deps.writeJson(
      res,
      { ok: true, approvals: service.listApprovals(limit), snapshot: service.buildSnapshot(limit) },
      200,
    );
    return true;
  }

  if (pathname.startsWith('/api/web/system-overlord/approvals/') && req.method === 'POST') {
    const service = deps.systemOverlordControl;
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'System Overlord control plane indisponivel.' }, 503);
      return true;
    }
    const actionId = decodeURIComponent(pathname.replace('/api/web/system-overlord/approvals/', '')).trim();
    const body = await deps.readJsonBody(req);
    const decision = String(body.decision || '').trim();
    if (!actionId || (decision !== 'approve' && decision !== 'reject')) {
      deps.writeJson(res, { ok: false, error: 'actionId e decision approve/reject sao obrigatorios.' }, 400);
      return true;
    }
    try {
      const result = await service.decideApproval({
        actionId,
        decision,
        requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || null,
        reason: String(body.reason || '').trim() || null,
        dryRun: typeof body.dryRun === 'boolean' ? body.dryRun : null,
      });
      deps.writeJson(res, { ok: true, ...result }, 200);
    } catch (error: any) { const err = error; const e = error;
      deps.writeJson(res, { ok: false, error: error instanceof Error ? error.message : 'Falha ao decidir approval do Overlord.' }, 409);
    }
    return true;
  }

  if (pathname === '/api/web/system-overlord/actions' && req.method === 'POST') {
    const service = deps.systemOverlordControl;
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'System Overlord control plane indisponivel.' }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const capability = String(body.capability || '').trim();
    if (!isSystemOverlordCapability(capability)) {
      deps.writeJson(res, { ok: false, error: 'capability invalida ou ausente.' }, 400);
      return true;
    }
    const approvalSafety = buildWebOperatorApprovalSafety(ctx, body);
    const result = await service.executeAction({
      actionId: String(body.actionId || '').trim() || null,
      runId: String(body.runId || '').trim() || null,
      requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || null,
      surface: String(body.surface || 'web-overlord').trim(),
      profile: normalizeSystemOverlordExecutionProfile(body.profile),
      autonomyLevel: normalizeSystemOverlordAutonomyLevel(body.autonomyLevel),
      capability,
      command: String(body.command || '').trim() || null,
      workspace: String(body.workspace || '').trim() || null,
      objective: String(body.objective || '').trim() || null,
      approved: approvalSafety.operatorApprovalAccepted,
      dryRun: body.dryRun === true || approvalSafety.bodyApprovalIgnored,
      timeoutMs: Number(body.timeoutMs || 0) || null,
      metadata: asLooseRecord(body.metadata),
    });
    deps.writeJson(res, { ok: true, ...result, safety: approvalSafety }, 200);
    return true;
  }

  if (pathname === '/api/web/system-overlord/kill-switch' && req.method === 'POST') {
    const service = deps.systemOverlordControl;
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'System Overlord control plane indisponivel.' }, 503);
      return true;
    }
    const body = await deps.readJsonBody(req);
    const result = await service.setKillSwitch({
      active: body.active === true,
      cancelActive: body.cancelActive === true,
      requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || 'web-operator',
      reason: String(body.reason || '').trim() || null,
    });
    deps.writeJson(res, { ok: true, ...result }, 200);
    return true;
  }

  if (pathname.startsWith('/api/web/system-overlord/actions/') && req.method === 'POST') {
    const service = deps.systemOverlordControl;
    if (!service) {
      deps.writeJson(res, { ok: false, error: 'System Overlord control plane indisponivel.' }, 503);
      return true;
    }
    const match = pathname.match(/^\/api\/web\/system-overlord\/actions\/([^/]+)\/(cancel|rollback)$/);
    if (!match) {
      return false;
    }
    const actionId = decodeURIComponent(match[1] || '').trim();
    if (!actionId) {
      deps.writeJson(res, { ok: false, error: 'actionId obrigatorio.' }, 400);
      return true;
    }
    const body = await deps.readJsonBody(req);
    try {
      const result = match[2] === 'cancel'
        ? await service.cancelAction({
          actionId,
          requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || 'web-operator',
          reason: String(body.reason || '').trim() || null,
        })
        : await service.rollbackAction({
          actionId,
          requestedBy: String(body.requestedBy || deps.runtime.webUserId || '').trim() || 'web-operator',
          reason: String(body.reason || '').trim() || null,
        });
      deps.writeJson(res, { ok: true, ...result }, 200);
    } catch (error: any) { const err = error; const e = error;
      deps.writeJson(res, { ok: false, error: error instanceof Error ? error.message : 'Acao supervisionada indisponivel.' }, 400);
    }
    return true;
  }

  return false;
};
