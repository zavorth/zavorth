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
  AgentRunToolRuntimeHandsExecutor,
  type UniversalAgentToolRuntime,
} from './AgentRunToolRuntimeHandsExecutor.js';

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

import { ProviderEvaluationService } from './ProviderEvaluationService.js';
import { AgentSelfConfigService } from './AgentSelfConfigService.js';
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
import type { ZavorthIntelligencePipelineService, ZavorthIntelligenceFabricService } from '../../services/ZavorthIntelligencePipelineService.js';
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
import { AgentRunLifecycleSupport } from './AgentRunLifecycleSupport.js';
import { AgentRunGovernanceSupport } from './AgentRunGovernanceSupport.js';
import { AgentRunApprovalGovernanceSupport } from './AgentRunApprovalGovernanceSupport.js';
import { AgentRunRuntimeEventSupport } from './AgentRunRuntimeEventSupport.js';
import { AgentRunExecutionSupport } from './AgentRunExecutionSupport.js';
import { normalizeText, recordOrNull } from './AgentRunValueHelpers.js';
export { normalizeText, recordOrNull } from './AgentRunValueHelpers.js';

export type { UniversalAgentLlmRuntime } from './AgentRunLlmRuntimeExecutor.js';
export type { UniversalAgentToolRuntime } from './AgentRunToolRuntimeHandsExecutor.js';

export type AgentRunServiceRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  runtimeEventBus?: AgentRunRuntimeEventBus | null;
  evidenceWorkerMode?: 'inline' | 'async-heavy' | 'worker-first-heavy';
  evidenceWorker?: AgentRunEvidenceWorker | null;
  asyncEvidenceCollectorIds?: AgentRunEvidenceCollectorId[];
  executor?: UniversalAgentExecutor | null;
  llmRuntime?: UniversalAgentLlmRuntime | null;
  swarmHierarchyService?: SwarmHierarchyRuntime | null;
  swarmScalePlaneService?: SwarmScalePlaneRuntime | null;
  selfModificationService?: SelfModificationRuntime | null;
  watchModeService?: WatchModeRuntime | null;
  toolRuntime?: UniversalAgentToolRuntime | null;
  toolPolicy?: ToolExposurePolicy;
  runBudgetPolicy?: RunBudgetPolicy | null;
  failureSemanticsRegistry?: FailureSemanticsRegistry | null;
  executionEscalationPolicy?: ExecutionEscalationPolicy | null;
  replyPipeline?: ReplyPipeline;
  contextAssembler?: CanonicalSessionContextAssembler | null;
  runProfileClassifier?: LightweightRunProfileClassifier | null;
  riskHooks?: AgentRunRiskHooks | null;
  auditHooks?: AgentRunAuditHooks | null;
  trustSliderPolicy?: TrustSliderPolicyService | null;
  capabilityLoopGovernance?: CapabilityLoopGovernanceService | null;
  modelPickerContractService?: AgentRunModelPickerContractService | null;
  naturalCapabilityDiscovery?: NaturalCapabilityDiscoveryService | null;
  naturalFirstApprovalSafety?: NaturalFirstApprovalSafetyService | null;
  naturalFirstMemoryContinuity?: NaturalFirstMemoryContinuityService | null;
  universalPreviewMode?: UniversalPreviewModeService | null;
  profileManifestService?: Pick<ProfileManifestService, 'compileProfileById'> | null;
  safetyNarrative?: SafetyNarrativeService | null;
  memoryWithReceipts?: MemoryWithReceiptsService | null;
  capabilityNegotiation?: CapabilityNegotiationService | null;
  toolRehearsal?: ToolRehearsalService | null;
  selfingZavorthControl?: AgentSelfConfigService | null;
  agentSelfConfig?: AgentSelfConfigService | null;
  artifactMemory?: ArtifactMemoryService | null;
  personalOpsAutopilot?: PersonalOpsAutopilotService | null;
  agentTeamCompiler?: AgentTeamCompilerService | null;
  crossChannelContinuity?: CrossChannelContinuityService | null;
  askBeforeAssumptionPolicy?: AskBeforeAssumptionPolicyService | null;
  providerMeshConsolidation?: ProviderMeshConsolidationService | null;
  universalIntentTrustEnforcement?: UniversalIntentTrustEnforcementService | null;
  runArtifactReceiptReplay?: RunArtifactReceiptReplayService | null;
  productizationEvidence?: ProductizationEvidenceService | null;
  productEntryRuntime?: ProductEntryRuntimeService | null;
  releaseInstallerRollbackPath?: ReleaseInstallerRollbackPathService | null;
  publicSiteDocsDemoSync?: PublicSiteDocsDemoSyncService | null;
  feedbackTelemetryProductLoop?: FeedbackTelemetryProductLoopService | null;
  publicAdoptionPilotLoop?: PublicAdoptionPilotLoopService | null;
  integrationShowcasePartnerSurface?: IntegrationShowcasePartnerSurfaceService | null;
  releaseAdoptionReadiness?: ReleaseAdoptionReadinessService | null;
  releaseCandidatePreCanaryGate?: ReleaseCandidatePreCanaryGateService | null;
  blueprintCompletionGate?: BlueprintCompletionGateService | null;
  providerArena?: ProviderEvaluationService | null;
  providerEvaluation?: ProviderEvaluationService | null;
  skillMcpQuarantine?: SkillMcpQuarantineService | null;
  autoSkillInvocation?: Pick<AgentRunAutomaticSkillInvocationService, 'apply'> | null;
  llmBrain?: Pick<ZavorthLlmBrainService, 'buildRunSnapshot'> | null;
  skillPromotionGate?: Pick<
    SkillPromotionGate,
    'materializeCandidate' | 'dryPreviewFromIntent' | 'preview' | 'apply' | 'reject'
  > | null;
  nativeAutonomySpine?: Pick<ZavorthNativeAutonomySpineService, 'buildSnapshot'> | null;
  defaultProviderLabel?: string;
  defaultModelLabel?: string;
  intelligenceFabric?: Pick<ZavorthIntelligenceFabricService, 'buildShadowSnapshot'> | null;
  intelligenceFabricLearning?: Pick<ZavorthIntelligenceFabricLearningService, 'recordSnapshot'> | null;
  mutationPlaneService?: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan' | 'approvePlan' | 'markApplied'> | null;
  intelligenceFabricMode?: AgentRunIntelligenceFabricMode | null;
  steeringStream?: AgentRunSteeringStream | null;
  onRunCreated?: (run: UniversalAgentRun, request: UniversalAgentRequest) => void;
  onRunCompleted?: (run: UniversalAgentRun, request: UniversalAgentRequest, replyText: string) => void;
};

export type AgentRunRuntimeEventType =
  | 'agent.run.created'
  | 'agent.policy.evaluated'
  | 'agent.approval.requested'
  | 'agent.execution.started'
  | 'agent.execution.completed'
  | 'agent.execution.failed'
  | 'agent.run.completed'
  | 'agent.stream.lifecycle'
  | 'agent.stream.tool'
  | 'agent.stream.assistant'
  | 'agent.skill.evolution.candidate'
  | 'agent.adapter.proof.required';

