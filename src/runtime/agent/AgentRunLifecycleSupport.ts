import { ReplyPipeline } from '../reply/ReplyPipeline.js';
import { GeminiManagedAgentExecutor } from '../../execution/GeminiManagedAgentExecutor.js';
import { resolveZavorthArtifactPolicyFromMetadata, shouldPersistZavorthArtifacts } from '../../contracts/ZavorthResponseDecisionContract.js';
import {
  DynamicHierarchySwarmService,
} from '../../domain/execution/infrastructure/DynamicHierarchySwarmService.js';
import {
  SwarmScalePlaneService,
} from '../../domain/execution/infrastructure/SwarmScalePlaneService.js';
import { AgentRunCanonicalContextService } from './AgentRunCanonicalContextService.js';
import {
  AgentRunSteeringStream,
  type AgentRunSteeringStreamAction,
} from './AgentRunSteeringStream.js';
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
import {
  FailureSemanticsRegistry,
} from './FailureSemanticsRegistry.js';
import { AgentRunFailureResultBuilder } from './AgentRunFailureResultBuilder.js';
import {
  CapabilityNegotiationService,
  type CapabilityNegotiationSnapshot,
} from './CapabilityNegotiationService.js';
import {
  ToolRehearsalService,
  type ToolRehearsalSnapshot,
} from './ToolRehearsalService.js';
import { MemoryWithReceiptsService } from './MemoryWithReceiptsService.js';
import { RunArtifactReceiptReplayService } from './RunArtifactReceiptReplayService.js';
import { AgentRunAuditHooks } from './security/AgentRunAuditHooks.js';
import { runPluginOsHook } from '../../services/PluginOsHookPipelineAccess.js';

import type {
  SelfModificationCommandService,
} from '../../services/SelfModificationCommandService.js';
import type {
  ComputerUseWatchModeService,
} from '../../services/ComputerUseWatchModeService.js';

import { AgentRunFactory, type AgentRunModelPickerContractService } from './AgentRunFactory.js';
import type { NaturalCapabilityDiscoveryService } from './NaturalCapabilityDiscoveryService.js';
import { NaturalFirstApprovalSafetyService } from './NaturalFirstApprovalSafetyService.js';
import { SafetyNarrativeService } from './SafetyNarrativeService.js';
import { NaturalFirstMemoryContinuityService } from './NaturalFirstMemoryContinuityService.js';
import type { UniversalPreviewModeService } from './UniversalPreviewModeService.js';
import {
  AgentRunLlmRuntimeExecutor,
  type UniversalAgentLlmRuntime,
} from './AgentRunLlmRuntimeExecutor.js';

import {
  AgentRunEchoHandsExecutor,
  type UniversalAgentToolRuntime,
} from './AgentRunEchoHandsExecutor.js';

import {
  AgentRunIntelligenceFabricCanary,
  type AgentRunIntelligenceFabricMode,
} from './AgentRunIntelligenceFabricCanary.js';

import { AgentRunExecutorBoundary } from './AgentRunExecutorBoundary.js';
import {
  AgentRunMetadataEvidenceHelpers,
  type CoreDietBaselineDraft,
} from './AgentRunMetadataEvidenceHelpers.js';

import { installAgentRunSpecializedFlows } from './AgentRunSpecializedFlows.js';
import { CapabilityLoopGovernanceService } from './CapabilityLoopGovernanceService.js';
import { TrustSliderPolicyService } from '../uni/TrustSliderPolicyService.js';
import type {
  TrustSliderPolicyDecision,
} from '../uni/UniversalIntentContracts.js';

import {
  ExecutionEscalationPolicy,
} from './ExecutionEscalationPolicy.js';

