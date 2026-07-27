import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import { ZavorthNaturalSetupControlPlaneService } from './ZavorthNaturalSetupControlPlaneService.js';
import { TrustDecisionService } from './TrustDecisionService.js';
import { ChannelSetupAssistantService } from './ChannelSetupAssistantService.js';
import { PermissionService } from './PermissionService.js';
import type {
  ZavorthMutationPlan,
  ZavorthReadinessGate,
  ZavorthResourceImpact,
} from '../contracts/ZavorthMutationPlaneContract.js';
import type { ZavorthNaturalSetupControlPlaneSnapshot } from './ZavorthNaturalSetupControlPlaneService.js';
import type { TrustDecision } from './TrustDecisionService.js';
import type {
  ChannelSetupAssistantApplyResult,
  ChannelSetupAssistantDoctorResult,
} from './ChannelSetupAssistantService.js';
import type { ChannelMeshActionExecution } from '../contracts/channel/ChannelMeshContract.js';

export type NaturalSetupActionResult = {
  action: string;
  result:
    | ChannelSetupAssistantApplyResult
    | ChannelSetupAssistantDoctorResult
    | ChannelMeshActionExecution;
};

export type NaturalSetupPlanPayload = {
  intentText: string | null;
  rawIntentRedacted: boolean;
  channelId: string | null;
  capabilityId: string | null;
  mode: string | null;
  actions: {
    apply: boolean;
    doctor: boolean;
    test: boolean;
    localOnly: boolean;
  };
  missingEnvKeys: number;
  selectedReady: boolean;
  planPreview: unknown;
  manualFallback: string[];
};

export type NaturalSetupPlan = ZavorthMutationPlan & {
  domain: 'setup';
  actionId: 'natural-setup';
  payload: NaturalSetupPlanPayload;
};

type NaturalSetupMutationPlannerRuntime = {
  controlPlaneService?: Pick<ZavorthNaturalSetupControlPlaneService, 'buildSnapshot'>;
  mutationPlaneService?: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  >;
  trustDecisionService?: Pick<TrustDecisionService, 'evaluate'>;
  channelSetupAssistant?: Pick<ChannelSetupAssistantService, 'apply' | 'runDoctor'> | null;
  channelActions?: { execute: (input: { channelId: string; actionId: string; requestedBy?: string | null }) => Promise<ChannelMeshActionExecution> } | null;
  permissionService?: Pick<PermissionService, 'getRequest'>;
};

export class NaturalSetupMutationPlannerService {
  private readonly controlPlane: Pick<ZavorthNaturalSetupControlPlaneService, 'buildSnapshot'>;
  private readonly mutationPlane: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  >;
  private readonly trustDecision: Pick<TrustDecisionService, 'evaluate'>;
  private readonly channelSetupAssistant: Pick<ChannelSetupAssistantService, 'apply' | 'runDoctor'> | null;
  private readonly channelActions: { execute: (input: { channelId: string; actionId: string; requestedBy?: string | null }) => Promise<ChannelMeshActionExecution> } | null;
  private readonly permissionService: Pick<PermissionService, 'getRequest'>;

  constructor(runtime: NaturalSetupMutationPlannerRuntime = {}) {
    this.controlPlane = runtime.controlPlaneService || new ZavorthNaturalSetupControlPlaneService();
    this.mutationPlane = runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.trustDecision = runtime.trustDecisionService || new TrustDecisionService();
    this.channelSetupAssistant = runtime.channelSetupAssistant || null;
    this.channelActions = runtime.channelActions || null;
    this.permissionService = runtime.permissionService || new PermissionService();
  }

