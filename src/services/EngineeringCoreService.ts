import type { IMessageContext } from '../contracts/IMessageBroker.js';
import type {
  EngineeringAction,
  EngineeringConversationScope,
  EngineeringIntent,
  EngineeringIntentRequest,
  EngineeringPlan,
  EngineeringReplaySnapshot,
  EngineeringRunSnapshot,
  EngineeringSessionSnapshot,
  RequirementGap,
} from '../contracts/EngineeringCoreContract.js';
import type {
  SystemOverlordActionRecord,
  SystemOverlordAutonomyLevel,
  SystemOverlordCapability,
} from '../contracts/SystemOverlordContract.js';
import { EngineeringContextService } from './EngineeringContextService.js';
import { EngineeringIntentService } from './EngineeringIntentService.js';
import { EngineeringRunLedgerService } from './EngineeringRunLedgerService.js';
import { EngineeringSessionService } from './EngineeringSessionService.js';
import { RequirementGapService } from './RequirementGapService.js';
import { DependencyNegotiationService } from './DependencyNegotiationService.js';
import { RepairPlannerService } from './RepairPlannerService.js';
import { EngineeringRunLoopService } from './EngineeringRunLoopService.js';
import { SupervisedExecutionGatewayService } from './SupervisedExecutionGatewayService.js';
import type { SurfaceTaskDispatcherLike } from './SurfaceRuntime.js';
import type {
  SelfModificationApplyResult,
  SelfModificationCommandService,
  SelfModificationPreviewResult,
} from './SelfModificationCommandService.js';

type StartRunInput = {
  rawText: string;
  workspaceHint?: string | null;
  scope?: EngineeringConversationScope | null;
  dispatcher?: SurfaceTaskDispatcherLike | null;
  dispatchContext?: IMessageContext | null;
  autoDispatch?: boolean;
  startSession?: boolean;
};

type EngineeringCoreServiceOptions = {
  intentService?: EngineeringIntentService;
  contextService?: EngineeringContextService;
  ledgerService?: EngineeringRunLedgerService;
  sessionService?: EngineeringSessionService;
  requirementGapService?: RequirementGapService;
  dependencyNegotiationService?: DependencyNegotiationService;
  repairPlannerService?: RepairPlannerService;
  selfModificationCommandService?: Pick<
    SelfModificationCommandService,
    'createPreview' | 'applyPreview' | 'rollbackChangeSet'
  > | null;
  executionGatewayService?: Pick<
    SupervisedExecutionGatewayService,
    'execute' | 'inferCapabilityFromCommand' | 'listActions'
  > | null;
  runLoopService?: EngineeringRunLoopService | null;
};

export class EngineeringCoreService {
  private readonly intentService: EngineeringIntentService;
  private readonly contextService: EngineeringContextService;
  private readonly ledgerService: EngineeringRunLedgerService;
  private readonly sessionService: EngineeringSessionService;
  private readonly requirementGapService: RequirementGapService;
  private readonly dependencyNegotiationService: DependencyNegotiationService;
  private readonly repairPlannerService: RepairPlannerService;
  private readonly selfModificationCommandService: Pick<
    SelfModificationCommandService,
    'createPreview' | 'applyPreview' | 'rollbackChangeSet'
  > | null;
  private readonly executionGatewayService: Pick<
    SupervisedExecutionGatewayService,
    'execute' | 'inferCapabilityFromCommand' | 'listActions'
  > | null;
  private readonly runLoopService: EngineeringRunLoopService | null;
  private readonly recentRunsByScope = new Map<string, string>();