import { ProviderArenaService } from './ProviderArenaService.js';
import { SelfingZavorthControlService } from './SelfingZavorthControlService.js';
import { ArtifactMemoryService } from './ArtifactMemoryService.js';
import {
  ZavorthLlmBrainService,
} from '../../services/ZavorthLlmBrainService.js';
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
import type { ZavorthIntelligenceFabricService } from '../../services/ZavorthIntelligenceFabricService.js';
import type { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import {
  CanonicalSessionContextAssembler,
  LightweightRunProfileClassifier,
} from './context/index.js';

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
import type { AgentRunExecutionOptions, AgentRunRuntimeEventBus, AgentRunRuntimeEventType, AgentRunService, AgentRunSteeringInput, SelfModificationRuntime, WatchModeRuntime } from './AgentRunService.js';
import { normalizeText } from './AgentRunValueHelpers.js';

export class AgentRunLifecycleSupport {
  public constructor(private readonly owner: AgentRunService) {}

  public attachSelfModificationService(service: SelfModificationRuntime | null | undefined): void {
      this.owner.selfModificationService = service || null;
    }

  public attachWatchModeService(service: WatchModeRuntime | null | undefined): void {
      this.owner.watchModeService = service || null;
    }

  public attachRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
      this.owner.runtimeEventBus = service || null;
    }

  public addRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
      if (!service || this.owner.runtimeEventBusSubscribers.includes(service)) {
        return;
      }
      this.owner.runtimeEventBusSubscribers.push(service);
    }

  public removeRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
      if (!service) {
        return;
      }
      const index = this.owner.runtimeEventBusSubscribers.indexOf(service);
      if (index >= 0) {
        this.owner.runtimeEventBusSubscribers.splice(index, 1);
      }
    }

  public recordSteering(
      run: UniversalAgentRun,
      input: AgentRunSteeringInput,
    ): UniversalAgentSteeringEntry {
      const text = normalizeText(input.text);
      if (!text) {
        throw new Error('Steering requires text.');
      }
      const now = this.owner.now().toISOString();
      const backoffMs = Math.max(0, Number(input.backoffMs || 0));
      const maxAttempts = Math.max(1, Number(input.maxAttempts || 1));
      const entry: UniversalAgentSteeringEntry = {
        id: this.owner.idFactory('agent-steer'),
        runId: run.id,
        sessionId: normalizeText(input.sessionId, run.sessionId),
        text,
        source: normalizeText(input.source, 'operator-steering'),
        status: 'accepted',
        createdAt: now,
        updatedAt: now,
        ackId: this.owner.idFactory('steering-ack'),
        queueItemId: normalizeText(input.queueItemId) || null,
        replaceTargetId: normalizeText(input.replaceTargetId) || null,
        replacedById: null,
        cancelledAt: null,
        cancelReason: null,
        attempts: 0,
        maxAttempts,
        backoffMs,
        nextRetryAt: backoffMs > 0 ? new Date(Date.parse(now) + backoffMs).toISOString() : null,
        metadata: {
          ...(input.metadata || {}),
          nativeAgentRunSteering: true,
        },
      };
      run.steering = [...(run.steering || []), entry];
      run.updatedAt = now;
      run.events.push({
        id: `${entry.id}:accepted`,
        runId: run.id,
        kind: 'steering',
        title: 'Steering accepted',
        detail: text,
        status: 'done',
        createdAt: now,
        metadata: {
          steeringId: entry.id,
          ackId: entry.ackId,
          queueItemId: entry.queueItemId || null,
          replaceTargetId: entry.replaceTargetId || null,
          backoffMs,
          maxAttempts,
          nativeAgentRunSteering: true,
        },
      });
      this.owner.syncRunSteeringMetadata(run);
      this.owner.publishSteeringFrame(run, entry, 'accepted');
      return entry;
    }

  public cancelSteering(
      run: UniversalAgentRun,
      steeringId: string,
      reason = 'Cancelled by operator.',
      metadata: Record<string, unknown> | null = null,
    ): UniversalAgentSteeringEntry | null {
      const target = this.owner.findSteeringEntry(run, steeringId);
      if (!target || target.status === 'cancelled') {
        return target || null;
      }
      const now = this.owner.now().toISOString();
      target.status = 'cancelled';
      target.cancelledAt = now;
      target.cancelReason = normalizeText(reason, 'Cancelled by operator.');
      target.updatedAt = now;
      target.metadata = {
        ...(target.metadata || {}),
        ...(metadata || {}),
      };
      run.updatedAt = now;
      run.events.push({
        id: `${target.id}:cancelled`,
        runId: run.id,
        kind: 'steering',
        title: 'Steering cancelled',
        detail: target.cancelReason || undefined,
        status: 'done',
        createdAt: now,
        metadata: {
          steeringId: target.id,
          ackId: target.ackId,
          nativeAgentRunSteering: true,
        },
      });
      this.owner.syncRunSteeringMetadata(run);
      this.owner.publishSteeringFrame(run, target, 'cancelled');
      return target;
    }

  public replaceSteering(
      run: UniversalAgentRun,
      steeringId: string,
      input: AgentRunSteeringInput,
    ): UniversalAgentSteeringEntry | null {
      const target = this.owner.findSteeringEntry(run, steeringId);
      if (!target || target.status === 'cancelled') {
        return null;
      }
      const now = this.owner.now().toISOString();
      target.status = 'superseded';
      target.updatedAt = now;
      run.events.push({
        id: `${target.id}:superseded`,
        runId: run.id,
        kind: 'steering',
        title: 'Steering superseded',
        detail: target.text,
        status: 'done',
        createdAt: now,
        metadata: {
          steeringId: target.id,
          ackId: target.ackId,
          nativeAgentRunSteering: true,
        },
      });
      const replacement = this.owner.recordSteering(run, {
        ...input,
        replaceTargetId: target.id,
      });
      target.replacedById = replacement.id;
      target.updatedAt = replacement.createdAt;
      this.owner.syncRunSteeringMetadata(run);
      this.owner.publishSteeringFrame(run, target, 'superseded');
      return replacement;
    }

  public recordLifecycleDefenseReview(
      run: UniversalAgentRun,
      phase: AgentRunRiskReviewStage,
      now: string = this.owner.now().toISOString(),
    ): void {
      this.owner.applyDefenseReview(run, phase, run.metadata, now);
      run.updatedAt = now;
    }

  public readEvidenceSnapshot(
      run: UniversalAgentRun,
      keyOrRefId: string,
    ): Record<string, unknown> | null {
      return this.owner.evidenceStore.get(run, keyOrRefId)
        || this.owner.evidenceStore.getByRef(run, keyOrRefId);
    }

  public snapshotEvidenceRefs(run: UniversalAgentRun) {
      return this.owner.evidenceStore.snapshot(run);
    }

  public findSteeringEntry(
      run: UniversalAgentRun,
      steeringId: string,
    ): UniversalAgentSteeringEntry | null {
      const id = normalizeText(steeringId);
      if (!id) return null;
      return (run.steering || []).find((entry) => entry.id === id || entry.id.startsWith(id)) || null;
    }

  public syncRunSteeringMetadata(run: UniversalAgentRun): void {
      const entries = (run.steering || []).slice(-50);
      const active = entries.filter((entry) => entry.status === 'accepted' || entry.status === 'applied');
      run.metadata = {
        ...run.metadata,
        agentRunSteering: {
          schemaVersion: 1,
          source: 'AgentRunService',
          total: entries.length,
          active: active.length,
          latestAckId: entries.at(-1)?.ackId || null,
          entries,
        },
      };
    }

  public publishSteeringFrame(
      run: UniversalAgentRun,
      entry: UniversalAgentSteeringEntry,
      action: AgentRunSteeringStreamAction,
    ): void {
      const frame = this.owner.steeringStream.publish(run.id, entry, action);
      run.metadata = {
        ...run.metadata,
        agentRunSteeringStream: {
          schemaVersion: 1,
          source: 'AgentRunSteeringStream',
          lastSequence: frame.sequence,
          lastAction: frame.action,
          lastAckId: frame.ackId,
        },
      };
    }
}
