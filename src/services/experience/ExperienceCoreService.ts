import { ActionCardService } from './ActionCardService.js';
import { defaultZavorthSpeculativeAutonomyCancellationRegistry } from '../../autonomy/ZavorthSpeculativeAutonomyService.js';
import { ZavorthRuntimeStateBusService } from '../ZavorthRuntimeStateBusService.js';
import {
  ZavorthRuntimeCapabilitiesService,
  type ZavorthRuntimeCapabilitiesSnapshot,
} from '../ZavorthRuntimeCapabilitiesService.js';
import {
  ZavorthRuntimeOperationalSpineService,
  type ZavorthRuntimeOperationalSpineSyncInput,
  type ZavorthRuntimeOperationalSpineSyncResult,
} from '../ZavorthRuntimeOperationalSpineService.js';
import { ZavorthRuntimeSecureIntegrationService } from '../ZavorthRuntimeSecureIntegrationService.js';

import { logger } from '../../logger.js';
import { tService } from '../../i18n/services.js';
import {
  EXPERIENCE_COMMAND_CONTRACT_VERSION,
  EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
  EXPERIENCE_SNAPSHOT_CONTRACT_VERSION,
  LEARNING_CANDIDATE_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceActionCard,
  type ExperienceApproval,
  type ExperienceApprovalSurfaceProjection,
  type ExperienceCommand,
  type ExperienceCommandResult,
  type ExperienceHealthStatus,
  type ExperienceLearningCandidate,
  type ExperienceMemorySignal,
  type ExperienceReceipt,
  type ExperienceResponseProfileId,
  type ExperienceSnapshot,
  type ExperienceSurface,
  type ExperienceTimelineItem,
} from './ExperienceContracts.js';
import { projectResponseForChannel } from '../../domain/surface/application/surface-projection/projectors/SurfaceProjectorRegistry.js';
import { buildAgentPermissionApprovalResponse } from '../permission/AgentPermissionApprovalPresentation.js';

import { AutoHealingProjectionService } from './AutoHealingProjectionService.js';
import { ContextRecoveryService } from './ContextRecoveryService.js';
import { PulseBriefService } from './PulseBriefService.js';
import { DiffReviewService } from './DiffReviewService.js';
import { ExecutionGraphService } from './ExecutionGraphService.js';
import { JourneyEngineService } from './JourneyEngineService.js';
import { LearningOSService } from './LearningOSService.js';
import { NaturalCommandRouterService } from './NaturalCommandRouterService.js';
import { ReasoningSummaryService } from './ReasoningSummaryService.js';
import { ResponseProfilePreferenceService } from './ResponseProfilePreferenceService.js';
import { TrustLensService } from './TrustLensService.js';
import type {
  UniversalAgentModelProfile,
  UniversalAgentRun,
  UniversalAgentRunResult,
  UniversalApprovalRequest,
} from '../../runtime/agent/UniversalAgentRuntimeTypes.js';
import type {
  ZavorthAgentGateway,
  ZavorthAgentGatewaySnapshot,
  ZavorthAgentGatewaySnapshotOptions,
} from '../../runtime/agent/ZavorthAgentGateway.js';

import { ZavorthProviderReadinessMatrixService } from '../ZavorthProviderReadinessMatrixService.js';
import { ZavorthSelfHealingUxService } from '../ZavorthSelfHealingUxService.js';
import {
  ZavorthSelfHealingReceiptService,
  type ZavorthSelfHealingReceipt,
} from '../ZavorthSelfHealingReceiptService.js';
import type { ZavorthMemoryPlaneService } from '../ZavorthMemoryPlaneService.js';
import type { ZavorthLearningPlaneService } from '../ZavorthLearningPlaneService.js';
import type { RuntimeAccessReadinessService } from '../../runtime/access/RuntimeAccessReadinessService.js';
import type {
  ZavorthSelfHealingAction,
  ZavorthSelfHealingProjection,
} from '../../contracts/ZavorthSelfHealingUxContract.js';
import type { ZavorthLlmBrainSnapshot } from '../../contracts/ZavorthLlmBrainContract.js';
import type { UniversalAgentRequest } from '../../runtime/agent/UniversalAgentRuntimeTypes.js';
import { ZavorthAgentMaturityService, type ZavorthAgentMaturitySnapshot } from '../ZavorthAgentMaturityService.js';

import type {
  ZavorthRuntimeStateBusActionInput,
  ZavorthRuntimeStateBusDispatchResult,
  ZavorthRuntimeStateBusSnapshot,
} from '../../contracts/ZavorthRuntimeStateBusContract.js';
import { asErrorLike, errorMessage } from '../../utils/errorLike.js';
import { ExperienceProjectionSupport } from './ExperienceProjectionSupport.js';
import { ExperienceContinuitySupport } from './ExperienceContinuitySupport.js';
import { ExperienceActionDecisionSupport } from './ExperienceActionDecisionSupport.js';

type AgentGatewayLike = Pick<ZavorthAgentGateway, 'handle' | 'buildSnapshot' | 'approve' | 'reject'>;

export type ExperienceCoreRuntime = {
  now?: () => Date;
  agentGateway?: AgentGatewayLike | null;
  memoryPlane?: Pick<ZavorthMemoryPlaneService, 'buildSnapshot'> | null;
  learningPlane?:
    | (Pick<ZavorthLearningPlaneService, 'buildSnapshot' | 'executeAction'> &
        Partial<Pick<ZavorthLearningPlaneService, 'resetState' | 'exportState'>>)
    | null;
  runtimeAccessReadiness?: Pick<RuntimeAccessReadinessService, 'inspect'> | null;
  router?: NaturalCommandRouterService;
  learningOs?: LearningOSService;
  journeyEngine?: JourneyEngineService;
  trustLens?: TrustLensService;
  actionCards?: ActionCardService;
  diffReview?: DiffReviewService;
  executionGraph?: ExecutionGraphService;
  contextRecovery?: ContextRecoveryService;
  autoHealing?: AutoHealingProjectionService;
  reasoningSummary?: ReasoningSummaryService;
  pulseBrief?: PulseBriefService;
  responseProfiles?: ResponseProfilePreferenceService;
  selfHealingUx?: ZavorthSelfHealingUxService;
  selfHealingReceipts?: ZavorthSelfHealingReceiptService;
  providerReadinessMatrix?: Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'>;
  agentMaturity?: Pick<ZavorthAgentMaturityService, 'buildSnapshot'>;
  runtimeStateBus?: Pick<
    ZavorthRuntimeStateBusService,
    'buildSnapshot' | 'syncExperienceCommand' | 'dispatch' | 'appendReceipt'
  > | null;
  runtimeOperationalSpine?: Pick<ZavorthRuntimeOperationalSpineService, 'syncOperationalState'> | null;
  runtimeSecureIntegration?: Pick<ZavorthRuntimeSecureIntegrationService, 'dispatch'> | null;
};