export type AgentRunRuntimeEventBus = {
  emit: (type: AgentRunRuntimeEventType, payload?: Record<string, unknown>) => void | Promise<void>;
  snapshot?: () => unknown;
};

export type AgentRunExecutionOptions = {
  executor?: UniversalAgentExecutor | null;
  toolRuntime?: UniversalAgentToolRuntime | null;
  /** Optional AbortSignal (voice barge-in / client cancel) */
  signal?: AbortSignal | null;
};

export type AgentRunSteeringInput = {
  text: string;
  source?: string | null;
  sessionId?: string | null;
  queueItemId?: string | null;
  replaceTargetId?: string | null;
  backoffMs?: number | null;
  maxAttempts?: number | null;
  metadata?: Record<string, unknown> | null;
};

type SwarmHierarchyRuntime = Pick<DynamicHierarchySwarmService, 'launchHierarchy'>
  & Partial<Pick<DynamicHierarchySwarmService, 'launchHierarchyAndWait'>>;
type SwarmScalePlaneRuntime = Pick<SwarmScalePlaneService, 'launch' | 'resume' | 'listRuns' | 'getRun'>;

export type SelfModificationRuntime = Pick<SelfModificationCommandService, 'createGoalPreview'>;
export type WatchModeRuntime = Pick<ComputerUseWatchModeService, 'startRun'>;

