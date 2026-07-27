import type { IntelligenceFabricSnapshot } from '../../contracts/native/IntelligenceFabricContract.js';
import type { ZavorthMutationPlan } from '../../contracts/ZavorthMutationPlaneContract.js';
import { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { renderIntelligenceFabricDiffReceipt } from './AgentRunIntelligenceFabricDiffReceiptRenderer.js';
import {
  AgentRunIntelligenceFabricDraftWorkspaceExecutor,
  buildDraftWorkspaceDiffReceipt,
  extractDraftWorkspacePatches,
  extractDraftWorkspaceWrites,
  planDraftWorkspacePatchesFromRun,
  planDraftWorkspaceWritesFromRun,
  previewDraftWorkspacePatches,
} from './AgentRunIntelligenceFabricDraftWorkspaceExecutor.js';
import type { AgentRunIntelligenceFabricDraftExecutionResult } from './AgentRunIntelligenceFabricDraftWorkspaceExecutor.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export type AgentRunIntelligenceFabricDraftGuidance = {
  source: 'IntelligenceFabricCanary';
  contractVersion: string;
  generatedAt: string;
  proposalId: string;
  summary: string;
  mode: 'draft-guidance';
  riskLevel: 3;
  proposedActions: Array<{
    id: string;
    kind: string;
    target: string;
    description: string;
    reversible: boolean;
    insideWorkspace: boolean;
    riskLevel: number;
  }>;
  dryRun: {
    prepared: true;
    patchPreparedInMemory: false;
    sideEffectsApplied: false;
    liveActionApplied: false;
    commitAllowed: false;
    applyRequiresRiskGate: true;
  };
  approval: {
    requiredBeforeApply: boolean;
    riskGateDecision: IntelligenceFabricSnapshot['riskGate']['overallDecision'];
    riskGateCanExecuteNow: boolean;
  };
  mutationPlan: {
    id: string;
    status: ZavorthMutationPlan['status'];
    approvalRequired: boolean;
    approvalStatus: ZavorthMutationPlan['approval']['status'];
    approvalReason: string;
    policyAllowExplicit: boolean;
    applyRequiresRequest: true;
  } | null;
  observability: {
    draftLatencyMs: number;
    planGenerated: boolean;
    planId: string | null;
    mutationPlaneStatus: ZavorthMutationPlan['status'] | 'missing';
    mutationPlaneApprovalStatus: ZavorthMutationPlan['approval']['status'] | 'missing';
    approvalPath: 'policy_allow_explicit' | 'approval_required';
    approvalReason: string;
    riskGateDecision: IntelligenceFabricSnapshot['riskGate']['overallDecision'];
    riskGateCanExecuteNow: boolean;
    applyState: 'not_requested';
    liveActionApplied: false;
  };
  rollbackPlan: string | null;
  testsToRun: string[];
  verifier: IntelligenceFabricSnapshot['verifier'];
  receipts: string[];
};

export type AgentRunIntelligenceFabricDraftApplyResult = {
  status: 'applied' | 'waiting_approval' | 'blocked' | 'missing_plan';
  planId: string | null;
  summary: string;
  applied: boolean;
  approvalRequired: boolean;
  plan: ZavorthMutationPlan | null;
  execution: AgentRunIntelligenceFabricDraftExecutionResult | null;
  diffReceipt: Record<string, unknown> | null;
  diffReceiptText: string | null;
};

export type AgentRunIntelligenceFabricDraftMutationRuntime = {
  now?: () => Date;
  mutationPlane?: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan' | 'approvePlan' | 'markApplied'> | null;
  workspaceExecutor?: Pick<AgentRunIntelligenceFabricDraftWorkspaceExecutor, 'executePlan'> | null;
};

export class AgentRunIntelligenceFabricDraftMutation {
  private readonly mutationPlane: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan' | 'approvePlan' | 'markApplied'>;
  private readonly workspaceExecutor: Pick<AgentRunIntelligenceFabricDraftWorkspaceExecutor, 'executePlan'>;
  private readonly now: () => Date;

  constructor(runtime: AgentRunIntelligenceFabricDraftMutationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.mutationPlane = runtime.mutationPlane || new ZavorthMutationPlaneService({ now: runtime.now });
    this.workspaceExecutor = runtime.workspaceExecutor || new AgentRunIntelligenceFabricDraftWorkspaceExecutor();
  }