export type ExperienceHomeInput = {
  surface?: ExperienceSurface;
  sessionId?: string | null;
  workspace?: string | null;
  activeRunId?: string | null;
  activeTraceId?: string | null;
  userId?: string | null;
  responseProfile?: ExperienceResponseProfileId | null;
  metadata?: Record<string, unknown> | null;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function isLiveRunStatus(status: unknown): boolean {
  return status === 'queued' || status === 'thinking' || status === 'running' || status === 'waiting_approval';
}

function isLiveWorkflowJobStatus(status: unknown): boolean {
  return status === 'waiting_approval' || status === 'queued' || status === 'running';
}

function inferRequestedTimeZone(text: string): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/\b(brasilia|sao\s+paulo|brazil|brasil)\b/.test(normalized)) return 'America/Sao_Paulo';
  if (/\b(utc|gmt)\b/.test(normalized)) return 'UTC';
  if (/\b(new\s+york|nyc|eastern)\b/.test(normalized)) return 'America/New_York';
  if (/\b(london|londres)\b/.test(normalized)) return 'Europe/London';
  if (/\b(tokyo|toquio)\b/.test(normalized)) return 'Asia/Tokyo';
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function isSimpleDateTimeQuestion(text: string): boolean {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const asksTime = /\b(que\s+horas|hora\s+atual|horas\s+sao|what\s+time|current\s+time|tell\s+me\s+the\s+time)\b/.test(
    normalized,
  );
  const asksDate = /\b(que\s+dia|data\s+atual|dia\s+de\s+hoje|what\s+date|today'?s\s+date|current\s+date)\b/.test(
    normalized,
  );
  return asksTime || asksDate;
}

function buildLocalDateTimeAnswer(text: string, now: Date): string | null {
  if (!isSimpleDateTimeQuestion(text)) return null;
  const timeZone = inferRequestedTimeZone(text);
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    }).format(now);
    return `It is now ${formatted} in ${timeZone}.`;
  } catch (error: unknown) {
    logger.warn(`[ExperienceCore] Intl.DateTimeFormat failed for timezone ${timeZone}:`, error);
    return `It is now ${now.toLocaleString('en-US')} in the system local timezone.`;
  }
}

function action(input: {
  id: string;
  label: string;
  kind: ExperienceAction['kind'];
  reason: string;
  command?: string | null;
  route?: string | null;
  risk?: ExperienceAction['risk'];
  requiresApproval?: boolean;
}): ExperienceAction {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    command: input.command ?? null,
    route: input.route ?? null,
    risk: input.risk || 'safe',
    requiresApproval: input.requiresApproval === true,
    reason: input.reason,
  };
}

export class ExperienceCoreService {
  private readonly __experienceCoreBrand = true;
  public readonly projectionSupport: ExperienceProjectionSupport;
  public readonly continuitySupport: ExperienceContinuitySupport;
  public readonly actionDecisionSupport: ExperienceActionDecisionSupport;
  public readonly now: () => Date;
  public readonly agentGateway: AgentGatewayLike | null;
  public readonly memoryPlane: ExperienceCoreRuntime['memoryPlane'];
  public readonly runtimeAccessReadiness: ExperienceCoreRuntime['runtimeAccessReadiness'];
  public readonly router: NaturalCommandRouterService;
  public readonly learningOs: LearningOSService;
  public readonly journeyEngine: JourneyEngineService;
  public readonly trustLens: TrustLensService;
  public readonly actionCards: ActionCardService;
  public readonly diffReview: DiffReviewService;
  public readonly executionGraph: ExecutionGraphService;
  public readonly contextRecovery: ContextRecoveryService;
  public readonly autoHealing: AutoHealingProjectionService;
  public readonly reasoningSummary: ReasoningSummaryService;
  public readonly pulseBrief: PulseBriefService;
  public readonly responseProfiles: ResponseProfilePreferenceService;
  public readonly selfHealingUx: ZavorthSelfHealingUxService;
  public readonly selfHealingReceipts: ZavorthSelfHealingReceiptService;
  public readonly providerReadinessMatrix: Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'>;
  public readonly agentMaturity: Pick<ZavorthAgentMaturityService, 'buildSnapshot'>;
  public readonly runtimeStateBus: Pick<
    ZavorthRuntimeStateBusService,
    'buildSnapshot' | 'syncExperienceCommand' | 'dispatch' | 'appendReceipt'
  > | null;
  public readonly runtimeOperationalSpine: Pick<ZavorthRuntimeOperationalSpineService, 'syncOperationalState'> | null;
  public readonly runtimeSecureIntegration: Pick<ZavorthRuntimeSecureIntegrationService, 'dispatch'> | null;

  constructor(runtime: ExperienceCoreRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.agentGateway = runtime.agentGateway || null;
    this.memoryPlane = runtime.memoryPlane || null;
    this.runtimeAccessReadiness = runtime.runtimeAccessReadiness || null;
    this.router = runtime.router || new NaturalCommandRouterService();
    this.learningOs =
      runtime.learningOs ||
      new LearningOSService({
        now: this.now,
        learningPlane: runtime.learningPlane || null,
      });
    this.journeyEngine = runtime.journeyEngine || new JourneyEngineService();
    this.trustLens = runtime.trustLens || new TrustLensService();
    this.actionCards = runtime.actionCards || new ActionCardService();
    this.diffReview = runtime.diffReview || new DiffReviewService();
    this.executionGraph = runtime.executionGraph || new ExecutionGraphService();
    this.contextRecovery = runtime.contextRecovery || new ContextRecoveryService();
    this.autoHealing = runtime.autoHealing || new AutoHealingProjectionService();
    this.reasoningSummary = runtime.reasoningSummary || new ReasoningSummaryService();
    this.pulseBrief = runtime.pulseBrief || new PulseBriefService();
    this.responseProfiles = runtime.responseProfiles || new ResponseProfilePreferenceService({ now: this.now });
    this.selfHealingUx = runtime.selfHealingUx || new ZavorthSelfHealingUxService();
    this.selfHealingReceipts = runtime.selfHealingReceipts || new ZavorthSelfHealingReceiptService({ now: this.now });
    this.providerReadinessMatrix =
      runtime.providerReadinessMatrix || new ZavorthProviderReadinessMatrixService({ now: this.now });
    this.agentMaturity = runtime.agentMaturity || new ZavorthAgentMaturityService();
    this.runtimeStateBus =
      runtime.runtimeStateBus === null
        ? null
        : runtime.runtimeStateBus || new ZavorthRuntimeStateBusService({ now: this.now });
    this.runtimeOperationalSpine =
      runtime.runtimeOperationalSpine === null || !this.runtimeStateBus
        ? null
        : runtime.runtimeOperationalSpine ||
          new ZavorthRuntimeOperationalSpineService({
            now: this.now,
            runtimeStateBus: this.runtimeStateBus,
          });
    this.runtimeSecureIntegration =
      runtime.runtimeSecureIntegration === null || !this.runtimeStateBus
        ? null
        : runtime.runtimeSecureIntegration ||
          new ZavorthRuntimeSecureIntegrationService({
            now: this.now,
            runtimeStateBus: this.runtimeStateBus,
          });
    this.projectionSupport = new ExperienceProjectionSupport(this);
    this.continuitySupport = new ExperienceContinuitySupport(this);
    this.actionDecisionSupport = new ExperienceActionDecisionSupport(this);
  }

