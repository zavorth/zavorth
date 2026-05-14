import type { WebAppRuntimeRouteDeps } from '../WebAppRuntimeRouteService.js';
import {
  findLatestPlanByPayload,
  planTouchesSession,
} from './WebAppGatewayControlHelpers.js';

export class WebAppGatewaySelfmodSupport {
  public async buildSelfmodPlane(
    sessionId: string,
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    const plans = deps.mutationPlane
      ? deps.mutationPlane.listPlans({ limit: 20, includeExpired: false })
        .filter((plan) => plan.domain === 'selfmod' || planTouchesSession(plan, sessionId))
        .slice(0, 10)
      : [];
    return {
      generatedAt: new Date().toISOString(),
      sessionId,
      status: deps.selfModification ? 'available' : 'unavailable',
      supportedModes: ['file', 'goal'],
      recentPlans: plans.map((plan) => ({
        id: plan.id,
        actionId: plan.actionId,
        status: plan.status,
        title: plan.title,
        summary: plan.summary,
        updatedAt: plan.updatedAt,
        approval: plan.approval,
        payload: plan.payload,
      })),
      commands: {
        preview: 'selfmod.preview',
        apply: 'selfmod.apply',
        rollback: 'selfmod.rollback',
      },
    };
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
  ): Promise<Record<string, any>> {
    if (!deps.selfModification) {
      throw new Error('Selfmod indisponivel neste runtime.');
    }
    const requestedBy = String(input.requestedBy || deps.runtime.webUserId || 'web-operator').trim();
    const mode = input.mode === 'goal' ? 'goal' : 'file';
    const result = mode === 'goal'
      ? await deps.selfModification.createGoalPreview(String(input.goal || '').trim(), requestedBy)
      : await deps.selfModification.createPreview(
        String(input.filePath || '').trim(),
        String(input.instruction || '').trim(),
        requestedBy,
      );
    return {
      ok: result.success,
      status: result.success ? 'preview_ready' : 'blocked',
      preview: result,
    };
  }

  public async applyGatewaySelfmod(
    input: {
      previewId: string;
      sessionId?: string | null;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    if (!deps.selfModification) {
      throw new Error('Selfmod indisponivel neste runtime.');
    }
    const previewId = String(input.previewId || '').trim();
    if (!previewId) {
      throw new Error('previewId obrigatorio para selfmod.apply.');
    }
    const requestedBy = String(input.requestedBy || deps.runtime.webUserId || 'web-operator').trim();
    const sessionId = String(input.sessionId || '').trim() || null;
    const existingPlan = findLatestPlanByPayload(deps, 'selfmod', 'apply', {
      previewId,
      sessionId,
    });
    if (existingPlan && (existingPlan.status === 'waiting_approval' || existingPlan.status === 'approved')) {
      if (existingPlan.status !== 'approved' && existingPlan.approval.status !== 'approved') {
        return {
          ok: false,
          status: 'waiting_approval',
          mutationPlan: existingPlan,
        };
      }
      const applyResult = await deps.selfModification.applyPreview(previewId, requestedBy);
      const mutationPlan = deps.mutationPlane
        ? deps.mutationPlane.markApplied(existingPlan.id, applyResult.summary, [`selfmod.apply:${previewId}`])
        : existingPlan;
      return {
        ok: applyResult.success,
        status: applyResult.success ? 'applied' : 'blocked',
        mutationPlan,
        result: applyResult,
      };
    }

    const plan = deps.mutationPlane?.createPlan({
      domain: 'selfmod',
      actionId: 'apply',
      title: `Apply selfmod preview ${previewId}`,
      summary: 'Aplicar preview guardado do selfmod via Gateway.',
      requestedBy,
      sourceSurface: 'gateway-ws',
      riskLevel: 'high',
      approvalRequired: true,
      approvalReason: 'Selfmod apply exige approval explicita do operador.',
      validationPlan: ['preview integrity', 'validation report', 'rollback available'],
      rollbackPlan: ['selfmod.rollback'],
      payload: {
        previewId,
        sessionId,
      },
    }) || null;
    if (!plan || !deps.trustDecision) {
      const applyResult = await deps.selfModification.applyPreview(previewId, requestedBy);
      return {
        ok: applyResult.success,
        status: applyResult.success ? 'applied' : 'blocked',
        mutationPlan: plan,
        result: applyResult,
      };
    }

    const trustDecision = await deps.trustDecision.evaluate({
      domain: 'selfmod',
      actionId: 'apply',
      planId: plan.id,
      requestedBy,
      sourceSurface: 'gateway-ws',
      riskLevel: 'high',
      approvalRequired: true,
      reason: 'Selfmod apply exige approval explicita do operador.',
      approvalScope: 'once',
      payload: {
        previewId,
        sessionId,
      },
      resourceImpact: {
        ramMb: 64,
        diskMb: 32,
        processCount: 0,
        externalExposure: 'none',
        recurring: false,
        notes: ['Selfmod aplica changeset guardado com rollback.'],
      },
    });
    let mutationPlan = plan;
    if (trustDecision.permission && deps.mutationPlane) {
      mutationPlan = deps.mutationPlane.attachApproval(plan.id, {
        permissionId: trustDecision.permission.permission_id,
        status: 'pending',
        reason: trustDecision.reason,
      });
    }
    if (trustDecision.decision !== 'allowed') {
      if (trustDecision.decision === 'blocked' && deps.mutationPlane) {
        mutationPlan = deps.mutationPlane.markBlocked(plan.id, trustDecision.reason);
      }
      return {
        ok: false,
        status: trustDecision.decision === 'blocked' ? 'blocked' : 'waiting_approval',
        mutationPlan,
        trustDecision,
      };
    }

    const applyResult = await deps.selfModification.applyPreview(previewId, requestedBy);
    mutationPlan = deps.mutationPlane
      ? deps.mutationPlane.markApplied(plan.id, applyResult.summary, [`selfmod.apply:${previewId}`])
      : mutationPlan;
    return {
      ok: applyResult.success,
      status: applyResult.success ? 'applied' : 'blocked',
      mutationPlan,
      trustDecision,
      result: applyResult,
    };
  }

  public async rollbackGatewaySelfmod(
    input: {
      changeId: string;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    if (!deps.selfModification) {
      throw new Error('Selfmod indisponivel neste runtime.');
    }
    const changeId = String(input.changeId || '').trim();
    if (!changeId) {
      throw new Error('changeId obrigatorio para selfmod.rollback.');
    }
    const requestedBy = String(input.requestedBy || deps.runtime.webUserId || 'web-operator').trim();
    const plan = deps.mutationPlane?.createPlan({
      domain: 'selfmod',
      actionId: 'rollback',
      title: `Rollback selfmod ${changeId}`,
      summary: 'Executar rollback de selfmod via Gateway.',
      requestedBy,
      sourceSurface: 'gateway-ws',
      riskLevel: 'medium',
      approvalRequired: false,
      validationPlan: ['history lookup', 'restore previous snapshot'],
      rollbackPlan: [],
      payload: {
        changeId,
      },
    }) || null;
    const result = await deps.selfModification.rollbackChangeSet(changeId, requestedBy);
    const mutationPlan = plan && deps.mutationPlane
      ? deps.mutationPlane.markApplied(plan.id, result.summary, [`selfmod.rollback:${changeId}`])
      : plan;
    return {
      ok: result.success,
      status: result.success ? 'applied' : 'blocked',
      mutationPlan,
      result,
    };
  }
}