  public async preview(input: {
    intentText?: string | null;
    channelId?: string | null;
    mode?: string | null;
    apply?: boolean;
    doctor?: boolean;
    test?: boolean;
    localOnly?: boolean;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }): Promise<{ snapshot: ZavorthNaturalSetupControlPlaneSnapshot; mutationPlan: NaturalSetupPlan; trustDecision: TrustDecision }> {
    const snapshot = await this.controlPlane.buildSnapshot({
      intentText: input.intentText || null,
      channelId: input.channelId || null,
      mode: input.mode || null,
      autoApply: input.apply === true,
      autoDoctor: input.doctor === true,
      autoTest: input.test === true,
      localOnly: input.localOnly === true,
    });
    const selectedChannelId = String(snapshot.selectedChannelId || input.channelId || '').trim() || null;
    const capabilityId = this.resolveCapabilityId(selectedChannelId);
    const safeIntentText = this.redactSensitiveText(input.intentText || null);
    const actions = {
      apply: input.apply === true,
      doctor: input.doctor === true,
      test: input.test === true,
      localOnly: input.localOnly === true,
    };
    const resourceImpact = this.resolveResourceImpact(actions, snapshot.planPreview?.resourceImpact);
    const readinessGate = this.buildReadinessGate(snapshot, actions, selectedChannelId, capabilityId);
    const plan = this.mutationPlane.createPlan({
      domain: 'setup',
      actionId: 'natural-setup',
      title: selectedChannelId ? `Apply natural setup for ${selectedChannelId}` : 'Apply natural setup for channel',
      summary: 'run scaffold, doctor, or send-test detected by Natural Setup only after approval.',
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'natural-setup',
      riskLevel: input.apply || input.test ? 'high' : 'medium',
      approvalRequired: true,
      approvalReason: 'Natural Setup can write .env, generate scaffolds, or send test messages.',
      resourceImpact,
      readinessGates: [readinessGate],
      validationPlan: [
        'Mascarar secrets before persistir.',
        'validate channel e modo before do apply.',
        'Consult Capability Lifecycle and Trust Plane before any activation.',
        'run doctor only after valid scaffold/env.',
      ],
      rollbackPlan: [
        'Restore files changed by the scaffold if validation fails.',
        'Do not repeat send-test automatically during rollback.',
        'Preservar fallback manual when approval for denydo.',
      ],
      payload: {
        intentText: safeIntentText,
        rawIntentRedacted: safeIntentText !== (String(input.intentText || '').trim() || null),
        channelId: selectedChannelId,
        capabilityId,
        mode: input.mode || snapshot.turn?.mode || null,
        actions,
        missingEnvKeys: snapshot.summary?.missingEnvKeys || 0,
        selectedReady: snapshot.summary?.selectedReady === true,
        planPreview: snapshot.planPreview || null,
        manualFallback: Array.isArray(snapshot.planPreview?.manualFallback) ? snapshot.planPreview.manualFallback : [],
      },
    });
    const decision = await this.trustDecision.evaluate({
      domain: 'setup',
      actionId: 'natural-setup',
      planId: plan.id,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'natural-setup',
      riskLevel: input.apply || input.test ? 'high' : 'medium',
      approvalRequired: true,
      capabilityId,
      reason: 'Mutable Natural Setup requires approval before writing or sending a test.',
      resourceImpact,
      payload: plan.payload,
    });
    if (decision.decision === 'blocked') {
      const blocked = this.mutationPlane.markBlocked(plan.id, decision.reason);
      return { snapshot, mutationPlan: blocked as NaturalSetupPlan, trustDecision: decision };
    }
    const mutationPlan = decision.permission
      ? this.mutationPlane.attachApproval(plan.id, {
        permissionId: decision.permission.permission_id,
        status: decision.permission.status === 'approved' ? 'approved' : 'pending',
        reason: decision.reason,
      })
      : plan;
    return { snapshot, mutationPlan: mutationPlan as NaturalSetupPlan, trustDecision: decision };
  }

