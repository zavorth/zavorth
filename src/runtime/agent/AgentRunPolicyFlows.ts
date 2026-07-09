import { AgentRunService, AgentRunExecutionOptions, normalizeText, recordOrNull } from './AgentRunService.js';
import { UniversalAgentRun, UniversalAgentRequest, UniversalAgentRunResult, UniversalAgentExecutorResult } from './UniversalAgentRuntimeTypes.js';
import { ToolRehearsalSnapshot } from './ToolRehearsalService.js';
import { AgentRunRiskReviewStage } from './security/AgentRunRiskHooks.js';
import { ZavorthLlmBrainSnapshot } from '../../contracts/ZavorthLlmBrainContract.js';
import { CoreDietBaselineDraft } from './AgentRunMetadataEvidenceHelpers.js';
import { UniversalIntentTrustEnforcementSnapshot } from './UniversalIntentTrustEnforcementService.js';
import { TrustSliderPolicyDecision } from '../uni/UniversalIntentContracts.js';
import { CapabilityNegotiationSnapshot } from './CapabilityNegotiationService.js';
export class AgentRunPolicyFlows {
  constructor(private service: AgentRunService) {}

  public applyTrustSliderReview(
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    const now = this.service.now().toISOString();
    const enforcement = this.applyUniversalIntentTrustEnforcement(run, input, now);
    const decision = enforcement.trustSlider;
    const metadata = this.service.serializeTrustSliderDecision(decision);
    run.metadata = {
      ...run.metadata,
      trustSlider: metadata,
      trustPosture: {
        source: 'TrustSliderPolicyService',
        trustMode: decision.level,
        permissionScope: decision.permissionScope,
        sandboxTier: decision.sandboxTier,
        permissionBoundary: decision.permissionBoundary,
        blocked: decision.blocked,
      },
    };
    run.events.push({
      id: this.service.idFactory('agent-event'),
      runId: run.id,
      kind: 'status',
      title: 'Trust Slider aplicado',
      detail: decision.reason,
      status: decision.blocked ? 'failed' : 'done',
      createdAt: now,
      metadata,
    });
    run.updatedAt = now;
    this.applyCapabilityLoopGovernance(run, input, decision);

    if (!decision.blocked) {
      return null;
    }

    run.status = 'failed';
    run.summary = `Trust Slider blocked execution in ${decision.level} mode.`;
    const narrative = this.applySafetyNarrative(run, now);
    return this.service.replyPipeline.buildResult({
      run,
      text: [
        'No tools were executed.',
        '',
        narrative.userMessage,
      ].join('\n'),
    });
  }


  public applyUniversalIntentTrustEnforcement(
    run: UniversalAgentRun,
    request?: UniversalAgentRequest | null,
    generatedAt: string = run.updatedAt || this.service.now().toISOString(),
  ): UniversalIntentTrustEnforcementSnapshot {
    const snapshot = this.service.universalIntentTrustEnforcement.buildSnapshot({
      run,
      request,
      generatedAt,
    });
    run.metadata = {
      ...run.metadata,
      universalIntent: snapshot.universalIntent,
      universalIntentTrustEnforcement: snapshot,
    };
    return snapshot;
  }


  public applyCapabilityLoopGovernance(
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
    trustSlider: TrustSliderPolicyDecision | null = null,
  ): void {
    const generatedAt = this.service.now().toISOString();
    const snapshot = this.service.capabilityLoopGovernance.buildSnapshot({
      run,
      request: input,
      trustSlider,
      generatedAt,
    });
    run.metadata = {
      ...run.metadata,
      capabilityLoopGovernance: snapshot,
      capabilityLoopStatus: {
        source: 'CapabilityLoopGovernanceService',
        requestedCapabilityIds: snapshot.requestedCapabilityIds,
        blockedCapabilityIds: snapshot.blockedCapabilityIds,
        degradedCapabilityIds: snapshot.degradedCapabilityIds,
        summary: snapshot.summary,
      },
    };
    run.events.push({
      id: this.service.idFactory('agent-event'),
      runId: run.id,
      kind: 'status',
      title: 'Capability loop governado',
      detail: snapshot.summary,
      status: snapshot.blockedCapabilityIds.length > 0 ? 'pending' : 'done',
      createdAt: generatedAt,
      metadata: {
        source: 'CapabilityLoopGovernanceService',
        requestedCapabilityIds: snapshot.requestedCapabilityIds,
        blockedCapabilityIds: snapshot.blockedCapabilityIds,
        degradedCapabilityIds: snapshot.degradedCapabilityIds,
      },
    });
    run.updatedAt = generatedAt;
    this.applyEvidenceSnapshotChainOnce(run, input, generatedAt);
  }


