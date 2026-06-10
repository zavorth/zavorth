import {
  EXPERIENCE_COMMAND_CONTRACT_VERSION,
  EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
  EXPERIENCE_SNAPSHOT_CONTRACT_VERSION,
  LEARNING_CANDIDATE_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceActionCard,
  type ExperienceApproval,
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
import { ActionCardService } from './ActionCardService.js';
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
import { defaultZavorthSpeculativeAutonomyCancellationRegistry } from '../ZavorthSpeculativeAutonomyService.js';
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
import {
  ZavorthAgentMaturityService,
  type ZavorthAgentMaturitySnapshot,
} from '../ZavorthAgentMaturityService.js';
import {
  ZavorthRuntimeStateBusService,
} from '../ZavorthRuntimeStateBusService.js';
import {
  ZavorthRuntimeCapabilitiesService,
  type ZavorthRuntimeCapabilitiesSnapshot,
} from '../ZavorthRuntimeCapabilitiesService.js';
import {
  ZavorthRuntimeOperationalSpineService,
  type ZavorthRuntimeOperationalSpineSyncInput,
  type ZavorthRuntimeOperationalSpineSyncResult,
} from '../ZavorthRuntimeOperationalSpineService.js';
import type {
  ZavorthRuntimeStateBusActionInput,
  ZavorthRuntimeStateBusDispatchResult,
  ZavorthRuntimeStateBusSnapshot,
} from '../../contracts/ZavorthRuntimeStateBusContract.js';

type AgentGatewayLike = Pick<
  ZavorthAgentGateway,
  'handle' | 'buildSnapshot' | 'approve' | 'reject'
>;

export type ExperienceCoreRuntime = {
  now?: () => Date;
  agentGateway?: AgentGatewayLike | null;
  memoryPlane?: Pick<ZavorthMemoryPlaneService, 'buildSnapshot'> | null;
  learningPlane?: Pick<ZavorthLearningPlaneService, 'buildSnapshot' | 'executeAction'>
    & Partial<Pick<ZavorthLearningPlaneService, 'resetState' | 'exportState'>> | null;
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
  runtimeStateBus?: Pick<ZavorthRuntimeStateBusService, 'buildSnapshot' | 'syncExperienceCommand' | 'dispatch'> | null;
  runtimeOperationalSpine?: Pick<ZavorthRuntimeOperationalSpineService, 'syncOperationalState'> | null;
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
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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
  const asksTime = /\b(que\s+horas|hora\s+atual|horas\s+sao|what\s+time|current\s+time|tell\s+me\s+the\s+time)\b/.test(normalized);
  const asksDate = /\b(que\s+dia|data\s+atual|dia\s+de\s+hoje|what\s+date|today'?s\s+date|current\s+date)\b/.test(normalized);
  return asksTime || asksDate;
}

function buildLocalDateTimeAnswer(text: string, now: Date): string | null {
  if (!isSimpleDateTimeQuestion(text)) return null;
  const timeZone = inferRequestedTimeZone(text);
  try {
    const formatted = new Intl.DateTimeFormat('pt-BR', {
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
    return `Agora em ${timeZone} é ${formatted}.`;
  } catch {
    return `Agora são ${now.toLocaleString('pt-BR')} no fuso local do sistema.`;
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
  private readonly now: () => Date;
  private readonly agentGateway: AgentGatewayLike | null;
  private readonly memoryPlane: ExperienceCoreRuntime['memoryPlane'];
  private readonly runtimeAccessReadiness: ExperienceCoreRuntime['runtimeAccessReadiness'];
  private readonly router: NaturalCommandRouterService;
  private readonly learningOs: LearningOSService;
  private readonly journeyEngine: JourneyEngineService;
  private readonly trustLens: TrustLensService;
  private readonly actionCards: ActionCardService;
  private readonly diffReview: DiffReviewService;
  private readonly executionGraph: ExecutionGraphService;
  private readonly contextRecovery: ContextRecoveryService;
  private readonly autoHealing: AutoHealingProjectionService;
  private readonly reasoningSummary: ReasoningSummaryService;
  private readonly pulseBrief: PulseBriefService;
  private readonly responseProfiles: ResponseProfilePreferenceService;
  private readonly selfHealingUx: ZavorthSelfHealingUxService;
  private readonly selfHealingReceipts: ZavorthSelfHealingReceiptService;
  private readonly providerReadinessMatrix: Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'>;
  private readonly agentMaturity: Pick<ZavorthAgentMaturityService, 'buildSnapshot'>;
  private readonly runtimeStateBus: Pick<ZavorthRuntimeStateBusService, 'buildSnapshot' | 'syncExperienceCommand' | 'dispatch'> | null;
  private readonly runtimeOperationalSpine: Pick<ZavorthRuntimeOperationalSpineService, 'syncOperationalState'> | null;

  constructor(runtime: ExperienceCoreRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.agentGateway = runtime.agentGateway || null;
    this.memoryPlane = runtime.memoryPlane || null;
    this.runtimeAccessReadiness = runtime.runtimeAccessReadiness || null;
    this.router = runtime.router || new NaturalCommandRouterService();
    this.learningOs = runtime.learningOs || new LearningOSService({
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
    this.providerReadinessMatrix = runtime.providerReadinessMatrix || new ZavorthProviderReadinessMatrixService({ now: this.now });
    this.agentMaturity = runtime.agentMaturity || new ZavorthAgentMaturityService();
    this.runtimeStateBus = runtime.runtimeStateBus === null
      ? null
      : runtime.runtimeStateBus || new ZavorthRuntimeStateBusService({ now: this.now });
    this.runtimeOperationalSpine = runtime.runtimeOperationalSpine === null || !this.runtimeStateBus
      ? null
      : runtime.runtimeOperationalSpine || new ZavorthRuntimeOperationalSpineService({
        now: this.now,
        runtimeStateBus: this.runtimeStateBus,
      });
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
    const approvals = this.collectApprovals(runs);
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
        ? {
          userId,
          channel: activeRun.channel,
          text: activeRun.input || activeRun.title || '',
          workspace: workspace || activeRun.workspace || undefined,
          requestedTools: [],
        } as any
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
    const draftActionCards = this.actionCards.build({
      activeRun,
      approvals,
      learningCandidates,
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
    const baseActionCards = this.actionCards.build({
      activeRun,
      approvals,
      learningCandidates,
      diffReviews,
      contextRecovery,
      autoHealing,
      now: this.now(),
    });
    const actionCards = this.mergeActionCards(
      baseActionCards,
      this.buildSelfHealingCardsFromReceipts(this.selfHealingReceipts.list(4)),
    );
    const nextActions = this.buildNextActions(health.status, approvals.length, pendingLearningCount);
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
    const runtimeState = input.metadata?.skipRuntimeProjection === true
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
        suggestions: [
          'Revise este workspace',
          'Explique o que esta bloqueado',
          'Mostre aprendizados pendentes',
          'Abra o dashboard',
        ],
      },
      approvals: approvals.map((approval) => this.toExperienceApproval(approval)),
      timeline,
      receipts,
      memory: {
        signals: memorySignals,
        summary: memorySignals.length
          ? `${memorySignals.length} sinal(is) de memoria ativo(s).`
          : 'Memoria pronta para capturar contexto validado.',
      },
      learning: {
        candidates: learningCandidates,
        summary: learningSummary.summary,
        pending: pendingLearningCount,
      },
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
    const runtimeState = this.safeRuntimeStateSync(command);
    const runtimeWorkspace = this.workspacePathFromRuntimeState(runtimeState);
    if (!command.workspace && runtimeWorkspace) {
      command.workspace = runtimeWorkspace;
    }
    const runtimeModelProfile = this.modelProfileFromRuntimeState(runtimeState);
    const plan = this.router.route(command);

    try {
      if (command.approval?.id) {
        const result = command.approval.decision === 'approve'
          ? await this.agentGateway?.approve(command.approval.id)
          : await this.agentGateway?.reject(command.approval.id);
        if (result) {
          this.publishRuntimeApprovalDecision(command, true);
        }
        const snapshot = result ? this.buildHome(command) : this.buildHome({
          ...command,
          metadata: {
            ...command.metadata,
            skipRuntimeProjection: true,
          },
        });
        const reply = this.replyFromText(
          result
            ? `Approval ${command.approval.decision === 'approve' ? 'approved' : 'rejected'}: ${command.approval.id}.`
            : `I could not find a pending approval for ${command.approval.id}.`,
          command,
          result?.run?.id || null,
        );
        return this.finalizeCommandResult(command, {
          ok: Boolean(result),
          handled: true,
          plan,
          snapshot,
          replies: [reply],
          receipts: snapshot.receipts,
          error: result ? null : 'Approval not found.',
        });
      }

      if (command.learning?.decision) {
        const learning = this.learningOs.decide({
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
        const reply = this.replyFromText(
          diffResult.summary,
          command,
          snapshot.agent.activeRunId,
        );
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

      if (plan.kind === 'dashboard' || plan.kind === 'diagnostics' || plan.kind === 'learning' || plan.kind === 'memory') {
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
        return this.finalizeCommandResult(command, this.buildContextualSetupResult(command, {
          ...plan,
          kind: contextualSetupKind,
        }));
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
        const handledRun = await this.agentGateway.handle({
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
        });
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
    } catch (error: any) {
      const snapshot = this.buildHome(command);
      const message = `Experience Core failed: ${error?.message || 'unknown error'}.`;
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
    const run = agentSnapshot?.activeRun || agentSnapshot?.runs.find((candidate) => candidate.id === input.runId) || null;
    return this.buildTimeline(run, run ? [run] : []);
  }

  public dispatchRuntimeStateAction(input: ZavorthRuntimeStateBusActionInput): ZavorthRuntimeStateBusDispatchResult | null {
    try {
      return this.runtimeStateBus?.dispatch(input) || null;
    } catch {
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
    } catch {
      return null;
    }
  }

  public async syncRuntimeOperationalState(
    input: ZavorthRuntimeOperationalSpineSyncInput = {},
  ): Promise<ZavorthRuntimeOperationalSpineSyncResult | null> {
    try {
      return await this.runtimeOperationalSpine?.syncOperationalState(input) || null;
    } catch {
      return null;
    }
  }

  private publishRuntimeStateProjection(input: {
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
          summary: liveWorkflowJobs.length > 0
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
          summary: input.pendingLearningCount > 0
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

  private publishRuntimeApprovalDecision(command: ExperienceCommand, found: boolean): void {
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

  private publishRuntimeLearningDecision(
    command: ExperienceCommand,
    learning: ReturnType<LearningOSService['decide']>,
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

  private attachRuntimeStateSnapshot(snapshot: ExperienceSnapshot): void {
    const runtimeState = this.safeRuntimeStateSnapshot();
    if (!runtimeState) {
      return;
    }
    snapshot.raw = {
      ...(snapshot.raw || {}),
      runtimeState,
    };
  }

  private safeDispatchRuntimeState(input: ZavorthRuntimeStateBusActionInput): ZavorthRuntimeStateBusDispatchResult | null {
    try {
      return this.runtimeStateBus?.dispatch(input) || null;
    } catch {
      return null;
    }
  }

  private safeAgentSnapshot(input: ZavorthAgentGatewaySnapshotOptions): ZavorthAgentGatewaySnapshot | null {
    try {
      return this.agentGateway?.buildSnapshot(input) || null;
    } catch {
      return null;
    }
  }

  private collectApprovals(runs: UniversalAgentRun[]): UniversalApprovalRequest[] {
    return runs
      .flatMap((run) => run.approvals)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private buildTimeline(activeRun: UniversalAgentRun | null, runs: UniversalAgentRun[]): ExperienceTimelineItem[] {
    const sourceRuns = activeRun ? [activeRun] : runs.slice(0, 3);
    const items: ExperienceTimelineItem[] = sourceRuns.flatMap((run) =>
      run.events.map((event) => ({
        id: event.id,
        runId: run.id,
        title: event.title,
        detail: event.detail || run.summary || event.kind,
        status: event.status === 'failed' ? 'failed' as const : event.status,
        kind: this.timelineKind(event.kind),
        createdAt: event.createdAt,
      })),
    );
    return items
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(-20);
  }

  private timelineKind(kind: string): ExperienceTimelineItem['kind'] {
    if (kind === 'input') return 'intent';
    if (kind === 'planning') return 'planning';
    if (kind === 'tool') return 'tool';
    if (kind === 'approval') return 'approval';
    if (kind === 'memory') return 'memory';
    if (kind === 'reply') return 'reply';
    if (kind === 'artifact') return 'receipt';
    return 'status';
  }

  private buildReceipts(
    activeRun: UniversalAgentRun | null,
    runs: UniversalAgentRun[],
    approvals: UniversalApprovalRequest[],
  ): ExperienceReceipt[] {
    const sourceRuns = activeRun ? [activeRun] : runs.slice(0, 4);
    const runReceipts = sourceRuns.map((run) => ({
      id: `run:${run.id}`,
      title: run.title,
      detail: run.summary || `Status: ${run.status}`,
      status: run.status === 'failed'
        ? 'failed' as const
        : run.status === 'waiting_approval'
          ? 'pending' as const
          : run.status === 'completed'
            ? 'ready' as const
            : 'pending' as const,
      source: 'run' as const,
      createdAt: run.updatedAt,
    }));
    const approvalReceipts = approvals.slice(0, 6).map((approval) => ({
      id: `approval:${approval.id}`,
      title: approval.title,
      detail: approval.reason,
      status: approval.status === 'pending' ? 'pending' as const : 'ready' as const,
      source: 'approval' as const,
      createdAt: approval.createdAt,
    }));
    return [...runReceipts, ...approvalReceipts]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 12);
  }

  private buildMemorySignals(activeRun: UniversalAgentRun | null, workspace: string | null): ExperienceMemorySignal[] {
    const runSignals = (activeRun?.memorySignals || []).map((signal) => ({
      id: signal.id,
      title: signal.title,
      summary: signal.summary,
      layer: signal.layer,
      confidence: signal.confidence ?? null,
    }));
    if (runSignals.length > 0) return runSignals.slice(0, 8);

    try {
      const snapshot = this.memoryPlane?.buildSnapshot({ workspace: workspace || undefined } as any);
      const record = recordOrNull(snapshot);
      const summary = recordOrNull(record?.summary);
      const artifacts = Number(summary?.artifacts || summary?.memoryArtifacts || 0);
      if (artifacts > 0) {
        return [{
          id: 'memory-plane:artifacts',
          title: 'Memory Plane',
          summary: `${artifacts} artefato(s) de memoria disponiveis para recall governado.`,
          layer: 'semantic',
          confidence: 0.7,
        }];
      }
    } catch {
      // Keep the experience surface available even if memory is offline.
    }
    return [];
  }

  private buildLlmBrainLearningCandidates(
    activeRun: UniversalAgentRun | null,
    llmBrain: ZavorthLlmBrainSnapshot | null,
  ): ExperienceLearningCandidate[] {
    if (!activeRun || !llmBrain) return [];
    const signal = llmBrain.skillEvolution;
    if (signal.status === 'needs-more-signal') return [];
    const quarantined = signal.status === 'quarantined';
    return [{
      contractVersion: LEARNING_CANDIDATE_CONTRACT_VERSION,
      id: `llm-brain:${activeRun.id}`,
      title: signal.candidateKind === 'skill-improvement'
        ? 'Skill improvement signal'
        : signal.candidateKind === 'auto-skill'
          ? 'Reusable skill signal'
          : 'Procedure learning signal',
      origin: 'llm-brain',
      observedPattern: signal.summary,
      recommendation: quarantined
        ? 'Keep quarantined. Learning cannot alter security policy, approvals, sandbox, effect boundary or allowlists.'
        : 'Review this run as a possible reusable skill, Mnemos procedure or nudge before promoting behavior.',
      confidence: quarantined ? 0.2 : 0.82,
      impact: quarantined
        ? 'Does not alter behavior.'
        : 'Can improve future routing, procedures or skill suggestions only after approval.',
      dataUsed: [
        llmBrain.summary,
        `tools requested=${llmBrain.toolAgency.requested} executed=${llmBrain.toolAgency.executed}`,
        `session=${llmBrain.session.sessionId}`,
      ],
      suggestedAction: signal.suggestedCommand || 'zavorth learn',
      state: quarantined ? 'quarantined' : 'pending',
      createdAt: llmBrain.generatedAt,
      updatedAt: llmBrain.generatedAt,
    }];
  }

  private safeRuntimeStateSnapshot(): ZavorthRuntimeStateBusSnapshot | null {
    try {
      return this.runtimeStateBus?.buildSnapshot() || null;
    } catch {
      return null;
    }
  }

  private safeRuntimeStateSync(command: ExperienceCommand): ZavorthRuntimeStateBusSnapshot | null {
    try {
      return this.runtimeStateBus?.syncExperienceCommand({
        surface: command.surface,
        userId: command.userId,
        sessionId: command.sessionId || null,
        workspace: command.workspace || null,
        text: command.text,
        responseProfile: command.responseProfile || null,
        metadata: command.metadata || {},
      }) || null;
    } catch {
      return this.safeRuntimeStateSnapshot();
    }
  }

  private workspacePathFromRuntimeState(runtimeState: ZavorthRuntimeStateBusSnapshot | null): string | null {
    const workspace = runtimeState?.state.workspace || null;
    if (!workspace?.path) {
      return null;
    }
    if (workspace.kind === 'folder' || workspace.kind === 'project' || workspace.kind === 'zavorth') {
      return workspace.path;
    }
    return null;
  }

  private modelProfileFromRuntimeState(
    runtimeState: ZavorthRuntimeStateBusSnapshot | null,
  ): Partial<UniversalAgentModelProfile> | undefined {
    const model = runtimeState?.state.model || null;
    if (!model?.id || model.connected !== true) {
      return undefined;
    }
    return {
      providerLabel: model.provider,
      modelLabel: model.label,
      routingPolicy: 'gateway',
      routeId: model.id,
      familyId: model.provider,
      ready: true,
      selectionExplanation: [
        `Runtime state selected ${model.label} from ${model.source || 'runtime'}.`,
      ],
    };
  }

  private buildNativeAutonomySpineProjection(
    spine: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!spine) {
      return null;
    }
    const learning = recordOrNull(spine.learning);
    const skillForge = recordOrNull(spine.skillForge);
    const dynamicMission = recordOrNull(spine.dynamicMission);
    const dynamicMissionWorkflow = recordOrNull(dynamicMission?.workflow);
    const dynamicMissionApproval = recordOrNull(dynamicMission?.approval);
    const dreamCycle = recordOrNull(spine.dreamCycle);
    const dreamCandidateStore = recordOrNull(dreamCycle?.candidateStore);
    const channel = recordOrNull(spine.channel);
    const backend = recordOrNull(spine.backend);
    const reviewCenter = recordOrNull(spine.reviewCenter);
    const safety = recordOrNull(spine.safety);
    const summary = recordOrNull(spine.summary);
    const channelReadiness = recordOrNull(channel?.readiness);
    const backendReadiness = recordOrNull(backend?.readiness);

    return {
      version: normalizeText(spine.version, 'native-autonomy-spine/v1'),
      generatedAt: normalizeText(spine.generatedAt),
      status: normalizeText(spine.status, 'attention'),
      stages: Array.isArray(spine.stages)
        ? spine.stages.map((stage) => {
            const record = recordOrNull(stage);
            return {
              id: normalizeText(record?.id),
              status: normalizeText(record?.status, 'attention'),
              summary: normalizeText(record?.summary),
            };
          }).filter((stage) => stage.id)
        : [],
      learningCandidates: Array.isArray(learning?.candidates) ? learning.candidates.length : 0,
      skillDrafts: Array.isArray(skillForge?.drafts) ? skillForge.drafts.length : 0,
      dynamicMissionTasks: Array.isArray(dynamicMissionWorkflow?.tasks) ? dynamicMissionWorkflow.tasks.length : 0,
      dynamicMissionApprovalRequired: dynamicMissionApproval?.required === true,
      dreamCandidateMemories: Array.isArray(dreamCandidateStore?.memories) ? dreamCandidateStore.memories.length : 0,
      dreamQuarantineItems: Array.isArray(dreamCycle?.quarantine) ? dreamCycle.quarantine.length : 0,
      channel: channel
        ? {
          liveReady: channelReadiness?.liveReady === true,
          defaultRouteAllowed: channelReadiness?.defaultRouteAllowed === true,
        }
        : null,
      backend: backend
        ? {
          liveReady: backendReadiness?.liveReady === true,
          liveMutationAllowed: backendReadiness?.liveMutationAllowed === true,
        }
        : null,
      summary: summary
        ? {
          organicLearningReady: summary.organicLearningReady === true,
          skillForgeReady: summary.skillForgeReady === true,
          dynamicMissionReady: summary.dynamicMissionReady === true,
          dreamCycleReady: summary.dreamCycleReady === true,
          liveChannelReady: summary.liveChannelReady === true,
          backendProviderReady: summary.backendProviderReady === true,
        }
        : null,
      reviewActions: Array.isArray(reviewCenter?.actions)
        ? reviewCenter.actions.map((entry) => normalizeText(entry)).filter(Boolean).slice(0, 8)
        : [],
      receiptCount: Array.isArray(reviewCenter?.receipts) ? reviewCenter.receipts.length : 0,
      quietLanes: reviewCenter?.quietLanes === true,
      rawSecretsSerialized: safety?.rawSecretsSerialized === false ? false : null,
    };
  }

  private mergeLearningCandidates(
    primary: ExperienceLearningCandidate[],
    secondary: ExperienceLearningCandidate[],
  ): ExperienceLearningCandidate[] {
    const seen = new Set<string>();
    return [...secondary, ...primary].filter((candidate) => {
      if (seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    });
  }

  private buildChat(activeRun: UniversalAgentRun | null, runs: UniversalAgentRun[]) {
    const sourceRuns = activeRun ? [activeRun] : runs.slice(0, 4);
    return sourceRuns.flatMap((run) => {
      const user = {
        id: `input:${run.id}`,
        role: 'user' as const,
        text: run.input,
        createdAt: run.createdAt,
        runId: run.id,
      };
      const assistant = {
        id: `summary:${run.id}`,
        role: 'assistant' as const,
        text: run.summary || run.title,
        createdAt: run.updatedAt,
        runId: run.id,
      };
      return [user, assistant];
    }).slice(-12);
  }

  private toExperienceApproval(approval: UniversalApprovalRequest): ExperienceApproval {
    return {
      id: approval.id,
      runId: approval.runId,
      title: approval.title,
      reason: approval.reason,
      risk: approval.risk,
      status: approval.status,
      createdAt: approval.createdAt,
      actions: [
        action({
          id: `approve:${approval.id}`,
          label: 'Aprovar',
          kind: 'approval',
          command: `zavorth approve ${approval.id}`,
          risk: approval.risk,
          reason: 'Permite continuar a acao governada.',
        }),
        action({
          id: `reject:${approval.id}`,
          label: 'Rejeitar',
          kind: 'approval',
          command: `zavorth reject ${approval.id}`,
          risk: approval.risk,
          reason: 'Mantem a acao bloqueada.',
        }),
      ],
    };
  }

  private buildHealth(
    agentSnapshot: ZavorthAgentGatewaySnapshot | null,
    pendingLearning: number,
    approvals: UniversalApprovalRequest[],
  ): ExperienceSnapshot['health'] {
    const pendingApprovals = approvals.filter((approval) => approval.status === 'pending').length;
    const warnings: string[] = [];
    if (!agentSnapshot) warnings.push('Agent Gateway nao esta conectado a esta superficie.');
    if (pendingApprovals > 0) warnings.push(`${pendingApprovals} aprovacao(oes) pendente(s).`);
    if (pendingLearning > 0) warnings.push(`${pendingLearning} aprendizado(s) aguardando revisao.`);
    const status: ExperienceHealthStatus = !agentSnapshot
      ? 'attention'
      : pendingApprovals > 0
        ? 'attention'
        : 'ready';
    return {
      status,
      summary: warnings.length > 0
        ? warnings[0]
        : 'Zavorth pronto para linguagem natural, approvals, receipts e learning governado.',
      warnings,
    };
  }

  private buildNextActions(
    status: ExperienceHealthStatus,
    pendingApprovals: number,
    pendingLearning: number,
  ): ExperienceAction[] {
    const actions: ExperienceAction[] = [
      action({
        id: 'natural.ask',
        label: 'Pedir algo ao Zavorth',
        kind: 'natural',
        command: 'zavorth ask "<pedido>"',
        reason: 'Entrada natural-first principal.',
      }),
      action({
        id: 'dashboard.open',
        label: 'Abrir Dashboard',
        kind: 'navigation',
        command: 'zavorth open',
        route: '/dashboard',
        reason: 'Superficie visual oficial.',
      }),
    ];
    if (pendingApprovals > 0 || status === 'attention') {
      actions.push(action({
        id: 'approvals.review',
        label: 'Revisar aprovacoes',
        kind: 'approval',
        command: 'zavorth approve',
        risk: 'attention',
        reason: 'Resolve bloqueios governados.',
      }));
    }
    if (pendingLearning > 0) {
      actions.push(action({
        id: 'learning.review',
        label: 'Revisar aprendizados',
        kind: 'learning',
        command: 'zavorth learn',
        reason: 'Promove apenas padroes aprovados.',
      }));
    }
    return actions;
  }

  private async handleActionCardDecision(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
  ): Promise<ExperienceCommandResult | null> {
    const actionId = command.actionCardDecision?.actionId || '';
    const approvalMatch = /^(approve|reject):(.+)$/.exec(actionId);
    if (approvalMatch) {
      const decision = approvalMatch[1] as 'approve' | 'reject';
      const approvalId = approvalMatch[2];
      const result = decision === 'approve'
        ? await this.agentGateway?.approve(approvalId)
        : await this.agentGateway?.reject(approvalId);
      this.publishRuntimeApprovalDecision({
        ...command,
        approval: { id: approvalId, decision },
      }, Boolean(result));
      const snapshot = this.buildHome(command);
      const reply = this.replyFromText(
        result
          ? `Action card resolvido: ${decision === 'approve' ? 'aprovado' : 'rejeitado'} ${approvalId}.`
          : `Nao encontrei aprovacao pendente para ${approvalId}.`,
        command,
        result?.run?.id || snapshot.agent.activeRunId,
      );
      return {
        ok: Boolean(result),
        handled: true,
        plan,
        snapshot,
        replies: [reply],
        receipts: snapshot.receipts,
        error: result ? null : 'Approval not found.',
      };
    }

    const learningMatch = /^learn:(approve|reject):(.+)$/.exec(actionId);
    if (learningMatch) {
      const learning = this.learningOs.decide({
        candidateId: learningMatch[2],
        decision: learningMatch[1] === 'approve' ? 'approve' : 'reject',
        workspace: command.workspace || null,
      });
      const snapshot = this.buildHome(command);
      this.publishRuntimeLearningDecision({
        ...command,
        learning: {
          candidateId: learningMatch[2],
          decision: learningMatch[1] === 'approve' ? 'approve' : 'reject',
        },
      }, learning);
      this.attachRuntimeStateSnapshot(snapshot);
      return {
        ok: learning.ok,
        handled: true,
        plan,
        snapshot,
        replies: [this.replyFromText(learning.summary, command, snapshot.agent.activeRunId)],
        receipts: snapshot.receipts,
        error: learning.ok ? null : learning.summary,
      };
    }

    const selfHealingMatch = /^self-healing:([^:]+):(.+)$/.exec(actionId);
    if (selfHealingMatch) {
      const healingAction = selfHealingMatch[2] || '';
      if (healingAction.includes('configure-provider')) {
        return this.finalizeCommandResult(command, this.buildContextualSetupResult(command, {
          ...plan,
          kind: 'provider-setup',
          title: 'Provider setup',
          summary: 'Connect a model provider inside the conversation.',
          nextSafeAction: 'Tell me the provider to connect, then provide the credential only when asked.',
        }));
      }
      if (healingAction.includes('configure-channel')) {
        return this.finalizeCommandResult(command, this.buildContextualSetupResult(command, {
          ...plan,
          kind: 'channel-setup',
          title: 'Channel setup',
          summary: 'Connect a communication surface inside the conversation.',
          nextSafeAction: 'Tell me the surface to connect, then provide token, webhook or pairing details only when asked.',
        }));
      }
      const snapshot = this.buildHome(command);
      return this.finalizeCommandResult(command, {
        ok: true,
        handled: true,
        plan,
        snapshot,
        replies: [this.replyFromText(
          'I have the recovery action. Send the original request again and I will retry with the prepared fallback or ask only for the missing input.',
          command,
          snapshot.agent.activeRunId,
        )],
        receipts: snapshot.receipts,
        error: null,
      });
    }

    const healingCancelMatch = /^healing:cancel:(.+)$/.exec(actionId);
    if (healingCancelMatch) {
      const targetRunId = healingCancelMatch[1] || command.actionCardDecision?.cardId || null;
      defaultZavorthSpeculativeAutonomyCancellationRegistry.requestCancel(targetRunId, 'experience-action-card');
      const snapshot = this.buildHome(command);
      return {
        ok: true,
        handled: true,
        plan,
        snapshot,
        replies: [this.replyFromText(
          'Pedido de cancelamento do auto-healing registrado. O loop especulativo deve parar e exibir o ultimo erro em vez de consumir mais budget.',
          command,
          snapshot.agent.activeRunId,
        )],
        receipts: snapshot.receipts,
        error: null,
      };
    }

    const snapshot = this.buildHome(command);
    return {
      ok: true,
      handled: true,
      plan,
      snapshot,
      replies: [this.replyFromText(
        `Action card ${command.actionCardDecision?.cardId} selecionado. Acao ${actionId} exige a superficie apropriada ou novo plano governado.`,
        command,
        snapshot.agent.activeRunId,
      )],
      receipts: snapshot.receipts,
      error: null,
    };
  }

  private buildContextualSetupResult(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
  ): ExperienceCommandResult {
    const snapshot = this.buildHome(command);
    const target = plan.kind === 'provider-setup' ? 'provider' : 'channel';
    const replyText = target === 'provider'
      ? [
        'I can connect a model provider from here without exposing secrets.',
        '',
        'Tell me one of these:',
        '- "use Gemini"',
        '- "use OpenRouter"',
        '- "use Ollama local"',
        '- "connect Groq"',
        '',
        'When a key is needed, I will ask for it explicitly, store only a redacted SecretRef path, run an explicit live proof, and create a receipt.',
      ].join('\n')
      : [
        'I can connect a communication surface from here.',
        '',
        'Tell me the surface you want, for example Telegram, Discord, Slack, Signal, WhatsApp, Matrix or Email.',
        'I will ask only for the exact token, webhook, pairing code or allowlisted user id needed by that surface.',
        '',
        'Remote surfaces stay least-privilege until pairing, allowlist and proof receipts exist.',
      ].join('\n');
    return {
      ok: true,
      handled: true,
      plan,
      snapshot,
      replies: [this.replyFromText(replyText, command, snapshot.agent.activeRunId)],
      receipts: snapshot.receipts,
      error: null,
    };
  }

  private contextualSetupKind(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
  ): 'provider-setup' | 'channel-setup' | null {
    if (plan.kind === 'provider-setup' || plan.kind === 'channel-setup') return plan.kind;
    const text = normalizeKey(command.text);
    const explicitSetup = command.intent === 'setup' || /\b(connect|configure|setup|pair|use)\b/.test(command.text.toLowerCase());
    if (!explicitSetup) return null;
    if (/\b(openai|gemini|google|anthropic|claude|openrouter|ollama|lmstudio|groq|mistral|deepseek|provider|model|api-key|key)\b/.test(text)) {
      return 'provider-setup';
    }
    if (/\b(telegram|discord|slack|signal|whatsapp|matrix|email|teams|line|irc|twitch|nostr|channel|surface|webhook|pair)\b/.test(text)) {
      return 'channel-setup';
    }
    return null;
  }

  private async maybeRetryProviderFallback(
    command: ExperienceCommand,
    plan: ReturnType<NaturalCommandRouterService['route']>,
    firstResult: UniversalAgentRunResult,
  ): Promise<UniversalAgentRunResult> {
    if (firstResult.ok !== false || !this.agentGateway) return firstResult;

    const firstSnapshot = this.buildHome({
      surface: command.surface,
      userId: command.userId,
      sessionId: firstResult.run.sessionId || command.sessionId || null,
      workspace: command.workspace || firstResult.run.workspace || null,
      activeRunId: firstResult.run.id,
      responseProfile: command.responseProfile || null,
    });
    const matrix = this.safeProviderReadinessMatrix();
    const projection = this.selfHealingUx.buildProjection({
      attempted: plan.title,
      commandText: command.text,
      snapshot: firstSnapshot,
      error: firstResult.run.summary || firstResult.replies.map((reply) => reply.text).join('\n'),
      providerMatrix: matrix,
    });
    const fallbackProvider = this.selectFallbackProvider(projection, firstResult.run.modelProfile.providerLabel);
    if (!fallbackProvider || !isProviderHealingIssue(projection.issue)) {
      return firstResult;
    }

    try {
      const retryResult = await this.agentGateway.handle({
        userId: command.userId,
        sessionId: command.sessionId,
        channel: command.surface,
        text: command.text,
        workspace: command.workspace || null,
        metadata: {
          ...(command.metadata || {}),
          providerName: fallbackProvider,
          responseProfile: command.responseProfile || undefined,
          selfHealingProviderFallback: {
            fromProvider: firstResult.run.modelProfile.providerLabel || null,
            selectedProvider: fallbackProvider,
            issue: projection.issue,
            previousRunId: firstResult.run.id,
          },
          experiencePlan: {
            id: plan.id,
            kind: plan.kind,
            risk: plan.risk,
            requiresApproval: plan.requiresApproval,
            autonomyMode: command.autonomyMode,
          },
        },
      });
      this.selfHealingReceipts.append({
        projection,
        action: projection.actions.find((candidate) => candidate.kind === 'retry_fallback') || projection.actions[0] || null,
        status: retryResult.ok ? 'applied' : 'failed',
        applied: true,
        fallbackProvider,
        summary: retryResult.ok
          ? `Provider fallback retried through ${fallbackProvider} after ${projection.issue}.`
          : `Provider fallback through ${fallbackProvider} was attempted but still failed.`,
      });
      return retryResult.ok ? retryResult : firstResult;
    } catch (error) {
      this.selfHealingReceipts.append({
        projection,
        action: projection.actions.find((candidate) => candidate.kind === 'retry_fallback') || projection.actions[0] || null,
        status: 'failed',
        applied: true,
        fallbackProvider,
        summary: `Provider fallback through ${fallbackProvider} failed: ${error instanceof Error ? error.message : String(error || 'unknown error')}.`,
      });
      return firstResult;
    }
  }

  private finalizeCommandResult(
    command: ExperienceCommand,
    result: ExperienceCommandResult,
  ): ExperienceCommandResult {
    const projection = this.selfHealingUx.buildProjection({
      attempted: result.plan.title,
      commandText: command.text,
      result,
      snapshot: result.snapshot,
    });
    if (!projection.shouldRender) return result;

    const primaryAction = projection.actions[0] || null;
    const status = projection.needsUserInput
      ? 'needs_user'
      : projection.canZavorthRepair
        ? 'proposed'
        : 'blocked';
    const receipt = this.selfHealingReceipts.append({
      projection,
      action: primaryAction,
      status,
      applied: false,
      summary: projection.problem,
    });
    const selfHealingCards = this.buildSelfHealingActionCards(projection, receipt);
    const snapshot: ExperienceSnapshot = {
      ...result.snapshot,
      actionCards: this.mergeActionCards(selfHealingCards, result.snapshot.actionCards || []),
      receipts: this.mergeExperienceReceipts(
        [this.selfHealingReceiptToExperienceReceipt(receipt)],
        result.snapshot.receipts,
      ),
      raw: {
        ...(result.snapshot.raw || {}),
        selfHealing: projection,
        selfHealingReceipt: receipt,
      },
    };
    return {
      ...result,
      snapshot,
      receipts: snapshot.receipts,
    };
  }

  private buildSelfHealingActionCards(
    projection: ZavorthSelfHealingProjection,
    receipt: ZavorthSelfHealingReceipt,
  ): ExperienceActionCard[] {
    if (projection.issue === 'none') return [];
    return [{
      contractVersion: EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
      id: `self-healing:${projection.issue}:${receipt.id.split(':').pop()}`,
      source: 'self-healing',
      title: this.selfHealingCardTitle(projection),
      summary: projection.nextSafeAction,
      risk: this.selfHealingRisk(projection),
      status: projection.needsUserInput || projection.canZavorthRepair ? 'pending' : 'ready',
      scope: projection.setup?.target || 'current request',
      sandbox: projection.setup?.target === 'sandbox' ? 'required' : 'not required',
      affectedFiles: [],
      affectedCommands: projection.actions.map((candidate) => candidate.command).filter((entry): entry is string => Boolean(entry)),
      ttlSeconds: 3600,
      receiptHint: receipt.id,
      actions: projection.actions.slice(0, 4).map((candidate) => this.selfHealingActionToExperienceAction(projection, candidate)),
      createdAt: receipt.createdAt,
    }];
  }

  private buildSelfHealingCardsFromReceipts(receipts: ZavorthSelfHealingReceipt[]): ExperienceActionCard[] {
    return receipts
      .filter((receipt) => receipt.status === 'proposed' || receipt.status === 'needs_user' || receipt.status === 'failed')
      .slice(0, 3)
      .map((receipt) => {
        const target = receipt.issue.startsWith('channel_')
          ? 'channel'
          : receipt.issue.startsWith('provider_')
            ? 'provider'
            : receipt.issue === 'sandbox_unavailable'
              ? 'sandbox'
              : receipt.issue === 'runtime_unavailable'
                ? 'runtime'
                : 'request';
        return {
          contractVersion: EXPERIENCE_ACTION_CARD_CONTRACT_VERSION,
          id: `self-healing:receipt:${receipt.id.split(':').pop()}`,
          source: 'self-healing' as const,
          title: receipt.applied ? `Recovered ${target}` : `Recover ${target}`,
          summary: receipt.nextSafeAction,
          risk: receipt.approvalRequired ? 'attention' as const : 'safe' as const,
          status: receipt.status === 'failed' ? 'blocked' as const : 'pending' as const,
          scope: target,
          sandbox: target === 'sandbox' ? 'required' : 'not required',
          affectedFiles: [],
          affectedCommands: [],
          ttlSeconds: 3600,
          receiptHint: receipt.id,
          actions: this.actionsForSelfHealingReceipt(receipt),
          createdAt: receipt.createdAt,
        };
      });
  }

  private actionsForSelfHealingReceipt(receipt: ZavorthSelfHealingReceipt): ExperienceAction[] {
    if (receipt.issue.startsWith('provider_')) {
      return [
        action({
          id: `self-healing:${receipt.issue}:configure-provider`,
          label: 'Configure provider',
          kind: 'healing',
          command: 'connect a provider',
          risk: 'safe',
          reason: 'Continue provider setup inside the conversation without exposing secrets.',
        }),
        action({
          id: `self-healing:${receipt.issue}:retry-fallback`,
          label: 'Retry fallback',
          kind: 'healing',
          command: receipt.fallbackProvider ? `retry with ${receipt.fallbackProvider}` : 'retry with fallback',
          risk: 'safe',
          reason: 'Use an allowed gateway fallback route when one is ready.',
        }),
      ];
    }
    if (receipt.issue.startsWith('channel_')) {
      return [action({
        id: `self-healing:${receipt.issue}:configure-channel`,
        label: 'Connect surface',
        kind: 'healing',
        command: 'connect a channel',
        risk: 'safe',
        reason: 'Collect only the missing token, webhook or pairing detail.',
      })];
    }
    if (receipt.issue === 'approval_required') {
      return [action({
        id: `self-healing:${receipt.issue}:review-approval`,
        label: 'Review approval',
        kind: 'approval',
        command: 'review pending approval',
        risk: 'attention',
        requiresApproval: false,
        reason: 'Show scope, risk and receipt preview before deciding.',
      })];
    }
    return [action({
      id: `self-healing:${receipt.issue}:inspect`,
      label: 'Inspect recovery',
      kind: 'healing',
      risk: 'attention',
      reason: receipt.summary,
    })];
  }

  private selfHealingActionToExperienceAction(
    projection: ZavorthSelfHealingProjection,
    healingAction: ZavorthSelfHealingAction,
  ): ExperienceAction {
    return action({
      id: `self-healing:${projection.issue}:${healingAction.id}`,
      label: healingAction.label,
      kind: 'healing',
      command: healingAction.command || healingAction.prompt || null,
      risk: this.selfHealingRisk(projection),
      requiresApproval: healingAction.approvalRequired,
      reason: healingAction.detail,
    });
  }

  private selfHealingReceiptToExperienceReceipt(receipt: ZavorthSelfHealingReceipt): ExperienceReceipt {
    return {
      id: receipt.id,
      title: receipt.applied ? `Self-healing applied: ${receipt.issue}` : `Self-healing prepared: ${receipt.issue}`,
      detail: receipt.summary,
      status: receipt.status === 'applied' || receipt.status === 'skipped'
        ? 'ready'
        : receipt.status === 'failed'
          ? 'failed'
          : receipt.status === 'blocked'
            ? 'blocked'
            : 'pending',
      source: 'self-healing',
      createdAt: receipt.createdAt,
    };
  }

  private selfHealingCardTitle(projection: ZavorthSelfHealingProjection): string {
    if (projection.issue.startsWith('provider_')) return 'Provider recovery';
    if (projection.issue.startsWith('channel_')) return 'Channel setup';
    if (projection.issue === 'approval_required') return 'Approval needed';
    if (projection.issue === 'sandbox_unavailable') return 'Sandbox recovery';
    if (projection.issue === 'runtime_unavailable') return 'Runtime recovery';
    return 'Recovery plan';
  }

  private selfHealingRisk(projection: ZavorthSelfHealingProjection): ExperienceAction['risk'] {
    if (projection.issue === 'approval_required' || projection.issue === 'sandbox_unavailable') return 'attention';
    if (projection.issue === 'runtime_unavailable') return 'attention';
    if (projection.issue === 'unknown_failure') return 'attention';
    return 'safe';
  }

  private mergeExperienceReceipts(
    primary: ExperienceReceipt[],
    secondary: ExperienceReceipt[],
  ): ExperienceReceipt[] {
    const seen = new Set<string>();
    return [...primary, ...secondary]
      .filter((receipt) => {
        if (seen.has(receipt.id)) return false;
        seen.add(receipt.id);
        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 12);
  }

  private mergeActionCards(
    primary: ExperienceActionCard[],
    secondary: ExperienceActionCard[],
  ): ExperienceActionCard[] {
    const seen = new Set<string>();
    return [...primary, ...secondary]
      .filter((card) => {
        if (seen.has(card.id)) return false;
        seen.add(card.id);
        return true;
      })
      .slice(0, 12);
  }

  private safeProviderReadinessMatrix() {
    try {
      return this.providerReadinessMatrix.buildSnapshot({
        includeAdvanced: false,
        probe: false,
        live: false,
      });
    } catch {
      return null;
    }
  }

  private selectFallbackProvider(
    projection: ZavorthSelfHealingProjection,
    attemptedProvider: string | null | undefined,
  ): string | null {
    const attempted = normalizeKey(attemptedProvider);
    for (const candidate of projection.fallback?.candidates || []) {
      if (normalizeKey(candidate) && normalizeKey(candidate) !== attempted) return candidate;
    }
    return null;
  }

  private replyFromText(text: string, command: ExperienceCommand, runId: string | null) {
    return {
      id: `experience-reply:${Date.now().toString(36)}`,
      role: 'assistant' as const,
      text,
      createdAt: this.now().toISOString(),
      runId,
    };
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
  return issue === 'provider_auth'
    || issue === 'provider_quota'
    || issue === 'provider_timeout'
    || issue === 'provider_unavailable';
}