  constructor(options: EngineeringCoreServiceOptions = {}) {
    this.intentService = options.intentService || new EngineeringIntentService();
    this.contextService = options.contextService || new EngineeringContextService();
    this.ledgerService = options.ledgerService || new EngineeringRunLedgerService();
    this.sessionService = options.sessionService || new EngineeringSessionService();
    this.requirementGapService = options.requirementGapService || new RequirementGapService();
    this.dependencyNegotiationService =
      options.dependencyNegotiationService || new DependencyNegotiationService();
    this.repairPlannerService = options.repairPlannerService || new RepairPlannerService();
    this.selfModificationCommandService = options.selfModificationCommandService || null;
    this.executionGatewayService = options.executionGatewayService || null;
    this.runLoopService = options.runLoopService || (
      this.executionGatewayService
        ? new EngineeringRunLoopService({
            executionGatewayService: this.executionGatewayService,
            repairPlannerService: this.repairPlannerService,
          })
        : null
    );
  }

  public async maybeHandleSurfaceRequest(
    ctx: IMessageContext,
    dispatcher?: SurfaceTaskDispatcherLike | null,
  ): Promise<boolean> {
    const rawText = String(ctx.rawText || '').trim();
    if (!rawText || rawText.startsWith('/')) {
      return false;
    }

    const scope = this.buildScope(ctx);
    const followup = this.parseFollowup(rawText);
    if (followup) {
      const recent = this.getRecentRun(scope);
      if (!recent) {
        return false;
      }
      if (followup === 'status' || followup === 'next_step') {
        await ctx.reply(this.dependencyNegotiationService.buildReply({
          runId: recent.runId,
          intent: recent.intent,
          context: recent.context,
          gaps: recent.requirementGaps,
        }));
        return true;
      }
      if (followup === 'continue') {
        const continued = this.shouldUseSupervisedLoop(recent)
          ? await this.executeRun({
              runId: recent.runId,
              approved: this.textApproves(rawText),
              requestedBy: ctx.userId,
            })
          : await this.continueRun(recent.runId, dispatcher, ctx);
        await ctx.reply(continued.replySummary);
        return true;
      }
    }

    const parsedIntent = this.intentService.parse({
      rawText,
      workspaceHint: null,
      scope,
    });
    if (!parsedIntent) {
      return false;
    }

    const result = await this.startRun({
      rawText,
      scope,
      dispatcher,
      dispatchContext: ctx,
      autoDispatch: true,
      startSession: false,
    });
    await ctx.reply(result.replySummary);
    return true;
  }

  public async startRun(input: StartRunInput): Promise<EngineeringRunSnapshot> {
    const request: EngineeringIntentRequest = {
      rawText: input.rawText,
      workspaceHint: input.workspaceHint || null,
      scope: input.scope || null,
    };
    const intent = this.requireIntent(request);
    const context = await this.contextService.buildContext(request.workspaceHint || intent.workspaceHint || null);
    const runId = this.ledgerService.nextRunId();
    const requirementGaps = this.requirementGapService.detectForIntent({
      intent,
      context,
    });
    const session = input.startSession && requirementGaps.every((gap) => !gap.blocking)
      ? this.sessionService.ensureSession(runId, context.workspace)
      : null;
    const plan = this.buildPlan(intent, requirementGaps);
    const replySummary = this.dependencyNegotiationService.buildReply({
      runId,
      intent,
      context,
      gaps: requirementGaps,
    });

    let snapshot: EngineeringRunSnapshot = {
      runId,
      scopeKey: input.scope ? this.scopeToKey(input.scope) : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: requirementGaps.some((gap) => gap.blocking)
        ? 'waiting_user'
        : session
          ? 'session_ready'
          : 'ready',
      request,
      intent,
      context,
      plan,
      requirementGaps,
      linkedTaskId: null,
      session,
      hostActions: [],
      loop: null,
      replySummary,
    };

    if (input.scope) {
      this.recentRunsByScope.set(this.scopeToKey(input.scope), runId);
    }

    if (
      input.autoDispatch
      && input.dispatcher
      && input.dispatchContext
      && requirementGaps.every((gap) => !gap.blocking || gap.operatorAction === 'approve_install')
    ) {
      const dispatchResult = await input.dispatcher.dispatchTaskMessage({
        ctx: input.dispatchContext as any,
        platform: input.dispatchContext.platform as any,
        chatId: input.dispatchContext.chatId,
        text: input.rawText,
        sourceUserId: input.dispatchContext.userId,
        sessionId: input.dispatchContext.threadId || null,
        threadId: input.dispatchContext.threadId || null,
        source: input.dispatchContext.platform as any,
      });
      snapshot = {
        ...snapshot,
        status: 'dispatched',
        linkedTaskId: dispatchResult.task?.task_id || null,
        replySummary: `${replySummary}\n\nAbri a tarefa canonica ${dispatchResult.task?.task_id || 'n/d'} para seguir com esse run.`,
      };
    }

    return this.ledgerService.saveRun(snapshot);
  }

