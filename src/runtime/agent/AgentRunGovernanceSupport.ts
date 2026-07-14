import { ReplyPipeline } from '../reply/ReplyPipeline.js';
import { GeminiManagedAgentExecutor } from '../../execution/GeminiManagedAgentExecutor.js';
import { resolveZavorthArtifactPolicyFromMetadata, shouldPersistZavorthArtifacts } from '../../contracts/ZavorthResponseDecisionContract.js';
import { DynamicHierarchySwarmService } from '../../domain/execution/infrastructure/DynamicHierarchySwarmService.js';
import { SwarmScalePlaneService } from '../../domain/execution/infrastructure/SwarmScalePlaneService.js';
import { AgentRunCanonicalContextService } from './AgentRunCanonicalContextService.js';
import { AgentRunSteeringStream, type AgentRunSteeringStreamAction } from './AgentRunSteeringStream.js';
import { applyAgentRunLlmRuntimeRouteReceipt } from './AgentRunLlmRouteReceipt.js';
import { AgentRunCorePipeline } from './AgentRunCorePipeline.js';
import { promoteIntelligenceFabricDraftWorkspaceWrites } from './AgentRunIntelligenceFabricDraftPromotion.js';
import { AgentRunEvidencePipeline, type AgentRunEvidenceCollectorId, type AgentRunEvidencePipelineStep, type AgentRunEvidenceWorker } from './AgentRunEvidencePipeline.js';
import { AgentRunEvidenceStore } from './AgentRunEvidenceStore.js';
import { FailureSemanticsRegistry } from './FailureSemanticsRegistry.js';
import { AgentRunFailureResultBuilder } from './AgentRunFailureResultBuilder.js';
import { CapabilityNegotiationService, type CapabilityNegotiationSnapshot } from './CapabilityNegotiationService.js';
import { ToolRehearsalService, type ToolRehearsalSnapshot } from './ToolRehearsalService.js';
import { MemoryWithReceiptsService } from './MemoryWithReceiptsService.js';
import { RunArtifactReceiptReplayService } from './RunArtifactReceiptReplayService.js';
import { AgentRunAuditHooks } from './security/AgentRunAuditHooks.js';
import { runPluginOsHook } from '../../services/PluginOsHookPipelineAccess.js';

import type { SelfModificationCommandService } from '../../services/SelfModificationCommandService.js';
import type { ComputerUseWatchModeService } from '../../services/ComputerUseWatchModeService.js';

import { AgentRunFactory, type AgentRunModelPickerContractService } from './AgentRunFactory.js';
import type { NaturalCapabilityDiscoveryService } from './NaturalCapabilityDiscoveryService.js';
import { NaturalFirstApprovalSafetyService } from './NaturalFirstApprovalSafetyService.js';
import { SafetyNarrativeService } from './SafetyNarrativeService.js';
import { NaturalFirstMemoryContinuityService } from './NaturalFirstMemoryContinuityService.js';
import type { UniversalPreviewModeService } from './UniversalPreviewModeService.js';
import { AgentRunLlmRuntimeExecutor, type UniversalAgentLlmRuntime } from './AgentRunLlmRuntimeExecutor.js';

import { AgentRunEchoHandsExecutor, type UniversalAgentToolRuntime } from './AgentRunEchoHandsExecutor.js';

import { AgentRunIntelligenceFabricCanary, type AgentRunIntelligenceFabricMode } from './AgentRunIntelligenceFabricCanary.js';

import { AgentRunExecutorBoundary } from './AgentRunExecutorBoundary.js';
import { AgentRunMetadataEvidenceHelpers, type CoreDietBaselineDraft } from './AgentRunMetadataEvidenceHelpers.js';

import { installAgentRunSpecializedFlows } from './AgentRunSpecializedFlows.js';
import { CapabilityLoopGovernanceService } from './CapabilityLoopGovernanceService.js';
import { TrustSliderPolicyService } from '../uni/TrustSliderPolicyService.js';
import type { TrustSliderPolicyDecision } from '../uni/UniversalIntentContracts.js';

import { ExecutionEscalationPolicy } from './ExecutionEscalationPolicy.js';

import { ProviderArenaService } from './ProviderArenaService.js';
import { SelfingZavorthControlService } from './SelfingZavorthControlService.js';
import { ArtifactMemoryService } from './ArtifactMemoryService.js';
import { ZavorthLlmBrainService } from '../../services/ZavorthLlmBrainService.js';
import type { ZavorthLlmBrainSnapshot } from '../../contracts/ZavorthLlmBrainContract.js';
import type { ZavorthNativeAutonomySpineService } from '../../services/ZavorthNativeAutonomySpineService.js';
import { SkillPromotionGate } from '../../services/SkillPromotionGate.js';
import { PersonalOpsAutopilotService } from './PersonalOpsAutopilotService.js';
import { AgentTeamCompilerService } from './AgentTeamCompilerService.js';
import { CrossChannelContinuityService } from './CrossChannelContinuityService.js';
import { AskBeforeAssumptionPolicyService } from './AskBeforeAssumptionPolicyService.js';
import { ProviderMeshConsolidationService } from './ProviderMeshConsolidationService.js';
import { UniversalIntentTrustEnforcementService, type UniversalIntentTrustEnforcementSnapshot } from './UniversalIntentTrustEnforcementService.js';

