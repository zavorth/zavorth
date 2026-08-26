import * as http from 'http';
import type { SurfaceControllerContext } from '../../../../orchestrator/SurfaceRuntime.js';
import { asErrorLike } from '../../../../utils/errorLike.js';
import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';

type LooseRecord = Record<string, unknown>;

export class WebAppRuntimeDecisionRouteService {
  public async handlePermissionDecision(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
    decision: 'approve' | 'reject',
  ): Promise<boolean> {
    try {
      const body = await deps.readJsonBody(req);
      const permission = await deps.runtime.permissionController.resolvePermissionReference(
        String(body.permissionId || '').trim(),
      );
      const sessionId = await deps.resolveSessionIdFromPermission(permission, String(body.sessionId || '').trim());
      const permissionId = deps.runtime.permissionController.shortPermissionId(permission);
      const webCtx = toSurfaceControllerContext(deps.createWebContext(sessionId));

      if (decision === 'approve') {
        const scope = String(body.scope || 'once').trim().toLowerCase();
        await deps.runtime.permissionController.handlePermissionCallback(
          webCtx,
          `perm:approve:${permissionId}:${scope}`,
        );
      } else {
        await deps.runtime.permissionController.handlePermissionCallback(
          webCtx,
          `perm:reject:${permissionId}`,
        );
      }

      await deps.realtime.captureBaseline(sessionId);
      const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
      deps.writeJson(res, { ok: true, snapshot }, 200);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(
        res,
        { ok: false, error: (error instanceof Error ? err.message : String(error)) || (decision === 'approve' ? 'Failed to approve permission.' : 'Failed to reject permission.') },
        409,
      );
    }
    return true;
  }

  public async handleTaskDecision(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
    decision: 'approve' | 'reject',
  ): Promise<boolean> {
    try {
      const body = await deps.readJsonBody(req);
      const taskId = String(body.taskId || '').trim();
      if (!taskId) {
        deps.writeJson(res, { ok: false, error: 'taskId required.' }, 400);
        return true;
      }
      const task = deps.runtime.taskManager.getTask(taskId);
      if (!task) {
        deps.writeJson(res, { ok: false, error: 'Task not found.' }, 404);
        return true;
      }
      const sessionId = deps.resolveSessionIdFromTask(task, String(body.sessionId || '').trim());
      const webCtx = toSurfaceControllerContext(deps.createWebContext(sessionId));

      if (decision === 'approve') {
        const approvalCode = String(body.approvalCode || body.pin || '').trim();
        const taskIdForDecision = String(task.task_id || task.id || taskId).trim();
        const approvalArgs = approvalCode ? `${taskIdForDecision} pin=${approvalCode}`
          : taskIdForDecision;
        await deps.runtime.permissionController.handleApproval(
          webCtx,
          approvalArgs,
        );
      } else {
        const taskIdForDecision = String(task.task_id || task.id || taskId).trim();
        await deps.runtime.permissionController.handleRejection(
          webCtx,
          taskIdForDecision,
        );
      }

      await deps.realtime.captureBaseline(sessionId);
      const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
      deps.writeJson(res, { ok: true, snapshot }, 200);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(
        res,
        { ok: false, error: (error instanceof Error ? err.message : String(error)) || (decision === 'approve' ? 'Failed to approve task gate.' : 'Failed to reject task gate.') },
        409,
      );
    }
    return true;
  }