  public applySafetyNarrative(
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.service.now().toISOString(),
  ) {
    const narrative = this.service.safetyNarrative.buildSnapshot({
      run,
      generatedAt,
    });
    run.metadata = {
      ...run.metadata,
      safetyNarrative: narrative,
    };
    this.applyEvidenceSnapshotChainOnce(run, null, generatedAt);
    return narrative;
  }


  public applyEvidenceSnapshotChainOnce(
    run: UniversalAgentRun,
    input: UniversalAgentRequest | null,
    generatedAt: string,
  ): void {
    if (this.service.appliedEvidenceSnapshotChains.has(run)) {
      return;
    }

    this.service.appliedEvidenceSnapshotChains.add(run);
    this.service.evidencePipeline.applySecondary({
      run,
      request: input,
      generatedAt,
    });
  }


  public applyMemoryWithReceipts(
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.service.now().toISOString(),
  ) {
    const snapshot = this.service.memoryWithReceipts.buildSnapshot({
      run,
      generatedAt,
    });
    if (snapshot.receipts.length === 0 && !recordOrNull(run.metadata.memoryWithReceipts)) {
      return null;
    }
    run.metadata = {
      ...run.metadata,
      memoryWithReceipts: snapshot,
    };
    return snapshot;
  }


  public async applyAutomaticSkillInvocationIfNeeded(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): Promise<void> {
    if (!this.service.autoSkillInvocation) {
      return;
    }
    const existing = recordOrNull(run.metadata.autoSkillInvocation);
    if (existing && ['selected', 'blocked', 'failed'].includes(normalizeText(existing.status))) {
      return;
    }
    try {
      await this.service.autoSkillInvocation.apply({ run, request });
    } catch (error: unknown) {
      const generatedAt = this.service.now().toISOString();
      const reason = error instanceof Error ? error.message : String(error);
      run.metadata = {
        ...run.metadata,
        autoSkillInvocation: {
          contractVersion: 'agent-run-automatic-skill-invocation/1',
          source: 'AgentRunAutomaticSkillInvocationService',
          generatedAt,
          status: 'failed',
          selectedSkillName: null,
          supportSkillName: null,
          mode: 'dry-run',
          bridgeStatus: 'error',
          receiptIds: [],
          promptEnvelopeText: null,
          rawSecretsSerialized: false,
          reason,
          skillCount: 0,
        },
      };
      run.events.push({
        id: this.service.idFactory('agent-event'),
        runId: run.id,
        kind: 'planning',
        title: 'Skill auto-selected',
        detail: reason,
        status: 'pending',
        createdAt: generatedAt,
        metadata: {
          source: 'AgentRunAutomaticSkillInvocationService',
          contractVersion: 'agent-run-automatic-skill-invocation/1',
          status: 'failed',
          reason,
          rawSecretsSerialized: false,
        },
      });
    }
  }


  public applySkillMcpQuarantine(
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.service.now().toISOString(),
  ) {
    const snapshot = this.service.skillMcpQuarantine.buildSnapshot({
      run,
      generatedAt,
    });
    if (snapshot.summary.total === 0 && !recordOrNull(run.metadata.skillMcpQuarantine)) {
      return null;
    }
    run.metadata = {
      ...run.metadata,
      skillMcpQuarantine: snapshot,
    };
    return snapshot;
  }