  public buildHome(input: ExperienceHomeInput = {}): ExperienceSnapshot {
    const surface = input.surface || 'web';
    const sessionId = input.sessionId || null;
    const workspace = input.workspace || null;
    const userId = normalizeText(input.userId, 'local-user');
    const persistedProfile = this.responseProfiles.get({ surface, userId });
    const agentSnapshot = this.safeAgentSnapshot({
      activeRunId: input.activeRunId || null,
      activeTraceId: input.activeTraceId || null,
      activeSessionId: sessionId,
    });
    const activeRun = agentSnapshot?.activeRun || null;
    const runs = agentSnapshot?.runs || [];
    const jitMap = ((
      globalThis as unknown as { globalPendingJitApprovals: Map<string, unknown> }
    ).globalPendingJitApprovals ??= new Map());
    const jitApprovals: UniversalApprovalRequest[] = Array.from(jitMap.values()).map((jit: any) => ({
      id: jit.id,
      runId: String(jit.runId || activeRun?.id || 'jit-elevation'),
      title: `DYNAMIC ELEVATION: ${jit.type.toUpperCase()}`,
      reason: jit.message,
      risk: 'danger',
      status: 'pending',
      createdAt: jit.createdAt,
    }));
    const approvals = [...this.collectApprovals(runs), ...jitApprovals];
    const timeline = this.buildTimeline(activeRun, runs);
    const receipts = this.mergeExperienceReceipts(
      this.selfHealingReceipts.toExperienceReceipts(6),
      this.buildReceipts(activeRun, runs, approvals),
    );
    const memorySignals = this.buildMemorySignals(activeRun, workspace);
    const llmBrain = recordOrNull(activeRun?.metadata?.zavorthLlmBrain) as ZavorthLlmBrainSnapshot | null;
    const nativeAutonomySpine = this.buildNativeAutonomySpineProjection(
      recordOrNull(activeRun?.metadata?.nativeAutonomySpine),
    );
    const agentMaturity = this.agentMaturity.buildSnapshot({
      run: activeRun,
      request: activeRun
        ? ({
            userId,
            channel: activeRun.channel,
            text: activeRun.input || activeRun.title || '',
            workspace: workspace || activeRun.workspace || undefined,
            requestedTools: [],
          } as UniversalAgentRequest)
        : null,
      now: this.now(),
    }) as ZavorthAgentMaturitySnapshot;
    const learningCandidates = this.mergeLearningCandidates(
      this.learningOs.buildCandidates({ workspace }),
      this.buildLlmBrainLearningCandidates(activeRun, llmBrain),
    );
    const learningSummary = this.learningOs.buildSummary({ workspace });
    const pendingLearningCount = learningCandidates.filter((candidate) => candidate.state === 'pending').length;
    const trust = this.trustLens.build({
      activeRun,
      approvals,
      sandboxMode: normalizeText(activeRun?.metadata?.sandboxIsolation, 'governed-local'),
    });
    const health = this.buildHealth(agentSnapshot, pendingLearningCount, approvals);
    const generatedAt = this.now().toISOString();
    const diffReviews = this.diffReview.build({ activeRun, runs });
    const autoHealing = this.autoHealing.build({ activeRun });
    const executionGraph = this.executionGraph.build({ activeRun, runs, timeline, generatedAt });
    const reasoningSummary = this.reasoningSummary.build({ activeRun, timeline, trust });
    const learnedItems = this.listLearnedRuntimeItems(userId);
    const superpowersForCards = this.buildSuperpowersSnapshot(userId)
      .powers.filter((power) => power.ready)
      .slice(0, 3)
      .map((power) => ({
        id: power.id,
        title: power.title,
        summary: power.summary,
        howToAsk: power.howToAsk,
        ready: power.ready,
      }));
    const draftActionCards = this.actionCards.build({
      activeRun,
      approvals,
      learningCandidates,
      learnedItems,
      superpowers: superpowersForCards,
      diffReviews,
      autoHealing,
      now: this.now(),
    });
    const contextRecovery = this.contextRecovery.build({
      text: activeRun?.input || '',
      activeRun,
      runs,
      approvals,
      actionCards: draftActionCards,
      surface,
    });
    const firstRun = this.buildFirstRunSnapshot(userId);
    const baseActionCards = this.actionCards.build({
      activeRun,
      approvals,
      learningCandidates,
      learnedItems,
      superpowers: superpowersForCards,
      diffReviews,
      contextRecovery,
      autoHealing,
      now: this.now(),
    });
    const actionCards = this.mergeActionCards(
      this.buildFirstRunActionCards(firstRun),
      this.mergeActionCards(baseActionCards, this.buildSelfHealingCardsFromReceipts(this.selfHealingReceipts.list(4))),
    );
    const nextActions = firstRun.required
      ? this.buildFirstRunNextActions(firstRun)
      : this.buildNextActions(health.status, approvals.length, pendingLearningCount);
    const pendingApprovals = approvals.filter((approval) => approval.status === 'pending').length;
    const pulse = this.pulseBrief.build({
      surface,
      generatedAt,
      workspace: workspace || activeRun?.workspace || null,
      activeRun,
      runs,
      approvals,
      learningCandidates,
      learningPending: pendingLearningCount,
      learningSummary: learningSummary.summary,
      receipts,
      nextActions,
      actionCards,
      health,
      trust,
      requestedProfile: input.responseProfile || persistedProfile || null,
    });
    const runtimeState =
      input.metadata?.skipRuntimeProjection === true
        ? this.safeRuntimeStateSnapshot()
        : this.publishRuntimeStateProjection({
            surface,
            sessionId: sessionId || activeRun?.sessionId || null,
            userId,
            workspace: workspace || activeRun?.workspace || null,
            agentSnapshot,
            activeRun,
            approvals,
            pendingLearningCount,
            memorySignalCount: memorySignals.length,
            healthSummary: health.summary,
          });

    return {
      contractVersion: EXPERIENCE_SNAPSHOT_CONTRACT_VERSION,
      generatedAt,
      surface,
      sessionId: sessionId || activeRun?.sessionId || null,
      workspace: workspace || activeRun?.workspace || null,
      agent: {
        status: health.status,
        label: 'Zavorth Experience Core',
        summary: activeRun?.summary || health.summary,
        activeRunId: activeRun?.id || null,
        activeRunStatus: activeRun?.status || null,
        modelLabel: activeRun?.modelProfile?.modelLabel || null,
        providerLabel: activeRun?.modelProfile?.providerLabel || null,
      },
      journey: this.journeyEngine.buildSnapshot({ activeRun }),
      chat: {
        messages: this.buildChat(activeRun, runs),
        suggestions: firstRun.required
          ? firstRun.steps.find((step) => !step.done)?.examples.slice(0, 4) || ['english', 'telegram', 'yes']
          : [
              'what can you do?',
              'where can I find you?',
              tService('experience.review_workspace'),
              tService('experience.show_pending_learning'),
            ],
      },
      approvals: approvals.map((approval) => this.toExperienceApproval(approval)),
      timeline,
      receipts,
      memory: {
        signals: memorySignals,
        summary: memorySignals.length
          ? `${memorySignals.length} active memory signal(s).`
          : 'Memory is ready to capture validated context.',
      },
      learning: {
        candidates: learningCandidates,
        summary: learningSummary.summary,
        pending: pendingLearningCount,
      },
      firstRun,
      superpowers: this.buildSuperpowersSnapshot(userId),
      reach: this.buildReachSnapshot(),
      trust,
      daily: {
        summary: health.summary,
        activeTask: activeRun?.title || activeRun?.input || null,
        health: health.status,
        nextSteps: nextActions.map((item) => item.label).slice(0, 5),
        pendingApprovals,
        pendingLearning: pendingLearningCount,
        pulse,
        responseProfile: pulse.profile,
      },
      responseProfile: pulse.profile,
      actionCards,
      diffReviews,
      executionGraph,
      autoHealing,
      contextRecovery,
      reasoningSummary,
      llmBrain,
      agentMaturity,
      nextActions,
      health,
      // Stable cold-start surface for Desktop workboard hybrid sync.
      workboard: this.workboardProjectionFromRuntimeState(runtimeState),
      raw: {
        agentGateway: agentSnapshot
          ? {
              generatedAt: agentSnapshot.generatedAt,
              runCount: agentSnapshot.runs.length,
              workflowJobCount: agentSnapshot.workflowJobs.length,
              queueAdapter: agentSnapshot.workflowQueue.kind,
            }
          : null,
        nativeAutonomySpine,
        runtimeState,
        workboard: this.workboardProjectionFromRuntimeState(runtimeState),
      },
    };
  }