  public attachDraftGuidance(input: {
    run: UniversalAgentRun;
    snapshot: IntelligenceFabricSnapshot;
  }): AgentRunIntelligenceFabricDraftGuidance {
    const startedAt = this.now().getTime();
    const { run, snapshot } = input;
    const approvalRequired = snapshot.riskGate.requiresApproval || !snapshot.riskGate.canExecuteNow;
    const policyAllowExplicit = !approvalRequired
      && snapshot.riskGate.overallDecision === 'allow'
      && snapshot.riskGate.canExecuteNow;
    const metadata = readRecord(run.metadata);
    const providedWrites = extractDraftWorkspaceWrites(metadata.intelligenceFabricDraftWorkspaceWrites);
    const providedPatches = extractDraftWorkspacePatches(metadata.intelligenceFabricDraftWorkspacePatches);
    const hasProvidedEdits = providedWrites.length > 0 || providedPatches.length > 0;
    const plannerWrites = hasProvidedEdits ? [] : planDraftWorkspaceWritesFromRun({ run });
    const plannerPatches = hasProvidedEdits ? [] : planDraftWorkspacePatchesFromRun({ run });
    const workspaceWrites = providedWrites.length > 0 ? providedWrites : plannerWrites;
    const workspacePatches = providedPatches.length > 0 ? providedPatches : plannerPatches;
    const patchPreview = previewDraftWorkspacePatches({
      workspaceRoot: run.workspace || null,
      patches: workspacePatches,
    });
    const diffReceipt = buildDraftWorkspaceDiffReceipt({
      id: `diff-receipt-${snapshot.executionProposal.id}`,
      workspaceWrites,
      workspacePatches,
      patchPreview,
      approvalRequired,
    });
    const mutationPlan = this.mutationPlane.createPlan({
      domain: 'capability',
      actionId: `intelligence-fabric-draft-${snapshot.executionProposal.id}`,
      title: 'Apply Intelligence Fabric draft',
      summary: snapshot.executionProposal.summary,
      requestedBy: run.userId,
      sourceSurface: run.channel,
      riskLevel: approvalRequired ? 'medium' : 'low',
      approvalRequired,
      approvalReason: approvalRequired ? 'Risk Gate requires approval before applying this draft.'
        : 'Explicit allow policy permits apply only after user request.',
      resourceImpact: {
        ramMb: 0,
        diskMb: 1,
        processCount: 0,
        externalExposure: 'none',
        recurring: false,
        notes: ['Draft guidance does not execute shell, network, or install; writes/patches remain pending until explicit apply.'],
      },
      validationPlan: snapshot.executionProposal.testsToRun,
      rollbackPlan: snapshot.executionProposal.rollbackPlan ? [snapshot.executionProposal.rollbackPlan] : [],
      payload: {
        source: 'IntelligenceFabricCanary',
        proposalId: snapshot.executionProposal.id,
        policyAllowExplicit,
        applyRequiresRiskGate: true,
        liveActionApplied: false,
        workspaceRoot: run.workspace || null,
        workspaceWrites,
        workspacePatches,
        workspacePatchPreview: patchPreview,
        workspacePatchVerifier: {
          status: patchPreview.status,
          summary: patchPreview.summary,
          ambiguous: patchPreview.ambiguous,
          sideEffectsApplied: false,
        },
        workspaceDiffReceipt: diffReceipt,
        workspaceWritesSource: providedWrites.length > 0 ? 'request-metadata' : plannerWrites.length > 0 ? 'fabric-draft-planner' : 'none',
        workspacePatchesSource: providedPatches.length > 0 ? 'request-metadata' : plannerPatches.length > 0 ? 'fabric-draft-planner' : 'none',
        proposedActions: snapshot.executionProposal.actions.map((action) => ({
          id: action.id,
          kind: action.kind,
          target: action.target,
          reversible: action.reversible,
          insideWorkspace: action.insideWorkspace,
          riskLevel: action.riskLevel,
        })),
      },
    });
    const observability = buildDraftObservability({
      startedAt,
      now: this.now,
      mutationPlan,
      policyAllowExplicit,
      riskGateDecision: snapshot.riskGate.overallDecision,
      riskGateCanExecuteNow: snapshot.riskGate.canExecuteNow,
    });
    this.appendDraftPreviewReceipt({
      run,
      generatedAt: snapshot.generatedAt,
      mutationPlanId: mutationPlan.id,
      approvalRequired,
      summary: snapshot.executionProposal.summary,
      diffReceipt,
      observability,
    });
    return {
      source: 'IntelligenceFabricCanary',
      contractVersion: snapshot.contractVersion,
      generatedAt: snapshot.generatedAt,
      proposalId: snapshot.executionProposal.id,
      summary: snapshot.executionProposal.summary,
      mode: 'draft-guidance',
      riskLevel: 3,
      proposedActions: snapshot.executionProposal.actions.slice(0, 12).map((action) => ({
        id: action.id,
        kind: action.kind,
        target: action.target,
        description: action.description,
        reversible: action.reversible,
        insideWorkspace: action.insideWorkspace,
        riskLevel: action.riskLevel,
      })),
      dryRun: {
        prepared: true,
        patchPreparedInMemory: false,
        sideEffectsApplied: false,
        liveActionApplied: false,
        commitAllowed: false,
        applyRequiresRiskGate: true,
      },
      approval: {
        requiredBeforeApply: approvalRequired,
        riskGateDecision: snapshot.riskGate.overallDecision,
        riskGateCanExecuteNow: snapshot.riskGate.canExecuteNow,
      },
      mutationPlan: {
        id: mutationPlan.id,
        status: mutationPlan.status,
        approvalRequired: mutationPlan.approval.required,
        approvalStatus: mutationPlan.approval.status,
        approvalReason: mutationPlan.approval.reason,
        policyAllowExplicit,
        applyRequiresRequest: true,
      },
      observability: {
        ...observability,
      },
      rollbackPlan: snapshot.executionProposal.rollbackPlan,
      testsToRun: snapshot.executionProposal.testsToRun.slice(0, 8),
      verifier: snapshot.verifier,
      receipts: [
        'risk-3-draft-guidance',
        'intelligence-fabric-risk3-draft-guidance',
        'workspace-diff-receipt-ready',
        'draft-guidance-no-live-action',
        ...snapshot.receipts.slice(0, 10),
      ],
    };
  }