function defaultIdFactory(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class AgentRunService {
  private readonly __agentRunServiceBrand = true;
  public readonly lifecycleSupport: AgentRunLifecycleSupport;
  public readonly governanceSupport: AgentRunGovernanceSupport;
  public readonly approvalGovernanceSupport: AgentRunApprovalGovernanceSupport;
  public readonly runtimeEventSupport: AgentRunRuntimeEventSupport;
  public readonly executionSupport: AgentRunExecutionSupport;
  declare public applyProviderArena: Function;
  declare public applyProviderMeshConsolidation: Function;
  declare public applyArtifactMemory: Function;
  declare public applyPersonalOpsAutopilot: Function;
  declare public applyAgentTeamCompiler: Function;
  declare public applyAskBeforeAssumptionPolicy: Function;
  declare public applyCrossChannelContinuity: Function;
  declare public applySelfingZavorthControl: Function;
  declare public applyRunArtifactReceiptReplay: Function;
  declare public applyProductizationEvidence: Function;
  declare public applyProductEntryRuntime: Function;
  declare public applyReleaseInstallerRollbackPath: Function;
  declare public applyPublicSiteDocsDemoSync: Function;
  declare public applyFeedbackTelemetryProductLoop: Function;
  declare public applyPublicAdoptionPilotLoop: Function;
  declare public applyIntegrationShowcasePartnerSurface: Function;
  declare public applyReleaseAdoptionReadiness: Function;
  declare public applyReleaseCandidatePreCanaryGate: Function;
  declare public applyBlueprintCompletionGate: Function;
  declare public resolveTrustSliderDecision: Function;
  declare public serializeTrustSliderDecision: Function;
  declare public resolveTrustSliderLevel: Function;
  declare public resolveTrustSliderUserRole: Function;
  declare public resolveBooleanFlag: Function;
  declare public createUniversalPreviewResultIfRequested: Function;
  declare public createCapabilityNegotiationProposalIfNeeded: Function;
  declare public createCapabilityNegotiationBlockedResult: Function;
  declare public createToolRehearsalProposalIfNeeded: Function;
  declare public createToolRehearsalBlockedResult: Function;
  declare public createSwarmEscalationProposalIfNeeded: Function;
  declare public createSelfModificationPreviewIfNeeded: Function;
  declare public createSelfModificationActionProposalIfNeeded: Function;
  declare public canExecute: Function;
  declare public shouldBypassCapabilityNegotiationForSpecializedFlow: Function;
  declare public shouldProposeSwarmEscalation: Function;
  declare public shouldCreateSelfModificationPreview: Function;
  declare public shouldUseNaturalCapabilityDiscoveryWithoutNegotiation: Function;
  declare public hasResolvedTool: Function;
  declare public collectResolvedToolIds: Function;
  declare public collectNaturalCapabilityToolIds: Function;
  declare public serializeSelfModificationPreview: Function;
  declare public buildSelfModificationPreviewReply: Function;
  declare public buildUniversalPreviewReply: Function;
  declare public buildCapabilityNegotiationReply: Function;
  declare public buildToolRehearsalReply: Function;
  declare public acknowledgeApprovedSelfModificationActionProposalIfNeeded: Function;
  declare public createWatchModeVisualProposalIfNeeded: Function;
  declare public acknowledgeApprovedWatchModeVisualProposalIfNeeded: Function;
  declare public serializeWatchModeRun: Function;
  declare public buildWatchModeVisualProposalReply: Function;
  declare public resolveWatchModeVisualRequest: Function;
  declare public resolveWatchModeTargetWindow: Function;
  declare public isWatchModePolicyAllowlisted: Function;
  declare public buildSelfModificationActionProposalReply: Function;
  declare public resolveSelfModificationActionRequest: Function;
  declare public resolveSelfModificationActionTargetId: Function;
  declare public extractSelfModificationTargetIdFromText: Function;
  declare public resolveSuggestedSubagents: Function;
  declare public buildSwarmEscalationReply: Function;
  declare public executeApprovedSwarmProposalIfNeeded: Function;
  declare public serializeSwarmLaunchResult: Function;
  declare public buildSwarmExecutionReply: Function;
  declare public resolveSwarmScalePlan: Function;
  declare public shouldUseSwarmScalePlane: Function;
  declare public executeApprovedSwarmScaleProposal: Function;
  declare public serializeSwarmScaleSnapshot: Function;
  declare public buildSwarmScaleProposalReply: Function;
  declare public buildSwarmScaleExecutionReply: Function;

  readonly now: () => Date;
  readonly idFactory: (prefix: string) => string;
  public runtimeEventBus: AgentRunRuntimeEventBus | null;
  public readonly runtimeEventBusSubscribers: AgentRunRuntimeEventBus[] = [];
  public readonly evidenceWorkerMode: 'inline' | 'async-heavy' | 'worker-first-heavy';
  public readonly evidenceWorker: AgentRunEvidenceWorker | null;
  public readonly asyncEvidenceCollectorIds: AgentRunEvidenceCollectorId[] | null;
  readonly executor: UniversalAgentExecutor | null;
  readonly llmRuntimeExecutor: AgentRunLlmRuntimeExecutor;
  readonly steeringStream: AgentRunSteeringStream;
  public readonly onRunCreated: ((run: UniversalAgentRun, request: UniversalAgentRequest) => void) | null;
  public readonly onRunCompleted: ((run: UniversalAgentRun, request: UniversalAgentRequest, replyText: string) => void) | null;
  public readonly corePipeline: AgentRunCorePipeline<CoreDietBaselineDraft>;
  public readonly executorBoundary: AgentRunExecutorBoundary;
  public readonly swarmHierarchyService: SwarmHierarchyRuntime | null;
  public readonly swarmScalePlaneService: SwarmScalePlaneRuntime | null;
  public selfModificationService: SelfModificationRuntime | null;
  public watchModeService: WatchModeRuntime | null;
  public readonly toolRuntime: UniversalAgentToolRuntime | null;
  public readonly toolRuntimeHandsExecutor: AgentRunToolRuntimeHandsExecutor;
  public readonly toolPolicy: ToolExposurePolicy;
  public readonly runBudgetPolicy: RunBudgetPolicy;
  public readonly policyKernel: AgentRunPolicyKernel;
  public readonly failureResultBuilder: AgentRunFailureResultBuilder;
  readonly intelligenceFabricCanary: AgentRunIntelligenceFabricCanary;
  public readonly executionEscalationPolicy: ExecutionEscalationPolicy;
  readonly replyPipeline: ReplyPipeline;
  readonly evidencePipeline: AgentRunEvidencePipeline;
  public readonly evidenceStore: AgentRunEvidenceStore;
  public readonly canonicalContextService: AgentRunCanonicalContextService;
  public readonly runFactory: AgentRunFactory;
  readonly riskHooks: AgentRunRiskHooks;
  readonly auditHooks: AgentRunAuditHooks;
  public readonly trustSliderPolicy: TrustSliderPolicyService;
  readonly capabilityLoopGovernance: CapabilityLoopGovernanceService;
  readonly safetyNarrative: SafetyNarrativeService;
  readonly memoryWithReceipts: MemoryWithReceiptsService;
  readonly capabilityNegotiation: CapabilityNegotiationService;
  readonly toolRehearsal: ToolRehearsalService;
  public readonly selfingZavorthControl: AgentSelfConfigService;
  public readonly agentSelfConfig: AgentSelfConfigService;
  public readonly artifactMemory: ArtifactMemoryService;
  public readonly personalOpsAutopilot: PersonalOpsAutopilotService;
  public readonly agentTeamCompiler: AgentTeamCompilerService;
  public readonly crossChannelContinuity: CrossChannelContinuityService;
  public readonly askBeforeAssumptionPolicy: AskBeforeAssumptionPolicyService;
  public readonly providerMeshConsolidation: ProviderMeshConsolidationService;
  readonly universalIntentTrustEnforcement: UniversalIntentTrustEnforcementService;
  public readonly runArtifactReceiptReplay: RunArtifactReceiptReplayService;
  public readonly productizationEvidence: ProductizationEvidenceService;
  public readonly productEntryRuntime: ProductEntryRuntimeService;
  public readonly releaseInstallerRollbackPath: ReleaseInstallerRollbackPathService;
  public readonly publicSiteDocsDemoSync: PublicSiteDocsDemoSyncService;
  public readonly feedbackTelemetryProductLoop: FeedbackTelemetryProductLoopService;
  public readonly publicAdoptionPilotLoop: PublicAdoptionPilotLoopService;
  public readonly integrationShowcasePartnerSurface: IntegrationShowcasePartnerSurfaceService;
  public readonly releaseAdoptionReadiness: ReleaseAdoptionReadinessService;
  public readonly releaseCandidatePreCanaryGate: ReleaseCandidatePreCanaryGateService;
  public readonly blueprintCompletionGate: BlueprintCompletionGateService;
  public readonly providerArena: ProviderEvaluationService;
  public readonly providerEvaluation: ProviderEvaluationService;
  readonly skillMcpQuarantine: SkillMcpQuarantineService;
  readonly autoSkillInvocation: Pick<AgentRunAutomaticSkillInvocationService, 'apply'> | null;
  readonly llmBrain: Pick<ZavorthLlmBrainService, 'buildRunSnapshot'>;
  public readonly skillPromotionGate: Pick<
    SkillPromotionGate,
    'materializeCandidate' | 'dryPreviewFromIntent' | 'preview' | 'apply' | 'reject'
  > | null;
  public readonly nativeAutonomySpine: Pick<ZavorthNativeAutonomySpineService, 'buildSnapshot'> | null;
  public readonly modelPickerContractService: AgentRunModelPickerContractService | null;
  public readonly naturalFirstApprovalSafety: NaturalFirstApprovalSafetyService;
  public readonly naturalFirstMemoryContinuity: NaturalFirstMemoryContinuityService;
  public readonly metadataEvidenceHelpers = new AgentRunMetadataEvidenceHelpers();
  readonly appliedEvidenceSnapshotChains = new WeakSet<UniversalAgentRun>();

  constructor(runtime: AgentRunServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.idFactory = runtime.idFactory || defaultIdFactory;
    this.runtimeEventBus = runtime.runtimeEventBus || null;
    this.evidenceWorker = runtime.evidenceWorker || null;
    this.evidenceWorkerMode = runtime.evidenceWorkerMode || (this.evidenceWorker ? 'worker-first-heavy' : 'inline');
    this.asyncEvidenceCollectorIds = runtime.asyncEvidenceCollectorIds || null;
    this.executor = runtime.executor || null;
    this.steeringStream = runtime.steeringStream || new AgentRunSteeringStream();
    this.onRunCreated = runtime.onRunCreated || null;
    this.onRunCompleted = runtime.onRunCompleted || null;
    this.llmRuntimeExecutor = new AgentRunLlmRuntimeExecutor({
      llmRuntime: runtime.llmRuntime,
      toolRuntime: runtime.toolRuntime,
      steeringStream: this.steeringStream,
      publishRuntimeEvent: (run, type, payload) => this.publishRuntimeEvent(run, type, payload),
      runtimeEventStreamingEnabled: true,
    });
    this.swarmHierarchyService = runtime.swarmHierarchyService || null;
    this.swarmScalePlaneService = runtime.swarmScalePlaneService || new SwarmScalePlaneService({
      llmRuntime: runtime.llmRuntime as any || null,
      toolRuntime: runtime.toolRuntime as any || null,
    });
    this.selfModificationService = runtime.selfModificationService || null;
    this.watchModeService = runtime.watchModeService || null;
    this.toolRuntime = runtime.toolRuntime || null;
    this.toolRuntimeHandsExecutor = new AgentRunToolRuntimeHandsExecutor();
    this.executorBoundary = new AgentRunExecutorBoundary({
      executor: this.executor,
      toolRuntime: this.toolRuntime,
      llmRuntimeExecutor: this.llmRuntimeExecutor,
      echoHandsExecutor: this.echoHandsExecutor,
    });
    this.toolPolicy = runtime.toolPolicy || new ToolExposurePolicy();
    this.runBudgetPolicy = runtime.runBudgetPolicy || new RunBudgetPolicy();
    const failureSemanticsRegistry = runtime.failureSemanticsRegistry || new FailureSemanticsRegistry();
    this.executionEscalationPolicy = runtime.executionEscalationPolicy || new ExecutionEscalationPolicy();
    this.replyPipeline = runtime.replyPipeline || new ReplyPipeline();
    this.evidenceStore = new AgentRunEvidenceStore();
    this.canonicalContextService = new AgentRunCanonicalContextService({
      contextAssembler: runtime.contextAssembler,
      runProfileClassifier: runtime.runProfileClassifier,
    });
    this.riskHooks = runtime.riskHooks || new AgentRunRiskHooks();
    this.auditHooks = runtime.auditHooks || new AgentRunAuditHooks();
    this.safetyNarrative = runtime.safetyNarrative || new SafetyNarrativeService({
      now: this.now,
    });
    this.memoryWithReceipts = runtime.memoryWithReceipts || new MemoryWithReceiptsService({
      now: this.now,
    });
    this.capabilityNegotiation = runtime.capabilityNegotiation || new CapabilityNegotiationService({
      now: this.now,
    });
    this.toolRehearsal = runtime.toolRehearsal || new ToolRehearsalService({
      now: this.now,
    });
    this.selfingZavorthControl = runtime.agentSelfConfig || runtime.selfingZavorthControl || new AgentSelfConfigService({
      now: this.now,
    });
    this.agentSelfConfig = this.selfingZavorthControl;
    this.artifactMemory = runtime.artifactMemory || new ArtifactMemoryService({
      now: this.now,
    });
    this.personalOpsAutopilot = runtime.personalOpsAutopilot || new PersonalOpsAutopilotService({
      now: this.now,
    });
    this.agentTeamCompiler = runtime.agentTeamCompiler || new AgentTeamCompilerService({
      now: this.now,
    });
    this.crossChannelContinuity = runtime.crossChannelContinuity || new CrossChannelContinuityService({
      now: this.now,
    });
    this.askBeforeAssumptionPolicy = runtime.askBeforeAssumptionPolicy || new AskBeforeAssumptionPolicyService({
      now: this.now,
    });
    this.providerMeshConsolidation = runtime.providerMeshConsolidation || new ProviderMeshConsolidationService({
      now: this.now,
      modelPickerContractService: runtime.modelPickerContractService,
    });
    this.universalIntentTrustEnforcement = runtime.universalIntentTrustEnforcement || new UniversalIntentTrustEnforcementService({
      now: this.now,
    });
    this.runArtifactReceiptReplay = runtime.runArtifactReceiptReplay || new RunArtifactReceiptReplayService({
      now: this.now,
    });
    this.productizationEvidence = runtime.productizationEvidence || new ProductizationEvidenceService({
      now: this.now,
    });
    this.productEntryRuntime = runtime.productEntryRuntime || new ProductEntryRuntimeService({
      now: this.now,
    });
    this.releaseInstallerRollbackPath = runtime.releaseInstallerRollbackPath || new ReleaseInstallerRollbackPathService({
      now: this.now,
    });
    this.publicSiteDocsDemoSync = runtime.publicSiteDocsDemoSync || new PublicSiteDocsDemoSyncService({
      now: this.now,
    });
    this.feedbackTelemetryProductLoop = runtime.feedbackTelemetryProductLoop || new FeedbackTelemetryProductLoopService({
      now: this.now,
    });
    this.publicAdoptionPilotLoop = runtime.publicAdoptionPilotLoop || new PublicAdoptionPilotLoopService({
      now: this.now,
    });
    this.integrationShowcasePartnerSurface = runtime.integrationShowcasePartnerSurface || new IntegrationShowcasePartnerSurfaceService({
      now: this.now,
    });
    this.releaseAdoptionReadiness = runtime.releaseAdoptionReadiness || new ReleaseAdoptionReadinessService({
      now: this.now,
    });
    this.releaseCandidatePreCanaryGate = runtime.releaseCandidatePreCanaryGate || new ReleaseCandidatePreCanaryGateService({
      now: this.now,
    });
    this.blueprintCompletionGate = runtime.blueprintCompletionGate || new BlueprintCompletionGateService({
      now: this.now,
    });
    this.providerArena = runtime.providerEvaluation || runtime.providerArena || new ProviderEvaluationService({
      now: this.now,
    });
    this.providerEvaluation = this.providerArena;
    this.skillMcpQuarantine = runtime.skillMcpQuarantine || new SkillMcpQuarantineService({
      now: this.now,
    });
    this.autoSkillInvocation = runtime.autoSkillInvocation === null
      ? null
      : runtime.autoSkillInvocation || new AgentRunAutomaticSkillInvocationService({
        now: this.now,
      });
    this.llmBrain = runtime.llmBrain || new ZavorthLlmBrainService({
      now: this.now,
    });
    this.skillPromotionGate = runtime.skillPromotionGate === null
      ? null
      : runtime.skillPromotionGate || new SkillPromotionGate({ now: this.now });
    this.nativeAutonomySpine = runtime.nativeAutonomySpine
      || (() => {
        try {
          const { ZavorthNativeAutonomySpineService } = require('../../services/ZavorthNativeAutonomySpineService.js');
          return new ZavorthNativeAutonomySpineService({ projectRoot: process.cwd() });
        } catch {
          return null;
        }
      })();
    this.modelPickerContractService = runtime.modelPickerContractService || null;
    this.naturalFirstApprovalSafety = runtime.naturalFirstApprovalSafety || new NaturalFirstApprovalSafetyService();
    this.naturalFirstMemoryContinuity = runtime.naturalFirstMemoryContinuity || new NaturalFirstMemoryContinuityService();
    this.trustSliderPolicy = runtime.trustSliderPolicy || new TrustSliderPolicyService({
      now: this.now,
      idFactory: this.idFactory,
    });
    this.capabilityLoopGovernance = runtime.capabilityLoopGovernance || new CapabilityLoopGovernanceService();
    this.failureResultBuilder = new AgentRunFailureResultBuilder({
      now: this.now,
      idFactory: this.idFactory,
      failureSemanticsRegistry,
      replyPipeline: this.replyPipeline,
      riskHooks: this.riskHooks,
      auditHooks: this.auditHooks,
    });
    this.intelligenceFabricCanary = new AgentRunIntelligenceFabricCanary({
      now: this.now,
      fabric: runtime.intelligenceFabric || null,
      learning: runtime.intelligenceFabricLearning || null,
      mutationPlane: runtime.mutationPlaneService || null,
      defaultMode: runtime.intelligenceFabricMode || 'default',
    });
    const defaultProviderLabel = normalizeText(runtime.defaultProviderLabel, 'provider not configured');
    const defaultModelLabel = normalizeText(runtime.defaultModelLabel, 'model not configured');
    this.runFactory = new AgentRunFactory({
      now: this.now,
      idFactory: this.idFactory,
      toolPolicy: this.toolPolicy,
      canonicalContextService: this.canonicalContextService,
      modelPickerContractService: runtime.modelPickerContractService,
      naturalCapabilityDiscovery: runtime.naturalCapabilityDiscovery,
      universalPreviewMode: runtime.universalPreviewMode,
      profileManifestService: runtime.profileManifestService,
      defaultProviderLabel,
      defaultModelLabel,
    });
    this.evidencePipeline = this.createEvidencePipeline();
    this.policyKernel = this.createPolicyKernel();
    this.corePipeline = this.createCorePipeline();
    this.lifecycleSupport = new AgentRunLifecycleSupport(this);
    this.governanceSupport = new AgentRunGovernanceSupport(this);
    this.approvalGovernanceSupport = new AgentRunApprovalGovernanceSupport(this);
    this.runtimeEventSupport = new AgentRunRuntimeEventSupport(this);
    this.executionSupport = new AgentRunExecutionSupport(this);
  }

  public attachSelfModificationService(service: SelfModificationRuntime | null | undefined): void {
    return this.lifecycleSupport.attachSelfModificationService(service);
  }

  public attachWatchModeService(service: WatchModeRuntime | null | undefined): void {
    return this.lifecycleSupport.attachWatchModeService(service);
  }

  public attachRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
    return this.lifecycleSupport.attachRuntimeEventBus(service);
  }

  public addRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
    return this.lifecycleSupport.addRuntimeEventBus(service);
  }

  public removeRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
    return this.lifecycleSupport.removeRuntimeEventBus(service);
  }

  public recordSteering(
    run: UniversalAgentRun,
    input: AgentRunSteeringInput,
  ): UniversalAgentSteeringEntry {
    return this.lifecycleSupport.recordSteering(run, input);
  }

  public cancelSteering(
    run: UniversalAgentRun,
    steeringId: string,
    reason = 'Cancelled by operator.',
    metadata: Record<string, unknown> | null = null,
  ): UniversalAgentSteeringEntry | null {
    return this.lifecycleSupport.cancelSteering(run, steeringId, reason, metadata);
  }

  public replaceSteering(
    run: UniversalAgentRun,
    steeringId: string,
    input: AgentRunSteeringInput,
  ): UniversalAgentSteeringEntry | null {
    return this.lifecycleSupport.replaceSteering(run, steeringId, input);
  }

  public recordLifecycleDefenseReview(
    run: UniversalAgentRun,
    phase: AgentRunRiskReviewStage,
    now: string = this.now().toISOString(),
  ): void {
    return this.lifecycleSupport.recordLifecycleDefenseReview(run, phase, now);
  }

  public readEvidenceSnapshot(
    run: UniversalAgentRun,
    keyOrRefId: string,
  ): Record<string, unknown> | null {
    return this.lifecycleSupport.readEvidenceSnapshot(run, keyOrRefId);
  }

  public snapshotEvidenceRefs(run: UniversalAgentRun) {
    return this.lifecycleSupport.snapshotEvidenceRefs(run);
  }

  public findSteeringEntry(
    run: UniversalAgentRun,
    steeringId: string,
  ): UniversalAgentSteeringEntry | null {
    return this.lifecycleSupport.findSteeringEntry(run, steeringId);
  }

  public syncRunSteeringMetadata(run: UniversalAgentRun): void {
    return this.lifecycleSupport.syncRunSteeringMetadata(run);
  }

  public publishSteeringFrame(
    run: UniversalAgentRun,
    entry: UniversalAgentSteeringEntry,
    action: AgentRunSteeringStreamAction,
  ): void {
    return this.lifecycleSupport.publishSteeringFrame(run, entry, action);
  }

  public createPolicyKernel(): AgentRunPolicyKernel {
    return new AgentRunPolicyKernel({
      now: this.now,
      idFactory: this.idFactory,
      evaluateTrust: (run, request) => this.applyTrustSliderReview(run, request),
      evaluateBudget: (run, request) => this.runBudgetPolicy.evaluate({ request, run }),
      reviewPreExecution: (run) => this.applyDefenseReview(run, 'pre-executor', run.metadata),
    });
  }

  public createCorePipeline(): AgentRunCorePipeline<CoreDietBaselineDraft> {
    return new AgentRunCorePipeline<CoreDietBaselineDraft>({
      createRun: (request, baseline) => this.createRun(request, baseline),
      timeStage: (run, baseline, name, action) => this.metadataEvidenceHelpers.timeCoreDietStage(run, baseline, name, action),
      policyKernel: this.policyKernel,
      evidencePipeline: this.evidencePipeline,
      publishRuntimeEvent: (run, type, payload) => this.publishRuntimeEvent(run, type, payload),
      finishBaseline: (run, baseline) => this.finishCoreDietBaseline(run, baseline),
      applyMetadataDiet: (run) => this.applyMetadataDiet(run),
      readTrustMode: (run) => recordOrNull(run.metadata.trustPosture)?.trustMode || null,
      resolveProfile: (run) => normalizeText(run.metadata.profile, this.metadataEvidenceHelpers.resolveCoreDietBaselineProfile(run)),
    });
  }

  public createEvidencePipeline(): AgentRunEvidencePipeline {
    const steps: AgentRunEvidencePipelineStep[] = [
      {
        id: 'memoryWithReceipts',
        apply: ({ run, generatedAt }) => this.applyMemoryWithReceipts(run, generatedAt),
      },
      {
        id: 'skillMcpQuarantine',
        apply: ({ run, generatedAt }) => this.applySkillMcpQuarantine(run, generatedAt),
      },
      {
        id: 'universalIntentTrustEnforcement',
        apply: ({ run, request, generatedAt }) => this.applyUniversalIntentTrustEnforcement(run, request, generatedAt),
      },
      {
        id: 'capabilityNegotiation',
        apply: ({ run, request, generatedAt }) => this.applyCapabilityNegotiation(run, request || undefined, generatedAt),
      },
      {
        id: 'toolRehearsal',
        apply: ({ run, request, generatedAt }) => this.applyToolRehearsal(run, request || undefined, generatedAt),
      },
      {
        id: 'providerArena',
        apply: ({ run, generatedAt }) => this.applyProviderArena(run, generatedAt),
      },
      {
        id: 'providerMeshConsolidation',
        apply: ({ run, generatedAt }) => this.applyProviderMeshConsolidation(run, generatedAt),
      },
      {
        id: 'crossChannelContinuity',
        apply: ({ run, generatedAt }) => this.applyCrossChannelContinuity(run, generatedAt),
      },
      {
        id: 'agentTeamCompiler',
        apply: ({ run, generatedAt }) => this.applyAgentTeamCompiler(run, generatedAt),
      },
      {
        id: 'askBeforeAssumptionPolicy',
        apply: ({ run, generatedAt }) => this.applyAskBeforeAssumptionPolicy(run, generatedAt),
      },
      {
        id: 'artifactMemory',
        apply: ({ run, generatedAt }) => this.applyArtifactMemory(run, generatedAt),
      },
      {
        id: 'personalOpsAutopilot',
        apply: ({ run, generatedAt }) => this.applyPersonalOpsAutopilot(run, generatedAt),
      },
      {
        id: 'selfingZavorthControl',
        apply: ({ run, generatedAt }) => this.applySelfingZavorthControl(run, generatedAt),
      },
      {
        id: 'runArtifactReceiptReplay',
        apply: ({ run, generatedAt }) => this.applyRunArtifactReceiptReplay(run, generatedAt),
      },
      {
        id: 'productizationEvidence',
        apply: ({ run, generatedAt }) => this.applyProductizationEvidence(run, generatedAt),
      },
      {
        id: 'productEntryRuntime',
        apply: ({ run, generatedAt }) => this.applyProductEntryRuntime(run, generatedAt),
      },
      {
        id: 'releaseInstallerRollbackPath',
        apply: ({ run, generatedAt }) => this.applyReleaseInstallerRollbackPath(run, generatedAt),
      },
      {
        id: 'publicSiteDocsDemoSync',
        apply: ({ run, generatedAt }) => this.applyPublicSiteDocsDemoSync(run, generatedAt),
      },
      {
        id: 'feedbackTelemetryProductLoop',
        apply: ({ run, generatedAt }) => this.applyFeedbackTelemetryProductLoop(run, generatedAt),
      },
      {
        id: 'publicAdoptionPilotLoop',
        apply: ({ run, generatedAt }) => this.applyPublicAdoptionPilotLoop(run, generatedAt),
      },
      {
        id: 'integrationShowcasePartnerSurface',
        apply: ({ run, generatedAt }) => this.applyIntegrationShowcasePartnerSurface(run, generatedAt),
      },
      {
        id: 'releaseAdoptionReadiness',
        apply: ({ run, generatedAt }) => this.applyReleaseAdoptionReadiness(run, generatedAt),
      },
      {
        id: 'releaseCandidatePreCanaryGate',
        apply: ({ run, generatedAt }) => this.applyReleaseCandidatePreCanaryGate(run, generatedAt),
      },
      {
        id: 'blueprintCompletionGate',
        apply: ({ run, generatedAt }) => this.applyBlueprintCompletionGate(run, generatedAt),
      },
      {
        id: 'capabilityLoopGovernance',
        apply: ({ run, request }) => {
          if (request) {
            this.applyCapabilityLoopGovernance(run, request);
          }
        },
      },
    ];
    return new AgentRunEvidencePipeline({
      steps,
      workerMode: this.evidenceWorkerMode,
      worker: this.evidenceWorker,
      asyncCollectorIds: this.asyncEvidenceCollectorIds || undefined,
    });
  }

  public async run(
    input: UniversalAgentRequest,
    options: AgentRunExecutionOptions = {},
  ): Promise<UniversalAgentRunResult> {
    const baseline = this.metadataEvidenceHelpers.startCoreDietBaseline();
    let run: UniversalAgentRun | null = null;
    let finalAssistantText = '';
    try {
      const prepared = await this.corePipeline.prepare(input, baseline);
      run = prepared.run;
      const activeRun = run;
      this.onRunCreated?.(activeRun, input);
      await runPluginOsHook({
        event: 'agent.before_turn',
        workspace: String(input.workspace || activeRun.workspace || '').trim() || null,
        context: {
          runId: activeRun.id,
          status: activeRun.status,
          title: activeRun.title || null,
          channel: activeRun.channel,
        },
      });
      const draftApply = this.applyIntelligenceFabricDraftGuidanceIfRequested(activeRun, input);
      if (draftApply) {
        return draftApply;
      }
      this.applyIntelligenceFabricCanary(activeRun, input, options);
      if (prepared.blockedResult) {
        return prepared.blockedResult;
      }
      const budgetDecision = prepared.budgetDecision;
      if (!budgetDecision.allowed) {
        const now = this.now().toISOString();
        activeRun.status = 'completed';
        activeRun.summary = budgetDecision.summary;
        activeRun.updatedAt = now;
        activeRun.events.push({
          id: this.idFactory('agent-event'),
          runId: activeRun.id,
          kind: 'status',
          title: 'Minimum budget applied',
          detail: budgetDecision.summary,
          status: 'done',
          createdAt: now,
          metadata: budgetDecision.metadata,
        });
        this.metadataEvidenceHelpers.timeCoreDietStage(activeRun, baseline, 'budget-short-circuit-evidence', () => (
          this.evidencePipeline.applyBudgetShortCircuit({
            run: activeRun,
            request: input,
            generatedAt: now,
          })
        ));
        return this.replyPipeline.buildResult({
          run: activeRun,
          text: budgetDecision.summary,
        });
      }

      const universalPreview = this.createUniversalPreviewResultIfRequested(run, input);
      if (universalPreview) {
        return universalPreview;
      }

      const memoryContinuity = this.createNaturalFirstMemoryContinuityIfNeeded(run, input);
      if (memoryContinuity) {
        return memoryContinuity;
      }

      this.applyNaturalFirstApprovalSafety(run, input);

      const managedAgentPreview = this.createAgenticManagedAgentPreviewIfNeeded(run);
      if (managedAgentPreview) {
        return managedAgentPreview;
      }

      const swarmProposal = this.createSwarmEscalationProposalIfNeeded(run, input);
      if (swarmProposal) {
        return swarmProposal;
      }

      try {
        const selfModificationPreview = await this.createSelfModificationPreviewIfNeeded(run, input);
        if (selfModificationPreview) {
          return selfModificationPreview;
        }
      } catch (error: unknown) {return this.buildFailureResult(run, error, 'selfmod');
      }

      const selfModificationActionProposal = this.createSelfModificationActionProposalIfNeeded(run, input);
      if (selfModificationActionProposal) {
        return selfModificationActionProposal;
      }

      const watchModeVisualProposal = this.createWatchModeVisualProposalIfNeeded(run, input);
      if (watchModeVisualProposal) {
        return watchModeVisualProposal;
      }

      const capabilityNegotiationProposal = this.createCapabilityNegotiationProposalIfNeeded(run, input);
      if (capabilityNegotiationProposal) {
        return capabilityNegotiationProposal;
      }

      const toolRehearsalProposal = this.createToolRehearsalProposalIfNeeded(run, input);
      if (toolRehearsalProposal) {
        return toolRehearsalProposal;
      }

      const naturalFirstApprovalFallback = this.createNaturalFirstApprovalFallbackIfNeeded(run, input);
      if (naturalFirstApprovalFallback) {
        return naturalFirstApprovalFallback;
      }

      await this.applyAutomaticSkillInvocationIfNeeded(run, input);

      const preExecutionReview = this.metadataEvidenceHelpers.timeCoreDietStage(activeRun, baseline, 'policy-kernel-pre-execution', () => (
        this.policyKernel.reviewPreExecution(activeRun)
      ));
      const approvalEvent = preExecutionReview.approval;
      if (approvalEvent) {
        run.events.push(approvalEvent.event);
        run.approvals.push(approvalEvent.approval);
        run.status = 'waiting_approval';
        run.summary = 'Execution requires approval before touching sensitive tools.';
        run.updatedAt = this.now().toISOString();
        this.applyCapabilityLoopGovernance(run, input);
        const narrative = this.applySafetyNarrative(run);
        await this.publishRuntimeEvent(run, 'agent.approval.requested', {
          approvalId: approvalEvent.approval.id,
          risk: approvalEvent.approval.risk,
          toolExposureMode: run.toolExposure.mode,
        });
        return this.replyPipeline.buildResult({
          run,
          text: [
            'I need your approval to continue safely.',
          '',
          narrative.userMessage,
        ].join('\n'),
      });
    }

    let executorResult: UniversalAgentExecutorResult;
    try {
      await this.publishRuntimeEvent(run, 'agent.execution.started', {
        executor: options.executor ? 'override' : this.executor ? 'configured' : 'runtime-resolution',
        toolExposureMode: run.toolExposure.mode,
      });
      await this.publishRuntimeEvent(run, 'agent.stream.lifecycle', {
        phase: 'executor-started',
        title: 'Generation started',
        summary: 'The governed executor accepted the run and is preparing the assistant response.',
        streamStatus: 'running',
        providerNativeTokenStreaming: false,
      });
      executorResult = await this.execute(run, input, options);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await this.publishRuntimeEvent(run, 'agent.execution.failed', {
        source: 'executor',
        error: error instanceof Error ? err.message : String(error),
      });
      return this.buildFailureResult(run, error, 'executor');
    }
    this.applyExecutorResult(run, executorResult);
    const replyText = normalizeText(
      executorResult.replyText,
      run.status === 'completed'
        ? run.summary
        : 'The request was recorded safely.',
    );
    finalAssistantText = replyText;
    const assistantStream = recordOrNull(executorResult.metadata?.llmRuntimeStream);
    if (assistantStream?.assistantStreamEmitted === true) {
      await this.publishAssistantReplyStreamDone(run, replyText, {
        source: 'executor-result-finalization',
        providerNativeTokenStreaming: assistantStream.providerNativeTokenStreaming === true,
        nativeStreamFinalizedByExecutorResult: true,
        providerName: assistantStream.providerName || null,
        modelName: assistantStream.modelName || null,
      });
    } else {
      await this.publishAssistantReplyStream(run, replyText, {
        source: 'executor-result',
        providerNativeTokenStreaming: false,
      });
    }
    const llmBrain = this.applyLlmBrainMaturity(run, input, executorResult);
    await this.publishLlmBrainRuntimeEvents(run, llmBrain, input);
    await this.publishRuntimeEvent(run, 'agent.execution.completed', {
      status: run.status,
      eventCount: run.events.length,
      artifactCount: run.artifacts.length,
      memorySignalCount: run.memorySignals.length,
    });
    this.applyCapabilityLoopGovernance(run, input);

    this.onRunCompleted?.(run, input, replyText);
    await this.applyNativeAutonomySpine(run, input, finalAssistantText || run.summary);

      return this.replyPipeline.buildResult({
        run,
        text: replyText,
      });
    } finally {
      if (run) {
        await this.corePipeline.finalize(run, baseline);
        if (!run.metadata.nativeAutonomySpine) {
          await this.applyNativeAutonomySpine(run, input, finalAssistantText || run.summary);
        }
        await runPluginOsHook({
          event: 'agent.after_turn',
          workspace: String(input.workspace || run.workspace || '').trim() || null,
          context: {
            runId: run.id,
            status: run.status,
            summary: run.summary || null,
            eventCount: run.events.length,
          },
        });
      }
    }
  }

  public createNaturalFirstMemoryContinuityIfNeeded(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    return this.governanceSupport.createNaturalFirstMemoryContinuityIfNeeded(run, request);
  }

  public applyNaturalFirstApprovalSafety(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): void {
    return this.governanceSupport.applyNaturalFirstApprovalSafety(run, request);
  }

  public createNaturalFirstApprovalFallbackIfNeeded(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    return this.governanceSupport.createNaturalFirstApprovalFallbackIfNeeded(run, request);
  }

  public createAgenticManagedAgentPreviewIfNeeded(
    run: UniversalAgentRun,
  ): UniversalAgentRunResult | null {
    return this.governanceSupport.createAgenticManagedAgentPreviewIfNeeded(run);
  }

  public async resumeApprovedRun(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    options: AgentRunExecutionOptions = {},
  ): Promise<UniversalAgentRunResult> {
    return this.governanceSupport.resumeApprovedRun(run, request, options);
  }

  public applyTrustSliderReview(
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    return this.governanceSupport.applyTrustSliderReview(run, input);
  }

  public async executeApprovedAgenticManagedAgentIfNeeded(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): Promise<UniversalAgentRunResult | null> {
    return this.governanceSupport.executeApprovedAgenticManagedAgentIfNeeded(run, request);
  }

  public applyUniversalIntentTrustEnforcement(
    run: UniversalAgentRun,
    request?: UniversalAgentRequest | null,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ): UniversalIntentTrustEnforcementSnapshot {
    return this.approvalGovernanceSupport.applyUniversalIntentTrustEnforcement(run, request, generatedAt);
  }

  public applyCapabilityLoopGovernance(
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
    trustSlider: TrustSliderPolicyDecision | null = null,
  ): void {
    return this.approvalGovernanceSupport.applyCapabilityLoopGovernance(run, input, trustSlider);
  }

  public applySafetyNarrative(
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.approvalGovernanceSupport.applySafetyNarrative(run, generatedAt);
  }

  public applyEvidenceSnapshotChainOnce(
    run: UniversalAgentRun,
    input: UniversalAgentRequest | null,
    generatedAt: string,
  ): void {
    return this.approvalGovernanceSupport.applyEvidenceSnapshotChainOnce(run, input, generatedAt);
  }

  public applyMemoryWithReceipts(
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.approvalGovernanceSupport.applyMemoryWithReceipts(run, generatedAt);
  }

  public async applyAutomaticSkillInvocationIfNeeded(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): Promise<void> {
    return this.approvalGovernanceSupport.applyAutomaticSkillInvocationIfNeeded(run, request);
  }

  public applySkillMcpQuarantine(
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.approvalGovernanceSupport.applySkillMcpQuarantine(run, generatedAt);
  }

  public applyCapabilityNegotiation(
    run: UniversalAgentRun,
    request?: UniversalAgentRequest,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ): CapabilityNegotiationSnapshot | null {
    return this.approvalGovernanceSupport.applyCapabilityNegotiation(run, request, generatedAt);
  }

  public markCapabilityNegotiationApprovedIfNeeded(
    run: UniversalAgentRun,
    approvedAt: string = run.updatedAt || this.now().toISOString(),
  ): void {
    return this.approvalGovernanceSupport.markCapabilityNegotiationApprovedIfNeeded(run, approvedAt);
  }

  public applyToolRehearsal(
    run: UniversalAgentRun,
    request?: UniversalAgentRequest,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ): ToolRehearsalSnapshot | null {
    return this.approvalGovernanceSupport.applyToolRehearsal(run, request, generatedAt);
  }

  public markToolRehearsalApprovedIfNeeded(
    run: UniversalAgentRun,
    approvedAt: string = run.updatedAt || this.now().toISOString(),
  ): void {
    return this.approvalGovernanceSupport.markToolRehearsalApprovedIfNeeded(run, approvedAt);
  }

  public readModelPickerContractForProviderArena() {
    if (!this.modelPickerContractService) {
      return null;
    }
    try {
      return this.modelPickerContractService.buildContract({ includeAdvanced: true });
    } catch (error: unknown) {return null;
    }
  }

  public finishCoreDietBaseline(run: UniversalAgentRun, baseline: CoreDietBaselineDraft): void {
    this.metadataEvidenceHelpers.finishCoreDietBaseline(
      run,
      baseline,
      this.countScheduledEvidenceWorkerJobs(run),
    );
  }

  public countScheduledEvidenceWorkerJobs(run: UniversalAgentRun): number {
    const evidenceWorkers = recordOrNull(run.metadata.evidenceWorkers);
    const receipts = Array.isArray(evidenceWorkers?.receipts) ? evidenceWorkers.receipts : [];
    return receipts.filter((receipt) => recordOrNull(receipt)?.status === 'scheduled').length;
  }

  public applyMetadataDiet(run: UniversalAgentRun): void {
    this.metadataEvidenceHelpers.applyMetadataDiet(run, this.evidenceStore.snapshot(run).refs);
  }

  public async publishRuntimeEvent(
    run: UniversalAgentRun,
    type: AgentRunRuntimeEventType,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    return this.runtimeEventSupport.publishRuntimeEvent(run, type, payload);
  }

  public async publishAssistantReplyStream(
    run: UniversalAgentRun,
    text: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    return this.runtimeEventSupport.publishAssistantReplyStream(run, text, metadata);
  }

  public async publishAssistantReplyStreamDone(
    run: UniversalAgentRun,
    text: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    return this.runtimeEventSupport.publishAssistantReplyStreamDone(run, text, metadata);
  }

  public chunkAssistantStreamText(text: string): string[] {
    return this.runtimeEventSupport.chunkAssistantStreamText(text);
  }

  public appendRuntimeEventReceipt(run: UniversalAgentRun, receipt: Record<string, unknown>): void {
    return this.runtimeEventSupport.appendRuntimeEventReceipt(run, receipt);
  }

  public getRuntimeEventBuses(): AgentRunRuntimeEventBus[] {
    return this.runtimeEventSupport.getRuntimeEventBuses();
  }

  public readRuntimeEventBusSnapshot(): unknown {
    return this.runtimeEventSupport.readRuntimeEventBusSnapshot();
  }

  public resolveRuntimeEventSurfaceChatId(run: UniversalAgentRun): string | null {
    return this.runtimeEventSupport.resolveRuntimeEventSurfaceChatId(run);
  }

  public resolveRuntimeEventMetadataText(run: UniversalAgentRun, key: string): string | null {
    return this.runtimeEventSupport.resolveRuntimeEventMetadataText(run, key);
  }

  public applyCachedEvidenceSnapshot<TSnapshot extends Record<string, unknown>>(
    run: UniversalAgentRun,
    key: string,
    buildSnapshot: () => TSnapshot,
    attachSnapshot: (snapshot: TSnapshot) => void,
  ): TSnapshot {
    return this.runtimeEventSupport.applyCachedEvidenceSnapshot(run, key, buildSnapshot, attachSnapshot);
  }

  public createRun(input: UniversalAgentRequest, baseline?: CoreDietBaselineDraft): UniversalAgentRun {
    const run = this.runFactory.createRun(input);
    if (baseline) {
      this.metadataEvidenceHelpers.rememberCoreDietBaseline(run, baseline);
    }
    this.evidencePipeline.applyInitial({
      run,
      request: input,
      generatedAt: run.updatedAt,
    });
    return run;
  }

  public applyIntelligenceFabricCanary(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    options: AgentRunExecutionOptions = {},
  ): void {
    return this.executionSupport.applyIntelligenceFabricCanary(run, request, options);
  }

  public applyIntelligenceFabricDraftGuidanceIfRequested(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    return this.executionSupport.applyIntelligenceFabricDraftGuidanceIfRequested(run, request);
  }

  public async execute(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    options: AgentRunExecutionOptions = {},
  ): Promise<UniversalAgentExecutorResult> {
    return this.executionSupport.execute(run, request, options);
  }

  public async applyNativeAutonomySpine(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    replyText: string,
  ): Promise<void> {
    return this.executionSupport.applyNativeAutonomySpine(run, request, replyText);
  }

  public applyExecutorResult(
    run: UniversalAgentRun,
    result: UniversalAgentExecutorResult,
  ): void {
    return this.executionSupport.applyExecutorResult(run, result);
  }

  public markAcceptedSteeringApplied(run: UniversalAgentRun, now: string): void {
    return this.executionSupport.markAcceptedSteeringApplied(run, now);
  }

  public applyLlmBrainMaturity(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    executorResult: UniversalAgentExecutorResult,
  ): ZavorthLlmBrainSnapshot {
    return this.executionSupport.applyLlmBrainMaturity(run, request, executorResult);
  }

  public async publishLlmBrainRuntimeEvents(
    run: UniversalAgentRun,
    snapshot: ZavorthLlmBrainSnapshot,
    request?: UniversalAgentRequest,
  ): Promise<void> {
    return this.executionSupport.publishLlmBrainRuntimeEvents(run, snapshot, request);
  }

  public isComplexSkillPromotionRun(
    run: UniversalAgentRun,
    snapshot: ZavorthLlmBrainSnapshot,
  ): boolean {
    return this.executionSupport.isComplexSkillPromotionRun(run, snapshot);
  }

  public defenseReviewMetadataKey(phase: AgentRunRiskReviewStage): string {
    return this.executionSupport.defenseReviewMetadataKey(phase);
  }

  public applyDefenseReview(
    run: UniversalAgentRun,
    phase: AgentRunRiskReviewStage,
    metadataTarget: Record<string, unknown>,
    now: string = this.now().toISOString(),
  ): void {
    return this.executionSupport.applyDefenseReview(run, phase, metadataTarget, now);
  }

  public buildFailureResult(
    run: UniversalAgentRun,
    error: unknown,
    source: string,
  ): UniversalAgentRunResult {
    return this.executionSupport.buildFailureResult(run, error, source);
  }

}

installAgentRunSpecializedFlows(AgentRunService);
