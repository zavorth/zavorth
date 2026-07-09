import { ReplyPipeline } from '../reply/ReplyPipeline.js';
import { GeminiManagedAgentExecutor } from '../../execution/GeminiManagedAgentExecutor.js';
import { resolveZavorthArtifactPolicyFromMetadata, shouldPersistZavorthArtifacts } from '../../contracts/ZavorthResponseDecisionContract.js';
import {
  DynamicHierarchySwarmService,
} from '../../domain/execution/infrastructure/DynamicHierarchySwarmService.js';
import {
  SwarmScalePlaneService,
} from '../../domain/execution/infrastructure/SwarmScalePlaneService.js';
import type {
  SelfModificationCommandService,
} from '../../services/SelfModificationCommandService.js';
import type {
  ComputerUseWatchModeService,
} from '../../services/ComputerUseWatchModeService.js';
import { AgentRunCanonicalContextService } from './AgentRunCanonicalContextService.js';
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
  AgentRunSteeringStream,
  type AgentRunSteeringStreamAction,
} from './AgentRunSteeringStream.js';
import { applyAgentRunLlmRuntimeRouteReceipt } from './AgentRunLlmRouteReceipt.js';
import {
  AgentRunEchoHandsExecutor,
  type UniversalAgentToolRuntime,
} from './AgentRunEchoHandsExecutor.js';
import { AgentRunCorePipeline } from './AgentRunCorePipeline.js';
import {
  AgentRunIntelligenceFabricCanary,
  type AgentRunIntelligenceFabricMode,
} from './AgentRunIntelligenceFabricCanary.js';
import { promoteIntelligenceFabricDraftWorkspaceWrites } from './AgentRunIntelligenceFabricDraftPromotion.js';
import { AgentRunExecutorBoundary } from './AgentRunExecutorBoundary.js';
import {
  AgentRunMetadataEvidenceHelpers,
  type CoreDietBaselineDraft,
} from './AgentRunMetadataEvidenceHelpers.js';
import {
  AgentRunEvidencePipeline,
  type AgentRunEvidenceCollectorId,
  type AgentRunEvidencePipelineStep,
  type AgentRunEvidenceWorker,
} from './AgentRunEvidencePipeline.js';
import { AgentRunEvidenceStore } from './AgentRunEvidenceStore.js';
import { installAgentRunSpecializedFlows } from './AgentRunSpecializedFlows.js';
import { CapabilityLoopGovernanceService } from './CapabilityLoopGovernanceService.js';
import { TrustSliderPolicyService } from '../uni/TrustSliderPolicyService.js';
import type {
  TrustSliderPolicyDecision,
} from '../uni/UniversalIntentContracts.js';
import {
  FailureSemanticsRegistry,
} from './FailureSemanticsRegistry.js';
import { AgentRunFailureResultBuilder } from './AgentRunFailureResultBuilder.js';
import {
  ExecutionEscalationPolicy,
} from './ExecutionEscalationPolicy.js';
import {
  CapabilityNegotiationService,
  type CapabilityNegotiationSnapshot,
} from './CapabilityNegotiationService.js';
import {
  ToolRehearsalService,
  type ToolRehearsalSnapshot,
} from './ToolRehearsalService.js';
import { MemoryWithReceiptsService } from './MemoryWithReceiptsService.js';
import { ProviderArenaService } from './ProviderArenaService.js';
import { SelfingZavorthControlService } from './SelfingZavorthControlService.js';
import { ArtifactMemoryService } from './ArtifactMemoryService.js';
import {
  ZavorthLlmBrainService,
} from '../../services/ZavorthLlmBrainService.js';
import type { ZavorthLlmBrainSnapshot } from '../../contracts/ZavorthLlmBrainContract.js';
import type { ZavorthNativeAutonomySpineService } from '../../services/ZavorthNativeAutonomySpineService.js';
import { PersonalOpsAutopilotService } from './PersonalOpsAutopilotService.js';
import { AgentTeamCompilerService } from './AgentTeamCompilerService.js';
import { CrossChannelContinuityService } from './CrossChannelContinuityService.js';
import { AskBeforeAssumptionPolicyService } from './AskBeforeAssumptionPolicyService.js';
import { ProviderMeshConsolidationService } from './ProviderMeshConsolidationService.js';
import {
  UniversalIntentTrustEnforcementService,
  type UniversalIntentTrustEnforcementSnapshot,
} from './UniversalIntentTrustEnforcementService.js';
import { RunArtifactReceiptReplayService } from './RunArtifactReceiptReplayService.js';
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
import { AgentRunAuditHooks } from './security/AgentRunAuditHooks.js';
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
export type { UniversalAgentLlmRuntime } from './AgentRunLlmRuntimeExecutor.js';
export type { UniversalAgentToolRuntime } from './AgentRunEchoHandsExecutor.js';

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
  selfingZavorthControl?: SelfingZavorthControlService | null;
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
  providerArena?: ProviderArenaService | null;
  skillMcpQuarantine?: SkillMcpQuarantineService | null;
  autoSkillInvocation?: Pick<AgentRunAutomaticSkillInvocationService, 'apply'> | null;
  llmBrain?: Pick<ZavorthLlmBrainService, 'buildRunSnapshot'> | null;
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