  public applyDraftGuidancePlan(input: {
    run: UniversalAgentRun;
    planId: string;
    permissionId?: string | null;
    approvedBy?: string | null;
    approveNow?: boolean;
  }): AgentRunIntelligenceFabricDraftApplyResult {
    const planId = stringOrNull(input.planId);
    if (!planId) {
      return this.draftApplyResult('missing_plan', null, 'No mutation plan foi informado para aplicar o rascunho.', null);
    }
    let plan = this.mutationPlane.readPlan(planId);
    if (!plan) {
      return this.draftApplyResult('missing_plan', planId, `Mutation plan not found: ${planId}.`, null);
    }
    if (input.approveNow === true) {
      plan = this.mutationPlane.approvePlan(plan.id, {
        permissionId: input.permissionId,
        approvedBy: input.approvedBy || input.run.userId,
        scope: 'once',
      });
    }
    const payload = readRecord(plan.payload);
    const policyAllowExplicit = payload.policyAllowExplicit === true;
    const approvalSatisfied = plan.status === 'approved' || plan.approval.status === 'approved';
    const canApply = approvalSatisfied || (!plan.approval.required && policyAllowExplicit);
    if (!canApply) {
      return this.draftApplyResult(
        'waiting_approval',
        plan.id,
        `Mutation plan ${plan.id} still waits for approval before applying the draft.`,
        plan,
        null,
      );
    }
    const execution = this.workspaceExecutor.executePlan({ run: input.run, plan });
    if (!execution.ok) {
      return this.draftApplyResult('blocked', plan.id, execution.summary, plan, execution);
    }
    const applied = this.mutationPlane.markApplied(
      plan.id,
      `Draft guidance ${plan.actionId} applied by Mutation Plane without bypassing the Risk Gate. ${execution.summary}`,
      ['intelligence-fabric.draft-guidance.apply', ...execution.appliedActions],
    );
    return this.draftApplyResult('applied', applied.id, `Draft applied by the governed Mutation Plane. ${execution.summary}`, applied, execution);
  }