  public async continueRun(
    runId: string,
    dispatcher?: SurfaceTaskDispatcherLike | null,
    ctx?: IMessageContext | null,
  ): Promise<EngineeringRunSnapshot> {
    const run = this.requireRun(runId);
    if (run.status === 'dispatched' || run.linkedTaskId) {
      return run;
    }

    if (run.requirementGaps.some((gap) => gap.blocking && gap.operatorAction !== 'approve_install')) {
      return run;
    }

    if (!dispatcher || !ctx) {
      return this.ledgerService.saveRun({
        ...run,
        status: 'ready',
        replySummary: `${run.replySummary}\n\nO run esta pronto, mas esta surface nao expoe dispatcher suficiente para seguir daqui.`,
      });
    }

    const dispatchResult = await dispatcher.dispatchTaskMessage({
      ctx: ctx as any,
      platform: ctx.platform as any,
      chatId: ctx.chatId,
      text: run.request.rawText,
      sourceUserId: ctx.userId,
      sessionId: ctx.threadId || null,
      threadId: ctx.threadId || null,
      source: ctx.platform as any,
    });

    return this.ledgerService.saveRun({
      ...run,
      status: 'dispatched',
      linkedTaskId: dispatchResult.task?.task_id || null,
      replySummary: `${run.replySummary}\n\nSegui com o fluxo canonico e abri a tarefa ${dispatchResult.task?.task_id || 'n/d'}.`,
    });
  }

  public listRuns(limit: number = 20): EngineeringRunSnapshot[] {
    return this.ledgerService.listRuns(limit);
  }

  public getRun(runId: string): EngineeringRunSnapshot | null {
    return this.ledgerService.getRun(runId);
  }

  public approveRun(runId: string): EngineeringRunSnapshot {
    const run = this.requireRun(runId);
    const remainingGaps = run.requirementGaps.filter((gap) => gap.operatorAction !== 'approve_install');
    return this.ledgerService.saveRun({
      ...run,
      status: remainingGaps.some((gap) => gap.blocking) ? 'waiting_user' : 'ready',
      requirementGaps: remainingGaps,
      replySummary: this.dependencyNegotiationService.buildReply({
        runId: run.runId,
        intent: run.intent,
        context: run.context,
        gaps: remainingGaps,
      }),
    });
  }

  public async proposePatch(input: {
    runId: string;
    filePath: string;
    instruction: string;
    requestedBy?: string | null;
  }): Promise<EngineeringRunSnapshot> {
    if (!this.selfModificationCommandService) {
      throw new Error('Selfmod canonico indisponivel para propor patch no Engineering Core.');
    }
    const run = this.requireRun(input.runId);
    const preview = await this.selfModificationCommandService.createPreview(
      input.filePath,
      input.instruction,
      String(input.requestedBy || run.request.scope?.userId || 'engineering-core'),
    );

    if (!preview.success || !preview.previewId) {
      return this.ledgerService.saveRun({
        ...run,
        plan: {
          ...run.plan,
          patchProposal: {
            proposalId: preview.previewId || `patch-failed-${Date.now()}`,
            previewId: preview.previewId || null,
            changeId: null,
            mode: preview.mode,
            status: 'failed',
            summary: preview.summary,
            targetFiles: preview.relativePath ? [preview.relativePath] : [input.filePath],
            diffSummary: preview.diffSummary || null,
            previewPath: null,
          },
        },
        replySummary: `${run.replySummary}\n\nNao consegui gerar o preview seguro do patch: ${preview.summary}`,
      });
    }

    return this.ledgerService.saveRun({
      ...run,
      plan: {
        ...run.plan,
        patchProposal: this.previewToPatchProposal(preview, input.filePath),
      },
      replySummary: `${run.replySummary}\n\nPatch preview criado (${preview.previewId}) para ${preview.relativePath || input.filePath}.`,
    });
  }

