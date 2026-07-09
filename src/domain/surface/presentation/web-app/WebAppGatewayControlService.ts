import { HYBRID_MEMORY_CONTRACT_VERSION } from '../../../../contracts/HybridMemoryContract.js';
import { WebAppGatewaySelfmodSupport } from './web-app-gateway-control/WebAppGatewaySelfmodSupport.js';
import { errorMessage } from '../../../../utils/errorLike.js';
type LooseRecord = any;
import type {
  HybridMemoryRecallInput,
  HybridMemoryRecallResult,
  HybridMemorySourcesResult,
} from '../../../../contracts/HybridMemoryContract.js';

import { shouldPersistZavorthArtifacts } from '../../../../contracts/ZavorthResponseDecisionContract.js';
import type { SurfaceControllerContext } from '../../../../services/SurfaceRuntime.js';
import type { WebAppRuntimeRouteDeps } from './WebAppRuntimeRouteService.js';
import { buildWebAppRuntimeEmptyMemoryRecall } from './web-app-runtime-route/WebAppRuntimeRouteHelpers.js';
import { WebAppGatewayCapabilitySupport } from './web-app-gateway-control/WebAppGatewayCapabilitySupport.js';
import {
  normalizeGatewayApprovalScope,
  planTouchesSession,
  resolveMutationPlanIdFromPermission,
} from './web-app-gateway-control/WebAppGatewayControlHelpers.js';

import { logger } from '../../../../logger';
export class WebAppGatewayControlService {
  private readonly capabilitySupport = new WebAppGatewayCapabilitySupport();
  private readonly selfmodSupport = new WebAppGatewaySelfmodSupport();