export function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function defaultIdFactory(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export class AgentRunService {
  declare private applyProviderArena: Function;
  declare private applyProviderMeshConsolidation: Function;
  declare private applyArtifactMemory: Function;
  declare private applyPersonalOpsAutopilot: Function;
  declare private applyAgentTeamCompiler: Function;
  declare private applyAskBeforeAssumptionPolicy: Function;
  declare private applyCrossChannelContinuity: Function;
  declare private applySelfingZavorthControl: Function;
  declare private applyRunArtifactReceiptReplay: Function;
  declare private applyProductizationEvidence: Function;
  declare private applyProductEntryRuntime: Function;
  declare private applyReleaseInstallerRollbackPath: Function;
  declare private applyPublicSiteDocsDemoSync: Function;
  declare private applyFeedbackTelemetryProductLoop: Function;
  declare private applyPublicAdoptionPilotLoop: Function;
  declare private applyIntegrationShowcasePartnerSurface: Function;
  declare private applyReleaseAdoptionReadiness: Function;
  declare private applyReleaseCandidatePreCanaryGate: Function;
  declare private applyBlueprintCompletionGate: Function;
  declare private resolveTrustSliderDecision: Function;
  declare public serializeTrustSliderDecision: Function;
  declare private resolveTrustSliderLevel: Function;
  declare private resolveTrustSliderUserRole: Function;
  declare private resolveBooleanFlag: Function;
  declare private createUniversalPreviewResultIfRequested: Function;
  declare private createCapabilityNegotiationProposalIfNeeded: Function;
  declare private createCapabilityNegotiationBlockedResult: Function;
  declare private createToolRehearsalProposalIfNeeded: Function;
  declare private createToolRehearsalBlockedResult: Function;
  declare private createSwarmEscalationProposalIfNeeded: Function;
  declare private createSelfModificationPreviewIfNeeded: Function;
  declare private createSelfModificationActionProposalIfNeeded: Function;
  declare public canExecute: Function;
  declare public shouldBypassCapabilityNegotiationForSpecializedFlow: Function;
  declare private shouldProposeSwarmEscalation: Function;
  declare private shouldCreateSelfModificationPreview: Function;
  declare private shouldUseNaturalCapabilityDiscoveryWithoutNegotiation: Function;
  declare private hasResolvedTool: Function;
  declare private collectResolvedToolIds: Function;
  declare private collectNaturalCapabilityToolIds: Function;
  declare private collectSpecializedToolIdsFromText: Function;
  declare private serializeSelfModificationPreview: Function;
  declare private buildSelfModificationPreviewReply: Function;
  declare private buildUniversalPreviewReply: Function;
  declare private buildCapabilityNegotiationReply: Function;
  declare private buildToolRehearsalReply: Function;
  declare private acknowledgeApprovedSelfModificationActionProposalIfNeeded: Function;
  declare private createWatchModeVisualProposalIfNeeded: Function;
  declare private acknowledgeApprovedWatchModeVisualProposalIfNeeded: Function;
  declare private serializeWatchModeRun: Function;
  declare private buildWatchModeVisualProposalReply: Function;
  declare private resolveWatchModeVisualRequest: Function;
  declare private resolveWatchModeTargetWindow: Function;
  declare private isWatchModePolicyAllowlisted: Function;
  declare private buildSelfModificationActionProposalReply: Function;
  declare private resolveSelfModificationActionRequest: Function;
  declare private resolveSelfModificationActionTargetId: Function;
  declare private extractSelfModificationTargetIdFromText: Function;
  declare private resolveSuggestedSubagents: Function;
  declare private buildSwarmEscalationReply: Function;
  declare private executeApprovedSwarmProposalIfNeeded: Function;
  declare private serializeSwarmLaunchResult: Function;
  declare private buildSwarmExecutionReply: Function;
  declare private resolveSwarmScalePlan: Function;
  declare private shouldUseSwarmScalePlane: Function;
  declare private executeApprovedSwarmScaleProposal: Function;
  declare private serializeSwarmScaleSnapshot: Function;
  declare private buildSwarmScaleProposalReply: Function;
  declare private buildSwarmScaleExecutionReply: Function;

  readonly now: () => Date;
  readonly idFactory: (prefix: string) => string;
  private runtimeEventBus: AgentRunRuntimeEventBus | null;
  private readonly runtimeEventBusSubscribers: AgentRunRuntimeEventBus[] = [];
  private readonly evidenceWorkerMode: 'inline' | 'async-heavy' | 'worker-first-heavy';
  private readonly evidenceWorker: AgentRunEvidenceWorker | null;
  private readonly asyncEvidenceCollectorIds: AgentRunEvidenceCollectorId[] | null;
  readonly executor: UniversalAgentExecutor | null;
  readonly llmRuntimeExecutor: AgentRunLlmRuntimeExecutor;
  readonly steeringStream: AgentRunSteeringStream;
  private readonly onRunCreated: ((run: UniversalAgentRun, request: UniversalAgentRequest) => void) | null;
  private readonly onRunCompleted: ((run: UniversalAgentRun, request: UniversalAgentRequest, replyText: string) => void) | null;
  private readonly corePipeline: AgentRunCorePipeline<CoreDietBaselineDraft>;
  private readonly executorBoundary: AgentRunExecutorBoundary;
  private readonly swarmHierarchyService: SwarmHierarchyRuntime | null;
  private readonly swarmScalePlaneService: SwarmScalePlaneRuntime | null;
  private selfModificationService: SelfModificationRuntime | null;
  private watchModeService: WatchModeRuntime | null;
  private readonly toolRuntime: UniversalAgentToolRuntime | null;
  private readonly echoHandsExecutor: AgentRunEchoHandsExecutor;
  private readonly toolPolicy: ToolExposurePolicy;
  private readonly runBudgetPolicy: RunBudgetPolicy;
  private readonly policyKernel: AgentRunPolicyKernel;
  private readonly failureResultBuilder: AgentRunFailureResultBuilder;
  readonly intelligenceFabricCanary: AgentRunIntelligenceFabricCanary;
  private readonly executionEscalationPolicy: ExecutionEscalationPolicy;
  readonly replyPipeline: ReplyPipeline;
  readonly evidencePipeline: AgentRunEvidencePipeline;
  private readonly evidenceStore: AgentRunEvidenceStore;
  private readonly canonicalContextService: AgentRunCanonicalContextService;
  private readonly runFactory: AgentRunFactory;
  readonly riskHooks: AgentRunRiskHooks;
  readonly auditHooks: AgentRunAuditHooks;
  private readonly trustSliderPolicy: TrustSliderPolicyService;
  readonly capabilityLoopGovernance: CapabilityLoopGovernanceService;
  readonly safetyNarrative: SafetyNarrativeService;
  readonly memoryWithReceipts: MemoryWithReceiptsService;
  readonly capabilityNegotiation: CapabilityNegotiationService;
  readonly toolRehearsal: ToolRehearsalService;
  private readonly selfingZavorthControl: SelfingZavorthControlService;
  private readonly artifactMemory: ArtifactMemoryService;
  private readonly personalOpsAutopilot: PersonalOpsAutopilotService;
  private readonly agentTeamCompiler: AgentTeamCompilerService;
  private readonly crossChannelContinuity: CrossChannelContinuityService;
  private readonly askBeforeAssumptionPolicy: AskBeforeAssumptionPolicyService;
  private readonly providerMeshConsolidation: ProviderMeshConsolidationService;
  readonly universalIntentTrustEnforcement: UniversalIntentTrustEnforcementService;
  private readonly runArtifactReceiptReplay: RunArtifactReceiptReplayService;
  private readonly productizationEvidence: ProductizationEvidenceService;
  private readonly productEntryRuntime: ProductEntryRuntimeService;
  private readonly releaseInstallerRollbackPath: ReleaseInstallerRollbackPathService;
  private readonly publicSiteDocsDemoSync: PublicSiteDocsDemoSyncService;
  private readonly feedbackTelemetryProductLoop: FeedbackTelemetryProductLoopService;
  private readonly publicAdoptionPilotLoop: PublicAdoptionPilotLoopService;
  private readonly integrationShowcasePartnerSurface: IntegrationShowcasePartnerSurfaceService;
  private readonly releaseAdoptionReadiness: ReleaseAdoptionReadinessService;
  private readonly releaseCandidatePreCanaryGate: ReleaseCandidatePreCanaryGateService;
  private readonly blueprintCompletionGate: BlueprintCompletionGateService;
  private readonly providerArena: ProviderArenaService;
  readonly skillMcpQuarantine: SkillMcpQuarantineService;
  readonly autoSkillInvocation: Pick<AgentRunAutomaticSkillInvocationService, 'apply'> | null;
  readonly llmBrain: Pick<ZavorthLlmBrainService, 'buildRunSnapshot'>;
  private readonly nativeAutonomySpine: Pick<ZavorthNativeAutonomySpineService, 'buildSnapshot'> | null;
  private readonly modelPickerContractService: AgentRunModelPickerContractService | null;
  private readonly naturalFirstApprovalSafety: NaturalFirstApprovalSafetyService;
  private readonly naturalFirstMemoryContinuity: NaturalFirstMemoryContinuityService;
  private readonly metadataEvidenceHelpers = new AgentRunMetadataEvidenceHelpers();
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
    this.echoHandsExecutor = new AgentRunEchoHandsExecutor();
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
    this.selfingZavorthControl = runtime.selfingZavorthControl || new SelfingZavorthControlService({
      now: this.now,
    });
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
    this.providerArena = runtime.providerArena || new ProviderArenaService({
      now: this.now,
    });
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
    this.nativeAutonomySpine = runtime.nativeAutonomySpine || null;
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
  }

  public attachSelfModificationService(service: SelfModificationRuntime | null | undefined): void {
    this.selfModificationService = service || null;
  }

  public attachWatchModeService(service: WatchModeRuntime | null | undefined): void {
    this.watchModeService = service || null;
  }

  public attachRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
    this.runtimeEventBus = service || null;
  }

  public addRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
    if (!service || this.runtimeEventBusSubscribers.includes(service)) {
      return;
    }
    this.runtimeEventBusSubscribers.push(service);
  }

  public removeRuntimeEventBus(service: AgentRunRuntimeEventBus | null | undefined): void {
    if (!service) {
      return;
    }
    const index = this.runtimeEventBusSubscribers.indexOf(service);
    if (index >= 0) {
      this.runtimeEventBusSubscribers.splice(index, 1);
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
    const now = this.now().toISOString();
    const backoffMs = Math.max(0, Number(input.backoffMs || 0));
    const maxAttempts = Math.max(1, Number(input.maxAttempts || 1));
    const entry: UniversalAgentSteeringEntry = {
      id: this.idFactory('agent-steer'),
      runId: run.id,
      sessionId: normalizeText(input.sessionId, run.sessionId),
      text,
      source: normalizeText(input.source, 'operator-steering'),
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
      ackId: this.idFactory('steering-ack'),
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
    this.syncRunSteeringMetadata(run);
    this.publishSteeringFrame(run, entry, 'accepted');
    return entry;
  }

  public cancelSteering(
    run: UniversalAgentRun,
    steeringId: string,
    reason = 'Cancelled by operator.',
    metadata: Record<string, unknown> | null = null,
  ): UniversalAgentSteeringEntry | null {
    const target = this.findSteeringEntry(run, steeringId);
    if (!target || target.status === 'cancelled') {
      return target || null;
    }
    const now = this.now().toISOString();
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
      detail: target.cancelReason,
      status: 'done',
      createdAt: now,
      metadata: {
        steeringId: target.id,
        ackId: target.ackId,
        nativeAgentRunSteering: true,
      },
    });
    this.syncRunSteeringMetadata(run);
    this.publishSteeringFrame(run, target, 'cancelled');
    return target;
  }

  public replaceSteering(
    run: UniversalAgentRun,
    steeringId: string,
    input: AgentRunSteeringInput,
  ): UniversalAgentSteeringEntry | null {
    const target = this.findSteeringEntry(run, steeringId);
    if (!target || target.status === 'cancelled') {
      return null;
    }
    const now = this.now().toISOString();
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
    const replacement = this.recordSteering(run, {
      ...input,
      replaceTargetId: target.id,
    });
    target.replacedById = replacement.id;
    target.updatedAt = replacement.createdAt;
    this.syncRunSteeringMetadata(run);
    this.publishSteeringFrame(run, target, 'superseded');
    return replacement;
  }

  public recordLifecycleDefenseReview(
    run: UniversalAgentRun,
    phase: AgentRunRiskReviewStage,
    now: string = this.now().toISOString(),
  ): void {
    this.applyDefenseReview(run, phase, run.metadata, now);
    run.updatedAt = now;
  }

  public readEvidenceSnapshot(
    run: UniversalAgentRun,
    keyOrRefId: string,
  ): Record<string, unknown> | null {
    return this.evidenceStore.get(run, keyOrRefId)
      || this.evidenceStore.getByRef(run, keyOrRefId);
  }

  public snapshotEvidenceRefs(run: UniversalAgentRun) {
    return this.evidenceStore.snapshot(run);
  }

  private findSteeringEntry(
    run: UniversalAgentRun,
    steeringId: string,
  ): UniversalAgentSteeringEntry | null {
    const id = normalizeText(steeringId);
    if (!id) return null;
    return (run.steering || []).find((entry) => entry.id === id || entry.id.startsWith(id)) || null;
  }

  private syncRunSteeringMetadata(run: UniversalAgentRun): void {
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

  private publishSteeringFrame(
    run: UniversalAgentRun,
    entry: UniversalAgentSteeringEntry,
    action: AgentRunSteeringStreamAction,
  ): void {
    const frame = this.steeringStream.publish(run.id, entry, action);
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

  private createPolicyKernel(): AgentRunPolicyKernel {
    return new AgentRunPolicyKernel({
      now: this.now,
      idFactory: this.idFactory,
      evaluateTrust: (run, request) => this.applyTrustSliderReview(run, request),
      evaluateBudget: (run, request) => this.runBudgetPolicy.evaluate({ request, run }),
      reviewPreExecution: (run) => this.applyDefenseReview(run, 'pre-executor', run.metadata),
    });
  }

  private createCorePipeline(): AgentRunCorePipeline<CoreDietBaselineDraft> {
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

  private createEvidencePipeline(): AgentRunEvidencePipeline {
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
      await this.publishRuntimeEvent(run, 'agent.execution.failed', {
        source: 'executor',
        error: error instanceof Error ? error.message : String(error),
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
    await this.publishLlmBrainRuntimeEvents(run, llmBrain);
    await this.publishRuntimeEvent(run, 'agent.execution.completed', {
      status: run.status,
      eventCount: run.events.length,
      artifactCount: run.artifacts.length,
      memorySignalCount: run.memorySignals.length,
    });
    this.applyCapabilityLoopGovernance(run, input);

    this.onRunCompleted?.(run, input, replyText);

      return this.replyPipeline.buildResult({
        run,
        text: replyText,
      });
    } finally {
      if (run) {
        await this.corePipeline.finalize(run, baseline);
        await this.applyNativeAutonomySpine(run, input, finalAssistantText || run.summary);
      }
    }
  }

  private createNaturalFirstMemoryContinuityIfNeeded(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    if (!this.naturalFirstMemoryContinuity.shouldHandle(run, request)) {
      return null;
    }
    const generatedAt = this.now().toISOString();
    const memoryWithReceipts = this.applyMemoryWithReceipts(run, generatedAt);
    return this.naturalFirstMemoryContinuity.apply({
      run,
      request,
      generatedAt,
      memoryWithReceipts,
    });
  }

  private applyNaturalFirstApprovalSafety(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): void {
    this.naturalFirstApprovalSafety.record({
      run,
      request,
      generatedAt: this.now().toISOString(),
    });
  }

  private createNaturalFirstApprovalFallbackIfNeeded(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    const generatedAt = this.now().toISOString();
    const snapshot = this.naturalFirstApprovalSafety.record({
      run,
      request,
      generatedAt,
    });
    if (!this.naturalFirstApprovalSafety.shouldOpenFallbackApproval(snapshot)) {
      return null;
    }
    return this.naturalFirstApprovalSafety.openFallbackApproval({
      run,
      request,
      generatedAt,
      idFactory: this.idFactory,
    });
  }

  private createAgenticManagedAgentPreviewIfNeeded(
    run: UniversalAgentRun,
  ): UniversalAgentRunResult | null {
    const agenticRoute = recordOrNull(run.metadata.agenticRoute);
    if (normalizeText(agenticRoute?.selectedRoute) !== 'remote-agent-preview') {
      return null;
    }
    const existingApprovalId = normalizeText(agenticRoute?.approvalId);
    const existingApproval = existingApprovalId
      ? run.approvals.find((approval) => approval.id === existingApprovalId)
      : null;
    if (existingApproval?.status === 'approved') {
      return null;
    }

    const now = this.now().toISOString();
    const approval: UniversalApprovalRequest = existingApproval || {
      id: this.idFactory('agent-approval'),
      runId: run.id,
      title: 'Approve isolated execution',
      reason: normalizeText(
        agenticRoute?.explanation,
        'This request may need isolated analysis or execution; Zavorth needs approval before calling a remote agent.',
      ),
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
      id: this.idFactory('agent-event'),
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

    return this.replyPipeline.buildResult({
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

  public async resumeApprovedRun(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    options: AgentRunExecutionOptions = {},
  ): Promise<UniversalAgentRunResult> {
    run.status = 'running';
    run.summary = 'Approval received. Execution resumed safely.';
    run.updatedAt = this.now().toISOString();
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: 'status',
      title: 'Execution resumed',
      detail: 'The approval gate released the scoped execution path.',
      status: 'done',
      createdAt: run.updatedAt,
    });
    this.markCapabilityNegotiationApprovedIfNeeded(run, run.updatedAt);
    this.markToolRehearsalApprovedIfNeeded(run, run.updatedAt);
    this.applyDefenseReview(run, 'resume', run.metadata, run.updatedAt);

    try {
      const swarmResult = await this.executeApprovedSwarmProposalIfNeeded(run, request);
      if (swarmResult) {
        return swarmResult;
      }
    } catch (error: unknown) {return this.buildFailureResult(run, error, 'swarm');
    }

    const selfModificationActionResult = this.acknowledgeApprovedSelfModificationActionProposalIfNeeded(run, request);
    if (selfModificationActionResult) {
      return selfModificationActionResult;
    }

    try {
      const watchModeVisualResult = await this.acknowledgeApprovedWatchModeVisualProposalIfNeeded(run, request);
      if (watchModeVisualResult) {
        return watchModeVisualResult;
      }
    } catch (error: unknown) {return this.buildFailureResult(run, error, 'watch-mode');
    }

    this.applyToolRehearsal(run, request, run.updatedAt);
    const toolRehearsalProposal = this.createToolRehearsalProposalIfNeeded(run, request);
    if (toolRehearsalProposal) {
      return toolRehearsalProposal;
    }

    const agenticManagedAgentResult = await this.executeApprovedAgenticManagedAgentIfNeeded(run, request);
    if (agenticManagedAgentResult) {
      return agenticManagedAgentResult;
    }

    await this.applyAutomaticSkillInvocationIfNeeded(run, request);

    let executorResult: UniversalAgentExecutorResult;
    try {
      executorResult = await this.execute(run, request, options);
    } catch (error: unknown) {return this.buildFailureResult(run, error, 'executor');
    }
    this.applyExecutorResult(run, executorResult);
    this.applyCapabilityLoopGovernance(run, request);
    const replyText = normalizeText(
      executorResult.replyText,
      run.summary || 'Execution resumed safely.',
    );
    await this.publishAssistantReplyStream(run, replyText, {
      source: 'approval-resume',
      providerNativeTokenStreaming: false,
    });

    return this.replyPipeline.buildResult({
      run,
      text: replyText,
    });
  }

  private applyTrustSliderReview(
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
  ): UniversalAgentRunResult | null {
    const now = this.now().toISOString();
    const enforcement = this.applyUniversalIntentTrustEnforcement(run, input, now);
    const decision = enforcement.trustSlider;
    const metadata = this.serializeTrustSliderDecision(decision);
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
      id: this.idFactory('agent-event'),
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
    return this.replyPipeline.buildResult({
      run,
      text: [
        'No tools were executed.',
        '',
        narrative.userMessage,
      ].join('\n'),
    });
  }

  private async executeApprovedAgenticManagedAgentIfNeeded(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): Promise<UniversalAgentRunResult | null> {
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
      execution_id: this.idFactory('execution'),
      task_id: run.id,
      executor: 'gemini_managed_agent',
      workspace: normalizeText(request.workspace || run.workspace, 'workspace-not-declared'),
      objective: request.text,
      instructions: [
        'Execute somente a analise solicitada dentro da fronteira governada.',
        'Nao tente persistir segredos, credenciais ou historico server-side.',
        'Retorne conclusao, evidencias e proximos passos seguros.',
      ],
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
    const now = this.now().toISOString();
    const success = execution.success === true;
    const replyText = normalizeText(
      execution.stdout,
      success
        ? 'Remote agent completed governed execution.'
        : normalizeText(execution.error_message, 'Remote agent did not complete execution.'),
    );
    const executorResult: UniversalAgentExecutorResult = {
      status: success ? 'completed' : 'failed',
      summary: success
        ? 'Isolated execution completed by the governed remote agent.'
        : 'Isolated execution failed or was refused by the remote agent policy.',
      replyText,
      events: [
        {
          kind: success ? 'reply' : 'error',
          title: success ? 'Execucao isolada concluida' : 'Execucao isolada indisponivel',
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
    this.applyExecutorResult(run, executorResult);
    this.applyCapabilityLoopGovernance(run, request);
    await this.publishAssistantReplyStream(run, replyText, {
      source: 'agentic-managed-agent',
      providerNativeTokenStreaming: false,
    });
    return this.replyPipeline.buildResult({ run, text: replyText });
  }

  private applyUniversalIntentTrustEnforcement(
    run: UniversalAgentRun,
    request?: UniversalAgentRequest | null,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ): UniversalIntentTrustEnforcementSnapshot {
    const snapshot = this.universalIntentTrustEnforcement.buildSnapshot({
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

  private applyCapabilityLoopGovernance(
    run: UniversalAgentRun,
    input: UniversalAgentRequest,
    trustSlider: TrustSliderPolicyDecision | null = null,
  ): void {
    const generatedAt = this.now().toISOString();
    const snapshot = this.capabilityLoopGovernance.buildSnapshot({
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
      id: this.idFactory('agent-event'),
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

  private applySafetyNarrative(
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    const narrative = this.safetyNarrative.buildSnapshot({
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

  private applyEvidenceSnapshotChainOnce(
    run: UniversalAgentRun,
    input: UniversalAgentRequest | null,
    generatedAt: string,
  ): void {
    if (this.appliedEvidenceSnapshotChains.has(run)) {
      return;
    }

    this.appliedEvidenceSnapshotChains.add(run);
    this.evidencePipeline.applySecondary({
      run,
      request: input,
      generatedAt,
    });
  }

  private applyMemoryWithReceipts(
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    const snapshot = this.memoryWithReceipts.buildSnapshot({
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

  private async applyAutomaticSkillInvocationIfNeeded(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): Promise<void> {
    if (!this.autoSkillInvocation) {
      return;
    }
    const existing = recordOrNull(run.metadata.autoSkillInvocation);
    if (existing && ['selected', 'blocked', 'failed'].includes(normalizeText(existing.status))) {
      return;
    }
    try {
      await this.autoSkillInvocation.apply({ run, request });
    } catch (error: unknown) {
      const generatedAt = this.now().toISOString();
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
        id: this.idFactory('agent-event'),
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

  private applySkillMcpQuarantine(
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    const snapshot = this.skillMcpQuarantine.buildSnapshot({
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

  private applyCapabilityNegotiation(
    run: UniversalAgentRun,
    request?: UniversalAgentRequest,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ): CapabilityNegotiationSnapshot | null {
    const existing = recordOrNull(run.metadata.capabilityNegotiation);
    const existingStatus = normalizeText(existing?.status);
    if (existingStatus === 'waiting-approval' || existingStatus === 'approved') {
      return existing as CapabilityNegotiationSnapshot;
    }
    if (request && this.shouldBypassCapabilityNegotiationForSpecializedFlow(run, request)) {
      return null;
    }

    const snapshot = this.capabilityNegotiation.buildSnapshot({
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

  private markCapabilityNegotiationApprovedIfNeeded(
    run: UniversalAgentRun,
    approvedAt: string = run.updatedAt || this.now().toISOString(),
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

  private applyToolRehearsal(
    run: UniversalAgentRun,
    request?: UniversalAgentRequest,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ): ToolRehearsalSnapshot | null {
    const existing = recordOrNull(run.metadata.toolRehearsal);
    const existingStatus = normalizeText(existing?.status);
    if (existingStatus === 'waiting-approval' || existingStatus === 'approved') {
      return existing as ToolRehearsalSnapshot;
    }

    const snapshot = this.toolRehearsal.buildSnapshot({
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

  private markToolRehearsalApprovedIfNeeded(
    run: UniversalAgentRun,
    approvedAt: string = run.updatedAt || this.now().toISOString(),
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

  private readModelPickerContractForProviderArena() {
    if (!this.modelPickerContractService) {
      return null;
    }
    try {
      return this.modelPickerContractService.buildContract({ includeAdvanced: true });
    } catch (error: unknown) {return null;
    }
  }

  private finishCoreDietBaseline(run: UniversalAgentRun, baseline: CoreDietBaselineDraft): void {
    this.metadataEvidenceHelpers.finishCoreDietBaseline(
      run,
      baseline,
      this.countScheduledEvidenceWorkerJobs(run),
    );
  }

  private countScheduledEvidenceWorkerJobs(run: UniversalAgentRun): number {
    const evidenceWorkers = recordOrNull(run.metadata.evidenceWorkers);
    const receipts = Array.isArray(evidenceWorkers?.receipts) ? evidenceWorkers.receipts : [];
    return receipts.filter((receipt) => recordOrNull(receipt)?.status === 'scheduled').length;
  }

  private applyMetadataDiet(run: UniversalAgentRun): void {
    this.metadataEvidenceHelpers.applyMetadataDiet(run, this.evidenceStore.snapshot(run).refs);
  }

  private async publishRuntimeEvent(
    run: UniversalAgentRun,
    type: AgentRunRuntimeEventType,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    const eventBuses = this.getRuntimeEventBuses();
    const receipt = {
      type,
      emittedAt: this.now().toISOString(),
      runId: run.id,
      status: run.status,
    };
    this.appendRuntimeEventReceipt(run, {
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
      surfaceChatId: this.resolveRuntimeEventSurfaceChatId(run),
      surfaceThreadId: this.resolveRuntimeEventMetadataText(run, 'threadId'),
      surfaceTaskId: this.resolveRuntimeEventMetadataText(run, 'taskId'),
    };
    let delivered = 0;
    const errors: string[] = [];
    try {
      for (const eventBus of eventBuses) {
        try {
          await eventBus.emit(type, runtimePayload);
          delivered += 1;
        } catch (error: unknown) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (delivered === 0 && errors.length > 0) {
        throw new Error(errors.join('; '));
      }
      this.appendRuntimeEventReceipt(run, {
        ...receipt,
        delivery: errors.length > 0 ? 'partial' : 'delivered',
        delivered,
        failed: errors.length,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      });
    } catch (error: unknown) {
      this.appendRuntimeEventReceipt(run, {
        ...receipt,
        delivery: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async publishAssistantReplyStream(
    run: UniversalAgentRun,
    text: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const replyText = normalizeText(text);
    if (!replyText) {
      return;
    }
    const chunks = this.chunkAssistantStreamText(replyText);
    const streamId = `${run.id}:assistant`;
    await this.publishRuntimeEvent(run, 'agent.stream.assistant', {
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
      await this.publishRuntimeEvent(run, 'agent.stream.assistant', {
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

    await this.publishRuntimeEvent(run, 'agent.stream.assistant', {
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

  private async publishAssistantReplyStreamDone(
    run: UniversalAgentRun,
    text: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const replyText = normalizeText(text);
    if (!replyText) {
      return;
    }
    await this.publishRuntimeEvent(run, 'agent.stream.assistant', {
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

  private chunkAssistantStreamText(text: string): string[] {
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

  private appendRuntimeEventReceipt(run: UniversalAgentRun, receipt: Record<string, unknown>): void {
    const existing = recordOrNull(run.metadata.runtimeEventBus);
    const events = Array.isArray(existing?.events) ? existing.events.slice(-19) : [];
    run.metadata = {
      ...run.metadata,
      runtimeEventBus: {
        source: 'AgentRunService',
        stage: 2,
        phase: 2,
        configured: this.getRuntimeEventBuses().length > 0,
        subscriberCount: this.getRuntimeEventBuses().length,
        snapshot: this.readRuntimeEventBusSnapshot(),
        events: [
          ...events,
          receipt,
        ],
      },
    };
  }

  private getRuntimeEventBuses(): AgentRunRuntimeEventBus[] {
    return [
      this.runtimeEventBus,
      ...this.runtimeEventBusSubscribers,
    ].filter((eventBus): eventBus is AgentRunRuntimeEventBus => Boolean(eventBus));
  }

  private readRuntimeEventBusSnapshot(): unknown {
    return this.getRuntimeEventBuses().map((eventBus, index) => {
      if (!eventBus.snapshot) {
        return { index, snapshot: null };
      }
      try {
        return { index, snapshot: eventBus.snapshot() };
      } catch (error: unknown) {return { index, snapshot: null };
      }
    });
  }

  private resolveRuntimeEventSurfaceChatId(run: UniversalAgentRun): string | null {
    return this.resolveRuntimeEventMetadataText(run, 'chatId')
      || this.resolveRuntimeEventMetadataText(run, 'surfaceChatId')
      || run.sessionId
      || null;
  }

  private resolveRuntimeEventMetadataText(run: UniversalAgentRun, key: string): string | null {
    const metadata = recordOrNull(run.metadata);
    const text = String(metadata?.[key] ?? '').trim();
    return text || null;
  }

  private applyCachedEvidenceSnapshot<TSnapshot extends Record<string, unknown>>(
    run: UniversalAgentRun,
    key: string,
    buildSnapshot: () => TSnapshot,
    attachSnapshot: (snapshot: TSnapshot) => void,
  ): TSnapshot {
    const fingerprint = this.metadataEvidenceHelpers.buildEvidenceSnapshotFingerprint(run);
    const existing = recordOrNull(run.metadata[key]);
    if (this.metadataEvidenceHelpers.readEvidenceSnapshotFingerprint(run, key) === fingerprint) {
      const cached = existing || this.metadataEvidenceHelpers.readCachedEvidenceSnapshot(run, key);
      if (cached) {
        this.metadataEvidenceHelpers.recordCoreDietSnapshot(run, key, 'cache-hit');
        return cached as TSnapshot;
      }
    }

    const snapshot = buildSnapshot();
    const material = existing || this.metadataEvidenceHelpers.isMaterialEvidenceSnapshot(snapshot);
    this.metadataEvidenceHelpers.writeCachedEvidenceSnapshot(run, key, snapshot);
    this.evidenceStore.put(run, key, snapshot, Boolean(material));
    if (!material) {
      this.metadataEvidenceHelpers.writeEvidenceSnapshotFingerprint(run, key, fingerprint);
      this.metadataEvidenceHelpers.recordCoreDietSnapshot(run, key, 'built-skipped');
      return snapshot;
    }

    attachSnapshot(snapshot);
    this.metadataEvidenceHelpers.writeEvidenceSnapshotFingerprint(run, key, fingerprint);
    this.metadataEvidenceHelpers.recordCoreDietSnapshot(run, key, 'built-attached');
    return snapshot;
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

  private applyIntelligenceFabricCanary(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    options: AgentRunExecutionOptions = {},
  ): void {
    this.intelligenceFabricCanary.apply({
      run,
      request,
      canOrientModel: !options.executor && !this.executor && this.llmRuntimeExecutor.isAvailable(),
    });
  }

  private applyIntelligenceFabricDraftGuidanceIfRequested(
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
    const result = this.intelligenceFabricCanary.applyDraftGuidancePlan({
      run,
      planId,
      permissionId: normalizeText(metadata.intelligenceFabricApprovalId),
      approvedBy: normalizeText(metadata.approvedBy) || request.userId,
      approveNow: metadata.intelligenceFabricApproveDraftPlan === true,
    });
    const now = this.now().toISOString();
    run.updatedAt = now;
    run.status = result.applied ? 'completed' : result.status === 'waiting_approval' ? 'waiting_approval' : 'failed';
    run.summary = result.summary;
    run.metadata = { ...run.metadata, intelligenceFabricDraftApply: result };
    run.events.push({
      id: this.idFactory('agent-event'),
      runId: run.id,
      kind: result.applied ? 'artifact' : 'approval',
      title: result.applied ? 'Rascunho aplicado pelo Mutation Plane' : 'Rascunho aguardando approval',
      detail: result.summary,
      status: result.applied ? 'done' : 'pending',
      createdAt: now,
      metadata: { planId: result.planId, status: result.status, approvalRequired: result.approvalRequired, diffReceipt: result.diffReceipt, diffReceiptText: result.diffReceiptText, rollbackArtifactPath: result.execution?.rollbackArtifactPath || null },
    });
    return this.replyPipeline.buildResult({ run, text: result.summary });
  }

  private async execute(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    options: AgentRunExecutionOptions = {},
  ): Promise<UniversalAgentExecutorResult> {
    const profileBundle = resolveProfileRuntimeBundleFromRun(run);
    return executionContextScope.run({
      traceId: run.traceId,
      runId: run.id,
      sessionId: run.sessionId,
      surface: run.channel,
      requestedBy: run.userId,
      profile: normalizeText(run.metadata.profile, profileBundle?.id || ''),
      workspace: run.workspace || request.workspace || null,
      profileBundle,
      metadata: run.metadata,
    }, () => this.executorBoundary.execute({
      run,
      request,
      executorOverride: options.executor,
      toolRuntimeOverride: options.toolRuntime,
    }));
  }

  private async applyNativeAutonomySpine(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    replyText: string,
  ): Promise<void> {
    if (!this.nativeAutonomySpine) return;
    const generatedAt = this.now().toISOString();
    try {
      const snapshot = await this.nativeAutonomySpine.buildSnapshot({
        turn: {
          turnId: run.id,
          sessionId: run.sessionId,
          userId: run.userId,
          outcome: run.status === 'completed' ? 'success' : run.status === 'failed' ? 'failure' : 'interrupted',
          userMessage: request.text,
          assistantResponse: replyText,
          toolReceipts: run.events.slice(-40).map((event) => ({
            id: event.id,
            kind: event.kind,
            status: event.status,
            summary: event.title,
          })),
          toolCallCount: Math.max(
            run.events.filter((event) => event.kind === 'tool').length,
            request.requestedTools?.length || 0,
          ),
          sourceSurface: run.channel,
        },
      });
      run.metadata = {
        ...run.metadata,
        nativeAutonomySpine: snapshot,
      };
      run.events.push({
        id: this.idFactory('agent-event'),
        runId: run.id,
        kind: 'memory',
        title: 'Native autonomy spine reviewed turn',
        detail: 'Turn-end learning, Skill Forge, channel proof and backend proof were projected without live side effects.',
        status: 'done',
        createdAt: generatedAt,
        metadata: {
          source: 'ZavorthNativeAutonomySpineService',
          status: snapshot.status,
          candidates: snapshot.learning.candidates.length,
          skillDrafts: snapshot.skillForge.drafts.length,
          quietLanes: snapshot.reviewCenter.quietLanes,
        },
      });
    } catch (error: unknown) {
      run.metadata = {
        ...run.metadata,
        nativeAutonomySpine: {
          version: 'native-autonomy-spine/v1',
          status: 'attention',
          error: error instanceof Error ? error.message : String(error),
          rawSecretsSerialized: false,
        },
      };
    }
  }

  private applyExecutorResult(
    run: UniversalAgentRun,
    result: UniversalAgentExecutorResult,
  ): void {
    const now = this.now().toISOString();
    run.status = result.status || 'completed';
    run.summary = normalizeText(result.summary, run.summary);
    run.updatedAt = now;
    this.markAcceptedSteeringApplied(run, now);
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
      idFactory: this.idFactory,
    });
    run.memorySignals = result.memorySignals || run.memorySignals;
    run.metadata = mergedMetadata;
    promoteIntelligenceFabricDraftWorkspaceWrites({ run, canary: this.intelligenceFabricCanary, now, idFactory: this.idFactory });
    this.evidencePipeline.applyPostExecutor({
      run,
      request: null,
      generatedAt: now,
    });
    (result.events || []).forEach((event) => {
      run.events.push({
        id: event.id || this.idFactory('agent-event'),
        runId: run.id,
        kind: event.kind,
        title: event.title,
        detail: event.detail,
        status: event.status,
        createdAt: event.createdAt || now,
        metadata: event.metadata,
      });
    });
    this.applyDefenseReview(run, 'post-executor', run.metadata, now);
    this.evidencePipeline.applySecondary({
      run,
      request: null,
      generatedAt: now,
    });
    this.syncRunSteeringMetadata(run);
  }

  private markAcceptedSteeringApplied(run: UniversalAgentRun, now: string): void {
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
      this.publishSteeringFrame(run, entry, 'applied');
    }
  }

  private applyLlmBrainMaturity(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
    executorResult: UniversalAgentExecutorResult,
  ): ZavorthLlmBrainSnapshot {
    const snapshot = this.llmBrain.buildRunSnapshot({
      run,
      request,
      executorResult,
    });
    run.metadata = {
      ...run.metadata,
      zavorthLlmBrain: snapshot,
    };
    run.events.push({
      id: this.idFactory('agent-event'),
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

  private async publishLlmBrainRuntimeEvents(
    run: UniversalAgentRun,
    snapshot: ZavorthLlmBrainSnapshot,
  ): Promise<void> {
    await this.publishRuntimeEvent(run, 'agent.stream.lifecycle', {
      brainMode: snapshot.brainMode,
      streamEvents: snapshot.streaming.events.length,
      visualStreamingReady: snapshot.streaming.visualStreamingReady,
      status: snapshot.status,
    });
    if (snapshot.toolAgency.requested > 0) {
      await this.publishRuntimeEvent(run, 'agent.stream.tool', {
        requested: snapshot.toolAgency.requested,
        executed: snapshot.toolAgency.executed,
        denied: snapshot.toolAgency.denied,
        deferred: snapshot.toolAgency.sideEffectsDeferred,
      });
    }
    if (snapshot.streaming.events.some((event) => event.kind === 'assistant')) {
      await this.publishRuntimeEvent(run, 'agent.stream.assistant', {
        replyEvents: snapshot.streaming.events.filter((event) => event.kind === 'assistant').length,
        rawChainOfThoughtExposed: false,
      });
    }
    if (snapshot.skillEvolution.status === 'candidate-ready') {
      await this.publishRuntimeEvent(run, 'agent.skill.evolution.candidate', {
        candidateKind: snapshot.skillEvolution.candidateKind,
        approvalRequired: snapshot.skillEvolution.approvalRequired,
        suggestedCommand: snapshot.skillEvolution.suggestedCommand,
      });
    }
    if (snapshot.qa.requiresHumanLiveQa) {
      await this.publishRuntimeEvent(run, 'agent.adapter.proof.required', {
        channel: snapshot.adapterCoverage.channel,
        provider: snapshot.adapterCoverage.provider,
        route: snapshot.adapterCoverage.route,
        longTailFamilies: snapshot.adapterCoverage.longTailFamilies,
      });
    }
  }

  private defenseReviewMetadataKey(phase: AgentRunRiskReviewStage): string {
    if (phase === 'pre-executor') {
      return 'preExecutor';
    }
    if (phase === 'post-executor') {
      return 'postExecutor';
    }
    return phase;
  }

  private applyDefenseReview(
    run: UniversalAgentRun,
    phase: AgentRunRiskReviewStage,
    metadataTarget: Record<string, unknown>,
    now: string = this.now().toISOString(),
  ): void {
    const review = this.riskHooks.review({ run, phase });
    const lifecycleDefense = recordOrNull(metadataTarget.lifecycleDefense) || {};
    metadataTarget.lifecycleDefense = {
      ...lifecycleDefense,
      [this.defenseReviewMetadataKey(phase)]: review,
    };
    run.events.push(this.auditHooks.buildRiskReviewEvent({
      run,
      review,
      now,
      idFactory: this.idFactory,
    }));
  }

  private buildFailureResult(
    run: UniversalAgentRun,
    error: unknown,
    source: string,
  ): UniversalAgentRunResult {
    return this.failureResultBuilder.build(run, error, source);
  }

}

function resolveProfileRuntimeBundleFromRun(run: UniversalAgentRun): ProfileRuntimeBundle | null {
  const direct = recordOrNull(run.metadata.profileBundle)
    || recordOrNull(run.metadata.profileRuntimeBundle);
  if (!direct) {
    return null;
  }
  if (
    typeof direct.id !== 'string'
    || typeof direct.checksum !== 'string'
    || !recordOrNull(direct.runtimePolicy)
    || !recordOrNull(direct.runtimePolicyBundle)
    || !recordOrNull(direct.cognitiveContextBundle)
  ) {
    return null;
  }
  return direct as ProfileRuntimeBundle;
}

installAgentRunSpecializedFlows(AgentRunService);
