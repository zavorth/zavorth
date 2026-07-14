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

export class AgentRunRuntimeEventSupport {
  public constructor(private readonly owner: AgentRunService) {}

  public async publishRuntimeEvent(run: UniversalAgentRun, type: AgentRunRuntimeEventType, payload: Record<string, unknown> = {}): Promise<void> {
    const eventBuses = this.owner.getRuntimeEventBuses();
    const receipt = {
      type,
      emittedAt: this.owner.now().toISOString(),
      runId: run.id,
      status: run.status,
    };
    this.owner.appendRuntimeEventReceipt(run, {
      ...receipt,
      delivery: eventBuses.length > 0 ? 'pending' : 'not-configured',
    });
    if (eventBuses.length === 0) {
      return;
    }

    const runtimePayload = {
      ...payload,
      runId: run.id,
      traceId: run.traceId,
      requestId: run.requestId,
      sessionId: run.sessionId,
      userId: run.userId,
      channel: run.channel,
      status: run.status,
      surfaceChatId: this.owner.resolveRuntimeEventSurfaceChatId(run),
      surfaceThreadId: this.owner.resolveRuntimeEventMetadataText(run, 'threadId'),
      surfaceTaskId: this.owner.resolveRuntimeEventMetadataText(run, 'taskId'),
    };
    let delivered = 0;
    const errors: string[] = [];
    try {
      for (const eventBus of eventBuses) {
        try {
          await eventBus.emit(type, runtimePayload);
          delivered += 1;
        } catch (error: unknown) {
          const err = asErrorLike(error);
          errors.push(error instanceof Error ? err.message : String(error));
        }
      }
      if (delivered === 0 && errors.length > 0) {
        throw new Error(errors.join('; '));
      }
      this.owner.appendRuntimeEventReceipt(run, {
        ...receipt,
        delivery: errors.length > 0 ? 'partial' : 'delivered',
        delivered,
        failed: errors.length,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.owner.appendRuntimeEventReceipt(run, {
        ...receipt,
        delivery: 'failed',
        error: error instanceof Error ? err.message : String(error),
      });
    }
  }

  public async publishAssistantReplyStream(run: UniversalAgentRun, text: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const replyText = normalizeText(text);
    if (!replyText) {
      return;
    }
    const chunks = this.owner.chunkAssistantStreamText(replyText);
    const streamId = `${run.id}:assistant`;
    await this.owner.publishRuntimeEvent(run, 'agent.stream.assistant', {
      ...metadata,
      streamId,
      phase: 'start',
      done: false,
      chunkIndex: 0,
      totalChunks: chunks.length,
      accumulated: '',
      delta: '',
      rawChainOfThoughtExposed: false,
    });

    let accumulated = '';
    for (let index = 0; index < chunks.length; index += 1) {
      accumulated += chunks[index];
      await this.owner.publishRuntimeEvent(run, 'agent.stream.assistant', {
        ...metadata,
        streamId,
        phase: 'delta',
        done: false,
        chunkIndex: index + 1,
        totalChunks: chunks.length,
        accumulated,
        delta: chunks[index],
        rawChainOfThoughtExposed: false,
      });
    }

    await this.owner.publishRuntimeEvent(run, 'agent.stream.assistant', {
      ...metadata,
      streamId,
      phase: 'done',
      done: true,
      chunkIndex: chunks.length,
      totalChunks: chunks.length,
      accumulated,
      delta: '',
      rawChainOfThoughtExposed: false,
    });
  }

  public async publishAssistantReplyStreamDone(run: UniversalAgentRun, text: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const replyText = normalizeText(text);
    if (!replyText) {
      return;
    }
    await this.owner.publishRuntimeEvent(run, 'agent.stream.assistant', {
      ...metadata,
      streamId: `${run.id}:assistant`,
      phase: 'done',
      done: true,
      chunkIndex: 0,
      totalChunks: null,
      accumulated: replyText,
      delta: '',
      rawChainOfThoughtExposed: false,
    });
  }

  public chunkAssistantStreamText(text: string): string[] {
    const normalized = String(text || '');
    const maxChars = 180;
    const chunks: string[] = [];
    let current = '';
    for (const token of normalized.split(/(\s+)/)) {
      if (!token) continue;
      if (current && current.length + token.length > maxChars) {
        chunks.push(current);
        current = token;
        continue;
      }
      current += token;
    }
    if (current) {
      chunks.push(current);
    }
    return chunks.length > 0 ? chunks : [normalized];
  }

  public appendRuntimeEventReceipt(run: UniversalAgentRun, receipt: Record<string, unknown>): void {
    const existing = recordOrNull(run.metadata.runtimeEventBus);
    const events = Array.isArray(existing?.events) ? existing.events.slice(-19) : [];
    run.metadata = {
      ...run.metadata,
      runtimeEventBus: {
        source: 'AgentRunService',
        stage: 2,
        gate: 'source-agent-runtime-bridge',
        configured: this.owner.getRuntimeEventBuses().length > 0,
        subscriberCount: this.owner.getRuntimeEventBuses().length,
        snapshot: this.owner.readRuntimeEventBusSnapshot(),
        events: [...events, receipt],
      },
    };
  }

  public getRuntimeEventBuses(): AgentRunRuntimeEventBus[] {
    return [this.owner.runtimeEventBus, ...this.owner.runtimeEventBusSubscribers].filter((eventBus): eventBus is AgentRunRuntimeEventBus => Boolean(eventBus));
  }

  public readRuntimeEventBusSnapshot(): unknown {
    return this.owner.getRuntimeEventBuses().map((eventBus, index) => {
      if (!eventBus.snapshot) {
        return { index, snapshot: null };
      }
      try {
        return { index, snapshot: eventBus.snapshot() };
      } catch (error: unknown) {
        return { index, snapshot: null };
      }
    });
  }

  public resolveRuntimeEventSurfaceChatId(run: UniversalAgentRun): string | null {
    return this.owner.resolveRuntimeEventMetadataText(run, 'chatId') || this.owner.resolveRuntimeEventMetadataText(run, 'surfaceChatId') || run.sessionId || null;
  }

  public resolveRuntimeEventMetadataText(run: UniversalAgentRun, key: string): string | null {
    const metadata = recordOrNull(run.metadata);
    const text = String(metadata?.[key] ?? '').trim();
    return text || null;
  }

  public applyCachedEvidenceSnapshot<TSnapshot extends Record<string, unknown>>(run: UniversalAgentRun, key: string, buildSnapshot: () => TSnapshot, attachSnapshot: (snapshot: TSnapshot) => void): TSnapshot {
    const fingerprint = this.owner.metadataEvidenceHelpers.buildEvidenceSnapshotFingerprint(run);
    const existing = recordOrNull(run.metadata[key]);
    if (this.owner.metadataEvidenceHelpers.readEvidenceSnapshotFingerprint(run, key) === fingerprint) {
      const cached = existing || this.owner.metadataEvidenceHelpers.readCachedEvidenceSnapshot(run, key);
      if (cached) {
        this.owner.metadataEvidenceHelpers.recordCoreDietSnapshot(run, key, 'cache-hit');
        return cached as TSnapshot;
      }
    }

    const snapshot = buildSnapshot();
    const material = existing || this.owner.metadataEvidenceHelpers.isMaterialEvidenceSnapshot(snapshot);
    this.owner.metadataEvidenceHelpers.writeCachedEvidenceSnapshot(run, key, snapshot);
    this.owner.evidenceStore.put(run, key, snapshot, Boolean(material));
    if (!material) {
      this.owner.metadataEvidenceHelpers.writeEvidenceSnapshotFingerprint(run, key, fingerprint);
      this.owner.metadataEvidenceHelpers.recordCoreDietSnapshot(run, key, 'built-skipped');
      return snapshot;
    }

    attachSnapshot(snapshot);
    this.owner.metadataEvidenceHelpers.writeEvidenceSnapshotFingerprint(run, key, fingerprint);
    this.owner.metadataEvidenceHelpers.recordCoreDietSnapshot(run, key, 'built-attached');
    return snapshot;
  }
}