  public async executeCommand(input: Partial<ExperienceCommand> & { text: string }): Promise<ExperienceCommandResult> {
    const command: ExperienceCommand = {
      contractVersion: EXPERIENCE_COMMAND_CONTRACT_VERSION,
      text: normalizeText(input.text),
      intent: input.intent || 'ask',
      surface: input.surface || 'cli',
      userId: normalizeText(input.userId, 'local-user'),
      sessionId: input.sessionId || null,
      workspace: input.workspace || null,
      trustMode: input.trustMode || 'protected',
      autonomyMode: input.autonomyMode || 'governed',
      approval: input.approval || null,
      actionCardDecision: input.actionCardDecision || null,
      diffDecision: input.diffDecision || null,
      contextRecoveryDecision: input.contextRecoveryDecision || null,
      responseProfile: input.responseProfile || null,
      learning: input.learning || null,
      metadata: input.metadata || {},
    };
    if (command.responseProfile) {
      this.responseProfiles.set({
        surface: command.surface,
        userId: command.userId,
        profile: command.responseProfile,
        source: `command:${command.intent || 'ask'}`,
      });
    }
    const firstRunHandled = this.tryHandleFirstRunCommand(command);
    if (firstRunHandled) {
      return firstRunHandled;
    }

    const superpowersHandled = this.tryHandleSuperpowersCommand(command);
    if (superpowersHandled) {
      return superpowersHandled;
    }

    const reachHandled = this.tryHandleReachCommand(command);
    if (reachHandled) {
      return reachHandled;
    }

    const runtimeState = this.safeRuntimeStateSync(command);
    const runtimeWorkspace = this.workspacePathFromRuntimeState(runtimeState);
    if (!command.workspace && runtimeWorkspace) {
      command.workspace = runtimeWorkspace;
    }
    const runtimeModelProfile = this.modelProfileFromRuntimeState(runtimeState);
    const plan = this.router.route(command);

    try {
      if (command.approval?.id) {
        const meta = (command.metadata || {}) as Record<string, unknown>;
        const choice = String(meta.choice || meta.permissionChoice || command.approval.decision || 'once').trim();
        const surface = String(command.surface || 'experience').trim() || 'experience';
        let result: Awaited<ReturnType<NonNullable<typeof this.agentGateway>['approve']>> | null = null;
        let gateError: string | null = null;
        try {
          if (command.approval.decision === 'reject' || choice === 'deny') {
            result = (await this.agentGateway?.reject(command.approval.id)) ?? null;
          } else {
            result =
              (await this.agentGateway?.approve(command.approval.id, {
                surface,
                choice: choice === 'approve' ? 'once' : choice,
                workspaceId: command.workspace || null,
                sessionId: command.sessionId || null,
              })) ?? null;
          }
        } catch (error: unknown) {
          gateError = error instanceof Error ? error.message : String(error);
        }
        if (result) {
          this.publishRuntimeApprovalDecision(command, true);
        }
        const snapshot = result
          ? this.buildHome(command)
          : this.buildHome({
              ...command,
              metadata: {
                ...command.metadata,
                skipRuntimeProjection: true,
              },
            });
        const reply = this.replyFromText(
          gateError
            ? `Approval blocked: ${gateError}`
            : result
              ? `Approval ${command.approval.decision === 'approve' ? 'approved' : 'rejected'}: ${command.approval.id}.`
              : `I could not find a pending approval for ${command.approval.id}.`,
          command,
          result?.run?.id || null,
        );
        return this.finalizeCommandResult(command, {
          ok: Boolean(result) && !gateError,
          handled: true,
          plan,
          snapshot,
          replies: [reply],
          receipts: snapshot.receipts,
          error: gateError || (result ? null : 'Approval not found.'),
        });
      }

      if (command.learning?.decision) {
        const learning = await this.learningOs.decide({
          candidateId: command.learning.candidateId || null,
          decision: command.learning.decision,
          workspace: command.workspace || null,
        });
        const snapshot = this.buildHome(command);
        this.publishRuntimeLearningDecision(command, learning);
        this.attachRuntimeStateSnapshot(snapshot);
        const reply = this.replyFromText(learning.summary, command, null);
        return this.finalizeCommandResult(command, {
          ok: learning.ok,
          handled: true,
          plan,
          snapshot,
          replies: [reply],
          receipts: snapshot.receipts,
          error: learning.ok ? null : learning.summary,
        });
      }

      if (command.actionCardDecision?.cardId && command.actionCardDecision.actionId) {
        const cardResult = await this.handleActionCardDecision(command, plan);
        if (cardResult) return cardResult;
      }

      if (command.diffDecision?.reviewId) {
        const snapshot = this.buildHome(command);
        const diffResult = this.diffReview.evaluateDecision({
          reviews: snapshot.diffReviews || [],
          decision: command.diffDecision,
        });
        if (diffResult.contextRecovery) {
          snapshot.contextRecovery = diffResult.contextRecovery;
        }
        const reply = this.replyFromText(diffResult.summary, command, snapshot.agent.activeRunId);
        return this.finalizeCommandResult(command, {
          ok: diffResult.ok,
          handled: true,
          plan,
          snapshot,
          replies: [reply],
          receipts: snapshot.receipts,
          error: diffResult.ok ? null : diffResult.summary,
        });
      }

      if (command.contextRecoveryDecision?.recoveryId) {
        const snapshot = this.buildHome(command);
        const reply = this.replyFromText(
          `Context selected: ${command.contextRecoveryDecision.optionId}. I will keep using that target before any sensitive action runs.`,
          command,
          snapshot.agent.activeRunId,
        );
        return this.finalizeCommandResult(command, {
          ok: true,
          handled: true,
          plan,
          snapshot,
          replies: [reply],
          receipts: snapshot.receipts,
          error: null,
        });
      }

      if (
        plan.kind === 'zavorthControl' ||
        plan.kind === 'diagnostics' ||
        plan.kind === 'learning' ||
        plan.kind === 'memory'
      ) {
        const snapshot = this.buildHome(command);
        const reply = this.replyFromText(plan.nextSafeAction, command, snapshot.agent.activeRunId);
        return this.finalizeCommandResult(command, {
          ok: true,
          handled: true,
          plan,
          snapshot,
          replies: [reply],
          receipts: snapshot.receipts,
          error: null,
        });
      }

      const contextualSetupKind = this.contextualSetupKind(command, plan);
      if (contextualSetupKind) {
        return this.finalizeCommandResult(
          command,
          this.buildContextualSetupResult(command, {
            ...plan,
            kind: contextualSetupKind,
          }),
        );
      }

      const localDateTimeAnswer = buildLocalDateTimeAnswer(command.text, this.now());
      if (localDateTimeAnswer) {
        const snapshot = this.buildHome(command);
        return this.finalizeCommandResult(command, {
          ok: true,
          handled: true,
          plan,
          snapshot,
          replies: [this.replyFromText(localDateTimeAnswer, command, snapshot.agent.activeRunId)],
          receipts: snapshot.receipts,
          error: null,
        });
      }

      let runResult: UniversalAgentRunResult | null = null;
      if (plan.shouldExecuteAgent && this.agentGateway) {
        // Voice barge-in: optional AbortSignal attached in-process via metadata
        const voiceSignal = (command.metadata as { voiceAbortSignal?: AbortSignal } | undefined)?.voiceAbortSignal;
        if (voiceSignal?.aborted) {
          return this.finalizeCommandResult(command, {
            ok: false,
            handled: true,
            plan,
            snapshot: this.buildHome(command),
            replies: [],
            receipts: [],
            error: 'Voice turn aborted (barge-in).',
          });
        }
        const gatewayRequest = {
          userId: command.userId,
          sessionId: command.sessionId,
          channel: command.surface,
          text: command.text,
          workspace: command.workspace || runtimeWorkspace || null,
          modelProfile: runtimeModelProfile,
          metadata: {
            ...(command.metadata || {}),
            responseProfile: command.responseProfile || undefined,
            effortControl: runtimeState?.state.effort.snapshot,
            runtimeState: runtimeState
              ? {
                  model: runtimeState.state.model,
                  workspace: runtimeState.state.workspace,
                  statusbar: runtimeState.projections.statusbar,
                  lifecycle: runtimeState.projections.lifecycle,
                }
              : undefined,
            experiencePlan: {
              id: plan.id,
              kind: plan.kind,
              risk: plan.risk,
              requiresApproval: plan.requiresApproval,
              autonomyMode: command.autonomyMode,
            },
          },
        };
        const handledRun = voiceSignal
          ? await this.agentGateway.handle(gatewayRequest, { signal: voiceSignal })
          : await this.agentGateway.handle(gatewayRequest);
        runResult = handledRun || null;
        if (runResult) {
          runResult = await this.maybeRetryProviderFallback(command, plan, runResult);
        }
      }

      const snapshot = this.buildHome({
        surface: command.surface,
        userId: command.userId,
        sessionId: runResult?.run?.sessionId || command.sessionId || null,
        workspace: command.workspace || runResult?.run?.workspace || null,
        activeRunId: runResult?.run?.id || null,
        responseProfile: command.responseProfile || null,
      });
      const replies = runResult?.replies?.length
        ? runResult.replies.map((reply) => ({
            id: reply.id,
            role: 'assistant' as const,
            text: reply.text,
            createdAt: reply.createdAt,
            runId: reply.runId,
          }))
        : [this.replyFromText(plan.summary, command, snapshot.agent.activeRunId)];
      return this.finalizeCommandResult(command, {
        ok: runResult?.ok ?? true,
        handled: true,
        plan,
        snapshot,
        replies,
        receipts: snapshot.receipts,
        error: runResult?.ok === false ? snapshot.agent.summary : null,
      });
    } catch (error: unknown) {
      const snapshot = this.buildHome(command);
      const message = `Experience Core failed: ${errorMessage(error, 'unknown error')}.`;
      return this.finalizeCommandResult(command, {
        ok: false,
        handled: true,
        plan,
        snapshot,
        replies: [this.replyFromText(message, command, snapshot.agent.activeRunId)],
        receipts: snapshot.receipts,
        error: message,
      });
    }
  }

