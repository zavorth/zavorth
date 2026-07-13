import type { WebAppRuntimeRouteDeps } from '../WebAppRuntimeRouteService.js';
import {
  findLatestPlanByPayload,
  normalizeGatewayApprovalScope,
} from './WebAppGatewayControlHelpers.js';

export class WebAppGatewayCapabilitySupport {
  public async listGatewayCapabilities(
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    const snapshot = deps.capabilityLifecycle?.buildSnapshot() || null;
    const pendingPlans = deps.mutationPlane
      ? deps.mutationPlane.listPlans({ limit: 30, includeExpired: false })
        .filter((plan) => plan.domain === 'capability')
        .slice(0, 12)
      : [];
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      ...(snapshot || {
        profile: 'core',
        policy: 'ask-on-demand',
        commands: {},
        summary: { total: 0, builtinCapabilities: 0, registeredCommands: 0, active: 0, dormant: 0, requiringApproval: 0 },
        capabilities: [],
      }),
      pendingPlans,
    };
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
  ): Promise<Record<string, any>> {
    if (!deps.capabilityLifecycle) {
      throw new Error('Capability lifecycle unavailable in this runtime.');
    }
    const capabilityId = String(input.capabilityId || '').trim();
    const manifest = deps.capabilityLifecycle.getManifest(capabilityId);
    if (!manifest) {
      throw new Error(`Capability desconhecida: ${capabilityId || 'n/d'}.`);
    }
    const sessionId = String(input.sessionId || '').trim() || null;
    const requestedBy = String(input.requestedBy || deps.runtime.webUserId || 'web-operator').trim();
    const scope = normalizeGatewayApprovalScope(input.scope);
    const reason = String(input.reason || '').trim() || `Habilitar ${manifest.label} pelo Gateway.`;
    const taskResourceImpact = await deps.taskResourcePlanner?.planCapabilityEnable(capabilityId, {
      requestedBy,
      intent: reason,
    }) || null;

    const existingPlan = findLatestPlanByPayload(deps, 'capability', 'enable', {
      capabilityId,
      sessionId,
    });
    if (existingPlan?.status === 'waiting_approval' || existingPlan?.status === 'approved') {
      if (existingPlan.status === 'approved' || existingPlan.approval.status === 'approved') {
        const enabled = deps.capabilityLifecycle.enableCapability(capabilityId, requestedBy, scope);
        deps.capabilityLifecycle.markCapabilityState(capabilityId, 'active', `activated via approved gateway plan by ${requestedBy}`);
        deps.capabilityLifecycle.registerCapabilityUsage(capabilityId, `capability activated in gateway session ${sessionId || 'n/a'}`);
        const mutationPlan = deps.mutationPlane?.markApplied(existingPlan.id, `Capability ${manifest.label} habilitada via Gateway.`, [`capability.enable:${capabilityId}`]) || existingPlan;
        return {
          ok: true,
          status: 'applied',
          capability: enabled,
          resourceImpact: taskResourceImpact,
          mutationPlan,
        };
      }
      const demand = deps.capabilityLifecycle.registerCapabilityDemand(capabilityId, requestedBy, reason);
      return {
        ok: false,
        status: 'waiting_approval',
        capability: demand?.capability || null,
        approval: demand?.approval || deps.capabilityLifecycle.buildApprovalRequest(capabilityId, requestedBy, reason),
        resourceImpact: taskResourceImpact,
        mutationPlan: existingPlan,
      };
    }

    const demand = deps.capabilityLifecycle.registerCapabilityDemand(capabilityId, requestedBy, reason);
    const resourceImpact = deps.taskResourcePlanner?.toMutationResourceImpact(taskResourceImpact) || {
      ramMb: Number(manifest.estimatedFootprint.ramIdleMb || 0),
      diskMb: Number(manifest.estimatedFootprint.diskMb || 0),
      processCount: Number(manifest.estimatedFootprint.processCount || 0),
      externalExposure: manifest.activationMode === 'sidecar' ? 'local' : 'none',
      recurring: false,
      notes: manifest.estimatedFootprint.notes ? [manifest.estimatedFootprint.notes] : [],
    } as const;
    const plan = deps.mutationPlane?.createPlan({
      domain: 'capability',
      actionId: 'enable',
      title: `Enable capability ${manifest.label}`,
      summary: reason,
      requestedBy,
      sourceSurface: String(input.sourceSurface || 'gateway-ws').trim() || 'gateway-ws',
      riskLevel: manifest.approvalRequired ? 'high' : 'low',
      approvalRequired: manifest.approvalRequired,
      approvalReason: reason,
      resourceImpact,
      validationPlan: ['manifest', 'approval', 'runtime readiness'],
      rollbackPlan: [`/disable ${capabilityId}`],
      payload: {
        capabilityId,
        sessionId,
        scope,
      },
    }) || null;

    if (manifest.approvalRequired && deps.trustDecision && plan) {
      const trustDecision = await deps.trustDecision.evaluate({
        domain: 'capability',
        actionId: 'enable',
        planId: plan.id,
        requestedBy,
        sourceSurface: String(input.sourceSurface || 'gateway-ws').trim() || 'gateway-ws',
        riskLevel: manifest.activationMode === 'sidecar' ? 'high' : 'medium',
        approvalRequired: true,
        capabilityId,
        reason,
        resourceImpact,
        approvalScope: scope,
        payload: {
          capabilityId,
          sessionId,
          scope,
        },
      });
      let mutationPlan = plan;
      if (trustDecision.permission && deps.mutationPlane) {
        mutationPlan = deps.mutationPlane.attachApproval(plan.id, {
          permissionId: trustDecision.permission.permission_id,
          status: 'pending',
          reason,
        });
      }
      if (trustDecision.decision === 'blocked') {
        if (deps.mutationPlane) {
          mutationPlan = deps.mutationPlane.markBlocked(plan.id, trustDecision.reason);
        }
        return {
          ok: false,
          status: 'blocked',
          capability: demand?.capability || null,
          approval: demand?.approval || null,
          resourceImpact: taskResourceImpact,
          mutationPlan,
          trustDecision,
        };
      }
      if (trustDecision.decision === 'requires_approval') {
        return {
          ok: false,
          status: 'waiting_approval',
          capability: demand?.capability || null,
          approval: demand?.approval || null,
          resourceImpact: taskResourceImpact,
          mutationPlan,
          trustDecision,
        };
      }
    }

    const enabled = deps.capabilityLifecycle.enableCapability(capabilityId, requestedBy, scope);
    deps.capabilityLifecycle.markCapabilityState(capabilityId, 'active', `activated via gateway by ${requestedBy}`);
    deps.capabilityLifecycle.registerCapabilityUsage(capabilityId, `capability activated in gateway session ${sessionId || 'n/a'}`);
    const appliedPlan = plan && deps.mutationPlane
      ? deps.mutationPlane.markApplied(plan.id, `Capability ${manifest.label} habilitada via Gateway.`, [`capability.enable:${capabilityId}`])
      : plan;
    return {
      ok: true,
      status: 'applied',
      capability: enabled,
      approval: demand?.approval || null,
      resourceImpact: taskResourceImpact,
      mutationPlan: appliedPlan,
    };
  }

  public async disableGatewayCapability(
    input: {
      capabilityId: string;
      requestedBy?: string | null;
    },
    deps: WebAppRuntimeRouteDeps,
  ): Promise<Record<string, any>> {
    if (!deps.capabilityLifecycle) {
      throw new Error('Capability lifecycle unavailable in this runtime.');
    }
    const capabilityId = String(input.capabilityId || '').trim();
    const manifest = deps.capabilityLifecycle.getManifest(capabilityId);
    if (!manifest) {
      throw new Error(`Capability desconhecida: ${capabilityId || 'n/d'}.`);
    }
    if (capabilityId === 'core-runtime') {
      throw new Error('core-runtime nao pode ser desativada pelo Gateway.');
    }
    const requestedBy = String(input.requestedBy || deps.runtime.webUserId || 'web-operator').trim();
    const plan = deps.mutationPlane?.createPlan({
      domain: 'capability',
      actionId: 'disable',
      title: `Disable capability ${manifest.label}`,
      summary: `Desabilitar ${manifest.label} pelo Gateway.`,
      requestedBy,
      sourceSurface: 'gateway-ws',
      riskLevel: 'low',
      approvalRequired: false,
      validationPlan: ['cleanup', 'state snapshot'],
      rollbackPlan: [`/enable ${capabilityId}`],
      payload: {
        capabilityId,
      },
    }) || null;
    const capability = deps.capabilityLifecycle.disableCapability(capabilityId, requestedBy);
    const mutationPlan = plan && deps.mutationPlane
      ? deps.mutationPlane.markApplied(plan.id, `Capability ${manifest.label} desabilitada via Gateway.`, [`capability.disable:${capabilityId}`])
      : plan;
    return {
      ok: true,
      status: 'applied',
      capability,
      mutationPlan,
    };
  }
}
