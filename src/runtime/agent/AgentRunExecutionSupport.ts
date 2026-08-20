import { ReplyPipeline } from '../reply/ReplyPipeline.js';
import { GeminiManagedAgentExecutor } from '../../execution/GeminiManagedAgentExecutor.js';
import {
  resolveZavorthArtifactPolicyFromMetadata,
  shouldPersistZavorthArtifacts,
} from '../../contracts/ZavorthResponseDecisionContract.js';
import { DynamicHierarchySwarmService } from '../../domain/execution/infrastructure/DynamicHierarchySwarmService.js';
import { SwarmScalePlaneService } from '../../domain/execution/infrastructure/SwarmScalePlaneService.js';
import { AgentRunCanonicalContextService } from './AgentRunCanonicalContextService.js';
import { AgentRunSteeringStream, type AgentRunSteeringStreamAction } from './AgentRunSteeringStream.js';
import { applyAgentRunLlmRuntimeRouteReceipt } from './AgentRunLlmRouteReceipt.js';
import { AgentRunCorePipeline } from './AgentRunCorePipeline.js';
import { promoteIntelligenceFabricDraftWorkspaceWrites } from './AgentRunIntelligenceFabricDraftPromotion.js';
import {
  AgentRunEvidencePipeline,
  type AgentRunEvidenceCollectorId,
  type AgentRunEvidencePipelineStep,
  type AgentRunEvidenceWorker,
} from './AgentRunEvidencePipeline.js';
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

import {
  AgentRunIntelligenceFabricCanary,
  type AgentRunIntelligenceFabricMode,
} from './AgentRunIntelligenceFabricCanary.js';

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
import {
  UniversalIntentTrustEnforcementService,
  type UniversalIntentTrustEnforcementSnapshot,
} from './UniversalIntentTrustEnforcementService.js';

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
import type {
  UniversalAgentExecutor,
  UniversalAgentExecutorResult,
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalAgentRunResult,
  UniversalAgentSteeringEntry,
  UniversalApprovalRequest,
} from './UniversalAgentRuntimeTypes.js';
import { asErrorLike } from '../../utils/errorLike.js';
import type {
  AgentRunExecutionOptions,
  AgentRunRuntimeEventBus,
  AgentRunRuntimeEventType,
  AgentRunService,
  AgentRunSteeringInput,
  SelfModificationRuntime,
  WatchModeRuntime,
} from './AgentRunService.js';
import { normalizeText, recordOrNull, resolveProfileRuntimeBundleFromRun } from './AgentRunValueHelpers.js';

export class AgentRunExecutionSupport {
  public constructor(private readonly owner: AgentRunService) {}

  public applyIntelligenceFabricCanary(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    options: AgentRunExecutionOptions = {},
  ): void {
    this.owner.intelligenceFabricCanary.apply({
      run,
      request,
      canOrientModel: !options.executor && !this.owner.executor && this.owner.llmRuntimeExecutor.isAvailable(),
    });
  }

  public applyIntelligenceFabricDraftGuidanceIfRequested(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    const metadata = recordOrNull(request.metadata) || {};
    const planId = normalizeText(metadata.intelligenceFabricApplyDraftPlanId || metadata.intelligenceFabricDraftPlanId);
    // Structured flag only — free-text "apply draft" never activates mutation plane.
    const requested = Boolean(planId) && metadata.intelligenceFabricApplyDraftGuidance === true;
    if (!requested) {
      return null;
    }
    const result = this.owner.intelligenceFabricCanary.applyDraftGuidancePlan({
      run,
      planId,
      permissionId: normalizeText(metadata.intelligenceFabricApprovalId),
      approvedBy: normalizeText(metadata.approvedBy) || request.userId,
      approveNow: metadata.intelligenceFabricApproveDraftPlan === true,
    });
    const now = this.owner.now().toISOString();
    run.updatedAt = now;
    run.status = result.applied ? 'completed' : result.status === 'waiting_approval' ? 'waiting_approval' : 'failed';
    run.summary = result.summary;
    run.metadata = { ...run.metadata, intelligenceFabricDraftApply: result };
    run.events.push({
      id: this.owner.idFactory('agent-event'),
      runId: run.id,
      kind: result.applied ? 'artifact' : 'approval',
      title: result.applied ? 'Draft applied by the Mutation Plane' : 'Draft waiting for approval',
      detail: result.summary,
      status: result.applied ? 'done' : 'pending',
      createdAt: now,
      metadata: {
        planId: result.planId,
        status: result.status,
        approvalRequired: result.approvalRequired,
        diffReceipt: result.diffReceipt,
        diffReceiptText: result.diffReceiptText,
        rollbackArtifactPath: result.execution?.rollbackArtifactPath || null,
      },
    });
    return this.owner.replyPipeline.buildResult({ run, text: result.summary });
  }