  public buildTimelineForRun(input: ExperienceHomeInput & { runId: string }): ExperienceTimelineItem[] {
    const agentSnapshot = this.safeAgentSnapshot({
      activeRunId: input.runId,
      activeSessionId: input.sessionId || null,
    });
    const run =
      agentSnapshot?.activeRun || agentSnapshot?.runs.find((candidate) => candidate.id === input.runId) || null;
    return this.buildTimeline(run, run ? [run] : []);
  }

  public dispatchRuntimeStateAction(
    input: ZavorthRuntimeStateBusActionInput,
  ): ZavorthRuntimeStateBusDispatchResult | null {
    try {
      return this.runtimeSecureIntegration?.dispatch(input) || this.runtimeStateBus?.dispatch(input) || null;
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] dispatchRuntimeStateAction failed:', error);
      return null;
    }
  }

  public buildRuntimeCapabilities(): ZavorthRuntimeCapabilitiesSnapshot | null {
    try {
      if (!this.runtimeStateBus) {
        return null;
      }
      return new ZavorthRuntimeCapabilitiesService({
        now: this.now,
        runtimeStateBus: this.runtimeStateBus,
      }).buildSnapshot();
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] buildRuntimeCapabilities failed:', error);
      return null;
    }
  }

  public async syncRuntimeOperationalState(
    input: ZavorthRuntimeOperationalSpineSyncInput = {},
  ): Promise<ZavorthRuntimeOperationalSpineSyncResult | null> {
    try {
      return (await this.runtimeOperationalSpine?.syncOperationalState(input)) || null;
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] syncRuntimeOperationalState failed:', error);
      return null;
    }
  }

  public publishRuntimeStateProjection(input: {
    surface: ExperienceSurface;
    sessionId: string | null;
    userId: string;
    workspace: string | null;
    agentSnapshot: ZavorthAgentGatewaySnapshot | null;
    activeRun: UniversalAgentRun | null;
    approvals: UniversalApprovalRequest[];
    pendingLearningCount: number;
    memorySignalCount: number;
    healthSummary: string;
  }): ZavorthRuntimeStateBusSnapshot | null {
    if (!this.runtimeStateBus) {
      return null;
    }

    const pendingApprovals = input.approvals.filter((approval) => approval.status === 'pending').length;
    const activeRunStatus = input.activeRun?.status || null;
    const activeRunLive = isLiveRunStatus(activeRunStatus);
    const workflowJobs = input.agentSnapshot?.workflowJobs || [];
    const liveWorkflowJobs = workflowJobs.filter((job) => isLiveWorkflowJobStatus(String(job.status || '')));
    const source = 'experience-core-live-projection';

    this.safeDispatchRuntimeState({
      type: 'sync-command',
      surface: input.surface,
      userId: input.userId,
      sessionId: input.sessionId,
      source,
      approved: true,
      payload: {
        metadata: {
          responseProfile: null,
          liveProjection: true,
        },
      },
    });

    this.safeDispatchRuntimeState({
      type: 'domain-state',
      surface: input.surface,
      userId: input.userId,
      sessionId: input.sessionId,
      source,
      approved: true,
      payload: {
        domain: {
          domain: 'gateway',
          status: !input.agentSnapshot
            ? 'offline'
            : pendingApprovals > 0
              ? 'attention'
              : activeRunLive
                ? 'running'
                : 'ready',
          summary: !input.agentSnapshot
            ? 'Agent Gateway is not attached to this surface.'
            : pendingApprovals > 0
              ? `${pendingApprovals} approval(s) waiting for operator decision.`
              : activeRunLive
                ? `Gateway is driving ${input.activeRun?.title || input.activeRun?.id || 'an active run'}.`
                : input.healthSummary,
          actionIds: ['runtime.gateway.open', 'runtime.gateway.sync', 'runtime.gateway.restart'],
        },
        metadata: {
          runCount: input.agentSnapshot?.runs.length || 0,
          pendingApprovals,
        },
      },
    });

    this.safeDispatchRuntimeState({
      type: 'domain-state',
      surface: input.surface,
      userId: input.userId,
      sessionId: input.sessionId,
      source,
      approved: true,
      payload: {
        domain: {
          domain: 'agents',
          status: activeRunLive ? 'running' : pendingApprovals > 0 ? 'attention' : 'ready',
          summary: activeRunLive
            ? `Agent run active: ${input.activeRun?.title || input.activeRun?.id || 'current task'}.`
            : pendingApprovals > 0
              ? 'Agents are waiting for approval before continuing.'
              : 'Agent plane ready for governed runs.',
          actionIds: ['runtime.agents.open', 'runtime.agents.pause', 'runtime.agents.sync'],
        },
        metadata: {
          activeRunId: input.activeRun?.id || null,
          activeRunStatus,
        },
      },
    });

    this.safeDispatchRuntimeState({
      type: 'domain-state',
      surface: input.surface,
      userId: input.userId,
      sessionId: input.sessionId,
      source,
      approved: true,
      payload: {
        domain: {
          domain: 'cron',
          status: liveWorkflowJobs.length > 0 ? 'running' : 'ready',
          summary:
            liveWorkflowJobs.length > 0
              ? `${liveWorkflowJobs.length} workflow job(s) active in the local queue.`
              : 'Cron and workflow queue are idle.',
          actionIds: ['runtime.cron.open', 'runtime.cron.pause', 'runtime.cron.sync'],
        },
        metadata: {
          workflowJobCount: workflowJobs.length,
          liveWorkflowJobCount: liveWorkflowJobs.length,
        },
      },
    });

    this.safeDispatchRuntimeState({
      type: 'domain-state',
      surface: input.surface,
      userId: input.userId,
      sessionId: input.sessionId,
      source,
      approved: true,
      payload: {
        domain: {
          domain: 'context',
          status: input.pendingLearningCount > 0 ? 'attention' : 'ready',
          summary:
            input.pendingLearningCount > 0
              ? `${input.pendingLearningCount} learning candidate(s) waiting for review.`
              : input.memorySignalCount > 0
                ? `${input.memorySignalCount} memory signal(s) attached to the active context.`
                : input.workspace
                  ? `Context scoped to ${input.workspace}.`
                  : 'Context plane ready.',
          actionIds: ['runtime.context.open', 'runtime.context.sync'],
        },
        metadata: {
          workspace: input.workspace,
          memorySignalCount: input.memorySignalCount,
          pendingLearningCount: input.pendingLearningCount,
        },
      },
    });

    this.safeDispatchRuntimeState({
      type: 'domain-state',
      surface: input.surface,
      userId: input.userId,
      sessionId: input.sessionId,
      source,
      approved: true,
      payload: {
        domain: {
          domain: 'session',
          status: activeRunLive ? 'running' : 'ready',
          summary: input.sessionId
            ? `Session ${input.sessionId} is attached to the runtime bus.`
            : 'Session plane ready.',
          actionIds: ['runtime.session.open', 'runtime.session.sync'],
        },
        metadata: {
          activeRunId: input.activeRun?.id || null,
          phase: 'receipt',
        },
      },
    });

    return this.safeRuntimeStateSnapshot();
  }

  public publishRuntimeApprovalDecision(command: ExperienceCommand, found: boolean): void {
    if (!command.approval?.id) {
      return;
    }
    this.safeDispatchRuntimeState({
      type: 'operate-domain',
      surface: command.surface,
      userId: command.userId,
      sessionId: command.sessionId,
      source: 'experience-core-approval',
      approved: true,
      payload: {
        domain: {
          domain: 'gateway',
          operation: command.approval.decision === 'approve' ? 'approve' : 'reject',
        },
        metadata: {
          approvalId: command.approval.id,
          decision: command.approval.decision,
          found,
        },
      },
    });
  }

  public publishRuntimeLearningDecision(
    command: ExperienceCommand,
    learning: Awaited<ReturnType<LearningOSService['decide']>>,
  ): void {
    this.safeDispatchRuntimeState({
      type: 'domain-state',
      surface: command.surface,
      userId: command.userId,
      sessionId: command.sessionId,
      source: 'experience-core-learning',
      approved: true,
      payload: {
        domain: {
          domain: 'context',
          status: learning.ok ? 'ready' : 'attention',
          summary: learning.summary,
          actionIds: ['runtime.context.sync', 'runtime.learning.review'],
        },
        metadata: {
          phase: 'learning',
          candidateId: command.learning?.candidateId || null,
          decision: command.learning?.decision || null,
          learningStatus: learning.status,
        },
      },
    });
  }

  public attachRuntimeStateSnapshot(snapshot: ExperienceSnapshot): void {
    const runtimeState = this.safeRuntimeStateSnapshot();
    if (!runtimeState) {
      return;
    }
    snapshot.raw = {
      ...(snapshot.raw || {}),
      runtimeState,
    };
  }

  public safeDispatchRuntimeState(
    input: ZavorthRuntimeStateBusActionInput,
  ): ZavorthRuntimeStateBusDispatchResult | null {
    try {
      return this.runtimeStateBus?.dispatch(input) || null;
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] safeDispatchRuntimeState failed:', error);
      return null;
    }
  }

  public safeAgentSnapshot(input: ZavorthAgentGatewaySnapshotOptions): ZavorthAgentGatewaySnapshot | null {
    try {
      return this.agentGateway?.buildSnapshot(input) || null;
    } catch (error: unknown) {
      logger.warn('[ExperienceCore] safeAgentSnapshot failed:', error);
      return null;
    }
  }

  public collectApprovals(runs: UniversalAgentRun[]): UniversalApprovalRequest[] {
    return this.projectionSupport.collectApprovals(runs);
  }

  public buildTimeline(activeRun: UniversalAgentRun | null, runs: UniversalAgentRun[]): ExperienceTimelineItem[] {
    return this.projectionSupport.buildTimeline(activeRun, runs);
  }

  public timelineKind(kind: string): ExperienceTimelineItem['kind'] {
    return this.projectionSupport.timelineKind(kind);
  }

  public buildReceipts(
    activeRun: UniversalAgentRun | null,
    runs: UniversalAgentRun[],
    approvals: UniversalApprovalRequest[],
  ): ExperienceReceipt[] {
    return this.projectionSupport.buildReceipts(activeRun, runs, approvals);
  }

  public buildMemorySignals(activeRun: UniversalAgentRun | null, workspace: string | null): ExperienceMemorySignal[] {
    return this.projectionSupport.buildMemorySignals(activeRun, workspace);
  }

  public buildLlmBrainLearningCandidates(
    activeRun: UniversalAgentRun | null,
    llmBrain: ZavorthLlmBrainSnapshot | null,
  ): ExperienceLearningCandidate[] {
    return this.projectionSupport.buildLlmBrainLearningCandidates(activeRun, llmBrain);
  }

  public safeRuntimeStateSnapshot(): ZavorthRuntimeStateBusSnapshot | null {
    return this.projectionSupport.safeRuntimeStateSnapshot();
  }

  public buildReachSnapshot(): import('./ExperienceContracts.js').ExperienceReachSnapshot {
    return this.projectionSupport.buildReachSnapshot();
  }

  public tryHandleReachCommand(command: ExperienceCommand): ExperienceCommandResult | null {
    return this.projectionSupport.tryHandleReachCommand(command);
  }

  public buildSuperpowersSnapshot(
    userId?: string | null,
  ): import('./ExperienceContracts.js').ExperienceSuperpowersSnapshot {
    return this.projectionSupport.buildSuperpowersSnapshot(userId);
  }

  public tryHandleSuperpowersCommand(command: ExperienceCommand): ExperienceCommandResult | null {
    return this.projectionSupport.tryHandleSuperpowersCommand(command);
  }

  public getFirstRunService(
    userId?: string | null,
  ): import('../ZavorthFirstRunHumanOnboardingService.js').ZavorthFirstRunHumanOnboardingService {
    return this.continuitySupport.getFirstRunService(userId);
  }

  public buildFirstRunSnapshot(userId?: string | null): import('./ExperienceContracts.js').ExperienceFirstRunSnapshot {
    return this.continuitySupport.buildFirstRunSnapshot(userId);
  }

  public buildFirstRunActionCards(
    firstRun: import('./ExperienceContracts.js').ExperienceFirstRunSnapshot,
  ): import('./ExperienceContracts.js').ExperienceActionCard[] {
    return this.continuitySupport.buildFirstRunActionCards(firstRun);
  }

  public buildFirstRunNextActions(
    firstRun: import('./ExperienceContracts.js').ExperienceFirstRunSnapshot,
  ): import('./ExperienceContracts.js').ExperienceAction[] {
    return this.continuitySupport.buildFirstRunNextActions(firstRun);
  }

  /**
   * agent-first: free text never advances first-run.
   * Only explicit setup intent or structured /start-like verbs.
   */
  public tryHandleFirstRunCommand(command: ExperienceCommand): ExperienceCommandResult | null {
    return this.continuitySupport.tryHandleFirstRunCommand(command);
  }

  public listLearnedRuntimeItems(
    userId?: string | null,
  ): Array<{ id: string; title: string; summary: string; kind: string }> {
    return this.continuitySupport.listLearnedRuntimeItems(userId);
  }

  public undoLearnedRuntimeItem(id: string, userId?: string | null): { ok: boolean; summary: string } {
    return this.continuitySupport.undoLearnedRuntimeItem(id, userId);
  }

  public workboardProjectionFromRuntimeState(
    runtimeState: ZavorthRuntimeStateBusSnapshot | null,
  ): Record<string, unknown> | null {
    return this.continuitySupport.workboardProjectionFromRuntimeState(runtimeState);
  }

  public safeRuntimeStateSync(command: ExperienceCommand): ZavorthRuntimeStateBusSnapshot | null {
    return this.continuitySupport.safeRuntimeStateSync(command);
  }

  public workspacePathFromRuntimeState(runtimeState: ZavorthRuntimeStateBusSnapshot | null): string | null {
    return this.continuitySupport.workspacePathFromRuntimeState(runtimeState);
  }

  public modelProfileFromRuntimeState(
    runtimeState: ZavorthRuntimeStateBusSnapshot | null,
  ): Partial<UniversalAgentModelProfile> | undefined {
    return this.continuitySupport.modelProfileFromRuntimeState(runtimeState);
  }

  public buildNativeAutonomySpineProjection(spine: Record<string, unknown> | null): Record<string, unknown> | null {
    return this.continuitySupport.buildNativeAutonomySpineProjection(spine);
  }

  public mergeLearningCandidates(
    primary: ExperienceLearningCandidate[],
    secondary: ExperienceLearningCandidate[],
  ): ExperienceLearningCandidate[] {
    return this.continuitySupport.mergeLearningCandidates(primary, secondary);
  }

  public buildChat(activeRun: UniversalAgentRun | null, runs: UniversalAgentRun[]) {
    return this.continuitySupport.buildChat(activeRun, runs);
  }

  public toExperienceApproval(approval: UniversalApprovalRequest): ExperienceApproval {
    return this.continuitySupport.toExperienceApproval(approval);
  }

  /**
   * Project once|session|always|deny controls for desktop (and API consumers).
   * Falls back to a local synthesis if projection fails.
   */
  public buildDesktopApprovalSurfaceProjection(
    approval: UniversalApprovalRequest,
  ): ExperienceApprovalSurfaceProjection {
    return this.continuitySupport.buildDesktopApprovalSurfaceProjection(approval);
  }

  public buildHealth(
    agentSnapshot: ZavorthAgentGatewaySnapshot | null,
    pendingLearning: number,
    approvals: UniversalApprovalRequest[],
  ): ExperienceSnapshot['health'] {
    return this.continuitySupport.buildHealth(agentSnapshot, pendingLearning, approvals);
  }

  public buildNextActions(
    status: ExperienceHealthStatus,
    pendingApprovals: number,
    pendingLearning: number,
  ): ExperienceAction[] {
    return this.continuitySupport.buildNextActions(status, pendingApprovals, pendingLearning);
  }

  public async handleActionCardDecision(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
  ): Promise<ExperienceCommandResult | null> {
    return this.actionDecisionSupport.handleActionCardDecision(command, plan);
  }

  public buildContextualSetupResult(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
  ): ExperienceCommandResult {
    return this.actionDecisionSupport.buildContextualSetupResult(command, plan);
  }

  public contextualSetupKind(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
  ): 'provider-setup' | 'channel-setup' | null {
    return this.actionDecisionSupport.contextualSetupKind(command, plan);
  }

  public async maybeRetryProviderFallback(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
    firstResult: UniversalAgentRunResult,
  ): Promise<UniversalAgentRunResult> {
    return this.actionDecisionSupport.maybeRetryProviderFallback(command, plan, firstResult);
  }

  public finalizeCommandResult(command: ExperienceCommand, result: ExperienceCommandResult): ExperienceCommandResult {
    return this.actionDecisionSupport.finalizeCommandResult(command, result);
  }

  public buildSelfHealingActionCards(
    projection: ZavorthSelfHealingProjection,
    receipt: ZavorthSelfHealingReceipt,
  ): ExperienceActionCard[] {
    return this.actionDecisionSupport.buildSelfHealingActionCards(projection, receipt);
  }

  public buildSelfHealingCardsFromReceipts(receipts: ZavorthSelfHealingReceipt[]): ExperienceActionCard[] {
    return this.actionDecisionSupport.buildSelfHealingCardsFromReceipts(receipts);
  }

  public actionsForSelfHealingReceipt(receipt: ZavorthSelfHealingReceipt): ExperienceAction[] {
    return this.actionDecisionSupport.actionsForSelfHealingReceipt(receipt);
  }

  public selfHealingActionToExperienceAction(
    projection: ZavorthSelfHealingProjection,
    healingAction: ZavorthSelfHealingAction,
  ): ExperienceAction {
    return this.actionDecisionSupport.selfHealingActionToExperienceAction(projection, healingAction);
  }

  public selfHealingReceiptToExperienceReceipt(receipt: ZavorthSelfHealingReceipt): ExperienceReceipt {
    return this.actionDecisionSupport.selfHealingReceiptToExperienceReceipt(receipt);
  }

  public selfHealingCardTitle(projection: ZavorthSelfHealingProjection): string {
    return this.actionDecisionSupport.selfHealingCardTitle(projection);
  }

  public selfHealingRisk(projection: ZavorthSelfHealingProjection): ExperienceAction['risk'] {
    return this.actionDecisionSupport.selfHealingRisk(projection);
  }

  public mergeExperienceReceipts(primary: ExperienceReceipt[], secondary: ExperienceReceipt[]): ExperienceReceipt[] {
    return this.actionDecisionSupport.mergeExperienceReceipts(primary, secondary);
  }

  public mergeActionCards(primary: ExperienceActionCard[], secondary: ExperienceActionCard[]): ExperienceActionCard[] {
    return this.actionDecisionSupport.mergeActionCards(primary, secondary);
  }

  public safeProviderReadinessMatrix() {
    return this.actionDecisionSupport.safeProviderReadinessMatrix();
  }

  public selectFallbackProvider(
    projection: ZavorthSelfHealingProjection,
    attemptedProvider: string | null | undefined,
  ): string | null {
    return this.actionDecisionSupport.selectFallbackProvider(projection, attemptedProvider);
  }

  public replyFromText(text: string, command: ExperienceCommand, runId: string | null) {
    return this.actionDecisionSupport.replyFromText(text, command, runId);
  }
}

function normalizeKey(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isProviderHealingIssue(issue: string): boolean {
  return (
    issue === 'provider_auth' ||
    issue === 'provider_quota' ||
    issue === 'provider_timeout' ||
    issue === 'provider_unavailable'
  );
}
