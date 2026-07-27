import crypto from 'crypto';
import {
  ZavorthSandboxControlPlaneService,
  type ZavorthSandboxControlPlaneSnapshot,
  type ZavorthSandboxEnvelopeInput,
} from './ZavorthSandboxControlPlaneService.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';

import { TrustDecisionService, type TrustDecision } from './TrustDecisionService.js';
import { PermissionService } from './PermissionService.js';
import type {
  ZavorthCapabilityRunEnvelope,
  ZavorthMutationPlan,
  ZavorthReadinessGate,
  ZavorthResourceImpact,
} from '../contracts/ZavorthMutationPlaneContract.js';

type SandboxActionDeps = {
  now?: () => Date;
  controlPlaneService?: Pick<ZavorthSandboxControlPlaneService, 'buildSnapshot'> | null;
  mutationPlaneService?: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  > | null;
  trustDecisionService?: Pick<TrustDecisionService, 'evaluate'> | null;
  permissionService?: Pick<PermissionService, 'getRequest'> | null;
};

export type ZavorthSandboxActionExecution = {
  generatedAt: string;
  actionId: 'preview' | 'apply';
  status: 'ready' | 'waiting_approval' | 'blocked' | 'applied';
  ok: boolean;
  summary: string;
  details: string[];
  snapshot: ZavorthSandboxControlPlaneSnapshot;
  envelope: ZavorthCapabilityRunEnvelope | null;
  mutationPlan: ZavorthMutationPlan | null;
  trustDecision: TrustDecision | null;
};

export class ZavorthSandboxActionService {
  private readonly now: () => Date;
  private readonly controlPlane: Pick<ZavorthSandboxControlPlaneService, 'buildSnapshot'>;
  private readonly mutationPlane: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  >;
  private readonly trustDecision: Pick<TrustDecisionService, 'evaluate'>;
  private readonly permissionService: Pick<PermissionService, 'getRequest'>;

  constructor(runtime: SandboxActionDeps = {}) {
    this.now = runtime.now || (() => new Date());
    this.controlPlane = runtime.controlPlaneService || new ZavorthSandboxControlPlaneService();
    this.mutationPlane = runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.trustDecision = runtime.trustDecisionService || new TrustDecisionService();
    this.permissionService = runtime.permissionService || new PermissionService();
  }