  public async applyPatch(runId: string): Promise<EngineeringRunSnapshot> {
    const run = this.requireRun(runId);
    if (!run.plan.patchProposal) {
      throw new Error('Nenhum patch proposto neste run.');
    }
    if (!this.selfModificationCommandService) {
      throw new Error('Selfmod canonico indisponivel para aplicar patch no Engineering Core.');
    }
    const previewId = String(run.plan.patchProposal.previewId || '').trim();
    if (!previewId) {
      throw new Error('Patch proposto sem previewId aplicavel.');
    }
    const apply = await this.selfModificationCommandService.applyPreview(
      previewId,
      String(run.request.scope?.userId || 'engineering-core'),
    );
    const patchProposal = this.applyToPatchProposal(run.plan.patchProposal, apply);
    return this.ledgerService.saveRun({
      ...run,
      plan: {
        ...run.plan,
        patchProposal,
      },
      status: apply.success ? 'ready' : 'failed',
      replySummary: `${run.replySummary}\n\n${apply.success ? 'Patch aplicado com selfmod canonico.' : 'Patch nao foi aplicado.'} ${apply.summary}`,
    });
  }

  public async rollbackRun(runId: string): Promise<EngineeringRunSnapshot> {
    const run = this.requireRun(runId);
    if (!run.plan.patchProposal) {
      throw new Error('Nenhum patch proposto neste run para rollback.');
    }
    if (!this.selfModificationCommandService) {
      throw new Error('Selfmod canonico indisponivel para rollback no Engineering Core.');
    }
    const changeId = String(run.plan.patchProposal.changeId || '').trim();
    if (!changeId) {
      throw new Error('Patch ainda nao tem changeId aplicado para rollback.');
    }
    const rollback = await this.selfModificationCommandService.rollbackChangeSet(
      changeId,
      String(run.request.scope?.userId || 'engineering-core'),
    );
    return this.ledgerService.saveRun({
      ...run,
      plan: {
        ...run.plan,
        patchProposal: {
          ...run.plan.patchProposal,
          status: rollback.success ? 'rolled_back' : 'failed',
          summary: rollback.summary,
        },
      },
      status: rollback.success ? 'ready' : 'failed',
      replySummary: `${run.replySummary}\n\n${rollback.success ? 'Rollback aplicado com selfmod canonico.' : 'Rollback nao foi aplicado.'} ${rollback.summary}`,
    });
  }