  public async previewGatewayMemoryRecall(
    input: HybridMemoryRecallInput,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<HybridMemoryRecallResult> {
    const sessionId = String(input.sessionId || '').trim() || 'default';
    const query = String(input.query || '').trim();
    const chatId = input.chatId || deps.realtime.getChatId(sessionId);
    if (!deps.hybridMemory) {
      return buildWebAppRuntimeEmptyMemoryRecall(sessionId, query, ['Hybrid Memory Service indisponivel neste runtime.']);
    }
    try {
      return await deps.hybridMemory.previewRecall({
        userId: input.userId || deps.runtime.webUserId || null,
        platform: input.platform || 'web',
        sessionId,
        chatId,
        sourceUserId: input.sourceUserId || sessionId,
        workspaceHint: input.workspaceHint || null,
        query,
        limit: input.limit,
        contextTokenBudget: input.contextTokenBudget,
      });
    } catch (error: unknown) {logger.warn('[Web App way Control] search failed', error);
    return buildWebAppRuntimeEmptyMemoryRecall(sessionId, query, [
        `Hybrid Memory indisponivel no momento: ${errorMessage(error, 'erro desconhecido')}.`,
      ]);
  }
  }

  public async listGatewayMemorySources(
    input: Pick<HybridMemoryRecallInput, 'sessionId' | 'chatId' | 'userId' | 'platform' | 'workspaceHint'>,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<HybridMemorySourcesResult> {
    const sessionId = String(input.sessionId || '').trim() || 'default';
    const chatId = input.chatId || deps.realtime.getChatId(sessionId);
    if (!deps.hybridMemory) {
      return {
        ok: true,
        contractVersion: HYBRID_MEMORY_CONTRACT_VERSION,
        generatedAt: new Date().toISOString(),
        sessionId,
        sources: [],
        warnings: ['Hybrid Memory Service indisponivel neste runtime.'],
      };
    }
    try {
      return await deps.hybridMemory.listSources({
        userId: input.userId || deps.runtime.webUserId || null,
        platform: input.platform || 'web',
        sessionId,
        chatId,
        workspaceHint: input.workspaceHint || null,
      });
    } catch (error: unknown) {logger.warn('[Web App way Control] operation failed', error);
    return {
        ok: true,
        contractVersion: HYBRID_MEMORY_CONTRACT_VERSION,
        generatedAt: new Date().toISOString(),
        sessionId,
        sources: [],
        warnings: [`Hybrid Memory indisponivel no momento: ${errorMessage(error, 'erro desconhecido')}.`],
      };
  }
  }

  public async buildSelfmodPlane(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<LooseRecord> {
    return this.selfmodSupport.buildSelfmodPlane(sessionId, deps);
  }

  public async listGatewayApprovals(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
    limit = 20,
  ): Promise<LooseRecord> {
    const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
    const sessionPermissions = Array.isArray(snapshot.permissions) ? snapshot.permissions : [];
    const mutationPlans = deps.mutationPlane
      ? deps.mutationPlane.listPlans({ limit: limit * 2, includeExpired: false })
        .filter((plan) => planTouchesSession(plan, sessionId) || plan.approval.permissionId)
        .slice(0, limit)
      : [];
    return {
      generatedAt: new Date().toISOString(),
      sessionId,
      pending: sessionPermissions.filter((entry: LooseRecord) => entry?.status === 'pending').slice(0, limit),
      recent: sessionPermissions.slice(0, limit),
      mutationPlans: mutationPlans.map((plan) => ({
        id: plan.id,
        domain: plan.domain,
        actionId: plan.actionId,
        status: plan.status,
        title: plan.title,
        summary: plan.summary,
        updatedAt: plan.updatedAt,
        approval: plan.approval,
        payload: plan.payload,
      })),
      commands: {
        resolve: 'approval.resolve',
      },
    };
  }

  public async resolveGatewayApproval(
    input: {
      approvalId: string;
      decision: 'approve' | 'reject';
      sessionId?: string | null;
      scope?: string | null;
      approvalCode?: string | null;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<LooseRecord> {
    const approvalId = String(input.approvalId || '').trim();
    const decision = String(input.decision || '').trim().toLowerCase();
    if (!approvalId || (decision !== 'approve' && decision !== 'reject')) {
      throw new Error('approvalId e decision approve|reject sao obrigatorios.');
    }

    const requestedBy = String(input.requestedBy || deps.runtime.webUserId || 'web-operator').trim();
    const scope = normalizeGatewayApprovalScope(input.scope);
    let sessionId = String(input.sessionId || '').trim() || null;

    try {
      const permission = await deps.runtime.permissionController.resolvePermissionReference(approvalId);
      if (permission.executor === 'zavorth-mutation' && deps.permissionAuditService) {
        const updatedPermission = decision === 'approve'
          ? await deps.permissionAuditService.approveRequest(
            permission.permission_id,
            requestedBy,
            {
              scope: scope === 'host' ? 'persistent' : scope,
              decision_note: 'Approval resolvido pelo Zavorth Gateway.',
            },
          )
          : await deps.permissionAuditService.rejectRequest(
            permission.permission_id,
            requestedBy,
            'Approval rejeitado pelo Zavorth Gateway.',
          );
        const planId = resolveMutationPlanIdFromPermission(updatedPermission);
        const mutationPlan = planId && deps.mutationPlane
          ? (decision === 'approve'
            ? deps.mutationPlane.approvePlan(planId, {
              permissionId: updatedPermission.permission_id,
              approvedBy: requestedBy,
              scope,
            })
            : deps.mutationPlane.markBlocked(planId, 'Approval rejeitado pelo operador no Gateway.'))
          : null;
        sessionId =
          sessionId
          || String(mutationPlan?.payload?.sessionId || '').trim()
          || null;
        if (sessionId) {
          await deps.realtime.captureBaseline(sessionId);
        }
        return {
          ok: true,
          kind: 'mutation',
          permission: updatedPermission,
          mutationPlan,
          sessionId,
        };
      }

      sessionId = sessionId || await deps.resolveSessionIdFromPermission(permission, sessionId || '');
      const webCtx = toSurfaceControllerContext(deps.createWebContext(sessionId));
      if (decision === 'approve') {
        await deps.runtime.permissionController.handlePermissionCallback(
          webCtx,
          `perm:approve:${deps.runtime.permissionController.shortPermissionId(permission)}:${scope}`,
        );
      } else {
        await deps.runtime.permissionController.handlePermissionCallback(
          webCtx,
          `perm:reject:${deps.runtime.permissionController.shortPermissionId(permission)}`,
        );
      }
      await deps.realtime.captureBaseline(sessionId);
      return {
        ok: true,
        kind: 'permission',
        sessionId,
        permissionId: permission.permission_id,
      };
    } catch (error: unknown) {const task = deps.runtime.taskManager.getTask(approvalId);
      if (!task) {
        throw new Error('Approval nao encontrado como permissao nem task gate.');
      }
      sessionId = sessionId || deps.resolveSessionIdFromTask(task, sessionId || '');
      const webCtx = toSurfaceControllerContext(deps.createWebContext(sessionId));
      if (decision === 'approve') {
        const approvalCode = String(input.approvalCode || '').trim();
        const args = approvalCode ? `${approvalId} pin=${approvalCode}` : approvalId;
        await deps.runtime.permissionController.handleApproval(webCtx, args);
      } else {
        await deps.runtime.permissionController.handleRejection(webCtx, approvalId);
      }
      await deps.realtime.captureBaseline(sessionId);
      return {
        ok: true,
        kind: 'task',
        sessionId,
        taskId: approvalId,
      };
    }
  }

  public async listGatewayArtifacts(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
    input: { toolRunId?: string | null } = {},
  ): Promise<LooseRecord> {
    const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
    const toolRuns = Array.isArray((snapshot as LooseRecord).toolRuns) ? (snapshot as LooseRecord).toolRuns : [];
    const toolRunId = String(input.toolRunId || '').trim() || null;
    const filteredToolRuns = toolRunId
      ? toolRuns.filter((entry: LooseRecord) => String(entry?.runId || '').trim() === toolRunId)
      : toolRuns;
    const visibleToolRuns = filteredToolRuns.filter((entry: LooseRecord) => this.shouldExposeArtifactsForRecord(entry));
    const artifacts = Array.from(new Map(
      visibleToolRuns
        .flatMap((run: LooseRecord) => Array.isArray(run?.artifacts) ? run.artifacts.map((artifact: LooseRecord) => ({
          ...artifact,
          toolRunId: run.runId,
        })) : [])
        .map((artifact: LooseRecord) => [String(artifact?.id || artifact?.key || `${artifact?.toolRunId}:${artifact?.path || artifact?.name || 'artifact'}`).trim(), artifact]),
    ).values());
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      sessionId,
      toolRunId,
      toolRuns: filteredToolRuns,
      artifacts,
      filesTouched: Array.from(new Set(
        visibleToolRuns.flatMap((run: LooseRecord) => Array.isArray(run?.filesTouched) ? run.filesTouched : []),
      )),
    };
  }

  public async readGatewayArtifactDiff(
    input: {
      sessionId: string;
      toolRunId: string;
      path?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<LooseRecord> {
    const sessionId = String(input.sessionId || '').trim();
    const toolRunId = String(input.toolRunId || '').trim();
    if (!sessionId || !toolRunId) {
      throw new Error('sessionId e toolRunId sao obrigatorios para artifact.diff.');
    }
    const snapshot = await deps.realtime.getResolvedSnapshot(sessionId);
    const toolRuns = Array.isArray((snapshot as LooseRecord).toolRuns) ? (snapshot as LooseRecord).toolRuns : [];
    const toolRun = toolRuns.find((entry: LooseRecord) => String(entry?.runId || '').trim() === toolRunId) || null;
    if (!toolRun) {
      throw new Error('Tool run nao encontrado para esta sessao.');
    }
    const targetPath = String(input.path || '').trim();
    const patches = Array.isArray(toolRun?.diff?.patches)
      ? toolRun.diff.patches.filter((entry: LooseRecord) => !targetPath || String(entry?.path || '').trim() === targetPath)
      : [];
    return {
      ok: true,
      sessionId,
      toolRunId,
      path: targetPath || null,
      toolRun,
      diff: {
        summary: toolRun?.diff?.summary || null,
        patches,
        consolidatedDiff: patches.map((entry: LooseRecord) => String(entry?.diff || '').trim()).filter(Boolean).join('\n\n') || null,
      },
    };
  }

  public async listGatewayCapabilities(
    deps: WebAppRuntimeRouteDeps,
  ): Promise<LooseRecord> {
    return this.capabilitySupport.listGatewayCapabilities(deps);
  }

  public async enableGatewayCapability(
    input: {
      capabilityId: string;
      sessionId?: string | null;
      scope?: string | null;
      reason?: string | null;
      requestedBy?: string | null;
      sourceSurface?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<LooseRecord> {
    return this.capabilitySupport.enableGatewayCapability(input, deps);
  }

  public async disableGatewayCapability(
    input: {
      capabilityId: string;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<LooseRecord> {
    return this.capabilitySupport.disableGatewayCapability(input, deps);
  }

  public async previewGatewaySelfmod(
    input: {
      mode: 'file' | 'goal';
      filePath?: string | null;
      instruction?: string | null;
      goal?: string | null;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<LooseRecord> {
    return this.selfmodSupport.previewGatewaySelfmod(input, deps);
  }

  public async applyGatewaySelfmod(
    input: {
      previewId: string;
      sessionId?: string | null;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<LooseRecord> {
    return this.selfmodSupport.applyGatewaySelfmod(input, deps);
  }

  public async rollbackGatewaySelfmod(
    input: {
      changeId: string;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<LooseRecord> {
    return this.selfmodSupport.rollbackGatewaySelfmod(input, deps);
  }

  public async abortCanonicalChat(
    input: {
      sessionId: string;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<LooseRecord> {
    const sessionId = String(input.sessionId || '').trim();
    if (!sessionId) {
      throw new Error('sessionId obrigatorio para chat.abort.');
    }
    const chatId = deps.realtime.getChatId(sessionId);
    const activeStatuses = new Set([
      'pending',
      'queued',
      'planning',
      'approved',
      'running',
      'in_progress',
      'processing',
      'waiting_approval',
      'retrying',
    ]);
    const tasks = deps.runtime.taskManager.getRecentTasksByChat(chatId, 25) || [];
    const activeTask = tasks.find((task: LooseRecord) => activeStatuses.has(String(task?.status || '').trim().toLowerCase())) || null;
    if (!activeTask) {
      return {
        ok: true,
        sessionId,
        status: 'idle',
        supported: false,
        message: 'Nenhuma task ativa encontrada para abort nesta sessao.',
      };
    }

    const taskManager = deps.runtime.taskManager as LooseRecord;
    if (typeof taskManager.saveTask === 'function') {
      taskManager.saveTask({
        ...activeTask,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(activeTask?.metadata || {}),
          gateway_abort_requested: true,
          gateway_abort_requested_at: new Date().toISOString(),
          gateway_abort_requested_by: String(input.requestedBy || deps.runtime.webUserId || 'web-operator').trim(),
        },
      });
    }
    await deps.realtime.captureBaseline(sessionId);
    return {
      ok: true,
      sessionId,
      taskId: String(activeTask?.task_id || '').trim() || null,
      status: 'abort_requested',
      supported: false,
      message: 'O Gateway marcou abort_requested. O executor atual ainda nao expoe cancelamento forte neste runtime.',
    };
  }

  private shouldExposeArtifactsForRecord(record: LooseRecord | null | undefined): boolean {
    const metadata = record && typeof record.metadata === 'object' ? record.metadata : {};
    return shouldPersistZavorthArtifacts({
      ...metadata,
      responseDecision: record?.responseDecision || (metadata as LooseRecord)?.responseDecision,
      artifactPolicy: record?.artifactPolicy || (metadata as LooseRecord)?.artifactPolicy,
    });
  }

}

function toSurfaceControllerContext(value: unknown): SurfaceControllerContext {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as SurfaceControllerContext
    : {};
}