  public async preview(input: ZavorthSandboxEnvelopeInput): Promise<ZavorthSandboxActionExecution> {
    const snapshot = this.controlPlane.buildSnapshot(input);
    const envelope = snapshot.envelopePreview;
    if (!envelope) {
      return {
        generatedAt: this.now().toISOString(),
        actionId: 'preview',
        status: 'blocked',
        ok: false,
        summary: 'No code or command was provided to create a sandbox envelope.',
        details: ['Use --code or --command to create an executable preview.'],
        snapshot,
        envelope: null,
        mutationPlan: null,
        trustDecision: null,
      };
    }

    const profile = snapshot.profiles.find((entry) => entry.id === envelope.sandboxProfile) || null;
    const profileCanRun = profile?.canRun === true;
    const requiresPlan = this.requiresPlan(envelope, profileCanRun);
    if (!requiresPlan) {
      const decision = await this.trustDecision.evaluate({
        domain: 'sandbox',
        actionId: 'execute-untrusted',
        requestedBy: input.requestedBy || null,
        sourceSurface: input.sourceSurface || 'sandbox',
        riskLevel: envelope.riskLevel,
        approvalRequired: false,
        capabilityId: 'sandbox-execution',
        reason: 'Low-risk execution in an ephemeral sandbox.',
        payload: this.buildRedactedPayload(input, envelope, snapshot),
        resourceImpact: this.resourceImpact(envelope),
      });
      return {
        generatedAt: this.now().toISOString(),
        actionId: 'preview',
        status: decision.decision === 'blocked' ? 'blocked' : 'ready',
        ok: decision.ok,
        summary: decision.ok ? `Envelope ${envelope.id} ready for dry-run in ${envelope.sandboxProfile}.`
          : decision.reason,
        details: [
          ...envelope.reasons,
          'without raw code persisted in the mutation payload.',
        ],
        snapshot,
        envelope: {
          ...envelope,
          trustDecisionId: decision.permission?.permission_id || null,
        },
        mutationPlan: null,
        trustDecision: decision,
      };
    }

    const readinessGate = this.buildReadinessGate(envelope, profile, snapshot);
    const plan = this.mutationPlane.createPlan({
      domain: 'sandbox',
      actionId: 'execute-untrusted',
      title: `run code in sandbox ${envelope.sandboxProfile}`,
      summary: 'Untrusted execution requires envelope, budget, Trust Plane, and cleanup before apply.',
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'sandbox',
      riskLevel: envelope.riskLevel,
      approvalRequired: true,
      approvalReason: 'Untrusted code or elevated network/profile requires canonical approval.',
      resourceImpact: this.resourceImpact(envelope),
      readinessGates: [readinessGate],
      retentionPolicy: {
        ttlMs: envelope.cleanupPlan.ttlMs,
        maxBytes: envelope.budget.diskMb * 1024 * 1024,
        cleanupOnSuccess: true,
        cleanupOnBoot: true,
        notes: [
          'Sandbox artifacts are collected explicitly.',
          'Temporary workspace and containers/VMs must be removed in finally.',
        ],
      },
      validationPlan: [
        'validate filesystemPolicy.tempWorkspaceOnly=true.',
        'validate hostMountsReadOnly=true and deniedHostWrite=true.',
        'validate networkPolicy e budget before do apply.',
        'run only through SandboxExecutionService.executeEnvelope.',
        'Block downgrade to process/local-jail when riskLevel is not low.',
      ],
      rollbackPlan: [
        'Kill process/container/VM on timeout or cancellation.',
        'Remove temporary workspace and unpromoted artifacts.',
        'Keep only an auditable redacted report.',
      ],
      payload: this.buildRedactedPayload(input, envelope, snapshot),
    });
    const decision = await this.trustDecision.evaluate({
      domain: 'sandbox',
      actionId: 'execute-untrusted',
      planId: plan.id,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'sandbox',
      riskLevel: envelope.riskLevel,
      approvalRequired: true,
      capabilityId: 'sandbox-execution',
      reason: 'Strong sandbox requires approval before running untrusted code.',
      payload: this.buildRedactedPayload(input, envelope, snapshot),
      resourceImpact: plan.resourceImpact,
    });
    const withApproval = decision.permission
      ? this.mutationPlane.attachApproval(plan.id, {
        permissionId: decision.permission.permission_id,
        status: decision.permission.status === 'approved' ? 'approved' : 'pending',
        reason: decision.reason,
      })
      : plan;
    const effectivePlan = readinessGate.canProceed
      ? withApproval
      : this.mutationPlane.markBlocked(withApproval.id, readinessGate.blockers[0] || 'Sandbox runtime unavailable.');
    const status: ZavorthSandboxActionExecution['status'] =
      !readinessGate.canProceed || decision.decision === 'blocked'
        ? 'blocked'
        : 'waiting_approval';

    return {
      generatedAt: this.now().toISOString(),
      actionId: 'preview',
      status,
      ok: false,
      summary: status === 'blocked'
        ? `Sandbox blocked: ${readinessGate.blockers[0] || decision.reason}`
        : `Preview de sandbox created; aplique after approval with plan ${effectivePlan.id}.`,
      details: [
        `Plan: ${effectivePlan.id}.`,
        decision.permission ? `Permission: ${decision.permission.permission_id}.` : 'Pending permission was not created.',
        ...envelope.reasons,
      ],
      snapshot,
      envelope: {
        ...envelope,
        trustDecisionId: decision.permission?.permission_id || null,
      },
      mutationPlan: effectivePlan,
      trustDecision: decision,
    };
  }

  public async apply(input: {
    planId: string;
    requestedBy?: string | null;
  }): Promise<ZavorthSandboxActionExecution> {
    let plan = this.mutationPlane.readPlan(input.planId);
    if (!plan || plan.domain !== 'sandbox') {
      throw new Error(`Sandbox plan not found: ${input.planId || 'n/d'}.`);
    }
    if (plan.status === 'blocked' || plan.status === 'expired') {
      const snapshot = this.controlPlane.buildSnapshot();
      return {
        generatedAt: this.now().toISOString(),
        actionId: 'apply',
        status: 'blocked',
        ok: false,
        summary: `Plan ${plan.id} cannot be applied because it is ${plan.status}.`,
        details: ['No execution was started.'],
        snapshot,
        envelope: this.extractEnvelope(plan),
        mutationPlan: plan,
        trustDecision: null,
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
      }
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      throw new Error(`Plan ${plan.id} is still waiting for approval.`);
    }

    const applied = this.mutationPlane.markApplied(
      plan.id,
      'Sandbox plan approved; the executor must call SandboxExecutionService.executeEnvelope with the code supplied at apply time.',
      ['sandbox.executeEnvelope'],
    );
    const snapshot = this.controlPlane.buildSnapshot();
    return {
      generatedAt: this.now().toISOString(),
      actionId: 'apply',
      status: 'applied',
      ok: true,
      summary: `Plan ${applied.id} approved for envelope execution.`,
      details: [
        'Raw code was not persisted in the plan; the caller must resend the input at the safe execution moment.',
        'ExecutionService ainda validara budget, rede none e filesystem temp-only.',
      ],
      snapshot,
      envelope: this.extractEnvelope(applied),
      mutationPlan: applied,
      trustDecision: null,
    };
  }