  public applyCapabilityNegotiation(
    run: UniversalAgentRun,
    request?: UniversalAgentRequest,
    generatedAt: string = run.updatedAt || this.service.now().toISOString(),
  ): CapabilityNegotiationSnapshot | null {
    const existing = recordOrNull(run.metadata.capabilityNegotiation);
    const existingStatus = normalizeText(existing?.status);
    if (existingStatus === 'waiting-approval' || existingStatus === 'approved') {
      return existing as CapabilityNegotiationSnapshot;
    }
    if (request && this.service.shouldBypassCapabilityNegotiationForSpecializedFlow(run, request)) {
      return null;
    }

    const snapshot = this.service.capabilityNegotiation.buildSnapshot({
      run,
      request,
      generatedAt,
    });
    if (snapshot.status === 'not-needed' && !existing) {
      return null;
    }
    run.metadata = {
      ...run.metadata,
      capabilityNegotiation: snapshot,
    };
    return snapshot;
  }


  public markCapabilityNegotiationApprovedIfNeeded(
    run: UniversalAgentRun,
    approvedAt: string = run.updatedAt || this.service.now().toISOString(),
  ): void {
    const existing = recordOrNull(run.metadata.capabilityNegotiation);
    if (!existing || normalizeText(existing.status) !== 'waiting-approval') {
      return;
    }
    const approvalId = normalizeText(existing.approvalId)
      || normalizeText(recordOrNull(existing.proposal)?.approvalId);
    if (!approvalId || !run.approvals.some((approval) => approval.id === approvalId && approval.status === 'approved')) {
      return;
    }
    const scope = recordOrNull(existing.scope) || {};
    run.metadata = {
      ...run.metadata,
      capabilityNegotiation: {
        ...existing,
        status: 'approved',
        approved: true,
        approvedAt,
        scope: {
          ...scope,
          approved: true,
        },
        policy: {
          ...(recordOrNull(existing.policy) || {}),
          approvalsStillRequired: false,
        },
        nextSafeAction: 'Executar apenas dentro do escopo aprovado.',
      },
    };
  }


  public applyToolRehearsal(
    run: UniversalAgentRun,
    request?: UniversalAgentRequest,
    generatedAt: string = run.updatedAt || this.service.now().toISOString(),
  ): ToolRehearsalSnapshot | null {
    const existing = recordOrNull(run.metadata.toolRehearsal);
    const existingStatus = normalizeText(existing?.status);
    if (existingStatus === 'waiting-approval' || existingStatus === 'approved') {
      return existing as ToolRehearsalSnapshot;
    }

    const snapshot = this.service.toolRehearsal.buildSnapshot({
      run,
      request,
      generatedAt,
    });
    if (snapshot.status === 'not-needed' && !existing) {
      return null;
    }
    run.metadata = {
      ...run.metadata,
      toolRehearsal: snapshot,
    };
    return snapshot;
  }


  public markToolRehearsalApprovedIfNeeded(
    run: UniversalAgentRun,
    approvedAt: string = run.updatedAt || this.service.now().toISOString(),
  ): void {
    const existing = recordOrNull(run.metadata.toolRehearsal);
    if (!existing || normalizeText(existing.status) !== 'waiting-approval') {
      return;
    }
    const approvalId = normalizeText(existing.approvalId)
      || normalizeText(recordOrNull(existing.approval)?.approvalId);
    if (!approvalId || !run.approvals.some((approval) => approval.id === approvalId && approval.status === 'approved')) {
      return;
    }
    run.metadata = {
      ...run.metadata,
      toolRehearsal: {
        ...existing,
        status: 'approved',
        approved: true,
        approvedAt,
        approval: {
          ...(recordOrNull(existing.approval) || {}),
          required: false,
          approvalId,
        },
        policy: {
          ...(recordOrNull(existing.policy) || {}),
          approvalsStillRequired: false,
        },
        nextSafeAction: 'Executar somente as calls ensaiadas e aprovadas.',
      },
    };
  }


  public applyIntelligenceFabricCanary(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    options: AgentRunExecutionOptions = {},
  ): void {
    this.service.intelligenceFabricCanary.apply({
      run,
      request,
      canOrientModel: !options.executor && !this.service.executor && this.service.llmRuntimeExecutor.isAvailable(),
    });
  }