  public async apply(input: {
    planId: string;
    requestedBy?: string | null;
  }): Promise<{
    ok: boolean;
    status: 'applied' | 'waiting_approval' | 'blocked';
    summary: string;
    mutationPlan: ZavorthMutationPlan;
    snapshot: ZavorthNaturalSetupControlPlaneSnapshot;
    results: NaturalSetupActionResult[];
  }> {
    let plan = this.mutationPlane.readPlan(input.planId);
    if (!plan || plan.domain !== 'setup' || plan.actionId !== 'natural-setup') {
      throw new Error(`Natural Setup plan not found: ${input.planId || 'n/d'}.`);
    }
    if (plan.status === 'blocked' || plan.status === 'expired') {
      return {
        ok: false,
        status: 'blocked',
        summary: `Natural Setup blocked: plan ${plan.status}.`,
        mutationPlan: plan,
        snapshot: await this.controlPlane.buildSnapshot(),
        results: [],
      };
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      const permission = plan.approval.permissionId
        ? await this.permissionService.getRequest(plan.approval.permissionId)
        : null;
      if (permission?.status === 'approved') {
        plan = this.mutationPlane.approvePlan(plan.id, {
          permissionId: permission.permission_id,
          approvedBy: permission.decided_by || input.requestedBy || null,
          scope: permission.scope === 'persistent' ? 'host' : permission.scope === 'session' ? 'session' : 'once',
        });
      } else if (permission?.status === 'rejected') {
        const blocked = this.mutationPlane.markBlocked(plan.id, 'Approval rejected no Permission Plane.');
        return {
          ok: false,
          status: 'blocked',
          summary: 'Natural Setup blocked: approval rejected.',
          mutationPlan: blocked,
          snapshot: await this.controlPlane.buildSnapshot(),
          results: [],
        };
      }
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      return {
        ok: false,
        status: 'waiting_approval',
        summary: `Plan ${plan.id} is still waiting for approval.`,
        mutationPlan: plan,
        snapshot: await this.controlPlane.buildSnapshot(),
        results: [],
      };
    }

    const payload = plan.payload || {};
    const actions = (payload.actions || {}) as Record<string, unknown>;
    const channelId = String(payload.channelId || '').trim();
    const mode = String(payload.mode || '').trim() || null;
    const localOnly = actions.localOnly === true;
    const results: NaturalSetupActionResult[] = [];

    if (!channelId) {
      const blocked = this.mutationPlane.markBlocked(plan.id, 'Plan has no resolved channelId.');
      return {
        ok: false,
        status: 'blocked',
        summary: 'Natural Setup blocked: channelId missing in plan.',
        mutationPlan: blocked,
        snapshot: await this.controlPlane.buildSnapshot(),
        results,
      };
    }

    if (actions.apply === true) {
      if (!this.channelSetupAssistant) {
        const blocked = this.mutationPlane.markBlocked(plan.id, 'Channel setup assistant unavailable para apply.');
        return {
          ok: false,
          status: 'blocked',
          summary: 'Natural Setup blocked: assistant unavailable para scaffold.',
          mutationPlan: blocked,
          snapshot: await this.controlPlane.buildSnapshot({ channelId, mode }),
          results,
        };
      }
      results.push({
        action: 'apply',
        result: await this.channelSetupAssistant.apply({
          channelId,
          mode,
          requestedBy: input.requestedBy || null,
        }),
      });
    }

    if (actions.doctor === true) {
      if (!this.channelSetupAssistant) {
        const blocked = this.mutationPlane.markBlocked(plan.id, 'Channel setup assistant unavailable para doctor.');
        return {
          ok: false,
          status: 'blocked',
          summary: 'Natural Setup blocked: assistant unavailable para doctor.',
          mutationPlan: blocked,
          snapshot: await this.controlPlane.buildSnapshot({ channelId, mode }),
          results,
        };
      }
      results.push({
        action: 'doctor',
        result: await this.channelSetupAssistant.runDoctor({
          selectedId: channelId,
          localOnly,
        }),
      });
    }

    if (actions.test === true) {
      if (!this.channelActions) {
        const blocked = this.mutationPlane.markBlocked(plan.id, 'Channel actions unavailable para send-test.');
        return {
          ok: false,
          status: 'blocked',
          summary: 'Natural Setup blocked: channel actions unavailable para send-test.',
          mutationPlan: blocked,
          snapshot: await this.controlPlane.buildSnapshot({ channelId, mode }),
          results,
        };
      }
      results.push({
        action: 'send-test',
        result: await this.channelActions.execute({
          channelId,
          actionId: 'send-test',
          requestedBy: input.requestedBy || null,
        }),
      });
    }

    const applied = this.mutationPlane.markApplied(
      plan.id,
      'Natural Setup aplicado exatamente do mutation plan approved.',
      results.map((entry) => String(entry.action || 'action')),
    );
    return {
      ok: true,
      status: 'applied',
      summary: 'Natural Setup applied successfully.',
      mutationPlan: applied,
      snapshot: await this.controlPlane.buildSnapshot({ channelId, mode }),
      results,
    };
  }