  public async runCommand(input: {
    runId: string;
    command: string;
    approved?: boolean;
    dryRun?: boolean;
    requestedBy?: string | null;
    capability?: SystemOverlordCapability | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<EngineeringRunSnapshot> {
    if (!this.executionGatewayService) {
      throw new Error('Execution Gateway supervisionado indisponivel para este Engineering Core.');
    }
    const run = this.requireRun(input.runId);
    const command = String(input.command || '').trim();
    if (!command) {
      throw new Error('command obrigatorio para run-command.');
    }
    const action = await this.executionGatewayService.execute({
      runId: run.runId,
      requestedBy: input.requestedBy || run.request.scope?.userId || 'engineering-core',
      surface: run.request.scope?.platform || 'engineering-core',
      profile: run.plan.profile,
      autonomyLevel: this.resolveAutonomyLevel(run.intent),
      capability: input.capability || this.executionGatewayService.inferCapabilityFromCommand(command),
      command,
      workspace: run.context.workspace,
      objective: run.intent.objective,
      approved: input.approved === true,
      dryRun: input.dryRun === true,
      metadata: {
        intentKind: run.intent.kind,
        runId: run.runId,
        ...(input.metadata || {}),
      },
    });
    const status = this.statusAfterHostAction(run, action);
    const hostActions = [...(run.hostActions || []), action].slice(-25);
    return this.ledgerService.saveRun({
      ...run,
      status,
      hostActions,
      replySummary: `${run.replySummary}\n\n${this.summarizeHostAction(action)}`,
    });
  }

  public async executeRun(input: {
    runId: string;
    approved?: boolean;
    dryRun?: boolean;
    command?: string | null;
    requestedBy?: string | null;
    maxAttempts?: number | null;
  }): Promise<EngineeringRunSnapshot> {
    if (!this.runLoopService) {
      throw new Error('Loop supervisionado de engenharia indisponivel para este Engineering Core.');
    }
    const run = this.requireRun(input.runId);
    const result = await this.runLoopService.execute({
      run,
      approved: input.approved === true,
      dryRun: input.dryRun === true,
      commandOverride: input.command || null,
      requestedBy: input.requestedBy || run.request.scope?.userId || null,
      maxAttempts: input.maxAttempts || null,
    });
    return this.ledgerService.saveRun({
      ...run,
      status: result.status,
      hostActions: [...(run.hostActions || []), ...result.hostActions].slice(-25),
      loop: result.loop,
      plan: {
        ...run.plan,
        repairProposal: result.repairProposal || run.plan.repairProposal || null,
      },
      replySummary: `${run.replySummary}\n\n${result.replySummary}`,
    });
  }

  public getReplay(runId: string): EngineeringReplaySnapshot {
    const run = this.requireRun(runId);
    return this.sessionService.getReplay(run);
  }

  public getRecentRun(scope: EngineeringConversationScope): EngineeringRunSnapshot | null {
    const runId = this.recentRunsByScope.get(this.scopeToKey(scope));
    return runId ? this.ledgerService.getRun(runId) : null;
  }

  private requireRun(runId: string): EngineeringRunSnapshot {
    const run = this.ledgerService.getRun(runId);
    if (!run) {
      throw new Error('Run de engenharia nao encontrado.');
    }
    return run;
  }

  private requireIntent(request: EngineeringIntentRequest): EngineeringIntent {
    const parsed = this.intentService.parse(request);
    if (!parsed) {
      throw new Error('Pedido nao reconhecido como fluxo de engenharia.');
    }
    return parsed;
  }

  private buildPlan(intent: EngineeringIntent, requirementGaps: RequirementGap[]): EngineeringPlan {
    const actions: EngineeringAction[] = [];
    if (intent.kind !== 'system_overlord_operation') {
      actions.push({ kind: 'inspect_fs', label: 'Montar contexto automatico do workspace' });
    }

    if (intent.kind === 'diagnose_build' || intent.kind === 'install_and_retry' || intent.kind === 'system_overlord_operation') {
      actions.push({ kind: 'run_command', label: 'Executar ou preparar a etapa de build/test' });
    }
    if (intent.kind === 'create_project') {
      actions.push({ kind: 'run_command', label: 'Preparar bootstrap do projeto' });
    }
    if (requirementGaps.length > 0) {
      actions.push({ kind: 'ask_user', label: 'Negociar pendencias de ambiente ou aprovacao' });
    }
    actions.push({ kind: 'finalize_run', label: 'Registrar ledger e proximo passo' });

    const repairProposal = intent.kind === 'diagnose_build'
      ? this.repairPlannerService.planFromFailure({
          stderr: requirementGaps.map((gap) => gap.detail).join('\n'),
          command: intent.suggestedCommands[0] || null,
        })
      : null;

    return {
      summary: intent.kind === 'system_overlord_operation'
        ? `Engineering Core preparou uma acao supervisionada de ${intent.preferredCapability || 'runtime control'}.`
        : `Engineering Core preparado para ${intent.kind}.`,
      profile: intent.preferredProfile,
      actions,
      repairProposal,
      patchProposal: null,
    };
  }

  private previewToPatchProposal(preview: SelfModificationPreviewResult, fallbackPath: string) {
    return {
      proposalId: preview.previewId || `patch-${Date.now()}`,
      previewId: preview.previewId || null,
      changeId: null,
      mode: preview.mode,
      status: 'previewed' as const,
      summary: preview.summary,
      targetFiles: preview.relativePath ? [preview.relativePath] : [fallbackPath],
      diffSummary: preview.diffSummary || null,
      previewPath: null,
    };
  }

  private applyToPatchProposal(
    patchProposal: NonNullable<EngineeringPlan['patchProposal']>,
    apply: SelfModificationApplyResult,
  ): NonNullable<EngineeringPlan['patchProposal']> {
    return {
      ...patchProposal,
      changeId: apply.changeId || patchProposal.changeId || null,
      status: apply.success ? 'applied' : 'failed',
      summary: apply.summary,
      diffSummary: apply.diffSummary || patchProposal.diffSummary || null,
      targetFiles: apply.relativePath ? [apply.relativePath] : patchProposal.targetFiles,
    };
  }

  private resolveAutonomyLevel(intent: EngineeringIntent): SystemOverlordAutonomyLevel {
    if (intent.kind === 'next_step') {
      return 1;
    }
    if (intent.kind === 'undo_change') {
      return 2;
    }
    if (intent.kind === 'diagnose_build') {
      return 3;
    }
    if (intent.kind === 'install_and_retry' || intent.kind === 'create_project') {
      return 3;
    }
    if (intent.kind === 'system_overlord_operation' && intent.preferredAutonomyLevel) {
      return intent.preferredAutonomyLevel;
    }
    return intent.mutating ? 3 : 1;
  }

  private statusAfterHostAction(
    run: EngineeringRunSnapshot,
    action: SystemOverlordActionRecord,
  ): EngineeringRunSnapshot['status'] {
    if (action.status === 'completed' || action.status === 'dry_run') {
      return 'completed';
    }
    if (action.status === 'pending_approval') {
      return 'waiting_user';
    }
    if (action.status === 'blocked' || action.status === 'failed') {
      return 'failed';
    }
    return run.status;
  }

  private summarizeHostAction(action: SystemOverlordActionRecord): string {
    if (action.status === 'completed') {
      return `Execution Gateway concluiu ${action.decision.capability} em ${action.decision.runtimeTarget}.`;
    }
    if (action.status === 'dry_run') {
      return `Execution Gateway validou em dry-run: ${action.decision.reason}`;
    }
    if (action.status === 'pending_approval') {
      return `Execution Gateway aguardando aprovacao: ${action.decision.reason}`;
    }
    return `Execution Gateway bloqueou/falhou: ${action.errorMessage || action.decision.reason}`;
  }

  private shouldUseSupervisedLoop(run: EngineeringRunSnapshot): boolean {
    return Boolean(
      this.runLoopService
      && !run.linkedTaskId
      && run.plan.actions.some((action) => action.kind === 'run_command' || action.kind === 'rerun_step'),
    );
  }

  private textApproves(rawText: string): boolean {
    return /^(sim|pode|pode seguir|sim pode seguir|sim pode instalar|aplique|execute|rode|continua|continue)$/i.test(
      String(rawText || '').trim(),
    );
  }

  private parseFollowup(rawText: string): 'continue' | 'status' | 'next_step' | null {
    const normalized = String(rawText || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (/^(continue|continua|segue|pode seguir|prossiga|sim pode instalar|sim pode seguir)$/i.test(normalized)) {
      return 'continue';
    }
    if (/^(status do run|status disso|e agora\?|deu certo\?)$/i.test(normalized)) {
      return 'status';
    }
    if (/(o que falta( para continuar)?|qual o proximo passo)/i.test(normalized)) {
      return 'next_step';
    }
    return null;
  }

  private buildScope(ctx: IMessageContext): EngineeringConversationScope {
    return {
      platform: ctx.platform,
      chatId: ctx.chatId,
      userId: ctx.userId,
    };
  }

  private scopeToKey(scope: EngineeringConversationScope): string {
    return `${scope.platform}:${scope.chatId}:${scope.userId}`;
  }
}