  public applyIntelligenceFabricDraftGuidanceIfRequested(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    const metadata = recordOrNull(request.metadata) || {};
    const planId = normalizeText(metadata.intelligenceFabricApplyDraftPlanId || metadata.intelligenceFabricDraftPlanId);
    const requested = Boolean(planId)
      && (metadata.intelligenceFabricApplyDraftGuidance === true || /\b(aplicar|aplique|apply|commit)\b.*\b(rascunho|draft)\b/i.test(request.text));
    if (!requested) {
      return null;
    }
    const result = this.service.intelligenceFabricCanary.applyDraftGuidancePlan({
      run,
      planId,
      permissionId: normalizeText(metadata.intelligenceFabricApprovalId),
      approvedBy: normalizeText(metadata.approvedBy) || request.userId,
      approveNow: metadata.intelligenceFabricApproveDraftPlan === true,
    });
    const now = this.service.now().toISOString();
    run.updatedAt = now;
    run.status = result.applied ? 'completed' : result.status === 'waiting_approval' ? 'waiting_approval' : 'failed';
    run.summary = result.summary;
    run.metadata = { ...run.metadata, intelligenceFabricDraftApply: result };
    run.events.push({
      id: this.service.idFactory('agent-event'),
      runId: run.id,
      kind: result.applied ? 'artifact' : 'approval',
      title: result.applied ? 'Rascunho aplicado pelo Mutation Plane' : 'Rascunho aguardando approval',
      detail: result.summary,
      status: result.applied ? 'done' : 'pending',
      createdAt: now,
      metadata: { planId: result.planId, status: result.status, approvalRequired: result.approvalRequired, diffReceipt: result.diffReceipt, diffReceiptText: result.diffReceiptText, rollbackArtifactPath: result.execution?.rollbackArtifactPath || null },
    });
    return this.service.replyPipeline.buildResult({ run, text: result.summary });
  }


  public applyDefenseReview(
    run: UniversalAgentRun,
    phase: AgentRunRiskReviewStage,
    metadataTarget: Record<string, unknown>,
    now: string = this.service.now().toISOString(),
  ): void {
    const review = this.service.riskHooks.review({ run, phase });
    const lifecycleDefense = recordOrNull(metadataTarget.lifecycleDefense) || {};
    metadataTarget.lifecycleDefense = {
      ...lifecycleDefense,
      [this.defenseReviewMetadataKey(phase)]: review,
    };
    run.events.push(this.service.auditHooks.buildRiskReviewEvent({
      run,
      review,
      now,
      idFactory: this.service.idFactory,
    }));
  }


  public defenseReviewMetadataKey(phase: AgentRunRiskReviewStage): string {
    if (phase === 'pre-executor') {
      return 'preExecutor';
    }
    if (phase === 'post-executor') {
      return 'postExecutor';
    }
    return phase;
  }


  public applyLlmBrainMaturity(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    executorResult: UniversalAgentExecutorResult,
  ): ZavorthLlmBrainSnapshot {
    const snapshot = this.service.llmBrain.buildRunSnapshot({
      run,
      request,
      executorResult,
    });
    run.metadata = {
      ...run.metadata,
      zavorthLlmBrain: snapshot,
    };
    run.events.push({
      id: this.service.idFactory('agent-event'),
      runId: run.id,
      kind: 'status',
      title: 'Model loop readiness',
      detail: snapshot.summary,
      status: snapshot.status === 'blocked' ? 'failed' : 'done',
      createdAt: snapshot.generatedAt,
      metadata: {
        contractVersion: snapshot.contractVersion,
        brainMode: snapshot.brainMode,
        visualStreamingReady: snapshot.streaming.visualStreamingReady,
        nativeToolLoopEnabled: snapshot.toolAgency.nativeToolLoopEnabled,
        llmRequestedTools: snapshot.toolAgency.llmRequestedTools,
        skillEvolutionStatus: snapshot.skillEvolution.status,
        requiresHumanLiveQa: snapshot.qa.requiresHumanLiveQa,
      },
    });
    return snapshot;
  }


}