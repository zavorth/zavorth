import {
  EXPERIENCE_COMMAND_CONTRACT_VERSION,
  EXPERIENCE_SNAPSHOT_CONTRACT_VERSION,
  type ExperienceAction,
  type ExperienceApproval,
  type ExperienceCommand,
  type ExperienceCommandResult,
  type ExperienceHealthStatus,
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
import type { ZavorthMemoryPlaneService } from '../ZavorthMemoryPlaneService.js';
import type { ZavorthLearningPlaneService } from '../ZavorthLearningPlaneService.js';
import type { RuntimeAccessReadinessService } from '../../runtime/access/RuntimeAccessReadinessService.js';

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
};

export type ExperienceHomeInput = {
  surface?: ExperienceSurface;
  sessionId?: string | null;
  workspace?: string | null;
  activeRunId?: string | null;
  activeTraceId?: string | null;
  userId?: string | null;
  responseProfile?: ExperienceResponseProfileId | null;
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
    const receipts = this.buildReceipts(activeRun, runs, approvals);
    const memorySignals = this.buildMemorySignals(activeRun, workspace);
    const learningCandidates = this.learningOs.buildCandidates({ workspace });
    const learningSummary = this.learningOs.buildSummary({ workspace });
    const trust = this.trustLens.build({
      activeRun,
      approvals,
      sandboxMode: normalizeText(activeRun?.metadata?.sandboxIsolation, 'governed-local'),
    });
    const health = this.buildHealth(agentSnapshot, learningSummary.pending, approvals);
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
    const actionCards = this.actionCards.build({
      activeRun,
      approvals,
      learningCandidates,
      diffReviews,
      contextRecovery,
      autoHealing,
      now: this.now(),
    });
    const nextActions = this.buildNextActions(health.status, approvals.length, learningSummary.pending);
    const pendingApprovals = approvals.filter((approval) => approval.status === 'pending').length;
    const pulse = this.pulseBrief.build({
      surface,
      generatedAt,
      workspace: workspace || activeRun?.workspace || null,
      activeRun,
      runs,
      approvals,
      learningCandidates,
      learningPending: learningSummary.pending,
      learningSummary: learningSummary.summary,
      receipts,
      nextActions,
      actionCards,
      health,
      trust,
      requestedProfile: input.responseProfile || persistedProfile || null,
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
        pending: learningSummary.pending,
      },
      trust,
      daily: {
        summary: health.summary,
        activeTask: activeRun?.title || activeRun?.input || null,
        health: health.status,
        nextSteps: nextActions.map((item) => item.label).slice(0, 5),
        pendingApprovals,
        pendingLearning: learningSummary.pending,
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
    const plan = this.router.route(command);

    try {
      if (command.approval?.id) {
        const result = command.approval.decision === 'approve'
          ? await this.agentGateway?.approve(command.approval.id)
          : await this.agentGateway?.reject(command.approval.id);
        const snapshot = this.buildHome(command);
        const reply = this.replyFromText(
          result
            ? `Aprovacao ${command.approval.decision === 'approve' ? 'aprovada' : 'rejeitada'}: ${command.approval.id}.`
            : `Nao encontrei aprovacao pendente para ${command.approval.id}.`,
          command,
          result?.run?.id || null,
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

      if (command.learning?.decision) {
        const learning = this.learningOs.decide({
          candidateId: command.learning.candidateId || null,
          decision: command.learning.decision,
          workspace: command.workspace || null,
        });
        const snapshot = this.buildHome(command);
        const reply = this.replyFromText(learning.summary, command, null);
        return {
          ok: learning.ok,
          handled: true,
          plan,
          snapshot,
          replies: [reply],
          receipts: snapshot.receipts,
          error: learning.ok ? null : learning.summary,
        };
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
        return {
          ok: diffResult.ok,
          handled: true,
          plan,
          snapshot,
          replies: [reply],
          receipts: snapshot.receipts,
          error: diffResult.ok ? null : diffResult.summary,
        };
      }

      if (command.contextRecoveryDecision?.recoveryId) {
        const snapshot = this.buildHome(command);
        const reply = this.replyFromText(
          `Contexto selecionado: ${command.contextRecoveryDecision.optionId}. Vou continuar usando esse alvo antes de executar qualquer acao sensivel.`,
          command,
          snapshot.agent.activeRunId,
        );
        return {
          ok: true,
          handled: true,
          plan,
          snapshot,
          replies: [reply],
          receipts: snapshot.receipts,
          error: null,
        };
      }

      if (plan.kind === 'dashboard' || plan.kind === 'diagnostics' || plan.kind === 'learning' || plan.kind === 'memory') {
        const snapshot = this.buildHome(command);
        const reply = this.replyFromText(plan.nextSafeAction, command, snapshot.agent.activeRunId);
        return {
          ok: true,
          handled: true,
          plan,
          snapshot,
          replies: [reply],
          receipts: snapshot.receipts,
          error: null,
        };
      }

      let runResult: UniversalAgentRunResult | null = null;
      if (plan.shouldExecuteAgent && this.agentGateway) {
        runResult = await this.agentGateway.handle({
          userId: command.userId,
          sessionId: command.sessionId,
          channel: command.surface,
          text: command.text,
          workspace: command.workspace || null,
          metadata: {
            ...(command.metadata || {}),
            responseProfile: command.responseProfile || undefined,
            experiencePlan: {
              id: plan.id,
              kind: plan.kind,
              risk: plan.risk,
              requiresApproval: plan.requiresApproval,
              autonomyMode: command.autonomyMode,
            },
          },
        });
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
      return {
        ok: runResult?.ok ?? true,
        handled: true,
        plan,
        snapshot,
        replies,
        receipts: snapshot.receipts,
        error: runResult?.ok === false ? snapshot.agent.summary : null,
      };
    } catch (error: any) {
      const snapshot = this.buildHome(command);
      const message = `Falha na Experience Core: ${error?.message || 'erro desconhecido'}.`;
      return {
        ok: false,
        handled: true,
        plan,
        snapshot,
        replies: [this.replyFromText(message, command, snapshot.agent.activeRunId)],
        receipts: snapshot.receipts,
        error: message,
      };
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
        label: 'Abrir Command Center',
        kind: 'navigation',
        command: 'zavorth open',
        route: '/control',
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