  private buildReadinessGate(
    snapshot: ZavorthNaturalSetupControlPlaneSnapshot,
    actions: NaturalSetupPlanPayload['actions'],
    selectedChannelId: string | null,
    capabilityId: string | null,
  ): ZavorthReadinessGate {
    const blockers: string[] = [];
    const warnings: string[] = [];
    if (!selectedChannelId) {
      blockers.push('Target channel has not been resolved yet.');
    }
    if ((actions.doctor || actions.test) && Number(snapshot.summary?.missingEnvKeys || 0) > 0) {
      blockers.push('Doctor/test requires required env vars to be filled.');
    }
    if (capabilityId && snapshot.planPreview?.capability && !['ready', 'active'].includes(snapshot.planPreview.capability.state)) {
      warnings.push(`Capability ${capabilityId} ainda is ${snapshot.planPreview.capability.state}.`);
    }
    if (actions.apply || actions.doctor || actions.test) {
      warnings.push('Mutable execution can occur only through apply of an approved mutation plan.');
    }
    return {
      id: `natural-setup:${selectedChannelId || 'unresolved'}`,
      status: blockers.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
      canProceed: blockers.length === 0,
      scope: 'preview',
      reasons: [
        'Plan generated preview-first.',
        'Secrets sao mascarados before persistir.',
        'Trust Plane decide approval before apply.',
      ],
      warnings,
      blockers,
      checkedAt: new Date().toISOString(),
      budgets: {
        previewOnly: true,
        approvalRequired: true,
        maxProcessCountBeforeApproval: 0,
      },
      nextActions: [...blockers, ...warnings].slice(0, 6),
    };
  }

  private resolveResourceImpact(
    actions: NaturalSetupPlanPayload['actions'],
    previewImpact: Partial<ZavorthResourceImpact> | null | undefined,
  ): ZavorthResourceImpact {
    return {
      ramMb: Math.max(0, Math.round(Number(previewImpact?.ramMb || 24))),
      diskMb: actions.apply ? Math.max(1, Math.round(Number(previewImpact?.diskMb || 12))) : 1,
      processCount: Math.max(0, Math.round(Number(previewImpact?.processCount || 0))),
      externalExposure: actions.test ? 'network' : 'none',
      recurring: false,
      notes: [
        'Preview persistido without secrets brutos.',
        'Apply depende de canonical approval.',
        ...(Array.isArray(previewImpact?.notes) ? previewImpact.notes : []),
      ],
    };
  }

  private resolveCapabilityId(channelId: string | null): string | null {
    const normalized = String(channelId || '').trim().toLowerCase();
    const known = new Set(['discord', 'whatsapp', 'slack', 'signal', 'imessage', 'teams', 'email']);
    return known.has(normalized) ? normalized : null;
  }

  private redactSensitiveText(value: unknown): string | null {
    const raw = String(value || '').trim();
    if (!raw) {
      return null;
    }
    return raw
      .replace(/\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASS|API_KEY|CREDENTIAL)[A-Z0-9_]*)\s*=\s*("[^"]+"|'[^']+'|[^\s,;]+)/gi, '$1=***')
      .replace(/\b((?:[a-z0-9_-]+\s+){0,4}(?:token|secret|password|api key|credential)(?:\s+[a-z0-9_-]+){0,4})\s*(?:=|:|e|eh|is|\u00e9)\s*("[^"]+"|'[^']+'|[^\s,;]+)/gi, '$1=***');
  }
}