  public promoteWorkspaceWrites(input: {
    run: UniversalAgentRun;
    writes: unknown;
    patches?: unknown;
  }): AgentRunIntelligenceFabricDraftGuidance | null {
    const startedAt = this.now().getTime();
    const metadata = readRecord(input.run.metadata);
    const guidance = readRecord(metadata.intelligenceFabricDraftGuidance);
    if (guidance.mode !== 'draft-guidance' || Number(guidance.riskLevel || 0) !== 3) {
      return null;
    }
    const workspaceWrites = extractDraftWorkspaceWrites(input.writes);
    const workspacePatches = extractDraftWorkspacePatches(input.patches);
    if (workspaceWrites.length === 0 && workspacePatches.length === 0) {
      return null;
    }
    const patchPreview = previewDraftWorkspacePatches({
      workspaceRoot: input.run.workspace || null,
      patches: workspacePatches,
    });
    const approval = readRecord(guidance.approval);
    const policyAllowExplicit = approval.riskGateDecision === 'allow' && approval.riskGateCanExecuteNow === true;
    const approvalRequired = !policyAllowExplicit;
    const diffReceipt = buildDraftWorkspaceDiffReceipt({
      id: `diff-receipt-${stringOrNull(guidance.proposalId) || 'proposal'}-workspace-edits`,
      workspaceWrites,
      workspacePatches,
      patchPreview,
      approvalRequired,
    });
    const proposedActions = Array.isArray(guidance.proposedActions)
      ? guidance.proposedActions.map((entry) => readRecord(entry))
      : [];
    const mutationPlan = this.mutationPlane.createPlan({
      domain: 'capability',
      actionId: `intelligence-fabric-draft-${stringOrNull(guidance.proposalId) || 'proposal'}-workspace-writes`,
      title: 'Apply structured Intelligence Fabric edits',
      summary: stringOrNull(guidance.summary) || 'Apply structured draft in workspace.',
      requestedBy: input.run.userId,
      sourceSurface: input.run.channel,
      riskLevel: approvalRequired ? 'medium' : 'low',
      approvalRequired,
      approvalReason: approvalRequired ? 'Risk Gate requires approval before applying structured workspace writes.'
        : 'Explicit allow policy permits applying workspaceWrites only after user request.',
      resourceImpact: {
        ramMb: 0,
        diskMb: workspaceWrites.length + workspacePatches.length,
        processCount: 0,
        externalExposure: 'none',
        recurring: false,
        notes: ['workspaceWrites/workspacePatches were produced by the planner/LLM and remain pending until explicit apply.'],
      },
      validationPlan: Array.isArray(guidance.testsToRun) ? guidance.testsToRun.map((entry) => String(entry)).filter(Boolean) : [],
      rollbackPlan: stringOrNull(guidance.rollbackPlan) ? [String(guidance.rollbackPlan)] : [],
      payload: {
        source: 'IntelligenceFabricCanary',
        proposalId: stringOrNull(guidance.proposalId),
        policyAllowExplicit,
        applyRequiresRiskGate: true,
        liveActionApplied: false,
        workspaceRoot: input.run.workspace || null,
        workspaceWrites,
        workspacePatches,
        workspacePatchPreview: patchPreview,
        workspacePatchVerifier: {
          status: patchPreview.status,
          summary: patchPreview.summary,
          ambiguous: patchPreview.ambiguous,
          sideEffectsApplied: false,
        },
        workspaceDiffReceipt: diffReceipt,
        workspaceWritesSource: workspaceWrites.length > 0 ? 'planner-promotion' : 'none',
        workspacePatchesSource: workspacePatches.length > 0 ? 'planner-promotion' : 'none',
        proposedActions: proposedActions.map((action) => ({
          id: stringOrNull(action.id) || 'action-workspace-write',
          kind: stringOrNull(action.kind) || 'edit',
          target: stringOrNull(action.target) || input.run.workspace || 'workspace',
          reversible: action.reversible === true,
          insideWorkspace: action.insideWorkspace === true,
          riskLevel: Number(action.riskLevel || 3),
        })),
      },
    });
    const observability = buildDraftObservability({
      startedAt,
      now: this.now,
      mutationPlan,
      policyAllowExplicit,
      riskGateDecision: approval.riskGateDecision as IntelligenceFabricSnapshot['riskGate']['overallDecision'],
      riskGateCanExecuteNow: approval.riskGateCanExecuteNow === true,
    });
    this.appendDraftPreviewReceipt({
      run: input.run,
      generatedAt: new Date().toISOString(),
      mutationPlanId: mutationPlan.id,
      approvalRequired,
      summary: stringOrNull(guidance.summary) || 'Apply structured draft in workspace.',
      diffReceipt,
      observability,
    });
    return {
      ...(guidance as AgentRunIntelligenceFabricDraftGuidance),
      mutationPlan: {
        id: mutationPlan.id,
        status: mutationPlan.status,
        approvalRequired: mutationPlan.approval.required,
        approvalStatus: mutationPlan.approval.status,
        approvalReason: mutationPlan.approval.reason,
        policyAllowExplicit,
        applyRequiresRequest: true,
      },
      observability: {
        ...observability,
      },
      receipts: [
        ...arrayOfStrings(guidance.receipts),
        'workspace-writes-promoted-to-mutation-plan',
        'workspace-diff-receipt-ready',
        ...(workspacePatches.length > 0 ? ['workspace-patches-promoted-to-mutation-plan'] : []),
      ],
    };
  }