  public async execute(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    options: AgentRunExecutionOptions = {},
  ): Promise<UniversalAgentExecutorResult> {
    const profileBundle = resolveProfileRuntimeBundleFromRun(run);
    // Propagate voice/client abort into run metadata for LLM executor (in-process only)
    if (options.signal) {
      run.metadata = {
        ...run.metadata,
        voiceAbortSignal: options.signal,
        duplexSessionId: run.metadata?.duplexSessionId || request.metadata?.duplexSessionId || null,
      };
    }
    if (options.signal?.aborted) {
      throw Object.assign(new Error('Voice turn aborted (barge-in).'), { name: 'AbortError' });
    }
    return executionContextScope.run(
      {
        traceId: run.traceId,
        runId: run.id,
        sessionId: run.sessionId,
        surface: run.channel,
        requestedBy: run.userId,
        profile: normalizeText(run.metadata.profile, profileBundle?.id || ''),
        workspace: run.workspace || request.workspace || null,
        profileBundle,
        metadata: run.metadata,
      },
      () =>
        this.owner.executorBoundary.execute({
          run,
          request,
          executorOverride: options.executor,
          toolRuntimeOverride: options.toolRuntime,
        }),
    );
  }

  public async applyNativeAutonomySpine(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    replyText: string,
  ): Promise<void> {
    const generatedAt = this.owner.now().toISOString();
    if (this.owner.nativeAutonomySpine) {
      try {
        const toolReceipts = run.events
          .filter((event) => event.kind === 'tool')
          .map((event) => ({
            id: event.id,
            kind: normalizeText(event.metadata?.toolId, event.title),
            status: event.status,
            summary: normalizeText(event.detail, event.title),
          }));
        const snapshot = await this.owner.nativeAutonomySpine.buildSnapshot({
          turn: {
            turnId: run.id,
            sessionId: run.sessionId,
            userId: run.userId,
            outcome: run.status === 'completed' ? 'success' : run.status === 'failed' ? 'failure' : 'interrupted',
            userMessage: request.text,
            assistantResponse: replyText,
            toolReceipts,
            toolCallCount: Math.max(toolReceipts.length, request.requestedTools?.length || 0),
            sourceSurface: run.channel,
            recallQuery: normalizeText(request.metadata?.recallQuery) || null,
          },
        });
        run.metadata = {
          ...run.metadata,
          nativeAutonomySpine: snapshot,
        };
        run.events.push({
          id: this.owner.idFactory('agent-event'),
          runId: run.id,
          kind: 'memory',
          title: 'Native autonomy spine reviewed turn',
          detail: `Learning=${snapshot.summary.organicLearningReady}; skillForge=${snapshot.summary.skillForgeReady}.`,
          status: snapshot.status === 'blocked' ? 'failed' : 'done',
          createdAt: generatedAt,
          metadata: {
            source: 'ZavorthNativeAutonomySpineService',
            version: snapshot.version,
            status: snapshot.status,
            rawSecretsSerialized: snapshot.safety.rawSecretsSerialized,
          },
        });
      } catch (error: unknown) {
        const err = asErrorLike(error);
        run.metadata = {
          ...run.metadata,
          nativeAutonomySpine: {
            status: 'attention',
            error: err.message,
          },
        };
      }
    }
    try {
      const { getProductSurfaceRuntime } =
        require('../../services/ZavorthProductSurfaceRuntimeService.js') as typeof import('../../services/ZavorthProductSurfaceRuntimeService.js');
      const toolCallCount = Math.max(
        run.events.filter((event) => event.kind === 'tool').length,
        request.requestedTools?.length || 0,
      );
      const userId = run.userId || request.userId || 'local-user';
      const surface = run.channel || request.channel || 'agent-run';
      const chatId =
        normalizeText(run.metadata?.chatId, normalizeText(request.metadata?.chatId, run.sessionId)) || null;
      const explicitAllow = run.metadata?.allowLearningWrite ?? request.metadata?.allowLearningWrite;
      const result = await getProductSurfaceRuntime(process.cwd()).recordSuccessfulTurn({
        userId,
        surface,
        userMessage: request.text,
        assistantText: replyText,
        toolCallCount,
        turnId: run.id,
        sessionId: run.sessionId,
        chatId,
        allowLearningWrite: typeof explicitAllow === 'boolean' ? explicitAllow : null,
      });

      run.metadata = {
        ...run.metadata,
        productSurfaceLearning: result,
      };

      const writeDetail =
        result.appliedPreferences > 0 || result.draftedSkills > 0
          ? `Learning wrote ${result.appliedPreferences} preference(s) and ${result.draftedSkills} skill draft(s) for user ${userId}; skill-library install remains blocked.`
          : 'Turn-end learning projected; durable writes require autonomous learning mode.';
      run.events.push({
        id: this.owner.idFactory('agent-event'),
        runId: run.id,
        kind: 'memory',
        title: 'Product surface learning reviewed turn',
        detail: writeDetail,
        status: 'done',
        createdAt: generatedAt,
        metadata: {
          source: 'ZavorthProductSurfaceRuntimeService',
          status: result.ok ? 'ready' : 'attention',
          learningMode: result.mode || 'governed',
          appliedPreferences: result.appliedPreferences,
          draftedSkills: result.draftedSkills,
          userId,
        },
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      run.metadata = {
        ...run.metadata,
        productSurfaceLearning: {
          ok: false,
          error: error instanceof Error ? err.message : String(error),
        },
      };
    }
  }

  public applyExecutorResult(run: UniversalAgentRun, result: UniversalAgentExecutorResult): void {
    const now = this.owner.now().toISOString();
    run.status = result.status || 'completed';
    run.summary = normalizeText(result.summary, run.summary);
    run.updatedAt = now;
    this.owner.markAcceptedSteeringApplied(run, now);
    const mergedMetadata = {
      ...run.metadata,
      ...(result.metadata || {}),
    };
    const resultArtifacts = Array.isArray(result.artifacts) ? result.artifacts : null;
    if (resultArtifacts) {
      if (shouldPersistZavorthArtifacts(mergedMetadata)) {
        run.artifacts = resultArtifacts;
      } else {
        const policy = resolveZavorthArtifactPolicyFromMetadata(mergedMetadata);
        run.artifacts = [];
        mergedMetadata.artifactPolicySuppressed = {
          count: resultArtifacts.length,
          reason: policy?.reason || 'artifact-policy-disabled',
        };
      }
    }
    applyAgentRunLlmRuntimeRouteReceipt({
      run,
      mergedMetadata,
      now,
      idFactory: this.owner.idFactory,
    });
    run.memorySignals = result.memorySignals || run.memorySignals;
    run.metadata = mergedMetadata;
    promoteIntelligenceFabricDraftWorkspaceWrites({
      run,
      canary: this.owner.intelligenceFabricCanary,
      now,
      idFactory: this.owner.idFactory,
    });
    this.owner.evidencePipeline.applyPostExecutor({
      run,
      request: null,
      generatedAt: now,
    });
    (result.events || []).forEach((event) => {
      run.events.push({
        id: event.id || this.owner.idFactory('agent-event'),
        runId: run.id,
        kind: event.kind,
        title: event.title,
        detail: event.detail,
        status: event.status,
        createdAt: event.createdAt || now,
        metadata: event.metadata,
      });
    });
    this.owner.applyDefenseReview(run, 'post-executor', run.metadata, now);
    this.owner.evidencePipeline.applySecondary({
      run,
      request: null,
      generatedAt: now,
    });
    this.owner.syncRunSteeringMetadata(run);
  }

  public markAcceptedSteeringApplied(run: UniversalAgentRun, now: string): void {
    const accepted = (run.steering || []).filter((entry) => entry.status === 'accepted');
    if (accepted.length === 0) return;
    for (const entry of accepted) {
      entry.status = 'applied';
      entry.updatedAt = now;
      run.events.push({
        id: `${entry.id}:applied`,
        runId: run.id,
        kind: 'steering',
        title: 'Steering applied',
        detail: entry.text,
        status: 'done',
        createdAt: now,
        metadata: {
          steeringId: entry.id,
          ackId: entry.ackId,
          nativeAgentRunSteering: true,
        },
      });
      this.owner.publishSteeringFrame(run, entry, 'applied');
    }
  }

  public applyLlmBrainMaturity(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    executorResult: UniversalAgentExecutorResult,
  ): ZavorthLlmBrainSnapshot {
    const snapshot = this.owner.llmBrain.buildRunSnapshot({
      run,
      request,
      executorResult,
    });
    run.metadata = {
      ...run.metadata,
      zavorthLlmBrain: snapshot,
    };
    run.events.push({
      id: this.owner.idFactory('agent-event'),
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

  public async publishLlmBrainRuntimeEvents(
    run: UniversalAgentRun,
    snapshot: ZavorthLlmBrainSnapshot,
    request?: UniversalAgentRequest,
  ): Promise<void> {
    await this.owner.publishRuntimeEvent(run, 'agent.stream.lifecycle', {
      brainMode: snapshot.brainMode,
      streamEvents: snapshot.streaming.events.length,
      visualStreamingReady: snapshot.streaming.visualStreamingReady,
      status: snapshot.status,
    });
    if (snapshot.toolAgency.requested > 0) {
      await this.owner.publishRuntimeEvent(run, 'agent.stream.tool', {
        requested: snapshot.toolAgency.requested,
        executed: snapshot.toolAgency.executed,
        denied: snapshot.toolAgency.denied,
        deferred: snapshot.toolAgency.sideEffectsDeferred,
      });
    }
    if (snapshot.streaming.events.some((event) => event.kind === 'assistant')) {
      await this.owner.publishRuntimeEvent(run, 'agent.stream.assistant', {
        replyEvents: snapshot.streaming.events.filter((event) => event.kind === 'assistant').length,
        rawChainOfThoughtExposed: false,
      });
    }
    if (snapshot.skillEvolution.status === 'candidate-ready') {
      const materializeSource =
        normalizeText(request?.text) || normalizeText(run.input) || normalizeText(run.summary) || run.id;
      let candidateId: string | null = null;
      let registryPersisted = false;
      if (this.owner.skillPromotionGate) {
        try {
          const materialized = this.owner.skillPromotionGate.materializeCandidate({
            intentText: materializeSource,
            candidateKind: snapshot.skillEvolution.candidateKind,
            runId: run.id,
            sessionId: run.sessionId || null,
            requestedBy: run.userId || null,
            sourceSurface: String(run.channel || 'agent-run'),
            approvalRequired: snapshot.skillEvolution.approvalRequired,
            suggestedCommand: snapshot.skillEvolution.suggestedCommand,
          });
          candidateId = materialized.candidateId;
          registryPersisted = Boolean(materialized.record);
          run.metadata = {
            ...run.metadata,
            skillEvolutionCandidate: {
              candidateId,
              status: materialized.status,
              registryPersisted,
              silentInstallBlocked: true,
              receiptId: materialized.continuity.receipt?.receiptId || null,
            },
          };
        } catch {
          registryPersisted = false;
        }
      }
      if (this.owner.skillPromotionGate && this.owner.isComplexSkillPromotionRun(run, snapshot)) {
        try {
          const dryPreview = await this.owner.skillPromotionGate.dryPreviewFromIntent({
            intentText: materializeSource,
            requestedBy: run.userId || null,
            sourceSurface: 'agent-run:complex-task',
            procedureOnly: true,
          });
          run.metadata = {
            ...run.metadata,
            skillPromotionDryPreview: {
              candidateId: dryPreview.candidateId,
              status: dryPreview.status,
              summary: dryPreview.summary,
              installed: false,
              silentInstallBlocked: true,
            },
          };
        } catch {
          // Dry preview is optional and must never fail the agent run.
        }
      }
      await this.owner.publishRuntimeEvent(run, 'agent.skill.evolution.candidate', {
        candidateKind: snapshot.skillEvolution.candidateKind,
        approvalRequired: snapshot.skillEvolution.approvalRequired,
        suggestedCommand: snapshot.skillEvolution.suggestedCommand,
        candidateId,
        registryPersisted,
        silentInstallBlocked: true,
      });
    }
    if (snapshot.qa.requiresHumanLiveQa) {
      await this.owner.publishRuntimeEvent(run, 'agent.adapter.proof.required', {
        channel: snapshot.adapterCoverage.channel,
        provider: snapshot.adapterCoverage.provider,
        route: snapshot.adapterCoverage.route,
        longTailFamilies: snapshot.adapterCoverage.longTailFamilies,
      });
    }
  }

  public isComplexSkillPromotionRun(run: UniversalAgentRun, snapshot: ZavorthLlmBrainSnapshot): boolean {
    const toolEvents = run.events.filter((event) => event.kind === 'tool').length;
    const textLength = normalizeText(run.input).length + normalizeText(run.summary).length;
    return (
      snapshot.toolAgency.executed >= 2 ||
      snapshot.toolAgency.requested >= 3 ||
      toolEvents >= 2 ||
      textLength >= 240 ||
      run.artifacts.length >= 2
    );
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

  public applyDefenseReview(
    run: UniversalAgentRun,
    phase: AgentRunRiskReviewStage,
    metadataTarget: Record<string, unknown>,
    now: string = this.owner.now().toISOString(),
  ): void {
    const review = this.owner.riskHooks.review({ run, phase });
    const lifecycleDefense = recordOrNull(metadataTarget.lifecycleDefense) || {};
    metadataTarget.lifecycleDefense = {
      ...lifecycleDefense,
      [this.owner.defenseReviewMetadataKey(phase)]: review,
    };
    run.events.push(
      this.owner.auditHooks.buildRiskReviewEvent({
        run,
        review,
        now,
        idFactory: this.owner.idFactory,
      }),
    );
  }

  public buildFailureResult(run: UniversalAgentRun, error: unknown, source: string): UniversalAgentRunResult {
    return this.owner.failureResultBuilder.build(run, error, source);
  }
}
