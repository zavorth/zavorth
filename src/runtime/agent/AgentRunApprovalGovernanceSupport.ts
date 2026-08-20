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

import { ProviderEvaluationService } from './ProviderEvaluationService.js';
import { AgentSelfConfigService } from './AgentSelfConfigService.js';
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
import type { ZavorthIntelligencePipelineService, ZavorthIntelligenceFabricService } from '../../services/ZavorthIntelligencePipelineService.js';
import type { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import { CanonicalSessionContextAssembler, LightweightRunProfileClassifier } from './context/index.js';

import { AgentRunRiskHooks, type AgentRunRiskReviewStage } from './security/AgentRunRiskHooks.js';
import type { UniversalAgentExecutor, UniversalAgentExecutorResult, UniversalAgentRequest, UniversalAgentRun, UniversalAgentRunResult, UniversalAgentSteeringEntry, UniversalApprovalRequest } from './UniversalAgentRuntimeTypes.js';
import { asErrorLike } from '../../utils/errorLike.js';
import type { AgentRunExecutionOptions, AgentRunRuntimeEventBus, AgentRunRuntimeEventType, AgentRunService, AgentRunSteeringInput, SelfModificationRuntime, WatchModeRuntime } from './AgentRunService.js';
import { normalizeText, recordOrNull } from './AgentRunValueHelpers.js';

export class AgentRunApprovalGovernanceSupport {
  public constructor(private readonly owner: AgentRunService) {}

  public applyUniversalIntentTrustEnforcement(run: UniversalAgentRun, request?: UniversalAgentRequest | null, generatedAt: string = run.updatedAt || this.owner.now().toISOString()): UniversalIntentTrustEnforcementSnapshot {
    const snapshot = this.owner.universalIntentTrustEnforcement.buildSnapshot({
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

  public applyCapabilityLoopGovernance(run: UniversalAgentRun, input: UniversalAgentRequest, trustSlider: TrustSliderPolicyDecision | null = null): void {
    const generatedAt = this.owner.now().toISOString();
    const snapshot = this.owner.capabilityLoopGovernance.buildSnapshot({
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
      id: this.owner.idFactory('agent-event'),
      runId: run.id,
      kind: 'status',
      title: 'Governed capability loop',
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
    this.owner.applyEvidenceSnapshotChainOnce(run, input, generatedAt);
  }

  public applySafetyNarrative(run: UniversalAgentRun, generatedAt: string = run.updatedAt || this.owner.now().toISOString()) {
    const narrative = this.owner.safetyNarrative.buildSnapshot({
      run,
      generatedAt,
    });
    run.metadata = {
      ...run.metadata,
      safetyNarrative: narrative,
    };
    this.owner.applyEvidenceSnapshotChainOnce(run, null, generatedAt);
    return narrative;
  }

  public applyEvidenceSnapshotChainOnce(run: UniversalAgentRun, input: UniversalAgentRequest | null, generatedAt: string): void {
    if (this.owner.appliedEvidenceSnapshotChains.has(run)) {
      return;
    }

    this.owner.appliedEvidenceSnapshotChains.add(run);
    this.owner.evidencePipeline.applySecondary({
      run,
      request: input,
      generatedAt,
    });
  }

  public applyMemoryWithReceipts(run: UniversalAgentRun, generatedAt: string = run.updatedAt || this.owner.now().toISOString()) {
    const snapshot = this.owner.memoryWithReceipts.buildSnapshot({
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

  public async applyAutomaticSkillInvocationIfNeeded(run: UniversalAgentRun, request: UniversalAgentRequest): Promise<void> {
    if (!this.owner.autoSkillInvocation) {
      return;
    }
    const existing = recordOrNull(run.metadata.autoSkillInvocation);
    if (existing && ['selected', 'blocked', 'failed'].includes(normalizeText(existing.status))) {
      return;
    }
    try {
      await this.owner.autoSkillInvocation.apply({ run, request });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const generatedAt = this.owner.now().toISOString();
      const reason = error instanceof Error ? err.message : String(error);
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
        id: this.owner.idFactory('agent-event'),
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

  public applySkillMcpQuarantine(run: UniversalAgentRun, generatedAt: string = run.updatedAt || this.owner.now().toISOString()) {
    const snapshot = this.owner.skillMcpQuarantine.buildSnapshot({
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

  public applyCapabilityNegotiation(run: UniversalAgentRun, request?: UniversalAgentRequest, generatedAt: string = run.updatedAt || this.owner.now().toISOString()): CapabilityNegotiationSnapshot | null {
    const existing = recordOrNull(run.metadata.capabilityNegotiation);
    const existingStatus = normalizeText(existing?.status);
    if (existingStatus === 'waiting-approval' || existingStatus === 'approved') {
      return existing as CapabilityNegotiationSnapshot;
    }
    if (request && this.owner.shouldBypassCapabilityNegotiationForSpecializedFlow(run, request)) {
      return null;
    }

    const snapshot = this.owner.capabilityNegotiation.buildSnapshot({
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

  public markCapabilityNegotiationApprovedIfNeeded(run: UniversalAgentRun, approvedAt: string = run.updatedAt || this.owner.now().toISOString()): void {
    const existing = recordOrNull(run.metadata.capabilityNegotiation);
    if (!existing || normalizeText(existing.status) !== 'waiting-approval') {
      return;
    }
    const approvalId = normalizeText(existing.approvalId) || normalizeText(recordOrNull(existing.proposal)?.approvalId);
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
        nextSafeAction: 'Execute only inside the approved scope.',
      },
    };
  }

  public applyToolRehearsal(run: UniversalAgentRun, request?: UniversalAgentRequest, generatedAt: string = run.updatedAt || this.owner.now().toISOString()): ToolRehearsalSnapshot | null {
    const existing = recordOrNull(run.metadata.toolRehearsal);
    const existingStatus = normalizeText(existing?.status);
    if (existingStatus === 'waiting-approval' || existingStatus === 'approved') {
      return existing as ToolRehearsalSnapshot;
    }

    const snapshot = this.owner.toolRehearsal.buildSnapshot({
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

  public markToolRehearsalApprovedIfNeeded(run: UniversalAgentRun, approvedAt: string = run.updatedAt || this.owner.now().toISOString()): void {
    const existing = recordOrNull(run.metadata.toolRehearsal);
    if (!existing || normalizeText(existing.status) !== 'waiting-approval') {
      return;
    }
    const approvalId = normalizeText(existing.approvalId) || normalizeText(recordOrNull(existing.approval)?.approvalId);
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
        nextSafeAction: 'Execute only rehearsed and approved calls.',
      },
    };
  }
}