  private draftApplyResult(
    status: AgentRunIntelligenceFabricDraftApplyResult['status'],
    planId: string | null,
    summary: string,
    plan: ZavorthMutationPlan | null,
    execution: AgentRunIntelligenceFabricDraftExecutionResult | null = null,
  ): AgentRunIntelligenceFabricDraftApplyResult {
    const diffReceipt = readRecord(plan?.payload).workspaceDiffReceipt && typeof readRecord(plan?.payload).workspaceDiffReceipt === 'object'
      ? readRecord(plan?.payload).workspaceDiffReceipt as Record<string, unknown>
      : null;
    const diffReceiptText = renderIntelligenceFabricDiffReceipt(diffReceipt);
    return {
      status,
      planId,
      summary: diffReceiptText ? `${summary}\n\n${diffReceiptText}` : summary,
      applied: status === 'applied',
      approvalRequired: Boolean(plan?.approval.required),
      plan,
      execution,
      diffReceipt,
      diffReceiptText,
    };
  }

  private appendDraftPreviewReceipt(input: {
    run: UniversalAgentRun;
    generatedAt: string;
    mutationPlanId: string;
    approvalRequired: boolean;
    summary: string;
    diffReceipt: Record<string, unknown>;
    observability: AgentRunIntelligenceFabricDraftGuidance['observability'];
  }): void {
    const diffReceiptText = renderIntelligenceFabricDiffReceipt(input.diffReceipt);
    if (!diffReceiptText) {
      return;
    }
    const exists = input.run.events.some((event) => (
      readRecord(event.metadata).source === 'IntelligenceFabricDraftPreview'
      && stringOrNull(readRecord(event.metadata).planId) === input.mutationPlanId
    ));
    if (exists) {
      return;
    }
    input.run.events.push({
      id: `${input.run.id}:intelligence-fabric-draft-preview:${input.mutationPlanId}`,
      runId: input.run.id,
      kind: 'planning',
      title: 'Change preview prepared',
      detail: input.summary,
      status: 'pending',
      createdAt: input.generatedAt,
      metadata: {
        source: 'IntelligenceFabricDraftPreview',
        planId: input.mutationPlanId,
        status: 'draft',
        approvalRequired: input.approvalRequired,
        diffReceipt: input.diffReceipt,
        diffReceiptText,
        draftObservability: input.observability,
        mutationPlaneStatus: input.observability.mutationPlaneStatus,
        mutationPlaneApprovalStatus: input.observability.mutationPlaneApprovalStatus,
        approvalPath: input.observability.approvalPath,
        approvalReason: input.observability.approvalReason,
        riskGateDecision: input.observability.riskGateDecision,
        riskGateCanExecuteNow: input.observability.riskGateCanExecuteNow,
        draftLatencyMs: input.observability.draftLatencyMs,
        applyState: input.observability.applyState,
        rollbackArtifactPath: null,
      },
    });
  }
}

function buildDraftObservability(input: {
  startedAt: number;
  now: () => Date;
  mutationPlan: ZavorthMutationPlan;
  policyAllowExplicit: boolean;
  riskGateDecision: IntelligenceFabricSnapshot['riskGate']['overallDecision'];
  riskGateCanExecuteNow: boolean;
}): AgentRunIntelligenceFabricDraftGuidance['observability'] {
  return {
    draftLatencyMs: Math.max(0, input.now().getTime() - input.startedAt),
    planGenerated: true,
    planId: input.mutationPlan.id,
    mutationPlaneStatus: input.mutationPlan.status,
    mutationPlaneApprovalStatus: input.mutationPlan.approval.status,
    approvalPath: input.policyAllowExplicit ? 'policy_allow_explicit' : 'approval_required',
    approvalReason: input.mutationPlan.approval.reason,
    riskGateDecision: input.riskGateDecision,
    riskGateCanExecuteNow: input.riskGateCanExecuteNow,
    applyState: 'not_requested',
    liveActionApplied: false,
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringOrNull(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
}