  public async handleAgentRunDecision(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
    decision: 'approve' | 'reject',
  ): Promise<boolean> {
    try {
      if (!deps.agentGateway) {
        deps.writeJson(
          res,
          { ok: false, error: 'Zavorth Agent Gateway unavailable for universal approvals.' },
          503,
        );
        return true;
      }

      const body = await deps.readJsonBody(req);
      const approvalRef = String(
        body.approvalId
        || body.runId
        || body.id
        || '',
      ).trim();
      if (!approvalRef) {
        deps.writeJson(res, { ok: false, error: 'approvalId ou runId required.' }, 400);
        return true;
      }

      // Free-text "other" answers are fail-closed like every other surface:
      // prose never approves, it denies with the answer relayed to the agent.
      const operatorAnswer = String(body.answer || '').trim();
      let result = null;
      if (operatorAnswer && decision === 'reject') {
        result = await deps.agentGateway.reject(approvalRef, { reason: operatorAnswer });
      }
      const intentResult = !result && !operatorAnswer && deps.agentGateway.resolveApprovalIntent
        ? await deps.agentGateway.resolveApprovalIntent({
          decision: decision === 'approve' ? 'approved' : 'rejected',
          ref: approvalRef,
          text: String(body.text || body.message || '').trim(),
          source: String(body.source || '').trim() === 'button' ? 'button' : 'zavorthControl',
          channel: 'zavorthControl',
          userId: String(body.userId || '').trim() || null,
          sessionId: String(body.sessionId || '').trim() || null,
        })
        : null;
      result = intentResult
        ? intentResult.result
        : result || (decision === 'approve'
          ? await deps.agentGateway.approve(approvalRef)
          : await deps.agentGateway.reject(approvalRef));
      if (!result) {
        deps.writeJson(
          res,
          { ok: false, error: intentResult?.error || 'Universal approval not found or already resolved.' },
          404,
        );
        return true;
      }

      const snapshot = deps.agentGateway.buildSnapshot({
        activeRunId: result.run?.id || String(body.runId || '').trim() || null,
        activeSessionId: result.run?.sessionId || String(body.sessionId || '').trim() || null,
      });
      deps.writeJson(
        res,
        {
          ok: true,
          requestedDecision: decision,
          approvalIntent: intentResult?.resolution || null,
          decision: result.decision,
          approval: result.approval,
          run: result.run,
          replies: result.replies,
          resumed: result.resumed,
          queued: Boolean(result.queued),
          workflowJob: result.workflowJob || null,
          error: result.error || null,
          generatedAt: snapshot.generatedAt,
          snapshot,
        },
        200,
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(
        res,
        { ok: false, error: (error instanceof Error ? err.message : String(error)) || (decision === 'approve' ? 'Failed to approve run universal.' : 'Failed to reject run universal.') },
        409,
      );
    }
    return true;
  }

  public async handleAgentRunDraftApply(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    try {
      if (!deps.agentGateway?.handle) {
        deps.writeJson(
          res,
          { ok: false, error: 'Zavorth Agent Gateway unavailable para aplicar rascunho do Intelligence Fabric.' },
          503,
        );
        return true;
      }

      const body = await deps.readJsonBody(req);
      const planId = String(body.planId || '').trim();
      if (!planId) {
        deps.writeJson(res, { ok: false, error: 'planId required.' }, 400);
        return true;
      }
      if (body.confirmOwnerControlledApply !== true) {
        deps.writeJson(res, { ok: false, error: 'confirmOwnerControlledApply=true required para aplicar rascunho.' }, 400);
        return true;
      }

      const requestedRunId = String(body.runId || '').trim();
      const requestedSessionId = String(body.sessionId || '').trim();
      const seedSnapshot = deps.agentGateway.buildSnapshot({
        activeRunId: requestedRunId || null,
        activeSessionId: requestedSessionId || null,
      });
      const sourceRun = requestedRunId
        ? seedSnapshot.runs.find((run: LooseRecord) => String(run?.id || '') === requestedRunId) || seedSnapshot.activeRun
        : seedSnapshot.activeRun;
      const sessionId = requestedSessionId || String(sourceRun?.sessionId || '').trim() || deps.runtime.webUserId;
      const userId = String(sourceRun?.userId || deps.runtime.webUserId || 'web-owner').trim();
      const result = await deps.agentGateway.handle({
        requestId: `zavorthControl-apply-draft-${planId}`,
        traceId: String(sourceRun?.traceId || '').trim() || null,
        userId,
        sessionId,
        channel: 'web',
        text: `aplicar rascunho ${planId}`,
        workspace: String(body.workspace || sourceRun?.workspace || '').trim() || null,
        replyPort: {
          id: 'zavorthControl',
          label: 'ZavorthControl',
          kind: 'web',
          status: 'available',
          primary: true,
        },
        requestedTools: [],
        modelProfile: sourceRun?.modelProfile || undefined,
        metadata: {
          intelligenceFabricApplyDraftPlanId: planId,
          intelligenceFabricApplyDraftGuidance: true,
          intelligenceFabricApproveDraftPlan: true,
          intelligenceFabricApprovalId: String(body.approvalId || `zavorthControl:${planId}`).trim(),
          approvedBy: userId,
          zavorthControlApplyDraft: {
            source: 'ZavorthControl',
            runId: requestedRunId || null,
            sessionId,
            confirmOwnerControlledApply: true,
          },
        },
      });
      const snapshot = deps.agentGateway.buildSnapshot({
        activeRunId: result.run.id,
        activeSessionId: result.run.sessionId,
      });
      deps.writeJson(
        res,
        {
          ok: result.ok,
          planId,
          run: result.run,
          replies: result.replies,
          generatedAt: snapshot.generatedAt,
          snapshot,
        },
        result.ok ? 200 : 409,
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(
        res,
        { ok: false, error: (error instanceof Error ? err.message : String(error)) || 'Failed to aplicar rascunho do Intelligence Fabric.' },
        409,
      );
    }
    return true;
  }

  public async handleAgentRunFabricDemote(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<boolean> {
    try {
      if (!deps.agentGateway?.handle) {
        deps.writeJson(
          res,
          { ok: false, error: 'Zavorth Agent Gateway unavailable to disable the Intelligence Fabric.' },
          503,
        );
        return true;
      }

      const body = await deps.readJsonBody(req);
      if (body.confirmOwnerControlledDemote !== true) {
        deps.writeJson(res, { ok: false, error: 'confirmOwnerControlledDemote=true required for the controlled demote.' }, 400);
        return true;
      }

      const requestedRunId = String(body.runId || '').trim();
      const requestedSessionId = String(body.sessionId || '').trim();
      const seedSnapshot = deps.agentGateway.buildSnapshot({
        activeRunId: requestedRunId || null,
        activeSessionId: requestedSessionId || null,
      });
      const sourceRun = requestedRunId
        ? seedSnapshot.runs.find((run: LooseRecord) => String(run?.id || '') === requestedRunId) || seedSnapshot.activeRun
        : seedSnapshot.activeRun;
      const sessionId = requestedSessionId || String(sourceRun?.sessionId || '').trim() || deps.runtime.webUserId;
      const userId = String(sourceRun?.userId || deps.runtime.webUserId || 'web-owner').trim();
      const recommendation = String(body.recommendation || body.reason || 'auto_demote_controlled').trim();
      const result = await deps.agentGateway.handle({
        requestId: 'zavorthControl-demote-fabric',
        traceId: String(sourceRun?.traceId || '').trim() || null,
        userId,
        sessionId,
        channel: 'web',
        text: 'disable Intelligence Fabric due to degraded health',
        workspace: String(body.workspace || sourceRun?.workspace || '').trim() || null,
        replyPort: {
          id: 'zavorthControl',
          label: 'ZavorthControl',
          kind: 'web',
          status: 'available',
          primary: true,
        },
        requestedTools: [],
        modelProfile: sourceRun?.modelProfile || undefined,
        metadata: {
          intelligenceFabricMode: 'disabled',
          intelligenceFabricDemoteControlled: true,
          approvedBy: userId,
          zavorthControlDemoteFabric: {
            source: 'ZavorthControl',
            runId: requestedRunId || null,
            sessionId,
            status: String(body.status || '').trim() || null,
            recommendation,
            rollbackInstruction: String(body.rollbackInstruction || 'Re-enable Fabric by removing intelligenceFabricMode=disabled when health is ready.').trim(),
            confirmOwnerControlledDemote: true,
          },
        },
      });
      const snapshot = deps.agentGateway.buildSnapshot({
        activeRunId: result.run.id,
        activeSessionId: result.run.sessionId,
      });
      deps.writeJson(
        res,
        {
          ok: result.ok,
          demote: {
            mode: 'disabled',
            appliedTo: 'request',
            globalRuntimeChanged: false,
            rollbackInstruction: String(body.rollbackInstruction || 'Re-enable Fabric by removing intelligenceFabricMode=disabled when health is ready.').trim(),
          },
          run: result.run,
          replies: result.replies,
          generatedAt: snapshot.generatedAt,
          snapshot,
        },
        result.ok ? 200 : 409,
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(
        res,
        { ok: false, error: (error instanceof Error ? err.message : String(error)) || 'Failed to aplicar demote controlado do Intelligence Fabric.' },
        409,
      );
    }
    return true;
  }
}

function toSurfaceControllerContext(value: unknown): SurfaceControllerContext {
  return value as SurfaceControllerContext;
}