  private requiresPlan(envelope: ZavorthCapabilityRunEnvelope, profileCanRun: boolean): boolean {
    return !profileCanRun
      || envelope.status !== 'ready'
      || envelope.riskLevel === 'high'
      || envelope.riskLevel === 'critical'
      || envelope.networkPolicy === 'full-with-approval'
      || envelope.sandboxProfile === 'firecracker'
      || envelope.sandboxProfile === 'remote-node';
  }

  private buildReadinessGate(
    envelope: ZavorthCapabilityRunEnvelope,
    profile: ZavorthSandboxControlPlaneSnapshot['profiles'][number] | null,
    snapshot: ZavorthSandboxControlPlaneSnapshot,
  ): ZavorthReadinessGate {
    const blockers: string[] = [];
    const warnings: string[] = [];
    if (!profile?.canRun) {
      blockers.push(`Perfil ${envelope.sandboxProfile} unavailable: ${profile?.detail || 'runtime not configured'}.`);
    }
    if (envelope.networkPolicy !== 'none') {
      warnings.push(`Rede solicitada: ${envelope.networkPolicy}.`);
    }
    if (!snapshot.summary.untrustedExecutionReady && envelope.riskLevel !== 'low') {
      blockers.push('No strong sandbox is ready for untrusted code.');
    }
    const status: ZavorthReadinessGate['status'] =
      blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'passed';
    return {
      id: 'sandbox-runtime-readiness',
      status,
      canProceed: blockers.length === 0,
      scope: envelope.sandboxProfile,
      reasons: envelope.reasons,
      warnings,
      blockers,
      checkedAt: this.now().toISOString(),
      budgets: envelope.budget,
      evidence: snapshot.profiles.map((entry) => ({
        id: entry.id,
        label: entry.label,
        status: entry.status,
        summary: entry.detail,
        command: entry.recommendedAction,
      })),
      nextActions: snapshot.actions.map((entry) => entry.label),
    };
  }

  private buildRedactedPayload(
    input: ZavorthSandboxEnvelopeInput,
    envelope: ZavorthCapabilityRunEnvelope,
    snapshot: ZavorthSandboxControlPlaneSnapshot,
  ): Record<string, unknown> {
    const executable = String(input.code || input.command || '');
    return {
      envelope,
      executableRef: `sha256:${this.hash(executable)}`,
      executableKind: input.command ? 'command' : 'code',
      language: input.language || null,
      requestedProfile: input.preferredProfile || 'auto',
      selectedProfile: envelope.sandboxProfile,
      networkPolicy: envelope.networkPolicy,
      policy: snapshot.policy,
      budgets: envelope.budget,
      redaction: {
        rawExecutablePersisted: false,
        reason: 'code/command may contain secrets; the plan stores only hash and envelope.',
      },
    };
  }

  private extractEnvelope(plan: ZavorthMutationPlan): ZavorthCapabilityRunEnvelope | null {
    const envelope = plan.payload?.envelope;
    if (envelope && typeof envelope === 'object') {
      return envelope as ZavorthCapabilityRunEnvelope;
    }
    return null;
  }

  private resourceImpact(envelope: ZavorthCapabilityRunEnvelope): ZavorthResourceImpact {
    return {
      ramMb: envelope.budget.memoryMb,
      diskMb: envelope.budget.diskMb,
      processCount: envelope.budget.maxProcesses,
      externalExposure: this.externalExposure(envelope.networkPolicy),
      recurring: false,
      notes: [
        `cpu=${envelope.budget.cpuCores}`,
        `timeoutMs=${envelope.budget.maxDurationMs}`,
        `maxNetworkCalls=${envelope.budget.maxNetworkCalls}`,
        `profile=${envelope.sandboxProfile}`,
      ],
    };
  }

  private externalExposure(policy: ZavorthCapabilityRunEnvelope['networkPolicy']): ZavorthResourceImpact['externalExposure'] {
    if (policy === 'full-with-approval') {
      return 'public';
    }
    if (policy === 'allowlisted' || policy === 'internet-readonly') {
      return 'network';
    }
    return 'none';
  }

  private hash(value: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