import { ProductizationEvidenceService } from './ProductizationEvidenceService.js';
import { ProductEntryRuntimeService } from './ProductEntryRuntimeService.js';
import { ReleaseInstallerRollbackPathService } from './ReleaseInstallerRollbackPathService.js';
import { PublicSiteDocsDemoSyncService } from './PublicSiteDocsDemoSyncService.js';
import { FeedbackTelemetryProductLoopService } from './FeedbackTelemetryProductLoopService.js';
import { PublicAdoptionPilotLoopService } from './PublicAdoptionPilotLoopService.js';
import { IntegrationShowcasePartnerSurfaceService } from './IntegrationShowcasePartnerSurfaceService.js';
import { ReleaseAdoptionReadinessService } from './ReleaseAdoptionReadinessService.js';
import { ReleaseCandidatePreCanaryGateService } from './ReleaseCandidatePreCanaryGateService.js';
import { BlueprintCompletionGateService } from './BlueprintCompletionGateService.js';
import { RunBudgetPolicy } from './RunBudgetPolicy.js';
import { AgentRunPolicyKernel } from './AgentRunPolicyKernel.js';
import { SkillMcpQuarantineService } from './SkillMcpQuarantineService.js';
import { AgentRunAutomaticSkillInvocationService } from './AgentRunAutomaticSkillInvocationService.js';
import { ToolExposurePolicy } from './ToolExposurePolicy.js';
import { executionContextScope } from '../context/ExecutionContextScope.js';
import type { ProfileRuntimeBundle } from '../../contracts/ProfileManifestContract.js';
import type { ProfileManifestService } from '../../services/ProfileManifestService.js';
import type { ZavorthIntelligenceFabricLearningService } from '../../services/ZavorthIntelligenceFabricLearningService.js';
import type { ZavorthIntelligenceFabricService } from '../../services/ZavorthIntelligenceFabricService.js';
import type { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { CanonicalSessionContextAssembler, LightweightRunProfileClassifier } from './context/index.js';

import { AgentRunRiskHooks, type AgentRunRiskReviewStage } from './security/AgentRunRiskHooks.js';
import type { UniversalAgentExecutor, UniversalAgentExecutorResult, UniversalAgentRequest, UniversalAgentRun, UniversalAgentRunResult, UniversalAgentSteeringEntry, UniversalApprovalRequest } from './UniversalAgentRuntimeTypes.js';
import { asErrorLike } from '../../utils/errorLike.js';
import type { AgentRunExecutionOptions, AgentRunRuntimeEventBus, AgentRunRuntimeEventType, AgentRunService, AgentRunSteeringInput, SelfModificationRuntime, WatchModeRuntime } from './AgentRunService.js';
import { normalizeText, recordOrNull } from './AgentRunValueHelpers.js';

export class AgentRunGovernanceSupport {
  public constructor(private readonly owner: AgentRunService) {}

  public createNaturalFirstMemoryContinuityIfNeeded(run: UniversalAgentRun, request: UniversalAgentRequest): UniversalAgentRunResult | null {
    if (!this.owner.naturalFirstMemoryContinuity.shouldHandle(run, request)) {
      return null;
    }
    const generatedAt = this.owner.now().toISOString();
    const memoryWithReceipts = this.owner.applyMemoryWithReceipts(run, generatedAt);
    return this.owner.naturalFirstMemoryContinuity.apply({
      run,
      request,
      generatedAt,
      memoryWithReceipts,
    });
  }

  public applyNaturalFirstApprovalSafety(run: UniversalAgentRun, request: UniversalAgentRequest): void {
    this.owner.naturalFirstApprovalSafety.record({
      run,
      request,
      generatedAt: this.owner.now().toISOString(),
    });
  }

  public createNaturalFirstApprovalFallbackIfNeeded(run: UniversalAgentRun, request: UniversalAgentRequest): UniversalAgentRunResult | null {
    const generatedAt = this.owner.now().toISOString();
    const snapshot = this.owner.naturalFirstApprovalSafety.record({
      run,
      request,
      generatedAt,
    });
    if (!this.owner.naturalFirstApprovalSafety.shouldOpenFallbackApproval(snapshot)) {
      return null;
    }
    return this.owner.naturalFirstApprovalSafety.openFallbackApproval({
      run,
      request,
      generatedAt,
      idFactory: this.owner.idFactory,
    });
  }

  public createAgenticManagedAgentPreviewIfNeeded(run: UniversalAgentRun): UniversalAgentRunResult | null {
    const agenticRoute = recordOrNull(run.metadata.agenticRoute);
    if (normalizeText(agenticRoute?.selectedRoute) !== 'remote-agent-preview') {
      return null;
    }
    const existingApprovalId = normalizeText(agenticRoute?.approvalId);
    const existingApproval = existingApprovalId ? run.approvals.find((approval) => approval.id === existingApprovalId) : null;
    if (existingApproval?.status === 'approved') {
      return null;
    }

    const now = this.owner.now().toISOString();
    const approval: UniversalApprovalRequest = existingApproval || {
      id: this.owner.idFactory('agent-approval'),
      runId: run.id,
      title: 'Approve isolated execution',
      reason: normalizeText(agenticRoute?.explanation, 'This request may need isolated analysis or execution; Zavorth needs approval before calling a remote agent.'),
      risk: 'danger',
      status: 'pending',
      createdAt: now,
    };
    if (!existingApproval) {
      run.approvals.push(approval);
    }
    run.status = 'waiting_approval';
    run.summary = 'Isolated execution is prepared. No remote agent was called without approval.';
    run.updatedAt = now;
    run.metadata = {
      ...run.metadata,
      agenticRoute: {
        ...agenticRoute,
        approvalId: approval.id,
        previewStatus: 'waiting-approval',
      },
    };
    run.events.push({
      id: this.owner.idFactory('agent-event'),
      runId: run.id,
      kind: 'approval',
      title: 'Isolated execution preview',
      detail: 'Zavorth prepared a governed remote call and paused until explicit approval.',
      status: 'pending',
      createdAt: now,
      metadata: {
        approvalId: approval.id,
        providerRoute: normalizeText(agenticRoute?.providerRoute, 'gemini-managed-agent'),
        noRemoteCallPerformed: true,
        store: false,
      },
    });

    return this.owner.replyPipeline.buildResult({
      run,
      text: [
        'I can use an isolated execution path for this request, but I need your approval first.',
        '',
        'What would happen:',
        '- governed call to a remote agent or sandbox;',
        '- server-side history stays off by default;',
        '- timeline and evidence are recorded in Zavorth;',
        '- execution stays auditable inside the approved scope.',
      ].join('\n'),
    });
  }

  public async resumeApprovedRun(run: UniversalAgentRun, request: UniversalAgentRequest, options: AgentRunExecutionOptions = {}): Promise<UniversalAgentRunResult> {
    run.status = 'running';
    run.summary = 'Approval received. Execution resumed safely.';
    run.updatedAt = this.owner.now().toISOString();
    run.events.push({
      id: this.owner.idFactory('agent-event'),
      runId: run.id,
      kind: 'status',
      title: 'Execution resumed',
      detail: 'The approval gate released the scoped execution path.',
      status: 'done',
      createdAt: run.updatedAt,
    });
    this.owner.markCapabilityNegotiationApprovedIfNeeded(run, run.updatedAt);
    this.owner.markToolRehearsalApprovedIfNeeded(run, run.updatedAt);
    this.owner.applyDefenseReview(run, 'resume', run.metadata, run.updatedAt);

    try {
      const swarmResult = await this.owner.executeApprovedSwarmProposalIfNeeded(run, request);
      if (swarmResult) {
        return swarmResult;
      }
    } catch (error: unknown) {
      return this.owner.buildFailureResult(run, error, 'swarm');
    }

    const selfModificationActionResult = this.owner.acknowledgeApprovedSelfModificationActionProposalIfNeeded(run, request);
    if (selfModificationActionResult) {
      return selfModificationActionResult;
    }

    try {
      const watchModeVisualResult = await this.owner.acknowledgeApprovedWatchModeVisualProposalIfNeeded(run, request);
      if (watchModeVisualResult) {
        return watchModeVisualResult;
      }
    } catch (error: unknown) {
      return this.owner.buildFailureResult(run, error, 'watch-mode');
    }

    this.owner.applyToolRehearsal(run, request, run.updatedAt);
    const toolRehearsalProposal = this.owner.createToolRehearsalProposalIfNeeded(run, request);
    if (toolRehearsalProposal) {
      return toolRehearsalProposal;
    }

    const agenticManagedAgentResult = await this.owner.executeApprovedAgenticManagedAgentIfNeeded(run, request);
    if (agenticManagedAgentResult) {
      return agenticManagedAgentResult;
    }

    await this.owner.applyAutomaticSkillInvocationIfNeeded(run, request);

    let executorResult: UniversalAgentExecutorResult;
    try {
      executorResult = await this.owner.execute(run, request, options);
    } catch (error: unknown) {
      return this.owner.buildFailureResult(run, error, 'executor');
    }
    this.owner.applyExecutorResult(run, executorResult);
    this.owner.applyCapabilityLoopGovernance(run, request);
    const replyText = normalizeText(executorResult.replyText, run.summary || 'Execution resumed safely.');
    await this.owner.publishAssistantReplyStream(run, replyText, {
      source: 'approval-resume',
      providerNativeTokenStreaming: false,
    });

    return this.owner.replyPipeline.buildResult({
      run,
      text: replyText,
    });
  }

  public applyTrustSliderReview(run: UniversalAgentRun, input: UniversalAgentRequest): UniversalAgentRunResult | null {
    const now = this.owner.now().toISOString();
    const enforcement = this.owner.applyUniversalIntentTrustEnforcement(run, input, now);
    const decision = enforcement.trustSlider;
    const metadata = this.owner.serializeTrustSliderDecision(decision);
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
      id: this.owner.idFactory('agent-event'),
      runId: run.id,
      kind: 'status',
      title: 'Trust Slider aplicado',
      detail: decision.reason,
      status: decision.blocked ? 'failed' : 'done',
      createdAt: now,
      metadata,
    });
    run.updatedAt = now;
    this.owner.applyCapabilityLoopGovernance(run, input, decision);

    if (!decision.blocked) {
      return null;
    }

    run.status = 'failed';
    run.summary = `Trust Slider blocked execution in ${decision.level} mode.`;
    const narrative = this.owner.applySafetyNarrative(run, now);
    return this.owner.replyPipeline.buildResult({
      run,
      text: ['No tools were executed.', '', narrative.userMessage].join('\n'),
    });
  }

  public async executeApprovedAgenticManagedAgentIfNeeded(run: UniversalAgentRun, request: UniversalAgentRequest): Promise<UniversalAgentRunResult | null> {
    const agenticRoute = recordOrNull(run.metadata.agenticRoute);
    if (normalizeText(agenticRoute?.selectedRoute) !== 'remote-agent-preview') {
      return null;
    }
    const approvalId = normalizeText(agenticRoute?.approvalId);
    const approval = run.approvals.find((entry) => entry.id === approvalId && entry.status === 'approved');
    if (!approval) {
      return null;
    }

    const executor = new GeminiManagedAgentExecutor();
    const execution = await executor.execute({
      execution_id: this.owner.idFactory('execution'),
      task_id: run.id,
      executor: 'gemini_managed_agent',
      workspace: normalizeText(request.workspace || run.workspace, 'workspace-not-declared'),
      objective: request.text,
      instructions: ['Execute somente a analise solicitada dentro da fronteira governada.', 'Do not try to persist secrets, credentials, or server-side history.', 'Retorne conclusao, evidencias e proximos passos seguros.'],
      allowed_paths: [],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: 120,
      dry_run: false,
      requires_backup: false,
      metadata: {
        approval_id: approval.id,
        approved: true,
        store: false,
        source_run_id: run.id,
        trace_id: run.traceId,
      },
    });
    const now = this.owner.now().toISOString();
    const success = execution.success === true;
    const replyText = normalizeText(execution.stdout, success ? 'Remote agent completed governed execution.' : normalizeText(execution.error_message, 'Remote agent did not complete execution.'));
    const executorResult: UniversalAgentExecutorResult = {
      status: success ? 'completed' : 'failed',
      summary: success ? 'Isolated execution completed by the governed remote agent.' : 'Isolated execution failed or was refused by the remote agent policy.',
      replyText,
      events: [
        {
          kind: success ? 'reply' : 'error',
          title: success ? 'Isolated execution completed' : 'Isolated execution unavailable',
          detail: replyText,
          status: success ? 'done' : 'failed',
          createdAt: now,
          metadata: {
            executor: execution.executor,
            executionId: execution.execution_id,
            errorCode: execution.error_code,
            actions: execution.actions_executed,
          },
        },
      ],
      metadata: {
        agenticManagedAgentExecution: {
          source: 'AgentRunService',
          providerRoute: normalizeText(agenticRoute?.providerRoute, 'gemini-managed-agent'),
          executionId: execution.execution_id,
          success,
          errorCode: execution.error_code,
          metadata: execution.metadata,
        },
      },
    };
    this.owner.applyExecutorResult(run, executorResult);
    this.owner.applyCapabilityLoopGovernance(run, request);
    await this.owner.publishAssistantReplyStream(run, replyText, {
      source: 'agentic-managed-agent',
      providerNativeTokenStreaming: false,
    });
    return this.owner.replyPipeline.buildResult({ run, text: replyText });
  }
}
